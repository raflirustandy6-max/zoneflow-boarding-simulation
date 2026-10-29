# STATUS PENGUJIAN OTOMATIS — ZONEFLOW VERSI 19 (PERBAIKAN VALIDITAS OPTIMASI & 12 METODE BOARDING)

Dokumen ini mencatat hasil aktual pengujian otomatis backend Python, pengujian unit frontend TypeScript, pemeriksaan tipe statis (`tsc --noEmit`), kompilasi bundel produksi (`vite build`), serta pengujian integrasi end-to-end frontend–backend setelah penerapan **Perbaikan Validitas Algoritma Optimasi Versi 19** sesuai laporan audit dan Blueprint AZBO.

## 1. Ringkasan Eksekusi Pengujian Aktual

| Kategori Pengujian | Perintah Eksekusi | Jumlah Pengujian | Status Aktual |
| :--- | :--- | :---: | :---: |
| **1. Regresi Audit Validitas Optimasi V19 (`backend/tests/test_audit_validitas_opt_v19.py`)** | `PYTHONPATH=backend python3 -m unittest backend/tests/test_audit_validitas_opt_v19.py -v` | **5 / 5** | **LULUS (OK)** |
| **2. Acceptance Tests AZBO V2 (`backend/tests/test_azbo_v2.py`)** | `PYTHONPATH=backend python3 -m unittest backend/tests/test_azbo_v2.py -v` | **9 / 9** | **LULUS (OK)** |
| **3. Seluruh Suite Backend Python (`test_audit_validitas_opt_v19.py`, `test_azbo_v2.py`, `test_model_equivalence.py`, `test_simulation.py`)** | `PYTHONPATH=backend python3 -m unittest discover -s backend/tests -v` | **32 / 32** | **LULUS (OK)** |
| **4. Unit Tests Frontend TypeScript (`azboV2.test.ts` & `engine.test.ts`)** | `npx --yes tsx --test src/simulation/azboV2.test.ts src/simulation/engine.test.ts` | **16 / 16** | **LULUS (PASS)** |
| **5. Pemeriksaan Tipe TypeScript (`npm run lint`)** | `npm run lint` (`tsc --noEmit`) | Seluruh codebase | **LULUS (0 Error)** |
| **6. Kompilasi Produksi (`npm run build`)** | `npm run build` (`vite build`) | Bundel `dist/` | **LULUS (Sukses)** |
| **7. Integrasi Frontend–Backend (`http://localhost:3000` & `/api/v2/azbo/*`)** | Evaluasi 12 metode, cakupan $K=1\dots N$, animasi replikasi representatif | End-to-End | **LULUS (Sukses)** |

---

## 2. Rincian Perbaikan Validitas Algoritma Optimasi V19 yang Diuji

### A. Pengujian Regresi Audit Validitas Optimasi V19 (`5 / 5 Lulus`)
1. **`test_ga_cakupan_30_nilai_k_meskipun_populasi_14`**:
   - Memverifikasi bahwa untuk kabin $N=30$ baris dan ukuran populasi evolusi `ga_population=14`, tahap pemeriksaan cakupan awal mengevaluasi sekurang-kurangnya 1 kandidat untuk **setiap** $K \in \{1, \dots, 30\}$ pada `train_seeds` yang sama (`initial_k_coverage == [1..30]`, `initial_coverage_candidates_evaluated == 30`, `ga_population_requested == 14`).
2. **`test_replikasi_seed_terpisah_dan_ekuivalensi_semua_replikasi`**:
   - Memverifikasi bahwa `optimization.train_seeds` dan `optimization.test_seeds` terpisah sepenuhnya (`isdisjoint`), seluruh 12 strategi dievaluasi dengan Common Random Numbers (CRN), dan pasangan metode pada `equivalent_methods` hanya dinyatakan identik apabila urutan kursinya persis sama pada **seluruh** replikasi `test_seeds` (bukan hanya replikasi pertama).
3. **`test_trace_representatif_adalah_replikasi_nyata`**:
   - Memverifikasi bahwa lintasan animasi (`animation`) berasal dari **satu replikasi pengujian nyata** yang memiliki durasi paling mendekati rata-rata sampel metode pemenang (`selection_method == "testing_replication_closest_to_winner_sample_mean"`, `is_single_replication == True`), serta menyimpan `boarding_time_s` aktual replikasi tersebut secara terpisah dari `sample_mean_s`.
4. **`test_kabin_3_kiri_2_kanan_label_kursi_unik`**:
   - Memverifikasi validasi label kursi unik pada `CabinSpec` (termasuk konfigurasi 3 kursi kiri dan 2 kursi kanan `A, B, C` / `D, E`) dan penolakan label kursi duplikat dalam satu baris.
5. **`test_audit_100_replikasi_dapat_dijalankan`**:
   - Memverifikasi bahwa evaluasi akhir dengan `test_reps=100` berjalan tuntas dan menghasilkan 100 `test_seeds` serta 12 perbandingan berpasangan (`paired_comparisons`).

### B. Pengujian Suite Backend Python Lainnya (`27 / 27 Lulus`)
- **`backend/tests/test_azbo_v2.py` (9 pengujian)**: Memverifikasi invarian fisik lorong ($\Delta x_{\text{cell}} = 0{,}4\text{ m}$, $\Delta t = 0{,}25\text{ dtk}$, 1 penumpang/sel, FIFO), okupansi 100%, rumus bagasi deterministik $n_b = \lfloor n \cdot \rho_b + 0{,}5 \rfloor$, distribusi kecepatan berjalan & waktu bagasi/kursi, kromosom variabel-$K$, operator GA vs enumerasi kabin mini, pemisahan train/test & CRN, kontrak API `/api/v2/azbo/*`, serta aturan urutan ke-12 metode pada tata letak `2-2`, `2-3`, dan `3-3` (baris genap & ganjil).
- **`backend/tests/test_model_equivalence.py` (5 pengujian)** & **`backend/tests/test_simulation.py` (13 pengujian)**: Memverifikasi kesetaraan konstanta fisik, peta 180 kursi, urutan 12 metode, statistik referensi NIST, serta endpoint `/api/v1/*` dan `/api/v2/azbo/*`.

### C. Pengujian Unit Frontend TypeScript (`16 / 16 Lulus`)
- **`src/simulation/azboV2.test.ts` (6 pengujian)**:
  - Memverifikasi `computeDeterministicBaggageCount`, pemetaan respons `mapAzboV2ResponseToSummary` untuk pemenang zona maupun non-zona, resolusi URL proxy lokal & produksi, pemetaan 12 metode boarding, serta pemetaan metadata audit validitas V19 (`initialKCoverage`, `initialCoverageCandidatesEvaluated`, `gaPopulationRequested`, `trainSeeds`, `testSeeds`, `animationReplication`, dan `azboWilmaEquivalenceVerified` yang hanya bernilai `true` bila pasangan `ZONE` dan `WMA` terbukti ekuivalen).
- **`src/simulation/engine.test.ts` (10 pengujian)**:
  - Memverifikasi struktur kursi, pembangkitan penumpang sintetis, keunikan 180 kursi pada semua metode, ekuivalensi BTF-AZBO-WILMA, delay *seat interference*, simulasi segmen lorong, pencarian zona, deteksi `Content-Type: application/json`, multi-layout kabin (`2-2`, `2-3`, `3-3`), dan sensitivitas waktu boarding terhadap bagasi.
