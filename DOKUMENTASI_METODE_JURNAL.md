# DOKUMENTASI METODE BOARDING BERBASIS JURNAL ILMIAH PADA ZONEFLOW (AZBO V2 — 12 METODE)

Dokumen ini merangkum 12 kelompok metode boarding yang diimplementasikan, diuji, dan dibandingkan secara langsung pada mesin simulasi antrean seluler satu lorong Python FastAPI (`backend/app/azbo_core.py`) di dalam aplikasi **ZoneFlow Boarding Simulation**, beserta metode literatur khusus pesawat multi-lorong (*Blended Wing Body*) yang dicatat secara ilmiah.

---

## 1. Referensi yang dicocokkan dengan HALAMAN PERTAMA PDF ASLI

Catatan audit (29 Oktober 2026): daftar pustaka di ZIP asli versi 19 memuat beberapa **judul dan nama penulis yang keliru**. Data berikut diperiksa langsung dari halaman pertama keempat PDF yang dilampirkan pengguna. Nama file PDF dapat berbeda dari judul artikel sebenarnya.

1. **Possamai Viertel, S., Pessini, L., Secomandi, L., Cavion, R., & Hedler Staudt, F. (2025).** *Boarding Efficiency in Regional Aviation: A Comparative Analysis of Methods*. Makalah konferensi, Brasília, Oktober 2025 (PDF: `Reverse Pyramid Method (1).pdf`). Bab 2 dan Gambar 2 menjelaskan Random, Back-to-Front, WMA, Reverse Pyramid, Rotating Zones, Modified Optimal. Jangan mengutip judul lama *Evaluation of Aircraft Boarding Strategies: A Study Considering Operational Disruptions* yang bukan judul PDF ini.

2. **Płanda, B., & Skorupski, J. (2025).** *Model for Evaluation of Aircraft Boarding Under Disturbances*. **Aerospace, 12(5), 403**, DOI: 10.3390/aerospace12050403. (PDF: `aerospace-12-00403-v3 (1).pdf`). Bahasan strategi pada Bagian 2.2, khususnya Front-to-Back, Reverse Pyramid, Rotating Zones, Steffen. Artikel terutama membahas *disruptions* dengan model Petri net, bukan model simulator Python ZoneFlow.

3. **Gehlen, M. A., & Ronzani, G. M. R. (2025).** *Setting Airport Boarding Strategies Based on Passengers’ Operational Data through Machine Learning Techniques*. **Journal of Aerospace Technology and Management, 17, e2125**, DOI: 10.1590/jatm.v17.1382. (PDF: `Steffen method (1).pdf`). Jurnal menganalisis strategi dan prediksi waktu dengan simulasi/ML; ZoneFlow TIDAK mengklaim telah menerapkan ML dari artikel ini.

4. **Dong, Y., Jia, X., Yanagisawa, D., & Nishinari, K. (2025).** *Boarding strategies accounting for properties of the blended wing body aircraft*. **Physica A, 658, 130298**, DOI: 10.1016/j.physa.2024.130298. (PDF: `Boarding-strategies-accounting-for-propert_2025_Physica-A--Statistical-Mecha (1).pdf`). Bagian 3.2 dan Gambar 5: *Double Outside-In*. Artikel memakai geometri **Blended Wing Body**; aturan dalam ZoneFlow merupakan adaptasi satu-lorong.

5. **Steffen, J. H., & Hotchkiss, J. (2012).** *Experimental test of airplane boarding methods*. **Journal of Air Transport Management, 18(1), 64–67**. Referensi urutan *Four-Row Blocks* pada eksperimen 12 baris; aturan pada kabin jumlah baris lain adalah adaptasi ZoneFlow.

**Batas klaim:** kode mengimplementasikan *aturan/varian/adaptasi* yang didokumentasikan. Tidak semua urutan sama persis dengan perangkat simulasi asli di jurnal; verifikasi diagram, protokol pelepasan kelompok, dan eksperimen pembanding tetap diperlukan sebelum mengklaim replikasi literatur yang identik.

---

## 2. Spesifikasi 12 Kelompok Metode Boarding Aktif pada Mesin Python AZBO V2

Seluruh 12 metode berikut diimplementasikan dalam fungsi `build_boarding_sequence()` pada `backend/app/azbo_core.py` dan dievaluasi secara serentak oleh `run_azbo_v2_evaluation()` menggunakan *Common Random Numbers* (CRN) pada himpunan replikasi pengujian (`test_reps`) yang terpisah dari replikasi pelatihan GA (`train_reps`).

| No | Kode Strategi (`strategy_id`) | Nama Tampilan UI | Kategori | Status |
|---|---|---|---|---|
| 1 | `RANDOM` | Acak (Tanpa Urutan Khusus / Random) | Pembanding Dasar | Aktif & Teruji |
| 2 | `BTF` | Belakang ke Depan (Back-to-Front) | Berdasarkan Baris | Aktif & Teruji |
| 3 | `WMA` | Jendela–Tengah–Lorong (Window–Middle–Aisle / WMA) | Berdasarkan Posisi Kursi | Aktif & Teruji |
| 4 | `ZONE` | Boarding Berbasis Zona (Hasil Optimasi AZBO) | Berbasis Zona (Optimasi GA) | Aktif & Teruji |
| 5 | `REVERSE_PYRAMID` | Piramida Terbalik (Reverse Pyramid) | Kombinasi Diagonal Baris & Kursi | Aktif & Teruji |
| 6 | `STEFFEN` | Metode Steffen (Urutan Kursi Berselang-seling) | Urutan Kursi Berselang-seling | Aktif & Teruji |
| 7 | `ROTATING_ZONES` | Zona Berputar (Rotating Zones) | Blok Zona Bergantian | Aktif & Teruji |
| 8 | `MODIFIED_OPTIMAL` | Optimal Termodifikasi (Modified Optimal) | Baris Genap/Ganjil & Sisi Kabin | Aktif & Teruji |
| 9 | `FRONT_TO_BACK` | Depan ke Belakang (Front-to-Back) | Berdasarkan Baris (Depan ke Belakang) | Aktif & Teruji |
| 10 | `BLOCKS_4_ROWS` | Blok 4 Baris (Four-Row Blocks) | Blok Baris Tetap Bergantian | Aktif & Teruji |
| 11 | `DOUBLE_OUTSIDE_IN` | Double Outside-In (Adaptasi Kabin Satu Lorong) | Hibrida Dua Bagian Kabin & Posisi Kursi | Aktif & Teruji |
| 12 | `BTF_WMA_FIXED` | Back-to-Front + WMA (3 Zona Tetap) | Hibrida Zona Tetap & Posisi Kursi | Aktif & Teruji |

---

### 2.1. Metode 1–4: Empat Metode Dasar & Optimasi AZBO

1. **`RANDOM` — Random Boarding**
   - **Referensi:** Possamai Viertel et al. (2025, Bagian 2 & Gambar 2c); Płanda & Skorupski (2025, Bagian 2.2.1); Gehlen & Ronzani (2025).
   - **Aturan Urutan:** Seluruh penumpang masuk dalam 1 kelompok tunggal (`group_id = 1`) dengan urutan antrean acak seragam per replikasi (`rng.shuffle`).

2. **`BTF` — Back-to-Front Boarding**
   - **Referensi:** Possamai Viertel et al. (2025, Bagian 2 & Gambar 2a); Płanda & Skorupski (2025, Bagian 2.2.2).
   - **Aturan Urutan:** Penumpang diurutkan dari baris paling belakang ($r = N$) menuju baris paling depan ($r = 1$), dengan urutan acak deterministik (`tie_map`) di dalam baris yang sama.

3. **`WMA` — Window–Middle–Aisle (Outside-In)**
   - **Referensi:** Possamai Viertel et al. (2025, Bagian 2 & Gambar 2b); Płanda & Skorupski (2025, Bagian 2.2.4).
   - **Aturan Urutan:** Penumpang dikelompokkan berdasarkan kelas jarak kursi dari lorong: Kelompok 1 = Kursi Jendela (`seat_priority = 0`), Kelompok 2 = Kursi Tengah (`seat_priority = 1`, jika tersedia), Kelompok 3 = Kursi Lorong (`seat_priority = 2`). Pada pesawat `2-2` (`ATR 72-600`) yang tidak memiliki kursi tengah, kelompok dikompresi menjadi 2 kelompok (Jendela lalu Lorong). Di dalam tiap kelompok, penumpang diurutkan dari baris belakang ke depan (`-row`) dengan pemecah seri deterministik (`tie_map`).

4. **`ZONE` — Boarding Berbasis Zona (Optimasi GA Variabel-$K$ AZBO)**
   - **Referensi:** `Blueprint_AZBO.pdf` Bagian 6 & 9; Soolaki et al. (2012).
   - **Aturan Urutan:** Menggunakan kromosom $\mathbf{x} = (\mathbf{c}, \mathbf{p}, q)$ hasil pencarian *Genetic Algorithm* pada replikasi pelatihan (`train_reps`), di mana $\mathbf{c} \in \{0,1\}^{N-1}$ menentukan titik potong batas baris (jumlah zona $K = 1 + \sum c_r \in \{1,\dots,N\}$), $\mathbf{p} \in [0,1]^N$ menentukan urutan pemanggilan zona, dan $q \in \{\texttt{WMA\_IN\_ZONE}, \texttt{BTF\_IN\_ZONE}\}$ menentukan aturan urutan di dalam zona.

---

### 2.2. Metode 5: `REVERSE_PYRAMID` (Piramida Terbalik)

- **Referensi Jurnal:**
  - Płanda & Skorupski (2025), *Model for Evaluation of Aircraft Boarding Under Disturbances*, *Aerospace* 12, 403 — Bagian 2.2.7 & **Gambar 3** (hal. 6).
  - Possamai Viertel et al. (2025), *XXII SITRAER* — Bagian 2 & **Gambar 2(d)** (hal. 2).
- **Aturan Urutan Boarding:**
  1. Baris kabin $1 \dots N$ dibagi menjadi $B = \min(3, N)$ segmen longitudinal seimbang yang diindeks dari **belakang ke depan**:
     - $b = 0$: Segmen Belakang (misal Baris 21–30 untuk $N = 30$; Baris 18–25 untuk $N = 25$; Baris 13–18 untuk $N = 18$).
     - $b = 1$: Segmen Tengah (misal Baris 11–20 untuk $N = 30$; Baris 10–17 untuk $N = 25$; Baris 7–12 untuk $N = 18$).
     - $b = 2$: Segmen Depan (misal Baris 1–10 untuk $N = 30$; Baris 1–9 untuk $N = 25$; Baris 1–6 untuk $N = 18$).
  2. Kelas kursi yang hadir pada tata letak kabin dikompresi secara terurut menjadi indeks $c \in \{0, \dots, C-1\}$ dari luar ke dalam:
     - Untuk kabin `3-3` dan `2-3`: $C = 3$ ($c = 0$ Jendela, $c = 1$ Tengah, $c = 2$ Lorong).
     - Untuk kabin `2-2` (tanpa kursi tengah): $C = 2$ ($c = 0$ Jendela, $c = 1$ Lorong).
  3. Indeks kelompok diagonal setiap penumpang ditentukan oleh rumus:
     $$g(p) = c(p) + b(p) + 1$$
     sehingga terbentuk $G = C + B - 1$ kelompok diagonal:
     - **Pada kabin `3-3` dan `2-3` ($G = 5$ kelompok):**
       - Kelompok 1: Jendela Belakang
       - Kelompok 2: Jendela Tengah + Tengah Belakang
       - Kelompok 3: Jendela Depan + Tengah Tengah + Lorong Belakang
       - Kelompok 4: Tengah Depan + Lorong Tengah
       - Kelompok 5: Lorong Depan
     - **Pada kabin `2-2` ($G = 4$ kelompok):**
       - Kelompok 1: Jendela Belakang
       - Kelompok 2: Jendela Tengah + Lorong Belakang
       - Kelompok 3: Jendela Depan + Lorong Tengah
       - Kelompok 4: Lorong Depan
  4. Di dalam kelompok diagonal yang sama, penumpang diurutkan dari baris belakang ke depan (`-row`), prioritas kursi luar ke dalam (`seat_priority`), dan pemecah seri acak deterministik (`tie_map`).

---

### 2.3. Metode 6: `STEFFEN` (Metode Steffen)

- **Referensi Jurnal:**
  - Płanda & Skorupski (2025), *Model for Evaluation of Aircraft Boarding Under Disturbances*, *Aerospace* 12, 403 — Bagian 2.2.9 & **Gambar 4** (hal. 6–7).
  - Gehlen & Ronzani (2025), *J. Aerosp. Technol. Manag.* v17, e2125 — Bagian *Introduction* & *Methodology* (hal. 2–5).
  - Dong et al. (2025), *Physica A* 658, 130298 — Bagian 3.1 & Bagian 4.2 (hal. 4 & 7).
- **Aturan Urutan Boarding:**
  1. Iterasi luar berdasarkan kelas kursi yang hadir pada kabin (`present_priorities`):
     - Tahap Jendela (`seat_priority = 0`) $\to$ Tahap Tengah (`seat_priority = 1`, jika tersedia) $\to$ Tahap Lorong (`seat_priority = 2`).
  2. Di dalam setiap kelas kursi, pemanggilan dibagi menurut **paritas nomor baris** dimulai dari paritas baris paling belakang $N$ (`rear_parity = N % 2`), lalu paritas sebelahnya (`1 - rear_parity`):
     - Untuk $N$ genap (mis. $N = 30, 24, 18$): baris genap ($N, N-2, \dots, 2$) terlebih dahulu, kemudian baris ganjil ($N-1, N-3, \dots, 1$).
     - Untuk $N$ ganjil (mis. $N = 25$): baris ganjil ($N, N-2, \dots, 1$) terlebih dahulu, kemudian baris genap ($N-1, N-3, \dots, 2$).
  3. Untuk setiap kombinasi `(kelas_kursi, paritas_baris)`, sisi kabin dipanggil bergantian:
     - Sisi Kiri (`side == "left"`) dari baris paling belakang ke depan.
     - Sisi Kanan (`side == "right"`) dari baris paling belakang ke depan.
  4. Menghasilkan 12 gelombang terurut pada kabin `3-3`, 10 gelombang tidak kosong pada kabin asimetris `2-3` (`A220-100`), dan 8 gelombang pada kabin `2-2` (`ATR 72-600`).

---

### 2.4. Metode 7: `ROTATING_ZONES` (Zona Berputar)

- **Referensi Jurnal:**
  - Possamai Viertel et al. (2025), *XXII SITRAER* — Bagian 2 & **Gambar 2(e)** (hal. 2).
  - Płanda & Skorupski (2025), *Model for Evaluation of Aircraft Boarding Under Disturbances*, *Aerospace* 12, 403 — Bagian 2.2.8 (*Rotating Zone*, hal. 6).
- **Aturan Urutan Boarding:**
  1. Baris kabin $1 \dots N$ dibagi menjadi $K_{\text{rot}} = \min(5, N)$ zona baris kontigu berukuran seimbang (`equal_rotating_zone_ranges(n_rows, max_zones=5)`), diberi nomor $Z_1$ (paling depan) hingga $Z_{K_{\text{rot}}}$ (paling belakang).
  2. Urutan pemanggilan zona dimulai dari zona paling belakang, lalu zona paling depan, kemudian bergerak bergantian menuju bagian tengah kabin (`rotating_zone_calling_order`):
     $$Z_{K_{\text{rot}}} \to Z_1 \to Z_{K_{\text{rot}}-1} \to Z_2 \to \dots$$
     Untuk $K_{\text{rot}} = 5$: **Zona 5 (Belakang) $\to$ Zona 1 (Depan) $\to$ Zona 4 $\to$ Zona 2 $\to$ Zona 3 (Tengah)**.
  3. Di dalam setiap zona, penumpang diurutkan dari baris belakang ke depan (`-row`) dengan pemecah seri deterministik (`tie_map`).

---

### 2.5. Metode 8: `MODIFIED_OPTIMAL` (Optimal Termodifikasi)

- **Referensi Jurnal:**
  - Possamai Viertel et al. (2025), *XXII SITRAER* — Bagian 2 & **Gambar 2(f)** (hal. 2).
- **Aturan Urutan Boarding:**
  1. Penumpang dibagi menjadi 4 kelompok berdasarkan paritas nomor baris dan sisi kabin terhadap lorong:
     - **Kelompok 1:** Nomor baris genap ($r \bmod 2 = 0$), sisi kiri kabin (`side == "left"`).
     - **Kelompok 2:** Nomor baris genap ($r \bmod 2 = 0$), sisi kanan kabin (`side == "right"`).
     - **Kelompok 3:** Nomor baris ganjil ($r \bmod 2 = 1$), sisi kiri kabin (`side == "left"`).
     - **Kelompok 4:** Nomor baris ganjil ($r \bmod 2 = 1$), sisi kanan kabin (`side == "right"`).
  2. Di dalam masing-masing kelompok, penumpang diurutkan dari baris belakang ke depan (`-row`), prioritas kelas kursi luar ke dalam (`seat_priority`), serta pemecah seri deterministik (`tie_map`).

---

### 2.6. Metode 9: `FRONT_TO_BACK` (Depan ke Belakang)

- **Referensi Jurnal:**
  - Płanda & Skorupski (2025), *Model for Evaluation of Aircraft Boarding Under Disturbances*, *Aerospace* 12, 403 — Bagian 2.2.3 (*Front-to-Back*, hal. 5).
- **Aturan Urutan Boarding:**
  1. Penumpang dipanggil secara berurutan mulai dari baris paling depan ($r = 1$) menuju baris paling belakang ($r = N$).
  2. Di dalam baris yang sama, urutan penumpang ditentukan secara acak deterministik per replikasi (`tie_map[seat_id]`).
  3. Nomor kelompok per penumpang adalah nomor baris kursinya (`group_id = row`).
- **Karakteristik & Keterbatasan:**
  - Menjadi pembanding batas atas kepadatan antrean lorong karena penumpang baris depan yang sedang menyimpan bagasi kabin menghalangi akses penumpang menuju seluruh baris di belakangnya.

---

### 2.7. Metode 10: `BLOCKS_4_ROWS` (Blok 4 Baris / Four-Row Blocks)

- **Referensi Jurnal:**
  - Steffen & Hotchkiss (2012), *Journal of Air Transport Management*, 18(1), hal. 64–67 (*Experimental Test of Airplane Boarding Methods*).
- **Aturan Urutan Boarding:**
  1. Baris kabin $1 \dots N$ dipartisi dari depan ke belakang menjadi blok-blok kontigu berukuran maksimal 4 baris (`four_row_block_ranges(n_rows, block_size=4)`):
     $$B_1 = [1, \min(4, N)], \quad B_2 = [5, \min(8, N)], \quad B_3 = [9, \min(12, N)], \dots$$
  2. Urutan pemanggilan blok mengikuti pola bergantian belakang $\to$ depan $\to$ menuju tengah (`rotating_zone_calling_order(k_blocks)`):
     - **Pada kabin 12 baris ($N = 12$, sesuai eksperimen asli Steffen & Hotchkiss, 2012):**
       - Panggilan 1: Blok 3 (Baris 9–12)
       - Panggilan 2: Blok 1 (Baris 1–4)
       - Panggilan 3: Blok 2 (Baris 5–8)
     - **Pada kabin dengan jumlah baris $N \neq 12$ (adaptasi umum ZoneFlow):**
       - Untuk $N = 30$ (8 blok: `1–4, 5–8, 9–12, 13–16, 17–20, 21–24, 25–28, 29–30`): urutan panggilan blok adalah `Blok 8 (29–30) -> Blok 1 (1–4) -> Blok 7 (25–28) -> Blok 2 (5–8) -> Blok 6 (21–24) -> Blok 3 (9–12) -> Blok 5 (17–20) -> Blok 4 (13–16)`.
       - Untuk $N = 25$ (7 blok): blok terakhir `25–25` dipanggil pertama diikuti `1–4`, `21–24`, dst.
       - Untuk $N = 18$ (5 blok: `1–4, 5–8, 9–12, 13–16, 17–18`): urutan panggilan blok adalah `Blok 5 -> Blok 1 -> Blok 4 -> Blok 2 -> Blok 3`.
  3. Di dalam setiap blok 4 baris, penumpang masuk secara acak deterministik (`tie_map[seat_id]`) sesuai protokol eksperimen Steffen & Hotchkiss (2012).
- **Perbedaan dari `ROTATING_ZONES`:**
  - `ROTATING_ZONES` selalu membagi kabin menjadi $\min(5, N)$ zona berukuran seimbang dan mengurutkan penumpang dari belakang ke depan di dalam zona, sedangkan `BLOCKS_4_ROWS` menggunakan ukuran blok tetap 4 baris dan urutan acak di dalam blok.

---

### 2.8. Metode 11: `DOUBLE_OUTSIDE_IN` (Adaptasi Double Outside-In untuk Kabin Satu Lorong)

- **Referensi Jurnal:**
  - Dong, Jia, Yanagisawa, & Nishinari (2025), *Physica A*, 658, 130298 — Bagian 3.2 & **Gambar 5** (hal. 4–5).
- **Catatan Ilmiah Penting:**
  - Dalam jurnal Dong et al. (2025), *Double Outside-In* diuji pada pesawat konsep *Blended Wing Body* (BWB). Pada ZoneFlow, aturan pengelompokan *Double Outside-In* diadaptasi secara proporsional untuk **model kabin pesawat komersial satu lorong** (`Adaptasi Double Outside-In untuk model kabin satu lorong`).
- **Aturan Urutan Boarding:**
  1. Kabin dibagi secara longitudinal menjadi dua bagian baris (`double_outside_in_row_split(n_rows)`):
     - **Bagian Depan (*Front Half*):** Baris $1$ s/d $\lfloor N / 2 \rfloor$ (mis. Baris 1–15 untuk $N = 30$; Baris 1–12 untuk $N = 25$; Baris 1–9 untuk $N = 18$).
     - **Bagian Belakang (*Rear Half*):** Baris $(\lfloor N / 2 \rfloor + 1)$ s/d $N$ (mis. Baris 16–30 untuk $N = 30$; Baris 13–25 untuk $N = 25$; Baris 10–18 untuk $N = 18$).
  2. Untuk setiap kelas prioritas kursi yang hadir pada kabin (`0 = Jendela`, `1 = Tengah`, `2 = Lorong`), penumpang Bagian Belakang dipanggil terlebih dahulu, diikuti penumpang Bagian Depan:
     - **Pada kabin `3-3` dan `2-3` (6 kelompok):**
       1. Kelompok 1: Kursi Jendela Bagian Belakang
       2. Kelompok 2: Kursi Jendela Bagian Depan
       3. Kelompok 3: Kursi Tengah Bagian Belakang
       4. Kelompok 4: Kursi Tengah Bagian Depan
       5. Kelompok 5: Kursi Lorong Bagian Belakang
       6. Kelompok 6: Kursi Lorong Bagian Depan
     - **Pada kabin `2-2` tanpa kursi tengah (4 kelompok):**
       1. Kelompok 1: Kursi Jendela Bagian Belakang
       2. Kelompok 2: Kursi Jendela Bagian Depan
       3. Kelompok 3: Kursi Lorong Bagian Belakang
       4. Kelompok 4: Kursi Lorong Bagian Depan
  3. Di dalam masing-masing kelompok, urutan antrean penumpang diacak secara deterministik (`tie_map[seat_id]`) sesuai spesifikasi Dong et al. (2025, Bagian 3.1/3.2: *"The boarding sequence within each group is randomized"*).
- **Perbedaan dari `WMA`:**
  - `WMA` menggabungkan seluruh baris $N \dots 1$ ke dalam satu kelompok per kelas kursi dan mengurutkannya secara ketat dari belakang ke depan, sedangkan `DOUBLE_OUTSIDE_IN` memisahkan setiap kelas kursi menjadi kelompok Paruh Belakang dan kelompok Paruh Depan dengan pengacakan antrean di dalam masing-masing paruh kabin.

---

### 2.9. Metode 12: `BTF_WMA_FIXED` (Back-to-Front + WMA pada 3 Zona Tetap)

- **Referensi & Tujuan Ilmiah:**
  - Possamai Viertel et al. (2025); Płanda & Skorupski (2025); Baseline Hibrida Zona Tetap ZoneFlow.
  - Didefinisikan sebagai **metode hibrida pembanding (baseline) dengan 3 zona tetap seimbang** tanpa optimasi *Genetic Algorithm*, sehingga peneliti dan pengguna dapat membandingkan secara langsung kinerja pembagian 3 zona tetap terhadap konfigurasi zona hasil optimasi GA variabel-$K$ (`ZONE`) maupun terhadap `REVERSE_PYRAMID`.
- **Aturan Urutan Boarding:**
  1. Kabin dibagi menjadi $K_{\text{fixed}} = \min(3, N)$ zona baris kontigu berukuran seimbang (`fixed_btf_wma_zone_ranges(n_rows, max_zones=3)`):
     - **Zona 1 (Depan):** misal Baris 1–10 ($N = 30$), Baris 1–9 ($N = 25$), Baris 1–6 ($N = 18$).
     - **Zona 2 (Tengah):** misal Baris 11–20 ($N = 30$), Baris 10–17 ($N = 25$), Baris 7–12 ($N = 18$).
     - **Zona 3 (Belakang):** misal Baris 21–30 ($N = 30$), Baris 18–25 ($N = 25$), Baris 13–18 ($N = 18$).
  2. Urutan pemanggilan zona adalah **Zona Belakang $\to$ Zona Tengah $\to$ Zona Depan** (`Zona 3 -> Zona 2 -> Zona 1`).
  3. Di dalam setiap zona, seluruh penumpang diselesaikan terlebih dahulu dengan urutan kelas kursi **Jendela (`0`) $\to$ Tengah (`1`, jika tersedia) $\to$ Lorong (`2`)**, dan dari baris belakang ke depan (`-row`) di dalam kelas kursi yang sama:
     - **Pada kabin `3-3` dan `2-3` (9 sub-kelompok berurutan):**
       1. Zona Belakang — Kursi Jendela
       2. Zona Belakang — Kursi Tengah
       3. Zona Belakang — Kursi Lorong
       4. Zona Tengah — Kursi Jendela
       5. Zona Tengah — Kursi Tengah
       6. Zona Tengah — Kursi Lorong
       7. Zona Depan — Kursi Jendela
       8. Zona Depan — Kursi Tengah
       9. Zona Depan — Kursi Lorong
     - **Pada kabin `2-2` tanpa kursi tengah (6 sub-kelompok berurutan):**
       1. Zona Belakang — Kursi Jendela
       2. Zona Belakang — Kursi Lorong
       3. Zona Tengah — Kursi Jendela
       4. Zona Tengah — Kursi Lorong
       5. Zona Depan — Kursi Jendela
       6. Zona Depan — Kursi Lorong
- **Perbedaan dari `REVERSE_PYRAMID` dan `ZONE`:**
  - Berbeda dari `REVERSE_PYRAMID`: pada `BTF_WMA_FIXED`, seluruh penumpang Zona Belakang (termasuk Kursi Lorong Belakang pada Panggilan 3) masuk **sebelum** Kursi Jendela Zona Tengah (Panggilan 4) dipanggil; sedangkan pada `REVERSE_PYRAMID`, Kursi Jendela Zona Tengah dipanggil secara diagonal pada Kelompok 2 bersama Kursi Tengah Belakang.
  - Berbeda dari `ZONE`: `BTF_WMA_FIXED` selalu menggunakan 3 zona seimbang tetap dengan urutan `3 -> 2 -> 1` dan aturan `WMA_IN_ZONE`, sedangkan `ZONE` menggunakan jumlah zona $K \in \{1,\dots,N\}$, titik potong baris, urutan panggil zona, dan aturan internal hasil optimasi *Genetic Algorithm*. Apabila pada suatu skenario GA kebetulan memilih partisi 3 zona seimbang yang identik dengan `BTF_WMA_FIXED`, sistem mendeteksinya secara otomatis pada atribut `equivalent_methods`.

---

## 3. Metode Literatur yang Tidak Diaktifkan sebagai Strategi Terpisah pada Kabin Satu Lorong

| Nama Metode pada Jurnal | Sumber Jurnal | Alasan Teknis & Ilmiah |
|---|---|---|
| **N-Aisles Steffen (`N-Steffen`)** | Dong et al. (2025), *Physica A* 658, 130298, Bagian 4 (Gambar 7–9), hal. 7 & 10 | Dirancang untuk kabin multi-lorong *Blended Wing Body* (4 *bay*, 4 lorong paralel, dan koridor melintang depan). Penulis jurnal menyatakan secara eksplisit pada Bagian 4.2 (hal. 7) dan Bagian 6 (hal. 10) bahwa untuk pesawat satu lorong ($N_{\text{aisles}} = 1$), metode *N-Steffen* **tereduksi menjadi Metode Steffen klasik** (`STEFFEN`) yang sudah diimplementasikan dan diuji pada simulator ini. |

---

## 4. Cakupan Pengujian Otomatis (`backend/tests/test_azbo_v2.py` & `src/simulation/azboV2.test.ts`)

1. **`test_A_aisle_physical_invariants_and_overlap_rejection`**: Memverifikasi bahwa seluruh 12 metode memenuhi invarian fisik lorong (kapasitas ketat 1 penumpang per sel lorong $0{,}4\text{ m}$, tanpa mendahului/*no overtaking*, penutupan sel baris target selama penyimpanan bagasi & duduk) pada tata letak `3-3`, `2-2`, dan `2-3`.
2. **`test_H_and_I_train_test_separation_crn_and_statistics`**: Memverifikasi pemisahan *seed* pelatihan GA dan *seed* pengujian, penggunaan *Common Random Numbers* (CRN) lintas 12 metode, serta perhitungan rerata, simpangan baku, CI 95%, dan perbandingan berpasangan (*paired comparison*).
3. **`test_J_and_K_api_contract_and_overhead_parameter`**: Memverifikasi kontrak HTTP `/api/v2/azbo/health`, `/api/v2/azbo/optimize`, dan `/api/v2/azbo/jobs` mengembalikan 12 strategi terurut beserta data animasi.
4. **`test_L_and_M_all_12_methods_sequence_rules_and_layout_compatibility`**: Memverifikasi secara spesifik aturan urutan `REVERSE_PYRAMID`, `STEFFEN`, `ROTATING_ZONES`, `MODIFIED_OPTIMAL`, `FRONT_TO_BACK`, `BLOCKS_4_ROWS` (termasuk pengujian eksak kabin 12 baris `9–12 -> 1–4 -> 5–8` sesuai Steffen & Hotchkiss, 2012), `DOUBLE_OUTSIDE_IN`, dan `BTF_WMA_FIXED`, serta memastikan ke-11 metode non-GA menghasilkan urutan antrean yang saling berbeda pada tata letak `3-3`, `2-3`, dan `2-2` (baik jumlah baris genap maupun ganjil).

---

## 5. Audit kesesuaian hasil optimasi (29 Oktober 2026)

- **K=1..N benar-benar diuji:** sebelum GA berevolusi, satu calon partisi diambil secara acak kondisional untuk SETIAP K=1..N dan fitness-nya dihitung pada seed TRAIN yang sama. Ini adalah *pemeriksaan cakupan*, bukan enumerasi seluruh potongan dan urutan zona untuk tiap K.
- **Anggaran evolusi:** `ga_population` (misalnya 14) tetap jumlah individu per generasi. Sebanyak N kandidat cakupan tambahan telah diperiksa dengan fungsi objektif yang sama; metadata `initial_k_coverage`, `initial_coverage_candidates_evaluated`, `initial_coverage_fitness_by_k_s`, `ga_population_requested` disimpan pada respons.
- **Tidak ada kebocoran hasil TEST ke GA:** fitness memakai TRAIN, sedangkan pemilihan metode akhir memakai TEST. Daftar seed keduanya tersedia sebagai `optimization.train_seeds` dan `optimization.test_seeds`.
- **Ekuivalensi metode:** pasangan dinyatakan identik hanya ketika urutan kursi persis sama pada SELURUH replikasi TEST yang digunakan, bukan pada satu seed saja. Ini bukan bukti kesamaan universal di semua kemungkinan seed dan konfigurasi.
- **Animasi:** satu replikasi TEST untuk pemenang dengan waktu paling dekat ke rerata sampel; metadata `animation.replication_index`, `replication_seed`, `sample_mean_s` membedakan satu lintasan nyata dari nilai rata-rata statistik.
- **Statistik:** CI 95% bersifat aproksimasi z=1,96 sesuai Blueprint, bukan kepastian pemenang. CI selisih berpasangan yang mencakup nol **bukan bukti kedua strategi setara**. Karena pemenang dipilih memakai sampel yang sama, terdapat risiko bias seleksi; gunakan replikasi tambahan atau uji konfirmasi untuk klaim kompetisi yang kuat.
- **Jumlah replikasi:** default frontend tetap 20 (eksploratif agar prototipe cukup responsif). Untuk audit hasil utama, set `VITE_AZBO_TEST_REPS=100` sebelum membangun frontend; dapat diuji dengan seed lebih dari satu. Biaya komputasinya akan meningkat.
- **Perbedaan literatur:** `BTF` versi ZoneFlow adalah pemanggilan per baris (bukan selalu 3 atau 4 blok); `WMA` diurutkan dari belakang ke depan *di dalam* kelas kursi (jurnal dapat mengacak kelas itu); `STEFFEN` adalah versi urutan posisi/paritas/sisi terprogram; `REVERSE_PYRAMID` memakai tiga segmen longitudinal sebagai adaptasi; `ROTATING_ZONES` memakai sampai lima zona seimbang; `BLOCKS_4_ROWS` pada kabin non-12 baris diadaptasi; `DOUBLE_OUTSIDE_IN` diadaptasi dari BWB; `BTF_WMA_FIXED` adalah baseline 3 zona ZoneFlow. Klaim yang tepat adalah **perbandingan varian strategi dalam model ZoneFlow**, bukan reproduksi tepat angka eksperimen semua jurnal.
- **Keterbatasan ilmiah yang belum dapat diperbaiki hanya lewat kode:** durasi empiris, kedisiplinan penumpang, laju rilis gate, ukuran bagasi, aturan pengumuman grup, waktu boarding bridge, kesesuaian desain fisik tiap pesawat, dan kapasitas overhead bin belum dikalibrasi. Model ini untuk analisis berbasis asumsi dan belum tervalidasi lapangan.
