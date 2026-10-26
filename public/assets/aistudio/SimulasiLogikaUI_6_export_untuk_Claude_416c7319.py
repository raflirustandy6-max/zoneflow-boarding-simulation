# Export kode dari notebook SimulasiLogikaUI_6(1).ipynb untuk ditinjau di Claude.
# Catatan: ini adalah ekspor kode sumber; output sel notebook tidak ikut terikut.
# Jalankan hanya dalam lingkungan yang telah memiliki dependensi dan file input yang diperlukan.


# %% Cell 1
from pathlib import Path
import itertools
import json
import math
import random
import sys
import time
import zipfile

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from IPython.display import display

REQUIRED_FILES = [
    "inventaris_metode_boarding.csv",
    "hasil_studi.csv",
    "parameter_simulasi.csv",
    "sumber_literatur.csv",
    "kamus_kolom.csv",
]

def find_database_dir():
    candidates = [
        Path("/content/database_boarding_logika_ui"),
        Path("/mnt/data/database_boarding_logika_ui"),
        Path.cwd() / "database_boarding_logika_ui",
        Path.cwd(),
    ]
    for candidate in candidates:
        if all((candidate / name).exists() for name in REQUIRED_FILES):
            return candidate
    return None

DATA_DIR = find_database_dir()
if DATA_DIR is None and "google.colab" in sys.modules:
    try:
        from google.colab import files
        print("Opsional: unggah database_boarding_logika_ui.zip. Jika dilewati, simulasi tetap berjalan.")
        uploaded = files.upload()
        for filename in uploaded:
            if filename.lower().endswith(".zip"):
                with zipfile.ZipFile(filename, "r") as zf:
                    zf.extractall("/content")
        DATA_DIR = find_database_dir()
    except Exception as exc:
        print("Database tambahan tidak dimuat:", exc)

if DATA_DIR is not None:
    method_inventory = pd.read_csv(DATA_DIR / "inventaris_metode_boarding.csv")
    study_results = pd.read_csv(DATA_DIR / "hasil_studi.csv")
    parameter_inventory = pd.read_csv(DATA_DIR / "parameter_simulasi.csv")
    literature = pd.read_csv(DATA_DIR / "sumber_literatur.csv")
    column_dictionary = pd.read_csv(DATA_DIR / "kamus_kolom.csv")
    print(f"Database literatur dibaca dari: {DATA_DIR}")
    print(f"Metode katalog: {len(method_inventory)} | temuan studi: {len(study_results)} | parameter: {len(parameter_inventory)} | sumber: {len(literature)}")
else:
    method_inventory = pd.DataFrame()
    study_results = pd.DataFrame()
    parameter_inventory = pd.DataFrame()
    literature = pd.DataFrame()
    column_dictionary = pd.DataFrame()
    print("CSV literatur belum dimuat. Simulasi akan menggunakan katalog ringkas di notebook ini.")

# %% Cell 2
# KONFIGURASI MODEL — single-aisle generik, layout 3–3
N_ROWS = 30
SEATS = ["A", "B", "C", "D", "E", "F"]
LOAD_FACTOR = 1.0
BAGGAGE_RATIOS = [0.50, 0.60, 0.70]

# Parameter awal yang dirujuk dari literatur di paket PDF.
WALK_PER_ROW_S = 2.4                 # detik/baris; model regional yang dirujuk PDF
WEIBULL_SHAPE = 1.7                  # parameter shape dari studi Schultz yang dikutip di PDF
WEIBULL_SCALE_S = 16.0               # parameter scale dalam detik; baseline, belum kalibrasi untuk semua pesawat

# Asumsi implementasi tim — wajib diuji sensitivitasnya.
ENTRY_GAP_S = 1.0                    # jeda kedatangan antarpenumpang (asumsi)
AISLE_HEADWAY_S = 1.0                # headway minimum antarpengguna saat melintas satu segmen lorong (asumsi)
SIT_TIME_S = 2.0                     # waktu duduk dasar (asumsi)
MOVEMENT_TICK_S = 2.4                # konversi kerja untuk model gangguan v3
MOVES_ONE_BLOCKER = 5                # pemetaan sederhana; bukan nilai universal
MOVES_TWO_BLOCKERS = 9               # pemetaan sederhana; bukan nilai universal

# Variabel optimasi GA
K_ZONES = 3
MIN_ROWS_PER_ZONE = 5
MAX_ROWS_PER_ZONE = 15
BASE_SEED = 20261021
N_TRAIN_REPS_PER_BAG_LEVEL = 5
GA_POPULATION_SIZE = 24
GA_GENERATIONS = 20
GA_ELITE_COUNT = 2
GA_MUTATION_RATE = 0.30
RUN_EXHAUSTIVE_AUDIT = True  # menghitung semua kombinasi valid untuk membandingkan kualitas GA
N_TEST_REPLICATIONS = 100

# Layout 3-3: A/F = window; B/E = middle; C/D = aisle.
SEAT_PRIORITY = {"A": 0, "F": 0, "B": 1, "E": 1, "C": 2, "D": 2}
BLOCKERS = {
    "A": ["B", "C"], "B": ["C"], "C": [],
    "D": [], "E": ["D"], "F": ["D", "E"],
}
LEFT_SIDE = set("ABC")
RIGHT_SIDE = set("DEF")

assert N_ROWS >= K_ZONES * MIN_ROWS_PER_ZONE
assert N_ROWS <= K_ZONES * MAX_ROWS_PER_ZONE
assert all(0 <= r <= 1 for r in BAGGAGE_RATIOS)
assert WEIBULL_SHAPE > 0 and WEIBULL_SCALE_S > 0
assert ENTRY_GAP_S > 0 and AISLE_HEADWAY_S > 0

print(f"Kapasitas model: {N_ROWS * len(SEATS)} kursi")
print("Tingkat bagasi:", BAGGAGE_RATIOS)
print(f"Benchmark akhir: {len(BAGGAGE_RATIOS)} × {N_TEST_REPLICATIONS} × metode")
print("Asumsi utama: ENTRY_GAP_S, SIT_TIME_S, dan durasi konflik pada model ini belum dikalibrasi terhadap data penerbangan Indonesia.")
print("Kebijakan simulator: saat penumpang menyimpan bagasi/duduk, segmen lorong pada baris tujuan dianggap terblokir hingga selesai; ini asumsi konservatif yang perlu diuji sensitivitasnya.")

# %% Cell 3
def create_seat_list(n_rows=N_ROWS):
    """Membentuk seat map generik 3-3 dengan satu lorong."""
    seats = []
    for row in range(1, n_rows + 1):
        for seat_index, seat in enumerate(SEATS, start=1):
            seats.append({
                "seat_id": f"R{row:02d}{seat}",
                "row": row,
                "seat": seat,
                "seat_index": seat_index,
                "seat_priority": SEAT_PRIORITY[seat],
                "side": "left" if seat in LEFT_SIDE else "right",
                "blocking_seat_ids": [f"R{row:02d}{b}" for b in BLOCKERS[seat]],
            })
    return seats

ALL_SEATS = create_seat_list()
CAPACITY = len(ALL_SEATS)

def generate_passengers(seed, baggage_ratio, load_factor=LOAD_FACTOR):
    """Buat penumpang dan atribut acak yang dapat direproduksi dengan seed."""
    if not (0 < load_factor <= 1):
        raise ValueError("load_factor harus berada pada (0, 1].")
    if not (0 <= baggage_ratio <= 1):
        raise ValueError("baggage_ratio harus berada pada [0, 1].")

    rng = random.Random(seed)
    n_passengers = round(CAPACITY * load_factor)
    selected = rng.sample(ALL_SEATS, n_passengers)
    n_bags = round(n_passengers * baggage_ratio)
    bagged_ids = {p["seat_id"] for p in rng.sample(selected, n_bags)}

    passengers = []
    for seat_info in selected:
        p = dict(seat_info)
        p["has_bag"] = p["seat_id"] in bagged_ids
        # random.weibullvariate(alpha, beta): alpha=scale, beta=shape.
        p["bag_time_s"] = (
            rng.weibullvariate(WEIBULL_SCALE_S, WEIBULL_SHAPE)
            if p["has_bag"] else 0.0
        )
        p["walk_per_row_s"] = WALK_PER_ROW_S
        p["sit_time_s"] = SIT_TIME_S
        passengers.append(p)

    assert len(passengers) == n_passengers
    assert sum(p["has_bag"] for p in passengers) == n_bags
    return passengers

example_passengers = generate_passengers(BASE_SEED, 0.60)
print("Kapasitas:", CAPACITY, "| Penumpang:", len(example_passengers), "| Membawa bagasi:", sum(p["has_bag"] for p in example_passengers))
display(pd.DataFrame(example_passengers)[["seat_id", "row", "seat", "seat_priority", "has_bag", "bag_time_s"]].head(8))

# %% Cell 4
def _random_tie_breaker(passengers, seed):
    rng = random.Random(seed)
    ids = [p["seat_id"] for p in passengers]
    values = list(range(len(ids)))
    rng.shuffle(values)
    return dict(zip(ids, values))

def random_order(passengers, seed=0):
    order = list(passengers)
    random.Random(seed).shuffle(order)
    return order

def front_to_back_order(passengers, seed=0):
    tie = _random_tie_breaker(passengers, seed)
    return sorted(passengers, key=lambda p: (p["row"], tie[p["seat_id"]]))

def back_to_front_order(passengers, seed=0):
    tie = _random_tie_breaker(passengers, seed)
    return sorted(passengers, key=lambda p: (-p["row"], tie[p["seat_id"]]))

def outside_in_order(passengers):
    """WMA: window -> middle -> aisle; back-to-front within a seat class."""
    return sorted(passengers, key=lambda p: (p["seat_priority"], -p["row"], p["seat_index"]))

def back_to_front_wilma_order(passengers):
    """Back-to-front sebagai aturan utama; WMA menjadi tie-breaker dalam baris."""
    return sorted(passengers, key=lambda p: (-p["row"], p["seat_priority"], p["seat_index"]))

def steffen_order(passengers):
    """Steffen staggered-row variant untuk kabin 3-3.

    Seat-column order A, F, B, E, C, D. Untuk setiap kelas kursi/sisi,
    proses baris dengan paritas yang sama dengan baris belakang terlebih
    dahulu (setiap dua baris), lalu baris dengan paritas lainnya. Ini
    mengimplementasikan prinsip row-skipping; variasi detail Steffen
    berbeda di antara sumber, sehingga metode diberi label variant.
    """
    seat_groups = [("A", "F"), ("B", "E"), ("C", "D")]  # window, middle, aisle
    rear_parity = N_ROWS % 2
    parity_order = [rear_parity, 1 - rear_parity]
    by_seat = {}
    for passenger in passengers:
        by_seat.setdefault(passenger["seat"], []).append(passenger)
    order = []
    for side_pair in seat_groups:
        for parity in parity_order:
            for seat in side_pair:
                group = [p for p in by_seat.get(seat, []) if p["row"] % 2 == parity]
                order.extend(sorted(group, key=lambda p: -p["row"]))
    return order

def reverse_pyramid_order(passengers):
    """Aproksimasi diagonal Reverse Pyramid; bukan rekonstruksi kode paper asli."""
    return sorted(
        passengers,
        key=lambda p: (N_ROWS - p["row"] + p["seat_priority"], p["seat_priority"], N_ROWS - p["row"], p["seat_index"])
    )

def equal_zone_boundaries(n_rows, k_zones):
    sizes = [n_rows // k_zones + (1 if i < n_rows % k_zones else 0) for i in range(k_zones)]
    bounds, total = [], 0
    for size in sizes[:-1]:
        total += size
        bounds.append(total)
    return tuple(bounds)

def zone_of_row(row, boundaries):
    for zone_id, boundary in enumerate(boundaries, start=1):
        if row <= boundary:
            return zone_id
    return len(boundaries) + 1

def rotating_zones_order(passengers, k_zones=6):
    """Rotating Zones: zona belakang dan depan bergantian menuju tengah."""
    boundaries = equal_zone_boundaries(N_ROWS, k_zones)
    sequence, left, right, take_rear = [], 1, k_zones, True
    while left <= right:
        if take_rear:
            sequence.append(right); right -= 1
        else:
            sequence.append(left); left += 1
        take_rear = not take_rear
    rank = {z: i for i, z in enumerate(sequence)}
    def key(p):
        z = zone_of_row(p["row"], boundaries)
        row_key = -p["row"] if z >= (k_zones // 2 + 1) else p["row"]
        return (rank[z], row_key, p["seat_priority"], p["seat_index"])
    return sorted(passengers, key=key)

def modified_optimal_order(passengers):
    """Varian implementasi 4 grup: genap-kiri, genap-kanan, ganjil-kiri, ganjil-kanan."""
    def key(p):
        even = p["row"] % 2 == 0
        group = (0 if even and p["side"] == "left" else
                 1 if even and p["side"] == "right" else
                 2 if (not even) and p["side"] == "left" else 3)
        return (group, -p["row"], p["seat_priority"], p["seat_index"])
    return sorted(passengers, key=key)

def validate_order(ordered, passengers):
    expected = sorted(p["seat_id"] for p in passengers)
    actual = sorted(p["seat_id"] for p in ordered)
    if expected != actual:
        raise ValueError("Urutan metode tidak memuat setiap penumpang tepat satu kali.")
    return True

print("Fungsi urutan terdefinisi: Random, Front-to-Back, Back-to-Front, WMA, Back-to-Front-WILMA, Steffen, Reverse Pyramid (aproksimasi), Rotating Zones, Modified Optimal (varian).")

# %% Cell 5
def seat_interference_delay_s(n_occupied_blockers):
    """Pemetaan asumsi v3: 0 blocker=0; 1 blocker=5 gerakan; 2+=9 gerakan."""
    if n_occupied_blockers <= 0:
        return 0.0
    if n_occupied_blockers == 1:
        return MOVES_ONE_BLOCKER * MOVEMENT_TICK_S
    return MOVES_TWO_BLOCKERS * MOVEMENT_TICK_S

def simulate_boarding(ordered_passengers, entry_gap_s=ENTRY_GAP_S, collect_details=False):
    if not ordered_passengers:
        raise ValueError("Daftar penumpang kosong.")
    n_rows = max(p["row"] for p in ordered_passengers)
    aisle_free_at = {row: 0.0 for row in range(1, n_rows + 1)}
    seat_finish_time, finish_times = {}, {}
    aisle_events, aisle_wait_total = 0, 0.0
    seat_events, occupied_blocker_total = 0, 0
    detail_rows = []

    for queue_index, passenger in enumerate(ordered_passengers):
        current_time = queue_index * entry_gap_s
        target_row = passenger["row"]
        walk_s = passenger["walk_per_row_s"]
        this_aisle_wait = 0.0
        arrival_target = None
        blocker_count = 0
        conflict_delay = 0.0

        for row in range(1, target_row + 1):
            start = max(current_time, aisle_free_at[row])
            waiting = max(0.0, start - current_time)
            if waiting > 1e-9:
                aisle_events += 1
                aisle_wait_total += waiting
                this_aisle_wait += waiting
            arrival = start + walk_s
            if row < target_row:
                # Penumpang melintas. Model menggunakan headway pendek di setiap segmen.
                # Ini abstraksi: pergerakan fisik di lorong tidak direkonstruksi secara kontinu.
                aisle_free_at[row] = start + AISLE_HEADWAY_S
                current_time = arrival
            else:
                arrival_target = arrival
                blocker_count = sum(
                    1 for blocker in passenger["blocking_seat_ids"]
                    if blocker in seat_finish_time and seat_finish_time[blocker] <= arrival + 1e-9
                )
                if blocker_count > 0:
                    seat_events += 1
                    occupied_blocker_total += blocker_count
                conflict_delay = seat_interference_delay_s(blocker_count)
                finish = arrival + passenger["bag_time_s"] + conflict_delay + passenger["sit_time_s"]
                aisle_free_at[target_row] = finish
                seat_finish_time[passenger["seat_id"]] = finish
                finish_times[passenger["seat_id"]] = finish

        if collect_details:
            detail_rows.append({
                "queue_position": queue_index + 1,
                "seat_id": passenger["seat_id"],
                "row": target_row,
                "seat": passenger["seat"],
                "has_bag": passenger["has_bag"],
                "entry_time_s": queue_index * entry_gap_s,
                "arrival_target_s": arrival_target,
                "aisle_wait_s": this_aisle_wait,
                "occupied_blockers": blocker_count,
                "seat_interference_s": conflict_delay,
                "bag_stowage_s": passenger["bag_time_s"],
                "finish_time_s": finish_times[passenger["seat_id"]],
            })

    total = max(finish_times.values())
    metrics = {
        "boarding_time_seconds": total,
        "boarding_time_minutes": total / 60,
        "aisle_interference_events": aisle_events,
        # Jumlah waktu tunggu dari seluruh penumpang/segmen (person-seconds),
        # sehingga dapat melebihi durasi boarding total.
        "aggregate_aisle_wait_person_seconds": aisle_wait_total,
        "aisle_wait_seconds": aisle_wait_total,  # alias agar ekspor lama tetap kompatibel
        "seat_interference_events": seat_events,
        "occupied_blocker_count": occupied_blocker_total,
        "baggage_count": sum(p["has_bag"] for p in ordered_passengers),
        "passenger_count": len(ordered_passengers),
    }
    if collect_details:
        return metrics, pd.DataFrame(detail_rows)
    return metrics

# %% Cell 6
METHOD_CATALOG = pd.DataFrame([
    {"method": "Random", "status": "benchmark", "definition": "Urutan penumpang acak", "note": "Baseline acak; seed tercatat."},
    {"method": "Front-to-Back", "status": "benchmark", "definition": "Baris depan ke belakang", "note": "Urutan kursi dalam baris diacak."},
    {"method": "Back-to-Front", "status": "benchmark", "definition": "Baris belakang ke depan", "note": "Urutan kursi dalam baris diacak."},
    {"method": "Outside-In/WMA", "status": "benchmark", "definition": "Window, middle, aisle", "note": "Definisi global menurut prioritas kursi."},
    {"method": "Back-to-Front-WILMA", "status": "benchmark", "definition": "Baris belakang ke depan; WMA sebagai prioritas dalam baris", "note": "Dapat setara dengan BTF-AZBO-WILMA jika zona kontigu dipanggil belakang-ke-depan."},
    {"method": "Steffen (staggered-row implementation)", "status": "benchmark", "definition": "Window, middle, aisle; baris berselang-seling (mulai dari belakang) dan sisi kabin diproses terpisah", "note": "Mengikuti prinsip Steffen yang dijelaskan literatur; hasil tetap bergantung pada simulator dan detail aturan implementasi."},
    {"method": "Reverse Pyramid (approximation)", "status": "benchmark", "definition": "Urutan diagonal yang menggabungkan jarak dari belakang dan prioritas kursi", "note": "Aproksimasi implementasi; bukan reproduksi algoritme asli yang tervalidasi."},
    {"method": "Rotating Zones", "status": "benchmark", "definition": "Zona belakang dan depan bergantian menuju tengah", "note": "Jumlah zona ditetapkan enam untuk baseline."},
    {"method": "Modified Optimal (implementation variant)", "status": "benchmark", "definition": "Empat grup paritas baris dan sisi kabin", "note": "Aturan di dalam grup merupakan konvensi implementasi v3."},
    {"method": "Fixed-Zone-WMA", "status": "benchmark", "definition": "Tiga zona seimbang; zona belakang ke depan; WMA dalam zona", "note": "Baseline untuk menilai manfaat pencarian GA."},
    {"method": "GA-Zone-WMA", "status": "benchmark", "definition": "GA memilih batas dan urutan zona; WMA dalam zona", "note": "Metode usulan yang sedang diuji; hasil bersifat heuristik dan dibandingkan dengan enumerasi menyeluruh pada ruang kecil."},
    {"method": "Exhaustive-Zone-WMA", "status": "benchmark/audit", "definition": "Mengevaluasi seluruh kombinasi batas zona dan permutasi urutan zona yang valid", "note": "Pembanding eksak untuk ruang keputusan v1/v3 yang kecil; optimum hanya untuk fungsi objektif dan ruang pencarian yang didefinisikan."},
    {"method": "Back-to-Front-AZBO-WILMA", "status": "audit_only", "definition": "Zona rear-to-front, baris rear-to-front, WMA dalam baris", "note": "Dengan zona kontigu dan urutan belakang-ke-depan, dapat menghasilkan urutan yang sama dengan Back-to-Front-WILMA; tidak dihitung dua kali dalam benchmark utama."},
    {"method": "Double Outside-in", "status": "catalog_only_out_of_scope", "definition": "Varian luar-ke-dalam dengan pembagian longitudinal tambahan", "note": "Sumber yang kita inventarisasi berfokus pada blended-wing-body/multi-aisle."},
    {"method": "N-Steffen", "status": "catalog_only_out_of_scope", "definition": "Strategi mini-group untuk konfigurasi BWB/multi-aisle", "note": "Tidak sebanding langsung dengan model satu lorong 3-3."},
    {"method": "Decreasing baggage-priority", "status": "catalog_only_needs_extension", "definition": "Mendahulukan penumpang dengan lebih banyak barang bawaan", "note": "Perlu model jumlah bagasi 0–3 dan aturan gabungan sebelum diuji; v3 hanya memakai 0/1 bag."},
    {"method": "Outside-In + Reverse Pyramid, two-door", "status": "catalog_only_out_of_scope", "definition": "Kombinasi boarding dari dua pintu/dua bus", "note": "Memerlukan sumber daya dan kondisi awal berbeda; tidak dibandingkan dengan model satu pintu."},
])
display(METHOD_CATALOG)

# %% Cell 7
def ga_zone_wma_order(passengers, boundaries, zone_order):
    zone_rank = {zone_id: idx for idx, zone_id in enumerate(zone_order)}
    return sorted(passengers, key=lambda p: (
        zone_rank[zone_of_row(p["row"], boundaries)],
        p["seat_priority"], -p["row"], p["seat_index"]
    ))

def fixed_zone_wma_order(passengers):
    boundaries = equal_zone_boundaries(N_ROWS, K_ZONES)
    return ga_zone_wma_order(passengers, boundaries, tuple(range(K_ZONES, 0, -1)))

def back_to_front_azbo_wilma_order(passengers):
    """Prioritas zona 3->2->1, lalu baris belakang-ke-depan, WMA dalam baris."""
    boundaries = equal_zone_boundaries(N_ROWS, K_ZONES)
    zone_order = tuple(range(K_ZONES, 0, -1))
    zone_rank = {zone_id: idx for idx, zone_id in enumerate(zone_order)}
    return sorted(passengers, key=lambda p: (
        zone_rank[zone_of_row(p["row"], boundaries)],
        -p["row"], p["seat_priority"], p["seat_index"]
    ))

check_passengers = generate_passengers(BASE_SEED + 3, 0.50)
BENCHMARK_BUILDERS = {
    "Random": lambda p, seed: random_order(p, seed + 1),
    "Front-to-Back": lambda p, seed: front_to_back_order(p, seed + 2),
    "Back-to-Front": lambda p, seed: back_to_front_order(p, seed + 3),
    "Outside-In/WMA": lambda p, seed: outside_in_order(p),
    "Back-to-Front-WILMA": lambda p, seed: back_to_front_wilma_order(p),
    "Steffen (staggered-row implementation)": lambda p, seed: steffen_order(p),
    "Reverse Pyramid (approximation)": lambda p, seed: reverse_pyramid_order(p),
    "Rotating Zones": lambda p, seed: rotating_zones_order(p),
    "Modified Optimal (implementation variant)": lambda p, seed: modified_optimal_order(p),
    "Fixed-Zone-WMA": lambda p, seed: fixed_zone_wma_order(p),
}

rows_check = []
for name, builder in BENCHMARK_BUILDERS.items():
    ordered = builder(check_passengers, 1234)
    validate_order(ordered, check_passengers)
    metrics = simulate_boarding(ordered)
    rows_check.append({"method": name, **metrics})

bfa = back_to_front_azbo_wilma_order(check_passengers)
bfw = back_to_front_wilma_order(check_passengers)
identical_orders = [p["seat_id"] for p in bfa] == [p["seat_id"] for p in bfw]
print("Semua metode menghasilkan urutan yang valid.")
print("BTF-AZBO-WILMA identik dengan Back-to-Front-WILMA pada definisi zona kontigu rear-to-front:", identical_orders)
if identical_orders:
    print("Interpretasi: implementasi AZBO tetap belum memberi urutan berbeda pada baseline ini; kontribusi AZBO harus diuji melalui batas/urutan zona yang dioptimalkan oleh GA.")
display(pd.DataFrame(rows_check)[["method", "boarding_time_minutes", "aisle_interference_events", "seat_interference_events"]].sort_values("boarding_time_minutes").round(3))

# Audit tambahan: metode Steffen harus memuat setiap penumpang tepat sekali.
steffen_ids = [p["seat_id"] for p in steffen_order(check_passengers)]
assert len(steffen_ids) == len(set(steffen_ids)) == len(check_passengers)
assert set(steffen_ids) == {p["seat_id"] for p in check_passengers}
print("Audit Steffen lulus: seluruh kursi/penumpang muncul tepat satu kali.")

# %% Cell 8
def all_valid_zone_sizes(n_rows=N_ROWS, k_zones=K_ZONES, min_size=MIN_ROWS_PER_ZONE, max_size=MAX_ROWS_PER_ZONE):
    return [sizes for sizes in itertools.product(range(min_size, max_size + 1), repeat=k_zones) if sum(sizes) == n_rows]

VALID_ZONE_SIZES = all_valid_zone_sizes()

def sizes_to_boundaries(sizes):
    total, bounds = 0, []
    for size in sizes[:-1]:
        total += size
        bounds.append(total)
    return tuple(bounds)

def boundaries_to_sizes(boundaries):
    prev, sizes = 0, []
    for boundary in tuple(boundaries) + (N_ROWS,):
        sizes.append(boundary - prev)
        prev = boundary
    return tuple(sizes)

def validate_chromosome(chromosome):
    boundaries, zone_order = chromosome
    if len(boundaries) != K_ZONES - 1:
        raise ValueError("Jumlah batas zona tidak sesuai.")
    if tuple(sorted(boundaries)) != tuple(boundaries):
        raise ValueError("Batas zona harus menaik.")
    if boundaries_to_sizes(boundaries) not in VALID_ZONE_SIZES:
        raise ValueError(f"Ukuran zona tidak valid: {boundaries_to_sizes(boundaries)}")
    if tuple(sorted(zone_order)) != tuple(range(1, K_ZONES + 1)):
        raise ValueError("Urutan zona harus merupakan permutasi ID zona.")
    return True

def random_chromosome(rng):
    sizes = rng.choice(VALID_ZONE_SIZES)
    bounds = sizes_to_boundaries(sizes)
    order = list(range(1, K_ZONES + 1))
    rng.shuffle(order)
    return (bounds, tuple(order))

def repair_sizes(raw_sizes, rng):
    distances = [sum((a - b) ** 2 for a, b in zip(valid, raw_sizes)) for valid in VALID_ZONE_SIZES]
    minimum = min(distances)
    nearest = [valid for valid, d in zip(VALID_ZONE_SIZES, distances) if d == minimum]
    return rng.choice(nearest)

def order_crossover(parent_a, parent_b, rng):
    a, b = list(parent_a), list(parent_b)
    i, j = sorted(rng.sample(range(len(a)), 2))
    child = [None] * len(a)
    child[i:j+1] = a[i:j+1]
    remaining = [item for item in b if item not in child]
    cursor = 0
    for idx in list(range(j+1, len(a))) + list(range(0, j+1)):
        if child[idx] is None:
            child[idx] = remaining[cursor]
            cursor += 1
    return tuple(child)

def crossover(parent_a, parent_b, rng):
    sa, sb = boundaries_to_sizes(parent_a[0]), boundaries_to_sizes(parent_b[0])
    raw_sizes = tuple(rng.choice([a, b]) for a, b in zip(sa, sb))
    child_sizes = repair_sizes(raw_sizes, rng)
    child_order = order_crossover(parent_a[1], parent_b[1], rng)
    child = (sizes_to_boundaries(child_sizes), child_order)
    validate_chromosome(child)
    return child

def mutate(chromosome, rng, mutation_rate=GA_MUTATION_RATE):
    boundaries, order = chromosome
    sizes = boundaries_to_sizes(boundaries)
    new_sizes, new_order = sizes, list(order)
    if rng.random() < mutation_rate:
        neighbors = [v for v in VALID_ZONE_SIZES if v != sizes and sum(abs(a-b) for a,b in zip(v, sizes)) <= 4]
        new_sizes = rng.choice(neighbors if neighbors else [v for v in VALID_ZONE_SIZES if v != sizes])
    if rng.random() < mutation_rate:
        i, j = rng.sample(range(K_ZONES), 2)
        new_order[i], new_order[j] = new_order[j], new_order[i]
    child = (sizes_to_boundaries(new_sizes), tuple(new_order))
    validate_chromosome(child)
    return child

BALANCED_SEED = (equal_zone_boundaries(N_ROWS, K_ZONES), tuple(range(K_ZONES, 0, -1)))
validate_chromosome(BALANCED_SEED)
print("Jumlah pola ukuran zona valid:", len(VALID_ZONE_SIZES))
print("Contoh kromosom:", BALANCED_SEED, "| ukuran zona:", boundaries_to_sizes(BALANCED_SEED[0]))

# %% Cell 9
def make_training_batches():
    batches = []
    for ratio_idx, ratio in enumerate(BAGGAGE_RATIOS):
        for rep in range(N_TRAIN_REPS_PER_BAG_LEVEL):
            seed = BASE_SEED + 100_000 + ratio_idx * 10_000 + rep
            batches.append({"baggage_ratio": ratio, "replication": rep + 1, "seed": seed,
                            "passengers": generate_passengers(seed, ratio)})
    return batches

def tournament_select(scored_population, rng, tournament_size=3):
    contenders = rng.sample(scored_population, min(tournament_size, len(scored_population)))
    return min(contenders, key=lambda x: x[0])[1]

def run_genetic_algorithm(train_batches, population_size=GA_POPULATION_SIZE,
                          generations=GA_GENERATIONS, elite_count=GA_ELITE_COUNT,
                          mutation_rate=GA_MUTATION_RATE, seed=BASE_SEED + 999):
    rng = random.Random(seed)
    fitness_cache = {}

    def fitness(chromosome):
        key = (tuple(chromosome[0]), tuple(chromosome[1]))
        if key not in fitness_cache:
            bounds, zone_order = chromosome
            values = []
            for batch in train_batches:
                ordered = ga_zone_wma_order(batch["passengers"], bounds, zone_order)
                values.append(simulate_boarding(ordered)["boarding_time_seconds"])
            fitness_cache[key] = float(np.mean(values))
        return fitness_cache[key]

    population = [BALANCED_SEED]
    for permutation in itertools.permutations(range(1, K_ZONES + 1)):
        population.append((BALANCED_SEED[0], tuple(permutation)))
    while len(population) < population_size:
        candidate = random_chromosome(rng)
        if candidate not in population:
            population.append(candidate)
    population = population[:population_size]

    history = []
    best_ever_score, best_ever_chromosome = float("inf"), None
    for generation in range(generations + 1):
        scored = sorted([(fitness(ch), ch) for ch in population], key=lambda x: x[0])
        if scored[0][0] < best_ever_score:
            best_ever_score, best_ever_chromosome = scored[0][0], scored[0][1]
        history.append({
            "generation": generation,
            "best_fitness_seconds": best_ever_score,
            "best_fitness_minutes": best_ever_score / 60,
            "mean_population_fitness_seconds": float(np.mean([score for score, _ in scored])),
            "unique_candidates_evaluated": len(fitness_cache),
            "zone_boundaries": str(best_ever_chromosome[0]),
            "zone_order": str(best_ever_chromosome[1]),
        })
        if generation == generations:
            break
        next_population = [ch for _, ch in scored[:elite_count]]
        while len(next_population) < population_size:
            parent_a = tournament_select(scored, rng)
            parent_b = tournament_select(scored, rng)
            child = mutate(crossover(parent_a, parent_b, rng), rng, mutation_rate)
            next_population.append(child)
        population = next_population
    return best_ever_chromosome, pd.DataFrame(history), fitness_cache

training_batches = make_training_batches()
print(f"Batch pelatihan: {len(training_batches)} ({N_TRAIN_REPS_PER_BAG_LEVEL} replikasi × {len(BAGGAGE_RATIOS)} level bagasi)")
start_time = time.time()
best_chromosome, ga_history, fitness_cache = run_genetic_algorithm(training_batches)
print(f"GA selesai dalam {time.time() - start_time:.1f} detik")
print("Batas zona terbaik yang ditemukan:", best_chromosome[0])
print("Ukuran zona:", boundaries_to_sizes(best_chromosome[0]))
print("Urutan zona:", best_chromosome[1], "(ID 1 = depan, ID 3 = belakang)")
print(f"Fitness pelatihan: {ga_history.iloc[-1]['best_fitness_minutes']:.3f} menit")
display(ga_history.tail())

# %% Cell 10
def exhaustive_search_zone_wma(train_batches):
    records = []
    best_score = float("inf")
    best_chromosome = None
    all_orders = list(itertools.permutations(range(1, K_ZONES + 1)))

    for zone_sizes in VALID_ZONE_SIZES:
        boundaries = sizes_to_boundaries(zone_sizes)
        for zone_order in all_orders:
            chromosome = (boundaries, tuple(zone_order))
            validate_chromosome(chromosome)
            candidate_times = []
            for batch in train_batches:
                ordered = ga_zone_wma_order(batch["passengers"], boundaries, tuple(zone_order))
                candidate_times.append(simulate_boarding(ordered)["boarding_time_seconds"])
            score = float(np.mean(candidate_times))
            records.append({
                "zone_sizes": tuple(zone_sizes),
                "zone_boundaries": tuple(boundaries),
                "zone_order": tuple(zone_order),
                "training_fitness_seconds": score,
                "training_fitness_minutes": score / 60,
            })
            if score < best_score:
                best_score = score
                best_chromosome = chromosome

    audit_df = pd.DataFrame(records).sort_values("training_fitness_seconds").reset_index(drop=True)
    return best_chromosome, audit_df

if RUN_EXHAUSTIVE_AUDIT:
    expected_candidates = len(VALID_ZONE_SIZES) * math.factorial(K_ZONES)
    print(f"Menghitung seluruh kandidat valid: {len(VALID_ZONE_SIZES)} partisi × {math.factorial(K_ZONES)} urutan = {expected_candidates} kandidat.")
    exact_start = time.time()
    exact_chromosome, exact_search_results = exhaustive_search_zone_wma(training_batches)
    print(f"Enumerasi selesai dalam {time.time() - exact_start:.1f} detik.")
    print("Kandidat terbaik menurut enumerasi:", exact_chromosome)
    print("Ukuran zona:", boundaries_to_sizes(exact_chromosome[0]))
    print(f"Fitness eksak pada batch pelatihan: {exact_search_results.iloc[0]['training_fitness_minutes']:.3f} menit")
    ga_train_fitness = float(ga_history.iloc[-1]["best_fitness_seconds"])
    exact_train_fitness = float(exact_search_results.iloc[0]["training_fitness_seconds"])
    gap_pct = (ga_train_fitness / exact_train_fitness - 1) * 100 if exact_train_fitness else 0.0
    print(f"Gap GA terhadap optimum ruang terbatas pada batch pelatihan: {gap_pct:.3f}%")
    display(exact_search_results.head(10))
else:
    exact_chromosome = None
    exact_search_results = pd.DataFrame()
    print("Audit enumerasi dimatikan. GA tetap menghasilkan kandidat heuristik.")

# %% Cell 11
def build_baseline_orders(passengers, seed):
    return {
        "Random": random_order(passengers, seed + 1),
        "Front-to-Back": front_to_back_order(passengers, seed + 2),
        "Back-to-Front": back_to_front_order(passengers, seed + 3),
        "Outside-In/WMA": outside_in_order(passengers),
        "Back-to-Front-WILMA": back_to_front_wilma_order(passengers),
        "Steffen (staggered-row implementation)": steffen_order(passengers),
        "Reverse Pyramid (approximation)": reverse_pyramid_order(passengers),
        "Rotating Zones": rotating_zones_order(passengers),
        "Modified Optimal (implementation variant)": modified_optimal_order(passengers),
        "Fixed-Zone-WMA": fixed_zone_wma_order(passengers),
        "GA-Zone-WMA": ga_zone_wma_order(passengers, best_chromosome[0], best_chromosome[1]),
        **({"Exhaustive-Zone-WMA": ga_zone_wma_order(passengers, exact_chromosome[0], exact_chromosome[1])} if exact_chromosome is not None else {}),
    }

def run_benchmark(n_replications=N_TEST_REPLICATIONS):
    records = []
    started = time.time()
    for ratio_idx, ratio in enumerate(BAGGAGE_RATIOS):
        for rep in range(n_replications):
            # Seed test terpisah dari pelatihan GA.
            passenger_seed = BASE_SEED + 1_000_000 + ratio_idx * 100_000 + rep
            passengers = generate_passengers(passenger_seed, ratio)
            orders = build_baseline_orders(passengers, seed=passenger_seed + 50_000)
            for method, ordered in orders.items():
                validate_order(ordered, passengers)
                metrics = simulate_boarding(ordered)
                records.append({
                    "method": method,
                    "baggage_ratio": ratio,
                    "baggage_percent": int(round(ratio * 100)),
                    "replication": rep + 1,
                    "seed": passenger_seed,
                    **metrics,
                })
        print(f"Tingkat bagasi {ratio:.0%}: selesai {n_replications} replikasi.")
    result = pd.DataFrame(records)
    print(f"Benchmark selesai dalam {time.time() - started:.1f} detik; {len(result):,} hasil metode.")
    return result

benchmark_results = run_benchmark()
summary = (benchmark_results.groupby(["baggage_percent", "method"])["boarding_time_seconds"]
    .agg(mean_seconds="mean", std_seconds="std", median_seconds="median", min_seconds="min", max_seconds="max", n="count")
    .reset_index())
summary["mean_minutes"] = summary["mean_seconds"] / 60
summary["std_minutes"] = summary["std_seconds"] / 60
summary["ci95_low_seconds"] = summary["mean_seconds"] - 1.96 * summary["std_seconds"].fillna(0) / np.sqrt(summary["n"])
summary["ci95_high_seconds"] = summary["mean_seconds"] + 1.96 * summary["std_seconds"].fillna(0) / np.sqrt(summary["n"])
summary["rank_within_baggage"] = summary.groupby("baggage_percent")["mean_seconds"].rank(method="min", ascending=True)
summary = summary.sort_values(["baggage_percent", "mean_seconds"]).reset_index(drop=True)
display(summary[["baggage_percent", "method", "n", "mean_minutes", "std_minutes", "rank_within_baggage"]].round(3))

# %% Cell 12
paired_wide = benchmark_results.pivot_table(
    index=["baggage_percent", "replication"], columns="method", values="boarding_time_seconds"
)
paired_rows = []
for baggage_percent in sorted(paired_wide.index.get_level_values("baggage_percent").unique()):
    slice_df = paired_wide.xs(baggage_percent, level="baggage_percent")
    for method in slice_df.columns:
        if method == "GA-Zone-WMA":
            continue
        delta = slice_df["GA-Zone-WMA"] - slice_df[method]
        mean_delta = float(delta.mean())
        sd_delta = float(delta.std(ddof=1))
        half = 1.96 * sd_delta / math.sqrt(len(delta)) if len(delta) > 1 else float("nan")
        paired_rows.append({
            "baggage_percent": baggage_percent,
            "comparison": f"GA-Zone-WMA minus {method}",
            "mean_difference_seconds": mean_delta,
            "median_difference_seconds": float(delta.median()),
            "ci95_low_seconds": mean_delta - half,
            "ci95_high_seconds": mean_delta + half,
            "fraction_GA_faster": float((delta < 0).mean()),
            "n_pairs": len(delta),
        })
paired_comparison = pd.DataFrame(paired_rows)
print("Selisih negatif = GA lebih cepat. Interval kepercayaan di bawah ini adalah pendekatan normal; interpretasikan secara hati-hati.")
display(paired_comparison.round(3))

best_per_level = summary.groupby("baggage_percent")["mean_seconds"].transform("min")
summary["percent_above_best"] = (summary["mean_seconds"] / best_per_level - 1) * 100
winners = summary.loc[
    (summary["mean_seconds"] - best_per_level).abs() <= 1e-9,
    ["baggage_percent", "method", "mean_minutes"]
].sort_values(["baggage_percent", "method"]).reset_index(drop=True)
print("Semua metode yang seri pada waktu rata-rata terendah (jika ada):")
display(winners.round(3))

# %% Cell 13
audit_passengers = generate_passengers(BASE_SEED + 333, 0.60)
order_btf_wilma = back_to_front_wilma_order(audit_passengers)
order_btf_azbo_wilma = back_to_front_azbo_wilma_order(audit_passengers)
ids_a = [p["seat_id"] for p in order_btf_wilma]
ids_b = [p["seat_id"] for p in order_btf_azbo_wilma]
audit_result = {
    "same_order": ids_a == ids_b,
    "time_btf_wilma_minutes": simulate_boarding(order_btf_wilma)["boarding_time_minutes"],
    "time_btf_azbo_wilma_minutes": simulate_boarding(order_btf_azbo_wilma)["boarding_time_minutes"],
}
print(audit_result)
if audit_result["same_order"]:
    print("Kesimpulan: dengan definisi saat ini, menambahkan label AZBO pada zona kontigu rear-to-front tidak mengubah urutan. Untuk kontribusi berbeda, GA harus benar-benar mengubah batas/urutan zona atau definisi mekanisme pelepasan kelompok.")

# %% Cell 14
for baggage_percent in sorted(summary["baggage_percent"].unique()):
    plot_df = summary[summary["baggage_percent"] == baggage_percent].sort_values("mean_minutes")
    plt.figure(figsize=(12, 5))
    plt.bar(plot_df["method"], plot_df["mean_minutes"])
    plt.title(f"Rata-rata waktu boarding — bagasi {baggage_percent}%")
    plt.xlabel("Metode")
    plt.ylabel("Waktu boarding rata-rata (menit)")
    plt.xticks(rotation=55, ha="right")
    plt.tight_layout()
    plt.show()

plt.figure(figsize=(8, 4))
plt.plot(ga_history["generation"], ga_history["best_fitness_minutes"], marker="o")
plt.title("Perkembangan fitness terbaik GA")
plt.xlabel("Generasi")
plt.ylabel("Fitness terbaik (menit, data pelatihan)")
plt.tight_layout()
plt.show()

trace_passengers = generate_passengers(BASE_SEED + 2_000_000, 0.60)
trace_order = ga_zone_wma_order(trace_passengers, best_chromosome[0], best_chromosome[1])
trace_metrics, trace_detail = simulate_boarding(trace_order, collect_details=True)
trace_detail.insert(0, "method", "GA-Zone-WMA")
print("Metrik satu replikasi contoh:", trace_metrics)
display(trace_detail.head(12))

IN_COLAB = "google.colab" in sys.modules
OUTPUT_DIR = Path("/content/output_boarding_ga_v3") if IN_COLAB else (Path.cwd() / "output_boarding_ga_v3")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
benchmark_results.to_csv(OUTPUT_DIR / "hasil_replikasi_benchmark.csv", index=False)
summary.to_csv(OUTPUT_DIR / "ringkasan_benchmark.csv", index=False)
paired_comparison.to_csv(OUTPUT_DIR / "perbandingan_berpasangan_GA.csv", index=False)
ga_history.to_csv(OUTPUT_DIR / "riwayat_algoritma_genetika.csv", index=False)
winners.to_csv(OUTPUT_DIR / "pemenang_per_tingkat_bagasi.csv", index=False)
trace_detail.to_csv(OUTPUT_DIR / "jejak_satu_replikasi_GA.csv", index=False)
METHOD_CATALOG.to_csv(OUTPUT_DIR / "katalog_metode_dan_status.csv", index=False)
if RUN_EXHAUSTIVE_AUDIT and not exact_search_results.empty:
    exact_search_results.to_csv(OUTPUT_DIR / "hasil_enumerasi_menyeluruh.csv", index=False)

solution = {
    "model": "single-aisle generic 3-3",
    "n_rows": N_ROWS,
    "capacity": CAPACITY,
    "load_factor": LOAD_FACTOR,
    "baggage_ratios": BAGGAGE_RATIOS,
    "zone_count": K_ZONES,
    "zone_boundaries": list(best_chromosome[0]),
    "zone_sizes": list(boundaries_to_sizes(best_chromosome[0])),
    "zone_order": list(best_chromosome[1]),
    "zone_order_note": "ID 1 = zona depan; ID 3 = zona belakang",
    "ga_training_fitness_seconds": float(ga_history.iloc[-1]["best_fitness_seconds"]),
    "exhaustive_audit_enabled": bool(RUN_EXHAUSTIVE_AUDIT),
    "exact_zone_boundaries": list(exact_chromosome[0]) if exact_chromosome is not None else None,
    "exact_zone_sizes": list(boundaries_to_sizes(exact_chromosome[0])) if exact_chromosome is not None else None,
    "exact_zone_order": list(exact_chromosome[1]) if exact_chromosome is not None else None,
    "exact_training_fitness_seconds": float(exact_search_results.iloc[0]["training_fitness_seconds"]) if exact_chromosome is not None else None,
    "base_seed": BASE_SEED,
    "method_included": list(BENCHMARK_BUILDERS.keys()) + ["GA-Zone-WMA"] + (["Exhaustive-Zone-WMA"] if exact_chromosome is not None else []),
    "caveats": [
        "GA is heuristic and does not guarantee a global optimum.",
        "If exhaustive audit is enabled, its best candidate is exact only for the finite zone-size/order search space and specified training batches.",
        "Boarding times are model outputs, not measured airline boarding times.",
        "Steffen is an explicitly defined staggered-row variant.",
        "Reverse Pyramid and Modified Optimal are operationalized variants and need source-level validation.",
        "Seat/aisle interference mapping remains simplified and needs sensitivity analysis.",
    ],
}
with open(OUTPUT_DIR / "solusi_GA.json", "w", encoding="utf-8") as f:
    json.dump(solution, f, ensure_ascii=False, indent=2)

print(f"Seluruh hasil disimpan dalam: {OUTPUT_DIR.resolve()}")
for path in sorted(OUTPUT_DIR.iterdir()):
    print(path.name, f"({path.stat().st_size:,} bytes)")
