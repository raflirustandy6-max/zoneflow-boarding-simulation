"""
ZoneFlow × AZBO Python Simulation Core Engine.
Implementasi Spesifikasi P0-A, P0-B, dan P0-C:
- P0-A: Mesin Antrean Lorong Berbasis Sel (Cellular Blocking Flow, cell_m=0.4m, row_pitch_m=0.8m, dt_s=0.25s).
- P0-B: Pemodelan Stokastik Aktivitas Penumpang (Normal terpotong 0 < V_i <= 0.8 m/s, Weibull(1.7, 16.0) bagasi,
        Triangular(1.8, 2.4, 3.0) dengan M_i in {1, 5, 9} gerakan akses kursi tanpa hitung ganda sit_time_s).
- P0-C: Algoritma Genetika Jumlah Zona Variabel K in {1..N} (Cut Vector + Priority Keys + Internal Rule)
        dan Evaluasi Monte Carlo Train/Test Split dengan Common Random Numbers (CRN).
"""

from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import random
import math
import itertools
import time

from .config import (
    N_ROWS, SEATS, CAPACITY, LOAD_FACTOR, BAGGAGE_RATIOS,
    ROW_PITCH_M, CELL_M, CELLS_PER_ROW, DT_S, ZONE_CALL_OVERHEAD_S,
    SPEED_MEAN_M_S, SPEED_STD_M_S, SPEED_MIN_M_S, SPEED_MAX_M_S,
    WEIBULL_SHAPE, WEIBULL_SCALE_S,
    TRIANGULAR_MIN_S, TRIANGULAR_MODE_S, TRIANGULAR_MAX_S,
    MOVES_ZERO_BLOCKERS, MOVES_ONE_BLOCKER, MOVES_TWO_BLOCKERS,
    WALK_PER_ROW_S, ENTRY_GAP_S, AISLE_HEADWAY_S, SIT_TIME_S, MOVEMENT_TICK_S,
    K_ZONES, MIN_ROWS_PER_ZONE, MAX_ROWS_PER_ZONE,
    N_TRAIN_REPS_PER_BAG_LEVEL, DEFAULT_TRAIN_REPS, DEFAULT_TEST_REPS, BASE_SEED,
    GA_POPULATION_SIZE, GA_GENERATIONS, GA_ELITE_COUNT,
    GA_MUTATION_RATE, GA_TOURNAMENT_SIZE, GA_DEFAULT_SEED, GA_INTERNAL_RULES,
    EXHAUSTIVE_OPTIMUM_FITNESS_SECONDS, EXHAUSTIVE_OPTIMUM_FITNESS_MINUTES,
    SEAT_PRIORITY, BLOCKERS, LEFT_SIDE, RIGHT_SIDE,
    BEST_GA_CHROMOSOME, FIXED_ZONE_CHROMOSOME
)


def compute_cabin_seat_metadata(
    left_seats: List[str],
    right_seats: List[str]
) -> Tuple[Dict[str, int], Dict[str, List[str]]]:
    """
    Menghitung prioritas kelas kursi (0=Window, 1=Middle, 2=Aisle) dan daftar kursi
    penghalang (blockers) secara otomatis untuk sembarang tata letak lorong tunggal
    (mis. 2-2 ATR 72, 2-3 Airbus A220, atau 3-3 Boeing 737 / Airbus A320).
    """
    priority_map: Dict[str, int] = {}
    blockers_map: Dict[str, List[str]] = {}

    # Sisi kiri: dipesan dari jendela (indeks 0) menuju lorong (indeks terakhir)
    n_left = len(left_seats)
    for idx, s in enumerate(left_seats):
        if idx == n_left - 1:
            priority_map[s] = 2  # Aisle
        elif idx == 0:
            priority_map[s] = 0  # Window
        else:
            priority_map[s] = 1  # Middle
        # Kursi penghalang di sisi kiri adalah kursi di sebelah kanan s hingga lorong
        blockers_map[s] = list(left_seats[idx + 1:])

    # Sisi kanan: dipesan dari lorong (indeks 0) menuju jendela (indeks terakhir)
    n_right = len(right_seats)
    for idx, s in enumerate(right_seats):
        if idx == 0:
            priority_map[s] = 2  # Aisle
        elif idx == n_right - 1:
            priority_map[s] = 0  # Window
        else:
            priority_map[s] = 1  # Middle
        # Kursi penghalang di sisi kanan adalah kursi di sebelah kiri s menuju lorong
        blockers_map[s] = list(right_seats[:idx])

    return priority_map, blockers_map


def create_seat_list(
    n_rows: int = N_ROWS,
    left_seats: Optional[List[str]] = None,
    right_seats: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """Membentuk peta kursi kabin lorong tunggal untuk konfigurasi baris & kolom kursi yang diberikan."""
    l_seats = list(left_seats) if left_seats is not None else ["A", "B", "C"]
    r_seats = list(right_seats) if right_seats is not None else ["D", "E", "F"]
    all_cols = l_seats + r_seats
    left_set = set(l_seats)
    priority_map, blockers_map = compute_cabin_seat_metadata(l_seats, r_seats)

    seats: List[Dict[str, Any]] = []
    for row in range(1, n_rows + 1):
        for seat_index, seat in enumerate(all_cols, start=1):
            seats.append({
                "seat_id": f"R{row:02d}{seat}",
                "row": row,
                "seat": seat,
                "seat_index": seat_index,
                "seat_priority": priority_map[seat],
                "side": "left" if seat in left_set else "right",
                "blocking_seat_ids": [f"R{row:02d}{b}" for b in blockers_map[seat]],
            })
    return seats


ALL_SEATS = create_seat_list(N_ROWS)


def sample_truncated_normal_speed(
    rng: random.Random,
    mean: float = SPEED_MEAN_M_S,
    std: float = SPEED_STD_M_S,
    low: float = 0.0,
    high: float = SPEED_MAX_M_S,
    min_positive: float = SPEED_MIN_M_S
) -> float:
    """
    P0-B: Bangkitkan kecepatan jalan bebas V_i dari distribusi Normal(mean=0.8, std=0.1)
    yang dipotong pada 0 < V_i <= 0.8 m/s.
    """
    for _ in range(100):
        v = rng.gauss(mean, std)
        if low < v <= high:
            return max(min_positive, min(high, v))
    return max(min_positive, min(high, mean))


def sample_seat_access_moves(
    occupied_blockers: int,
    moves_zero: int = MOVES_ZERO_BLOCKERS,
    moves_one: int = MOVES_ONE_BLOCKER,
    moves_two: int = MOVES_TWO_BLOCKERS
) -> int:
    """
    P0-B: Jumlah gerakan akses kursi M_i in {1, 5, 9}:
    - 0 penghalang -> 1 gerakan
    - 1 penghalang -> 5 gerakan
    - 2+ penghalang -> 9 gerakan
    """
    if occupied_blockers <= 0:
        return moves_zero
    if occupied_blockers == 1:
        return moves_one
    return moves_two


def sample_seat_access_time(
    rng: random.Random,
    moves: int,
    tri_min: float = TRIANGULAR_MIN_S,
    tri_mode: float = TRIANGULAR_MODE_S,
    tri_max: float = TRIANGULAR_MAX_S
) -> float:
    """
    P0-B: Durasi gangguan/akses kursi sebagai penjumlahan M_i variabel acak
    Triangular(min=1.8, mode=2.4, max=3.0 detik).
    """
    return sum(rng.triangular(tri_min, tri_max, tri_mode) for _ in range(max(0, moves)))


def deterministic_baggage_count(n_passengers: int, baggage_ratio: float) -> int:
    """
    P0-B: Pembulatan deterministik jumlah pembawa bagasi kabin:
    n_b = floor(n * rho_b + 0.5)
    """
    return int(math.floor(n_passengers * baggage_ratio + 0.5))


def generate_passengers(
    seed: int,
    baggage_ratio: float = 0.60,
    load_factor: float = LOAD_FACTOR,
    walk_per_row_s: float = WALK_PER_ROW_S,
    sit_time_s: float = SIT_TIME_S,
    weibull_scale_s: float = WEIBULL_SCALE_S,
    weibull_shape: float = WEIBULL_SHAPE,
    n_rows: int = N_ROWS,
    left_seats: Optional[List[str]] = None,
    right_seats: Optional[List[str]] = None,
    passenger_count: Optional[int] = None,
    baggage_count: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    P0-B: Pembangkitan penumpang sintetis dengan Common Random Numbers (CRN):
    - Jumlah penumpang n ditentukan dari passenger_count atau floor(capacity * load_factor + 0.5).
    - Jumlah pembawa bagasi n_b ditentukan dari baggage_count atau floor(n * baggage_ratio + 0.5).
    - Kecepatan jalan bebas V_i ~ TruncatedNormal(0.8, 0.1, 0 < V_i <= 0.8 m/s).
    - Durasi simpan bagasi L_i ~ Weibull(shape=1.7, scale=16.0 s) jika has_bag=True, selain itu 0.0.
    - 9 sampel gerakan Triangular(1.8, 2.4, 3.0) dibangkitkan di awal per penumpang agar CRN
      tetap terjaga secara eksak lintas metode boarding.
    """
    seat_pool = (
        ALL_SEATS
        if (n_rows == N_ROWS and left_seats is None and right_seats is None)
        else create_seat_list(n_rows=n_rows, left_seats=left_seats, right_seats=right_seats)
    )
    capacity = len(seat_pool)

    if passenger_count is not None:
        if not (0 <= passenger_count <= capacity):
            raise ValueError(f"passenger_count harus berada pada [0, {capacity}].")
        n_passengers = int(passenger_count)
    else:
        if not (0 < load_factor <= 1.0):
            raise ValueError("load_factor harus berada pada (0, 1].")
        n_passengers = int(math.floor(capacity * load_factor + 0.5))

    if baggage_count is not None:
        if not (0 <= baggage_count <= n_passengers):
            raise ValueError(f"baggage_count harus berada pada [0, {n_passengers}].")
        n_bags = int(baggage_count)
    else:
        if not (0.0 <= baggage_ratio <= 1.0):
            raise ValueError("baggage_ratio harus berada pada [0, 1].")
        n_bags = deterministic_baggage_count(n_passengers, baggage_ratio)

    if n_passengers == 0:
        return []

    rng = random.Random(seed)
    selected = rng.sample(seat_pool, n_passengers)
    bagged_ids = {p["seat_id"] for p in rng.sample(selected, n_bags)}

    # Stream RNG terpisah untuk atribut fisik & kursi agar kompatibel dan deterministik per kursi
    attr_rng = random.Random(seed + 7919)

    passengers: List[Dict[str, Any]] = []
    for idx, seat_info in enumerate(selected, start=1):
        p = dict(seat_info)
        p["passenger_id"] = idx
        p["has_bag"] = p["seat_id"] in bagged_ids
        # random.weibullvariate(alpha=scale, beta=shape)
        p["bag_time_s"] = (
            rng.weibullvariate(weibull_scale_s, weibull_shape)
            if p["has_bag"] else 0.0
        )
        speed_m_s = sample_truncated_normal_speed(attr_rng)
        p["speed_m_s"] = speed_m_s
        p["walk_per_row_s"] = ROW_PITCH_M / speed_m_s if speed_m_s > 0 else walk_per_row_s
        p["sit_time_s"] = 0.0  # P0-B: tidak ada lagi tambahan sit_time_s = 2.0 di luar M_i in {1,5,9}
        # Pre-sample 9 gerakan Triangular(1.8, 2.4, 3.0) untuk Common Random Numbers (CRN)
        max_moves = max(MOVES_ZERO_BLOCKERS, MOVES_ONE_BLOCKER, MOVES_TWO_BLOCKERS, 9)
        p["seat_move_samples_s"] = [
            attr_rng.triangular(TRIANGULAR_MIN_S, TRIANGULAR_MAX_S, TRIANGULAR_MODE_S)
            for _ in range(max_moves)
        ]
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


def steffen_order(passengers: List[Dict[str, Any]], n_rows: Optional[int] = None) -> List[Dict[str, Any]]:
    """Steffen staggered-row variant untuk kabin lorong tunggal."""
    if not passengers:
        return []
    eff_rows = n_rows if n_rows is not None else max(p["row"] for p in passengers)
    rear_parity = eff_rows % 2
    parity_order = [rear_parity, 1 - rear_parity]

    present_seats = {p["seat"] for p in passengers}
    is_standard_33 = present_seats.issubset(set(SEATS)) and all(
        (p["seat_priority"] == 0 if p["seat"] in ("A", "F") else
         p["seat_priority"] == 1 if p["seat"] in ("B", "E") else
         p["seat_priority"] == 2)
        for p in passengers
    )

    if is_standard_33:
        seat_groups = [("A", "F"), ("B", "E"), ("C", "D")]
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

    order = []
    for priority in (0, 1, 2):
        for parity in parity_order:
            for side in ("left", "right"):
                group = [
                    p for p in passengers
                    if p["seat_priority"] == priority and p["row"] % 2 == parity and p["side"] == side
                ]
                order.extend(sorted(group, key=lambda p: (-p["row"], p["seat_index"])))
    return order


def reverse_pyramid_order(passengers: List[Dict[str, Any]], n_rows: Optional[int] = None) -> List[Dict[str, Any]]:
    """Aproksimasi diagonal Reverse Pyramid."""
    if not passengers:
        return []
    eff_rows = n_rows if n_rows is not None else max(N_ROWS, max(p["row"] for p in passengers))
    return sorted(
        passengers,
        key=lambda p: (
            eff_rows - p["row"] + p["seat_priority"],
            p["seat_priority"],
            eff_rows - p["row"],
            p["seat_index"]
        )
    )


def all_valid_zone_sizes(
    n_rows: int = N_ROWS,
    k_zones: int = K_ZONES,
    min_size: int = MIN_ROWS_PER_ZONE,
    max_size: int = MAX_ROWS_PER_ZONE
) -> List[Tuple[int, ...]]:
    """Menghitung partisi ukuran zona K=3 klasik (untuk kompatibilitas v1)."""
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


def validate_chromosome(
    chromosome: Tuple[Tuple[int, ...], Tuple[int, ...]],
    n_rows: int = N_ROWS
) -> bool:
    """
    Validasi representasi kromosom zona (boundaries, zone_order) untuk sembarang K in {1..n_rows}.
    """
    boundaries, zone_order = chromosome
    k = len(boundaries) + 1
    if not (1 <= k <= n_rows):
        raise ValueError(f"Jumlah zona K={k} harus berada pada [1, {n_rows}].")
    if tuple(sorted(boundaries)) != tuple(boundaries):
        raise ValueError("Batas zona harus terurut menaik secara monoton.")
    if len(set(boundaries)) != len(boundaries):
        raise ValueError("Batas zona tidak boleh memiliki duplikat.")
    if any(b < 1 or b >= n_rows for b in boundaries):
        raise ValueError(f"Batas zona harus berada pada [1, {n_rows - 1}].")
    if tuple(sorted(zone_order)) != tuple(range(1, k + 1)):
        raise ValueError(f"Urutan zona harus merupakan permutasi dari {list(range(1, k + 1))}.")
    return True


def equal_zone_boundaries(n_rows: int = N_ROWS, k_zones: int = K_ZONES) -> Tuple[int, ...]:
    eff_k = max(1, min(k_zones, n_rows))
    sizes = [n_rows // eff_k + (1 if i < n_rows % eff_k else 0) for i in range(eff_k)]
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


def rotating_zones_order(
    passengers: List[Dict[str, Any]],
    k_zones: int = 6,
    n_rows: Optional[int] = None
) -> List[Dict[str, Any]]:
    """Rotating Zones: zona belakang dan depan bergantian menuju tengah."""
    if not passengers:
        return []
    eff_rows = n_rows if n_rows is not None else max(N_ROWS, max(p["row"] for p in passengers))
    eff_k = max(1, min(k_zones, eff_rows))
    boundaries = equal_zone_boundaries(eff_rows, eff_k)
    sequence, left, right, take_rear = [], 1, eff_k, True
    while left <= right:
        if take_rear:
            sequence.append(right)
            right -= 1
        else:
            sequence.append(left)
            left += 1
        take_rear = not take_rear
    rank = {z: i for i, z in enumerate(sequence)}

    def key(p: Dict[str, Any]):
        z = zone_of_row(p["row"], boundaries)
        row_key = -p["row"] if z >= (eff_k // 2 + 1) else p["row"]
        return (rank[z], row_key, p["seat_priority"], p["seat_index"])

    return sorted(passengers, key=key)


def modified_optimal_order(passengers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Varian implementasi 4 grup: genap-kiri, genap-kanan, ganjil-kiri, ganjil-kanan."""
    def key(p: Dict[str, Any]):
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
    zone_order: Tuple[int, ...],
    internal_rule: str = "WMA_IN_ZONE"
) -> List[Dict[str, Any]]:
    """
    Mengurutkan penumpang berdasarkan partisi batas zona (untuk sembarang K >= 1),
    urutan panggilan zona `zone_order`, dan aturan internal zona (`WMA_IN_ZONE` atau `BTF_IN_ZONE`).
    Melampirkan atribut `zone_id` pada salinan penumpang untuk pelacakan zona di simulator.
    """
    zone_rank = {zone_id: idx for idx, zone_id in enumerate(zone_order)}
    annotated: List[Dict[str, Any]] = []
    for p in passengers:
        cp = dict(p)
        cp["zone_id"] = zone_of_row(cp["row"], boundaries)
        annotated.append(cp)

    if internal_rule == "BTF_IN_ZONE":
        return sorted(annotated, key=lambda p: (
            zone_rank.get(p["zone_id"], 999),
            -p["row"],
            p["seat_priority"],
            p["seat_index"]
        ))

    return sorted(annotated, key=lambda p: (
        zone_rank.get(p["zone_id"], 999),
        p["seat_priority"],
        -p["row"],
        p["seat_index"]
    ))


def fixed_zone_wma_order(passengers: List[Dict[str, Any]], n_rows: int = N_ROWS) -> List[Dict[str, Any]]:
    boundaries = equal_zone_boundaries(n_rows, K_ZONES)
    order = tuple(range(len(boundaries) + 1, 0, -1))
    return ga_zone_wma_order(passengers, boundaries, order, internal_rule="WMA_IN_ZONE")


def ga_optimized_zone_wma_order(passengers: List[Dict[str, Any]], n_rows: int = N_ROWS) -> List[Dict[str, Any]]:
    """Urutan zona hasil optimasi GA (mendukung skala baris dinamis)."""
    if n_rows == N_ROWS:
        boundaries = tuple(BEST_GA_CHROMOSOME["boundaries"])
        order = tuple(BEST_GA_CHROMOSOME["order"])
    else:
        b1 = max(1, round((n_rows * 5) / 30))
        b2 = min(n_rows - 1, max(b1 + 1, round((n_rows * 18) / 30)))
        boundaries = (b1, b2) if b1 < b2 < n_rows else equal_zone_boundaries(n_rows, min(3, n_rows))
        order = tuple(range(len(boundaries) + 1, 0, -1))
    return ga_zone_wma_order(passengers, boundaries, order, internal_rule="WMA_IN_ZONE")


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
    movement_tick_s: float = MOVEMENT_TICK_S,
    rng: Optional[random.Random] = None
) -> float:
    """
    Menghitung durasi akses kursi.
    Jika rng diberikan, bangkitkan M_i in {1, 5, 9} gerakan Triangular(1.8, 2.4, 3.0).
    Jika rng=None, mengembalikan nilai ekspektasi/modus M_i * movement_tick_s.
    """
    moves = sample_seat_access_moves(n_occupied_blockers, MOVES_ZERO_BLOCKERS, moves_one_blocker, moves_two_blockers)
    if rng is not None:
        return sample_seat_access_time(rng, moves)
    if n_occupied_blockers <= 0:
        return 0.0
    return moves * movement_tick_s


# ==============================================================================
# P0-A: MESIN ANTREAN LORONG BERBASIS SEL (CELLULAR BLOCKING FLOW)
# ==============================================================================

def validate_cellular_trace(
    trace: List[Dict[str, Any]],
    n_passengers: int,
    n_cells: int,
    detail_rows: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Memvalidasi invarian fisik model sel lorong diskret satu dimensi (P0-A):
    1. Kapasitas sel: tidak pernah ada > 1 penumpang pada sel yang sama di waktu yang sama.
    2. Tanpa salip (no overtaking): urutan posisi sel penumpang yang sedang berada di lorong
       selalu monoton terhadap urutan masuk antrean pintu depan.
    3. Kelengkapan: seluruh penumpang mencapai status 'seated'.
    4. Kausalitas waktu: setiap penumpang memiliki finish_time_s > entry_time_s.
    """
    cell_occ: Dict[int, int] = {}
    pax_cell: Dict[int, int] = {}
    entry_rank: Dict[int, int] = {}
    seated_ids = set()
    max_cell_occupancy = 0
    overlap_violations = 0
    overtaking_violations = 0

    for ev in trace:
        etype = ev["type"]
        pid = ev["passenger_id"]
        if etype == "entry":
            c = ev["cell"]
            entry_rank[pid] = len(entry_rank)
            if c in cell_occ and cell_occ[c] != pid:
                overlap_violations += 1
            cell_occ[c] = pid
            pax_cell[pid] = c
            max_cell_occupancy = max(max_cell_occupancy, 1 if cell_occ else 0)
        elif etype == "move":
            fc = ev["from_cell"]
            tc = ev["to_cell"]
            if cell_occ.get(fc) == pid:
                del cell_occ[fc]
            if tc in cell_occ and cell_occ[tc] != pid:
                overlap_violations += 1
            cell_occ[tc] = pid
            pax_cell[pid] = tc
        elif etype == "seated":
            c = ev["cell"]
            if cell_occ.get(c) == pid:
                del cell_occ[c]
            pax_cell.pop(pid, None)
            seated_ids.add(pid)

        # Periksa ketiadaan aksi saling mendahului (no overtaking) di antara penumpang aktif di lorong
        active_by_rank = sorted(pax_cell.items(), key=lambda item: entry_rank.get(item[0], 0))
        for i in range(len(active_by_rank) - 1):
            _, cell_earlier = active_by_rank[i]
            _, cell_later = active_by_rank[i + 1]
            if cell_earlier <= cell_later:
                overtaking_violations += 1

    causality_ok = True
    if detail_rows is not None:
        for d in detail_rows:
            if not (d["finish_time_s"] > d["entry_time_s"]):
                causality_ok = False
                break

    if overlap_violations > 0:
        raise AssertionError(f"Pelanggaran kapasitas sel lorong terdeteksi: {overlap_violations} kejadian.")
    if overtaking_violations > 0:
        raise AssertionError(f"Pelanggaran no-overtaking lorong terdeteksi: {overtaking_violations} kejadian.")
    if len(seated_ids) != n_passengers:
        raise AssertionError(f"Tidak semua penumpang selesai duduk ({len(seated_ids)}/{n_passengers}).")
    if not causality_ok:
        raise AssertionError("Pelanggaran kausalitas: finish_time_s harus > entry_time_s.")

    return {
        "valid": True,
        "max_cell_occupancy": max_cell_occupancy,
        "overlap_violations": overlap_violations,
        "overtaking_violations": overtaking_violations,
        "seated_count": len(seated_ids),
        "causality_ok": causality_ok,
    }


def simulate_boarding_cellular(
    ordered_passengers: List[Dict[str, Any]],
    row_pitch_m: float = ROW_PITCH_M,
    cell_m: float = CELL_M,
    dt_s: float = DT_S,
    zone_call_overhead_s: float = ZONE_CALL_OVERHEAD_S,
    moves_zero_blockers: int = MOVES_ZERO_BLOCKERS,
    moves_one_blocker: int = MOVES_ONE_BLOCKER,
    moves_two_blockers: int = MOVES_TWO_BLOCKERS,
    seed: int = BASE_SEED,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    P0-A & P0-B: Mesin Simulasi Antrean Lorong Berbasis Sel Diskret Satu Dimensi (Cellular Blocking Flow).
    - Ukuran sel `cell_m = 0.4` m, jarak antarbaris `row_pitch_m = 0.8` m (2 sel per baris kursi).
    - Kapasitas ketat maksimal 1 penumpang per sel pada waktu yang sama; tidak boleh mendahului.
    - Jam simulasi diskret `dt_s = 0.25` detik dengan 4 fase terurut:
      Fase 1: Selesaikan penumpang yang telah tuntas duduk di kursinya (bebaskan sel lorong).
      Fase 2: Mulai simpan bagasi (Weibull) & akses kursi (Triangular 1/5/9 gerakan, tanpa tambah sit_time_s)
              bagi penumpang yang mencapai sel baris tujuannya; tetap memblokir sel lorong hingga selesai duduk.
      Fase 3: Majukan penumpang di lorong dari belakang ke depan (c = n_cells-2 turun ke 0) jika sel c+1 kosong.
      Fase 4: Masukkan penumpang dari antrean pintu depan ke sel 0 hanya ketika sel 0 kosong (tanpa jeda tetap 1.0s).
    """
    if not ordered_passengers:
        raise ValueError("Daftar penumpang kosong.")

    n_rows = max(p["row"] for p in ordered_passengers)
    cells_per_row = max(1, int(round(row_pitch_m / cell_m)))
    n_cells = n_rows * cells_per_row

    fallback_rng = random.Random(seed + 31337)

    # Siapkan state internal per penumpang sesuai urutan antrean pintu
    sim_pax: List[Dict[str, Any]] = []
    for q_idx, p in enumerate(ordered_passengers):
        speed_m_s = float(p.get("speed_m_s", 0.0))
        if speed_m_s <= 0.0:
            speed_m_s = sample_truncated_normal_speed(fallback_rng)
        target_row = int(p["row"])
        target_cell = (target_row - 1) * cells_per_row + (cells_per_row - 1)
        move_samples = p.get("seat_move_samples_s")
        if not move_samples or len(move_samples) < max(moves_zero_blockers, moves_one_blocker, moves_two_blockers):
            move_samples = [
                fallback_rng.triangular(TRIANGULAR_MIN_S, TRIANGULAR_MAX_S, TRIANGULAR_MODE_S)
                for _ in range(max(moves_zero_blockers, moves_one_blocker, moves_two_blockers, 9))
            ]

        sim_pax.append({
            "queue_position": q_idx + 1,
            "passenger_id": int(p.get("passenger_id", q_idx + 1)),
            "seat_id": p["seat_id"],
            "row": target_row,
            "seat": p["seat"],
            "has_bag": bool(p["has_bag"]),
            "bag_time_s": float(p.get("bag_time_s", 0.0)) if p.get("has_bag") else 0.0,
            "speed_m_s": speed_m_s,
            "blocking_seat_ids": list(p.get("blocking_seat_ids", [])),
            "zone_id": int(p.get("zone_id", 1)),
            "target_cell": target_cell,
            "seat_move_samples_s": move_samples,
            "state": "queue",  # "queue" -> "walking" -> "seating" -> "seated"
            "cell": None,
            "entry_time_s": None,
            "arrival_target_s": None,
            "move_ready_time_s": None,
            "seating_start_time_s": None,
            "seating_end_time_s": None,
            "seated_time_s": None,
            "occupied_blockers": 0,
            "seat_moves_count": 1,
            "seat_access_s": 0.0,
            "aisle_wait_s": 0.0,
            "currently_blocked_in_aisle": False,
            "cell_enter_times": {},
        })

    cell_occ: List[Optional[Dict[str, Any]]] = [None] * n_cells
    seated_seats = set()
    trace: List[Dict[str, Any]] = []

    queue_cursor = 0
    total_pax = len(sim_pax)
    seated_count = 0
    aisle_events = 0
    aisle_wait_total = 0.0
    seat_events = 0
    occupied_blocker_total = 0

    t = 0.0
    next_zone_allowed_time_s = 0.0
    last_entered_zone_id: Optional[int] = None
    max_steps = 200_000
    steps = 0

    while seated_count < total_pax:
        if steps > max_steps:
            raise RuntimeError("Simulasi melebihi batas langkah maksimum (deadlock guard).")

        # ----------------------------------------------------------------------
        # FASE 1: Selesaikan penumpang yang telah tuntas duduk di kursinya
        # ----------------------------------------------------------------------
        for c in range(n_cells):
            p = cell_occ[c]
            if p is not None and p["state"] == "seating" and t + 1e-9 >= p["seating_end_time_s"]:
                p["state"] = "seated"
                p["seated_time_s"] = round(t, 4)
                p["cell"] = None
                cell_occ[c] = None
                seated_seats.add(p["seat_id"])
                seated_count += 1
                trace.append({
                    "t": round(t, 3),
                    "type": "seated",
                    "passenger_id": p["passenger_id"],
                    "seat_id": p["seat_id"],
                    "row": p["row"],
                    "seat": p["seat"],
                    "cell": c,
                })

        # ----------------------------------------------------------------------
        # FASE 2: Mulai simpan bagasi dan akses kursi bagi penumpang di sel tujuan
        # ----------------------------------------------------------------------
        for c in range(n_cells):
            p = cell_occ[c]
            if (
                p is not None
                and p["state"] == "walking"
                and c == p["target_cell"]
                and t + 1e-9 >= p["move_ready_time_s"]
            ):
                blockers = sum(1 for b_id in p["blocking_seat_ids"] if b_id in seated_seats)
                moves = sample_seat_access_moves(
                    blockers, moves_zero_blockers, moves_one_blocker, moves_two_blockers
                )
                seat_s = sum(p["seat_move_samples_s"][:moves])
                bag_s = p["bag_time_s"]
                service_s = bag_s + seat_s

                if blockers > 0:
                    seat_events += 1
                    occupied_blocker_total += blockers

                p["occupied_blockers"] = blockers
                p["seat_moves_count"] = moves
                p["seat_access_s"] = seat_s
                p["arrival_target_s"] = round(t, 4)
                p["seating_start_time_s"] = round(t, 4)
                p["seating_end_time_s"] = t + service_s
                p["state"] = "seating"
                p["currently_blocked_in_aisle"] = False

                trace.append({
                    "t": round(t, 3),
                    "type": "seating_started",
                    "passenger_id": p["passenger_id"],
                    "seat_id": p["seat_id"],
                    "row": p["row"],
                    "seat": p["seat"],
                    "cell": c,
                    "blockers": blockers,
                    "moves": moves,
                    "bag_time_s": round(bag_s, 3),
                    "seat_access_s": round(seat_s, 3),
                })

                # Jika durasi layanan 0 detik (kasus ekstrem uji), langsung selesaikan
                if service_s <= 1e-9:
                    p["state"] = "seated"
                    p["seated_time_s"] = round(t, 4)
                    p["cell"] = None
                    cell_occ[c] = None
                    seated_seats.add(p["seat_id"])
                    seated_count += 1
                    trace.append({
                        "t": round(t, 3),
                        "type": "seated",
                        "passenger_id": p["passenger_id"],
                        "seat_id": p["seat_id"],
                        "row": p["row"],
                        "seat": p["seat"],
                        "cell": c,
                    })

        # ----------------------------------------------------------------------
        # FASE 3: Pergerakan penumpang di lorong dari belakang ke depan (no overtaking)
        # ----------------------------------------------------------------------
        for c in range(n_cells - 2, -1, -1):
            p = cell_occ[c]
            if p is not None and p["state"] == "walking" and c < p["target_cell"]:
                if t + 1e-9 >= p["move_ready_time_s"]:
                    if cell_occ[c + 1] is None:
                        cell_occ[c + 1] = p
                        cell_occ[c] = None
                        p["cell"] = c + 1
                        p["cell_enter_times"][c + 1] = round(t, 4)
                        p["move_ready_time_s"] = t + (cell_m / p["speed_m_s"])
                        p["currently_blocked_in_aisle"] = False
                        trace.append({
                            "t": round(t, 3),
                            "type": "move",
                            "passenger_id": p["passenger_id"],
                            "seat_id": p["seat_id"],
                            "from_cell": c,
                            "to_cell": c + 1,
                        })
                    else:
                        # Sel di depan terhalang: tetap di sel c tanpa menumpuk kredit gerak
                        p["aisle_wait_s"] += dt_s
                        aisle_wait_total += dt_s
                        if not p["currently_blocked_in_aisle"]:
                            aisle_events += 1
                            p["currently_blocked_in_aisle"] = True

        # ----------------------------------------------------------------------
        # FASE 4: Masuk dari antrean pintu depan ke sel 0 jika sel 0 kosong
        # ----------------------------------------------------------------------
        if queue_cursor < total_pax and cell_occ[0] is None:
            next_pax = sim_pax[queue_cursor]
            if (
                last_entered_zone_id is not None
                and next_pax["zone_id"] != last_entered_zone_id
                and zone_call_overhead_s > 0.0
            ):
                if t + 1e-9 < next_zone_allowed_time_s:
                    can_enter = False
                else:
                    can_enter = True
            else:
                can_enter = True

            if can_enter:
                queue_cursor += 1
                last_entered_zone_id = next_pax["zone_id"]
                if (
                    queue_cursor < total_pax
                    and sim_pax[queue_cursor]["zone_id"] != last_entered_zone_id
                    and zone_call_overhead_s > 0.0
                ):
                    next_zone_allowed_time_s = t + zone_call_overhead_s

                cell_occ[0] = next_pax
                next_pax["state"] = "walking"
                next_pax["cell"] = 0
                next_pax["entry_time_s"] = round(t, 4)
                next_pax["cell_enter_times"][0] = round(t, 4)
                next_pax["move_ready_time_s"] = t + (cell_m / next_pax["speed_m_s"])
                trace.append({
                    "t": round(t, 3),
                    "type": "entry",
                    "passenger_id": next_pax["passenger_id"],
                    "seat_id": next_pax["seat_id"],
                    "cell": 0,
                    "zone_id": next_pax["zone_id"],
                })

        if seated_count >= total_pax:
            break

        t = round(t + dt_s, 6)
        steps += 1

    # Bangun PassengerTimelineDetail beserta segmen aisle_transit per baris untuk UI
    detail_rows: List[Dict[str, Any]] = []
    for p in sim_pax:
        target_row = p["row"]
        c_times = p["cell_enter_times"]
        entry_s = float(p["entry_time_s"])
        finish_s = float(p["seated_time_s"])
        arrival_target_s = float(p["arrival_target_s"])

        aisle_transit: List[Dict[str, Any]] = []
        for r in range(1, target_row + 1):
            first_cell_of_row = (r - 1) * cells_per_row
            row_enter_s = float(c_times.get(first_cell_of_row, entry_s))
            if r < target_row:
                first_cell_of_next_row = r * cells_per_row
                row_leave_s = float(c_times.get(first_cell_of_next_row, arrival_target_s))
                aisle_transit.append({
                    "row": r,
                    "enter_s": round(row_enter_s, 3),
                    "leave_s": round(row_leave_s, 3),
                    "is_target_row": False,
                })
            else:
                aisle_transit.append({
                    "row": target_row,
                    "enter_s": round(row_enter_s, 3),
                    "leave_s": round(finish_s, 3),
                    "is_target_row": True,
                })

        detail_rows.append({
            "queue_position": p["queue_position"],
            "seat_id": p["seat_id"],
            "row": target_row,
            "seat": p["seat"],
            "has_bag": p["has_bag"],
            "entry_time_s": round(entry_s, 3),
            "arrival_target_s": round(arrival_target_s, 3),
            "aisle_wait_s": round(p["aisle_wait_s"], 3),
            "occupied_blockers": p["occupied_blockers"],
            "seat_interference_s": round(p["seat_access_s"], 3),
            "bag_stowage_s": round(p["bag_time_s"], 3),
            "finish_time_s": round(finish_s, 3),
            "aisle_transit": aisle_transit,
        })

    total_boarding_s = max(d["finish_time_s"] for d in detail_rows) if detail_rows else 0.0
    metrics = {
        "boarding_time_seconds": round(total_boarding_s, 3),
        "boarding_time_minutes": round(total_boarding_s / 60.0, 3),
        "aisle_interference_events": aisle_events,
        "aggregate_aisle_wait_person_seconds": round(aisle_wait_total, 3),
        "aisle_wait_seconds": round(aisle_wait_total, 3),
        "seat_interference_events": seat_events,
        "occupied_blocker_count": occupied_blocker_total,
        "baggage_count": sum(1 for p in sim_pax if p["has_bag"]),
        "passenger_count": len(sim_pax),
    }

    return metrics, detail_rows, trace


def simulate_boarding(
    ordered_passengers: List[Dict[str, Any]],
    entry_gap_s: float = ENTRY_GAP_S,
    aisle_headway_s: float = AISLE_HEADWAY_S,
    moves_one_blocker: int = MOVES_ONE_BLOCKER,
    moves_two_blockers: int = MOVES_TWO_BLOCKERS,
    movement_tick_s: float = MOVEMENT_TICK_S,
    row_pitch_m: float = ROW_PITCH_M,
    cell_m: float = CELL_M,
    dt_s: float = DT_S,
    zone_call_overhead_s: float = ZONE_CALL_OVERHEAD_S,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """
    Antarmuka standar `simulate_boarding` yang menjalankan mesin antrean lorong
    berbasis sel diskret P0-A & P0-B dan mengembalikan `(metrics, detail_rows)`.
    """
    metrics, detail_rows, _ = simulate_boarding_cellular(
        ordered_passengers=ordered_passengers,
        row_pitch_m=row_pitch_m,
        cell_m=cell_m,
        dt_s=dt_s,
        zone_call_overhead_s=zone_call_overhead_s,
        moves_zero_blockers=MOVES_ZERO_BLOCKERS,
        moves_one_blocker=moves_one_blocker,
        moves_two_blockers=moves_two_blockers,
    )
    return metrics, detail_rows


# Katalog pembangun metode yang didukung
SUPPORTED_METHODS = [
    {
        "id": "MB01",
        "name": "Back-to-Front-WILMA",
        "category": "Window-Middle-Aisle (Hybrid)",
        "description": "Baris belakang ke depan; WMA sebagai prioritas dalam baris.",
        "note": "Metode hibrida baris belakang ke depan dengan urutan jendela-tengah-lorong.",
    },
    {
        "id": "MB02",
        "name": "Reverse Pyramid (approximation)",
        "category": "Diagonal Aproksimasi",
        "description": "Urutan diagonal menggabungkan jarak dari belakang dan prioritas kursi.",
        "note": "Aproksimasi diagonal jarak baris dan kelas kursi.",
    },
    {
        "id": "MB03",
        "name": "GA-Zone-WMA",
        "category": "Algoritma Genetika (AZBO Variable-K)",
        "description": "GA mengoptimasi jumlah zona K in {1..N}, batas baris, urutan panggilan zona, dan aturan internal.",
        "note": "Dievaluasi dengan pemisahan replikasi Training dan Testing Monte Carlo (CRN).",
    },
    {
        "id": "MB04",
        "name": "Exhaustive-Zone-WMA",
        "category": "Pencarian Eksak",
        "description": "Audit enumerasi partisi dan urutan zona dengan aturan WMA dalam zona.",
        "note": "Pembanding eksak untuk memverifikasi kualitas konvergensi GA.",
    },
    {
        "id": "MB05",
        "name": "Fixed-Zone-WMA",
        "category": "Zona Klasik",
        "description": "Tiga zona seimbang; panggilan belakang ke depan [3, 2, 1]; WMA dalam zona.",
        "note": "Baseline pembanding untuk mengukur manfaat optimasi batas dan jumlah zona.",
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
        "description": "Window, middle, aisle; baris belakang ke depan dalam kelas kursi.",
        "note": "Mengurangi interferensi kursi secara efektif.",
    },
    {
        "id": "MB08",
        "name": "Modified Optimal (implementation variant)",
        "category": "Varian Grup",
        "description": "Empat grup paritas baris dan sisi kabin (genap/ganjil, kiri/kanan).",
        "note": "Varian implementasi 4 kelompok paritas baris.",
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
    custom_zone_order: Optional[Tuple[int, ...]] = None,
    internal_rule: str = "WMA_IN_ZONE",
    n_rows: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Dispatcher urutan boarding berdasarkan nama metode."""
    if not passengers:
        return []
    eff_rows = n_rows if n_rows is not None else max(p["row"] for p in passengers)

    if method_name == "Back-to-Front-WILMA":
        return back_to_front_wilma_order(passengers)
    elif method_name == "Reverse Pyramid (approximation)":
        return reverse_pyramid_order(passengers, eff_rows)
    elif method_name in ("GA-Zone-WMA", "GA-Zone-AZBO", "Exhaustive-Zone-WMA"):
        if custom_zone_boundaries is not None and custom_zone_order is not None:
            return ga_zone_wma_order(
                passengers, tuple(custom_zone_boundaries), tuple(custom_zone_order), internal_rule=internal_rule
            )
        return ga_optimized_zone_wma_order(passengers, eff_rows)
    elif method_name == "Fixed-Zone-WMA":
        return fixed_zone_wma_order(passengers, eff_rows)
    elif method_name == "Back-to-Front":
        return back_to_front_order(passengers, seed)
    elif method_name == "Outside-In/WMA":
        return outside_in_order(passengers)
    elif method_name == "Modified Optimal (implementation variant)":
        return modified_optimal_order(passengers)
    elif method_name == "Steffen (staggered-row implementation)":
        return steffen_order(passengers, eff_rows)
    elif method_name == "Random":
        return random_order(passengers, seed)
    elif method_name == "Rotating Zones":
        return rotatingZonesOrderCompat(passengers, eff_rows)
    elif method_name == "Front-to-Back":
        return front_to_back_order(passengers, seed)
    else:
        raise ValueError(f"Metode '{method_name}' tidak didukung oleh engine Python.")


def rotatingZonesOrderCompat(passengers: List[Dict[str, Any]], n_rows: int = N_ROWS) -> List[Dict[str, Any]]:
    return rotating_zones_order(passengers, k_zones=6, n_rows=n_rows)


# ==============================================================================
# P0-C: REPRESENTASI KROMOSOM CUT-VECTOR K VARIABEL (K in {1..N}) & GA
# ==============================================================================

@dataclass
class CutChromosome:
    """
    Representasi Kromosom Zona Variabel P0-C:
    - cuts: vektor pemotong biner c = (c_1, ..., c_{N-1}) in {0,1}^{N-1}.
            c_j = 1 berarti ada batas zona setelah baris j.
            Jumlah zona K(c) = 1 + sum(cuts) in {1, ..., N}.
    - priority_keys: vektor kunci prioritas real p in R^N untuk mengurutkan pemanggilan zona.
    - internal_rule: aturan pengurutan di dalam zona ("WMA_IN_ZONE" atau "BTF_IN_ZONE").
    """
    cuts: List[int]
    priority_keys: List[float]
    internal_rule: str = "WMA_IN_ZONE"


def decode_zones(cuts: List[int]) -> List[Tuple[int, int]]:
    """
    Mengonversi vektor pemotong biner `cuts` berukuran N-1 menjadi daftar interval baris
    kontigu [(r_start, r_end), ...] untuk masing-masing zona z = 1..K.
    """
    n_rows = len(cuts) + 1
    zones: List[Tuple[int, int]] = []
    start = 1
    for r in range(1, n_rows):
        if cuts[r - 1] == 1:
            zones.append((start, r))
            start = r + 1
    zones.append((start, n_rows))
    return zones


def zones_to_boundaries_and_sizes(zones: List[Tuple[int, int]]) -> Tuple[Tuple[int, ...], Tuple[int, ...]]:
    """Mengonversi daftar interval zona [(start, end), ...] menjadi (boundaries, sizes)."""
    boundaries = tuple(end for _, end in zones[:-1])
    sizes = tuple(end - start + 1 for start, end in zones)
    return boundaries, sizes


def zone_order_from_keys(zones: List[Tuple[int, int]], priority_keys: List[float]) -> List[int]:
    """
    Menurunkan urutan pemanggilan zona (1-based zone IDs: 1..K) dengan mengurutkan
    zona berdasarkan nilai kunci prioritas dari baris awal masing-masing zona.
    """
    indexed = []
    for z_idx, (r_start, _) in enumerate(zones, start=1):
        key_val = priority_keys[r_start - 1] if (r_start - 1) < len(priority_keys) else float(z_idx)
        indexed.append((key_val, -r_start, z_idx))
    indexed.sort(key=lambda item: (item[0], item[1]))
    return [item[2] for item in indexed]


def decode_cut_chromosome(chrom: CutChromosome) -> Dict[str, Any]:
    """Mendekode CutChromosome menjadi struktur K, zones, boundaries, sizes, zone_order, dan internal_rule."""
    zones = decode_zones(chrom.cuts)
    boundaries, sizes = zones_to_boundaries_and_sizes(zones)
    zone_order = zone_order_from_keys(zones, chrom.priority_keys)
    return {
        "k_zones": len(zones),
        "zones": zones,
        "boundaries": list(boundaries),
        "sizes": list(sizes),
        "zone_order": zone_order,
        "internal_rule": chrom.internal_rule,
        "cuts": list(chrom.cuts),
    }


def encode_boundaries_order_to_cut_chromosome(
    n_rows: int,
    boundaries: Tuple[int, ...],
    zone_order: Tuple[int, ...],
    internal_rule: str = "WMA_IN_ZONE"
) -> CutChromosome:
    """Mengonversi batas baris (boundaries) dan urutan panggilan zona (zone_order) ke CutChromosome."""
    cuts = [0] * max(0, n_rows - 1)
    for b in boundaries:
        if 1 <= b < n_rows:
            cuts[b - 1] = 1
    zones = decode_zones(cuts)
    priority_keys = [1.0] * n_rows
    for rank_idx, z_id in enumerate(zone_order):
        if 1 <= z_id <= len(zones):
            r_start, r_end = zones[z_id - 1]
            val = (rank_idx + 0.5) / max(1, len(zones))
            for r in range(r_start, r_end + 1):
                priority_keys[r - 1] = val
    return CutChromosome(cuts=cuts, priority_keys=priority_keys, internal_rule=internal_rule)


def build_order_from_cut_chromosome(
    passengers: List[Dict[str, Any]],
    chrom: CutChromosome
) -> List[Dict[str, Any]]:
    """Membangun urutan antrean penumpang dari CutChromosome untuk sembarang K in {1..N}."""
    decoded = decode_cut_chromosome(chrom)
    return ga_zone_wma_order(
        passengers=passengers,
        boundaries=tuple(decoded["boundaries"]),
        zone_order=tuple(decoded["zone_order"]),
        internal_rule=chrom.internal_rule,
    )


def random_cut_chromosome_conditional_k(
    rng: random.Random,
    n_rows: int,
    allowed_rules: Tuple[str, ...] = GA_INTERNAL_RULES
) -> CutChromosome:
    """
    P0-C: Bangkitkan kromosom acak dengan distribusi jumlah zona K yang seimbang:
    1. Pilih K ~ UniformDiscrete(1, N).
    2. Pilih K - 1 posisi pemotong unik secara acak dari {1, ..., N - 1}.
    3. Bangkitkan priority_keys ~ Uniform(0, 1)^N dan internal_rule acak.
    """
    if n_rows <= 1:
        return CutChromosome(cuts=[], priority_keys=[0.5], internal_rule=allowed_rules[0])

    k = rng.randint(1, n_rows)
    cuts = [0] * (n_rows - 1)
    if k > 1:
        cut_positions = rng.sample(range(n_rows - 1), k - 1)
        for pos in cut_positions:
            cuts[pos] = 1
    priority_keys = [rng.random() for _ in range(n_rows)]
    rule = rng.choice(list(allowed_rules))
    return CutChromosome(cuts=cuts, priority_keys=priority_keys, internal_rule=rule)


def init_variable_k_population(
    rng: random.Random,
    n_rows: int,
    population_size: int = GA_POPULATION_SIZE,
    allowed_rules: Tuple[str, ...] = GA_INTERNAL_RULES
) -> List[CutChromosome]:
    """
    P0-C: Inisialisasi populasi awal GA yang menjamin keterwakilan lintas nilai K in {1..N}:
    - Menyertakan kandidat terstruktur untuk K = 1, 2, 3, ..., min(N, 8) dan K = N
      dengan panggilan belakang-ke-depan (serta depan-ke-belakang/alternating) dan kedua aturan internal.
    - Sisanya diisi dengan sampling kondisional K ~ UniformDiscrete(1, N).
    """
    population: List[CutChromosome] = []

    # Kunci prioritas belakang-ke-depan (baris besar dipanggil lebih dulu)
    btf_keys = [1.0 - (r / (n_rows + 1.0)) for r in range(1, n_rows + 1)]

    # 1. Seed terstruktur untuk berbagai nilai K (K=1..min(n_rows, 8) dan K=n_rows)
    seed_k_values = list(range(1, min(n_rows, 8) + 1))
    if n_rows not in seed_k_values:
        seed_k_values.append(n_rows)

    for k in seed_k_values:
        bounds = equal_zone_boundaries(n_rows, k)
        cuts = [0] * max(0, n_rows - 1)
        for b in bounds:
            if 1 <= b < n_rows:
                cuts[b - 1] = 1
        for rule in allowed_rules:
            if len(population) < population_size:
                population.append(
                    CutChromosome(cuts=list(cuts), priority_keys=list(btf_keys), internal_rule=rule)
                )

    # Jika n_rows == 30, sertakan juga kandidat referensi [5, 18] agar ruang K=3 asimetris terwakili
    if n_rows == 30 and len(population) < population_size:
        population.append(
            encode_boundaries_order_to_cut_chromosome(30, (5, 18), (3, 2, 1), "WMA_IN_ZONE")
        )

    # 2. Isi sisa populasi dengan sampling kondisional K ~ UniformDiscrete(1, N)
    while len(population) < population_size:
        population.append(random_cut_chromosome_conditional_k(rng, n_rows, allowed_rules))

    return population[:population_size]


def crossover_variable_k(
    parent_a: CutChromosome,
    parent_b: CutChromosome,
    rng: random.Random
) -> CutChromosome:
    """
    P0-C: Operator crossover untuk kromosom CutChromosome:
    - Uniform / 1-point crossover pada vektor pemotong biner `cuts`.
    - Blend crossover pada `priority_keys`.
    - Pewarisan `internal_rule` dari salah satu induk.
    Setiap vektor biner di {0,1}^{N-1} adalah partisi zona yang valid (K in {1..N}).
    """
    n_cuts = len(parent_a.cuts)
    if n_cuts == 0:
        return CutChromosome(cuts=[], priority_keys=list(parent_a.priority_keys), internal_rule=parent_a.internal_rule)

    if rng.random() < 0.5 and n_cuts > 1:
        split = rng.randint(1, n_cuts - 1)
        child_cuts = parent_a.cuts[:split] + parent_b.cuts[split:]
    else:
        child_cuts = [
            (a if rng.random() < 0.5 else b)
            for a, b in zip(parent_a.cuts, parent_b.cuts)
        ]

    alpha = rng.random()
    child_keys = [
        alpha * ka + (1.0 - alpha) * kb
        for ka, kb in zip(parent_a.priority_keys, parent_b.priority_keys)
    ]
    child_rule = parent_a.internal_rule if rng.random() < 0.5 else parent_b.internal_rule
    return CutChromosome(cuts=child_cuts, priority_keys=child_keys, internal_rule=child_rule)


def mutate_variable_k(
    chrom: CutChromosome,
    rng: random.Random,
    mutation_rate: float = GA_MUTATION_RATE,
    allowed_rules: Tuple[str, ...] = GA_INTERNAL_RULES
) -> CutChromosome:
    """
    P0-C: Operator mutasi jumlah zona & struktur zona:
    - Mutasi potong/gabung zona:
      (a) Split satu zona menjadi dua (ubah satu bit 0 -> 1), menambah K menjadi K + 1.
      (b) Gabung dua zona bersebelahan (ubah satu bit 1 -> 0), mengurangi K menjadi K - 1.
      (c) Geser batas zona (pindahkan bit 1 ke tetangganya).
      (d) Reset ke K acak baru ~ UniformDiscrete(1, N).
    - Mutasi `priority_keys`: perturbasi Gaussian atau tukar dua kunci baris awal zona.
    - Mutasi `internal_rule`: balik aturan internal zona ("WMA_IN_ZONE" <-> "BTF_IN_ZONE").
    """
    new_cuts = list(chrom.cuts)
    new_keys = list(chrom.priority_keys)
    new_rule = chrom.internal_rule
    n_cuts = len(new_cuts)
    n_rows = len(new_keys)

    if n_cuts > 0 and rng.random() < mutation_rate:
        op = rng.choice(["split", "merge", "shift", "flip", "resample_k"])
        ones = [i for i, b in enumerate(new_cuts) if b == 1]
        zeros = [i for i, b in enumerate(new_cuts) if b == 0]

        if op == "split" and zeros:
            new_cuts[rng.choice(zeros)] = 1
        elif op == "merge" and ones:
            new_cuts[rng.choice(ones)] = 0
        elif op == "shift" and ones:
            idx = rng.choice(ones)
            direction = rng.choice([-1, 1])
            target = idx + direction
            if 0 <= target < n_cuts and new_cuts[target] == 0:
                new_cuts[idx] = 0
                new_cuts[target] = 1
        elif op == "resample_k":
            k_new = rng.randint(1, n_rows)
            new_cuts = [0] * n_cuts
            if k_new > 1:
                for pos in rng.sample(range(n_cuts), k_new - 1):
                    new_cuts[pos] = 1
        else:
            flip_idx = rng.randrange(n_cuts)
            new_cuts[flip_idx] = 1 - new_cuts[flip_idx]

    if n_rows > 1 and rng.random() < mutation_rate:
        for _ in range(max(1, n_rows // 6)):
            i = rng.randrange(n_rows)
            new_keys[i] = min(1.0, max(0.0, new_keys[i] + rng.gauss(0.0, 0.25)))
        if rng.random() < 0.5:
            i, j = rng.sample(range(n_rows), 2)
            new_keys[i], new_keys[j] = new_keys[j], new_keys[i]

    if len(allowed_rules) > 1 and rng.random() < (mutation_rate * 0.5):
        others = [r for r in allowed_rules if r != new_rule]
        if others:
            new_rule = rng.choice(others)

    return CutChromosome(cuts=new_cuts, priority_keys=new_keys, internal_rule=new_rule)


def _cut_chromosome_cache_key(chrom: CutChromosome) -> Tuple[Tuple[int, ...], Tuple[int, ...], str]:
    decoded = decode_cut_chromosome(chrom)
    return (tuple(decoded["boundaries"]), tuple(decoded["zone_order"]), chrom.internal_rule)


def evaluate_cut_chromosome_on_batches(
    chrom: CutChromosome,
    batches: List[Dict[str, Any]],
    fitness_cache: Optional[Dict[Tuple[Tuple[int, ...], Tuple[int, ...], str], float]] = None
) -> float:
    """
    Mengevaluasi rata-rata waktu boarding (detik) dari sebuah CutChromosome
    pada kumpulan replikasi training (CRN).
    """
    key = _cut_chromosome_cache_key(chrom)
    if fitness_cache is not None and key in fitness_cache:
        return fitness_cache[key]

    boundaries, zone_order, rule = key
    times: List[float] = []
    for batch in batches:
        ordered = ga_zone_wma_order(
            passengers=batch["passengers"],
            boundaries=boundaries,
            zone_order=zone_order,
            internal_rule=rule,
        )
        metrics, _ = simulate_boarding(ordered)
        times.append(metrics["boarding_time_seconds"])

    mean_time = sum(times) / len(times) if times else 0.0
    if fitness_cache is not None:
        fitness_cache[key] = mean_time
    return mean_time


def run_mini_exhaustive_variable_k(
    train_batches: List[Dict[str, Any]],
    n_rows: int,
    allowed_rules: Tuple[str, ...] = GA_INTERNAL_RULES
) -> Dict[str, Any]:
    """
    P0-C (Test F): Enumerasi eksak seluruh partisi zona K in {1..n_rows}, seluruh urutan
    pemanggilan zona, dan aturan internal zona pada kabin mini (mis. n_rows <= 5)
    untuk memverifikasi kualitas pencarian GA terhadap solusi optimum global eksak.
    """
    if n_rows > 6:
        raise ValueError("run_mini_exhaustive_variable_k dikhususkan untuk kabin mini (n_rows <= 6).")

    best_score = float("inf")
    best_config: Optional[Dict[str, Any]] = None
    total_evaluated = 0

    for cut_bits in itertools.product([0, 1], repeat=max(0, n_rows - 1)):
        cuts = list(cut_bits)
        zones = decode_zones(cuts)
        k = len(zones)
        boundaries, sizes = zones_to_boundaries_and_sizes(zones)
        for order in itertools.permutations(range(1, k + 1)):
            for rule in allowed_rules:
                total_evaluated += 1
                times = []
                for batch in train_batches:
                    ordered = ga_zone_wma_order(
                        passengers=batch["passengers"],
                        boundaries=boundaries,
                        zone_order=order,
                        internal_rule=rule,
                    )
                    metrics, _ = simulate_boarding(ordered)
                    times.append(metrics["boarding_time_seconds"])
                score = sum(times) / len(times)
                if score < best_score:
                    best_score = score
                    best_config = {
                        "k_zones": k,
                        "cuts": cuts,
                        "zones": zones,
                        "boundaries": list(boundaries),
                        "sizes": list(sizes),
                        "zone_order": list(order),
                        "internal_rule": rule,
                        "training_fitness_seconds": round(score, 3),
                    }

    return {
        "n_rows": n_rows,
        "total_candidates_evaluated": total_evaluated,
        "best_candidate": best_config,
    }


def run_variable_k_ga(
    train_batches: List[Dict[str, Any]],
    n_rows: int,
    population_size: int = GA_POPULATION_SIZE,
    generations: int = GA_GENERATIONS,
    elite_count: int = GA_ELITE_COUNT,
    mutation_rate: float = GA_MUTATION_RATE,
    tournament_size: int = GA_TOURNAMENT_SIZE,
    ga_seed: int = GA_DEFAULT_SEED,
    allowed_rules: Tuple[str, ...] = GA_INTERNAL_RULES,
) -> Dict[str, Any]:
    """
    P0-C: Menjalankan Algoritma Genetika dengan Jumlah Zona Variabel K in {1..N}
    pada kumpulan replikasi Training (CRN).
    """
    rng = random.Random(ga_seed)
    population = init_variable_k_population(rng, n_rows, population_size, allowed_rules)
    fitness_cache: Dict[Tuple[Tuple[int, ...], Tuple[int, ...], str], float] = {}

    best_chrom: Optional[CutChromosome] = None
    best_score = float("inf")
    history: List[Dict[str, Any]] = []
    explored_k_values = set()

    for gen in range(generations + 1):
        scored: List[Tuple[float, CutChromosome]] = []
        for chrom in population:
            explored_k_values.add(1 + sum(chrom.cuts))
            score = evaluate_cut_chromosome_on_batches(chrom, train_batches, fitness_cache)
            scored.append((score, chrom))

        scored.sort(key=lambda item: item[0])
        gen_best_score, gen_best_chrom = scored[0]
        gen_mean_score = sum(s for s, _ in scored) / len(scored)
        gen_worst_score = scored[-1][0]

        if gen_best_score < best_score:
            best_score = gen_best_score
            best_chrom = gen_best_chrom

        assert best_chrom is not None
        decoded_best = decode_cut_chromosome(best_chrom)

        history.append({
            "generation": gen,
            "best_fitness_seconds": round(best_score, 3),
            "best_fitness_minutes": round(best_score / 60.0, 3),
            "generation_best_fitness_seconds": round(gen_best_score, 3),
            "mean_fitness_seconds": round(gen_mean_score, 3),
            "mean_fitness_minutes": round(gen_mean_score / 60.0, 3),
            "worst_fitness_seconds": round(gen_worst_score, 3),
            "best_k_zones": decoded_best["k_zones"],
            "best_boundaries": decoded_best["boundaries"],
            "best_sizes": decoded_best["sizes"],
            "best_order": decoded_best["zone_order"],
            "best_internal_rule": decoded_best["internal_rule"],
            "unique_candidates_evaluated": len(fitness_cache),
        })

        if gen == generations:
            break

        next_pop: List[CutChromosome] = [chrom for _, chrom in scored[:elite_count]]
        while len(next_pop) < population_size:
            k_tour = min(tournament_size, len(scored))
            pa = min(rng.sample(scored, k_tour), key=lambda x: x[0])[1]
            pb = min(rng.sample(scored, k_tour), key=lambda x: x[0])[1]
            child = crossover_variable_k(pa, pb, rng)
            child = mutate_variable_k(child, rng, mutation_rate, allowed_rules)
            next_pop.append(child)
        population = next_pop

    assert best_chrom is not None
    final_decoded = decode_cut_chromosome(best_chrom)

    sorted_cache = sorted(fitness_cache.items(), key=lambda item: item[1])
    top_candidates = []
    for idx, ((bounds, order, rule), score) in enumerate(sorted_cache[:10], start=1):
        sizes = list(boundaries_to_sizes(bounds, n_rows))
        top_candidates.append({
            "candidate_id": idx,
            "k_zones": len(sizes),
            "zone_boundaries": list(bounds),
            "zone_sizes": sizes,
            "zone_order": list(order),
            "internal_rule": rule,
            "training_fitness_seconds": round(score, 3),
            "training_fitness_minutes": round(score / 60.0, 3),
        })

    return {
        "best_chromosome": best_chrom,
        "best_decoded": final_decoded,
        "best_training_fitness_seconds": round(best_score, 3),
        "best_training_fitness_minutes": round(best_score / 60.0, 3),
        "unique_candidates_evaluated": len(fitness_cache),
        "explored_k_values": sorted(list(explored_k_values)),
        "generation_history": history,
        "top_candidates": top_candidates,
    }


def compute_mc_summary(values: List[float]) -> Dict[str, float]:
    """
    P0-C: Menghitung rata-rata sampel, simpangan baku sampel (denominator R - 1),
    dan interval kepercayaan 95% (mean +/- 1.96 * s / sqrt(R)).
    """
    r = len(values)
    if r == 0:
        return {
            "mean": 0.0,
            "sd": 0.0,
            "std": 0.0,
            "ci95_low": 0.0,
            "ci95_high": 0.0,
            "margin_of_error": 0.0,
            "min": 0.0,
            "max": 0.0,
            "median": 0.0,
        }
    mean_v = sum(values) / r
    var_v = sum((x - mean_v) ** 2 for x in values) / (r - 1) if r > 1 else 0.0
    sd_v = math.sqrt(var_v)
    hw = 1.96 * sd_v / math.sqrt(r) if r > 1 else 0.0
    sorted_v = sorted(values)
    median_v = sorted_v[r // 2] if r % 2 == 1 else (sorted_v[r // 2 - 1] + sorted_v[r // 2]) / 2.0
    return {
        "mean": round(mean_v, 3),
        "sd": round(sd_v, 3),
        "std": round(sd_v, 3),
        "ci95_low": round(mean_v - hw, 3),
        "ci95_high": round(mean_v + hw, 3),
        "margin_of_error": round(hw, 3),
        "min": round(sorted_v[0], 3),
        "max": round(sorted_v[-1], 3),
        "median": round(median_v, 3),
    }


def compute_paired_difference_summary(
    times_a: List[float],
    times_b: List[float]
) -> Dict[str, Any]:
    """
    P0-C: Menghitung statistik selisih berpasangan Delta_r = T_r^A - T_r^B
    pada replikasi testing yang menggunakan Common Random Numbers (CRN).
    Jika mean_diff < 0, maka metode A lebih cepat daripada metode B.
    """
    if len(times_a) != len(times_b) or not times_a:
        return {
            "replications": 0,
            "mean_diff_s": 0.0,
            "sd_diff_s": 0.0,
            "ci95_low_s": 0.0,
            "ci95_high_s": 0.0,
            "statistically_significant_95": False,
            "paired_deltas_s": [],
        }
    deltas = [round(a - b, 4) for a, b in zip(times_a, times_b)]
    stats = compute_mc_summary(deltas)
    sig = (stats["ci95_high"] < 0.0) or (stats["ci95_low"] > 0.0)
    return {
        "replications": len(deltas),
        "mean_diff_s": stats["mean"],
        "sd_diff_s": stats["sd"],
        "ci95_low_s": stats["ci95_low"],
        "ci95_high_s": stats["ci95_high"],
        "statistically_significant_95": sig,
        "paired_deltas_s": [round(d, 3) for d in deltas],
    }


def run_azbo_optimization(
    n_rows: int = N_ROWS,
    left_seats: Optional[List[str]] = None,
    right_seats: Optional[List[str]] = None,
    passenger_count: Optional[int] = None,
    bag_ratio: float = 0.60,
    baggage_count: Optional[int] = None,
    train_replications: int = DEFAULT_TRAIN_REPS,
    test_replications: int = DEFAULT_TEST_REPS,
    base_seed: int = BASE_SEED,
    ga_seed: int = GA_DEFAULT_SEED,
    population_size: int = GA_POPULATION_SIZE,
    generations: int = GA_GENERATIONS,
    elite_count: int = GA_ELITE_COUNT,
    mutation_rate: float = GA_MUTATION_RATE,
    tournament_size: int = GA_TOURNAMENT_SIZE,
    row_pitch_m: float = ROW_PITCH_M,
    cell_m: float = CELL_M,
    dt_s: float = DT_S,
    zone_call_overhead_s: float = ZONE_CALL_OVERHEAD_S,
) -> Dict[str, Any]:
    """
    P0-A + P0-B + P0-C End-to-End AZBO Optimization & Monte Carlo Train/Test Pipeline
    (Sesuai kontrak `/api/v2/azbo/optimize` pada Blueprint Bagian 9.2):
    1. Bangkitkan kumpulan seed Training (`train_seeds`) dan Testing (`test_seeds`) yang saling lepas (disjoint).
    2. Jalankan evolusi GA dengan jumlah zona variabel K in {1..N} pada replikasi Training menggunakan CRN.
    3. Evaluasi ulang solusi GA terbaik (`GA-Zone-AZBO`) bersama metode pembanding (`Outside-In/WMA`,
       `Back-to-Front`, `Random`, `Back-to-Front-WILMA`, `Fixed-Zone-WMA`, dll.) pada replikasi Testing (CRN).
    4. Hitung rata-rata sampel, simpangan baku (SD), 95% CI, selisih berpasangan (paired difference),
       deteksi ekuivalensi urutan, dan trace pergerakan sel untuk animasi kabin.
    """
    start_wall = time.perf_counter()

    l_seats = list(left_seats) if left_seats is not None else ["A", "B", "C"]
    r_seats = list(right_seats) if right_seats is not None else ["D", "E", "F"]
    capacity = n_rows * (len(l_seats) + len(r_seats))
    eff_pax_count = passenger_count if passenger_count is not None else capacity
    eff_bag_count = (
        baggage_count
        if baggage_count is not None
        else deterministic_baggage_count(eff_pax_count, bag_ratio)
    )
    eff_bag_ratio = eff_bag_count / eff_pax_count if eff_pax_count > 0 else 0.0

    # 1. Buat train_seeds dan test_seeds yang dijamin saling lepas (disjoint)
    train_seeds = [base_seed + 1000 + r for r in range(train_replications)]
    test_seeds = [base_seed + 5000 + r for r in range(test_replications)]
    assert set(train_seeds).isdisjoint(set(test_seeds)), "train_seeds dan test_seeds harus disjoint!"

    train_batches = [
        {
            "replication": r + 1,
            "seed": s,
            "passengers": generate_passengers(
                seed=s,
                baggage_ratio=eff_bag_ratio,
                n_rows=n_rows,
                left_seats=l_seats,
                right_seats=r_seats,
                passenger_count=eff_pax_count,
                baggage_count=eff_bag_count,
            ),
        }
        for r, s in enumerate(train_seeds)
    ]

    test_batches = [
        {
            "replication": r + 1,
            "seed": s,
            "passengers": generate_passengers(
                seed=s,
                baggage_ratio=eff_bag_ratio,
                n_rows=n_rows,
                left_seats=l_seats,
                right_seats=r_seats,
                passenger_count=eff_pax_count,
                baggage_count=eff_bag_count,
            ),
        }
        for r, s in enumerate(test_seeds)
    ]

    # 2. Jalankan evolusi GA jumlah zona variabel K in {1..N} pada train_batches
    ga_res = run_variable_k_ga(
        train_batches=train_batches,
        n_rows=n_rows,
        population_size=population_size,
        generations=generations,
        elite_count=elite_count,
        mutation_rate=mutation_rate,
        tournament_size=tournament_size,
        ga_seed=ga_seed,
    )
    best_decoded = ga_res["best_decoded"]
    best_bounds = tuple(best_decoded["boundaries"])
    best_order = tuple(best_decoded["zone_order"])
    best_rule = best_decoded["internal_rule"]

    # 3. Evaluasi metode kandidat pada test_batches menggunakan Common Random Numbers (CRN)
    baseline_methods = [
        "GA-Zone-WMA",
        "Outside-In/WMA",
        "Back-to-Front-WILMA",
        "Fixed-Zone-WMA",
        "Reverse Pyramid (approximation)",
        "Steffen (staggered-row implementation)",
        "Modified Optimal (implementation variant)",
        "Rotating Zones",
        "Back-to-Front",
        "Random",
        "Front-to-Back",
    ]

    test_times_by_method: Dict[str, List[float]] = {m: [] for m in baseline_methods}
    test_aisle_wait_by_method: Dict[str, List[float]] = {m: [] for m in baseline_methods}
    test_seat_events_by_method: Dict[str, List[float]] = {m: [] for m in baseline_methods}
    first_rep_sequences: Dict[str, List[str]] = {}
    sample_trace: List[Dict[str, Any]] = []
    sample_timeline: List[Dict[str, Any]] = []

    for b_idx, batch in enumerate(test_batches):
        pax = batch["passengers"]
        s = batch["seed"]
        for m_name in baseline_methods:
            if m_name == "GA-Zone-WMA":
                ordered = ga_zone_wma_order(pax, best_bounds, best_order, internal_rule=best_rule)
            else:
                ordered = build_passenger_order(m_name, pax, seed=s, n_rows=n_rows)

            if b_idx == 0:
                first_rep_sequences[m_name] = [p["seat_id"] for p in ordered]

            if b_idx == 0 and m_name == "GA-Zone-WMA":
                metrics, details, trace = simulate_boarding_cellular(
                    ordered_passengers=ordered,
                    row_pitch_m=row_pitch_m,
                    cell_m=cell_m,
                    dt_s=dt_s,
                    zone_call_overhead_s=zone_call_overhead_s,
                    seed=s,
                )
                sample_trace = trace
                sample_timeline = details
            else:
                metrics, _ = simulate_boarding(
                    ordered_passengers=ordered,
                    row_pitch_m=row_pitch_m,
                    cell_m=cell_m,
                    dt_s=dt_s,
                    zone_call_overhead_s=zone_call_overhead_s,
                )

            test_times_by_method[m_name].append(metrics["boarding_time_seconds"])
            test_aisle_wait_by_method[m_name].append(metrics["aggregate_aisle_wait_person_seconds"])
            test_seat_events_by_method[m_name].append(float(metrics["seat_interference_events"]))

    # 4. Hitung ringkasan statistik testing, peringkat, selisih berpasangan, dan ekuivalensi urutan
    method_summaries: List[Dict[str, Any]] = []
    ga_test_times = test_times_by_method["GA-Zone-WMA"]

    for m_name in baseline_methods:
        t_stats = compute_mc_summary(test_times_by_method[m_name])
        w_stats = compute_mc_summary(test_aisle_wait_by_method[m_name])
        s_stats = compute_mc_summary(test_seat_events_by_method[m_name])
        paired_vs_ga = compute_paired_difference_summary(ga_test_times, test_times_by_method[m_name])
        seq_identical_to_ga = (
            m_name != "GA-Zone-WMA"
            and first_rep_sequences.get(m_name) == first_rep_sequences.get("GA-Zone-WMA")
        )
        method_summaries.append({
            "method": m_name,
            "test_mean_s": t_stats["mean"],
            "test_sd_s": t_stats["sd"],
            "test_ci95_low_s": t_stats["ci95_low"],
            "test_ci95_high_s": t_stats["ci95_high"],
            "test_min_s": t_stats["min"],
            "test_max_s": t_stats["max"],
            "test_median_s": t_stats["median"],
            "mean_aisle_wait_s": w_stats["mean"],
            "mean_seat_interference_events": s_stats["mean"],
            "paired_diff_ga_minus_method": paired_vs_ga,
            "sequence_identical_to_ga": seq_identical_to_ga,
        })

    method_summaries.sort(key=lambda item: item["test_mean_s"])
    best_test_mean_s = method_summaries[0]["test_mean_s"] if method_summaries else 0.0
    for rank_idx, item in enumerate(method_summaries, start=1):
        item["rank"] = rank_idx
        diff_s = round(item["test_mean_s"] - best_test_mean_s, 3)
        item["diff_from_best_s"] = diff_s
        item["diff_from_best_pct"] = round((diff_s / best_test_mean_s) * 100.0, 3) if best_test_mean_s > 0 else 0.0

    ga_summary = next(item for item in method_summaries if item["method"] == "GA-Zone-WMA")
    elapsed_ms = round((time.perf_counter() - start_wall) * 1000.0, 2)

    return {
        "status": "success",
        "engine": "ZoneFlow × AZBO Cellular Simulation & Variable-K GA Engine (v2)",
        "execution_time_ms": elapsed_ms,
        "scenario": {
            "n_rows": n_rows,
            "left_seats": l_seats,
            "right_seats": r_seats,
            "capacity": capacity,
            "passenger_count": eff_pax_count,
            "baggage_count": eff_bag_count,
            "bag_ratio": round(eff_bag_ratio, 4),
            "row_pitch_m": row_pitch_m,
            "cell_m": cell_m,
            "dt_s": dt_s,
            "zone_call_overhead_s": zone_call_overhead_s,
        },
        "evaluation_protocol": {
            "train_replications": train_replications,
            "test_replications": test_replications,
            "train_seeds": train_seeds,
            "test_seeds": test_seeds,
            "seeds_disjoint": set(train_seeds).isdisjoint(set(test_seeds)),
            "common_random_numbers": True,
        },
        "best_zone_policy": {
            "k_zones": best_decoded["k_zones"],
            "zones": best_decoded["zones"],
            "boundaries": best_decoded["boundaries"],
            "sizes": best_decoded["sizes"],
            "zone_order": best_decoded["zone_order"],
            "internal_rule": best_decoded["internal_rule"],
            "cuts": best_decoded["cuts"],
            "train_mean_s": ga_res["best_training_fitness_seconds"],
            "test_mean_s": ga_summary["test_mean_s"],
            "test_sd_s": ga_summary["test_sd_s"],
            "test_ci95_low_s": ga_summary["test_ci95_low_s"],
            "test_ci95_high_s": ga_summary["test_ci95_high_s"],
        },
        "ga_evolution": {
            "unique_candidates_evaluated": ga_res["unique_candidates_evaluated"],
            "explored_k_values": ga_res["explored_k_values"],
            "generation_history": ga_res["generation_history"],
            "top_candidates": ga_res["top_candidates"],
        },
        "recommended_method": method_summaries[0] if method_summaries else None,
        "baseline_comparison": method_summaries,
        "sample_replication_trace": sample_trace,
        "sample_replication_timeline": sample_timeline,
    }


# ==============================================================================
# STATISTIK & FUNGSI KOMPATIBILITAS API v1 (Batch, Exhaustive K=3, GA v1)
# ==============================================================================

def get_t_critical_95(df: int) -> float:
    """
    Menghitung nilai kritis t-distribution untuk interval kepercayaan dua arah 95% (alpha = 0.05).
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
    Menjalankan sejumlah replikasi simulasi secara berurutan menggunakan mesin seluler P0-A & P0-B.
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


def validate_zone_chromosome(
    boundaries: Tuple[int, ...],
    zone_order: Tuple[int, ...],
    n_rows: int = N_ROWS,
    k_zones: Optional[int] = None
) -> bool:
    """
    Memvalidasi integritas kandidat kromosom zona (mendukung jumlah zona K variabel in {1..n_rows}).
    """
    eff_k = k_zones if k_zones is not None else (len(boundaries) + 1)
    if len(boundaries) != eff_k - 1:
        raise ValueError(f"Jumlah batas zona harus {eff_k - 1}, diterima {len(boundaries)}.")
    if tuple(sorted(boundaries)) != tuple(boundaries):
        raise ValueError(f"Batas zona harus tersusun menaik: {boundaries}.")
    if len(set(boundaries)) != len(boundaries):
        raise ValueError(f"Batas zona tidak boleh duplikat: {boundaries}.")
    sizes = boundaries_to_sizes(boundaries, n_rows)
    if sum(sizes) != n_rows or any(s < 1 for s in sizes):
        raise ValueError(f"Ukuran zona {sizes} tidak valid untuk {n_rows} baris.")
    if tuple(sorted(zone_order)) != tuple(range(1, eff_k + 1)):
        raise ValueError(f"Urutan zona {zone_order} harus merupakan permutasi dari 1 sampai {eff_k}.")
    return True


def generate_exhaustive_candidates() -> List[Dict[str, Any]]:
    """Menghasilkan katalog 546 kandidat audit K=3 klasik."""
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
    """Membangkitkan batch pelatihan dengan seed deterministik."""
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
    """Menjalankan evaluasi Exhaustive-Zone-WMA pada mesin simulasi seluler baru."""
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
            "expected_fitness_seconds": round(best_score, 3),
            "expected_fitness_minutes": round(best_score / 60.0, 3),
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


BALANCED_SEED: Tuple[Tuple[int, ...], Tuple[int, ...]] = (
    equal_zone_boundaries(N_ROWS, K_ZONES),
    tuple(range(K_ZONES, 0, -1))
)


def random_chromosome(rng: random.Random) -> Tuple[Tuple[int, ...], Tuple[int, ...]]:
    sizes = rng.choice(VALID_ZONE_SIZES)
    bounds = sizes_to_boundaries(sizes)
    order = list(range(1, K_ZONES + 1))
    rng.shuffle(order)
    chrom = (bounds, tuple(order))
    validate_zone_chromosome(chrom[0], chrom[1])
    return chrom


def repair_sizes(raw_sizes: Tuple[int, ...], rng: random.Random) -> Tuple[int, ...]:
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
    a, b = list(parent_a), list(parent_b)
    if len(a) != len(b) or len(a) < 2:
        return tuple(a)
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

    if len(new_order) >= 2 and rng.random() < mutation_rate:
        i, j = rng.sample(range(len(new_order)), 2)
        new_order[i], new_order[j] = new_order[j], new_order[i]

    child = (sizes_to_boundaries(new_sizes), tuple(new_order))
    validate_zone_chromosome(child[0], child[1])
    return child


def tournament_select(
    scored_population: List[Tuple[float, Any]],
    rng: random.Random,
    tournament_size: int = GA_TOURNAMENT_SIZE
) -> Any:
    k = min(tournament_size, len(scored_population))
    contenders = rng.sample(scored_population, k)
    return min(contenders, key=lambda x: x[0])[1]


_FITNESS_CACHE_SIGNATURES: Dict[int, Tuple[Tuple[int, float, int], ...]] = {}


def _get_training_batches_signature(
    train_batches: List[Dict[str, Any]]
) -> Tuple[Tuple[int, float, int], ...]:
    return tuple(
        (int(b.get("seed", 0)), round(float(b.get("baggage_ratio", 0.0)), 4), len(b.get("passengers", [])))
        for b in train_batches
    )


def evaluate_chromosome_fitness(
    chromosome: Tuple[Tuple[int, ...], Tuple[int, ...]],
    train_batches: List[Dict[str, Any]],
    fitness_cache: Optional[Dict[Tuple[Tuple[int, ...], Tuple[int, ...]], float]] = None
) -> float:
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
    Menjalankan evolusi Genetic Algorithm yang mendukung eksplorasi jumlah zona variabel K in {1..N}
    serta pelaporan kompatibel dengan skema GAJobStatusResponse.
    """
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

    n_rows = max((p["row"] for b in train_batches for p in b.get("passengers", [])), default=N_ROWS)
    rng = random.Random(seed)
    population = init_variable_k_population(rng, n_rows, population_size, ("WMA_IN_ZONE",))
    fitness_cache: Dict[Tuple[Tuple[int, ...], Tuple[int, ...], str], float] = {}

    history: List[Dict[str, Any]] = []
    global_best_chrom: Optional[CutChromosome] = None
    global_best_score = float("inf")

    for gen in range(generations + 1):
        if cancel_check and cancel_check():
            decoded = decode_cut_chromosome(global_best_chrom) if global_best_chrom else None
            return {
                "status": "cancelled",
                "current_generation": gen,
                "total_generations": generations,
                "unique_candidates_evaluated": len(fitness_cache),
                "best_candidate_so_far": (
                    {
                        "zone_boundaries": decoded["boundaries"],
                        "zone_sizes": decoded["sizes"],
                        "zone_order": decoded["zone_order"],
                        "training_fitness_seconds": round(global_best_score, 3),
                        "training_fitness_minutes": round(global_best_score / 60.0, 3),
                    }
                    if decoded is not None
                    else None
                ),
                "generation_history": history,
                "execution_time_seconds": round(time.time() - start_time, 2),
            }

        scored: List[Tuple[float, CutChromosome]] = []
        for chrom in population:
            if cancel_check and cancel_check():
                decoded = decode_cut_chromosome(global_best_chrom) if global_best_chrom else None
                return {
                    "status": "cancelled",
                    "current_generation": gen,
                    "total_generations": generations,
                    "unique_candidates_evaluated": len(fitness_cache),
                    "best_candidate_so_far": (
                        {
                            "zone_boundaries": decoded["boundaries"],
                            "zone_sizes": decoded["sizes"],
                            "zone_order": decoded["zone_order"],
                            "training_fitness_seconds": round(global_best_score, 3),
                            "training_fitness_minutes": round(global_best_score / 60.0, 3),
                        }
                        if decoded is not None
                        else None
                    ),
                    "generation_history": history,
                    "execution_time_seconds": round(time.time() - start_time, 2),
                }
            score = evaluate_cut_chromosome_on_batches(chrom, train_batches, fitness_cache)
            scored.append((score, chrom))

        scored.sort(key=lambda item: item[0])
        gen_best_score, gen_best_chrom = scored[0]
        gen_worst_score = scored[-1][0]
        gen_mean_score = sum(s for s, _ in scored) / len(scored)

        if gen_best_score < global_best_score:
            global_best_score = gen_best_score
            global_best_chrom = gen_best_chrom

        assert global_best_chrom is not None
        decoded_best = decode_cut_chromosome(global_best_chrom)

        gen_record = {
            "generation": gen,
            "best_fitness_seconds": round(global_best_score, 3),
            "best_fitness_minutes": round(global_best_score / 60.0, 3),
            "generation_best_fitness_seconds": round(gen_best_score, 3),
            "mean_fitness_seconds": round(gen_mean_score, 3),
            "mean_fitness_minutes": round(gen_mean_score / 60.0, 3),
            "worst_fitness_seconds": round(gen_worst_score, 3),
            "best_boundaries": decoded_best["boundaries"],
            "best_sizes": decoded_best["sizes"],
            "best_order": decoded_best["zone_order"],
            "unique_candidates_evaluated": len(fitness_cache),
        }
        history.append(gen_record)

        best_candidate_dict = {
            "candidate_id": len(fitness_cache),
            "zone_boundaries": decoded_best["boundaries"],
            "zone_sizes": decoded_best["sizes"],
            "zone_order": decoded_best["zone_order"],
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
            child = crossover_variable_k(parent_a, parent_b, rng)
            child = mutate_variable_k(child, rng, mutation_rate=mutation_rate, allowed_rules=("WMA_IN_ZONE",))
            next_population.append(child)
        population = next_population

    execution_time = time.time() - start_time
    assert global_best_chrom is not None
    final_decoded = decode_cut_chromosome(global_best_chrom)

    best_candidate_final = {
        "candidate_id": 1,
        "zone_boundaries": final_decoded["boundaries"],
        "zone_sizes": final_decoded["sizes"],
        "zone_order": final_decoded["zone_order"],
        "training_fitness_seconds": round(global_best_score, 3),
        "training_fitness_minutes": round(global_best_score / 60.0, 3),
    }

    sorted_cache = sorted(fitness_cache.items(), key=lambda item: item[1])
    top_candidates = [
        {
            "candidate_id": idx,
            "zone_boundaries": list(bounds),
            "zone_sizes": list(boundaries_to_sizes(bounds, n_rows)),
            "zone_order": list(order),
            "training_fitness_seconds": round(score, 3),
            "training_fitness_minutes": round(score / 60.0, 3),
        }
        for idx, ((bounds, order, _), score) in enumerate(sorted_cache[:10], start=1)
    ]

    if verified_exhaustive_optimum is not None:
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
        comparison_label = "Gap terhadap Baseline 3-Zona Seimbang [10, 20]"
        reference_label = "Fixed-Zone-WMA [10, 20] | [3, 2, 1]"
        ref_boundaries = list(FIXED_ZONE_CHROMOSOME["boundaries"])
        ref_sizes = list(FIXED_ZONE_CHROMOSOME["sizes"])
        ref_order = list(FIXED_ZONE_CHROMOSOME["order"])
        ref_chrom = (FIXED_ZONE_CHROMOSOME["boundaries"], FIXED_ZONE_CHROMOSOME["order"])
        ref_raw_s = evaluate_chromosome_fitness(ref_chrom, train_batches, fitness_cache=None)
        ref_exhaustive_s = round(ref_raw_s, 3)
        ref_exhaustive_m = round(ref_raw_s / 60.0, 3)
        exhaustive_candidates_count = 1

    matches_reference_chromosome = (
        tuple(final_decoded["boundaries"]) == tuple(ref_boundaries)
        and tuple(final_decoded["zone_order"]) == tuple(ref_order)
    )
    matches_exhaustive: Optional[bool] = (
        matches_reference_chromosome if is_exhaustive_optimum_verified else None
    )
    fitness_gap_s = round(global_best_score - ref_exhaustive_s, 3)
    fitness_gap_pct = round((fitness_gap_s / ref_exhaustive_s) * 100.0, 3) if ref_exhaustive_s > 0 else 0.0

    return {
        "status": "completed",
        "optimization_type": "GA-Zone-WMA Variable-K Evolutionary Optimization",
        "best_candidate": best_candidate_final,
        "matches_exhaustive_optimum": matches_exhaustive,
        "unique_candidates_evaluated": len(fitness_cache),
        "total_chromosome_evaluations": (generations + 1) * population_size,
        "search_space_size": 2 ** max(0, n_rows - 1),
        "evaluation_reduction_percent": round((1.0 - len(fitness_cache) / max(1, 2 ** max(0, n_rows - 1))) * 100.0, 1),
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
            "k_zones": final_decoded["k_zones"],
            "min_rows_per_zone": 1,
            "max_rows_per_zone": n_rows,
            "baggage_ratios": [0.50, 0.60, 0.70],
            "replications_per_ratio": N_TRAIN_REPS_PER_BAG_LEVEL,
            "total_training_batches": len(train_batches),
            "base_seed": base_seed,
        },
        "generation_history": history,
        "top_candidates": top_candidates,
        "execution_time_seconds": round(execution_time, 2),
    }
