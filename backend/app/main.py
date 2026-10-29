"""
ZoneFlow FastAPI Application Entrypoint.
Menyediakan REST API endpoint /api/v1/health, /api/v1/methods, dan /api/v1/simulate.
"""

import os
import sys
import time
import uuid
import threading
import math
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import __version__
from .config import K_ZONES
from .schemas import (
    SimulateRequest, SimulateResponse, HealthResponse,
    MethodsResponse, MethodItemModel, SimulationMetricsModel,
    PassengerTimelineModel, AisleTransitSegmentModel,
    BatchSimulateRequest, BatchSimulateResponse, BatchStatisticsModel,
    ReplicationRecordModel,
    ExhaustiveStartRequest, ExhaustiveJobStatusResponse,
    ExhaustiveCandidatesResponse, CandidateConfigModel,
    TrainingConfigModel, StoredReferenceModel,
    GAStartRequest, GAJobStatusResponse, GAParametersModel,
    GAGenerationRecordModel, ExhaustiveComparisonModel,
)
from .simulation_core import (
    generate_passengers, build_passenger_order,
    validate_order, simulate_boarding, SUPPORTED_METHODS,
    run_batch_simulation,
    generate_exhaustive_candidates, run_exhaustive_search,
    run_genetic_algorithm,
    VALID_ZONE_SIZES
)
from .azbo_v2_routes import azbo_v2_router

app = FastAPI(
    title="ZoneFlow Simulation Backend API",
    description="Backend REST API untuk simulasi pergerakan penumpang kabin pesawat berbasis Python.",
    version=__version__,
)


def _parse_cors_origins() -> List[str]:
    raw = os.environ.get("ZONEFLOW_CORS_ORIGINS", os.environ.get("ALLOWED_ORIGINS", "*")).strip()
    if not raw or raw == "*":
        return ["*"]
    return [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]


CORS_ALLOWED_ORIGINS = _parse_cors_origins()
CORS_ALLOW_CREDENTIALS = False if CORS_ALLOWED_ORIGINS == ["*"] else True

# CORS Middleware untuk komunikasi lintas domain (HTTPS Frontend -> Python Backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=CORS_ALLOW_CREDENTIALS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/api/v1/health", response_model=HealthResponse)
def get_health():
    """
    Endpoint pemeriksaan status backend Python.
    Hanya mengembalikan status 'online' jika proses Python benar-benar aktif.
    """
    return HealthResponse(
        status="online",
        engine="Python Backend Engine (FastAPI / Core v3)",
        version=__version__,
        python_version=sys.version.split()[0],
        supported_methods_count=len(SUPPORTED_METHODS)
    )


@app.get("/api/v1/methods", response_model=MethodsResponse)
def get_methods():
    """
    Mengembalikan katalog metode boarding yang didukung oleh engine Python asli.
    """
    return MethodsResponse(
        status="success",
        count=len(SUPPORTED_METHODS),
        methods=[MethodItemModel(**m) for m in SUPPORTED_METHODS]
    )


@app.post("/api/v1/simulate", response_model=SimulateResponse)
def run_simulation(req: SimulateRequest):
    """
    Menjalankan 1 replikasi simulasi boarding pesawat menggunakan fungsi Python asli.
    Mengembalikan metrik boarding total dan timeline 180 penumpang beserta riwayat lorong.
    """
    start_wall_time = time.perf_counter()

    # Validasi nama metode
    valid_names = {m["name"] for m in SUPPORTED_METHODS}
    if req.method not in valid_names:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Metode '{req.method}' tidak dikenal. Metode yang didukung: {sorted(list(valid_names))}"
        )

    params = req.parameters
    walk_per_row = params.walk_per_row_s if params else 2.4
    sit_time = params.sit_time_s if params else 2.0
    weibull_scale = params.weibull_scale_s if params else 16.0
    weibull_shape = params.weibull_shape if params else 1.7
    entry_gap = params.entry_gap_s if params else 1.0
    aisle_headway = params.aisle_headway_s if params else 1.0
    moves_one = params.moves_one_blocker if params else 5
    moves_two = params.moves_two_blockers if params else 9

    try:
        # 1. Pembangkitan penumpang sintetis (distribusi Weibull & sampling acak berbasis seed)
        passengers = generate_passengers(
            seed=req.seed,
            baggage_ratio=req.baggage_ratio,
            load_factor=req.load_factor,
            walk_per_row_s=walk_per_row,
            sit_time_s=sit_time,
            weibull_scale_s=weibull_scale,
            weibull_shape=weibull_shape
        )

        # 2. Penentuan urutan boarding
        custom_bounds = tuple(req.custom_zone_config.boundaries) if req.custom_zone_config else None
        custom_order = tuple(req.custom_zone_config.zone_order) if req.custom_zone_config else None

        ordered = build_passenger_order(
            method_name=req.method,
            passengers=passengers,
            seed=req.seed,
            custom_zone_boundaries=custom_bounds,
            custom_zone_order=custom_order
        )

        # 3. Validasi urutan (memastikan 180 kursi unik terpanggil tepat 1 kali)
        validate_order(ordered, passengers)

        # 4. Eksekusi simulasi antrean lorong & interferensi
        metrics, detail_rows = simulate_boarding(
            ordered_passengers=ordered,
            entry_gap_s=entry_gap,
            aisle_headway_s=aisle_headway,
            moves_one_blocker=moves_one,
            moves_two_blockers=moves_two
        )

        elapsed_ms = (time.perf_counter() - start_wall_time) * 1000.0

        # 5. Format serialisasi respons API
        timeline_models = [
            PassengerTimelineModel(
                queue_position=d["queue_position"],
                seat_id=d["seat_id"],
                row=d["row"],
                seat=d["seat"],
                has_bag=d["has_bag"],
                entry_time_s=d["entry_time_s"],
                arrival_target_s=d["arrival_target_s"],
                aisle_wait_s=d["aisle_wait_s"],
                occupied_blockers=d["occupied_blockers"],
                seat_interference_s=d["seat_interference_s"],
                bag_stowage_s=d["bag_stowage_s"],
                finish_time_s=d["finish_time_s"],
                aisle_transit=[AisleTransitSegmentModel(**seg) for seg in d["aisle_transit"]]
            )
            for d in detail_rows
        ]

        metrics_model = SimulationMetricsModel(**metrics)

        return SimulateResponse(
            status="success",
            engine="Python Backend Engine (FastAPI / Core v3)",
            method=req.method,
            baggage_ratio=req.baggage_ratio,
            baggage_percent=int(round(req.baggage_ratio * 100)),
            seed=req.seed,
            execution_time_ms=round(elapsed_ms, 2),
            metrics=metrics_model,
            timeline_details=timeline_models
        )

    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Terjadi kesalahan internal saat simulasi: {str(exc)}"
        )


@app.post("/api/v1/simulate/batch", response_model=BatchSimulateResponse)
def run_batch_simulations(req: BatchSimulateRequest):
    """
    Menjalankan simulasi batch sejumlah 10–100 replikasi menggunakan engine Python asli.
    Setiap replikasi menggunakan seed deterministik derived: base_seed + (r - 1).
    Mengembalikan data individual tiap replikasi dan ringkasan statistik inferensial (CI 95%).
    """
    start_wall_time = time.perf_counter()

    # Validasi nama metode
    valid_names = {m["name"] for m in SUPPORTED_METHODS}
    if req.method not in valid_names:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Metode '{req.method}' tidak dikenal. Metode yang didukung: {sorted(list(valid_names))}"
        )

    # Validasi rentang replikasi
    if not (10 <= req.replications <= 100):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Jumlah replikasi harus berada dalam rentang 10 hingga 100 (diterima: {req.replications})."
        )

    params = req.parameters
    walk_per_row = params.walk_per_row_s if params else 2.4
    sit_time = params.sit_time_s if params else 2.0
    weibull_scale = params.weibull_scale_s if params else 16.0
    weibull_shape = params.weibull_shape if params else 1.7
    entry_gap = params.entry_gap_s if params else 1.0
    aisle_headway = params.aisle_headway_s if params else 1.0
    moves_one = params.moves_one_blocker if params else 5
    moves_two = params.moves_two_blockers if params else 9

    custom_bounds = tuple(req.custom_zone_config.boundaries) if req.custom_zone_config else None
    custom_order = tuple(req.custom_zone_config.zone_order) if req.custom_zone_config else None

    try:
        batch_result = run_batch_simulation(
            method_name=req.method,
            baggage_ratio=req.baggage_ratio,
            replications=req.replications,
            base_seed=req.base_seed,
            load_factor=req.load_factor,
            custom_zone_boundaries=custom_bounds,
            custom_zone_order=custom_order,
            walk_per_row_s=walk_per_row,
            sit_time_s=sit_time,
            weibull_scale_s=weibull_scale,
            weibull_shape=weibull_shape,
            entry_gap_s=entry_gap,
            aisle_headway_s=aisle_headway,
            moves_one_blocker=moves_one,
            moves_two_blockers=moves_two
        )

        elapsed_ms = (time.perf_counter() - start_wall_time) * 1000.0

        return BatchSimulateResponse(
            status="success",
            engine="Python Backend Engine (FastAPI / Core v3 Batch Simulator)",
            method=req.method,
            baggage_ratio=req.baggage_ratio,
            baggage_percent=int(round(req.baggage_ratio * 100)),
            base_seed=req.base_seed,
            requested_replications=batch_result["requested_replications"],
            successful_replications=batch_result["successful_replications"],
            failed_replications=batch_result["failed_replications"],
            execution_time_ms=round(elapsed_ms, 2),
            statistics=BatchStatisticsModel(**batch_result["statistics"]),
            replications_data=[ReplicationRecordModel(**rec) for rec in batch_result["replications_data"]]
        )
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Terjadi kesalahan internal saat simulasi batch: {str(exc)}"
        )


# ==============================================================================
# ENDPOINT OPTIMASI DINAMIS: EXHAUSTIVE-ZONE-WMA (TAHAP 5B-1)
# Mengevaluasi 546 kandidat partisi dan urutan zona secara nyata di Python
# ==============================================================================

EXHAUSTIVE_JOBS: Dict[str, Dict[str, Any]] = {}
GA_JOBS: Dict[str, Dict[str, Any]] = {}
JOBS_LOCK = threading.Lock()

MAX_CONCURRENT_JOBS = int(os.environ.get("ZONEFLOW_MAX_CONCURRENT_JOBS", "2"))
MAX_RETAINED_JOBS = int(os.environ.get("ZONEFLOW_MAX_RETAINED_JOBS", "50"))


def _count_active_optimization_jobs_unlocked() -> int:
    """Menghitung total job Exhaustive Search dan GA yang sedang berstatus 'running' (panggil di dalam JOBS_LOCK)."""
    active_ex = sum(1 for j in EXHAUSTIVE_JOBS.values() if j.get("status") == "running")
    active_ga = sum(1 for j in GA_JOBS.values() if j.get("status") == "running")
    return active_ex + active_ga


def _prune_job_registry_unlocked(registry: Dict[str, Dict[str, Any]], max_retained: int = MAX_RETAINED_JOBS) -> None:
    """
    Membersihkan job yang sudah selesai ('completed', 'cancelled', 'failed') paling lama
    apabila jumlah entri melebihi batas retensi memori (panggil di dalam JOBS_LOCK).
    Tidak pernah menghapus job yang sedang 'running'.
    """
    if len(registry) <= max_retained:
        return
    finished_jobs = [
        (jid, rec.get("start_time", 0.0))
        for jid, rec in registry.items()
        if rec.get("status") in ("completed", "cancelled", "failed")
    ]
    finished_jobs.sort(key=lambda item: item[1])
    excess = len(registry) - max_retained
    for jid, _ in finished_jobs[:excess]:
        registry.pop(jid, None)


@app.get("/api/v1/optimize/exhaustive/candidates", response_model=ExhaustiveCandidatesResponse)
def get_exhaustive_candidates():
    """
    Mengembalikan katalog kandidat ruang pencarian valid:
    91 partisi ukuran zona x 6 permutasi urutan pemanggilan = 546 kandidat valid.
    """
    candidates = generate_exhaustive_candidates()
    return ExhaustiveCandidatesResponse(
        total_candidates=len(candidates),
        total_partitions=len(VALID_ZONE_SIZES),
        total_permutations=math.factorial(K_ZONES),
        sample_candidates=candidates[:10]
    )


@app.post("/api/v1/optimize/exhaustive", response_model=ExhaustiveJobStatusResponse)
def start_exhaustive_optimization(
    req: ExhaustiveStartRequest = Body(default_factory=ExhaustiveStartRequest)
):
    """
    Memulai pekerjaan evaluasi Exhaustive Search nyata untuk seluruh 546 kandidat pada thread latar belakang.
    Mengembalikan job_id agar frontend dapat memantau progres secara interaktif tanpa freeze / HTTP timeout.
    """
    job_id = str(uuid.uuid4())
    job_record: Dict[str, Any] = {
        "job_id": job_id,
        "status": "running",
        "progress_percent": 0.0,
        "evaluated_candidates": 0,
        "total_candidates": 546,
        "elapsed_time_seconds": 0.0,
        "best_candidate": None,
        "matches_stored_optimum": None,
        "stored_reference": None,
        "training_config": None,
        "execution_time_seconds": None,
        "top_candidates": None,
        "error_message": None,
        "cancelled": False,
        "start_time": time.time(),
    }
    with JOBS_LOCK:
        active_count = _count_active_optimization_jobs_unlocked()
        if active_count >= MAX_CONCURRENT_JOBS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Batas konkurensi optimasi tercapai ({active_count}/{MAX_CONCURRENT_JOBS} job sedang berjalan). "
                    "Tunggu pekerjaan aktif selesai atau batalkan sebelum memulai optimasi baru."
                ),
            )
        _prune_job_registry_unlocked(EXHAUSTIVE_JOBS, MAX_RETAINED_JOBS - 1)
        EXHAUSTIVE_JOBS[job_id] = job_record

    def run_worker():
        try:
            def progress_cb(evaluated: int, total: int, best_so_far: Any, elapsed_s: float):
                with JOBS_LOCK:
                    job_record["evaluated_candidates"] = evaluated
                    job_record["total_candidates"] = total
                    job_record["progress_percent"] = round((evaluated / total) * 100.0, 1)
                    job_record["elapsed_time_seconds"] = round(elapsed_s, 2)
                    if best_so_far:
                        job_record["best_candidate"] = CandidateConfigModel(**best_so_far)

            def cancel_check() -> bool:
                with JOBS_LOCK:
                    return bool(job_record["cancelled"])

            result = run_exhaustive_search(
                progress_callback=progress_cb,
                cancel_check=cancel_check,
                base_seed=req.base_seed,
            )

            with JOBS_LOCK:
                if result["status"] == "cancelled":
                    job_record["status"] = "cancelled"
                    job_record["execution_time_seconds"] = result["execution_time_seconds"]
                else:
                    job_record["status"] = "completed"
                    job_record["progress_percent"] = 100.0
                    job_record["evaluated_candidates"] = result["total_candidates_evaluated"]
                    job_record["best_candidate"] = CandidateConfigModel(**result["best_candidate"])
                    job_record["matches_stored_optimum"] = result["matches_stored_optimum"]
                    job_record["stored_reference"] = StoredReferenceModel(**result["stored_reference"])
                    job_record["training_config"] = TrainingConfigModel(**result["training_config"])
                    job_record["execution_time_seconds"] = result["execution_time_seconds"]
                    job_record["top_candidates"] = [CandidateConfigModel(**c) for c in result["top_candidates"]]
        except Exception as e:
            with JOBS_LOCK:
                job_record["status"] = "failed"
                job_record["error_message"] = str(e)

    worker_thread = threading.Thread(target=run_worker, daemon=True)
    worker_thread.start()

    with JOBS_LOCK:
        snapshot = {k: v for k, v in job_record.items() if k not in ("start_time", "cancelled")}
    return ExhaustiveJobStatusResponse(**snapshot)


@app.get("/api/v1/optimize/exhaustive/status/{job_id}", response_model=ExhaustiveJobStatusResponse)
def get_exhaustive_job_status(job_id: str):
    """
    Mengambil status terkini, kemajuan persentase, kandidat terbaik sementara,
    atau hasil lengkap setelah pencarian 546 kandidat selesai.
    """
    with JOBS_LOCK:
        if job_id not in EXHAUSTIVE_JOBS:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pekerjaan optimasi dengan ID '{job_id}' tidak ditemukan."
            )
        job = EXHAUSTIVE_JOBS[job_id]
        if job["status"] == "running":
            job["elapsed_time_seconds"] = round(time.time() - job["start_time"], 2)
        snapshot = {k: v for k, v in job.items() if k not in ("start_time", "cancelled")}

    return ExhaustiveJobStatusResponse(**snapshot)


@app.post("/api/v1/optimize/exhaustive/cancel/{job_id}")
def cancel_exhaustive_job(job_id: str):
    """Membatalkan pekerjaan exhaustive search yang sedang berjalan."""
    with JOBS_LOCK:
        if job_id not in EXHAUSTIVE_JOBS:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pekerjaan optimasi dengan ID '{job_id}' tidak ditemukan."
            )
        job = EXHAUSTIVE_JOBS[job_id]
        if job["status"] == "running":
            job["cancelled"] = True
            return {"status": "cancelled", "message": f"Permintaan pembatalan job '{job_id}' berhasil dikirim."}
        current_status = job["status"]

    return {"status": current_status, "message": f"Job '{job_id}' berstatus {current_status}."}


# ==============================================================================
# ENDPOINT OPTIMASI DINAMIS: GENETIC ALGORITHM (GA-ZONE-WMA) (TAHAP 5B-2)
# Menjalankan evolusi populasi & generasi GA secara nyata pada Python Backend
# ==============================================================================

@app.post("/api/v1/optimize/ga", response_model=GAJobStatusResponse)
def start_ga_optimization(
    req: GAStartRequest = Body(default_factory=GAStartRequest)
):
    """
    Memulai pekerjaan optimasi Genetic Algorithm (GA-Zone-WMA) secara nyata pada thread latar belakang.
    Menggunakan parameter default penelitian (populasi 24, generasi 20, elitisme 2, mutasi 0.30, turnamen 3, seed 20262020)
    atau kustomisasi tervalidasi dari pengguna.
    """
    if req.elite_count >= req.population_size:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"elite_count ({req.elite_count}) harus lebih kecil dari population_size ({req.population_size})."
        )
    if req.tournament_size > req.population_size:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"tournament_size ({req.tournament_size}) tidak boleh melebihi population_size ({req.population_size})."
        )

    job_id = str(uuid.uuid4())
    job_record: Dict[str, Any] = {
        "job_id": job_id,
        "status": "running",
        "progress_percent": 0.0,
        "current_generation": 0,
        "total_generations": req.generations,
        "unique_candidates_evaluated": 0,
        "total_chromosome_evaluations": (req.generations + 1) * req.population_size,
        "search_space_size": 546,
        "evaluation_reduction_percent": None,
        "elapsed_time_seconds": 0.0,
        "best_candidate": None,
        "matches_exhaustive_optimum": None,
        "ga_parameters": GAParametersModel(
            population_size=req.population_size,
            generations=req.generations,
            elite_count=req.elite_count,
            mutation_rate=req.mutation_rate,
            tournament_size=req.tournament_size,
            ga_seed=req.ga_seed,
            training_base_seed=req.base_seed,
        ),
        "exhaustive_comparison": None,
        "training_config": None,
        "generation_history": [],
        "top_candidates": None,
        "execution_time_seconds": None,
        "error_message": None,
        "cancelled": False,
        "start_time": time.time(),
    }
    with JOBS_LOCK:
        active_count = _count_active_optimization_jobs_unlocked()
        if active_count >= MAX_CONCURRENT_JOBS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Batas konkurensi optimasi tercapai ({active_count}/{MAX_CONCURRENT_JOBS} job sedang berjalan). "
                    "Tunggu pekerjaan aktif selesai atau batalkan sebelum memulai optimasi baru."
                ),
            )
        _prune_job_registry_unlocked(GA_JOBS, MAX_RETAINED_JOBS - 1)
        GA_JOBS[job_id] = job_record

    def run_ga_worker():
        try:
            def progress_cb(
                current_gen: int,
                total_gens: int,
                unique_evaluated: int,
                best_so_far: Any,
                history: Any,
                elapsed_s: float
            ):
                with JOBS_LOCK:
                    job_record["current_generation"] = current_gen
                    job_record["total_generations"] = total_gens
                    job_record["unique_candidates_evaluated"] = unique_evaluated
                    job_record["progress_percent"] = round(((current_gen + 1) / (total_gens + 1)) * 100.0, 1)
                    job_record["elapsed_time_seconds"] = round(elapsed_s, 2)
                    if best_so_far:
                        job_record["best_candidate"] = CandidateConfigModel(**best_so_far)
                    if history is not None:
                        job_record["generation_history"] = [GAGenerationRecordModel(**h) for h in history]

            def cancel_check() -> bool:
                with JOBS_LOCK:
                    return bool(job_record["cancelled"])

            verified_opt = None
            with JOBS_LOCK:
                for ex_job in EXHAUSTIVE_JOBS.values():
                    tc = ex_job.get("training_config")
                    bc = ex_job.get("best_candidate")
                    ex_base_seed = tc.base_seed if hasattr(tc, "base_seed") else (tc.get("base_seed") if isinstance(tc, dict) else None)
                    if ex_job.get("status") == "completed" and ex_base_seed == req.base_seed and bc is not None:
                        verified_opt = bc.model_dump() if hasattr(bc, "model_dump") else (bc.dict() if hasattr(bc, "dict") else dict(bc))
                        break

            result = run_genetic_algorithm(
                population_size=req.population_size,
                generations=req.generations,
                elite_count=req.elite_count,
                mutation_rate=req.mutation_rate,
                tournament_size=req.tournament_size,
                seed=req.ga_seed,
                base_seed=req.base_seed,
                verified_exhaustive_optimum=verified_opt,
                progress_callback=progress_cb,
                cancel_check=cancel_check,
            )

            with JOBS_LOCK:
                if result["status"] == "cancelled":
                    job_record["status"] = "cancelled"
                    job_record["execution_time_seconds"] = result["execution_time_seconds"]
                else:
                    job_record["status"] = "completed"
                    job_record["progress_percent"] = 100.0
                    job_record["current_generation"] = req.generations
                    job_record["unique_candidates_evaluated"] = result["unique_candidates_evaluated"]
                    job_record["total_chromosome_evaluations"] = result["total_chromosome_evaluations"]
                    job_record["evaluation_reduction_percent"] = result["evaluation_reduction_percent"]
                    job_record["best_candidate"] = CandidateConfigModel(**result["best_candidate"])
                    job_record["matches_exhaustive_optimum"] = result["matches_exhaustive_optimum"]
                    job_record["ga_parameters"] = GAParametersModel(**result["ga_parameters"])
                    job_record["exhaustive_comparison"] = ExhaustiveComparisonModel(**result["exhaustive_comparison"])
                    job_record["training_config"] = TrainingConfigModel(**result["training_config"])
                    job_record["generation_history"] = [
                        GAGenerationRecordModel(**h) for h in result["generation_history"]
                    ]
                    job_record["top_candidates"] = [
                        CandidateConfigModel(**c) for c in result["top_candidates"]
                    ]
                    job_record["execution_time_seconds"] = result["execution_time_seconds"]
        except Exception as e:
            with JOBS_LOCK:
                job_record["status"] = "failed"
                job_record["error_message"] = str(e)

    worker_thread = threading.Thread(target=run_ga_worker, daemon=True)
    worker_thread.start()

    with JOBS_LOCK:
        snapshot = {k: v for k, v in job_record.items() if k not in ("start_time", "cancelled")}
    return GAJobStatusResponse(**snapshot)


@app.get("/api/v1/optimize/ga/status/{job_id}", response_model=GAJobStatusResponse)
def get_ga_job_status(job_id: str):
    """
    Mengambil status terkini, generasi aktif, riwayat evolusi fitness per generasi,
    dan hasil perbandingan dengan optimum Exhaustive Search.
    """
    with JOBS_LOCK:
        if job_id not in GA_JOBS:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pekerjaan optimasi GA dengan ID '{job_id}' tidak ditemukan."
            )
        job = GA_JOBS[job_id]
        if job["status"] == "running":
            job["elapsed_time_seconds"] = round(time.time() - job["start_time"], 2)
        snapshot = {k: v for k, v in job.items() if k not in ("start_time", "cancelled")}

    return GAJobStatusResponse(**snapshot)


@app.post("/api/v1/optimize/ga/cancel/{job_id}")
def cancel_ga_job(job_id: str):
    """Membatalkan pekerjaan optimasi GA yang sedang berjalan."""
    with JOBS_LOCK:
        if job_id not in GA_JOBS:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pekerjaan optimasi GA dengan ID '{job_id}' tidak ditemukan."
            )
        job = GA_JOBS[job_id]
        if job["status"] == "running":
            job["cancelled"] = True
            return {"status": "cancelled", "message": f"Permintaan pembatalan job GA '{job_id}' berhasil dikirim."}
        current_status = job["status"]

    return {"status": current_status, "message": f"Job GA '{job_id}' berstatus {current_status}."}


# ==============================================================================
# ENDPOINT UTAMA AZBO V2 (BLUEPRINT AZBO BAGIAN 9.1 & 9.2)
# Diintegrasikan melalui router tunggal `azbo_v2_router` (`azbo_v2_routes.py`)
# yang memanggil `run_azbo_v2_evaluation` pada `azbo_core.py`.
# ==============================================================================
app.include_router(azbo_v2_router)



