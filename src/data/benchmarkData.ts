export interface BenchmarkSummaryItem {
  baggage_percent: number;
  method: string;
  n: number;
  mean_minutes: number;
  std_minutes: number;
  rank_within_baggage: number;
}

export interface WinnerItem {
  baggage_percent: number;
  method: string;
  mean_minutes: number;
}

export interface PairedComparisonItem {
  baggage_percent: number;
  comparison: string;
  mean_difference_seconds: number;
  median_difference_seconds: number;
  ci95_low_seconds: number;
  ci95_high_seconds: number;
  fraction_GA_faster: number;
  n_pairs: number;
}

export interface MethodCatalogItem {
  method_id: string;
  method_name: string;
  aliases: string;
  method_type: string;
  rule_from_pdf: string;
  group_or_sequence: string;
  aircraft_scope_in_source: string;
  evidence_summary: string;
  implementation_notes: string;
  source_ids: string;
  evidence_status: string;
}

export interface StudyResultItem {
  result_id: string;
  study_id: string;
  aircraft_scope: string;
  condition: string;
  method: string;
  metric: string;
  value: string;
  unit: string;
  finding: string;
  caveat: string;
}

export interface SimulationParamItem {
  parameter_id: string;
  parameter_name: string;
  value_min?: string;
  value_max?: string;
  value_or_levels: string;
  unit: string;
  source_id: string;
  source_context: string;
  implementation_note: string;
}

export interface LiteratureSourceItem {
  source_id: string;
  authors: string;
  year: number;
  title: string;
  publication: string;
  doi_or_url?: string;
  source_use: string;
  bibliographic_note: string;
}

export interface ColumnDictItem {
  file_name: string;
  column_name: string;
  meaning: string;
}

// 1. Data Ringkasan Benchmark (36 baris tepat dari output tersimpan)
export const RINGKASAN_BENCHMARK: BenchmarkSummaryItem[] = [
  { baggage_percent: 50, method: "Back-to-Front-WILMA", n: 100, mean_minutes: 4.44, std_minutes: 0.25, rank_within_baggage: 1.0 },
  { baggage_percent: 50, method: "Reverse Pyramid (approximation)", n: 100, mean_minutes: 4.637, std_minutes: 0.262, rank_within_baggage: 2.0 },
  { baggage_percent: 50, method: "Exhaustive-Zone-WMA", n: 100, mean_minutes: 4.815, std_minutes: 0.269, rank_within_baggage: 3.0 },
  { baggage_percent: 50, method: "GA-Zone-WMA", n: 100, mean_minutes: 4.815, std_minutes: 0.269, rank_within_baggage: 3.0 },
  { baggage_percent: 50, method: "Fixed-Zone-WMA", n: 100, mean_minutes: 4.866, std_minutes: 0.27, rank_within_baggage: 5.0 },
  { baggage_percent: 50, method: "Back-to-Front", n: 100, mean_minutes: 5.098, std_minutes: 0.297, rank_within_baggage: 6.0 },
  { baggage_percent: 50, method: "Outside-In/WMA", n: 100, mean_minutes: 5.15, std_minutes: 0.279, rank_within_baggage: 7.0 },
  { baggage_percent: 50, method: "Modified Optimal (implementation variant)", n: 100, mean_minutes: 6.432, std_minutes: 0.395, rank_within_baggage: 8.0 },
  { baggage_percent: 50, method: "Steffen (staggered-row implementation)", n: 100, mean_minutes: 7.059, std_minutes: 0.406, rank_within_baggage: 9.0 },
  { baggage_percent: 50, method: "Random", n: 100, mean_minutes: 11.982, std_minutes: 0.909, rank_within_baggage: 10.0 },
  { baggage_percent: 50, method: "Rotating Zones", n: 100, mean_minutes: 19.252, std_minutes: 1.186, rank_within_baggage: 11.0 },
  { baggage_percent: 50, method: "Front-to-Back", n: 100, mean_minutes: 52.824, std_minutes: 1.928, rank_within_baggage: 12.0 },

  { baggage_percent: 60, method: "Back-to-Front-WILMA", n: 100, mean_minutes: 4.645, std_minutes: 0.255, rank_within_baggage: 1.0 },
  { baggage_percent: 60, method: "Reverse Pyramid (approximation)", n: 100, mean_minutes: 4.809, std_minutes: 0.261, rank_within_baggage: 2.0 },
  { baggage_percent: 60, method: "Exhaustive-Zone-WMA", n: 100, mean_minutes: 4.978, std_minutes: 0.253, rank_within_baggage: 3.0 },
  { baggage_percent: 60, method: "GA-Zone-WMA", n: 100, mean_minutes: 4.978, std_minutes: 0.253, rank_within_baggage: 3.0 },
  { baggage_percent: 60, method: "Fixed-Zone-WMA", n: 100, mean_minutes: 5.031, std_minutes: 0.277, rank_within_baggage: 5.0 },
  { baggage_percent: 60, method: "Back-to-Front", n: 100, mean_minutes: 5.321, std_minutes: 0.272, rank_within_baggage: 6.0 },
  { baggage_percent: 60, method: "Outside-In/WMA", n: 100, mean_minutes: 5.328, std_minutes: 0.283, rank_within_baggage: 7.0 },
  { baggage_percent: 60, method: "Modified Optimal (implementation variant)", n: 100, mean_minutes: 6.793, std_minutes: 0.39, rank_within_baggage: 8.0 },
  { baggage_percent: 60, method: "Steffen (staggered-row implementation)", n: 100, mean_minutes: 7.49, std_minutes: 0.42, rank_within_baggage: 9.0 },
  { baggage_percent: 60, method: "Random", n: 100, mean_minutes: 12.583, std_minutes: 0.938, rank_within_baggage: 10.0 },
  { baggage_percent: 60, method: "Rotating Zones", n: 100, mean_minutes: 21.603, std_minutes: 1.418, rank_within_baggage: 11.0 },
  { baggage_percent: 60, method: "Front-to-Back", n: 100, mean_minutes: 57.214, std_minutes: 1.923, rank_within_baggage: 12.0 },

  { baggage_percent: 70, method: "Back-to-Front-WILMA", n: 100, mean_minutes: 4.763, std_minutes: 0.271, rank_within_baggage: 1.0 },
  { baggage_percent: 70, method: "Reverse Pyramid (approximation)", n: 100, mean_minutes: 4.95, std_minutes: 0.277, rank_within_baggage: 2.0 },
  { baggage_percent: 70, method: "Exhaustive-Zone-WMA", n: 100, mean_minutes: 5.124, std_minutes: 0.268, rank_within_baggage: 3.0 },
  { baggage_percent: 70, method: "GA-Zone-WMA", n: 100, mean_minutes: 5.124, std_minutes: 0.268, rank_within_baggage: 3.0 },
  { baggage_percent: 70, method: "Fixed-Zone-WMA", n: 100, mean_minutes: 5.151, std_minutes: 0.285, rank_within_baggage: 5.0 },
  { baggage_percent: 70, method: "Back-to-Front", n: 100, mean_minutes: 5.413, std_minutes: 0.256, rank_within_baggage: 6.0 },
  { baggage_percent: 70, method: "Outside-In/WMA", n: 100, mean_minutes: 5.45, std_minutes: 0.283, rank_within_baggage: 7.0 },
  { baggage_percent: 70, method: "Modified Optimal (implementation variant)", n: 100, mean_minutes: 7.07, std_minutes: 0.398, rank_within_baggage: 8.0 },
  { baggage_percent: 70, method: "Steffen (staggered-row implementation)", n: 100, mean_minutes: 7.736, std_minutes: 0.384, rank_within_baggage: 9.0 },
  { baggage_percent: 70, method: "Random", n: 100, mean_minutes: 13.064, std_minutes: 0.888, rank_within_baggage: 10.0 },
  { baggage_percent: 70, method: "Rotating Zones", n: 100, mean_minutes: 23.472, std_minutes: 1.283, rank_within_baggage: 11.0 },
  { baggage_percent: 70, method: "Front-to-Back", n: 100, mean_minutes: 61.606, std_minutes: 2.008, rank_within_baggage: 12.0 },
];

// 2. Pemenang Per Tingkat Bagasi
export const PEMENANG_PER_TINGKAT_BAGASI: WinnerItem[] = [
  { baggage_percent: 50, method: "Back-to-Front-WILMA", mean_minutes: 4.44 },
  { baggage_percent: 60, method: "Back-to-Front-WILMA", mean_minutes: 4.645 },
  { baggage_percent: 70, method: "Back-to-Front-WILMA", mean_minutes: 4.763 },
];

// 3. Perbandingan Berpasangan GA
export const PERBANDINGAN_BERPASANGAN_GA: PairedComparisonItem[] = [
  // 50%
  { baggage_percent: 50, comparison: "GA-Zone-WMA minus Back-to-Front", mean_difference_seconds: -16.99, median_difference_seconds: -15.962, ci95_low_seconds: -20.642, ci95_high_seconds: -13.338, fraction_GA_faster: 0.85, n_pairs: 100 },
  { baggage_percent: 50, comparison: "GA-Zone-WMA minus Back-to-Front-WILMA", mean_difference_seconds: 22.464, median_difference_seconds: 22.087, ci95_low_seconds: 19.598, ci95_high_seconds: 25.33, fraction_GA_faster: 0.0, n_pairs: 100 },
  { baggage_percent: 50, comparison: "GA-Zone-WMA minus Exhaustive-Zone-WMA", mean_difference_seconds: 0.0, median_difference_seconds: 0.0, ci95_low_seconds: 0.0, ci95_high_seconds: 0.0, fraction_GA_faster: 0.0, n_pairs: 100 },
  { baggage_percent: 50, comparison: "GA-Zone-WMA minus Fixed-Zone-WMA", mean_difference_seconds: -3.043, median_difference_seconds: 0.0, ci95_low_seconds: -5.876, ci95_high_seconds: -0.211, fraction_GA_faster: 0.47, n_pairs: 100 },
  { baggage_percent: 50, comparison: "GA-Zone-WMA minus Front-to-Back", mean_difference_seconds: -2880.535, median_difference_seconds: -2897.303, ci95_low_seconds: -2902.839, ci95_high_seconds: -2858.232, fraction_GA_faster: 1.0, n_pairs: 100 },
  { baggage_percent: 50, comparison: "GA-Zone-WMA minus Modified Optimal", mean_difference_seconds: -97.037, median_difference_seconds: -95.514, ci95_low_seconds: -101.958, ci95_high_seconds: -92.116, fraction_GA_faster: 1.0, n_pairs: 100 },
  { baggage_percent: 50, comparison: "GA-Zone-WMA minus Outside-In/WMA", mean_difference_seconds: -20.108, median_difference_seconds: -19.647, ci95_low_seconds: -22.672, ci95_high_seconds: -17.543, fraction_GA_faster: 0.92, n_pairs: 100 },
  { baggage_percent: 50, comparison: "GA-Zone-WMA minus Random", mean_difference_seconds: -430.021, median_difference_seconds: -428.473, ci95_low_seconds: -441.15, ci95_high_seconds: -418.892, fraction_GA_faster: 1.0, n_pairs: 100 },
  { baggage_percent: 50, comparison: "GA-Zone-WMA minus Reverse Pyramid", mean_difference_seconds: 10.692, median_difference_seconds: 9.141, ci95_low_seconds: 8.004, ci95_high_seconds: 13.381, fraction_GA_faster: 0.05, n_pairs: 100 },
  { baggage_percent: 50, comparison: "GA-Zone-WMA minus Rotating Zones", mean_difference_seconds: -866.211, median_difference_seconds: -862.13, ci95_low_seconds: -879.955, ci95_high_seconds: -852.467, fraction_GA_faster: 1.0, n_pairs: 100 },
  { baggage_percent: 50, comparison: "GA-Zone-WMA minus Steffen", mean_difference_seconds: -134.634, median_difference_seconds: -136.259, ci95_low_seconds: -139.125, ci95_high_seconds: -130.143, fraction_GA_faster: 1.0, n_pairs: 100 },

  // 60%
  { baggage_percent: 60, comparison: "GA-Zone-WMA minus Back-to-Front", mean_difference_seconds: -20.552, median_difference_seconds: -20.794, ci95_low_seconds: -23.598, ci95_high_seconds: -17.506, fraction_GA_faster: 0.93, n_pairs: 100 },
  { baggage_percent: 60, comparison: "GA-Zone-WMA minus Back-to-Front-WILMA", mean_difference_seconds: 20.036, median_difference_seconds: 20.407, ci95_low_seconds: 17.457, ci95_high_seconds: 22.615, fraction_GA_faster: 0.0, n_pairs: 100 },
  { baggage_percent: 60, comparison: "GA-Zone-WMA minus Exhaustive-Zone-WMA", mean_difference_seconds: 0.0, median_difference_seconds: 0.0, ci95_low_seconds: 0.0, ci95_high_seconds: 0.0, fraction_GA_faster: 0.0, n_pairs: 100 },
  { baggage_percent: 60, comparison: "GA-Zone-WMA minus Fixed-Zone-WMA", mean_difference_seconds: -3.149, median_difference_seconds: -0.355, ci95_low_seconds: -5.943, ci95_high_seconds: -0.355, fraction_GA_faster: 0.54, n_pairs: 100 },
  { baggage_percent: 60, comparison: "GA-Zone-WMA minus Front-to-Back", mean_difference_seconds: -3134.133, median_difference_seconds: -3137.66, ci95_low_seconds: -3156.25, ci95_high_seconds: -3112.016, fraction_GA_faster: 1.0, n_pairs: 100 },
  { baggage_percent: 60, comparison: "GA-Zone-WMA minus Modified Optimal", mean_difference_seconds: -108.858, median_difference_seconds: -107.247, ci95_low_seconds: -113.273, ci95_high_seconds: -104.443, fraction_GA_faster: 1.0, n_pairs: 100 },
  { baggage_percent: 60, comparison: "GA-Zone-WMA minus Outside-In/WMA", mean_difference_seconds: -20.951, median_difference_seconds: -19.1, ci95_low_seconds: -23.701, ci95_high_seconds: -18.201, fraction_GA_faster: 0.96, n_pairs: 100 },
  { baggage_percent: 60, comparison: "GA-Zone-WMA minus Random", mean_difference_seconds: -456.261, median_difference_seconds: -450.377, ci95_low_seconds: -467.373, ci95_high_seconds: -445.149, fraction_GA_faster: 1.0, n_pairs: 100 },
  { baggage_percent: 60, comparison: "GA-Zone-WMA minus Reverse Pyramid", mean_difference_seconds: 10.176, median_difference_seconds: 7.147, ci95_low_seconds: 7.985, ci95_high_seconds: 12.367, fraction_GA_faster: 0.03, n_pairs: 100 },
  { baggage_percent: 60, comparison: "GA-Zone-WMA minus Rotating Zones", mean_difference_seconds: -997.453, median_difference_seconds: -1003.895, ci95_low_seconds: -1012.615, ci95_high_seconds: -982.29, fraction_GA_faster: 1.0, n_pairs: 100 },
  { baggage_percent: 60, comparison: "GA-Zone-WMA minus Steffen", mean_difference_seconds: -150.666, median_difference_seconds: -149.966, ci95_low_seconds: -155.164, ci95_high_seconds: -146.168, fraction_GA_faster: 1.0, n_pairs: 100 },

  // 70%
  { baggage_percent: 70, comparison: "GA-Zone-WMA minus Back-to-Front", mean_difference_seconds: -17.336, median_difference_seconds: -16.029, ci95_low_seconds: -20.581, ci95_high_seconds: -14.091, fraction_GA_faster: 0.85, n_pairs: 100 },
  { baggage_percent: 70, comparison: "GA-Zone-WMA minus Back-to-Front-WILMA", mean_difference_seconds: 21.629, median_difference_seconds: 20.718, ci95_low_seconds: 18.629, ci95_high_seconds: 24.628, fraction_GA_faster: 0.0, n_pairs: 100 },
  { baggage_percent: 70, comparison: "GA-Zone-WMA minus Exhaustive-Zone-WMA", mean_difference_seconds: 0.0, median_difference_seconds: 0.0, ci95_low_seconds: 0.0, ci95_high_seconds: 0.0, fraction_GA_faster: 0.0, n_pairs: 100 },
  { baggage_percent: 70, comparison: "GA-Zone-WMA minus Fixed-Zone-WMA", mean_difference_seconds: -1.659, median_difference_seconds: 0.0, ci95_low_seconds: -4.013, ci95_high_seconds: 0.694, fraction_GA_faster: 0.49, n_pairs: 100 },
  { baggage_percent: 70, comparison: "GA-Zone-WMA minus Front-to-Back", mean_difference_seconds: -3388.922, median_difference_seconds: -3386.242, ci95_low_seconds: -3411.377, ci95_high_seconds: -3366.467, fraction_GA_faster: 1.0, n_pairs: 100 },
  { baggage_percent: 70, comparison: "GA-Zone-WMA minus Modified Optimal", mean_difference_seconds: -116.802, median_difference_seconds: -116.359, ci95_low_seconds: -121.391, ci95_high_seconds: -112.212, fraction_GA_faster: 1.0, n_pairs: 100 },
  { baggage_percent: 70, comparison: "GA-Zone-WMA minus Outside-In/WMA", mean_difference_seconds: -19.589, median_difference_seconds: -18.954, ci95_low_seconds: -22.07, ci95_high_seconds: -17.108, fraction_GA_faster: 0.95, n_pairs: 100 },
  { baggage_percent: 70, comparison: "GA-Zone-WMA minus Random", mean_difference_seconds: -476.392, median_difference_seconds: -484.04, ci95_low_seconds: -486.041, ci95_high_seconds: -466.744, fraction_GA_faster: 1.0, n_pairs: 100 },
  { baggage_percent: 70, comparison: "GA-Zone-WMA minus Reverse Pyramid", mean_difference_seconds: 10.443, median_difference_seconds: 10.263, ci95_low_seconds: 8.18, ci95_high_seconds: 12.705, fraction_GA_faster: 0.05, n_pairs: 100 },
  { baggage_percent: 70, comparison: "GA-Zone-WMA minus Rotating Zones", mean_difference_seconds: -1100.903, median_difference_seconds: -1101.499, ci95_low_seconds: -1114.929, ci95_high_seconds: -1086.878, fraction_GA_faster: 1.0, n_pairs: 100 },
  { baggage_percent: 70, comparison: "GA-Zone-WMA minus Steffen", mean_difference_seconds: -156.706, median_difference_seconds: -158.485, ci95_low_seconds: -161.02, ci95_high_seconds: -152.391, fraction_GA_faster: 1.0, n_pairs: 100 },
];

// 4. Inventaris Metode Boarding
export const INVENTARIS_METODE: MethodCatalogItem[] = [
  {
    method_id: "MB01",
    method_name: "Random",
    aliases: "Random boarding",
    method_type: "Strategi urutan boarding dasar",
    rule_from_pdf: "Penumpang masuk menurut urutan kedatangan/antrean tanpa memperhatikan nomor kursi.",
    group_or_sequence: "Tidak ada pengelompokan berdasarkan baris atau posisi kursi; urutan dibuat acak/berdasarkan kedatangan.",
    aircraft_scope_in_source: "Metode pembanding umum; pada studi regional diuji pada ATR 72, A220, dan A320.",
    evidence_summary: "Digunakan sebagai salah satu dari enam metode pembanding dalam studi boarding pesawat regional.",
    implementation_notes: "Tetapkan seed random untuk replikasi yang dapat diulang. Untuk membandingkan metode, gunakan kondisi penumpang dan parameter simulasi yang setara.",
    source_ids: "SRC01; SRC09; SRC10",
    evidence_status: "Didefinisikan langsung dalam PDF",
  },
  {
    method_id: "MB02",
    method_name: "Back-to-Front",
    aliases: "BTF; Back-to-front",
    method_type: "Strategi urutan boarding dasar",
    rule_from_pdf: "Penumpang pada baris paling jauh dari pintu masuk naik lebih dahulu, lalu berlanjut berurutan menuju baris yang lebih dekat ke depan.",
    group_or_sequence: "Urutkan baris dari belakang pesawat ke depan; definisi PDF tidak menetapkan aturan pemecah seri dalam baris yang sama.",
    aircraft_scope_in_source: "Metode pembanding umum; diuji pada ATR 72, A220, dan A320 dalam studi regional. Dampak meningkat saat load factor > 0.5 di model BWB.",
    evidence_summary: "Waktu boarding meningkat tajam bila terjadi penumpukan di lorong tanpa pengurutan posisi kursi.",
    implementation_notes: "Tetapkan urutan kursi dalam baris secara eksplisit. Jangan menyimpulkan BTF selalu buruk/baik dari satu konfigurasi studi.",
    source_ids: "SRC01; SRC02; SRC09; SRC10",
    evidence_status: "Didefinisikan langsung dalam PDF",
  },
  {
    method_id: "MB03",
    method_name: "Outside-In",
    aliases: "WMA; WilMA; Window-Middle-Aisle",
    method_type: "Strategi urutan boarding dasar",
    rule_from_pdf: "Prioritaskan penumpang kursi dekat jendela, lalu kursi tengah, kemudian kursi lorong.",
    group_or_sequence: "Kelompok berdasarkan posisi kursi: window -> middle -> aisle. Dalam baris/kelompok yang sama, aturan tambahan perlu ditentukan.",
    aircraft_scope_in_source: "Metode pembanding umum; diuji pada ATR 72, A220, dan A320. Hasil berbeda menurut tipe pesawat dan proporsi bagasi.",
    evidence_summary: "Pada studi regional, WMA paling efektif mengurangi aisle dan seat interference dalam eksperimen tersebut.",
    implementation_notes: "Pada konfigurasi 2-2 tidak ada kursi tengah; sesuaikan pemetaan kategori kursi dengan tata letak kabin.",
    source_ids: "SRC01; SRC03; SRC09; SRC10",
    evidence_status: "Didefinisikan langsung dalam PDF",
  },
  {
    method_id: "MB04",
    method_name: "Reverse Pyramid",
    aliases: "Reverse-pyramid boarding",
    method_type: "Kombinasi aturan baris dan posisi kursi",
    rule_from_pdf: "Menggabungkan Back-to-Front dengan Outside-In: penumpang kursi jendela di bagian belakang naik lebih dahulu; kursi lorong baris depan belakangan.",
    group_or_sequence: "Prioritas gabungan dari belakang ke depan dan dari window ke aisle.",
    aircraft_scope_in_source: "Diuji pada ATR 72, A220, dan A320 dalam studi regional.",
    evidence_summary: "Rata-rata terendah secara keseluruhan dalam studi regional yang diringkas adalah 3.53 ticks per penumpang.",
    implementation_notes: "Definisikan bagaimana prioritas baris dan kelas kursi digabungkan (aproksimasi v3; bukan algoritma asli berbayar).",
    source_ids: "SRC01; SRC10",
    evidence_status: "Didefinisikan langsung dalam PDF",
  },
  {
    method_id: "MB05",
    method_name: "Rotating Zones",
    aliases: "Rotating Blocks; Blocks",
    method_type: "Strategi berbasis zona/baris",
    rule_from_pdf: "Boarding dilakukan per zona: mulai dari baris paling belakang, lalu bagian paling depan; kemudian zona bergerak dari kedua ujung menuju tengah.",
    group_or_sequence: "Bagi kabin menjadi blok/zona (misal 6 zona) dan urutkan dari kedua ekstrem menuju tengah.",
    aircraft_scope_in_source: "Diuji pada ATR 72, A220, dan A320 dalam studi regional.",
    evidence_summary: "Rata-rata paling lambat di antara enam metode pada studi regional yang diringkas (4.68 ticks per penumpang).",
    implementation_notes: "Jumlah zona dan batas baris harus dicatat sebagai parameter model agar bisa dibandingkan secara adil.",
    source_ids: "SRC01; SRC10; SRC15",
    evidence_status: "Didefinisikan langsung dalam PDF; detail parameterisasi perlu ditetapkan",
  },
  {
    method_id: "MB06",
    method_name: "Modified Optimal",
    aliases: "Modified-optimal method",
    method_type: "Strategi kelompok baris dan sisi kabin",
    rule_from_pdf: "Kelompok 1: baris genap sisi kiri; Kelompok 2: baris genap sisi kanan; Kelompok 3: baris ganjil sisi kiri; Kelompok 4: baris ganjil sisi kanan.",
    group_or_sequence: "Empat grup berurutan berdasarkan paritas baris dan sisi kabin; aturan di dalam grup adalah konvensi implementasi.",
    aircraft_scope_in_source: "Termasuk dalam enam metode pembanding pada studi regional.",
    evidence_summary: "Metode pembanding umum regional; nama 'Modified Optimal' tidak berarti otomatis optimal di semua konfigurasi.",
    implementation_notes: "Definisikan orientasi sisi kiri/kanan kabin. Varian v3 menggunakan konvensi implementasi.",
    source_ids: "SRC01; SRC10",
    evidence_status: "Didefinisikan langsung dalam PDF",
  },
  {
    method_id: "MB07",
    method_name: "Steffen (staggered-row variant)",
    aliases: "Steffen method; Optimal boarding method (Steffen)",
    method_type: "Strategi urutan kursi terstruktur",
    rule_from_pdf: "Urutan kursi Window -> Middle -> Aisle dengan baris berselang-seling (staggered rows) mulai dari belakang dan sisi kabin bergantian.",
    group_or_sequence: "Seat-column order A, F, B, E, C, D dengan paritas baris berselang-seling untuk meminimalkan interferensi lorong dan kursi.",
    aircraft_scope_in_source: "Pesawat konvensional; studi rujukan menyebut potensi efisiensi tinggi namun bergantung pada kepatuhan penumpang.",
    evidence_summary: "Dirancang teoritis untuk efisiensi interferensi nol, namun sensitif terhadap asumsi waktu stowage lorong tunggal.",
    implementation_notes: "Dalam model v3 dengan pemblokiran baris lorong tunggal konservatif, waktu boarding tercatat 7.06 - 7.74 menit.",
    source_ids: "SRC07; SRC08; SRC03",
    evidence_status: "Implementasi varian berselang-seling (staggered-row)",
  },
  {
    method_id: "MB08",
    method_name: "Back-to-Front-WILMA",
    aliases: "BTF-WILMA",
    method_type: "Kombinasi Baris Belakang dan Kursi Luar",
    rule_from_pdf: "Baris belakang ke depan sebagai aturan utama; Window-Middle-Aisle menjadi tie-breaker dalam baris.",
    group_or_sequence: "Urutkan -row, seat_priority (window -> middle -> aisle), seat_index.",
    aircraft_scope_in_source: "Konfigurasi kabin 3-3 180 kursi.",
    evidence_summary: "Mencapai rata-rata waktu boarding terendah di seluruh level bagasi pada benchmark notebook tersimpan (4.44m @50%, 4.65m @60%, 4.76m @70%).",
    implementation_notes: "Identik dengan Back-to-Front-AZBO-WILMA bila zona kontigu dipanggil dari belakang ke depan.",
    source_ids: "SRC01; SRC09",
    evidence_status: "Hasil terverifikasi dari notebook",
  },
  {
    method_id: "MB09",
    method_name: "GA-Zone-WMA",
    aliases: "Genetic Algorithm Optimized Zones",
    method_type: "Metode Optimasi Heuristik (Usulan)",
    rule_from_pdf: "Algoritma Genetika mencari batas zona dan urutan pemanggilan zona terbaik; di dalam tiap zona diterapkan prioritas WMA.",
    group_or_sequence: "Kromosom: batas zona [5, 18] (ukuran [5, 13, 12]) dengan urutan zona [3, 2, 1] (Zona 3: R19-30, Zona 2: R06-18, Zona 1: R01-05).",
    aircraft_scope_in_source: "Kabin generik 30 baris x 6 kursi (180 kursi), K=3 zona.",
    evidence_summary: "Rerata 4.815m (50%), 4.978m (60%), 5.124m (70%). Mencapai fitness sama dengan enumerasi menyeluruh pada 546 kandidat ruang pencarian.",
    implementation_notes: "GA heuristik; pada ruang terbatas cocok dengan optimum enumerasi, namun bukan bukti keunggulan global mutlak dibanding BTF-WILMA.",
    source_ids: "SRC12",
    evidence_status: "Metode eksperimental hasil optimasi GA",
  },
  {
    method_id: "MB10",
    method_name: "Exhaustive-Zone-WMA",
    aliases: "Exact Enumeration Audit",
    method_type: "Audit Optimum Eksak Ruang Terbatas",
    rule_from_pdf: "Mengevaluasi seluruh 91 kombinasi ukuran zona valid (5-15 baris) x 6 permutasi urutan = 546 kandidat pada batch pelatihan.",
    group_or_sequence: "Ukuran [5, 13, 12], batas [5, 18], urutan [3, 2, 1] (Zona 3: R19-30, Zona 2: R06-18, Zona 1: R01-05).",
    aircraft_scope_in_source: "Kabin generik 30 baris x 6 kursi, K=3 zona.",
    evidence_summary: "Menghasilkan nilai yang identik dengan GA-Zone-WMA karena GA berhasil menemukan titik optimum eksak dalam ruang pencarian tersebut.",
    implementation_notes: "Audit eksak hanya berlaku pada ruang keputusan dan fungsi objektif batch pelatihan yang didefinisikan.",
    source_ids: "SRC12",
    evidence_status: "Hasil audit eksak notebook",
  },
  {
    method_id: "MB11",
    method_name: "Fixed-Zone-WMA",
    aliases: "3 Equal Zones Rear-to-Front WMA",
    method_type: "Baseline Pembagian Zona Tetap",
    rule_from_pdf: "Tiga zona seimbang (baris 1-10, 11-20, 21-30); dipanggil dari zona belakang ke depan; WMA di dalam zona.",
    group_or_sequence: "Zona 3 (R21-30) -> Zona 2 (R11-20) -> Zona 1 (R01-10); WMA di dalam masing-masing zona.",
    aircraft_scope_in_source: "Kabin generik 180 kursi.",
    evidence_summary: "Baseline untuk menguji apakah optimasi GA menghasilkan perbaikan nyata dibanding pembagian zona intuitif seragam.",
    implementation_notes: "Rerata 4.866m @50%, 5.031m @60%, 5.151m @70%. GA sedikit lebih unggul (selisih ~1.6 - 3.1 detik).",
    source_ids: "SRC01; SRC11",
    evidence_status: "Baseline terverifikasi",
  },
];

// 5. Hasil Studi Literatur (22 temuan)
export const HASIL_STUDI_LITERATUR: StudyResultItem[] = [
  { result_id: "R001", study_id: "SRC01", aircraft_scope: "Gabungan ATR 72, A220, A320", condition: "Okupansi 100%; bagasi 50, 60, 70%", method: "Reverse Pyramid", metric: "Rata-rata waktu boarding", value: "3.53", unit: "ticks/penumpang", finding: "Rata-rata terendah secara keseluruhan di antara enam metode dalam eksperimen ini.", caveat: "Ticks adalah unit simulasi internal, bukan waktu universal." },
  { result_id: "R002", study_id: "SRC01", aircraft_scope: "Gabungan ATR 72, A220, A320", condition: "Okupansi 100%; bagasi 50, 60, 70%", method: "Outside-In/WMA", metric: "Rata-rata waktu boarding", value: "3.54", unit: "ticks/penumpang", finding: "Hampir sama dengan Reverse Pyramid pada agregat keseluruhan.", caveat: "Hasil sensitif terhadap tipe pesawat dan tingkat bagasi." },
  { result_id: "R003", study_id: "SRC01", aircraft_scope: "Gabungan ATR 72, A220, A320", condition: "Okupansi 100%; bagasi 50, 60, 70%", method: "Rotating Zones", metric: "Rata-rata waktu boarding", value: "4.68", unit: "ticks/penumpang", finding: "Rata-rata paling lambat di antara enam metode pada agregat studi ini.", caveat: "Tidak membuktikan Rotating Zones selalu paling lambat untuk seluruh konfigurasi." },
  { result_id: "R004", study_id: "SRC01", aircraft_scope: "ATR 72", condition: "50% bagasi, 100% okupansi", method: "Reverse Pyramid", metric: "Rata-rata waktu boarding", value: "3.54", unit: "ticks/penumpang", finding: "Metode tercepat yang dilaporkan untuk kondisi ATR 72 dengan 50% bagasi.", caveat: "Hasil simulasi studi, bukan pengukuran waktu operasional universal." },
  { result_id: "R005", study_id: "SRC01", aircraft_scope: "ATR 72", condition: "60% bagasi, 100% okupansi", method: "Outside-In/WMA", metric: "Rata-rata waktu boarding", value: "3.95", unit: "ticks/penumpang", finding: "Dilaporkan 18.2% lebih cepat daripada Rotating Zones pada skenario ini.", caveat: "Perbandingan berlaku untuk model dan parameter eksperimen tersebut." },
  { result_id: "R006", study_id: "SRC01", aircraft_scope: "ATR 72", condition: "70% bagasi, 100% okupansi", method: "Reverse Pyramid", metric: "Rata-rata waktu boarding", value: "4.22", unit: "ticks/penumpang", finding: "Metode tercepat yang dilaporkan untuk kondisi ATR 72 dengan 70% bagasi.", caveat: "Hasil simulasi studi, bukan pengukuran operasional universal." },
  { result_id: "R007", study_id: "SRC01", aircraft_scope: "Airbus A320", condition: "50% bagasi, 100% okupansi", method: "Outside-In/WMA", metric: "Rata-rata waktu boarding", value: "3.05", unit: "ticks/penumpang", finding: "WMA unggul atas Reverse Pyramid pada skenario A320 ini.", caveat: "Ticks adalah unit model yang digunakan oleh studi." },
  { result_id: "R008", study_id: "SRC01", aircraft_scope: "Airbus A320", condition: "60% bagasi, 100% okupansi", method: "Reverse Pyramid", metric: "Rata-rata waktu boarding", value: "3.30", unit: "ticks/penumpang", finding: "Reverse Pyramid diunggulkan pada skenario A320 ini.", caveat: "Ticks adalah unit model yang digunakan oleh studi." },
  { result_id: "R009", study_id: "SRC01", aircraft_scope: "Airbus A320", condition: "70% bagasi, 100% okupansi", method: "Outside-In / Rev Pyramid", metric: "Rata-rata waktu boarding", value: "3.58", unit: "Perlu verifikasi (teks menit, grafik ticks)", finding: "Kedua metode disebut memiliki efisiensi yang sama pada konfigurasi ini.", caveat: "Satuan dilaporkan tidak konsisten dalam teks PDF; jangan gunakan tanpa verifikasi." },
  { result_id: "R010", study_id: "SRC01", aircraft_scope: "Airbus A220", condition: "50% bagasi, 100% okupansi", method: "Outside-In/WMA", metric: "Rata-rata waktu boarding", value: "3.09", unit: "ticks/penumpang", finding: "WMA dilaporkan 25.7% lebih cepat dibanding metode paling lambat (Rotating Zones).", caveat: "Hasil simulasi studi regional." },
  { result_id: "R011", study_id: "SRC01", aircraft_scope: "Airbus A220", condition: "60% bagasi, 100% okupansi", method: "Outside-In/WMA", metric: "Keunggulan relatif", value: "27.3", unit: "% lebih cepat dr Rotating Zones", finding: "WMA tetap unggul pada skenario ini.", caveat: "Nilai absolut boarding time tidak tersedia pada kutipan hasil." },
  { result_id: "R012", study_id: "SRC01", aircraft_scope: "Airbus A220", condition: "70% bagasi, 100% okupansi", method: "Outside-In/WMA", metric: "Keunggulan relatif", value: "25.5", unit: "% lebih cepat dr Rotating Zones", finding: "WMA tetap unggul pada skenario ini.", caveat: "Nilai absolut boarding time tidak tersedia pada kutipan hasil." },
  { result_id: "R013", study_id: "SRC01", aircraft_scope: "ATR 72, A220, A320", condition: "Semua skenario bagasi", method: "Outside-In/WMA", metric: "Aisle & seat interference", value: "Terendah", unit: "Kualitatif", finding: "WMA paling efektif mengurangi kedua jenis interference dalam eksperimen regional.", caveat: "Tidak menyiratkan WMA selalu meminimalkan interferensi di semua layout." },
  { result_id: "R014", study_id: "SRC01", aircraft_scope: "ATR 72, A220, A320", condition: "Bagasi meningkat 50% -> 60% -> 70%", method: "Semua metode", metric: "Waktu boarding", value: "Meningkat", unit: "Kualitatif", finding: "Waktu boarding rata-rata meningkat saat proporsi penumpang membawa bagasi meningkat.", caveat: "Besarnya kenaikan bergantung pada model pesawat dan metode." },
  { result_id: "R015", study_id: "SRC01", aircraft_scope: "ATR 72, A220, A320", condition: "54 skenario (3 pesawat x 6 metode x 3 bagasi)", method: "Semua metode", metric: "Jumlah replikasi", value: "100", unit: "replikasi/skenario", finding: "Studi regional menggunakan 100 simulasi untuk setiap skenario.", caveat: "Replikasi tetap perlu diuji kestabilan variasinya." },
  { result_id: "R016", study_id: "SRC02", aircraft_scope: "Blended Wing Body (BWB)", condition: "Model multi-aisle BWB", method: "Double Outside-in", metric: "Waktu boarding relatif", value: "Unggul", unit: "Kualitatif", finding: "Metode tampil baik dan dinilai relatif praktis dibanding N-Steffen pada BWB.", caveat: "Jangan generalisasi hasil BWB ke pesawat single-aisle konvensional." },
  { result_id: "R017", study_id: "SRC02", aircraft_scope: "Blended Wing Body (BWB)", condition: "Stowage bagasi ideal 2 detik", method: "N-Steffen", metric: "Waktu boarding total", value: "324.5", unit: "detik", finding: "N-Steffen memastikan tidak terjadi kongesti sehingga waktu tetap 324.5 detik pada BWB ideal.", caveat: "Hanya untuk konfigurasi dan parameter model BWB yang diteliti." },
  { result_id: "R018", study_id: "SRC02", aircraft_scope: "Blended Wing Body (BWB)", condition: "Load factor < 0.5", method: "Berbagai strategi", metric: "Perbedaan kinerja", value: "Terbatas", unit: "Kualitatif", finding: "Pengaruh strategi relatif kecil pada seat load factor rendah.", caveat: "Hasil khusus model BWB." },
  { result_id: "R019", study_id: "SRC02", aircraft_scope: "Blended Wing Body (BWB)", condition: "Kepatuhan menurun dari 100%", method: "Double Outside-in", metric: "Sensitivitas kepatuhan", value: "Stabil di 80-95%", unit: "Kualitatif", finding: "Double Outside-in relatif toleran terhadap ketidakpatuhan penumpang dibanding N-Steffen.", caveat: "Didefinisikan untuk eksperimen BWB tertentu." },
  { result_id: "R020", study_id: "SRC05", aircraft_scope: "Model simulasi bagasi", condition: "Prioritas jumlah bagasi 3->2->1", method: "Decreasing Baggage Priority", metric: "Kinerja relatif", value: "Efisien", unit: "Kualitatif", finding: "Efisien bersama mayoritas strategi kursi kecuali BTF dan Rotating Zones.", caveat: "Perlu model jumlah bagasi bertingkat sebelum diuji." },
  { result_id: "R021", study_id: "SRC13", aircraft_scope: "Remote boarding, 2 pintu, apron bus", condition: "180 kursi, 2 apron bus", method: "Outside-In + Rev Pyramid", metric: "Efisiensi relatif", value: "Terbaik dari 15 metode", unit: "Kualitatif", finding: "Kombinasi unggul dalam konteks dua bus dan dua pintu (depan/belakang).", caveat: "Konteks operasional berbeda dari boarding satu pintu." },
  { result_id: "R022", study_id: "SRC01", aircraft_scope: "ATR 72, A220, A320", condition: "Lintas tipe pesawat dan tingkat bagasi", method: "Semua metode", metric: "Metode terbaik universal", value: "Tidak ada satu terbaik", unit: "Kualitatif", finding: "Studi menegaskan tidak ada satu metode yang unggul mutlak di seluruh kondisi.", caveat: "Dasar perlunya analisis sensitivitas; bukan bukti GA selalu menang." },
];

// 6. Parameter Simulasi (P001 - P014)
export const PARAMETER_SIMULASI: SimulationParamItem[] = [
  { parameter_id: "P001", parameter_name: "Aircraft models in regional study", value_or_levels: "ATR 72; Airbus A220; Airbus A320", unit: "Kategori", source_id: "SRC01", source_context: "Studi boarding regional dalam PDF", implementation_note: "Pisahkan hasil antar tipe pesawat; jangan disatukan sebagai satu konfigurasi kabin." },
  { parameter_id: "P002", parameter_name: "ATR 72 seat layout", value_or_levels: "2-2; 4 kursi per baris", unit: "Konfigurasi kursi", source_id: "SRC01", source_context: "Tata letak yang disebutkan dalam PDF", implementation_note: "Gunakan untuk memetakan aisle/window tanpa kursi tengah." },
  { parameter_id: "P003", parameter_name: "Airbus A220 seat layout", value_or_levels: "2-3; 5 kursi per baris", unit: "Konfigurasi kursi", source_id: "SRC01", source_context: "Tata letak yang disebutkan dalam PDF", implementation_note: "Layout asimetris 2-3." },
  { parameter_id: "P004", parameter_name: "Seat occupancy in regional comparison", value_min: "100", value_max: "100", value_or_levels: "100%", unit: "Persen", source_id: "SRC01", source_context: "Semua simulasi studi regional", implementation_note: "Baseline 100% load factor." },
  { parameter_id: "P005", parameter_name: "Passenger baggage prevalence", value_min: "50", value_max: "70", value_or_levels: "50%; 60%; 70%", unit: "Persen membawa 1 bagasi", source_id: "SRC01", source_context: "54 skenario: 3 pesawat x 6 metode x 3 bagasi", implementation_note: "Tiap penumpang membawa nol atau satu barang bagasi (0/1 model)." },
  { parameter_id: "P006", parameter_name: "Simulation repetitions per scenario", value_min: "100", value_max: "100", value_or_levels: "100 replikasi", unit: "Replikasi per skenario", source_id: "SRC01", source_context: "Studi regional menggunakan 100 simulasi per skenario", implementation_note: "Catat seed dan gunakan variasi acak yang setara untuk replikasi." },
  { parameter_id: "P007", parameter_name: "Walking duration per row (regional)", value_min: "2.4", value_max: "2.4", value_or_levels: "2.4 detik/baris", unit: "Detik/baris; 1 patch per tick", source_id: "SRC01", source_context: "Teks studi menetapkan satu patch per tick, satu tick = 2.4 detik", implementation_note: "Konversi berlaku pada simulasi regional, bukan otomatis pada BWB." },
  { parameter_id: "P008", parameter_name: "Baggage stowage duration", value_min: "7", value_max: "16", value_or_levels: "7-16 ticks / Weibull(16.0, 1.7)", unit: "Ticks / detik", source_id: "SRC01", source_context: "Mengacu Schultz (2018) dan rujukan internal studi", implementation_note: "Perlakukan sebagai parameter studi yang perlu ditelusuri sensitivitasnya." },
  { parameter_id: "P009", parameter_name: "Seat interference duration by type", value_or_levels: "Tipe 1: 9 gerakan (21.6s); Tipe 2: 5 gerakan (12.0s)", unit: "Gerakan / detik", source_id: "SRC01; SRC06", source_context: "Model regional mengaitkan jumlah gerakan dengan jenis seat interference", implementation_note: "0 blocker: 0s; 1 blocker: 5 ticks x 2.4s = 12s; 2 blocker: 9 ticks x 2.4s = 21.6s." },
  { parameter_id: "P010", parameter_name: "Baggage stowage time in BWB paper default", value_min: "16", value_max: "16", value_or_levels: "16 detik", unit: "Detik per agen", source_id: "SRC02", source_context: "Artikel BWB menjelaskan turning point N-Steffen", implementation_note: "Khusus untuk konteks artikel BWB." },
  { parameter_id: "P011", parameter_name: "Baggage stowage time in simplified BWB", value_min: "2", value_max: "2", value_or_levels: "2 detik", unit: "Detik per agen", source_id: "SRC02", source_context: "Skenario ideal tanpa proses penyimpanan memakan waktu", implementation_note: "Skenario teoritis batas bawah." },
  { parameter_id: "P012", parameter_name: "Seat load factor in BWB model", value_or_levels: "Default 100%, diuji hingga <0.5", unit: "Proporsi okupansi", source_id: "SRC02", source_context: "Analisis sensitivitas seat load factor di BWB", implementation_note: "Khusus model BWB." },
  { parameter_id: "P013", parameter_name: "Compliance rate in BWB model", value_min: "0", value_max: "100", value_or_levels: "100% baseline; 80%-95% diuji", unit: "Persen patuh urutan", source_id: "SRC02", source_context: "Persentase agen berada di posisi benar dalam antrean", implementation_note: "Variabel uji sensitivitas perilaku manusia." },
  { parameter_id: "P014", parameter_name: "Generic single-aisle cabin setup", value_min: "30", value_max: "30", value_or_levels: "30 baris x 6 kursi = 180 kursi", unit: "Baris / kursi", source_id: "SRC01", source_context: "Layout kabin generik 3-3 lorong tunggal (seperti B737/A320)", implementation_note: "Model kabin generik yang digunakan pada simulasi ZoneFlow." },
];

// 7. Sumber Literatur (SRC01 - SRC16)
export const SUMBER_LITERATUR: LiteratureSourceItem[] = [
  { source_id: "SRC01", authors: "Sophia Possamai Viertel; Luana Pessini; Lisa Secomandi; Renata Cavion; Francielly Hedler Staudt", year: 2025, title: "Boarding Efficiency in Regional Aviation: A Comparative Analysis of Methods", publication: "Naskah/paper Federal University of Santa Catarina; PAPER ID: SITXXX", source_use: "Enam metode dasar; hasil ATR 72/A220/A320; parameter dan replikasi simulasi", bibliographic_note: "PDF menyebut 22-24 Oktober 2025, Brasília/DF; status metadata prosiding final belum terkonfirmasi." },
  { source_id: "SRC02", authors: "Y. Dong; X. Jia; D. Yanagisawa; K. Nishinari", year: 2025, title: "Passenger Space Expansion and Effective Boarding Strategy for Blended Wing Body Passenger Aircraft", publication: "Physica A: Statistical Mechanics and its Applications, 658, 130298", doi_or_url: "https://doi.org/10.1016/j.physa.2024.130298", source_use: "Double Outside-in; N-Steffen; sensitivity bagasi, seat load factor, dan compliance", bibliographic_note: "Sumber khusus pesawat blended-wing-body (BWB); tidak boleh langsung disamakan dengan single-aisle." },
  { source_id: "SRC03", authors: "H. Moreira; L. Pinto Ferreira; N. Fernandes; A. L. Ramos; P. Avila", year: 2023, title: "Analysis of boarding strategies on an Airbus A320 using discrete event simulation", publication: "Sustainability, 15(23), 16476", doi_or_url: "https://doi.org/10.3390/su152316476", source_use: "Konteks literatur metode dan seat/aisle interference pada A320", bibliographic_note: "Entri bibliografi ditranskripsikan dari PDF rujukan." },
  { source_id: "SRC04", authors: "C. Delcea; L.-A. Cotfas; R. Paun", year: 2018, title: "Agent-based evaluation of the airplane boarding strategies' efficiency and sustainability", publication: "Sustainability, 10(6), 1879", doi_or_url: "https://doi.org/10.3390/su10061879", source_use: "Literatur metode boarding dan rujukan agent-based simulation", bibliographic_note: "Model evaluasi agen penumpang pesawat." },
  { source_id: "SRC05", authors: "A. A. Nugroho; M. Asrol", year: 2022, title: "The impact of effectiveness of luggage arrangement on the airplane passengers' boarding process", publication: "Periodica Polytechnica Transportation Engineering, 50(4), 369-386", doi_or_url: "https://doi.org/10.3311/PPtr.19481", source_use: "Prioritas pengurutan berdasarkan jumlah bagasi dan parameter langkah/tick", bibliographic_note: "Model alokasi bagasi bertingkat 3-2-1." },
  { source_id: "SRC06", authors: "M. Schultz", year: 2018, title: "Field trial measurements to validate a stochastic aircraft boarding model", publication: "Aerospace, 5(1), Article 27", doi_or_url: "https://doi.org/10.3390/aerospace5010027", source_use: "Rujukan perilaku stokastik stowage dan durasi seat interference", bibliographic_note: "Dasar empiris distribusi Weibull stowage bagasi dan delay blocker." },
  { source_id: "SRC07", authors: "J. H. Steffen; J. Hotchkiss", year: 2012, title: "Experimental test of airplane boarding methods", publication: "Journal of Air Transport Management, 18(1), 64-67", doi_or_url: "https://doi.org/10.1016/j.jairtraman.2011.10.003", source_use: "Rujukan eksperimen fisik strategi boarding Steffen", bibliographic_note: "Eksperimen mock-up kabin penumpang riil." },
  { source_id: "SRC08", authors: "J. H. Steffen", year: 2008, title: "Optimal boarding method for airline passengers", publication: "Journal of Air Transport Management, 14(3), 146-150", doi_or_url: "https://doi.org/10.1016/j.jairtraman.2008.03.003", source_use: "Rujukan teoritis metode Steffen", bibliographic_note: "Paper pendiri metode Steffen berbasis optimasi Markovian." },
  { source_id: "SRC09", authors: "S. Jafer; W. Mi", year: 2017, title: "Comparative study of aircraft boarding strategies using cellular discrete event simulation", publication: "Aerospace, 4(4), 57", doi_or_url: "https://doi.org/10.3390/aerospace4040057", source_use: "Definisi Random, BTF, Outside-In, Reverse Pyramid, Rotating Zones, Modified Optimal", bibliographic_note: "Rujukan definisi standar komparasi metode klasik." },
  { source_id: "SRC10", authors: "L. Luo; S. Hong; S. Shang; X. Zhou; J. Yang; Y. Pan", year: 2021, title: "Intelligent boarding modelling and evaluation: A simulation-based approach", publication: "Journal of Advanced Transportation, 2021, 1-12", doi_or_url: "https://doi.org/10.1155/2021/9973336", source_use: "Rujukan tambahan strategi boarding cerdas dan evaluasi", bibliographic_note: "Pemodelan berbasis simulasi multi-faktor." },
  { source_id: "SRC11", authors: "S. Mas; A. A. Juan; P. Arias; P. Fonseca", year: 2013, title: "A simulation study regarding different aircraft boarding strategies", publication: "Modeling and Simulation in Engineering, Economics, and Management, LNBIP 145, 145-152", doi_or_url: "https://doi.org/10.1007/978-3-642-38279-6_16", source_use: "Rujukan Rotating Zones/Blocks dan metode simulasi", bibliographic_note: "Studi komparasi strategi zona blok berputar." },
  { source_id: "SRC12", authors: "M. Soolaki; I. Mahdavi; N. Mahdavi-Amiri; R. Hassanzadeh; A. Aghajani", year: 2012, title: "A new linear programming approach and genetic algorithm for solving airline boarding problem", publication: "Applied Mathematical Modelling, 36(9), 4060-4072", doi_or_url: "https://doi.org/10.1016/j.apm.2011.11.030", source_use: "Rujukan pendekatan Linear Programming dan Genetic Algorithm untuk boarding", bibliographic_note: "Dasar teoritis pemanfaatan algoritma genetika dalam optimasi boarding." },
  { source_id: "SRC13", authors: "C. Delcea; R. Milne; L.-A. Cotfas; L. Craciun; A. Molanescu", year: 2019, title: "Methods for accelerating the airplane boarding process in the presence of apron buses", publication: "IEEE Access, 7", doi_or_url: "https://doi.org/10.1109/ACCESS.2019.2941532", source_use: "Remote boarding dengan apron buses dan kombinasi strategi dua pintu", bibliographic_note: "Studi boarding dengan bus apron dan 2 pintu masuk simultan." },
  { source_id: "SRC14", authors: "H. G. da R. Moreira", year: 2021, title: "Análise de estratégias de embarque num Airbus A320 recorrendo a modelos de simulação", publication: "Dissertação de mestrado, Instituto Superior de Engenharia do Porto", doi_or_url: "https://recipp.ipp.pt/bitstream/10400.22/18099/1/DM_HelioMoreira_2021_MEEC.pdf", source_use: "Sumber tambahan simulasi strategi A320", bibliographic_note: "Tesis magister mengenai simulasi diskrit A320." },
  { source_id: "SRC15", authors: "R. J. Milne; M. Salari", year: 2016, title: "Optimization of assigning passengers to seats on airplanes based on their carry-on luggage", publication: "Journal of Air Transport Management, 54, 104-110", doi_or_url: "https://doi.org/10.1016/j.jairtraman.2016.03.022", source_use: "Optimasi alokasi kursi berdasarkan bagasi kabin", bibliographic_note: "Pengaruh variasi muatan bagasi pada alokasi kursi." },
  { source_id: "SRC16", authors: "C. Delcea; R. Milne; L.-A. Cotfas", year: 2022, title: "Evaluating classical airplane boarding methods for passenger health during normal times", publication: "Applied Sciences, 12(7), 3235", doi_or_url: "https://doi.org/10.3390/app12073235", source_use: "Klasifikasi seat interference dan evaluasi metode klasik", bibliographic_note: "Evaluasi kesehatan dan waktu paparan antrean kabin." },
];

// 8. Kamus Kolom Dataset
export const KAMUS_KOLOM: ColumnDictItem[] = [
  { file_name: "inventaris_metode_boarding.csv", column_name: "method_id", meaning: "ID unik metode boarding di database." },
  { file_name: "inventaris_metode_boarding.csv", column_name: "method_name", meaning: "Nama metode utama sesuai istilah sumber." },
  { file_name: "inventaris_metode_boarding.csv", column_name: "aliases", meaning: "Nama alternatif/akronim sebagaimana digunakan dalam sumber." },
  { file_name: "inventaris_metode_boarding.csv", column_name: "method_type", meaning: "Kategori metode; metode prioritas bagasi dan metode BWB ditandai khusus." },
  { file_name: "inventaris_metode_boarding.csv", column_name: "rule_from_pdf", meaning: "Aturan yang dapat ditarik dari isi PDF rujukan." },
  { file_name: "inventaris_metode_boarding.csv", column_name: "group_or_sequence", meaning: "Rincian pengelompokan atau urutan yang perlu diterapkan." },
  { file_name: "inventaris_metode_boarding.csv", column_name: "aircraft_scope_in_source", meaning: "Jenis pesawat/konteks operasional yang benar-benar disebut dalam sumber." },
  { file_name: "inventaris_metode_boarding.csv", column_name: "evidence_summary", meaning: "Ringkasan temuan yang dinyatakan sumber, tidak digeneralisasi." },
  { file_name: "inventaris_metode_boarding.csv", column_name: "implementation_notes", meaning: "Catatan implementasi dan risiko perbandingan tidak adil." },
  { file_name: "inventaris_metode_boarding.csv", column_name: "source_ids", meaning: "ID sumber yang cocok pada sumber_literatur.csv; beberapa ID dipisahkan titik koma." },
  { file_name: "hasil_studi.csv", column_name: "result_id", meaning: "ID unik hasil penelitian." },
  { file_name: "hasil_studi.csv", column_name: "metric/value/unit", meaning: "Metrik, nilai yang dilaporkan, dan satuan seperti yang tersurat dalam PDF; periksa kolom caveat." },
  { file_name: "parameter_simulasi.csv", column_name: "value_or_levels", meaning: "Nilai tetap atau level yang disebut sumber; bukan otomatis nilai yang harus dipakai dalam model tim." },
  { file_name: "sumber_literatur.csv", column_name: "source_id", meaning: "Kunci sumber yang direferensikan dari tabel metode, hasil, dan parameter." },
];

// 9. Catatan Asumsi Model & Batasan Ilmiah
export const CATATAN_BATASAN = {
  proyek: "ZoneFlow — Prototipe Simulasi Boarding Pesawat & Dashboard Analitik",
  konfigurasiKabin: {
    tipe: "Single-aisle generik 3-3",
    baris: 30,
    kursiPerBaris: 6,
    kapasitas: 180,
    loadFactor: 1.0,
  },
  parameterModel: {
    walkPerRowSeconds: 2.4,
    weibullShape: 1.7,
    weibullScaleSeconds: 16.0,
    entryGapSeconds: 1.0,
    aisleHeadwaySeconds: 1.0,
    sitTimeSeconds: 2.0,
    movesOneBlocker: 5, // 12.0 detik
    movesTwoBlockers: 9, // 21.6 detik
  },
  optimasiGA: {
    kZones: 3,
    minRowsPerZone: 5,
    maxRowsPerZone: 15,
    generations: 20,
    populationSize: 24,
    mutationRate: 0.3,
    eliteCount: 2,
    bestZoneSizes: [5, 13, 12],
    bestBoundaries: [5, 18],
    bestZoneOrder: [3, 2, 1],
    ruangPencarianAudit: "91 partisi x 6 urutan = 546 kandidat",
    gapTerhadapEnumerasiPelatihan: "0.000% (GA menemukan titik yang sama dengan solusi enumerasi)",
  },
  keterbatasanKunci: [
    "Boarding time yang ditampilkan adalah keluaran simulasi model matematis, bukan data pengukuran fisik maskapai komersial riil.",
    "Kebijakan simulator memblokir lorong pada baris tujuan secara penuh saat penumpang menata bagasi dan duduk (asumsi konservatif).",
    "Parameter ENTRY_GAP_S, SIT_TIME_S, dan delay interferensi kursi belum dikalibrasi terhadap data observasi operasional penerbangan Indonesia.",
    "Back-to-Front-WILMA menghasilkan rata-rata tercepat di seluruh tingkat bagasi pada benchmark notebook tersimpan. GA-Zone-WMA tidak mengungguli BTF-WILMA pada model ini.",
    "Reverse Pyramid, Steffen, dan Modified Optimal pada simulator merupakan varian implementasi/aproksimasi terdefinisi, bukan reproduksi kode asli dari masing-masing author paper.",
  ],
};
