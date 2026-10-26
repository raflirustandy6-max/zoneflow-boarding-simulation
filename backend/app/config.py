"""
Konfigurasi dan Parameter Fisik Model Simulasi ZoneFlow.
Diadaptasi langsung dari SimulasiLogikaUI_6_export_untuk_Claude_416c7319.py
"""

# Konfigurasi Kabin: single-aisle generik 3-3
N_ROWS = 30
SEATS = ["A", "B", "C", "D", "E", "F"]
CAPACITY = N_ROWS * len(SEATS)  # 180 kursi
LOAD_FACTOR = 1.0
BAGGAGE_RATIOS = [0.50, 0.60, 0.70]

# Parameter pergerakan fisik (Schultz 2018 & model regional)
WALK_PER_ROW_S = 2.4       # detik/baris
WEIBULL_SHAPE = 1.7        # parameter shape distribusi Weibull stowage
WEIBULL_SCALE_S = 16.0     # parameter scale distribusi Weibull dalam detik

# Parameter antrean lorong & duduk
ENTRY_GAP_S = 1.0          # jeda kedatangan antarpenumpang (detik)
AISLE_HEADWAY_S = 1.0      # headway minimum antarpengguna saat melintas segmen lorong
SIT_TIME_S = 2.0           # waktu duduk dasar
MOVEMENT_TICK_S = 2.4      # konversi tick ke detik untuk interferensi kursi
MOVES_ONE_BLOCKER = 5      # 5 gerakan * 2.4s = 12.0 detik
MOVES_TWO_BLOCKERS = 9     # 9 gerakan * 2.4s = 21.6 detik

# Parameter Zona & GA / Exhaustive Search
K_ZONES = 3
MIN_ROWS_PER_ZONE = 5
MAX_ROWS_PER_ZONE = 15
N_TRAIN_REPS_PER_BAG_LEVEL = 5
BASE_SEED = 20261021

# Parameter Algoritma Genetika (Cell 7 & 9 script penelitian asli)
GA_POPULATION_SIZE = 24
GA_GENERATIONS = 20
GA_ELITE_COUNT = 2
GA_MUTATION_RATE = 0.30
GA_TOURNAMENT_SIZE = 3
GA_DEFAULT_SEED = BASE_SEED + 999  # 20262020

# Solusi GA & Enumerasi Eksak Optimum Terverifikasi
BEST_GA_CHROMOSOME = {
    "boundaries": (5, 18),
    "sizes": (5, 13, 12),
    "order": (3, 2, 1),  # Belakang -> Tengah -> Depan
}
EXHAUSTIVE_OPTIMUM_FITNESS_SECONDS = 291.069
EXHAUSTIVE_OPTIMUM_FITNESS_MINUTES = 4.851

FIXED_ZONE_CHROMOSOME = {
    "boundaries": (10, 20),
    "sizes": (10, 10, 10),
    "order": (3, 2, 1),
}

# Layout 3-3: A/F = window (0); B/E = middle (1); C/D = aisle (2)
SEAT_PRIORITY = {
    "A": 0, "F": 0,
    "B": 1, "E": 1,
    "C": 2, "D": 2,
}

# Kursi pemblokir akses
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
