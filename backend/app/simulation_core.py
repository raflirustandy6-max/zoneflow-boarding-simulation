"""
ZoneFlow Python Simulation Core Engine.
Diadaptasi langsung dari SimulasiLogikaUI_6_export_untuk_Claude_416c7319.py.
Menyediakan kalkulasi deterministik, antrean lorong diskrit, dan pergerakan per penumpang.
"""

from typing import List, Dict, Any, Tuple, Optional
import random
import math
import itertools
from .config import (
    N_ROWS, SEATS, CAPACITY, LOAD_FACTOR, BAGGAGE_RATIOS,
    WALK_PER_ROW_S, WEIBULL_SHAPE, WEIBULL_SCALE_S,
    ENTRY_GAP_S, AISLE_HEADWAY_S, SIT_TIME_S,
    MOVEMENT_TICK_S, MOVES_ONE_BLOCKER, MOVES_TWO_BLOCKERS,
    K_ZONES, MIN_ROWS_PER_ZONE, MAX_ROWS_PER_ZONE,
    N_TRAIN_REPS_PER_BAG_LEVEL, BASE_SEED,
    GA_POPULATION_SIZE, GA_GENERATIONS, GA_ELITE_COUNT,
    GA_MUTATION_RATE, GA_TOURNAMENT_SIZE, GA_DEFAULT_SEED,
    EXHAUSTIVE_OPTIMUM_FITNESS_SECONDS, EXHAUSTIVE_OPTIMUM_FITNESS_MINUTES,
    SEAT_PRIORITY, BLOCKERS, LEFT_SIDE, RIGHT_SIDE,
    BEST_GA_CHROMOSOME, FIXED_ZONE_CHROMOSOME
)


def create_seat_list(n_rows: int = N_ROWS) -> List[Dict[str, Any]]:
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


ALL_SEATS = create_seat_list(N_ROWS)


def generate_passengers(
    seed: int,
    baggage_ratio: float,
    load_factor: float = LOAD_FACTOR,
    walk_per_row_s: float = WALK_PER_ROW_S,
    sit_time_s: float = SIT_TIME_S,
    weibull_scale_s: float = WEIBULL_SCALE_S,
    weibull_shape: float = WEIBULL_SHAPE
) -> List[Dict[str, Any]]:
    """
    Buat penumpang dan atribut acak yang dapat direproduksi dengan seed.
    Menggunakan random.Random(seed) dan rng.weibullvariate() sesuai implementasi Python asli.
    """
    if not (0 < load_factor <= 1.0):
        raise ValueError("load_factor harus berada pada (0, 1].")
    if not (0 <= baggage_ratio <= 1.0):
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
            rng.weibullvariate(weibull_scale_s, weibull_shape)
            if p["has_bag"] else 0.0
        )
        p["walk_per_row_s"] = walk_per_row_s
        p["sit_time_s"] = sit_time_s
        passengers.append(p)

    return passengers


def _random_tie_breaker(passengers: List[Dict[str, Any]], seed: int) -> Dict[str, int]:
    rng = random.Random(seed)
    ids = [p["seat_id"] for p in passengers]
    values = list(range(len(ids)))
    rng.shuffle(values)
    return dict(zip(ids, values))


def random_order(passengers: List[Dict[str, Any]], seed: int = 0) -> List[Dict[str, Any]]:
    order = list(passengers)
    random.Random(seed).shuffle(order)
    return order


def front_to_back_order(passengers: List[Dict[str, Any]], seed: int = 0) -> List[Dict[str, Any]]:
    tie = _random_tie_breaker(passengers, seed)
    return sorted(passengers, key=lambda p: (p["row"], tie[p["seat_id"]]))


def back_to_front_order(passengers: List[Dict[str, Any]], seed: int = 0) -> List[Dict[str, Any]]:
    tie = _random_tie_breaker(passengers, seed)
    return sorted(passengers, key=lambda p: (-p["row"], tie[p["seat_id"]]))


def outside_in_order(passengers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """WMA: window -> middle -> aisle; back-to-front within a seat class."""
    return sorted(passengers, key=lambda p: (p["seat_priority"], -p["row"], p["seat_index"]))


def back_to_front_wilma_order(passengers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Back-to-front sebagai aturan utama; WMA menjadi tie-breaker dalam baris."""
    return sorted(passengers, key=lambda p: (-p["row"], p["seat_priority"], p["seat_index"]))


def steffen_order(passengers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Steffen staggered-row variant untuk kabin 3-3."""
    seat_groups = [("A", "F"), ("B", "E"), ("C", "D")]
    rear_parity = N_ROWS % 2
    parity_order = [rear_parity, 1 - rear_parity]
    by_seat: Dict[str, List[Dict[str, Any]]] = {}
    for passenger in passengers:
        by_seat.setdefault(passenger["seat"], []).append(passenger)
    order = []
    for side_pair in seat_groups:
        for parity in parity_order:
            for seat in side_pair:
                group = [p for p in by_seat.get(seat, []) if p["row"] % 2 == parity]
                order.extend(sorted(group, key=lambda p: -p["row"]))
    return order


def reverse_pyramid_order(passengers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Aproksimasi diagonal Reverse Pyramid."""
    return sorted(
        passengers,
        key=lambda p: (
            N_ROWS - p["row"] + p["seat_priority"],
            p["seat_priority"],
            N_ROWS - p["row"],
            p["seat_index"]
        )
    )


def all_valid_zone_sizes(
    n_rows: int = N_ROWS,
    k_zones: int = K_ZONES,
    min_size: int = MIN_ROWS_PER_ZONE,
    max_size: int = MAX_ROWS_PER_ZONE
) -> List[Tuple[int, ...]]:
    """Menghitung seluruh partisi ukuran zona yang valid memenuhi batas minimum/maksimum."""
    return [
        sizes for sizes in itertools.product(range(min_size, max_size + 1), repeat=k_zones)
        if sum(sizes) == n_rows
    ]


VALID_ZONE_SIZES = all_valid_zone_sizes()


def sizes_to_boundaries(sizes: Tuple[int, ...]) -> Tuple[int, ...]:
    total, bounds = 0, []
    for size in sizes[:-1]:
        total += size
        bounds.append(total)
    return tuple(bounds)


def boundaries_to_sizes(boundaries: Tuple[int, ...], n_rows: int = N_ROWS) -> Tuple[int, ...]:
    prev, sizes = 0, []
    for boundary in tuple(boundaries) + (n_rows,):
        sizes.append(boundary - prev)
        prev = boundary
    return tuple(sizes)


def validate_chromosome(chromosome: Tuple[Tuple[int, ...], Tuple[int, ...]]) -> bool:
    """Validasi representasi kromosom zona: batas strictly ascending, ukuran valid, permutasi ID 1..k."""
    boundaries, zone_order = chromosome
    if len(boundaries) != K_ZONES - 1:
        raise ValueError(f"Jumlah batas zona harus {K_ZONES - 1}.")
    if tuple(sorted(boundaries)) != tuple(boundaries):
        raise ValueError("Batas zona harus terurut menaik secara monoton.")
    if boundaries_to_sizes(boundaries) not in VALID_ZONE_SIZES:
        raise ValueError(f"Ukuran zona tidak valid: {boundaries_to_sizes(boundaries)}")
    if tuple(sorted(zone_order)) != tuple(range(1, K_ZONES + 1)):
        raise ValueError(f"Urutan zona harus merupakan permutasi dari {list(range(1, K_ZONES + 1))}.")
    return True


def equal_zone_boundaries(n_rows: int = N_ROWS, k_zones: int = K_ZONES) -> Tuple[int, ...]:
    sizes = [n_rows // k_zones + (1 if i < n_rows % k_zones else 0) for i in range(k_zones)]
    bounds, total = [], 0
    for size in sizes[:-1]:
        total += size
        bounds.append(total)
    return tuple(bounds)


def zone_of_row(row: int, boundaries: Tuple[int, ...]) -> int:
    for zone_id, boundary in enumerate(boundaries, start=1):
        if row <= boundary:
            return zone_id
    return len(boundaries) + 1


def rotating_zones_order(passengers: List[Dict[str, Any]], k_zones: int = 6) -> List[Dict[str, Any]]:
    """Rotating Zones: zona belakang dan depan bergantian menuju tengah."""
    boundaries = equal_zone_boundaries(N_ROWS, k_zones)
    sequence, left, right, take_rear = [], 1, k_zones, True
    while left <= right:
        if take_rear:
            sequence.append(right)
            right -= 1
        else:
            sequence.append(left)
            left += 1
        take_rear = not take_rear
    rank = {z: i for i, z in enumerate(sequence)}

    def key(p):
        z = zone_of_row(p["row"], boundaries)
        row_key = -p["row"] if z >= (k_zones // 2 + 1) else p["row"]
        return (rank[z], row_key, p["seat_priority"], p["seat_index"])

    return sorted(passengers, key=key)


def modified_optimal_order(passengers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Varian implementasi 4 grup: genap-kiri, genap-kanan, ganjil-kiri, ganjil-kanan."""
    def key(p):
        even = p["row"] % 2 == 0
        group = (
            0 if even and p["side"] == "left" else
            1 if even and p["side"] == "right" else
            2 if (not even) and p["side"] == "left" else 3
        )
        return (group, -p["row"], p["seat_priority"], p["seat_index"])

    return sorted(passengers, key=key)


def ga_zone_wma_order(
    passengers: List[Dict[str, Any]],
    boundaries: Tuple[int, ...],
    zone_order: Tuple[int, ...]
) -> List[Dict[str, Any]]:
    zone_rank = {zone_id: idx for idx, zone_id in enumerate(zone_order)}
    return sorted(passengers, key=lambda p: (
        zone_rank.get(zone_of_row(p["row"], boundaries), 999),
        p["seat_priority"],
        -p["row"],
        p["seat_index"]
    ))


def fixed_zone_wma_order(passengers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    boundaries = tuple(FIXED_ZONE_CHROMOSOME["boundaries"])
    order = tuple(FIXED_ZONE_CHROMOSOME["order"])
    return ga_zone_wma_order(passengers, boundaries, order)


def ga_optimized_zone_wma_order(passengers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """GA-Zone-WMA menggunakan konfigurasi optimum terverifikasi [5, 18] urutan [3, 2, 1]."""
    boundaries = tuple(BEST_GA_CHROMOSOME["boundaries"])
    order = tuple(BEST_GA_CHROMOSOME["order"])
    return ga_zone_wma_order(passengers, boundaries, order)


def validate_order(ordered: List[Dict[str, Any]], original: List[Dict[str, Any]]) -> bool:
    if len(ordered) != len(original):
        raise ValueError("Panjang daftar penumpang terurut tidak sama dengan aslinya.")
    expected = sorted(p["seat_id"] for p in original)
    actual = sorted(p["seat_id"] for p in ordered)
    if expected != actual:
        raise ValueError("Urutan metode tidak memuat setiap penumpang tepat satu kali.")
    return True


def seat_interference_delay_s(
    n_occupied_blockers: int,
    moves_one_blocker: int = MOVES_ONE_BLOCKER,
    moves_two_blockers: int = MOVES_TWO_BLOCKERS,
    movement_tick_s: float = MOVEMENT_TICK_S
) -> float:
    """Pemetaan asumsi v3: 0 blocker=0; 1 blocker=5 gerakan (12s); 2+=9 gerakan (21.6s)."""
    if n_occupied_blockers <= 0:
        return 0.0
    if n_occupied_blockers == 1:
        return moves_one_blocker * movement_tick_s
    return moves_two_blockers * movement_tick_s


def simulate_boarding(
    ordered_passengers: List[Dict[str, Any]],
    entry_gap_s: float = ENTRY_GAP_S,
    aisle_headway_s: float = AISLE_HEADWAY_S,
    moves_one_blocker: int = MOVES_ONE_BLOCKER,
    moves_two_blockers: int = MOVES_TWO_BLOCKERS,
    movement_tick_s: float = MOVEMENT_TICK_S
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """
    Eksekusi antrean simulasi boarding diskrit Python asli.
    Menghitung metrik total dan mengumpulkan timeline per penumpang lengkap dengan
    riwayat transit lorong (aisle_transit) untuk rendering visual kabin 2D di UI.
    """
    if not ordered_passengers:
        raise ValueError("Daftar penumpang kosong.")

    n_rows = max(p["row"] for p in ordered_passengers)
    aisle_free_at = {row: 0.0 for row in range(1, n_rows + 1)}
    seat_finish_time = {}
    finish_times = {}

    aisle_events = 0
    aisle_wait_total = 0.0
    seat_events = 0
    occupied_blocker_total = 0
    detail_rows = []

    for queue_index, passenger in enumerate(ordered_passengers):
        current_time = queue_index * entry_gap_s
        target_row = passenger["row"]
        walk_s = passenger["walk_per_row_s"]
        this_aisle_wait = 0.0
        arrival_target = 0.0
        blocker_count = 0
        conflict_delay = 0.0
        aisle_transit = []

        for row in range(1, target_row + 1):
            start = max(current_time, aisle_free_at[row])
            waiting = max(0.0, start - current_time)
            if waiting > 1e-9:
                aisle_events += 1
                aisle_wait_total += waiting
                this_aisle_wait += waiting
            arrival = start + walk_s

            if row < target_row:
                # Penumpang melintas di segmen lorong
                aisle_free_at[row] = start + aisle_headway_s
                current_time = arrival
                aisle_transit.append({
                    "row": row,
                    "enter_s": round(start, 3),
                    "leave_s": round(arrival, 3),
                    "is_target_row": False,
                })
            else:
                # Tiba di baris target
                arrival_target = arrival
                blocker_count = sum(
                    1 for blocker in passenger["blocking_seat_ids"]
                    if blocker in seat_finish_time and seat_finish_time[blocker] <= arrival + 1e-9
                )
                if blocker_count > 0:
                    seat_events += 1
                    occupied_blocker_total += blocker_count

                conflict_delay = seat_interference_delay_s(
                    blocker_count, moves_one_blocker, moves_two_blockers, movement_tick_s
                )
                finish = arrival + passenger["bag_time_s"] + conflict_delay + passenger["sit_time_s"]

                aisle_free_at[target_row] = finish
                seat_finish_time[passenger["seat_id"]] = finish
                finish_times[passenger["seat_id"]] = finish

                aisle_transit.append({
                    "row": target_row,
                    "enter_s": round(start, 3),
                    "leave_s": round(finish, 3),
                    "is_target_row": True,
                })

        detail_rows.append({
            "queue_position": queue_index + 1,
            "seat_id": passenger["seat_id"],
            "row": target_row,
            "seat": passenger["seat"],
            "has_bag": passenger["has_bag"],
            "entry_time_s": round(queue_index * entry_gap_s, 3),
            "arrival_target_s": round(arrival_target, 3),
            "aisle_wait_s": round(this_aisle_wait, 3),
            "occupied_blockers": blocker_count,
            "seat_interference_s": round(conflict_delay, 3),
            "bag_stowage_s": round(passenger["bag_time_s"], 3),
            "finish_time_s": round(finish_times[passenger["seat_id"]], 3),
            "aisle_transit": aisle_transit,
        })

    total = max(finish_times.values()) if finish_times else 0.0
    metrics = {
        "boarding_time_seconds": round(total, 3),
        "boarding_time_minutes": round(total / 60.0, 3),
        "aisle_interference_events": aisle_events,
        "aggregate_aisle_wait_person_seconds": round(aisle_wait_total, 3),
        "aisle_wait_seconds": round(aisle_wait_total, 3),
        "seat_interference_events": seat_events,
        "occupied_blocker_count": occupied_blocker_total,
        "baggage_count": sum(p["has_bag"] for p in ordered_passengers),
        "passenger_count": len(ordered_passengers),
    }

    return metrics, detail_rows


# Katalog pembangun metode yang didukung
SUPPORTED_METHODS = [
    {
        "id": "MB01",
        "name": "Back-to-Front-WILMA",
        "category": "Window-Middle-Aisle (Hybrid)",
        "description": "Baris belakang ke depan; WMA sebagai prioritas dalam baris.",
        "note": "Metode tercepat pada seluruh skenario benchmark notebook tersimpan.",
    },
    {
        "id": "MB02",
        "name": "Reverse Pyramid (approximation)",
        "category": "Diagonal Aproksimasi",
        "description": "Urutan diagonal menggabungkan jarak dari belakang dan prioritas kursi.",
        "note": "Aproksimasi implementasi; bukan reproduksi algoritme asli yang tervalidasi.",
    },
    {
        "id": "MB03",
        "name": "GA-Zone-WMA",
        "category": "Algoritma Genetika",
        "description": "GA mengoptimasi batas dan urutan zona; WMA diterapkan dalam setiap zona.",
        "note": "Konfigurasi optimum terverifikasi: batas [5, 18], ukuran [5, 13, 12], urutan [3, 2, 1].",
    },
    {
        "id": "MB04",
        "name": "Exhaustive-Zone-WMA",
        "category": "Pencarian Eksak",
        "description": "Mengevaluasi seluruh 546 kombinasi partisi dan urutan zona.",
        "note": "Menggunakan konfigurasi optimum hasil audit eksak Python yang setara dengan GA.",
    },
    {
        "id": "MB05",
        "name": "Fixed-Zone-WMA",
        "category": "Zona Klasik",
        "description": "Tiga zona seimbang [10, 10, 10]; panggilan belakang ke depan [3, 2, 1]; WMA dalam zona.",
        "note": "Baseline pembanding untuk mengukur signifikansi optimasi zona.",
    },
    {
        "id": "MB06",
        "name": "Back-to-Front",
        "category": "Zona / Baris",
        "description": "Baris belakang ke depan; kursi dalam baris diacak.",
        "note": "Metode konvensional banyak digunakan maskapai.",
    },
    {
        "id": "MB07",
        "name": "Outside-In/WMA",
        "category": "Window-Middle-Aisle",
        "description": "Window (A/F), middle (B/E), aisle (C/D); baris belakang ke depan dalam kelas kursi.",
        "note": "Mengurangi interferensi kursi secara efektif.",
    },
    {
        "id": "MB08",
        "name": "Modified Optimal (implementation variant)",
        "category": "Varian Grup",
        "description": "Empat grup paritas baris dan sisi kabin (genap/ganjil, kiri/kanan).",
        "note": "Varian implementasi v3.",
    },
    {
        "id": "MB09",
        "name": "Steffen (staggered-row implementation)",
        "category": "Staggered Row",
        "description": "Window, middle, aisle dengan baris berselang-seling dari belakang.",
        "note": "Mengurangi interferensi lorong dan kursi secara teoritis.",
    },
    {
        "id": "MB10",
        "name": "Random",
        "category": "Acak",
        "description": "Urutan acak murni tanpa zona atau prioritas kursi.",
        "note": "Baseline acak pembanding.",
    },
    {
        "id": "MB11",
        "name": "Rotating Zones",
        "category": "Zona Berputar",
        "description": "Enam zona seimbang dipanggil bergantian dari belakang dan depan menuju tengah.",
        "note": "Baseline rotating zones.",
    },
    {
        "id": "MB12",
        "name": "Front-to-Back",
        "category": "Baris",
        "description": "Baris depan ke belakang; metode paling rentan terhadap aisle blocking ekstrem.",
        "note": "Baseline terburuk untuk mengukur penumpukan antrean lorong.",
    },
]


def build_passenger_order(
    method_name: str,
    passengers: List[Dict[str, Any]],
    seed: int = 0,
    custom_zone_boundaries: Optional[Tuple[int, ...]] = None,
    custom_zone_order: Optional[Tuple[int, ...]] = None
) -> List[Dict[str, Any]]:
    """Dispatcher urutan boarding berdasarkan nama metode."""
    if method_name == "Back-to-Front-WILMA":
        return back_to_front_wilma_order(passengers)
    elif method_name == "Reverse Pyramid (approximation)":
        return reverse_pyramid_order(passengers)
    elif method_name == "GA-Zone-WMA":
        if custom_zone_boundaries and custom_zone_order:
            return ga_zone_wma_order(passengers, custom_zone_boundaries, custom_zone_order)
        return ga_optimized_zone_wma_order(passengers)
    elif method_name == "Exhaustive-Zone-WMA":
        # Menggunakan solusi optimum hasil audit eksak Python (setara GA)
        return ga_optimized_zone_wma_order(passengers)
    elif method_name == "Fixed-Zone-WMA":
        return fixed_zone_wma_order(passengers)
    elif method_name == "Back-to-Front":
        return back_to_front_order(passengers, seed)
    elif method_name == "Outside-In/WMA":
        return outside_in_order(passengers)
    elif method_name == "Modified Optimal (implementation variant)":
        return modified_optimal_order(passengers)
    elif method_name == "Steffen (staggered-row implementation)":
        return steffen_order(passengers)
    elif method_name == "Random":
        return random_order(passengers, seed)
    elif method_name == "Rotating Zones":
        return rotating_zones_order(passengers)
    elif method_name == "Front-to-Back":
        return front_to_back_order(passengers, seed)
    else:
        raise ValueError(f"Metode '{method_name}' tidak didukung oleh engine Python.")


def get_t_critical_95(df: int) -> float:
    """
    Menghitung nilai kritis t-distribution untuk interval kepercayaan dua arah 95% (alpha = 0.05).
    Menggunakan ekspansi Cornish-Fisher berorde tinggi yang menghasilkan akurasi tinggi untuk df >= 5.
    """
    if df < 1:
        return 1.960
    z = 1.959963984540054
    t = (
        z
        + (z**3 + z) / (4.0 * df)
        + (5.0 * z**5 + 16.0 * z**3 + 3.0 * z) / (96.0 * df**2)
        + (3.0 * z**7 + 19.0 * z**5 + 17.0 * z**3 - 15.0 * z) / (384.0 * df**3)
    )
    return float(t)


def calculate_series_statistics(values: List[float]) -> Dict[str, float]:
    """
    Menghitung statistik deskriptif dan inferensial (mean, sample std dev N-1, median, min, max, CI 95%).
    """
    n = len(values)
    if n == 0:
        return {
            "mean": 0.0, "std": 0.0, "median": 0.0, "min": 0.0, "max": 0.0,
            "ci95_low": 0.0, "ci95_high": 0.0, "margin_of_error": 0.0
        }
    mean = sum(values) / n
    variance = sum((x - mean) ** 2 for x in values) / (n - 1) if n > 1 else 0.0
    std = math.sqrt(variance)
    sorted_v = sorted(values)
    median = sorted_v[n // 2] if n % 2 == 1 else (sorted_v[n // 2 - 1] + sorted_v[n // 2]) / 2.0
    min_v = sorted_v[0]
    max_v = sorted_v[-1]

    df = n - 1
    t_crit = get_t_critical_95(df) if df > 0 else 1.960
    se = std / math.sqrt(n) if n > 0 else 0.0
    me = t_crit * se

    return {
        "mean": round(mean, 3),
        "std": round(std, 3),
        "median": round(median, 3),
        "min": round(min_v, 3),
        "max": round(max_v, 3),
        "ci95_low": round(mean - me, 3),
        "ci95_high": round(mean + me, 3),
        "margin_of_error": round(me, 3),
    }


def calculate_min_max_mean(values: List[float]) -> Dict[str, float]:
    """Ringkasan statistik sederhana (mean, min, max)."""
    if not values:
        return {"mean": 0.0, "min": 0.0, "max": 0.0}
    return {
        "mean": round(sum(values) / len(values), 3),
        "min": round(min(values), 3),
        "max": round(max(values), 3),
    }


def run_batch_simulation(
    method_name: str,
    baggage_ratio: float,
    replications: int = 30,
    base_seed: int = BASE_SEED,
    load_factor: float = LOAD_FACTOR,
    custom_zone_boundaries: Optional[Tuple[int, ...]] = None,
    custom_zone_order: Optional[Tuple[int, ...]] = None,
    walk_per_row_s: float = WALK_PER_ROW_S,
    sit_time_s: float = SIT_TIME_S,
    weibull_scale_s: float = WEIBULL_SCALE_S,
    weibull_shape: float = WEIBULL_SHAPE,
    entry_gap_s: float = ENTRY_GAP_S,
    aisle_headway_s: float = AISLE_HEADWAY_S,
    moves_one_blocker: int = MOVES_ONE_BLOCKER,
    moves_two_blockers: int = MOVES_TWO_BLOCKERS,
    movement_tick_s: float = MOVEMENT_TICK_S
) -> Dict[str, Any]:
    """
    Menjalankan sejumlah replikasi simulasi secara berurutan menggunakan engine Python asli.
    Setiap replikasi menggunakan seed deterministik derived: base_seed + (r - 1).
    Mengumpulkan data setiap replikasi dan menghitung ringkasan statistik inferensial lengkap (CI 95%).
    """
    replications_data = []
    times_s = []
    times_m = []
    aisle_events_list = []
    aisle_waits_list = []
    seat_events_list = []
    blockers_list = []
    baggage_counts_list = []
    failed_replications = 0

    for rep in range(1, replications + 1):
        rep_seed = base_seed + (rep - 1)
        try:
            passengers = generate_passengers(
                seed=rep_seed,
                baggage_ratio=baggage_ratio,
                load_factor=load_factor,
                walk_per_row_s=walk_per_row_s,
                sit_time_s=sit_time_s,
                weibull_scale_s=weibull_scale_s,
                weibull_shape=weibull_shape
            )
            ordered = build_passenger_order(
                method_name=method_name,
                passengers=passengers,
                seed=rep_seed,
                custom_zone_boundaries=custom_zone_boundaries,
                custom_zone_order=custom_zone_order
            )
            validate_order(ordered, passengers)
            metrics, _ = simulate_boarding(
                ordered_passengers=ordered,
                entry_gap_s=entry_gap_s,
                aisle_headway_s=aisle_headway_s,
                moves_one_blocker=moves_one_blocker,
                moves_two_blockers=moves_two_blockers,
                movement_tick_s=movement_tick_s
            )

            rec = {
                "replication_id": rep,
                "seed": rep_seed,
                "boarding_time_seconds": metrics["boarding_time_seconds"],
                "boarding_time_minutes": metrics["boarding_time_minutes"],
                "aisle_interference_events": metrics["aisle_interference_events"],
                "aggregate_aisle_wait_person_seconds": metrics["aggregate_aisle_wait_person_seconds"],
                "seat_interference_events": metrics["seat_interference_events"],
                "occupied_blocker_count": metrics["occupied_blocker_count"],
                "baggage_count": metrics["baggage_count"],
                "passenger_count": metrics["passenger_count"],
            }
            replications_data.append(rec)
            times_s.append(metrics["boarding_time_seconds"])
            times_m.append(metrics["boarding_time_minutes"])
            aisle_events_list.append(float(metrics["aisle_interference_events"]))
            aisle_waits_list.append(metrics["aggregate_aisle_wait_person_seconds"])
            seat_events_list.append(float(metrics["seat_interference_events"]))
            blockers_list.append(float(metrics["occupied_blocker_count"]))
            baggage_counts_list.append(float(metrics["baggage_count"]))
        except Exception:
            failed_replications += 1

    statistics = {
        "boarding_time_seconds": calculate_series_statistics(times_s),
        "boarding_time_minutes": calculate_series_statistics(times_m),
        "aisle_interference_events": calculate_min_max_mean(aisle_events_list),
        "aggregate_aisle_wait_person_seconds": calculate_min_max_mean(aisle_waits_list),
        "seat_interference_events": calculate_min_max_mean(seat_events_list),
        "occupied_blocker_count": calculate_min_max_mean(blockers_list),
        "baggage_count": calculate_min_max_mean(baggage_counts_list),
    }

    return {
        "requested_replications": replications,
        "successful_replications": len(replications_data),
        "failed_replications": failed_replications,
        "statistics": statistics,
        "replications_data": replications_data,
    }


# ==============================================================================
# FUNGSI EXHAUSTIVE SEARCH (AUDIT ENUMERASI EKSAK 546 KANDIDAT)
# Sesuai Cell 8, Cell 9, dan Cell 10 Script Penelitian Asli
# ==============================================================================

def all_valid_zone_sizes(
    n_rows: int = N_ROWS,
    k_zones: int = K_ZONES,
    min_size: int = MIN_ROWS_PER_ZONE,
    max_size: int = MAX_ROWS_PER_ZONE
) -> List[Tuple[int, ...]]:
    """
    Menghasilkan seluruh partisi ukuran zona yang valid.
    Untuk 30 baris dan 3 zona dengan ukuran [5..15], menghasilkan tepat 91 kombinasi partisi.
    """
    return [
        sizes for sizes in itertools.product(range(min_size, max_size + 1), repeat=k_zones)
        if sum(sizes) == n_rows
    ]


VALID_ZONE_SIZES = all_valid_zone_sizes()


def sizes_to_boundaries(sizes: Tuple[int, ...]) -> Tuple[int, ...]:
    """Mengonversi partisi ukuran zona menjadi batas baris kumulatif (e.g. (5, 13, 12) -> (5, 18))."""
    total, bounds = 0, []
    for size in sizes[:-1]:
        total += size
        bounds.append(total)
    return tuple(bounds)


def boundaries_to_sizes(boundaries: Tuple[int, ...], n_rows: int = N_ROWS) -> Tuple[int, ...]:
    """Mengonversi batas baris kumulatif kembali menjadi ukuran tiap zona (e.g. (5, 18) -> (5, 13, 12))."""
    prev, sizes = 0, []
    for boundary in tuple(boundaries) + (n_rows,):
        sizes.append(boundary - prev)
        prev = boundary
    return tuple(sizes)


def validate_zone_chromosome(
    boundaries: Tuple[int, ...],
    zone_order: Tuple[int, ...],
    n_rows: int = N_ROWS,
    k_zones: int = K_ZONES
) -> bool:
    """
    Memvalidasi integritas kandidat kromosom zona:
    1. Jumlah batas zona harus K_ZONES - 1 (2 batas untuk 3 zona).
    2. Batas zona harus tersusun menaik secara ketat.
    3. Ukuran setiap zona harus berada pada rentang [MIN_ROWS_PER_ZONE, MAX_ROWS_PER_ZONE] dan totalnya 30 baris.
    4. Urutan zona harus merupakan permutasi valid dari (1..K_ZONES).
    """
    if len(boundaries) != k_zones - 1:
        raise ValueError(f"Jumlah batas zona harus {k_zones - 1}, diterima {len(boundaries)}.")
    if tuple(sorted(boundaries)) != tuple(boundaries):
        raise ValueError(f"Batas zona harus tersusun menaik: {boundaries}.")
    sizes = boundaries_to_sizes(boundaries, n_rows)
    if sizes not in VALID_ZONE_SIZES:
        raise ValueError(f"Ukuran zona {sizes} tidak memenuhi batasan [{MIN_ROWS_PER_ZONE}..{MAX_ROWS_PER_ZONE}] baris atau total != {n_rows}.")
    if tuple(sorted(zone_order)) != tuple(range(1, k_zones + 1)):
        raise ValueError(f"Urutan zona {zone_order} harus merupakan permutasi dari 1 sampai {k_zones}.")
    return True


def generate_exhaustive_candidates() -> List[Dict[str, Any]]:
    """
    Menghasilkan seluruh 546 kombinasi ruang pencarian:
    91 partisi ukuran zona valid x 6 permutasi urutan pemanggilan zona.
    Memverifikasi tidak ada kandidat duplikat dan seluruh batasan terpenuhi.
    """
    candidates = []
    seen = set()
    candidate_id = 1
    all_orders = list(itertools.permutations(range(1, K_ZONES + 1)))

    for sizes in VALID_ZONE_SIZES:
        bounds = sizes_to_boundaries(sizes)
        for order in all_orders:
            key = (bounds, tuple(order))
            if key in seen:
                continue
            seen.add(key)
            validate_zone_chromosome(bounds, order)
            candidates.append({
                "candidate_id": candidate_id,
                "boundaries": bounds,
                "zone_sizes": sizes,
                "zone_order": tuple(order),
            })
            candidate_id += 1

    return candidates


def make_training_batches(
    base_seed: int = BASE_SEED,
    n_train_reps: int = N_TRAIN_REPS_PER_BAG_LEVEL,
    baggage_ratios: Optional[List[float]] = None
) -> List[Dict[str, Any]]:
    """
    Membangkitkan 15 training batches (5 replikasi x 3 tingkat bagasi 50%, 60%, 70%)
    mengikuti persis skema Cell 9 script penelitian asli:
    seed = base_seed + 100_000 + ratio_idx * 10_000 + rep.
    """
    if baggage_ratios is None:
        baggage_ratios = BAGGAGE_RATIOS

    batches = []
    for ratio_idx, ratio in enumerate(baggage_ratios):
        for rep in range(n_train_reps):
            seed = base_seed + 100_000 + ratio_idx * 10_000 + rep
            batches.append({
                "baggage_ratio": ratio,
                "baggage_percent": int(round(ratio * 100)),
                "replication": rep + 1,
                "seed": seed,
                "passengers": generate_passengers(seed, ratio),
            })
    return batches


def run_exhaustive_search(
    progress_callback: Optional[Any] = None,
    cancel_check: Optional[Any] = None,
    base_seed: int = BASE_SEED,
    train_batches: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Menjalankan evaluasi Exhaustive-Zone-WMA nyata untuk seluruh 546 kandidat valid.
    Menggunakan fungsi fitness rata-rata waktu boarding dari 15 training batches (Cell 10 penelitian).
    Mendukung progress callback dan pembatalan interaktif yang aman.
    """
    import time

    start_time = time.time()
    if train_batches is None:
        train_batches = make_training_batches(base_seed=base_seed)

    candidates = generate_exhaustive_candidates()
    total_candidates = len(candidates)
    evaluated_records = []
    best_score = float("inf")
    best_candidate = None

    for idx, c in enumerate(candidates, start=1):
        if cancel_check and cancel_check():
            return {
                "status": "cancelled",
                "evaluated_candidates": idx - 1,
                "total_candidates": total_candidates,
                "best_candidate_so_far": best_candidate,
                "execution_time_seconds": round(time.time() - start_time, 2),
            }

        bounds = c["boundaries"]
        order = c["zone_order"]
        sizes = c["zone_sizes"]

        # Hitung waktu boarding untuk ke-15 batch pelatihan
        candidate_times = []
        for batch in train_batches:
            ordered = build_passenger_order(
                method_name="GA-Zone-WMA",
                passengers=batch["passengers"],
                seed=batch["seed"],
                custom_zone_boundaries=bounds,
                custom_zone_order=order,
            )
            metrics, _ = simulate_boarding(ordered)
            candidate_times.append(metrics["boarding_time_seconds"])

        score_seconds = sum(candidate_times) / len(candidate_times)
        score_minutes = score_seconds / 60.0

        rec = {
            "candidate_id": c["candidate_id"],
            "zone_boundaries": list(bounds),
            "zone_sizes": list(sizes),
            "zone_order": list(order),
            "training_fitness_seconds": round(score_seconds, 3),
            "training_fitness_minutes": round(score_minutes, 3),
        }
        evaluated_records.append(rec)

        if score_seconds < best_score:
            best_score = score_seconds
            best_candidate = rec

        if progress_callback:
            progress_callback(
                evaluated=idx,
                total=total_candidates,
                best_so_far=best_candidate,
                elapsed_s=time.time() - start_time
            )

    execution_time = time.time() - start_time
    sorted_records = sorted(evaluated_records, key=lambda x: x["training_fitness_seconds"])

    # Verifikasi terhadap optimum penelitian tersimpan [5, 18], [5, 13, 12], [3, 2, 1]
    matches_stored = (
        best_candidate is not None
        and tuple(best_candidate["zone_boundaries"]) == BEST_GA_CHROMOSOME["boundaries"]
        and tuple(best_candidate["zone_order"]) == BEST_GA_CHROMOSOME["order"]
    )

    return {
        "status": "completed",
        "optimization_type": "Exhaustive-Zone-WMA Exact Enumeration Audit",
        "total_candidates_planned": total_candidates,
        "total_candidates_evaluated": len(evaluated_records),
        "best_candidate": best_candidate,
        "matches_stored_optimum": matches_stored,
        "stored_reference": {
            "boundaries": list(BEST_GA_CHROMOSOME["boundaries"]),
            "sizes": list(BEST_GA_CHROMOSOME["sizes"]),
            "order": list(BEST_GA_CHROMOSOME["order"]),
            "expected_fitness_seconds": 291.069,
            "expected_fitness_minutes": 4.851,
        },
        "training_config": {
            "k_zones": K_ZONES,
            "min_rows_per_zone": MIN_ROWS_PER_ZONE,
            "max_rows_per_zone": MAX_ROWS_PER_ZONE,
            "baggage_ratios": [0.50, 0.60, 0.70],
            "replications_per_ratio": N_TRAIN_REPS_PER_BAG_LEVEL,
            "total_training_batches": len(train_batches),
            "base_seed": base_seed,
        },
        "execution_time_seconds": round(execution_time, 2),
        "top_candidates": sorted_records[:10],
    }


# ==============================================================================
# FUNGSI GENETIC ALGORITHM (GA-ZONE-WMA DINAMIS)
# Sesuai Cell 8 dan Cell 9 Script Penelitian Asli
# ==============================================================================

def equal_zone_boundaries(n_rows: int = N_ROWS, k_zones: int = K_ZONES) -> Tuple[int, ...]:
    """
    Menghasilkan batas zona seimbang untuk kabin n_rows dan k_zones.
    Untuk 30 baris dan 3 zona, menghasilkan (10, 20) dengan ukuran (10, 10, 10).
    """
    sizes = [n_rows // k_zones + (1 if i < n_rows % k_zones else 0) for i in range(k_zones)]
    bounds, total = [], 0
    for size in sizes[:-1]:
        total += size
        bounds.append(total)
    return tuple(bounds)


BALANCED_SEED: Tuple[Tuple[int, ...], Tuple[int, ...]] = (
    equal_zone_boundaries(N_ROWS, K_ZONES),
    tuple(range(K_ZONES, 0, -1))
)


def random_chromosome(rng: random.Random) -> Tuple[Tuple[int, ...], Tuple[int, ...]]:
    """
    Membangkitkan satu kromosom zona acak yang valid dari ruang 91 partisi x 6 urutan.
    """
    sizes = rng.choice(VALID_ZONE_SIZES)
    bounds = sizes_to_boundaries(sizes)
    order = list(range(1, K_ZONES + 1))
    rng.shuffle(order)
    chrom = (bounds, tuple(order))
    validate_zone_chromosome(chrom[0], chrom[1])
    return chrom


def repair_sizes(raw_sizes: Tuple[int, ...], rng: random.Random) -> Tuple[int, ...]:
    """
    Memperbaiki vektor ukuran zona hasil crossover mentah ke partisi valid terdekat
    berdasarkan jarak Euclidean kuadrat minimum pada VALID_ZONE_SIZES (Cell 9).
    """
    distances = [
        sum((a - b) ** 2 for a, b in zip(valid, raw_sizes))
        for valid in VALID_ZONE_SIZES
    ]
    minimum = min(distances)
    nearest = [valid for valid, d in zip(VALID_ZONE_SIZES, distances) if d == minimum]
    return rng.choice(nearest)


def order_crossover(
    parent_a: Tuple[int, ...],
    parent_b: Tuple[int, ...],
    rng: random.Random
) -> Tuple[int, ...]:
    """
    Order Crossover (OX) untuk permutasi urutan pemanggilan zona (Cell 9).
    Mempertahankan kevalidan permutasi (1..K_ZONES).
    """
    a, b = list(parent_a), list(parent_b)
    i, j = sorted(rng.sample(range(len(a)), 2))
    child: List[Optional[int]] = [None] * len(a)
    child[i:j + 1] = a[i:j + 1]
    remaining = [item for item in b if item not in child]
    cursor = 0
    for idx in list(range(j + 1, len(a))) + list(range(0, j + 1)):
        if child[idx] is None:
            child[idx] = remaining[cursor]
            cursor += 1
    return tuple(int(x) for x in child if x is not None)


def crossover(
    parent_a: Tuple[Tuple[int, ...], Tuple[int, ...]],
    parent_b: Tuple[Tuple[int, ...], Tuple[int, ...]],
    rng: random.Random
) -> Tuple[Tuple[int, ...], Tuple[int, ...]]:
    """
    Operator pindah silang (crossover) kromosom GA (Cell 9):
    - Uniform choice pada ukuran zona diikuti repair_sizes agar jumlah baris = 30 dan tiap zona [5..15].
    - Order crossover pada permutasi urutan zona.
    """
    sa, sb = boundaries_to_sizes(parent_a[0]), boundaries_to_sizes(parent_b[0])
    raw_sizes = tuple(rng.choice([a, b]) for a, b in zip(sa, sb))
    child_sizes = repair_sizes(raw_sizes, rng)
    child_order = order_crossover(parent_a[1], parent_b[1], rng)
    child = (sizes_to_boundaries(child_sizes), child_order)
    validate_zone_chromosome(child[0], child[1])
    return child


def mutate(
    chromosome: Tuple[Tuple[int, ...], Tuple[int, ...]],
    rng: random.Random,
    mutation_rate: float = GA_MUTATION_RATE
) -> Tuple[Tuple[int, ...], Tuple[int, ...]]:
    """
    Operator mutasi kromosom GA (Cell 9):
    - Dengan probabilitas mutation_rate, memindahkan ukuran zona ke tetangga terdekat (jarak L1 <= 4).
    - Dengan probabilitas mutation_rate, menukar (swap) dua posisi pada urutan pemanggilan zona.
    """
    boundaries, order = chromosome
    sizes = boundaries_to_sizes(boundaries)
    new_sizes, new_order = sizes, list(order)

    if rng.random() < mutation_rate:
        neighbors = [
            v for v in VALID_ZONE_SIZES
            if v != sizes and sum(abs(a - b) for a, b in zip(v, sizes)) <= 4
        ]
        new_sizes = rng.choice(
            neighbors if neighbors else [v for v in VALID_ZONE_SIZES if v != sizes]
        )

    if rng.random() < mutation_rate:
        i, j = rng.sample(range(K_ZONES), 2)
        new_order[i], new_order[j] = new_order[j], new_order[i]

    child = (sizes_to_boundaries(new_sizes), tuple(new_order))
    validate_zone_chromosome(child[0], child[1])
    return child


def tournament_select(
    scored_population: List[Tuple[float, Tuple[Tuple[int, ...], Tuple[int, ...]]]],
    rng: random.Random,
    tournament_size: int = GA_TOURNAMENT_SIZE
) -> Tuple[Tuple[int, ...], Tuple[int, ...]]:
    """
    Seleksi turnamen (Cell 9): memilih individu dengan fitness (waktu boarding) terendah
    dari sampel acak berukuran tournament_size.
    """
    k = min(tournament_size, len(scored_population))
    contenders = rng.sample(scored_population, k)
    return min(contenders, key=lambda x: x[0])[1]


_FITNESS_CACHE_SIGNATURES: Dict[int, Tuple[Tuple[int, float, int], ...]] = {}


def _get_training_batches_signature(
    train_batches: List[Dict[str, Any]]
) -> Tuple[Tuple[int, float, int], ...]:
    """Menghasilkan tanda tangan unik dari konfigurasi dan seed train_batches."""
    return tuple(
        (int(b.get("seed", 0)), round(float(b.get("baggage_ratio", 0.0)), 4), len(b.get("passengers", [])))
        for b in train_batches
    )


def evaluate_chromosome_fitness(
    chromosome: Tuple[Tuple[int, ...], Tuple[int, ...]],
    train_batches: List[Dict[str, Any]],
    fitness_cache: Optional[Dict[Tuple[Tuple[int, ...], Tuple[int, ...]], float]] = None
) -> float:
    """
    Mengevaluasi nilai fitness kromosom (rata-rata waktu boarding dalam detik)
    pada 15 batch pelatihan (5 replikasi x 3 tingkat bagasi 50%, 60%, 70%).
    Menjamin fitness_cache tidak pernah mencampur evaluasi dari base_seed atau konfigurasi training berbeda.
    """
    boundaries, zone_order = chromosome
    validate_zone_chromosome(boundaries, zone_order)
    key = (tuple(boundaries), tuple(zone_order))

    if fitness_cache is not None:
        batch_sig = _get_training_batches_signature(train_batches)
        cache_id = id(fitness_cache)
        if _FITNESS_CACHE_SIGNATURES.get(cache_id) != batch_sig:
            fitness_cache.clear()
            _FITNESS_CACHE_SIGNATURES[cache_id] = batch_sig
        elif key in fitness_cache:
            return fitness_cache[key]

    times = []
    for batch in train_batches:
        ordered = build_passenger_order(
            method_name="GA-Zone-WMA",
            passengers=batch["passengers"],
            seed=batch["seed"],
            custom_zone_boundaries=key[0],
            custom_zone_order=key[1],
        )
        metrics, _ = simulate_boarding(ordered)
        times.append(metrics["boarding_time_seconds"])

    score = sum(times) / len(times)
    if fitness_cache is not None:
        fitness_cache[key] = score
    return score


def run_genetic_algorithm(
    population_size: int = GA_POPULATION_SIZE,
    generations: int = GA_GENERATIONS,
    elite_count: int = GA_ELITE_COUNT,
    mutation_rate: float = GA_MUTATION_RATE,
    tournament_size: int = GA_TOURNAMENT_SIZE,
    seed: int = GA_DEFAULT_SEED,
    base_seed: int = BASE_SEED,
    train_batches: Optional[List[Dict[str, Any]]] = None,
    verified_exhaustive_optimum: Optional[Dict[str, Any]] = None,
    progress_callback: Optional[Any] = None,
    cancel_check: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Menjalankan evolusi Genetic Algorithm (GA-Zone-WMA) secara nyata mengikuti Cell 9 script penelitian asli.
    Mengevaluasi populasi melintasi generasi menggunakan seleksi turnamen, crossover dengan repair ukuran zona,
    mutasi L1-neighbor + swap urutan zona, serta elitisme.
    """
    import time

    if population_size < 4:
        raise ValueError("population_size minimal 4.")
    if generations < 1:
        raise ValueError("generations minimal 1.")
    if not (0 <= elite_count <= population_size):
        raise ValueError("elite_count harus berada pada rentang [0, population_size].")
    if not (0.0 <= mutation_rate <= 1.0):
        raise ValueError("mutation_rate harus berada pada rentang [0.0, 1.0].")
    if tournament_size < 2:
        raise ValueError("tournament_size minimal 2.")

    start_time = time.time()
    if train_batches is None:
        train_batches = make_training_batches(base_seed=base_seed)

    rng = random.Random(seed)
    fitness_cache: Dict[Tuple[Tuple[int, ...], Tuple[int, ...]], float] = {}
    _FITNESS_CACHE_SIGNATURES[id(fitness_cache)] = _get_training_batches_signature(train_batches)

    # Inisialisasi populasi awal persis mengikuti Cell 9 script penelitian asli:
    # BALANCED_SEED + 6 permutasi batas seimbang + individu acak unik hingga population_size
    population: List[Tuple[Tuple[int, ...], Tuple[int, ...]]] = [BALANCED_SEED]
    for permutation in itertools.permutations(range(1, K_ZONES + 1)):
        population.append((BALANCED_SEED[0], tuple(permutation)))
    max_unique = len(VALID_ZONE_SIZES) * math.factorial(K_ZONES)
    while len(population) < population_size:
        candidate = random_chromosome(rng)
        if candidate not in population or len( set(population) ) >= max_unique:
            population.append(candidate)
    population = population[:population_size]

    history: List[Dict[str, Any]] = []
    global_best_chrom: Optional[Tuple[Tuple[int, ...], Tuple[int, ...]]] = None
    global_best_score = float("inf")

    for gen in range(generations + 1):
        if cancel_check and cancel_check():
            return {
                "status": "cancelled",
                "current_generation": gen,
                "total_generations": generations,
                "unique_candidates_evaluated": len(fitness_cache),
                "best_candidate_so_far": (
                    {
                        "zone_boundaries": list(global_best_chrom[0]),
                        "zone_sizes": list(boundaries_to_sizes(global_best_chrom[0])),
                        "zone_order": list(global_best_chrom[1]),
                        "training_fitness_seconds": round(global_best_score, 3),
                        "training_fitness_minutes": round(global_best_score / 60.0, 3),
                    }
                    if global_best_chrom is not None
                    else None
                ),
                "generation_history": history,
                "execution_time_seconds": round(time.time() - start_time, 2),
            }

        scored: List[Tuple[float, Tuple[Tuple[int, ...], Tuple[int, ...]]]] = []
        for chrom in population:
            if cancel_check and cancel_check():
                return {
                    "status": "cancelled",
                    "current_generation": gen,
                    "total_generations": generations,
                    "unique_candidates_evaluated": len(fitness_cache),
                    "best_candidate_so_far": (
                        {
                            "zone_boundaries": list(global_best_chrom[0]),
                            "zone_sizes": list(boundaries_to_sizes(global_best_chrom[0])),
                            "zone_order": list(global_best_chrom[1]),
                            "training_fitness_seconds": round(global_best_score, 3),
                            "training_fitness_minutes": round(global_best_score / 60.0, 3),
                        }
                        if global_best_chrom is not None
                        else None
                    ),
                    "generation_history": history,
                    "execution_time_seconds": round(time.time() - start_time, 2),
                }
            score = evaluate_chromosome_fitness(chrom, train_batches, fitness_cache)
            scored.append((score, chrom))

        scored.sort(key=lambda item: item[0])
        gen_best_score, gen_best_chrom = scored[0]
        gen_worst_score = scored[-1][0]
        gen_mean_score = sum(s for s, _ in scored) / len(scored)

        if gen_best_score < global_best_score:
            global_best_score = gen_best_score
            global_best_chrom = gen_best_chrom

        assert global_best_chrom is not None

        gen_record = {
            "generation": gen,
            "best_fitness_seconds": round(global_best_score, 3),
            "best_fitness_minutes": round(global_best_score / 60.0, 3),
            "generation_best_fitness_seconds": round(gen_best_score, 3),
            "mean_fitness_seconds": round(gen_mean_score, 3),
            "mean_fitness_minutes": round(gen_mean_score / 60.0, 3),
            "worst_fitness_seconds": round(gen_worst_score, 3),
            "best_boundaries": list(global_best_chrom[0]),
            "best_sizes": list(boundaries_to_sizes(global_best_chrom[0])),
            "best_order": list(global_best_chrom[1]),
            "unique_candidates_evaluated": len(fitness_cache),
        }
        history.append(gen_record)

        best_candidate_dict = {
            "candidate_id": len(fitness_cache),
            "zone_boundaries": list(global_best_chrom[0]),
            "zone_sizes": list(boundaries_to_sizes(global_best_chrom[0])),
            "zone_order": list(global_best_chrom[1]),
            "training_fitness_seconds": round(global_best_score, 3),
            "training_fitness_minutes": round(global_best_score / 60.0, 3),
        }

        if progress_callback:
            progress_callback(
                current_gen=gen,
                total_gens=generations,
                unique_evaluated=len(fitness_cache),
                best_so_far=best_candidate_dict,
                history=list(history),
                elapsed_s=time.time() - start_time,
            )

        if gen == generations:
            break

        next_population = [chrom for _, chrom in scored[:elite_count]]
        while len(next_population) < population_size:
            parent_a = tournament_select(scored, rng, tournament_size=tournament_size)
            parent_b = tournament_select(scored, rng, tournament_size=tournament_size)
            child = crossover(parent_a, parent_b, rng)
            child = mutate(child, rng, mutation_rate=mutation_rate)
            next_population.append(child)
        population = next_population

    execution_time = time.time() - start_time
    assert global_best_chrom is not None

    best_candidate_final = {
        "candidate_id": 1,
        "zone_boundaries": list(global_best_chrom[0]),
        "zone_sizes": list(boundaries_to_sizes(global_best_chrom[0])),
        "zone_order": list(global_best_chrom[1]),
        "training_fitness_seconds": round(global_best_score, 3),
        "training_fitness_minutes": round(global_best_score / 60.0, 3),
    }

    # Urutkan kandidat unik yang dievaluasi selama evolusi GA
    sorted_cache = sorted(fitness_cache.items(), key=lambda item: item[1])
    top_candidates = [
        {
            "candidate_id": idx,
            "zone_boundaries": list(chrom[0]),
            "zone_sizes": list(boundaries_to_sizes(chrom[0])),
            "zone_order": list(chrom[1]),
            "training_fitness_seconds": round(score, 3),
            "training_fitness_minutes": round(score / 60.0, 3),
        }
        for idx, (chrom, score) in enumerate(sorted_cache[:10], start=1)
    ]

    is_standard_training = (
        base_seed == BASE_SEED
        and len(train_batches) == 15
        and train_batches[0].get("seed") == BASE_SEED + 100_000
    )

    if is_standard_training:
        is_exhaustive_optimum_verified = True
        comparison_type = "exhaustive_optimum"
        comparison_label = "Gap terhadap Exhaustive Optimum"
        reference_label = "Exhaustive-Zone-WMA (Audit Eksak)"
        ref_boundaries = list(BEST_GA_CHROMOSOME["boundaries"])
        ref_sizes = list(BEST_GA_CHROMOSOME["sizes"])
        ref_order = list(BEST_GA_CHROMOSOME["order"])
        ref_exhaustive_s = EXHAUSTIVE_OPTIMUM_FITNESS_SECONDS
        ref_exhaustive_m = EXHAUSTIVE_OPTIMUM_FITNESS_MINUTES
        exhaustive_candidates_count = 546
    elif verified_exhaustive_optimum is not None:
        is_exhaustive_optimum_verified = True
        comparison_type = "exhaustive_optimum"
        comparison_label = "Gap terhadap Exhaustive Optimum"
        reference_label = "Exhaustive-Zone-WMA (Audit Eksak)"
        ref_boundaries = list(verified_exhaustive_optimum["zone_boundaries"])
        ref_sizes = list(verified_exhaustive_optimum["zone_sizes"])
        ref_order = list(verified_exhaustive_optimum["zone_order"])
        ref_exhaustive_s = round(float(verified_exhaustive_optimum["training_fitness_seconds"]), 3)
        ref_exhaustive_m = round(float(verified_exhaustive_optimum["training_fitness_minutes"]), 3)
        exhaustive_candidates_count = 546
    else:
        is_exhaustive_optimum_verified = False
        comparison_type = "reference_chromosome"
        comparison_label = "Gap terhadap Kromosom Referensi [5, 18]"
        reference_label = "Kromosom Referensi [5, 18] | [3, 2, 1]"
        ref_boundaries = list(BEST_GA_CHROMOSOME["boundaries"])
        ref_sizes = list(BEST_GA_CHROMOSOME["sizes"])
        ref_order = list(BEST_GA_CHROMOSOME["order"])
        ref_chrom = (BEST_GA_CHROMOSOME["boundaries"], BEST_GA_CHROMOSOME["order"])
        ref_raw_s = evaluate_chromosome_fitness(ref_chrom, train_batches, fitness_cache=None)
        ref_exhaustive_s = round(ref_raw_s, 3)
        ref_exhaustive_m = round(ref_raw_s / 60.0, 3)
        exhaustive_candidates_count = 1

    matches_reference_chromosome = (
        tuple(global_best_chrom[0]) == tuple(ref_boundaries)
        and tuple(global_best_chrom[1]) == tuple(ref_order)
    )
    matches_exhaustive: Optional[bool] = (
        matches_reference_chromosome if is_exhaustive_optimum_verified else None
    )
    fitness_gap_s = round(global_best_score - ref_exhaustive_s, 3)
    fitness_gap_pct = round((fitness_gap_s / ref_exhaustive_s) * 100.0, 3)

    _FITNESS_CACHE_SIGNATURES.pop(id(fitness_cache), None)

    return {
        "status": "completed",
        "optimization_type": "GA-Zone-WMA Dynamic Evolutionary Optimization",
        "best_candidate": best_candidate_final,
        "matches_exhaustive_optimum": matches_exhaustive,
        "unique_candidates_evaluated": len(fitness_cache),
        "total_chromosome_evaluations": (generations + 1) * population_size,
        "search_space_size": 546,
        "evaluation_reduction_percent": round((1.0 - len(fitness_cache) / 546.0) * 100.0, 1),
        "ga_parameters": {
            "population_size": population_size,
            "generations": generations,
            "elite_count": elite_count,
            "mutation_rate": mutation_rate,
            "tournament_size": tournament_size,
            "ga_seed": seed,
            "training_base_seed": base_seed,
        },
        "exhaustive_comparison": {
            "is_exhaustive_optimum_verified": is_exhaustive_optimum_verified,
            "comparison_type": comparison_type,
            "comparison_label": comparison_label,
            "reference_label": reference_label,
            "matches_reference_chromosome": matches_reference_chromosome,
            "exhaustive_boundaries": ref_boundaries,
            "exhaustive_sizes": ref_sizes,
            "exhaustive_order": ref_order,
            "exhaustive_fitness_seconds": ref_exhaustive_s,
            "exhaustive_fitness_minutes": ref_exhaustive_m,
            "fitness_gap_seconds": fitness_gap_s,
            "fitness_gap_percent": fitness_gap_pct,
            "exhaustive_candidates_evaluated": exhaustive_candidates_count,
            "ga_unique_candidates_evaluated": len(fitness_cache),
        },
        "training_config": {
            "k_zones": K_ZONES,
            "min_rows_per_zone": MIN_ROWS_PER_ZONE,
            "max_rows_per_zone": MAX_ROWS_PER_ZONE,
            "baggage_ratios": [0.50, 0.60, 0.70],
            "replications_per_ratio": N_TRAIN_REPS_PER_BAG_LEVEL,
            "total_training_batches": len(train_batches),
            "base_seed": base_seed,
        },
        "generation_history": history,
        "top_candidates": top_candidates,
        "execution_time_seconds": round(execution_time, 2),
    }

