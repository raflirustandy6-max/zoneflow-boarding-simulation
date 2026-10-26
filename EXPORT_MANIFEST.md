# ZoneFlow — Export & Deployment File Manifest (`EXPORT_MANIFEST.md`)

Dokumen ini mencatat daftar file deployment wajib pada proyek aktif **ZoneFlow (Tahap 6)** beserta ukuran, hash SHA-256, dan prosedur pemulihan apabila mekanisme ekspor ZIP menyaring file tanpa ekstensi (`Dockerfile`).

---

## 1. Status File Deployment Wajib di Proyek Aktif

Seluruh file berikut telah diverifikasi berada di dalam workspace aktif:

| File Path | Peran Deployment | Status di Proyek Aktif | Ukuran (Bytes) | SHA-256 Prefix (16 char) | Catatan Ekspor ZIP |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `backend/Dockerfile` | Dockerfile utama untuk image backend Python FastAPI | **ADA (AKTIF)** | `1,194` | `98c6c0ca52670d71` | File tanpa ekstensi kadang dilewati oleh pengemas ZIP browser |
| `backend/Dockerfile.export.txt` | Salinan identik byte-for-byte dari `backend/Dockerfile` | **ADA (AKTIF)** | `1,194` | `98c6c0ca52670d71` | Berekstensi `.txt` agar pasti disertakan oleh pengekspor ZIP |
| `docker-compose.yml` | Orkestrasi kontainer `zoneflow-backend` (merujuk ke `backend/Dockerfile`) | **ADA (AKTIF)** | `840` | `38bbc0dbcbcb2102` | Berekstensi `.yml` (disertakan dalam ZIP) |
| `.env.example` | Template variabel environment frontend (`VITE_API_BASE_URL`, `VITE_BACKEND_PROXY_TARGET`) | **ADA (AKTIF)** | `1,899` | `de47cdae12d001dc` | Dotfile konfigurasi root |
| `backend/.env.example` | Template variabel environment backend (`ZONEFLOW_BACKEND_PORT`, `ZONEFLOW_CORS_ORIGINS`, dll.) | **ADA (AKTIF)** | `824` | `e15280d51be9b69b` | Dotfile konfigurasi backend |
| `DEPLOYMENT.md` | Dokumentasi lengkap arsitektur, build, CORS, dan deployment produksi | **ADA (AKTIF)** | `13,598` | `008ee6e573399f2b` | Berekstensi `.md` (disertakan dalam ZIP) |
| `backend/requirements.txt` | Daftar dependensi Python (`fastapi`, `uvicorn`, `pydantic`, `numpy`) | **ADA (AKTIF)** | `65` | `c8cd9654fa492363` | Berekstensi `.txt` (disertakan dalam ZIP) |
| `backend/run_server.py` | Entrypoint server Uvicorn single-worker (`workers=1`) | **ADA (AKTIF)** | `775` | `40f01d0e8f48c09c` | Berekstensi `.py` (disertakan dalam ZIP) |

---

## 2. Mengapa `backend/Dockerfile.export.txt` Disediakan?

Fitur **Download ZIP** pada antarmuka web tertentu menerapkan filter berbasis ekstensi file dan dapat mengabaikan file yang tidak memiliki ekstensi titik (seperti `Dockerfile`).

Untuk menjamin Anda tetap mendapatkan file `Dockerfile` yang utuh dan identik di dalam arsip ZIP:
1. `backend/Dockerfile` tetap dipertahankan pada path aslinya agar `docker-compose.yml` langsung berfungsi di proyek aktif maupun repositori Git.
2. `backend/Dockerfile.export.txt` dibuat dengan isi **100% identik** (`sha256: 98c6c0ca52670d71...`).

---

## 3. Instruksi Setelah Mengekstrak Arsip ZIP

Setelah Anda mengunduh dan mengekstrak file ZIP proyek ZoneFlow di komputer lokal atau server produksi:

1. Periksa apakah `backend/Dockerfile` sudah ada:
   ```bash
   ls -la backend/
   ```
2. **Jika `backend/Dockerfile` tidak ikut terekspor di dalam ZIP**, salin dari `backend/Dockerfile.export.txt`:
   ```bash
   cp backend/Dockerfile.export.txt backend/Dockerfile
   ```
   *(Di Windows PowerShell: `Copy-Item backend\Dockerfile.export.txt backend\Dockerfile`)*
3. Verifikasi konfigurasi Docker Compose dan jalankan build:
   ```bash
   docker compose config
   docker compose up --build -d
   ```
