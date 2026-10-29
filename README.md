# ZoneFlow — Aircraft Boarding Simulation & Optimization (AZBO V2)

Prototipe ilmiah **ZoneFlow** untuk kompetisi esai ilmiah **LOGIKA UI 2026 (Subtema Teknologi Komputasi)**. Mengimplementasikan kerangka **AZBO (*Aircraft Zone-Based Boarding Optimization*)** berbasis simulasi sel lorong fisik (*discrete-time cellular aisle simulation*) dan *Genetic Algorithm* (GA) dengan jumlah zona variabel $K \in \{1, \dots, N\}$ serta evaluasi 2-tahap menggunakan *Common Random Numbers* (CRN).

---

## Fitur Utama Prototipe Final (AZBO V2)

1. **Halaman 1 — Konfigurasi Penerbangan**:
   - Katalog 4 tipe pesawat lorong tunggal terverifikasi (*Boeing 737-800 / Airbus A320-200* 180 kursi, *ATR 72-600* 72 kursi, *Airbus A220-100* 125 kursi, *Boeing 737-700* 144 kursi).
   - Okupansi kursi terkunci **100% penuh** ($n = \text{kapasitas}$) dan input persentase pembawa bagasi kabin ($0\%\text{–}100\%$) dengan perhitungan deterministik $n_b = \lfloor n \cdot \rho_b + 0.5 \rfloor$.
   - Pengaturan parameter GA (`pop_size`, `generations`, `train_reps`, `test_reps`, `seed`, `zone_call_overhead_s`).
2. **Halaman 2 — Proses Optimasi**:
   - Pemantauan *real-time* pekerjaan optimasi dari backend Python (`/api/v2/azbo/jobs/{job_id}`).
   - Progres generasi GA, jumlah kandidat fenotipe zona unik, rata-rata waktu training terbaik sementara, dan distribusi eksplorasi jumlah zona $K \in \{1, \dots, N\}$.
3. **Halaman 3 — Hasil Rekomendasi**:
   - Rekomendasi strategi kondisional terbaik di antara konfigurasi zona hasil GA (`GA_ZONE`), `WMA`, `BTF`, dan `RANDOM` yang dievaluasi pada replikasi testing baru dengan Common Random Numbers.
   - Rincian jumlah zona $K$, batas baris tiap zona, urutan pemanggilan zona, aturan internal zona (`WMA_IN_ZONE` / `BTF_IN_ZONE`), rata-rata waktu boarding, simpangan baku sampel ($s$), 95% CI, nilai min/maks, tabel *Paired Comparison*, dan deteksi ekuivalensi strategi.
4. **Halaman 4 — Visualisasi Simulasi**:
   - Animasi interaktif denah kabin dan sel lorong fisik (`0.4 m` per sel, 2 sel per baris) yang digerakkan langsung oleh *event log* (`trace`) dari backend Python.
5. **Halaman 5 — Metodologi**:
   - Dokumentasi lengkap formulasi matematika AZBO, vektor biner pemotongan zona $K = 1 + \sum_{j=1}^{N-1} c_j$, tabel distribusi probabilitas (*Truncated Normal*, *Weibull*, *Triangular*), referensi jurnal ilmiah, dan batasan penelitian.

---

## Cara Menjalankan Secara Lokal

### 1. Jalankan Backend Python (Port 8001)
```bash
pip install -r backend/requirements.txt
python3 backend/run_server.py
```
Backend FastAPI akan aktif di `http://127.0.0.1:8001` (cek kesehatan di `http://127.0.0.1:8001/api/v2/azbo/health`).

### 2. Jalankan Frontend React + Vite (Port 3000)
```bash
npm install
npm run dev
```
Buka `http://localhost:3000`. Vite secara otomatis meneruskan (*proxy*) seluruh permintaan `/api/*` ke `http://127.0.0.1:8001`.

---

## Cara Menjalankan Pengujian (Unit & Integration Tests)

```bash
# 1. Jalankan seluruh 52 unit & integration test Python (termasuk test_azbo_v2.py)
PYTHONPATH=backend python3 -m unittest discover -s backend/tests -v

# 2. Periksa tipe TypeScript dan kompilasi produksi frontend
npm run lint
npm run build
```

---

## Deployment Publik (Frontend Statis + Backend Python Terpisah)

Karena **GitHub Pages** hanya menyajikan file statis dan tidak dapat menjalankan proses Python FastAPI:
1. Deploy direktori `backend/` ke layanan container Python seperti **Google Cloud Run**, **Render**, atau **Railway** (lihat panduan lengkap di `DEPLOYMENT.md`).
2. Saat melakukan build frontend untuk GitHub Pages / Vercel / Netlify, atur variabel environment:
   ```bash
   VITE_API_BASE_URL=https://<url-backend-python-anda>/api/v2/azbo
   ```
3. Atau gunakan `docker compose up --build -d` untuk menjalankan `zoneflow-backend` (port 8001) dan `zoneflow-frontend` (port 3000) secara bersamaan.
