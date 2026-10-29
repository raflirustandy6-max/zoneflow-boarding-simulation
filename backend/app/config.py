"""
Konfigurasi dan Parameter Fisik Model Simulasi ZoneFlow × AZBO.
Mencakup spesifikasi P0-A (Cellular Blocking Flow), P0-B (Stokastik Penumpang:
Normal Terpotong, Weibull Bagasi, Triangular Kursi 1/5/9 Gerakan), dan
P0-C (Variable-K Genetic Algorithm & Monte Carlo Train/Test Split).
"""

# Konfigurasi Kabin Default: single-aisle generik 3-3
N_ROWS = 30
SEATS = ["A", "B", "C", "D", "E", "F"]
CAPACITY = N_ROWS * len(SEATS)  # 180 kursi
LOAD_FACTOR = 1.0
BAGGAGE_RATIOS = [0.50, 0.60, 0.70]

# P0-A: Geometri Sel Lorong Diskret Satu Dimensi (Cellular Blocking Flow)
ROW_PITCH_M = 0.8          # jarak antarbaris kursi (meter)
CELL_M = 0.4               # ukuran 1 sel lorong (meter) -> 2 sel per baris
CELLS_PER_ROW = 2          # round(ROW_PITCH_M / CELL_M)
DT_S = 0.25                # langkah jam simulasi diskret (detik)
ZONE_CALL_OVERHEAD_S = 0.0 # jeda opsional antarzona saat pergantian zona (detik)

# P0-B: Parameter Kecepatan Jalan Bebas Normal Terpotong (0 < V_i <= 0.8 m/s)
SPEED_MEAN_M_S = 0.8       # rata-rata kecepatan jalan bebas (m/s)
SPEED_STD_M_S = 0.1        # simpangan baku kecepatan jalan bebas (m/s)
SPEED_MIN_M_S = 0.05       # batas bawah numerik aman untuk kecepatan positif (m/s)
SPEED_MAX_M_S = 0.8        # batas atas kecepatan jalan bebas (m/s)

# P0-B: Parameter Distribusi Weibull untuk Penyimpanan Bagasi Kabin
WEIBULL_SHAPE = 1.7        # parameter shape distribusi Weibull stowage
WEIBULL_SCALE_S = 16.0     # parameter scale distribusi Weibull dalam detik

# P0-B: Parameter Distribusi Triangular untuk Gerakan Akses Kursi (1 / 5 / 9 gerakan)
TRIANGULAR_MIN_S = 1.8     # durasi minimum per gerakan kursi (detik)
TRIANGULAR_MODE_S = 2.4    # durasi modus per gerakan kursi (detik)
TRIANGULAR_MAX_S = 3.0     # durasi maksimum per gerakan kursi (detik)
MOVES_ZERO_BLOCKERS = 1    # 1 gerakan saat 0 penghalang kursi
MOVES_ONE_BLOCKER = 5      # 5 gerakan saat 1 penghalang kursi
MOVES_TWO_BLOCKERS = 9     # 9 gerakan saat 2 penghalang kursi

# Konstanta kompatibilitas v1 / UI
WALK_PER_ROW_S = 2.4       # referensi rata-rata 2 sel @ 0.4m / ~0.33-0.8 m/s
ENTRY_GAP_S = 0.0          # tidak ada lagi paksaan jeda masuk tetap 1.0 detik (sel 0 mengatur antrean)
AISLE_HEADWAY_S = 1.0      # dipertahankan hanya untuk kompatibilitas skema API v1
SIT_TIME_S = 0.0           # waktu duduk dasar sudah termasuk dalam M_i in {1,5,9} gerakan Triangular
MOVEMENT_TICK_S = 2.4      # modus gerakan Triangular (2.4 detik)

# P0-C: Parameter Zona, Variable-K GA & Monte Carlo Train/Test Split
K_ZONES = 3                # nilai default referensi untuk metode Fixed-Zone-WMA klasik
MIN_ROWS_PER_ZONE = 5      # referensi audit K=3 klasik
MAX_ROWS_PER_ZONE = 15     # referensi audit K=3 klasik
N_TRAIN_REPS_PER_BAG_LEVEL = 5
DEFAULT_TRAIN_REPS = 5     # replikasi training Monte Carlo (CRN)
DEFAULT_TEST_REPS = 30     # replikasi testing Monte Carlo (disjoint dari training)
BASE_SEED = 20261021

# Parameter Algoritma Genetika
GA_POPULATION_SIZE = 24
GA_GENERATIONS = 20
GA_ELITE_COUNT = 2
GA_MUTATION_RATE = 0.30
GA_TOURNAMENT_SIZE = 3
GA_DEFAULT_SEED = BASE_SEED + 999  # 20262020
GA_INTERNAL_RULES = ("WMA_IN_ZONE", "BTF_IN_ZONE")

# Referensi Historis K=3 (bukan lagi hasil statis yang dipaksakan)
BEST_GA_CHROMOSOME = {
    "boundaries": (5, 18),
    "sizes": (5, 13, 12),
    "order": (3, 2, 1),
}
EXHAUSTIVE_OPTIMUM_FITNESS_SECONDS = 291.069
EXHAUSTIVE_OPTIMUM_FITNESS_MINUTES = 4.851

FIXED_ZONE_CHROMOSOME = {
    "boundaries": (10, 20),
    "sizes": (10, 10, 10),
    "order": (3, 2, 1),
}

# Layout 3-3 Default: A/F = window (0); B/E = middle (1); C/D = aisle (2)
SEAT_PRIORITY = {
    "A": 0, "F": 0,
    "B": 1, "E": 1,
    "C": 2, "D": 2,
}

# Kursi pemblokir akses untuk kabin 3-3 default
BLOCKERS = {
    "A": ["B", "C"],
    "B": ["C"],
    "C": [],
    "D": [],
    "E": ["D"],
    "F": ["D", "E"],
}

LEFT_SIDE = set("ABC")
RIGHT_SIDE = set("DEF")
