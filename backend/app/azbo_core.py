"""
AZBO V2 Reference & Production Simulation + Optimization Engine (`azbo_core.py`).

Implements the complete specification from `Blueprint_AZBO.pdf` and `Audit_ZoneFlow.pdf`:
1. Strict 1-passenger-per-cell discrete-time single-aisle queue simulator (dt = 0.25s)
   with zero premature cell release, zero credit accumulation while blocked, and
   automatic post-simulation invariant verification (no cell overlap, no overtaking,
   100% seating completion).
2. Variable-K zone chromosome x = (c, p, q) where c in {0,1}^(N-1) is the binary cut
   vector, K(c) = 1 + sum(c) in {1..N} with no artificial min/max zone size limits,
   p in R^N are row priority keys determining zone calling order, and
   q in {"WMA_IN_ZONE", "BTF_IN_ZONE"} is the within-zone rule.
3. Genetic Algorithm (GA) search over variable K with coverage initialization across
   K = 1..N, tournament selection, cut/priority/rule crossover & mutation, and
   exact mini-cabin exhaustive search comparator.
4. Separate Training vs. Testing Monte Carlo replications using Common Random Numbers
   (CRN), returning sample mean, sample SD, 95% confidence intervals, paired
   differences, sequence equivalence detection, and full event trace for animation.
"""

from __future__ import annotations

import itertools
import math
import random
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple


DEFAULT_SEAT_LETTERS_LEFT = {
    1: ["A"],
    2: ["A", "B"],
    3: ["A", "B", "C"],
}
DEFAULT_SEAT_LETTERS_RIGHT = {
    1: ["D"],
    2: ["C", "D"],
    3: ["D", "E", "F"],
}


@dataclass(frozen=True)
class CabinSpec:
    rows: int = 30
    left_seats: int = 3
    right_seats: int = 3
    row_pitch_m: float = 0.8
    cell_m: float = 0.4
    left_letters: Optional[Tuple[str, ...]] = None
    right_letters: Optional[Tuple[str, ...]] = None
    layout_id: str = "b737-800-180"
    layout_name: str = "Boeing 737-800 / Airbus A320-200"

    def __post_init__(self) -> None:
        if self.rows < 1 or self.rows > 80:
            raise ValueError(f"rows harus antara 1 hingga 80 (diterima: {self.rows}).")
        if self.left_seats < 1 or self.left_seats > 3:
            raise ValueError(f"left_seats harus antara 1 hingga 3 (diterima: {self.left_seats}).")
        if self.right_seats < 1 or self.right_seats > 3:
            raise ValueError(f"right_seats harus antara 1 hingga 3 (diterima: {self.right_seats}).")
        if self.row_pitch_m <= 0 or self.cell_m <= 0:
            raise ValueError("row_pitch_m dan cell_m harus bernilai positif.")
        if self.cell_m > self.row_pitch_m:
            raise ValueError("cell_m tidak boleh lebih besar dari row_pitch_m.")
        if self.left_letters is not None and len(self.left_letters) != self.left_seats:
            raise ValueError("Jumlah left_letters tidak sesuai left_seats.")
        if self.right_letters is not None and len(self.right_letters) != self.right_seats:
            raise ValueError("Jumlah right_letters tidak sesuai right_seats.")
        resolved = self.resolved_left_letters() + self.resolved_right_letters()
        if len(set(resolved)) != len(resolved):
            raise ValueError("Label kursi kiri dan kanan tidak boleh duplikat dalam satu baris.")

    @property
    def seats_per_row(self) -> int:
        return self.left_seats + self.right_seats

    @property
    def capacity(self) -> int:
        return self.rows * self.seats_per_row

    @property
    def cells_per_row(self) -> int:
        return max(1, int(round(self.row_pitch_m / self.cell_m)))

    @property
    def total_cells(self) -> int:
        return self.rows * self.cells_per_row

    def resolved_left_letters(self) -> Tuple[str, ...]:
        if self.left_letters and len(self.left_letters) == self.left_seats:
            return tuple(self.left_letters)
        return tuple(DEFAULT_SEAT_LETTERS_LEFT[self.left_seats])

    def resolved_right_letters(self) -> Tuple[str, ...]:
        if self.right_letters and len(self.right_letters) == self.right_seats:
            return tuple(self.right_letters)
        if self.left_seats == 2 and self.right_seats == 2:
            return ("C", "D")
        if self.left_seats == 2 and self.right_seats == 3:
            return ("C", "D", "E")
        if self.left_seats == 3 and self.right_seats == 2:
            return ("D", "E")
        return tuple(DEFAULT_SEAT_LETTERS_RIGHT[self.right_seats])


def deterministic_baggage_count(capacity: int, bag_ratio: float) -> int:
    """
    n_b = floor(n * rho_b + 0.5) sesuai Blueprint bagian 3.1.
    """
    if not (0.0 <= bag_ratio <= 1.0):
        raise ValueError(f"bag_ratio harus berada pada [0, 1] (diterima: {bag_ratio}).")
    return int(math.floor(capacity * bag_ratio + 0.5))


def create_cabin_seats(cabin: CabinSpec) -> List[Dict[str, Any]]:
    """
    Membentuk daftar kursi untuk konfigurasi kabin lorong tunggal.
    Setiap kursi memiliki seat_priority (0=window, 1=middle, 2=aisle)
    serta daftar blocking_seat_ids (kursi di sisi yang sama antara lorong dan kursi tersebut).
    """
    left_cols = list(cabin.resolved_left_letters())
    right_cols = list(cabin.resolved_right_letters())

    # Sisi kiri: indeks 0 adalah jendela, indeks terakhir adalah lorong
    left_prio: Dict[str, int] = {}
    left_blockers: Dict[str, List[str]] = {}
    for idx, col in enumerate(left_cols):
        if idx == 0:
            left_prio[col] = 0  # Window
        elif idx == len(left_cols) - 1:
            left_prio[col] = 2  # Aisle
        else:
            left_prio[col] = 1  # Middle
        # Semua kursi di sebelah kanan col pada sisi kiri berada lebih dekat ke lorong
        left_blockers[col] = left_cols[idx + 1:]

    # Sisi kanan: indeks 0 adalah lorong, indeks terakhir adalah jendela
    right_prio: Dict[str, int] = {}
    right_blockers: Dict[str, List[str]] = {}
    for idx, col in enumerate(right_cols):
        if idx == len(right_cols) - 1:
            right_prio[col] = 0  # Window
        elif idx == 0:
            right_prio[col] = 2  # Aisle
        else:
            right_prio[col] = 1  # Middle
        # Semua kursi di sebelah kiri col pada sisi kanan berada lebih dekat ke lorong
        right_blockers[col] = right_cols[:idx]

    all_cols = left_cols + right_cols
    left_set = set(left_cols)
    seats: List[Dict[str, Any]] = []

    for row in range(1, cabin.rows + 1):
        for seat_idx, col in enumerate(all_cols, start=1):
            is_left = col in left_set
            prio = left_prio[col] if is_left else right_prio[col]
            blk_cols = left_blockers[col] if is_left else right_blockers[col]
            seats.append({
                "seat_id": f"R{row:02d}{col}",
                "row": row,
                "seat": col,
                "seat_index": seat_idx,
                "seat_priority": prio,
                "side": "left" if is_left else "right",
                "blocking_seat_ids": [f"R{row:02d}{b}" for b in blk_cols],
            })
    return seats


def sample_truncated_normal_speed(
    rng: random.Random,
    mean: float = 0.8,
    sd: float = 0.1,
    low: float = 0.05,
    high: float = 0.8,
) -> float:
    """
    Normal(0.8, 0.1^2) m/s dikondisikan pada 0 < V <= 0.8 sesuai Blueprint bagian 6.
    """
    for _ in range(100):
        val = rng.gauss(mean, sd)
        if low < val <= high:
            return val
    return max(low, min(high, mean))


def generate_replication_passengers(
    cabin: CabinSpec,
    bag_ratio: float,
    seed: int,
    weibull_shape: float = 1.7,
    weibull_scale_s: float = 16.0,
) -> List[Dict[str, Any]]:
    """
    Membangkitkan realisasi penumpang untuk 1 replikasi (100% kursi terisi, CRN per kursi).
    - Jumlah pembawa bagasi deterministik: n_b = floor(n * bag_ratio + 0.5).
    - Identitas pembawa bagasi diacak antar-replikasi.
    - Kecepatan bebas: Truncated Normal(0.8, 0.1) pada (0, 0.8] m/s.
    - Waktu bagasi: Weibull(shape=1.7, scale=16.0 s).
    - Gerakan duduk: 9 sampel Triangular(1.8, 2.4, 3.0) detik/gerakan per penumpang.
    """
    seats = create_cabin_seats(cabin)
    n_total = len(seats)
    n_bags = deterministic_baggage_count(n_total, bag_ratio)

    rng = random.Random(seed)
    bag_indices = set(rng.sample(range(n_total), n_bags))

    passengers: List[Dict[str, Any]] = []
    for idx, seat in enumerate(seats):
        has_bag = idx in bag_indices
        speed_m_s = sample_truncated_normal_speed(rng)
        bag_stowage_s = rng.weibullvariate(weibull_scale_s, weibull_shape) if has_bag else 0.0
        # Pre-sample 9 gerakan duduk Triangular(min=1.8, mode=2.4, max=3.0)
        seat_move_draws = tuple(rng.triangular(1.8, 3.0, 2.4) for _ in range(9))
        tie_key = rng.random()

        p = dict(seat)
        p["has_bag"] = has_bag
        p["speed_m_s"] = speed_m_s
        p["bag_stowage_s"] = bag_stowage_s
        p["seat_move_draws"] = seat_move_draws
        p["tie_key"] = tie_key
        passengers.append(p)

    return passengers


# ==============================================================================
# KROMOSOM ZONA VARIABEL K: x = (c, p, q)
# ==============================================================================

VALID_IN_ZONE_RULES = ("WMA_IN_ZONE", "BTF_IN_ZONE")


@dataclass(frozen=True)
class ZoneGenome:
    cuts: Tuple[int, ...]               # Panjang N-1, elemen {0, 1}
    row_priorities: Tuple[float, ...]   # Panjang N, kunci prioritas per baris
    in_zone_rule: str = "WMA_IN_ZONE"   # "WMA_IN_ZONE" atau "BTF_IN_ZONE"

    def __post_init__(self) -> None:
        n_rows = len(self.row_priorities)
        if n_rows < 1:
            raise ValueError("row_priorities tidak boleh kosong.")
        if len(self.cuts) != n_rows - 1:
            raise ValueError(
                f"Panjang cuts ({len(self.cuts)}) harus N-1 ({n_rows - 1})."
            )
        if any(bit not in (0, 1) for bit in self.cuts):
            raise ValueError("Setiap elemen cuts harus bernilai 0 atau 1.")
        if self.in_zone_rule not in VALID_IN_ZONE_RULES:
            raise ValueError(
                f"in_zone_rule harus salah satu dari {VALID_IN_ZONE_RULES} (diterima: {self.in_zone_rule})."
            )

    @property
    def n_rows(self) -> int:
        return len(self.row_priorities)

    @property
    def k_zones(self) -> int:
        """K(c) = 1 + sum(c_j), K in {1..N}."""
        return 1 + sum(self.cuts)

    @property
    def cut_rows(self) -> List[int]:
        """Daftar nomor baris tempat batas zona berakhir (mis. [10, 20])."""
        return [idx + 1 for idx, bit in enumerate(self.cuts) if bit == 1]

    def zone_row_ranges(self) -> List[Tuple[int, int]]:
        """
        Mengembalikan daftar (start_row, end_row) 1-indexed untuk setiap zona 1..K.
        Setiap zona dijamin berurutan dan tidak kosong.
        """
        ranges: List[Tuple[int, int]] = []
        start = 1
        for row_idx, bit in enumerate(self.cuts, start=1):
            if bit == 1:
                ranges.append((start, row_idx))
                start = row_idx + 1
        ranges.append((start, self.n_rows))
        return ranges

    def zone_sizes(self) -> List[int]:
        return [end - start + 1 for start, end in self.zone_row_ranges()]

    def zone_calling_order(self) -> List[int]:
        """
        Mengurutkan zona 1..K berdasarkan kunci prioritas pada baris pertamanya:
        row_priorities[start_row - 1]. Menghasilkan permutasi valid dari 1..K.
        """
        ranges = self.zone_row_ranges()
        indexed = [
            (self.row_priorities[start_row - 1], zone_id)
            for zone_id, (start_row, _) in enumerate(ranges, start=1)
        ]
        indexed.sort(key=lambda item: (item[0], item[1]))
        return [zone_id for _, zone_id in indexed]

    def row_to_zone_map(self) -> Dict[int, int]:
        mapping: Dict[int, int] = {}
        for zone_id, (start_row, end_row) in enumerate(self.zone_row_ranges(), start=1):
            for r in range(start_row, end_row + 1):
                mapping[r] = zone_id
        return mapping

    def signature(self) -> Tuple[Tuple[int, ...], Tuple[int, ...], str]:
        """
        Signature kanonik strategi zona: (cut_rows, zone_calling_order, in_zone_rule).
        Dua kromosom dengan batas zona, urutan panggilan zona, dan aturan internal yang
        sama menghasilkan urutan boarding yang identik.
        """
        return (tuple(self.cut_rows), tuple(self.zone_calling_order()), self.in_zone_rule)


def random_genome_with_k(
    n_rows: int,
    k_zones: int,
    rng: random.Random,
    in_zone_rule: Optional[str] = None,
) -> ZoneGenome:
    """
    Membangkitkan kromosom acak kondisional pada jumlah zona K tertentu (1 <= K <= N).
    Memilih K-1 posisi batas berbeda dari N-1 celah secara uniform.
    """
    if not (1 <= k_zones <= n_rows):
        raise ValueError(f"k_zones ({k_zones}) harus berada pada 1..{n_rows}.")
    cuts = [0] * (n_rows - 1)
    if k_zones > 1:
        chosen = rng.sample(range(n_rows - 1), k_zones - 1)
        for idx in chosen:
            cuts[idx] = 1
    priorities = tuple(rng.random() for _ in range(n_rows))
    rule = in_zone_rule if in_zone_rule in VALID_IN_ZONE_RULES else rng.choice(VALID_IN_ZONE_RULES)
    return ZoneGenome(cuts=tuple(cuts), row_priorities=priorities, in_zone_rule=rule)


def random_genome(n_rows: int, rng: random.Random) -> ZoneGenome:
    """
    Memilih K ~ UniformDiscrete(1, N), lalu membangkitkan K-1 batas acak.
    """
    k_zones = rng.randint(1, n_rows)
    return random_genome_with_k(n_rows, k_zones, rng)


SUPPORTED_AZBO_V2_STRATEGIES: Tuple[str, ...] = (
    "ZONE",
    "WMA",
    "BTF",
    "RANDOM",
    "REVERSE_PYRAMID",
    "STEFFEN",
    "ROTATING_ZONES",
    "MODIFIED_OPTIMAL",
    "FRONT_TO_BACK",
    "BLOCKS_4_ROWS",
    "DOUBLE_OUTSIDE_IN",
    "BTF_WMA_FIXED",
)


def equal_rotating_zone_ranges(n_rows: int, max_zones: int = 5) -> List[Tuple[int, int]]:
    """
    Membagi baris kabin 1..n_rows menjadi K_rot = min(max_zones, n_rows) zona baris
    kontigu tidak kosong berukuran seimbang untuk metode Rotating Zones
    (Possamai Viertel et al., 2025 Gambar 2(e); Płanda & Skorupski, 2025 Bagian 2.2.8).
    """
    if n_rows < 1:
        return []
    k_rot = max(1, min(max_zones, n_rows))
    base_size = n_rows // k_rot
    rem = n_rows % k_rot
    ranges: List[Tuple[int, int]] = []
    start = 1
    for z_idx in range(k_rot):
        size = base_size + (1 if z_idx < rem else 0)
        end = start + size - 1
        ranges.append((start, end))
        start = end + 1
    return ranges


def rotating_zone_calling_order(k_rot: int) -> List[int]:
    """
    Menghasilkan urutan panggilan zona untuk Rotating Zones:
    Dimulai dari zona paling belakang (Z_K), lalu zona paling depan (Z_1),
    kemudian bergerak bergantian menuju bagian tengah kabin:
    Z_K -> Z_1 -> Z_{K-1} -> Z_2 -> ...
    """
    order: List[int] = []
    left = 1
    right = k_rot
    take_rear = True
    while left <= right:
        if take_rear:
            order.append(right)
            right -= 1
        else:
            order.append(left)
            left += 1
        take_rear = not take_rear
    return order


def reverse_pyramid_row_segments(n_rows: int, max_segments: int = 3) -> List[Tuple[int, int]]:
    """
    Membagi baris kabin 1..n_rows menjadi B = min(max_segments, n_rows) segmen longitudinal
    yang diurutkan dari BELAKANG ke DEPAN (indeks b=0 adalah segmen paling belakang,
    b=B-1 adalah segmen paling depan) untuk pembentukan kelompok diagonal Reverse Pyramid
    (Płanda & Skorupski, 2025 Bagian 2.2.7 & Gambar 3; Possamai Viertel et al., 2025 Gambar 2(d)).
    """
    if n_rows < 1:
        return []
    front_to_back = equal_rotating_zone_ranges(n_rows, max_zones=min(max_segments, n_rows))
    return list(reversed(front_to_back))


def four_row_block_ranges(n_rows: int, block_size: int = 4) -> List[Tuple[int, int]]:
    """
    Membagi baris kabin 1..n_rows menjadi blok-blok kontigu berukuran maksimal 4 baris
    dari depan ke belakang sesuai Steffen & Hotchkiss (2012, J. Air Transp. Manag. 18(1), 64-67).
    - Pada kabin 12 baris: [(1, 4), (5, 8), (9, 12)] dengan urutan panggil blok 3 (9-12) -> blok 1 (1-4) -> blok 2 (5-8).
    - Pada kabin N baris: [(1, min(4, N)), (5, min(8, N)), ...] dengan urutan panggil bergantian
      belakang -> depan -> menuju tengah menggunakan rotating_zone_calling_order.
    """
    if n_rows < 1:
        return []
    step = max(1, block_size)
    ranges: List[Tuple[int, int]] = []
    start = 1
    while start <= n_rows:
        end = min(n_rows, start + step - 1)
        ranges.append((start, end))
        start = end + 1
    return ranges


def double_outside_in_row_split(n_rows: int) -> Tuple[Tuple[int, int], Tuple[int, int]]:
    """
    Membagi baris kabin 1..n_rows menjadi 2 bagian longitudinal (Bagian Depan dan Bagian Belakang)
    sebagai adaptasi metode Double Outside-In (Dong et al., 2025, Physica A 658, 130298,
    Bagian 3.2 & Gambar 5) untuk model pesawat lorong tunggal:
    - Bagian Depan: baris 1 s/d floor(n_rows / 2)
    - Bagian Belakang: baris (floor(n_rows / 2) + 1) s/d n_rows
    """
    if n_rows <= 1:
        return (1, 0), (1, max(1, n_rows))
    front_end = n_rows // 2
    return (1, front_end), (front_end + 1, n_rows)


def fixed_btf_wma_zone_ranges(n_rows: int, max_zones: int = 3) -> List[Tuple[int, int]]:
    """
    Membagi baris kabin 1..n_rows menjadi K_fixed = min(max_zones, n_rows) zona tetap
    berukuran seimbang dari depan ke belakang (Zona 1 = Depan, Zona 2 = Tengah, Zona 3 = Belakang)
    untuk baseline metode hibrida Back-to-Front + WMA (Fixed Zones / BTF_WMA_FIXED).
    """
    return equal_rotating_zone_ranges(n_rows, max_zones=max_zones)


def build_boarding_sequence(
    passengers: Sequence[Dict[str, Any]],
    strategy: str,
    seed: int = 0,
    genome: Optional[ZoneGenome] = None,
) -> Tuple[List[Dict[str, Any]], List[int]]:
    """
    Membentuk urutan antrean penumpang untuk 12 kelompok strategi boarding:
    1. "WMA": Window -> Middle -> Aisle (Outside-In), belakang ke depan dalam kelas kursi.
    2. "BTF": Belakang ke depan per baris.
    3. "RANDOM": Acak penuh per replikasi.
    4. "ZONE": Berdasarkan ZoneGenome x = (c, p, q) hasil optimasi GA variabel-K.
    5. "REVERSE_PYRAMID": Kelompok diagonal dari belakang-luar (jendela belakang)
       menuju depan-dalam (lorong depan) sesuai Płanda & Skorupski (2025, Gambar 3)
       dan Possamai Viertel et al. (2025, Gambar 2d).
    6. "STEFFEN": Urutan kursi berselang-seling (kelas kursi Jendela -> Tengah -> Lorong,
       paritas baris dari belakang N, N-2, ... lalu N-1, N-3, ..., bergantian sisi kiri/kanan)
       sesuai Płanda & Skorupski (2025, Gambar 4) & Gehlen & Ronzani (2025).
    7. "ROTATING_ZONES": Pembagian zona baris seimbang yang dipanggil bergantian dari
       zona paling belakang, zona paling depan, menuju tengah kabin sesuai
       Possamai Viertel et al. (2025, Gambar 2e) & Płanda & Skorupski (2025, Bagian 2.2.8).
    8. "MODIFIED_OPTIMAL": 4 kelompok berdasarkan paritas nomor baris (genap/ganjil) dan
       sisi kabin (kiri/kanan) sesuai Possamai Viertel et al. (2025, Gambar 2f).
    9. "FRONT_TO_BACK": Depan ke belakang per baris (Baris 1 menuju Baris N) sesuai
       Płanda & Skorupski (2025, Bagian 2.2.3).
    10. "BLOCKS_4_ROWS": Blok tetap 4 baris (Four-Row Blocks) dengan pemanggilan blok
        belakang -> depan -> tengah dan urutan acak di dalam blok sesuai
        Steffen & Hotchkiss (2012, J. Air Transp. Manag. 18(1), 64-67).
    11. "DOUBLE_OUTSIDE_IN": Adaptasi Double Outside-In (Dong et al., 2025, Bagian 3.2 &
        Gambar 5) untuk kabin satu lorong: setiap kelas kursi (Jendela -> Tengah -> Lorong)
        dibagi menjadi kelompok paruh belakang terlebih dahulu lalu paruh depan.
    12. "BTF_WMA_FIXED": Hibrida Back-to-Front + WMA pada 3 zona tetap seimbang
        (Zona Belakang -> Zona Tengah -> Zona Depan, dengan urutan WMA di dalam tiap zona)
        sebagai pembanding baseline zona tetap terhadap optimasi GA variabel-K (ZONE).

    Mengembalikan (ordered_passengers, group_ids_per_passenger).
    """
    pax_list = list(passengers)
    if not pax_list:
        return [], []

    rng = random.Random(seed + 7919)
    tie_map = {p["seat_id"]: rng.random() for p in pax_list}
    n_rows = max(int(p["row"]) for p in pax_list)

    if strategy == "WMA":
        present_priorities = sorted({int(p["seat_priority"]) for p in pax_list})
        prio_to_group = {prio: idx + 1 for idx, prio in enumerate(present_priorities)}
        ordered = sorted(
            pax_list,
            key=lambda p: (int(p["seat_priority"]), -int(p["row"]), tie_map[p["seat_id"]]),
        )
        groups = [prio_to_group[int(p["seat_priority"])] for p in ordered]
        return ordered, groups

    if strategy == "BTF":
        ordered = sorted(
            pax_list,
            key=lambda p: (-int(p["row"]), tie_map[p["seat_id"]]),
        )
        groups = [max(1, n_rows - int(p["row"]) + 1) for p in ordered]
        return ordered, groups

    if strategy == "RANDOM":
        ordered = list(pax_list)
        rng.shuffle(ordered)
        groups = [1 for _ in ordered]
        return ordered, groups

    if strategy == "ZONE":
        if genome is None:
            raise ValueError("Strategi 'ZONE' membutuhkan objek ZoneGenome.")
        row_to_zone = genome.row_to_zone_map()
        calling_order = genome.zone_calling_order()
        call_rank_of_zone = {z_id: rank for rank, z_id in enumerate(calling_order, start=1)}

        if genome.in_zone_rule == "WMA_IN_ZONE":
            ordered = sorted(
                pax_list,
                key=lambda p: (
                    call_rank_of_zone[row_to_zone[int(p["row"])]],
                    int(p["seat_priority"]),
                    -int(p["row"]),
                    tie_map[p["seat_id"]],
                ),
            )
        else:  # "BTF_IN_ZONE"
            ordered = sorted(
                pax_list,
                key=lambda p: (
                    call_rank_of_zone[row_to_zone[int(p["row"])]],
                    -int(p["row"]),
                    int(p["seat_priority"]),
                    tie_map[p["seat_id"]],
                ),
            )
        groups = [call_rank_of_zone[row_to_zone[int(p["row"])]] for p in ordered]
        return ordered, groups

    if strategy == "REVERSE_PYRAMID":
        # Kompresi indeks kelas kursi yang ada pada kabin (0=Window, 1=Middle/Aisle pada 2-2, dst.)
        present_priorities = sorted({int(p["seat_priority"]) for p in pax_list})
        compressed_class = {prio: idx for idx, prio in enumerate(present_priorities)}

        # Segmen baris dari belakang (b=0) ke depan (b=B-1)
        rear_to_front_segments = reverse_pyramid_row_segments(n_rows, max_segments=3)
        row_to_seg_idx: Dict[int, int] = {}
        for seg_idx, (start_r, end_r) in enumerate(rear_to_front_segments):
            for r in range(start_r, end_r + 1):
                row_to_seg_idx[r] = seg_idx

        def rp_group(p: Dict[str, Any]) -> int:
            c_idx = compressed_class[int(p["seat_priority"])]
            b_idx = row_to_seg_idx.get(int(p["row"]), 0)
            return c_idx + b_idx + 1

        ordered = sorted(
            pax_list,
            key=lambda p: (
                rp_group(p),
                int(p["seat_priority"]),
                -int(p["row"]),
                tie_map[p["seat_id"]],
            ),
        )
        groups = [rp_group(p) for p in ordered]
        return ordered, groups

    if strategy == "STEFFEN":
        # Urutan kursi berselang-seling:
        # Kelas kursi (Window -> Middle -> Aisle), paritas baris dimulai dari paritas baris
        # paling belakang N (N, N-2, ... lalu N-1, N-3, ...), dan sisi kabin bergantian (left -> right).
        rear_parity = n_rows % 2
        parity_order = (rear_parity, 1 - rear_parity)
        present_priorities = sorted({int(p["seat_priority"]) for p in pax_list})

        ordered = []
        groups = []
        wave_id = 0
        for prio in present_priorities:
            for parity in parity_order:
                for side in ("left", "right"):
                    wave = [
                        p
                        for p in pax_list
                        if int(p["seat_priority"]) == prio
                        and (int(p["row"]) % 2) == parity
                        and p.get("side") == side
                    ]
                    if not wave:
                        continue
                    wave_id += 1
                    wave.sort(
                        key=lambda p: (
                            -int(p["row"]),
                            int(p.get("seat_index", 1)),
                            tie_map[p["seat_id"]],
                        )
                    )
                    ordered.extend(wave)
                    groups.extend([wave_id] * len(wave))
        return ordered, groups

    if strategy == "ROTATING_ZONES":
        rot_ranges = equal_rotating_zone_ranges(n_rows, max_zones=5)
        k_rot = len(rot_ranges)
        row_to_rot_zone: Dict[int, int] = {}
        for z_id, (start_r, end_r) in enumerate(rot_ranges, start=1):
            for r in range(start_r, end_r + 1):
                row_to_rot_zone[r] = z_id

        rot_order = rotating_zone_calling_order(k_rot)
        rot_rank = {z_id: rank for rank, z_id in enumerate(rot_order, start=1)}

        ordered = sorted(
            pax_list,
            key=lambda p: (
                rot_rank[row_to_rot_zone[int(p["row"])]],
                -int(p["row"]),
                tie_map[p["seat_id"]],
            ),
        )
        groups = [rot_rank[row_to_rot_zone[int(p["row"])]] for p in ordered]
        return ordered, groups

    if strategy == "MODIFIED_OPTIMAL":
        # 4 kelompok sesuai Possamai Viertel et al. (2025, Gambar 2f):
        # Kelompok 1: Baris genap sisi kiri
        # Kelompok 2: Baris genap sisi kanan
        # Kelompok 3: Baris ganjil sisi kiri
        # Kelompok 4: Baris ganjil sisi kanan
        def raw_mod_opt_group(p: Dict[str, Any]) -> int:
            is_even = (int(p["row"]) % 2) == 0
            is_left = p.get("side") == "left"
            if is_even and is_left:
                return 1
            if is_even and not is_left:
                return 2
            if not is_even and is_left:
                return 3
            return 4

        present_raw_groups = sorted({raw_mod_opt_group(p) for p in pax_list})
        compact_group_map = {g: idx + 1 for idx, g in enumerate(present_raw_groups)}

        ordered = sorted(
            pax_list,
            key=lambda p: (
                compact_group_map[raw_mod_opt_group(p)],
                -int(p["row"]),
                int(p["seat_priority"]),
                tie_map[p["seat_id"]],
            ),
        )
        groups = [compact_group_map[raw_mod_opt_group(p)] for p in ordered]
        return ordered, groups

    if strategy == "FRONT_TO_BACK":
        # Urutan baris dari paling depan (Baris 1) menuju paling belakang (Baris N)
        # sesuai Płanda & Skorupski (2025, Bagian 2.2.3).
        ordered = sorted(
            pax_list,
            key=lambda p: (int(p["row"]), tie_map[p["seat_id"]]),
        )
        groups = [int(p["row"]) for p in ordered]
        return ordered, groups

    if strategy == "BLOCKS_4_ROWS":
        # Blok 4 baris sesuai Steffen & Hotchkiss (2012):
        # Baris 1..N dibagi menjadi blok berukuran maksimal 4 baris [(1,4), (5,8), (9,12), ...].
        # Blok dipanggil mulai dari blok paling belakang, lalu paling depan, lalu bergantian
        # menuju tengah kabin (untuk 12 baris: 9-12 -> 1-4 -> 5-8).
        # Di dalam masing-masing blok, urutan penumpang diacak secara deterministik.
        block_ranges = four_row_block_ranges(n_rows, block_size=4)
        k_blocks = len(block_ranges)
        row_to_block: Dict[int, int] = {}
        for b_id, (start_r, end_r) in enumerate(block_ranges, start=1):
            for r in range(start_r, end_r + 1):
                row_to_block[r] = b_id

        block_call_order = rotating_zone_calling_order(k_blocks)
        block_rank = {b_id: rank for rank, b_id in enumerate(block_call_order, start=1)}

        ordered = sorted(
            pax_list,
            key=lambda p: (
                block_rank[row_to_block[int(p["row"])]],
                tie_map[p["seat_id"]],
            ),
        )
        groups = [block_rank[row_to_block[int(p["row"])]] for p in ordered]
        return ordered, groups

    if strategy == "DOUBLE_OUTSIDE_IN":
        # Adaptasi Double Outside-In (Dong et al., 2025, Bagian 3.2 & Gambar 5) untuk lorong tunggal:
        # Kabin dibagi menjadi Bagian Depan (1..floor(N/2)) dan Bagian Belakang (floor(N/2)+1..N).
        # Untuk setiap kelas kursi yang ada (Window -> Middle -> Aisle), panggil Bagian Belakang
        # terlebih dahulu, kemudian Bagian Depan. Di dalam masing-masing kelompok, urutan penumpang
        # diacak secara deterministik sesuai Dong et al. (2025, Bagian 3.1/3.2).
        (front_start, front_end), (_rear_start, _rear_end) = double_outside_in_row_split(n_rows)

        def is_front_half(row_num: int) -> bool:
            return front_start <= row_num <= front_end

        # section_rank: 0 = Rear section (dipanggil lebih dulu), 1 = Front section
        def raw_doi_pair(p: Dict[str, Any]) -> Tuple[int, int]:
            sec_rank = 1 if is_front_half(int(p["row"])) else 0
            return (int(p["seat_priority"]), sec_rank)

        present_pairs = sorted({raw_doi_pair(p) for p in pax_list})
        pair_to_group = {pair: idx + 1 for idx, pair in enumerate(present_pairs)}

        ordered = sorted(
            pax_list,
            key=lambda p: (
                pair_to_group[raw_doi_pair(p)],
                tie_map[p["seat_id"]],
            ),
        )
        groups = [pair_to_group[raw_doi_pair(p)] for p in ordered]
        return ordered, groups

    if strategy == "BTF_WMA_FIXED":
        # Hibrida Back-to-Front + WMA pada 3 zona tetap seimbang (Fixed Zones):
        # Kabin dibagi menjadi K_fixed = min(3, N) zona seimbang (Zona 1 Depan, Zona 2 Tengah, Zona 3 Belakang).
        # Zona dipanggil dari belakang ke depan (Zona K_fixed -> ... -> Zona 1).
        # Di dalam setiap zona, penumpang dipanggil berdasarkan kelas kursi Window -> Middle -> Aisle,
        # dan dari baris belakang ke depan di dalam kelas kursi yang sama.
        fixed_ranges = fixed_btf_wma_zone_ranges(n_rows, max_zones=3)
        k_fixed = len(fixed_ranges)
        row_to_fixed_zone: Dict[int, int] = {}
        for z_id, (start_r, end_r) in enumerate(fixed_ranges, start=1):
            for r in range(start_r, end_r + 1):
                row_to_fixed_zone[r] = z_id

        # Zona belakang dipanggil lebih dulu: z_id = k_fixed memiliki zone_call_rank = 1
        def raw_btf_wma_pair(p: Dict[str, Any]) -> Tuple[int, int]:
            z_id = row_to_fixed_zone[int(p["row"])]
            zone_call_rank = k_fixed - z_id + 1
            return (zone_call_rank, int(p["seat_priority"]))

        present_subgroups = sorted({raw_btf_wma_pair(p) for p in pax_list})
        subgroup_to_id = {pair: idx + 1 for idx, pair in enumerate(present_subgroups)}

        ordered = sorted(
            pax_list,
            key=lambda p: (
                subgroup_to_id[raw_btf_wma_pair(p)],
                -int(p["row"]),
                tie_map[p["seat_id"]],
            ),
        )
        groups = [subgroup_to_id[raw_btf_wma_pair(p)] for p in ordered]
        return ordered, groups

    raise ValueError(f"Strategi '{strategy}' tidak dikenal.")


# ==============================================================================
# MESIN SIMULASI ANTREAN 1 PENUMPANG PER SEL (BLUEPRINT BAGIAN 7)
# ==============================================================================

def simulate(
    ordered_passengers: Sequence[Dict[str, Any]],
    cabin: CabinSpec,
    dt: float = 0.25,
    zone_call_overhead_s: float = 0.0,
    group_ids: Optional[Sequence[int]] = None,
    record_trace: bool = False,
    verify_invariants: bool = True,
) -> Dict[str, Any]:
    """
    Simulasi jam diskret dt = 0.25 detik dengan aturan kapasitas ketat:
    1. Satu sel lorong maksimal berisi satu penumpang pada setiap saat.
    2. Perpindahan hanya ke sel depan yang kosong (tidak dapat menyalip).
    3. Penumpang yang tertahan tetap menempati sel asalnya dan TIDAK menumpuk kredit gerak.
    4. Di baris tujuan, penumpang tetap menahan sel lorong selama menyimpan bagasi
       dan melakukan gerakan duduk (1/5/9 gerakan sesuai penghalang yang SUDAH duduk).
    5. Seluruh penumpang siap di luar pintu depan sejak t = 0 (tanpa paksaan jeda 1 detik).
    """
    n_pax = len(ordered_passengers)
    if n_pax == 0:
        return {
            "boarding_time_s": 0.0,
            "metrics": {
                "boarding_time_seconds": 0.0,
                "boarding_time_minutes": 0.0,
                "aisle_interference_events": 0,
                "aggregate_aisle_wait_person_seconds": 0.0,
                "aisle_wait_seconds": 0.0,
                "seat_interference_events": 0,
                "occupied_blocker_count": 0,
                "baggage_count": 0,
                "passenger_count": 0,
            },
            "details": [],
            "trace": [],
        }

    cells_per_row = cabin.cells_per_row
    num_cells = cabin.total_cells
    cell_m = cabin.cell_m
    need_details = record_trace or verify_invariants

    # Gunakan array datar untuk loop jam diskret dt=0.25s agar sangat cepat di Python
    # State codes: 0=queue, 1=walking, 2=seating, 3=seated
    p_seat_id = [p["seat_id"] for p in ordered_passengers]
    p_row = [int(p["row"]) for p in ordered_passengers]
    p_seat = [p["seat"] for p in ordered_passengers]
    p_has_bag = [bool(p["has_bag"]) for p in ordered_passengers]
    p_speed = [float(p["speed_m_s"]) for p in ordered_passengers]
    p_bag_s = [float(p["bag_stowage_s"]) for p in ordered_passengers]
    p_draws = [p["seat_move_draws"] for p in ordered_passengers]
    p_blockers_ids = [tuple(p["blocking_seat_ids"]) for p in ordered_passengers]
    p_target_cell = [r * cells_per_row - 1 for r in p_row]
    p_step_dur = [cell_m / spd for spd in p_speed]
    p_group = [
        group_ids[i] if group_ids is not None and i < len(group_ids) else 1
        for i in range(n_pax)
    ]

    p_state = [0] * n_pax
    p_entry_t = [0.0] * n_pax
    p_arrival_t = [0.0] * n_pax
    p_finish_t = [0.0] * n_pax
    p_move_ready_t = [0.0] * n_pax
    p_seating_end_t = [0.0] * n_pax
    p_aisle_wait_s = [0.0] * n_pax
    p_wait_events = [0] * n_pax
    p_cur_waiting = [False] * n_pax
    p_occ_blockers = [0] * n_pax
    p_seat_interf_s = [0.0] * n_pax
    p_cell_history: List[List[List[Any]]] = [[] for _ in range(n_pax)] if need_details else []

    aisle: List[int] = [-1] * num_cells
    seated_seats: set[str] = set()
    trace: List[Dict[str, Any]] = []

    next_queue_idx = 0
    seated_count = 0
    last_entered_group: Optional[int] = None
    door_release_ready_t = 0.0

    step_idx = 0
    max_steps = max(200000, n_pax * 4000)
    eps = 1e-9

    while seated_count < n_pax:
        t = step_idx * dt
        if step_idx > max_steps:
            raise RuntimeError(f"Simulasi melebihi batas langkah ({max_steps}) pada t={t}s.")

        # Pembaruan sel dari belakang kabin ke depan (num_cells-1 .. 0):
        # Karena setiap sel di depan (cell_idx + 1) sudah diperbarui pada iterasi sebelumnya,
        # penggabungan ketiga tahap pada satu loop mundur saat record_trace=False menghasilkan
        # transisi state yang 100% identik dengan waktu eksekusi jauh lebih singkat.
        for cell_idx in range(num_cells - 1, -1, -1):
            p_idx = aisle[cell_idx]
            if p_idx == -1:
                continue
            st = p_state[p_idx]

            # 1. Penyelesaian duduk (seating -> seated) & pelepasan sel lorong
            if st == 2:
                if t + eps >= p_seating_end_t[p_idx]:
                    p_state[p_idx] = 3
                    p_finish_t[p_idx] = t
                    if need_details and p_cell_history[p_idx]:
                        p_cell_history[p_idx][-1][2] = t
                    aisle[cell_idx] = -1
                    seated_seats.add(p_seat_id[p_idx])
                    seated_count += 1
                    if record_trace:
                        trace.append({
                            "t": round(t, 4),
                            "event": "seated",
                            "passenger_id": p_seat_id[p_idx],
                            "queue_position": p_idx + 1,
                            "row": p_row[p_idx],
                            "cell": cell_idx,
                        })
                continue

            # 2 & 3. Aktivitas di baris tujuan atau gerak maju ke sel berikutnya
            if st == 1:
                tgt = p_target_cell[p_idx]
                if cell_idx == tgt:
                    if t + eps >= p_move_ready_t[p_idx]:
                        p_state[p_idx] = 2
                        p_cur_waiting[p_idx] = False
                        p_arrival_t[p_idx] = t
                        blockers = 0
                        for b_id in p_blockers_ids[p_idx]:
                            if b_id in seated_seats:
                                blockers += 1
                        p_occ_blockers[p_idx] = blockers
                        moves = 1 if blockers == 0 else (5 if blockers == 1 else 9)
                        draws = p_draws[p_idx]
                        seat_time_s = float(sum(draws[:moves]))
                        p_seat_interf_s[p_idx] = seat_time_s
                        p_seating_end_t[p_idx] = t + p_bag_s[p_idx] + seat_time_s
                        if record_trace:
                            trace.append({
                                "t": round(t, 4),
                                "event": "seating_started",
                                "passenger_id": p_seat_id[p_idx],
                                "queue_position": p_idx + 1,
                                "row": p_row[p_idx],
                                "cell": cell_idx,
                                "occupied_blockers": blockers,
                                "bag_stowage_s": round(p_bag_s[p_idx], 3),
                                "seat_time_s": round(seat_time_s, 3),
                            })
                elif cell_idx < tgt:
                    if t + eps >= p_move_ready_t[p_idx]:
                        if aisle[cell_idx + 1] == -1:
                            if need_details and p_cell_history[p_idx]:
                                p_cell_history[p_idx][-1][2] = t
                            aisle[cell_idx] = -1
                            aisle[cell_idx + 1] = p_idx
                            p_cur_waiting[p_idx] = False
                            p_move_ready_t[p_idx] = t + p_step_dur[p_idx]
                            if need_details:
                                p_cell_history[p_idx].append([cell_idx + 1, t, None])
                            if record_trace:
                                trace.append({
                                    "t": round(t, 4),
                                    "event": "move",
                                    "passenger_id": p_seat_id[p_idx],
                                    "queue_position": p_idx + 1,
                                    "from_cell": cell_idx,
                                    "to_cell": cell_idx + 1,
                                    "row": (cell_idx + 1) // cells_per_row + 1,
                                })
                        else:
                            p_aisle_wait_s[p_idx] += dt
                            if not p_cur_waiting[p_idx]:
                                p_cur_waiting[p_idx] = True
                                p_wait_events[p_idx] += 1

        # 4. Masukkan penumpang dari pintu depan ke sel pertama (cell 0) bila kosong
        if aisle[0] == -1 and next_queue_idx < n_pax:
            cand_grp = p_group[next_queue_idx]
            if (
                zone_call_overhead_s > 0.0
                and last_entered_group is not None
                and cand_grp != last_entered_group
            ):
                door_release_ready_t = max(door_release_ready_t, t + zone_call_overhead_s)
                last_entered_group = cand_grp

            if t + eps >= door_release_ready_t:
                p_idx = next_queue_idx
                aisle[0] = p_idx
                p_state[p_idx] = 1
                p_entry_t[p_idx] = t
                p_move_ready_t[p_idx] = t + p_step_dur[p_idx]
                if need_details:
                    p_cell_history[p_idx].append([0, t, None])
                last_entered_group = cand_grp
                if record_trace:
                    trace.append({
                        "t": round(t, 4),
                        "event": "entry",
                        "passenger_id": p_seat_id[p_idx],
                        "queue_position": p_idx + 1,
                        "cell": 0,
                        "row": 1,
                    })
                next_queue_idx += 1

        step_idx += 1

    boarding_time_s = max(p_finish_t) if n_pax > 0 else 0.0

    details: List[Dict[str, Any]] = []
    if need_details:
        for i in range(n_pax):
            row_segments: List[Dict[str, Any]] = []
            for cell_idx, enter_s, leave_s in p_cell_history[i]:
                row_num = (cell_idx // cells_per_row) + 1
                leave_val = float(leave_s if leave_s is not None else p_finish_t[i])
                if row_segments and row_segments[-1]["row"] == row_num:
                    row_segments[-1]["leave_s"] = round(leave_val, 3)
                else:
                    row_segments.append({
                        "row": row_num,
                        "enter_s": round(float(enter_s), 3),
                        "leave_s": round(leave_val, 3),
                        "is_target_row": row_num == p_row[i],
                    })

            details.append({
                "queue_position": i + 1,
                "seat_id": p_seat_id[i],
                "row": p_row[i],
                "seat": p_seat[i],
                "has_bag": p_has_bag[i],
                "speed_m_s": round(p_speed[i], 4),
                "entry_time_s": round(p_entry_t[i], 3),
                "arrival_target_s": round(p_arrival_t[i], 3),
                "aisle_wait_s": round(p_aisle_wait_s[i], 3),
                "occupied_blockers": p_occ_blockers[i],
                "seat_interference_s": round(p_seat_interf_s[i], 3),
                "bag_stowage_s": round(p_bag_s[i], 3),
                "finish_time_s": round(p_finish_t[i], 3),
                "aisle_transit": row_segments,
                "cell_intervals": [
                    {
                        "cell": int(c_idx),
                        "row": (int(c_idx) // cells_per_row) + 1,
                        "enter_s": round(float(en_s), 3),
                        "leave_s": round(float(lv_s if lv_s is not None else p_finish_t[i]), 3),
                    }
                    for c_idx, en_s, lv_s in p_cell_history[i]
                ],
            })

    if verify_invariants:
        verify_simulation_invariants(details, cabin)

    total_wait_events = sum(p_wait_events)
    total_wait_s = sum(p_aisle_wait_s)
    seat_interferences = sum(1 for b in p_occ_blockers if b > 0)
    total_blockers = sum(p_occ_blockers)
    bag_count = sum(1 for hb in p_has_bag if hb)

    metrics = {
        "boarding_time_seconds": round(boarding_time_s, 3),
        "boarding_time_minutes": round(boarding_time_s / 60.0, 3),
        "aisle_interference_events": total_wait_events,
        "aggregate_aisle_wait_person_seconds": round(total_wait_s, 3),
        "aisle_wait_seconds": round(total_wait_s, 3),
        "seat_interference_events": seat_interferences,
        "occupied_blocker_count": total_blockers,
        "baggage_count": bag_count,
        "passenger_count": n_pax,
    }

    return {
        "boarding_time_s": round(boarding_time_s, 3),
        "metrics": metrics,
        "details": details,
        "trace": trace,
    }


def verify_simulation_invariants(
    details: Sequence[Dict[str, Any]],
    cabin: CabinSpec,
) -> bool:
    """
    Memverifikasi seluruh invariant fisik sesuai Blueprint bagian 7.1 & 10:
    - Setiap penumpang masuk dan duduk tepat satu kali.
    - finish_time_s > entry_time_s untuk setiap penumpang.
    - Tidak ada dua penumpang yang menempati sel yang sama pada interval waktu yang tumpang tindih.
    - Tidak ada penumpang yang saling mendahului di lorong.
    """
    if len(details) != cabin.capacity:
        raise AssertionError(
            f"Jumlah penumpang selesai ({len(details)}) tidak sama dengan kapasitas ({cabin.capacity})."
        )

    seen_seats = set()
    cell_occupancy: Dict[int, List[Tuple[float, float, int, str]]] = {}

    for d in details:
        sid = d["seat_id"]
        if sid in seen_seats:
            raise AssertionError(f"Kursi duplikat ditemukan: {sid}")
        seen_seats.add(sid)

        if not (d["finish_time_s"] > d["entry_time_s"]):
            raise AssertionError(
                f"Waktu selesai ({d['finish_time_s']}) harus > waktu masuk ({d['entry_time_s']}) untuk {sid}."
            )

        intervals = d.get("cell_intervals", [])
        if not intervals:
            raise AssertionError(f"Penumpang {sid} tidak memiliki riwayat sel.")

        for idx, iv in enumerate(intervals):
            c = iv["cell"]
            en = iv["enter_s"]
            lv = iv["leave_s"]
            if c < 0 or c >= cabin.total_cells:
                raise AssertionError(f"Sel ilegal {c} untuk penumpang {sid}.")
            if lv < en - 1e-6:
                raise AssertionError(f"Interval sel negatif [{en}, {lv}] untuk {sid}.")
            if idx > 0 and c != intervals[idx - 1]["cell"] + 1:
                raise AssertionError(f"Lompatan sel ilegal oleh {sid}: {intervals[idx - 1]['cell']} -> {c}")
            cell_occupancy.setdefault(c, []).append((en, lv, d["queue_position"], sid))

    # Periksa tidak ada tumpang tindih pada sel yang sama & tidak ada mendahului (FIFO per sel)
    for c, occ_list in cell_occupancy.items():
        occ_list.sort(key=lambda item: (item[0], item[2]))
        for i in range(len(occ_list) - 1):
            en1, lv1, q1, s1 = occ_list[i]
            en2, lv2, q2, s2 = occ_list[i + 1]
            if en2 < lv1 - 1e-5:
                raise AssertionError(
                    f"Konflik kapasitas pada sel {c}: {s1} [{en1}, {lv1}] tumpang tindih dengan {s2} [{en2}, {lv2}]."
                )
            if q2 < q1:
                raise AssertionError(
                    f"Pelanggaran urutan antrean (menyalip) pada sel {c}: #{q2} ({s2}) mendahului #{q1} ({s1})."
                )

    return True


# ==============================================================================
# GENETIC ALGORITHM (GA) DENGAN JUMLAH ZONA K VARIABEL (BLUEPRINT BAGIAN 8)
# ==============================================================================

def crossover_genomes(
    parent_a: ZoneGenome,
    parent_b: ZoneGenome,
    rng: random.Random,
) -> ZoneGenome:
    """
    Crossover yang mencampur bit batas zona c, kunci prioritas baris p, dan aturan internal q.
    Jumlah zona K dihitung ulang otomatis dari bit batas c sehingga selalu valid.
    """
    n_rows = parent_a.n_rows
    if n_rows == 1:
        return parent_a

    # Uniform / single-point crossover pada bit batas c
    if n_rows > 2 and rng.random() < 0.5:
        cut_pt = rng.randint(1, n_rows - 2)
        new_cuts = parent_a.cuts[:cut_pt] + parent_b.cuts[cut_pt:]
    else:
        new_cuts = tuple(
            parent_a.cuts[i] if rng.random() < 0.5 else parent_b.cuts[i]
            for i in range(n_rows - 1)
        )

    # Blend / uniform crossover pada kunci prioritas p
    new_priorities = tuple(
        parent_a.row_priorities[i] if rng.random() < 0.5 else parent_b.row_priorities[i]
        for i in range(n_rows)
    )

    new_rule = parent_a.in_zone_rule if rng.random() < 0.5 else parent_b.in_zone_rule
    return ZoneGenome(cuts=new_cuts, row_priorities=new_priorities, in_zone_rule=new_rule)


def mutate_genome(
    genome: ZoneGenome,
    rng: random.Random,
    mutation_rate: float = 0.35,
) -> ZoneGenome:
    """
    Mutasi kromosom:
    - Menyisipkan/menghapus batas zona (mengubah K secara dinamis) atau memilih ulang K ~ UniformDiscrete(1, N).
    - Mengubah/menukar kunci prioritas baris p (mengubah urutan panggilan zona).
    - Mengganti aturan internal zona q (WMA_IN_ZONE <-> BTF_IN_ZONE).
    """
    if rng.random() > mutation_rate:
        return genome

    n_rows = genome.n_rows
    cuts = list(genome.cuts)
    priorities = list(genome.row_priorities)
    rule = genome.in_zone_rule

    # 1. Mutasi batas zona (mengubah K)
    if n_rows > 1:
        mode = rng.random()
        if mode < 0.35:
            # Flip 1 atau 2 bit batas
            n_flips = 1 if n_rows <= 4 or rng.random() < 0.7 else 2
            for idx in rng.sample(range(n_rows - 1), min(n_flips, n_rows - 1)):
                cuts[idx] = 1 - cuts[idx]
        elif mode < 0.65:
            # Resample K secara probabilistik dari 1..N
            new_k = rng.randint(1, n_rows)
            cuts = [0] * (n_rows - 1)
            if new_k > 1:
                for idx in rng.sample(range(n_rows - 1), new_k - 1):
                    cuts[idx] = 1
        elif sum(cuts) > 0 and sum(cuts) < n_rows - 1:
            # Geser satu batas zona ke celah kosong
            ones = [i for i, b in enumerate(cuts) if b == 1]
            zeros = [i for i, b in enumerate(cuts) if b == 0]
            cuts[rng.choice(ones)] = 0
            cuts[rng.choice(zeros)] = 1

    # 2. Mutasi kunci prioritas baris
    if n_rows > 1 and rng.random() < 0.75:
        i, j = rng.sample(range(n_rows), 2)
        priorities[i], priorities[j] = priorities[j], priorities[i]
        priorities[rng.randrange(n_rows)] = rng.random()

    # 3. Mutasi aturan dalam zona
    if rng.random() < 0.25:
        rule = "BTF_IN_ZONE" if rule == "WMA_IN_ZONE" else "WMA_IN_ZONE"

    return ZoneGenome(cuts=tuple(cuts), row_priorities=tuple(priorities), in_zone_rule=rule)


def evaluate_genome_training_fitness(
    genome: ZoneGenome,
    training_replications: Sequence[Tuple[int, List[Dict[str, Any]]]],
    cabin: CabinSpec,
    dt: float = 0.25,
    zone_call_overhead_s: float = 0.0,
) -> float:
    """
    Menghitung rata-rata waktu boarding (detik) pada himpunan replikasi TRAINING (CRN).
    """
    total_s = 0.0
    for rep_seed, rep_passengers in training_replications:
        ordered, groups = build_boarding_sequence(
            rep_passengers, strategy="ZONE", seed=rep_seed, genome=genome
        )
        res = simulate(
            ordered,
            cabin=cabin,
            dt=dt,
            zone_call_overhead_s=zone_call_overhead_s,
            group_ids=groups,
            record_trace=False,
            verify_invariants=False,
        )
        total_s += res["boarding_time_s"]
    return total_s / max(1, len(training_replications))


def run_ga_variable_k(
    cabin: CabinSpec,
    bag_ratio: float,
    ga_population: int = 16,
    ga_generations: int = 10,
    train_reps: int = 4,
    seed: int = 20261028,
    dt: float = 0.25,
    zone_call_overhead_s: float = 0.0,
    progress_callback: Optional[Callable[[int, int, float, ZoneGenome], None]] = None,
) -> Dict[str, Any]:
    """
    Menjalankan Genetic Algorithm dengan K variabel tanpa batas artifisial min/max ukuran zona.
    Menggunakan cache berdasarkan signature kanonik (cut_rows, zone_calling_order, in_zone_rule)
    agar evaluasi kandidat identik tidak dihitung berulang.
    """
    n_rows = cabin.rows
    rng = random.Random(seed)

    # Bangkitkan replikasi TRAINING dengan seed terpisah dari TESTING
    train_seeds = [seed + 1000 + r * 37 for r in range(train_reps)]
    training_replications = [
        (s, generate_replication_passengers(cabin, bag_ratio, s))
        for s in train_seeds
    ]

    # Blueprint bagian 8: uji setidaknya satu partisi untuk SETIAP K=1..N
    # pada seed TRAINING yang sama, bahkan jika ga_population < N.
    # Tahap ini adalah pemeriksaan cakupan K, BUKAN enumerasi seluruh ruang solusi.
    # ga_population tetap anggaran populasi evolusi, tidak diam-diam dinaikkan ke N.
    k_values_to_cover = list(range(1, n_rows + 1))
    rng.shuffle(k_values_to_cover)
    coverage_candidates = [
        random_genome_with_k(
            n_rows, k_val, rng,
            in_zone_rule="WMA_IN_ZONE" if idx % 2 == 0 else "BTF_IN_ZONE",
        )
        for idx, k_val in enumerate(k_values_to_cover)
    ]

    fitness_cache: Dict[Tuple[Tuple[int, ...], Tuple[int, ...], str], float] = {}
    explored_k_values: set[int] = set()
    fitness_history: List[Dict[str, Any]] = []

    def get_fitness(g: ZoneGenome) -> float:
        explored_k_values.add(g.k_zones)
        sig = g.signature()
        if sig not in fitness_cache:
            fitness_cache[sig] = evaluate_genome_training_fitness(
                g,
                training_replications,
                cabin=cabin,
                dt=dt,
                zone_call_overhead_s=zone_call_overhead_s,
            )
        return fitness_cache[sig]

    # Semua nilai K telah dievaluasi setidaknya sekali; hasil terbaik tahap
    # cakupan ikut dipertimbangkan sebagai kandidat elit awal. Sisanya dipilih
    # dengan acak terkontrol agar tidak seluruh populasi kehilangan keragaman.
    coverage_scores = [(get_fitness(g), g) for g in coverage_candidates]
    coverage_best_fitness, coverage_best_genome = min(
        coverage_scores, key=lambda item: item[0]
    )
    coverage_by_k = {
        g.k_zones: round(fit, 3) for fit, g in coverage_scores
    }
    population: List[ZoneGenome] = [coverage_best_genome]
    remaining_candidates = [
        g for g in coverage_candidates if g is not coverage_best_genome
    ]
    slots = max(0, ga_population - len(population))
    population.extend(
        rng.sample(remaining_candidates, min(slots, len(remaining_candidates)))
    )
    while len(population) < ga_population:
        population.append(random_genome(n_rows, rng))

    best_genome = coverage_best_genome
    best_fitness = coverage_best_fitness

    for gen in range(ga_generations):
        scored = [(get_fitness(g), g) for g in population]
        scored.sort(key=lambda item: item[0])

        if scored[0][0] < best_fitness:
            best_fitness, best_genome = scored[0]

        mean_fit = sum(s for s, _ in scored) / len(scored)
        fitness_history.append({
            "generation": gen + 1,
            "best_fitness_s": round(best_fitness, 3),
            "generation_best_s": round(scored[0][0], 3),
            "mean_fitness_s": round(mean_fit, 3),
            "best_k": best_genome.k_zones,
            "best_cut_rows": best_genome.cut_rows,
            "best_zone_order": best_genome.zone_calling_order(),
            "best_in_zone_rule": best_genome.in_zone_rule,
        })

        if progress_callback:
            progress_callback(gen + 1, ga_generations, best_fitness, best_genome)

        if gen == ga_generations - 1:
            break

        # Elitisme + Turnamen + Crossover + Mutasi
        elite_count = max(1, min(2, ga_population // 4))
        next_pop: List[ZoneGenome] = [g for _, g in scored[:elite_count]]

        while len(next_pop) < ga_population:
            # Tournament selection
            t_size = min(3, len(scored))
            cand_a = min(rng.sample(scored, t_size), key=lambda item: item[0])[1]
            cand_b = min(rng.sample(scored, t_size), key=lambda item: item[0])[1]
            child = crossover_genomes(cand_a, cand_b, rng)
            child = mutate_genome(child, rng, mutation_rate=0.45)
            next_pop.append(child)

        population = next_pop

    return {
        "best_genome": best_genome,
        "best_training_fitness_s": round(best_fitness, 3),
        "k_zones": best_genome.k_zones,
        "cut_rows": best_genome.cut_rows,
        "zone_ranges": best_genome.zone_row_ranges(),
        "zone_sizes": best_genome.zone_sizes(),
        "zone_order": best_genome.zone_calling_order(),
        "in_zone_rule": best_genome.in_zone_rule,
        "explored_k_values": sorted(explored_k_values),
        "initial_k_coverage": sorted(coverage_by_k),
        "initial_coverage_candidates_evaluated": len(coverage_scores),
        "initial_coverage_fitness_by_k_s": coverage_by_k,
        "ga_population_requested": ga_population,
        "unique_candidates_evaluated": len(fitness_cache),
        "fitness_history": fitness_history,
        "train_seeds": train_seeds,
    }


def run_exhaustive_mini_cabin(
    cabin: CabinSpec,
    bag_ratio: float,
    train_reps: int = 3,
    seed: int = 20261028,
    dt: float = 0.25,
) -> Dict[str, Any]:
    """
    Enumerasi menyeluruh untuk pesawat mini (mis. N <= 4) guna menguji kualitas GA
    sesuai Acceptance Test G pada Blueprint bagian 8 & 10.
    """
    if cabin.rows > 5:
        raise ValueError("Enumerasi penuh hanya ditujukan untuk pesawat mini (rows <= 5).")

    train_seeds = [seed + 1000 + r * 37 for r in range(train_reps)]
    training_replications = [
        (s, generate_replication_passengers(cabin, bag_ratio, s))
        for s in train_seeds
    ]

    best_fitness = float("inf")
    best_config: Optional[Dict[str, Any]] = None
    total_evaluated = 0

    for cuts in itertools.product((0, 1), repeat=cabin.rows - 1):
        # Bangkitkan rentang zona dari cuts
        temp_genome = ZoneGenome(
            cuts=cuts,
            row_priorities=tuple(float(i) for i in range(cabin.rows)),
            in_zone_rule="WMA_IN_ZONE",
        )
        ranges = temp_genome.zone_row_ranges()
        k_zones = len(ranges)

        for perm in itertools.permutations(range(1, k_zones + 1)):
            # Konversi permutasi urutan zona menjadi row_priorities pada baris awal tiap zona
            prio = [0.0] * cabin.rows
            for call_rank, z_id in enumerate(perm):
                start_row, _ = ranges[z_id - 1]
                prio[start_row - 1] = float(call_rank)

            for rule in VALID_IN_ZONE_RULES:
                cand = ZoneGenome(cuts=cuts, row_priorities=tuple(prio), in_zone_rule=rule)
                fit = evaluate_genome_training_fitness(cand, training_replications, cabin=cabin, dt=dt)
                total_evaluated += 1
                if fit < best_fitness:
                    best_fitness = fit
                    best_config = {
                        "genome": cand,
                        "fitness_s": round(fit, 3),
                        "k_zones": k_zones,
                        "cut_rows": cand.cut_rows,
                        "zone_order": list(perm),
                        "in_zone_rule": rule,
                    }

    return {
        "best_fitness_s": round(best_fitness, 3),
        "best_config": best_config,
        "total_candidates_evaluated": total_evaluated,
    }


# ==============================================================================
# STATISTIK SAMPEL, SELANG KEPERCAYAAN, DAN PERBANDINGAN BERPASANGAN (BAGIAN 5.1)
# ==============================================================================

def compute_sample_stats(values: Sequence[float]) -> Dict[str, float]:
    """
    Menghitung rerata sampel, simpangan baku sampel s, dan aproksimasi CI 95% = mean +/- 1.96 * s / sqrt(R).
    """
    r_count = len(values)
    if r_count == 0:
        return {"mean": 0.0, "sd": 0.0, "ci95_low": 0.0, "ci95_high": 0.0, "min": 0.0, "max": 0.0}
    mean_val = sum(values) / r_count
    if r_count > 1:
        variance = sum((v - mean_val) ** 2 for v in values) / (r_count - 1)
        sd_val = math.sqrt(max(0.0, variance))
        half_width = 1.96 * sd_val / math.sqrt(r_count)
    else:
        sd_val = 0.0
        half_width = 0.0
    return {
        "mean": round(mean_val, 3),
        "sd": round(sd_val, 3),
        "ci95_low": round(mean_val - half_width, 3),
        "ci95_high": round(mean_val + half_width, 3),
        "min": round(min(values), 3),
        "max": round(max(values), 3),
    }


STRATEGY_LABELS: Dict[str, Dict[str, str]] = {
    "ZONE": {
        "id": "ZONE",
        "short_label": "Boarding Berbasis Zona (Hasil Optimasi AZBO)",
        "category": "Berbasis Zona (Optimasi GA)",
    },
    "WMA": {
        "id": "WMA",
        "short_label": "Jendela–Tengah–Lorong (Window–Middle–Aisle / WMA)",
        "category": "Berdasarkan Posisi Kursi",
    },
    "BTF": {
        "id": "BTF",
        "short_label": "Belakang ke Depan (Back-to-Front)",
        "category": "Berdasarkan Baris",
    },
    "RANDOM": {
        "id": "RANDOM",
        "short_label": "Acak (Tanpa Urutan Khusus / Random)",
        "category": "Pembanding Dasar",
    },
    "REVERSE_PYRAMID": {
        "id": "REVERSE_PYRAMID",
        "short_label": "Piramida Terbalik (Reverse Pyramid)",
        "category": "Kombinasi Diagonal Baris & Kursi",
    },
    "STEFFEN": {
        "id": "STEFFEN",
        "short_label": "Metode Steffen (Urutan Kursi Berselang-seling)",
        "category": "Urutan Kursi Berselang-seling",
    },
    "ROTATING_ZONES": {
        "id": "ROTATING_ZONES",
        "short_label": "Zona Berputar (Rotating Zones)",
        "category": "Blok Zona Bergantian",
    },
    "MODIFIED_OPTIMAL": {
        "id": "MODIFIED_OPTIMAL",
        "short_label": "Optimal Termodifikasi (Modified Optimal)",
        "category": "Baris Genap/Ganjil & Sisi Kabin",
    },
    "FRONT_TO_BACK": {
        "id": "FRONT_TO_BACK",
        "short_label": "Depan ke Belakang (Front-to-Back)",
        "category": "Berdasarkan Baris (Depan ke Belakang)",
    },
    "BLOCKS_4_ROWS": {
        "id": "BLOCKS_4_ROWS",
        "short_label": "Blok 4 Baris (Four-Row Blocks)",
        "category": "Blok Baris Tetap Bergantian",
    },
    "DOUBLE_OUTSIDE_IN": {
        "id": "DOUBLE_OUTSIDE_IN",
        "short_label": "Double Outside-In (Adaptasi Kabin Satu Lorong)",
        "category": "Hibrida Dua Bagian Kabin & Posisi Kursi",
    },
    "BTF_WMA_FIXED": {
        "id": "BTF_WMA_FIXED",
        "short_label": "Back-to-Front + WMA (3 Zona Tetap)",
        "category": "Hibrida Zona Tetap & Posisi Kursi",
    },
}


def format_operational_calling_steps(
    strategy_id: str,
    cabin: CabinSpec,
    ga_result: Dict[str, Any],
) -> List[str]:
    """
    Menyusun petunjuk urutan pemanggilan penumpang dalam bahasa operasional sederhana
    untuk teknisi dan petugas gate bandara.
    """
    if strategy_id == "ZONE":
        ranges: List[Tuple[int, int]] = ga_result["zone_ranges"]
        order: List[int] = ga_result["zone_order"]
        rule: str = ga_result["in_zone_rule"]
        rule_desc = (
            "kursi Jendela terlebih dahulu, lalu Tengah, kemudian Lorong"
            if rule == "WMA_IN_ZONE"
            else "baris belakang ke baris depan di dalam zona tersebut"
        )
        steps: List[str] = []
        for step_num, z_id in enumerate(order, start=1):
            start_r, end_r = ranges[z_id - 1]
            row_label = f"Baris {start_r}" if start_r == end_r else f"Baris {start_r} s/d Baris {end_r}"
            steps.append(
                f"Panggilan {step_num} — Zona {z_id} ({row_label}): "
                f"Panggil penumpang pada {row_label} dengan urutan {rule_desc}."
            )
        return steps

    if strategy_id == "WMA":
        if cabin.seats_per_row >= 5:
            return [
                f"Panggilan 1 — Kursi Jendela: Panggil seluruh penumpang kursi jendela (Baris {cabin.rows} hingga Baris 1).",
                f"Panggilan 2 — Kursi Tengah: Panggil seluruh penumpang kursi tengah (Baris {cabin.rows} hingga Baris 1).",
                f"Panggilan 3 — Kursi Lorong: Panggil seluruh penumpang kursi tepi lorong (Baris {cabin.rows} hingga Baris 1).",
            ]
        return [
            f"Panggilan 1 — Kursi Jendela: Panggil seluruh penumpang kursi jendela (Baris {cabin.rows} hingga Baris 1).",
            f"Panggilan 2 — Kursi Lorong: Panggil seluruh penumpang kursi tepi lorong (Baris {cabin.rows} hingga Baris 1).",
        ]

    if strategy_id == "BTF":
        return [
            f"Panggil penumpang secara bertahap mulai dari baris paling belakang (Baris {cabin.rows}) menuju baris paling depan (Baris 1).",
        ]

    if strategy_id == "FRONT_TO_BACK":
        return [
            f"Panggil penumpang secara bertahap mulai dari baris paling depan (Baris 1) menuju baris paling belakang (Baris {cabin.rows}).",
        ]

    if strategy_id == "REVERSE_PYRAMID":
        rear_segs = reverse_pyramid_row_segments(cabin.rows, max_segments=3)
        if len(rear_segs) >= 3 and cabin.seats_per_row >= 5:
            r_rear = f"Baris {rear_segs[0][0]}–{rear_segs[0][1]}"
            r_mid = f"Baris {rear_segs[1][0]}–{rear_segs[1][1]}"
            r_front = f"Baris {rear_segs[2][0]}–{rear_segs[2][1]}"
            return [
                f"Panggilan 1 — Kelompok Diagonal 1: Kursi Jendela bagian belakang ({r_rear}).",
                f"Panggilan 2 — Kelompok Diagonal 2: Kursi Jendela bagian tengah ({r_mid}) bersama Kursi Tengah bagian belakang ({r_rear}).",
                f"Panggilan 3 — Kelompok Diagonal 3: Kursi Jendela bagian depan ({r_front}), Kursi Tengah bagian tengah ({r_mid}), dan Kursi Lorong bagian belakang ({r_rear}).",
                f"Panggilan 4 — Kelompok Diagonal 4: Kursi Tengah bagian depan ({r_front}) bersama Kursi Lorong bagian tengah ({r_mid}).",
                f"Panggilan 5 — Kelompok Diagonal 5: Kursi Lorong bagian depan ({r_front}).",
            ]
        if len(rear_segs) >= 3:
            r_rear = f"Baris {rear_segs[0][0]}–{rear_segs[0][1]}"
            r_mid = f"Baris {rear_segs[1][0]}–{rear_segs[1][1]}"
            r_front = f"Baris {rear_segs[2][0]}–{rear_segs[2][1]}"
            return [
                f"Panggilan 1 — Kelompok Diagonal 1: Kursi Jendela bagian belakang ({r_rear}).",
                f"Panggilan 2 — Kelompok Diagonal 2: Kursi Jendela bagian tengah ({r_mid}) bersama Kursi Lorong bagian belakang ({r_rear}).",
                f"Panggilan 3 — Kelompok Diagonal 3: Kursi Jendela bagian depan ({r_front}) bersama Kursi Lorong bagian tengah ({r_mid}).",
                f"Panggilan 4 — Kelompok Diagonal 4: Kursi Lorong bagian depan ({r_front}).",
            ]
        return [
            f"Panggil penumpang secara diagonal dimulai dari kursi jendela bagian belakang (Baris {cabin.rows}) menuju kursi lorong bagian depan (Baris 1).",
        ]

    if strategy_id == "STEFFEN":
        rear_label = "genap" if (cabin.rows % 2 == 0) else "ganjil"
        alt_label = "ganjil" if (cabin.rows % 2 == 0) else "genap"
        steps = [
            f"Tahap 1 — Kursi Jendela Berselang-seling: Panggil kursi jendela dari belakang (Baris {cabin.rows}, melompati 1 baris pada baris {rear_label}) sisi kiri lalu sisi kanan, kemudian baris {alt_label} sisi kiri lalu sisi kanan.",
        ]
        if cabin.seats_per_row >= 5:
            steps.append(
                f"Tahap 2 — Kursi Tengah Berselang-seling: Panggil kursi tengah dari belakang dengan pola selang-seling baris {rear_label} lalu baris {alt_label} pada masing-masing sisi kabin."
            )
            steps.append(
                f"Tahap 3 — Kursi Lorong Berselang-seling: Panggil kursi lorong dari belakang dengan pola selang-seling baris {rear_label} lalu baris {alt_label} sisi kiri kemudian sisi kanan."
            )
        else:
            steps.append(
                f"Tahap 2 — Kursi Lorong Berselang-seling: Panggil kursi lorong dari belakang dengan pola selang-seling baris {rear_label} lalu baris {alt_label} sisi kiri kemudian sisi kanan."
            )
        steps.append(
            "Catatan Operasional Gate: Metode ini membutuhkan pemanggilan nomor kursi berurutan secara ketat agar penumpang di baris bersebelahan tidak saling menghalangi saat menyimpan bagasi."
        )
        return steps

    if strategy_id == "ROTATING_ZONES":
        rot_ranges = equal_rotating_zone_ranges(cabin.rows, max_zones=5)
        rot_order = rotating_zone_calling_order(len(rot_ranges))
        steps = []
        for step_num, z_id in enumerate(rot_order, start=1):
            start_r, end_r = rot_ranges[z_id - 1]
            pos_desc = (
                "Bagian Belakang"
                if z_id == len(rot_ranges)
                else ("Bagian Depan" if z_id == 1 else "Bagian Menuju Tengah")
            )
            row_label = f"Baris {start_r}" if start_r == end_r else f"Baris {start_r} s/d Baris {end_r}"
            steps.append(
                f"Panggilan {step_num} — Zona Rotasi {z_id} ({pos_desc}, {row_label}): "
                f"Panggil penumpang pada {row_label} dari baris belakang ke depan."
            )
        return steps

    if strategy_id == "BLOCKS_4_ROWS":
        block_ranges = four_row_block_ranges(cabin.rows, block_size=4)
        block_order = rotating_zone_calling_order(len(block_ranges))
        steps = []
        for step_num, b_id in enumerate(block_order, start=1):
            start_r, end_r = block_ranges[b_id - 1]
            pos_desc = (
                "Blok Paling Belakang"
                if b_id == len(block_ranges)
                else ("Blok Paling Depan" if b_id == 1 else "Blok Menuju Tengah")
            )
            row_label = f"Baris {start_r}" if start_r == end_r else f"Baris {start_r} s/d Baris {end_r}"
            steps.append(
                f"Panggilan {step_num} — Blok {b_id} ({pos_desc}, {row_label}): "
                f"Panggil seluruh penumpang pada {row_label} (urutan bebas/acak di dalam blok)."
            )
        return steps

    if strategy_id == "DOUBLE_OUTSIDE_IN":
        (front_s, front_e), (rear_s, rear_e) = double_outside_in_row_split(cabin.rows)
        rear_lbl = f"Baris {rear_s}–{rear_e}"
        front_lbl = f"Baris {front_s}–{front_e}" if front_e >= front_s else f"Baris {rear_s}–{rear_e}"
        if cabin.seats_per_row >= 5:
            return [
                f"Panggilan 1 — Kursi Jendela Belakang: Panggil kursi jendela bagian belakang kabin ({rear_lbl}).",
                f"Panggilan 2 — Kursi Jendela Depan: Panggil kursi jendela bagian depan kabin ({front_lbl}).",
                f"Panggilan 3 — Kursi Tengah Belakang: Panggil kursi tengah bagian belakang kabin ({rear_lbl}).",
                f"Panggilan 4 — Kursi Tengah Depan: Panggil kursi tengah bagian depan kabin ({front_lbl}).",
                f"Panggilan 5 — Kursi Lorong Belakang: Panggil kursi tepi lorong bagian belakang kabin ({rear_lbl}).",
                f"Panggilan 6 — Kursi Lorong Depan: Panggil kursi tepi lorong bagian depan kabin ({front_lbl}).",
                "Catatan Ilmiah: Merupakan adaptasi metode Double Outside-In (Dong et al., 2025) untuk model kabin satu lorong.",
            ]
        return [
            f"Panggilan 1 — Kursi Jendela Belakang: Panggil kursi jendela bagian belakang kabin ({rear_lbl}).",
            f"Panggilan 2 — Kursi Jendela Depan: Panggil kursi jendela bagian depan kabin ({front_lbl}).",
            f"Panggilan 3 — Kursi Lorong Belakang: Panggil kursi tepi lorong bagian belakang kabin ({rear_lbl}).",
            f"Panggilan 4 — Kursi Lorong Depan: Panggil kursi tepi lorong bagian depan kabin ({front_lbl}).",
            "Catatan Ilmiah: Merupakan adaptasi metode Double Outside-In (Dong et al., 2025) untuk model kabin satu lorong tanpa kursi tengah.",
        ]

    if strategy_id == "BTF_WMA_FIXED":
        fixed_ranges = fixed_btf_wma_zone_ranges(cabin.rows, max_zones=3)
        k_fixed = len(fixed_ranges)
        steps = []
        call_idx = 0
        has_middle = cabin.seats_per_row >= 5
        seat_classes = (
            [("Kursi Jendela", "jendela"), ("Kursi Tengah", "tengah"), ("Kursi Lorong", "tepi lorong")]
            if has_middle
            else [("Kursi Jendela", "jendela"), ("Kursi Lorong", "tepi lorong")]
        )
        for z_id in range(k_fixed, 0, -1):
            start_r, end_r = fixed_ranges[z_id - 1]
            zone_pos = (
                "Zona Belakang"
                if z_id == k_fixed
                else ("Zona Depan" if z_id == 1 else "Zona Tengah")
            )
            row_lbl = f"Baris {start_r}–{end_r}" if start_r != end_r else f"Baris {start_r}"
            for cls_title, cls_desc in seat_classes:
                call_idx += 1
                steps.append(
                    f"Panggilan {call_idx} — {zone_pos} ({row_lbl}) {cls_title}: "
                    f"Panggil penumpang kursi {cls_desc} pada {row_lbl} dari belakang ke depan."
                )
        return steps

    if strategy_id == "MODIFIED_OPTIMAL":
        left_cols = ", ".join(cabin.resolved_left_letters())
        right_cols = ", ".join(cabin.resolved_right_letters())
        return [
            f"Panggilan 1 — Kelompok 1 (Baris Genap Sisi Kiri): Panggil penumpang pada nomor baris genap di sisi kiri lorong (Kursi {left_cols}) dari belakang ke depan.",
            f"Panggilan 2 — Kelompok 2 (Baris Genap Sisi Kanan): Panggil penumpang pada nomor baris genap di sisi kanan lorong (Kursi {right_cols}) dari belakang ke depan.",
            f"Panggilan 3 — Kelompok 3 (Baris Ganjil Sisi Kiri): Panggil penumpang pada nomor baris ganjil di sisi kiri lorong (Kursi {left_cols}) dari belakang ke depan.",
            f"Panggilan 4 — Kelompok 4 (Baris Ganjil Sisi Kanan): Panggil penumpang pada nomor baris ganjil di sisi kanan lorong (Kursi {right_cols}) dari belakang ke depan.",
        ]

    return [
        "Penumpang memasuki kabin sesuai urutan kedatangan di pintu boarding tanpa pembagian kelompok khusus.",
    ]


def run_azbo_v2_evaluation(
    cabin: CabinSpec,
    bag_ratio: float,
    ga_population: int = 14,
    ga_generations: int = 8,
    train_reps: int = 3,
    test_reps: int = 20,
    seed: int = 20261028,
    dt: float = 0.25,
    zone_call_overhead_s: float = 0.0,
    progress_callback: Optional[Callable[[str, float], None]] = None,
) -> Dict[str, Any]:
    """
    Pipeline lengkap AZBO V2 sesuai Blueprint bagian 5 & 9.2 untuk 12 kelompok metode boarding:
    1. Jalankan GA variabel K pada replikasi TRAINING untuk memperoleh konfigurasi ZONE terbaik.
    2. Evaluasi seluruh 12 strategi dalam M = {ZONE, WMA, BTF, RANDOM, REVERSE_PYRAMID, STEFFEN,
       ROTATING_ZONES, MODIFIED_OPTIMAL, FRONT_TO_BACK, BLOCKS_4_ROWS, DOUBLE_OUTSIDE_IN,
       BTF_WMA_FIXED} pada replikasi TESTING baru menggunakan Common Random Numbers (CRN).
    3. Hitung rerata, SD, CI 95%, perbandingan berpasangan (paired comparison), serta deteksi
       ekuivalensi urutan dan kedekatan hasil antar-metode teratas.
    4. Hasilkan event trace dan timeline detail untuk visualisasi animasi di frontend.
    """
    if progress_callback:
        progress_callback("Mencari pembagian zona boarding terbaik...", 10.0)

    def ga_cb(gen: int, total_gen: int, _best_fit: float, _best_g: ZoneGenome) -> None:
        if progress_callback:
            pct = 10.0 + (gen / max(1, total_gen)) * 45.0
            progress_callback(
                f"Mengoptimalkan konfigurasi zona boarding (tahap {gen}/{total_gen})...",
                round(pct, 1),
            )

    ga_res = run_ga_variable_k(
        cabin=cabin,
        bag_ratio=bag_ratio,
        ga_population=ga_population,
        ga_generations=ga_generations,
        train_reps=train_reps,
        seed=seed,
        dt=dt,
        zone_call_overhead_s=zone_call_overhead_s,
        progress_callback=ga_cb,
    )
    best_genome: ZoneGenome = ga_res["best_genome"]

    # Bangkitkan seed TESTING yang terpisah sepenuhnya dari seed TRAINING
    test_seeds = [seed + 50000 + r * 53 for r in range(test_reps)]
    strategies = list(SUPPORTED_AZBO_V2_STRATEGIES)

    per_strategy_times: Dict[str, List[float]] = {m: [] for m in strategies}
    per_strategy_aisle_waits: Dict[str, List[int]] = {m: [] for m in strategies}
    per_strategy_seat_blocks: Dict[str, List[int]] = {m: [] for m in strategies}
    # Ekuivalensi dinilai pada SEMUA replikasi, bukan hanya urutan pada seed pertama.
    sequences_by_rep: Dict[str, List[Tuple[str, ...]]] = {m: [] for m in strategies}

    for r_idx, t_seed in enumerate(test_seeds):
        if progress_callback:
            pct = 55.0 + ((r_idx + 1) / max(1, test_reps)) * 42.0
            progress_callback(
                f"Menguji perbandingan {len(strategies)} metode pada simulasi berulang ({r_idx + 1}/{test_reps})...",
                round(pct, 1),
            )

        rep_passengers = generate_replication_passengers(cabin, bag_ratio, t_seed)
        for m in strategies:
            ordered, groups = build_boarding_sequence(
                rep_passengers,
                strategy=m,
                seed=t_seed,
                genome=best_genome if m == "ZONE" else None,
            )
            sequences_by_rep[m].append(tuple(p["seat_id"] for p in ordered))

            sim_out = simulate(
                ordered,
                cabin=cabin,
                dt=dt,
                zone_call_overhead_s=zone_call_overhead_s,
                group_ids=groups,
                record_trace=False,  # Trace dihasilkan untuk replikasi representatif pemenang.
                verify_invariants=(r_idx == 0),
            )
            per_strategy_times[m].append(sim_out["boarding_time_s"])
            per_strategy_aisle_waits[m].append(sim_out["metrics"]["aisle_interference_events"])
            per_strategy_seat_blocks[m].append(sim_out["metrics"]["seat_interference_events"])

    # Deteksi ekuivalensi urutan hanya jika identik pada SELURUH seed TEST.
    equivalent_pairs: List[Tuple[str, str]] = []
    for i, m1 in enumerate(strategies):
        for m2 in strategies[i + 1:]:
            if all(
                seq1 == seq2
                for seq1, seq2 in zip(sequences_by_rep[m1], sequences_by_rep[m2])
            ):
                equivalent_pairs.append((m1, m2))

    # Hitung statistik per strategi & urutkan berdasarkan rerata sampel TESTING
    strategy_summaries: List[Dict[str, Any]] = []
    for m in strategies:
        stats_s = compute_sample_stats(per_strategy_times[m])
        mean_aisle_events = int(round(sum(per_strategy_aisle_waits[m]) / max(1, test_reps)))
        mean_seat_events = int(round(sum(per_strategy_seat_blocks[m]) / max(1, test_reps)))
        meta = STRATEGY_LABELS[m]

        zone_cfg = None
        if m == "ZONE":
            zone_cfg = {
                "k_zones": ga_res["k_zones"],
                "boundaries": ga_res["cut_rows"],
                "sizes": ga_res["zone_sizes"],
                "order": ga_res["zone_order"],
                "zone_ranges": [list(rng_pair) for rng_pair in ga_res["zone_ranges"]],
                "in_zone_rule": ga_res["in_zone_rule"],
            }
        elif m == "BTF_WMA_FIXED":
            fixed_ranges = fixed_btf_wma_zone_ranges(cabin.rows, max_zones=3)
            k_fixed = len(fixed_ranges)
            fixed_boundaries = [end_r for (_start_r, end_r) in fixed_ranges[:-1]]
            fixed_sizes = [end_r - start_r + 1 for (start_r, end_r) in fixed_ranges]
            fixed_order = list(range(k_fixed, 0, -1))
            zone_cfg = {
                "k_zones": k_fixed,
                "boundaries": fixed_boundaries,
                "sizes": fixed_sizes,
                "order": fixed_order,
                "zone_ranges": [list(rng_pair) for rng_pair in fixed_ranges],
                "in_zone_rule": "WMA_IN_ZONE",
            }

        strategy_summaries.append({
            "strategy_id": m,
            "short_label": meta["short_label"],
            "category": meta["category"],
            "mean_s": stats_s["mean"],
            "sd_s": stats_s["sd"],
            "ci95_low_s": stats_s["ci95_low"],
            "ci95_high_s": stats_s["ci95_high"],
            "min_s": stats_s["min"],
            "max_s": stats_s["max"],
            "mean_min": round(stats_s["mean"] / 60.0, 2),
            "sd_min": round(stats_s["sd"] / 60.0, 2),
            "mean_aisle_interference_events": mean_aisle_events,
            "mean_seat_interference_events": mean_seat_events,
            "zone_config": zone_cfg,
            "calling_steps": format_operational_calling_steps(m, cabin, ga_res),
        })

    # Jika ZONE memiliki rerata yang sama persis dengan metode standar (mis. K=1 + WMA_IN_ZONE),
    # utamakan metode yang lebih sederhana secara operasional
    strategy_summaries.sort(
        key=lambda item: (
            item["mean_s"],
            0 if item["strategy_id"] != "ZONE" else 1,
        )
    )

    winner = strategy_summaries[0]
    winner_id = winner["strategy_id"]
    winner_times = per_strategy_times[winner_id]

    # Hitung selisih berpasangan (paired comparison) terhadap pemenang pada skenario acak yang sama
    paired_comparisons: List[Dict[str, Any]] = []
    for rank_idx, item in enumerate(strategy_summaries, start=1):
        m_id = item["strategy_id"]
        diffs = [
            t_m - t_w
            for t_m, t_w in zip(per_strategy_times[m_id], winner_times)
        ]
        diff_stats = compute_sample_stats(diffs)
        diff_pct = (diff_stats["mean"] / winner["mean_s"] * 100.0) if winner["mean_s"] > 0 else 0.0
        item["rank"] = rank_idx
        item["diff_from_best_s"] = round(diff_stats["mean"], 3)
        item["diff_from_best_pct"] = round(diff_pct, 2)
        item["paired_diff_sd_s"] = diff_stats["sd"]
        item["paired_diff_ci95_s"] = [diff_stats["ci95_low"], diff_stats["ci95_high"]]

        paired_comparisons.append({
            "strategy_id": m_id,
            "short_label": item["short_label"],
            "vs_winner_id": winner_id,
            "mean_diff_s": diff_stats["mean"],
            "sd_diff_s": diff_stats["sd"],
            "ci95_diff_s": [diff_stats["ci95_low"], diff_stats["ci95_high"]],
        })

    # Periksa apakah peringkat #1 dan #2 memiliki selisih waktu rata-rata yang sangat berdekatan
    close_competition_note: Optional[str] = None
    if len(strategy_summaries) >= 2:
        runner_up = strategy_summaries[1]
        ci_diff_low = runner_up["paired_diff_ci95_s"][0]
        diff_s = runner_up["diff_from_best_s"]
        if ci_diff_low <= 0.0:
            close_competition_note = (
                f"Catatan Penelitian: CI 95% aproksimasi selisih berpasangan metode peringkat #2 "
                f"({runner_up['short_label']}) terhadap peringkat #1 mencakup nol "
                f"(selisih sampel +{diff_s:.1f} detik pada {test_reps} replikasi). "
                "Bukti dari sampel ini belum cukup untuk menyimpulkan perbedaan yang meyakinkan; "
                "ini juga TIDAK membuktikan kedua metode setara secara operasional."
            )

    # Animasi merupakan SATU replikasi yang benar-benar dijalankan, bukan rata-rata
    # semua replikasi. Pilih replikasi dengan durasi terdekat pada rerata pemenang
    # agar tampilan demonstrasi tidak memakai seed pertama yang bisa menyimpang jauh.
    representative_idx = min(
        range(test_reps),
        key=lambda i: (abs(winner_times[i] - winner["mean_s"]), i),
    )
    representative_seed = test_seeds[representative_idx]
    representative_passengers = generate_replication_passengers(
        cabin, bag_ratio, representative_seed
    )
    representative_order, representative_groups = build_boarding_sequence(
        representative_passengers,
        strategy=winner_id,
        seed=representative_seed,
        genome=best_genome if winner_id == "ZONE" else None,
    )
    winner_rep = simulate(
        representative_order,
        cabin=cabin,
        dt=dt,
        zone_call_overhead_s=zone_call_overhead_s,
        group_ids=representative_groups,
        record_trace=True,
        verify_invariants=True,
    )
    if abs(winner_rep["boarding_time_s"] - winner_times[representative_idx]) > 1e-6:
        raise AssertionError("Reproduksi trace pemenang berbeda dari evaluasi TEST!")
    n_bags = deterministic_baggage_count(cabin.capacity, bag_ratio)

    if progress_callback:
        progress_callback("Selesai menyusun rekomendasi boarding.", 100.0)

    return {
        "scenario": {
            "layout_id": cabin.layout_id,
            "layout_name": cabin.layout_name,
            "rows": cabin.rows,
            "left_seats": cabin.left_seats,
            "right_seats": cabin.right_seats,
            "seats_per_row": cabin.seats_per_row,
            "capacity": cabin.capacity,
            "occupancy_rate": 1.0,
            "passenger_count": cabin.capacity,
            "bag_ratio": round(bag_ratio, 4),
            "baggage_percent": int(round(bag_ratio * 100)),
            "baggage_passenger_count": n_bags,
            "without_baggage_count": cabin.capacity - n_bags,
            "row_pitch_m": cabin.row_pitch_m,
            "cell_m": cabin.cell_m,
            "cells_per_row": cabin.cells_per_row,
            "total_cells": cabin.total_cells,
            "dt_s": dt,
            "zone_call_overhead_s": zone_call_overhead_s,
            "seed": seed,
            "train_reps": train_reps,
            "test_reps": test_reps,
        },
        "optimization": {
            "k_zones": ga_res["k_zones"],
            "cut_rows": ga_res["cut_rows"],
            "zone_ranges": [list(r) for r in ga_res["zone_ranges"]],
            "zone_sizes": ga_res["zone_sizes"],
            "zone_order": ga_res["zone_order"],
            "in_zone_rule": ga_res["in_zone_rule"],
            "best_training_fitness_s": ga_res["best_training_fitness_s"],
            "explored_k_values": ga_res["explored_k_values"],
            "initial_k_coverage": ga_res["initial_k_coverage"],
            "initial_coverage_candidates_evaluated": ga_res["initial_coverage_candidates_evaluated"],
            "initial_coverage_fitness_by_k_s": ga_res["initial_coverage_fitness_by_k_s"],
            "ga_population_requested": ga_res["ga_population_requested"],
            "train_seeds": ga_res["train_seeds"],
            "test_seeds": test_seeds,
            "unique_candidates_evaluated": ga_res["unique_candidates_evaluated"],
            "ga_population": ga_population,
            "ga_generations": ga_generations,
            "fitness_history": ga_res["fitness_history"],
        },
        "recommendation": {
            "winner_by_sample_mean": winner_id,
            "winner_short_label": winner["short_label"],
            "winner_category": winner["category"],
            "mean_s": winner["mean_s"],
            "sd_s": winner["sd_s"],
            "approx_95ci_s": [winner["ci95_low_s"], winner["ci95_high_s"]],
            "mean_min": winner["mean_min"],
            "sd_min": winner["sd_min"],
            "calling_steps": winner["calling_steps"],
            "zone_config": winner["zone_config"],
            "evaluated_strategies": strategy_summaries,
            "paired_comparisons": paired_comparisons,
            "equivalent_methods": [list(pair) for pair in equivalent_pairs],
            "close_competition_note": close_competition_note,
            "disclaimer": (
                "Hasil merupakan perkiraan berdasarkan model simulasi dan belum menggantikan "
                "pengujian operasional di lapangan."
            ),
        },
        "animation": {
            "strategy_id": winner_id,
            "strategy_label": winner["short_label"],
            "replication_seed": representative_seed,
            "replication_index": representative_idx + 1,
            "selection_method": "testing_replication_closest_to_winner_sample_mean",
            "sample_mean_s": winner["mean_s"],
            "is_single_replication": True,
            "boarding_time_s": winner_rep["boarding_time_s"],
            "metrics": winner_rep["metrics"],
            "timeline_details": winner_rep["details"],
            "trace": winner_rep["trace"],
        },
    }
