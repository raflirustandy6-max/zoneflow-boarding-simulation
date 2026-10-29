# Audit & Perbaikan Validitas Optimasi — ZoneFlow versi 19

**Tanggal:** 29 Oktober 2026  
**Sumber proyek:** `zoneflow (19).zip`  
**Ruang lingkup:** kesesuaian algoritma optimasi, simulator, evaluasi metode, statistik, dan dokumentasi metode terhadap Blueprint/Audit serta jurnal yang dilampirkan; **bukan** validasi durasi boarding lapangan.

## 1. Hasil audit dan perbaikan yang dibuat

| Temuan pada ZIP versi 19 | Perbaikan di paket ini | Status |
|---|---|---|
| **GA tidak menjamin evaluasi K=1..30** pada populasi 14; pada contoh audit lama hanya sebagian K ditelusuri. Blueprint bagian 8 mewajibkan satu partisi random untuk setiap K sebagai pemeriksaan cakupan. | Tambah tahap `initial_k_coverage` yang mengevaluasi satu kromosom untuk SETIAP K=1..N pada seed training. K terbaik dari sweep dibawa ke evolusi, sedangkan `ga_population` tetap 14 untuk menahan biaya tiap generasi. | **Diperbaiki & diuji** |
| Perbandingan `equivalent_methods` hanya memakai urutan pada replikasi TEST pertama. | Pasangan dinyatakan ekuivalen hanya jika urutan kursi identik pada **semua** seed TEST yang benar-benar dipakai. | **Diperbaiki & diuji** |
| Seed TRAIN dan TEST ada secara internal tetapi tidak semuanya disertakan pada API hasil. | `optimization.train_seeds`, `optimization.test_seeds`, `initial_coverage_fitness_by_k_s`, dan ukuran cakupan tersedia untuk audit ulang. | **Diperbaiki & diuji** |
| Hasil animasi selalu mengambil replikasi pertama (dapat jauh dari rerata pemenang). | Trace dibangun ulang dari **replikasi TEST yang paling mendekati rerata** metode pemenang; diverifikasi ulang persis sama dengan waktu simulasi seed tersebut. `animation.sample_mean_s`, `replication_seed`, `replication_index`, `is_single_replication` menandai beda animasi tunggal vs rerata. | **Diperbaiki & diuji** |
| Pesan statistik bisa menyatakan “setara di lapangan” jika CI selisih meliputi nol. | Pesan diperbaiki: **belum cukup bukti perbedaan yang meyakinkan ≠ terbukti setara**. Hapus klaim kesetaraan dengan ambang 5 detik arbitrer. | **Diperbaiki** |
| Kontrol UI polling hanya ≈60 detik; studi 100 replikasi berpotensi dihentikan di UI sebelum backend selesai. | Polling sampai 900×1 detik, plus parameter jumlah TEST replikasi melalui environment (`VITE_AZBO_TEST_REPS`); versi default 20 tetap **eksploratif**. | **Diubah; integrasi browser belum diverifikasi** |
| Flag `azboWilmaEquivalenceVerified` di React TRUE ketika pasangan metode apa pun sama. | TRUE sekarang hanya jika pasangan yang terdeteksi benar-benar `ZONE` dan `WMA`. | **Diperbaiki dari kode; tes JS belum dijalankan** |
| Label kursi bawaan layout 3 kiri + 2 kanan dapat menghasilkan kursi `C` ganda sehingga kapasitas nama kursi tak unik. | Label default sisi kanan menjadi `D,E`; tambahkan validasi label per baris unik dan panjang daftar huruf benar. | **Diperbaiki & diuji** |
| **Referensi jurnal salah:** penulis, judul, bahkan deskripsi metode pada bibliografi `DOKUMENTASI_METODE_JURNAL.md` versi 19 tidak cocok dengan PDF aslinya. | Cocokkan penulis/judul/artikel dengan halaman pertama keempat PDF dan dokumentasikan adaptasi metode. | **Diperbaiki** |

## 2. Pengecekan algoritma sesuai Blueprint

- **Representasi zona:** `K=1+sum(cuts)`, batas zona kontigu dan nonkosong; aturan internal `WMA_IN_ZONE` atau `BTF_IN_ZONE` dan prioritas pemanggilan merupakan bagian kromosom.
- **Fungsi tujuan:** rerata waktu boarding beberapa replikasi *training*, bukan target tetap/tabel hardcoded.
- **GA:** heuristik dengan seleksi turnamen, crossover, mutasi, elitisme, cache signature. Pencarian hanya mendekati konfigurasi yang baik; **bukan** enumerasi optimum global untuk N=30.
- **K=1..N:** setiap K diperiksa lewat **satu partisi acak** pada tahap audit awal. Ini tidak menjamin semua konfigurasi zona telah dicoba; bukan optimum dalam setiap K.
- **Common Random Numbers:** setiap metode memakai profil penumpang yang sama untuk seed TEST tertentu; seed TRAIN/TEST disimpan, dipisahkan, dan bisa direproduksi.
- **Statistik:** mean/SD/CI95 aproksimasi, paired difference, dan urutan ranking berasal dari hasil TEST. CI95 sederhana dan pemenang hasil seleksi sampel tetap harus ditafsirkan hati-hati.
- **Animasi:** event trace Python dari 1 replikasi TEST nyata; tidak sama definisinya dengan rerata banyak replikasi.

## 3. Pemeriksaan nyata: 180 kursi, 12 metode, R TEST=100

Konfigurasi diagnostik: 30 baris × 3-3, 180 penumpang, proporsi pembawa bagasi 60%, seed dasar `20261029`, `ga_population=14`, `ga_generations=3`, `train_reps=3`, `test_reps=100`, pengumuman grup overhead 0,0 detik. Hasil ini **hanya contoh dari model** (parameter eksploratif) dan tidak boleh disalin sebagai durasi kenyataan.

| Urutan pada uji ini | Metode | Mean (detik) | SD (detik) |
|---:|---|---:|---:|
| 1 | WMA | 280,530 | 17,092 |
| 2 | Reverse Pyramid | 351,967 | 22,384 |
| 3 | Modified Optimal | 372,570 | 23,341 |
| 4 | Zone-Based AZBO | 415,808 | 26,065 |
| 5 | Back-to-Front + WMA Fixed Zones | 425,517 | 29,078 |
| 6–12 | Lihat JSON untuk tujuh metode lain | — | — |

- Nilai K yang dicakup: **1,2,...,30 (30 nilai)**, bukan 14 nilai saja.
- Semua **12 metode** menghasilkan hasil dan peringkat.
- Trace animasi pemenang memakai replikasi TEST yang waktunya **280,75 detik**, paling dekat dengan rerata **280,53 detik**; keduanya adalah besaran berbeda.
- Rincian seed, statistik setiap metode dan metadata konfigurasi disimpan dalam `CONTOH_DIAGNOSTIK_180_100REPLIKASI.json`.
- Perbandingan ini menggunakan **3 generasi GA diagnostik**, sedangkan konfigurasi UI saat ini memakai 8 generasi; peringkat dan best K bisa berubah pada GA dengan anggaran yang berbeda.

### Pemeriksaan kestabilan terhadap tiga seed tambahan (20 TEST replikasi)

Untuk konfigurasi kabin dan bagasi yang sama, tetapi *seed* dasar **101, 202, dan 303**, dengan 14 individu GA, 3 generasi, 3 TRAIN replikasi, dan 20 TEST replikasi:

| Seed | K zona terbaik yang ditemukan GA | Rekomendasi berdasarkan rerata | Mean rekomendasi (detik) | Mean ZONE (detik) |
|---:|---:|---|---:|---:|
| 101 | 1 | WMA | 288,050 | 288,050 |
| 202 | 2 | WMA | 281,100 | 330,688 |
| 303 | 1 | WMA | 279,850 | 279,850 |

Setiap seed mengevaluasi semua K=1..30 pada pemeriksaan cakupan. Ini membuktikan eksekusi deterministik dan menunjukkan bahwa pilihan konfigurasi GA **dapat berbeda antar-seed**, tetapi **tidak** membuktikan kesetaraan durasi empiris maupun generalisasi universal bahwa WMA selalu tercepat. Lihat `CONTOH_MULTI_SEED_180_20REPLIKASI.json`.

## 4. Kesesuaian dengan jurnal — batas klaim yang perlu dijaga

**Berdasarkan halaman pertama PDF yang diberikan pengguna**, referensi bibliografi di proyek versi 19 memuat kesalahan yang diperbaiki pada `DOKUMENTASI_METODE_JURNAL.md`:

1. Possamai Viertel, Pessini, Secomandi, Cavion, Hedler Staudt (2025): *Boarding Efficiency in Regional Aviation: A Comparative Analysis of Methods*.
2. Płanda & Skorupski (2025): *Model for Evaluation of Aircraft Boarding Under Disturbances*, **Aerospace, 12(5), 403**.
3. Gehlen & Ronzani (2025): *Setting Airport Boarding Strategies Based on Passengers’ Operational Data through Machine Learning Techniques*.
4. Dong, Jia, Yanagisawa, Nishinari (2025): *Boarding strategies accounting for properties of the blended wing body aircraft*, **Physica A, 658, 130298**.

Metode Reverse Pyramid, Steffen, Rotating Zones, Four-Row Blocks, dan Double Outside-In merupakan **implementasi aturan atau adaptasi ZoneFlow**; pembagian kelompok (misalnya tiga segmen, lima zona, split kabin) tidak selalu identik dengan semua protokol pada jurnal. Perbandingan yang dapat dipertanggungjawabkan adalah **perbandingan varian metode dalam model yang seragam**, bukan replikasi angka hasil penulis artikel.

## 5. Yang masih perlu diuji sebelum kesimpulan esai utama

- Uji lebih dari satu **seed dasar** (stabilitas GA/rekomendasi), bukan satu contoh benchmark.
- Untuk studi utama, set `VITE_AZBO_TEST_REPS=100` sebelum frontend dibangun; bandingkan presisi CI berpasangan dan pertimbangkan uji konfirmasi independen atas metode pemenang untuk menghindari bias seleksi.
- Audit perbandingan diagram/aturan Steffen dan Reverse Pyramid terhadap referensi primer; hindari klaim implementasi *identik* jika berupa adaptasi.
- Lakukan pengujian `npm ci`, `npm run lint`, `npm run build`, dan end-to-end browser di komputer/Google AI Studio dengan jaringan aktif. Audit ini tak berhasil memasang seluruh dependensi offline.
- Publikasikan backend Python FastAPI secara terpisah dari GitHub Pages bila simulasi hendak digunakan melalui web publik.
- Penyetelan parameter geometri, frekuensi rilis penumpang, waktu bagasi dan seat interference masih eksploratif; bukan objek perbaikan pada audit algoritma kali ini.

**Kesimpulan:** kerangka GA+simulasi kini lebih setia pada syarat struktural Blueprint dan dapat diaudit; tetap tidak ada jaminan optimum global atau pembuktian bahwa ranking contoh sama pada setiap seed/pesawat.
