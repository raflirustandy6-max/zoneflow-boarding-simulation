# PANDUAN TIM AZBO V2 — AIRCRAFT ZONE-BASED BOARDING OPTIMIZATION
**Kompetisi Esai Ilmiah LOGIKA UI 2026 — Subtema Teknologi Komputasi**

Dokumen ini menjadi panduan teknis dan ilmiah bagi tim pengembang dan peneliti **ZoneFlow** dalam memahami arsitektur prototipe final **AZBO V2**.

---

## 1. Konsep Fundamental AZBO

**AZBO (*Aircraft Zone-Based Boarding Optimization*)** adalah **kerangka optimasi berbasis simulasi komputasi** untuk mencari dan merekomendasikan strategi boarding pesawat lorong tunggal (*single-aisle*) yang menghasilkan estimasi rata-rata waktu boarding terendah pada kondisi penerbangan tertentu $\theta$.

Prinsip ilmiah utama yang dikunci pada sistem ini:
1. **Bukan Metode Boarding Tunggal**: AZBO bukan satu metode boarding tetap yang kaku dan tidak diklaim selalu mengalahkan *Window-Middle-Aisle* (WMA), *Back-to-Front* (BTF), atau *Random* di setiap skenario.
2. **Rekomendasi Kondisional terhadap $\theta$**: Rekomendasi bergantung pada spesifikasi kabin $L$, kapasitas penuh $n$, proporsi pembawa bagasi $\rho_b$, dan parameter pergerakan fisik $p_{\text{sim}}$.
3. **Kejujuran Metaheuristik**: *Genetic Algorithm* (GA) mengevaluasi ruang kandidat pembagian zona secara stokastik dan menemukan solusi terbaik di antara kandidat yang dievaluasi — bukan jaminan *global optimum* matematis absolut.

---

## 2. Asumsi Penelitian yang Dikunci

| Asumsi | Rumusan Matematis / Nilai | Implementasi Kode (`backend/app/azbo_core.py`) |
| :--- | :--- | :--- |
| **Okupansi Kursi ($\rho_o$)** | Selalu **100% penuh** ($\rho_o = 1$). Jumlah penumpang $n = N \times S_{\text{row}}$ mengikuti kapasitas penuh pesawat. | `CabinSpec.capacity = rows * (left_seats + right_seats)` |
| **Proporsi Pembawa Bagasi ($\rho_b$)** | Input deterministik pengguna ($0\% \le \rho_b \le 100\%$). Jumlah pembawa bagasi deterministik: $n_b = \lfloor n \cdot \rho_b + 0.5 \rfloor$. | `CabinSpec.baggage_passenger_count` |
| **Identitas Pembawa Bagasi** | Siapa penumpang yang membawa bagasi diacak pada setiap replikasi $r$, dengan jumlah total tetap $n_b$. | `generate_replication_passengers(spec, seed)` |
| **Jumlah Zona ($K$)** | Variabel keputusan $K \in \{1, 2, \dots, N\}$ dari vektor biner pemotongan $c \in \{0,1\}^{N-1}$ dengan $K(c) = 1 + \sum_{j=1}^{N-1} c_j$. | `ZoneChromosome.cuts`, `decode_zones_from_cuts` |
| **Pembangkitan Awal $K$** | $K \sim \text{UniformDiscrete}(1, N)$ dengan $P(K=k) = 1/N$, lalu dipilih $K-1$ titik potong berbeda tanpa pengembalian. | `sample_random_chromosome_uniform_k` |

---

## 3. Distribusi Probabilitas & Parameter Fisik Simulator

1. **Kecepatan Jalan Bebas ($V$)**:
   - $V \sim \text{Normal}(\mu = 0.8\text{ m/s}, \sigma = 0.1\text{ m/s})$ dipotong pada $0 < V \le 0.8\text{ m/s}$ (*Truncated Normal*).
   - Disampling satu kali per penumpang per replikasi.
2. **Waktu Menyimpan Bagasi Kabin ($T_{\text{stow}}$)**:
   - $T_{\text{stow}} \sim \text{Weibull}(\alpha = 1.7, \beta = 16.0\text{ detik})$ bagi penumpang dengan `has_bag = True`.
   - $T_{\text{stow}} = 0\text{ detik}$ bagi penumpang tanpa bagasi kabin.
3. **Waktu Pergerakan Masuk Kursi ($T_{\text{seat}}$)**:
   - Setiap gerakan keluar-masuk kursi berdurasi $\text{Triangular}(\min = 1.8\text{ dtk}, \text{mode} = 2.4\text{ dtk}, \max = 3.0\text{ dtk})$.
   - Jumlah gerakan ditentukan oleh jumlah penghalang yang sudah duduk di sisi baris yang sama ($1, 5, \text{atau } 9$ gerakan). Tidak ada penghitungan ganda (*double counting*) waktu duduk dasar.
4. **Simulator Sel Lorong Diskrit (*Discrete-Time Cellular Aisle*)**:
   - Panjang sel lorong `cell_m = 0.4 m`, jarak antarbaris `row_pitch_m = 0.8 m` (2 sel per baris), langkah waktu `dt = 0.25 dtk`.
   - Setiap sel paling banyak ditempati 1 penumpang, tidak ada salip-menyalip (*no overtaking*), dan penumpang baru membebaskan sel lorong setelah selesai menyimpan bagasi dan duduk di kursinya.

---

## 4. Arsitektur Single Source of Truth (Python FastAPI + React)

- **Backend Python (`backend/app/azbo_core.py` & `backend/app/azbo_v2_routes.py`)** adalah **satu-satunya sumber perhitungan** simulasi, optimasi GA, statistik evaluasi 2-tahap (Training + Testing CRN), dan perekaman *event trace*.
- **Frontend React (`src/services/azboV2Client.ts` & `src/views/AzboV2Pages.tsx`)** berkomunikasi langsung dengan `/api/v2/azbo/*` dan tidak pernah diam-diam mengganti hasil rekomendasi dengan simulator lokal TypeScript apabila backend Python mati.
