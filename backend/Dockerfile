# ==============================================================================
# ZoneFlow Python Backend — Production Dockerfile (FastAPI / Uvicorn)
# Lokasi: /backend/Dockerfile
# Sesuai dengan backend/requirements.txt, backend/run_server.py, dan paket app.*
# ==============================================================================
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH="/app/backend" \
    ZONEFLOW_BACKEND_HOST="0.0.0.0" \
    ZONEFLOW_BACKEND_PORT="8001" \
    ZONEFLOW_CORS_ORIGINS="*" \
    ZONEFLOW_MAX_CONCURRENT_JOBS="2" \
    ZONEFLOW_MAX_RETAINED_JOBS="50"

WORKDIR /app/backend

# Instal dependensi Python dari backend/requirements.txt
COPY requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Salin seluruh kode backend (run_server.py, app/, tests/)
COPY . /app/backend

EXPOSE 8001

# PENTING: Gunakan workers=1 (diatur di run_server.py) karena EXHAUSTIVE_JOBS dan GA_JOBS
# disimpan di memori proses. Mendukung $PORT dinamis (Cloud Run/Render/Railway) atau default 8001.
CMD ["sh", "-c", "ZONEFLOW_BACKEND_PORT=${PORT:-8001} python3 run_server.py"]
