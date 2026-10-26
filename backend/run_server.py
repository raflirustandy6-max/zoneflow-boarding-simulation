#!/usr/bin/env python3
"""
ZoneFlow Backend Server Runner.
Menjalankan Uvicorn server untuk FastAPI backend pada port 8000.
"""

import sys
import os

# Tambahkan direktori root backend ke sys.path
backend_root = os.path.dirname(os.path.abspath(__file__))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

import uvicorn

if __name__ == "__main__":
    # Gunakan ZONEFLOW_BACKEND_PORT (default 8001) agar tidak bentrok dengan PORT=8080 internal container.
    # Pada container produksi (backend/Dockerfile), ZONEFLOW_BACKEND_PORT otomatis membaca ${PORT:-8001}.
    port = int(os.environ.get("ZONEFLOW_BACKEND_PORT", 8001))
    host = os.environ.get("ZONEFLOW_BACKEND_HOST", "0.0.0.0")
    print(f"Memulai ZoneFlow Python Backend pada http://{host}:{port} (workers=1, in-memory job registry)")
    # PENTING: workers=1 wajib dipertahankan selama EXHAUSTIVE_JOBS & GA_JOBS disimpan di memori proses
    uvicorn.run("app.main:app", host=host, port=port, log_level="info", reload=False, workers=1)


