# STATUS PENGUJIAN OTOMATIS — ZONEFLOW ARSITEKTUR DUA VERSI (PYTHON ASLI & PYODIDE WEB WORKER)

Dokumen ini mencatat hasil aktual pengujian otomatis untuk **Arsitektur Dua Versi ZoneFlow**:
- **Versi A — Mesin Penelitian Python Asli (`backend/app/azbo_core.py`)**: Dipertahankan secara utuh beserta server FastAPI lokal (`backend/app/main.py`) dan seluruh rangkaian pengujian ilmiah.
- **Versi B — Website Demonstrasi GitHub Pages (Pyodide `0.27.8` + Web Worker)**: Menjalankan kode Python `backend/app/azbo_core.py` yang sama persis secara langsung di dalam browser tanpa memerlukan Render, Railway, atau server FastAPI eksternal, dengan base path Vite `/zoneflow-boarding-simulation/`.

## 1. Ringkasan Eksekusi Pengujian Aktual

| Kategori Pengujian | Perintah Eksekusi | Jumlah Pengujian | Status Aktual |
| :--- | :--- | :---: | :---: |
| **1. Uji Kesetaraan Penuh Python Asli vs Pyodide WebAssembly (`src/simulation/pyodideEquivalence.test.ts`)** | `npx --yes tsx --test src/simulation/pyodideEquivalence.test.ts` | **3 / 3** (8, 18, & 30 Baris) | **LULUS (100% Identik)** |
| **2. Unit Tests Frontend TypeScript (`azboV2.test.ts` & `engine.test.ts`)** | `npx --yes tsx --test src/simulation/azboV2.test.ts src/simulation/engine.test.ts` | **16 / 16** | **LULUS (PASS)** |
| **3. Regresi Audit Validitas Optimasi V19 (`backend/tests/test_audit_validitas_opt_v19.py`)** | `PYTHONPATH=backend python3 -m unittest backend/tests/test_audit_validitas_opt_v19.py -v` | **5 / 5** | **LULUS (OK)** |
| **4. Acceptance Tests AZBO V2 (`backend/tests/test_azbo_v2.py`)** | `PYTHONPATH=backend python3 -m unittest backend/tests/test_azbo_v2.py -v` | **9 / 9** | **LULUS (OK)** |
| **5. Seluruh Suite Backend Python (`backend/tests/*`)** | `PYTHONPATH=backend python3 -m unittest discover -s backend/tests -v` | **32 / 32** | **LULUS (OK)** |
| **6. Pemeriksaan Tipe TypeScript (`npm run lint`)** | `npm run lint` (`tsc --noEmit`) | Seluruh codebase | **LULUS (0 Error)** |
| **7. Kompilasi Produksi GitHub Pages (`npm run build`)** | `npm run build` (`vite build` dengan `base: '/zoneflow-boarding-simulation/'`) | Bundel `dist/` + `dist/pyodide/` | **LULUS (Sukses)** |
| **8. Verifikasi Browser Nyata (`playwright-cli` pada `http://localhost:3000`)** | Eksekusi simulasi AZBO V2 di browser melalui Pyodide Web Worker tanpa panggilan `/api/v2/azbo/*` | End-to-End Browser | **LULUS (Sukses)** |

---

## 2. Hasil Uji Kesetaraan Python Asli (Versi A) vs Pyodide WebAssembly (Versi B)

Karena `backend/app/azbo_core.py` murni menggunakan pustaka standar Python (`itertools`, `math`, `random`, `dataclasses`, `typing`) dan kedua lingkungan menggunakan implementasi generator angka acak Mersenne Twister (`random.Random(seed)`) serta aritmetika IEEE 754 yang sama, pengujian pada `src/simulation/pyodideEquivalence.test.ts` membuktikan **kesetaraan 100% (identik bit-demi-bit pada seluruh metrik JSON)** antara eksekusi CPython lokal dan Pyodide WebAssembly pada ketiga skala konfigurasi:

1. **Skenario 1 — Konfigurasi Kecil (8 Baris / 32 Penumpang, Susunan 2-2, 70% Bagasi = 22 Penumpang, `seed=20261029`, `train_reps=3`, `test_reps=10`)**:
   - Cakupan awal $K = 1 \dots 8$, hasil optimasi GA (`k_zones`, `cut_rows`, `zone_order`, `in_zone_rule`, `best_training_fitness_s`), `train_seeds`, `test_seeds`, waktu rata-rata/SD/CI 95% ke-12 metode boarding, jumlah kejadian *aisle wait* dan *seat interference*, serta replikasi representatif animasi (`replication_seed`, `boarding_time_s`, `trace`) **100% identik**.
2. **Skenario 2 — Konfigurasi Menengah ATR 72-600 (18 Baris / 72 Penumpang, Susunan 2-2, 70% Bagasi = 50 Penumpang, `seed=20261029`, `train_reps=3`, `test_reps=10`)**:
   - Cakupan awal $K = 1 \dots 18$, hasil optimasi GA, `train_seeds`, `test_seeds`, peringkat & waktu boarding ke-12 metode, serta lintasan animasi **100% identik**.
3. **Skenario 3 — Konfigurasi Penuh Boeing 737-800 / Airbus A320-200 (30 Baris / 180 Penumpang, Susunan 3-3, 70% Bagasi = 126 Penumpang, `seed=20261029`, `train_reps=3`, `test_reps=10`)**:
   - Cakupan awal $K = 1 \dots 30$, hasil optimasi GA, `train_seeds`, `test_seeds`, peringkat & waktu boarding ke-12 metode, serta lintasan animasi **100% identik**.
