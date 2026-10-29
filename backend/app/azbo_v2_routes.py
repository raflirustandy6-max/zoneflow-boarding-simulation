"""
Unified FastAPI Router for AZBO V2 Simulation & Optimization Endpoints (`/api/v2/azbo/*`).

Uses the single authoritative engine in `azbo_core.py` (`CabinSpec`, `run_azbo_v2_evaluation`)
and the unified request/response schemas in `schemas.py`.
"""

from __future__ import annotations

import os
import threading
import time
import uuid
from typing import Any, Dict

from fastapi import APIRouter, Body, HTTPException, status

from .azbo_core import CabinSpec, SUPPORTED_AZBO_V2_STRATEGIES, run_azbo_v2_evaluation
from .schemas import (
    AzboV2HealthResponse,
    AzboV2JobStatusResponse,
    AzboV2OptimizeRequest,
    AzboV2OptimizeResponse,
)

azbo_v2_router = APIRouter(
    prefix="/api/v2/azbo",
    tags=["AZBO V2 Simulation & Optimization"],
)

AZBO_V2_JOBS: Dict[str, Dict[str, Any]] = {}
AZBO_V2_LOCK = threading.Lock()
MAX_RETAINED_JOBS = int(os.environ.get("ZONEFLOW_MAX_RETAINED_JOBS", "50"))


def _prune_azbo_v2_jobs_unlocked(max_retained: int = MAX_RETAINED_JOBS) -> None:
    if len(AZBO_V2_JOBS) <= max_retained:
        return
    finished_jobs = [
        (jid, rec.get("start_time", 0.0))
        for jid, rec in AZBO_V2_JOBS.items()
        if rec.get("status") in ("completed", "cancelled", "failed")
    ]
    finished_jobs.sort(key=lambda item: item[1])
    excess = len(AZBO_V2_JOBS) - max_retained
    for jid, _ in finished_jobs[:excess]:
        AZBO_V2_JOBS.pop(jid, None)


def _build_cabin_from_req(req: AzboV2OptimizeRequest) -> CabinSpec:
    return CabinSpec(
        rows=req.rows,
        left_seats=req.left_seats,
        right_seats=req.right_seats,
        row_pitch_m=req.row_pitch_m,
        cell_m=req.cell_m,
        left_letters=tuple(req.left_letters) if req.left_letters else None,
        right_letters=tuple(req.right_letters) if req.right_letters else None,
        layout_id=req.layout_id,
        layout_name=req.layout_name,
    )


@azbo_v2_router.get("/health", response_model=AzboV2HealthResponse)
def get_azbo_v2_health() -> AzboV2HealthResponse:
    """
    Memeriksa ketersediaan layanan backend AZBO V2 (`azbo_core`).
    """
    return AzboV2HealthResponse(
        status="online",
        engine="AZBO V2 Python Engine (azbo_core)",
        version="2.0.0",
        supported_strategies=list(SUPPORTED_AZBO_V2_STRATEGIES),
    )


@azbo_v2_router.post("/optimize", response_model=AzboV2OptimizeResponse)
def optimize_azbo_v2_sync(
    req: AzboV2OptimizeRequest = Body(default_factory=AzboV2OptimizeRequest),
) -> AzboV2OptimizeResponse:
    """
    Endpoint sinkron sesuai kontrak Blueprint AZBO bagian 9.2:
    Menerima spesifikasi kabin & proporsi bagasi, menjalankan GA dengan K variabel
    pada replikasi TRAINING, lalu membandingkan kandidat juara terhadap WMA, BTF,
    dan RANDOM pada replikasi TESTING baru (Common Random Numbers), serta
    mengembalikan rekomendasi, statistik (rerata, SD, CI 95%, paired comparison),
    dan event trace untuk animasi.
    """
    start_t = time.perf_counter()
    try:
        cabin = _build_cabin_from_req(req)
        result = run_azbo_v2_evaluation(
            cabin=cabin,
            bag_ratio=req.bag_ratio,
            ga_population=req.ga_population,
            ga_generations=req.ga_generations,
            train_reps=req.train_reps,
            test_reps=req.test_reps,
            seed=req.seed,
            zone_call_overhead_s=req.zone_call_overhead_s,
        )
        elapsed_s = round(time.perf_counter() - start_t, 3)
        return AzboV2OptimizeResponse(
            status="success",
            engine="AZBO V2 Python Engine (azbo_core)",
            execution_time_seconds=elapsed_s,
            scenario=result["scenario"],
            optimization=result["optimization"],
            recommendation=result["recommendation"],
            animation=result["animation"],
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(val_err)
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menjalankan optimasi AZBO V2: {str(exc)}",
        )


@azbo_v2_router.post("/jobs", response_model=AzboV2JobStatusResponse)
def start_azbo_v2_job(
    req: AzboV2OptimizeRequest = Body(default_factory=AzboV2OptimizeRequest),
) -> AzboV2JobStatusResponse:
    """
    Memulai pekerjaan optimasi & evaluasi AZBO V2 pada background thread dan
    mengembalikan job_id agar frontend dapat memantau progres secara real-time.
    """
    try:
        cabin = _build_cabin_from_req(req)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(val_err)
        )

    job_id = str(uuid.uuid4())
    job_record: Dict[str, Any] = {
        "job_id": job_id,
        "status": "running",
        "progress_percent": 5.0,
        "progress_message": "Memulai simulasi dan pencarian zona boarding...",
        "elapsed_time_seconds": 0.0,
        "result": None,
        "error_message": None,
        "start_time": time.time(),
        "cancelled": False,
    }

    with AZBO_V2_LOCK:
        _prune_azbo_v2_jobs_unlocked(MAX_RETAINED_JOBS - 1)
        AZBO_V2_JOBS[job_id] = job_record

    def worker() -> None:
        start_wall = time.perf_counter()
        try:
            def prog_cb(msg: str, pct: float) -> None:
                with AZBO_V2_LOCK:
                    if job_record.get("cancelled"):
                        raise RuntimeError("Pekerjaan simulasi dibatalkan oleh pengguna.")
                    job_record["progress_message"] = msg
                    job_record["progress_percent"] = round(pct, 1)
                    job_record["elapsed_time_seconds"] = round(
                        time.time() - job_record["start_time"], 2
                    )

            out = run_azbo_v2_evaluation(
                cabin=cabin,
                bag_ratio=req.bag_ratio,
                ga_population=req.ga_population,
                ga_generations=req.ga_generations,
                train_reps=req.train_reps,
                test_reps=req.test_reps,
                seed=req.seed,
                zone_call_overhead_s=req.zone_call_overhead_s,
                progress_callback=prog_cb,
            )
            elapsed_s = round(time.perf_counter() - start_wall, 3)
            resp = AzboV2OptimizeResponse(
                status="success",
                engine="AZBO V2 Python Engine (azbo_core)",
                execution_time_seconds=elapsed_s,
                scenario=out["scenario"],
                optimization=out["optimization"],
                recommendation=out["recommendation"],
                animation=out["animation"],
            )
            with AZBO_V2_LOCK:
                if job_record.get("cancelled"):
                    job_record["status"] = "cancelled"
                    job_record["progress_message"] = "Simulasi dibatalkan."
                else:
                    job_record["status"] = "completed"
                    job_record["progress_percent"] = 100.0
                    job_record["progress_message"] = (
                        "Selesai menyusun rekomendasi boarding."
                    )
                    job_record["elapsed_time_seconds"] = elapsed_s
                    job_record["result"] = resp
        except Exception as exc:
            with AZBO_V2_LOCK:
                if job_record.get("cancelled"):
                    job_record["status"] = "cancelled"
                    job_record["progress_message"] = "Simulasi dibatalkan."
                else:
                    job_record["status"] = "failed"
                    job_record["error_message"] = str(exc)
                job_record["elapsed_time_seconds"] = round(
                    time.time() - job_record["start_time"], 2
                )

    threading.Thread(target=worker, daemon=True).start()

    with AZBO_V2_LOCK:
        snap = {
            k: v
            for k, v in job_record.items()
            if k not in ("start_time", "cancelled")
        }
    return AzboV2JobStatusResponse(**snap)


@azbo_v2_router.get("/jobs/{job_id}", response_model=AzboV2JobStatusResponse)
def get_azbo_v2_job_status(job_id: str) -> AzboV2JobStatusResponse:
    """
    Mengambil progres terkini atau hasil akhir dari job optimasi AZBO V2.
    """
    with AZBO_V2_LOCK:
        if job_id not in AZBO_V2_JOBS:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pekerjaan simulasi dengan ID '{job_id}' tidak ditemukan.",
            )
        job = AZBO_V2_JOBS[job_id]
        if job["status"] == "running":
            job["elapsed_time_seconds"] = round(time.time() - job["start_time"], 2)
        snap = {
            k: v
            for k, v in job.items()
            if k not in ("start_time", "cancelled")
        }
    return AzboV2JobStatusResponse(**snap)


@azbo_v2_router.post("/jobs/{job_id}/cancel")
def cancel_azbo_v2_job(job_id: str) -> Dict[str, str]:
    """
    Membatalkan pekerjaan optimasi AZBO V2 yang sedang berjalan.
    """
    with AZBO_V2_LOCK:
        if job_id not in AZBO_V2_JOBS:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pekerjaan simulasi dengan ID '{job_id}' tidak ditemukan.",
            )
        job = AZBO_V2_JOBS[job_id]
        if job["status"] == "running":
            job["cancelled"] = True
            job["status"] = "cancelled"
            job["progress_message"] = "Simulasi dibatalkan oleh pengguna."
        current_status = str(job["status"])
    return {"job_id": job_id, "status": current_status}
