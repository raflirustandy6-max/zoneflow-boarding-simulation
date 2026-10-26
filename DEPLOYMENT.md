# PANDUAN DEPLOYMENT & ARSITEKTUR KESIAPAN PRODUKSI ZONEFLOW (TAHAP 6)

Dokumen ini menjelaskan rancangan arsitektur produksi, pemisahan layanan Frontend dan Backend Python, konfigurasi environment variable & CORS/HTTPS, audit state background job (`EXHAUSTIVE_JOBS` & `GA_JOBS`), estimasi biaya layanan cloud, serta prosedur verifikasi sebelum dan sesudah deployment publik.

---

## 1. Topologi Arsitektur Produksi (Decoupled Frontend & Backend)

ZoneFlow menggunakan arsitektur dua layanan terpisah (*Decoupled Fullstack*) agar aplikasi React/Vite dan mesin komputasi Python FastAPI dapat diskalakan secara independen:

```
+-------------------------------------------------------------------------+
|                        Pengguna Internet (Browser)                      |
|                   HTTPS Request (Aplikasi Web ZoneFlow)                 |
+-------------------------------------------------------------------------+
                   |                                     |
   1. Aset Statis UI (HTML/JS/CSS)       2. REST API Calls (HTTPS + CORS)
                   |                        VITE_API_BASE_URL/api/v1/*
                   v                                     v
+-----------------------------------+   +---------------------------------+
|   Layanan A: Frontend Hosting     |   |   Layanan B: Backend Python     |
| (Vercel / Netlify / Cloud Run)    |   | (Cloud Run / Render / Railway)  |
|   Build: `npm run build` (dist/)  |   |   FastAPI + Uvicorn (workers=1) |
+-----------------------------------+   +---------------------------------+
                                                         |
                                                         v
                                        +---------------------------------+
                                        |    Simulation & Optimization    |
                                        |  - Single Simulation (/simulate)|
                                        |  - Batch 10-100 (/simulate/batch|
                                        |  - Exhaustive 546 (/exhaustive) |
                                        |  - Dynamic GA (/optimize/ga)    |
                                        +---------------------------------+
```

> **Peringatan Penting Mengenai Tombol Publish Google AI Studio:**
> Tombol **Publish** bawaan di Google AI Studio secara default hanya memaketkan dan menjalankan container Node.js/Vite (`npm run build`), **tidak** secara otomatis menjalankan proses daemon `python3 backend/run_server.py` di latar belakang kecuali dideploy ke layanan container Python terpisah atau menggunakan Docker multi-service. Oleh sebab itu, untuk deployment internet publik dengan fitur Python aktif, **Layanan B (Backend Python FastAPI)** wajib di-host pada platform container Python (seperti Google Cloud Run, Render, Railway, atau Fly.io) dan dihubungkan ke Frontend melalui variabel `VITE_API_BASE_URL`.

---

## 2. Katalog Endpoint REST API Backend Python

Seluruh 11 endpoint berikut terdaftar pada `backend/app/main.py` dan diakses secara konsisten oleh `src/services/apiClient.ts`:

| No | Method & Path | Fungsi Utama | Sifat Eksekusi |
| :--- | :--- | :--- | :--- |
| 1 | `GET /api/v1/health` | Pemeriksaan kesehatan proses Python, versi engine, dan jumlah metode. | Sinkron (< 10 ms) |
| 2 | `GET /api/v1/methods` | Katalog 12 metode boarding yang didukung oleh `simulation_core.py`. | Sinkron (< 10 ms) |
| 3 | `POST /api/v1/simulate` | Simulasi 1 replikasi penerbangan (180 penumpang + timeline lorong). | Sinkron (~5–20 ms) |
| 4 | `POST /api/v1/simulate/batch` | Simulasi batch 10–100 replikasi + statistik inferensial CI 95%. | Sinkron (~0.1–1.5 dtk) |
| 5 | `GET /api/v1/optimize/exhaustive/candidates` | Katalog ruang pencarian 91 partisi zona × 6 permutasi = 546 kandidat. | Sinkron (< 15 ms) |
| 6 | `POST /api/v1/optimize/exhaustive` | Memulai background job evaluasi seluruh 546 kandidat pada 15 batch training. | Asinkron (`job_id`) |
| 7 | `GET /api/v1/optimize/exhaustive/status/{job_id}` | Polling progres (%), kandidat terbaik sementara, dan hasil akhir 546 kandidat. | Sinkron (< 10 ms) |
| 8 | `POST /api/v1/optimize/exhaustive/cancel/{job_id}` | Membatalkan job Exhaustive Search yang sedang berjalan. | Sinkron (< 10 ms) |
| 9 | `POST /api/v1/optimize/ga` | Memulai background job evolusi Genetic Algorithm (`GA-Zone-WMA`). | Asinkron (`job_id`) |
| 10 | `GET /api/v1/optimize/ga/status/{job_id}` | Polling progres generasi, kurva konvergensi, dan `exhaustive_comparison`. | Sinkron (< 10 ms) |
| 11 | `POST /api/v1/optimize/ga/cancel/{job_id}` | Membatalkan job Genetic Algorithm yang sedang berjalan. | Sinkron (< 10 ms) |

---

## 3. Konfigurasi Variabel Environment & CORS / HTTPS

### A. Variabel Environment Frontend (`.env` / Pengaturan Build Hosting)

| Variabel | Nilai Lokal (Dev) | Nilai Produksi (Publik) | Keterangan |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `/api/v1` | `https://<domain-backend-anda>/api/v1` | **Wajib diisi dengan URL HTTPS publik backend Python** saat melakukan `npm run build` untuk deployment terpisah. Jangan gunakan `localhost` atau `127.0.0.1` pada produksi. `apiClient.ts` otomatis menormalisasi *trailing slash*. |
| `VITE_BACKEND_PROXY_TARGET` | `http://127.0.0.1:8001` | *(Hanya untuk dev/preview)* | Target reverse proxy Vite ketika menjalankan `npm run dev` atau `npm run preview`. |

### B. Variabel Environment Backend Python (`backend/.env` / Cloud Service Env)

| Variabel | Default | Rekomendasi Produksi | Keterangan |
| :--- | :--- | :--- | :--- |
| `PORT` / `ZONEFLOW_BACKEND_PORT` | `8001` | Diatur otomatis oleh Cloud Run/Render (`$PORT`) | Port HTTP tempat Uvicorn mendengarkan request. |
| `ZONEFLOW_BACKEND_HOST` | `0.0.0.0` | `0.0.0.0` | Wajib `0.0.0.0` di dalam container agar dapat menerima trafik eksternal. |
| `ZONEFLOW_CORS_ORIGINS` | `*` | `https://zoneflow-anda.vercel.app` | Daftar origin frontend (pisahkan dengan koma jika lebih dari satu) yang diizinkan mengakses backend melalui CORS. |
| `ZONEFLOW_MAX_CONCURRENT_JOBS` | `2` | `2` | Batas maksimum job optimasi berat (Exhaustive/GA) yang boleh berjalan serentak per instance. Mencegah saturasi CPU (mengembalikan HTTP `429 Too Many Requests` jika penuh). |
| `ZONEFLOW_MAX_RETAINED_JOBS` | `50` | `50` | Jumlah maksimum riwayat job selesai (`completed`/`cancelled`/`failed`) yang disimpan di memori sebelum otomatis dibersihkan (*FIFO pruning*). |

---

## 4. Audit Pengelolaan Background Job (`EXHAUSTIVE_JOBS` & `GA_JOBS`)

### Cara Kerja Saat Ini
- Pekerjaan **Exhaustive Search** (~10–25 detik untuk 546 kandidat × 15 batch = 8.190 simulasi) dan **Genetic Algorithm** (~2–6 detik untuk ~121 kandidat unik × 15 batch) dijalankan pada `threading.Thread(..., daemon=True)` di latar belakang.
- State pekerjaan disimpan di memori proses Python (`EXHAUSTIVE_JOBS` dan `GA_JOBS`) dengan sinkronisasi `threading.Lock()` (`JOBS_LOCK`).
- Simulasi batch (`POST /api/v1/simulate/batch`, 10–100 replikasi) dieksekusi secara sinkron dalam satu siklus request HTTP karena waktu komputasinya hanya ~0.1–1.2 detik.

### Dampak Lingkungan Cloud & Mitigasi yang Diterapkan
1. **Multi-Worker / Multi-Instance Routing (`404 Job Not Found`):**
   - *Risiko:* Karena `EXHAUSTIVE_JOBS` dan `GA_JOBS` berada di memori proses lokal, jika Uvicorn dijalankan dengan `--workers > 1` atau layanan cloud melakukan *horizontal autoscaling* ke banyak instance tanpa *session affinity*, request polling `GET .../status/{job_id}` atau `POST .../cancel/{job_id}` dapat mendarat di worker/instance berbeda yang tidak mengenali `job_id` tersebut.
   - *Mitigasi:* `backend/run_server.py` dan `backend/Dockerfile` mengunci `workers=1`. Pada layanan cloud (seperti Cloud Run), atur `--max-instances=1` untuk skala prototipe/penelitian, atau aktifkan *Session Affinity*. Untuk skala enterprise multi-instance di masa depan, ganti dictionary in-memory dengan **Redis** (`redis-py`) atau database bersama.
2. **Scale-to-Zero & Container Restart di Tengah Optimasi:**
   - *Risiko:* Jika platform serverless menerapkan *CPU throttling* atau mematikan container segera setelah response `POST /api/v1/optimize/*` dikirim, daemon thread Python akan terhenti atau melambat drastis.
   - *Mitigasi:* Pada Google Cloud Run, gunakan flag `--no-cpu-throttling` (CPU always allocated selama instance aktif) atau gunakan instance berbasis proses kontinyu (Render Web Service / Railway / VPS).
3. **Kebocoran Memori & Banjir Request Optimasi:**
   - *Mitigasi yang Diimplementasikan:* `backend/app/main.py` kini menerapkan `_prune_job_registry_unlocked()` (membatasi riwayat maksimal `ZONEFLOW_MAX_RETAINED_JOBS=50` job selesai) dan `_count_active_optimization_jobs_unlocked()` (membatasi maksimal `ZONEFLOW_MAX_CONCURRENT_JOBS=2` job aktif secara bersamaan dengan respons HTTP `429`).

---

## 5. Peringatan Biaya & Layanan Cloud (Transparansi Sebelum Aktivasi)

> **PENTING — Jangan Mengaktifkan Layanan Berbayar Tanpa Memeriksa Kuota:**
> Aplikasi ini tidak mengaktifkan layanan cloud berbayar secara otomatis. Sebelum Anda mendeploy ke penyedia cloud, perhatikan implikasi biaya berikut:
>
> 1. **Google Cloud Run (Backend Python / Frontend):**
>    - Memerlukan akun Google Cloud dengan *Billing Account* aktif.
>    - Memiliki *Free Tier* bulanan (2 juta request, 180.000 vCPU-detik, 360.000 GiB-detik per bulan), namun penggunaan opsi `--min-instances=1` atau `--no-cpu-throttling` secara terus-menerus dapat memakan kuota vCPU-detik lebih cepat dan menimbulkan biaya jika melewati batas gratis.
>    - Untuk menghindari biaya saat tidak digunakan, gunakan `--min-instances=0` dengan `--max-instances=1`.
> 2. **Vercel / Netlify / Cloudflare Pages (Frontend Statis React/Vite):**
>    - Tersedia paket *Hobby / Free Tier* tanpa biaya untuk hosting aset statis hasil `npm run build`.
> 3. **Render / Railway / Fly.io (Alternatif Backend Python):**
>    - Render menyediakan *Free Web Service tier* (mengalami *spin-down* setelah 15 menit tidak aktif; tidak dikenakan biaya, namun cold-start membutuhkan ~30–50 detik).

---

## 6. Langkah demi Langkah Deployment Publik

### Tahap A: Deploy Backend Python (FastAPI)

#### Opsi 1 — Menggunakan Google Cloud Run (via `backend/Dockerfile`)
Jalankan perintah berikut dari terminal lokal Anda yang sudah terautentikasi `gcloud`:
```bash
gcloud run deploy zoneflow-backend \
  --source ./backend \
  --region asia-southeast2 \
  --platform managed \
  --allow-unauthenticated \
  --port 8001 \
  --cpu 1 \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 1 \
  --set-env-vars="ZONEFLOW_CORS_ORIGINS=*,ZONEFLOW_MAX_CONCURRENT_JOBS=2,ZONEFLOW_MAX_RETAINED_JOBS=50"
```
Setelah selesai, catat URL HTTPS layanan yang diberikan (misalnya: `https://zoneflow-backend-xxxx-et.a.run.app`).
Verifikasi kesehatan backend di browser atau terminal:
```bash
curl https://zoneflow-backend-xxxx-et.a.run.app/api/v1/health
```

#### Opsi 2 — Menggunakan Render / Railway
1. Hubungkan repositori project ke Render/Railway dan pilih direktori root **`backend`** (atau gunakan `backend/Dockerfile`).
2. Jika tanpa Docker, gunakan:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `python3 run_server.py`
3. Tambahkan Environment Variables:
   - `ZONEFLOW_CORS_ORIGINS` = `https://<domain-frontend-anda>` (atau `*` saat pengujian awal)
   - `ZONEFLOW_MAX_CONCURRENT_JOBS` = `2`

---

### Tahap B: Deploy Frontend React/Vite

1. Siapkan variabel environment pada platform hosting frontend (Vercel / Netlify / Cloudflare Pages) atau saat proses build:
   ```bash
   VITE_API_BASE_URL="https://zoneflow-backend-xxxx-et.a.run.app/api/v1"
   ```
2. Konfigurasi Build:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Node.js Version:** `20.x`
3. Setelah Frontend online (misalnya di `https://zoneflow.vercel.app`), perbarui variabel `ZONEFLOW_CORS_ORIGINS` pada Backend Python menjadi `https://zoneflow.vercel.app` untuk mengunci keamanan CORS.

---

### Tahap C: Deployment Satu Server dengan Docker Compose (VPS / VM)

Jika Anda mendeploy pada satu VM (misalnya Compute Engine, DigitalOcean Droplet, atau server kampus), cukup jalankan:
```bash
docker compose up --build -d
```
- Backend Python aktif di port `8001`.
- Frontend Vite Preview aktif di port `3000` dengan reverse proxy `/api` otomatis diarahkan ke container `zoneflow-backend:8001`.

---

## 7. Pemeriksaan Kesehatan Layanan, Timeout, dan Verifikasi Kualitas

### Mekanisme Pemantauan & Degradasi Anggun (Graceful Fallback)
- **Health Check Otomatis:** `checkBackendHealth(timeoutMs=2500)` memeriksa `/api/v1/health` saat aplikasi dibuka.
- **Proteksi Timeout Request:**
  - Simulasi tunggal (`/api/v1/simulate`): timeout `10.000 ms` (10 detik).
  - Simulasi batch (`/api/v1/simulate/batch`): timeout `30.000 ms` (30 detik).
  - Start & Polling Optimasi Exhaustive/GA (`/api/v1/optimize/*`): timeout `15.000 ms` (15 detik) per request HTTP.
- **Fallback Transparan:** Jika backend Python offline atau tidak terjangkau, UI menampilkan status secara jujur (*"Backend Python Tidak Terhubung"*) tanpa memalsukan status online, dan menyediakan mode demo TypeScript lokal untuk simulasi kabin serta tetap menampilkan seluruh data benchmark historis 100 replikasi secara utuh.

### Perintah Pengujian Lengkap Sebelum Rilis
```bash
# 1. Jalankan seluruh unit test & differential test Python
python3 -m unittest discover backend/tests -v

# 2. Jalankan unit test TypeScript
npx tsx src/simulation/engine.test.ts

# 3. Validasi tipe TypeScript & Build Produksi Vite
npm run lint
npm run build
```
