# ZoneFlow Python Backend

Layanan backend REST API mandiri untuk menjalankan simulasi pergerakan penumpang kabin pesawat, evaluasi Exhaustive Search (546 kandidat), dan optimasi Genetic Algorithm (`GA-Zone-WMA`) berbasis Python.

## Struktur Direktori Backend

```text
backend/
├── .env.example          # Template variabel environment backend
├── Dockerfile            # Production Dockerfile untuk Cloud Run / Render / Railway / Docker Compose
├── README.md             # Dokumentasi backend Python
├── requirements.txt      # Dependensi Python (fastapi, uvicorn, pydantic)
├── run_server.py         # Entrypoint server Uvicorn (port default 8001, workers=1)
├── app/
│   ├── __init__.py       # Versi paket backend
│   ├── config.py         # Konstanta fisik kabin, Weibull, dan parameter GA penelitian
│   ├── main.py           # Aplikasi FastAPI, CORS middleware, dan 11 endpoint REST API
│   ├── schemas.py        # Skema validasi request/response Pydantic v2
│   └── simulation_core.py# Mesin simulasi fisik, batch, Exhaustive Search 546, dan GA
└── tests/
    ├── test_model_equivalence.py # 10 pengujian diferensial kesetaraan model
    └── test_simulation.py        # 30 pengujian unit simulasi, statistik, Exhaustive, GA, & job guard
```

## Cara Menjalankan Backend Secara Lokal

1. **Instalasi dependensi:**
   ```bash
   pip install -r backend/requirements.txt
   ```

2. **Jalankan Server (Port 8001):**
   ```bash
   python3 backend/run_server.py
   ```
   Server berjalan pada `http://0.0.0.0:8001` (di-proxy oleh Vite dari port `3000` melalui path `/api`).

## Cara Build & Menjalankan via Docker

```bash
# Build image backend dari root project
docker build -t zoneflow-backend ./backend

# Jalankan container backend pada port 8001
docker run --rm -p 8001:8001 zoneflow-backend
```

## Menjalankan Unit Test & Pengujian Kesetaraan Model (40 Pengujian)

```bash
python3 -m unittest discover backend/tests -v
```
