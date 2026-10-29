"""
Pengujian Regresi dan Kesetaraan Urutan & Invarian Model ZoneFlow × AZBO:
Memverifikasi:
1. Konstanta fisik kabin dan parameter Weibull / Triangular / Cellular
2. Peta 180 kursi (seat map 30 baris 3-3) serta multi-layout (2-2, 2-3, 3-3)
3. Generator penumpang deterministik (Weibull stowage time, Truncated Normal speed, Triangular seat access)
4. Kesetaraan urutan antrean penumpang untuk seluruh 12 metode boarding
5. Invarian fisik simulasi antrean berbasis sel (Cellular Blocking Flow P0-A) untuk seluruh 12 metode
"""

import unittest
import sys
import os
import random
import math

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
project_root = os.path.dirname(backend_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import app.simulation_core as b_core
from app.config import (
    N_ROWS, SEATS, CAPACITY, LOAD_FACTOR,
    ROW_PITCH_M, CELL_M, DT_S,
    SPEED_MEAN_M_S, SPEED_STD_M_S, SPEED_MAX_M_S,
    WEIBULL_SHAPE, WEIBULL_SCALE_S,
    TRIANGULAR_MIN_S, TRIANGULAR_MODE_S, TRIANGULAR_MAX_S,
    MOVES_ZERO_BLOCKERS, MOVES_ONE_BLOCKER, MOVES_TWO_BLOCKERS,
    K_ZONES, BEST_GA_CHROMOSOME, FIXED_ZONE_CHROMOSOME
)


def load_source_script_namespace():
    source_path = os.path.join(
        project_root, "public", "assets", "aistudio",
        "SimulasiLogikaUI_6_export_untuk_Claude_416c7319.py"
    )
    if not os.path.exists(source_path):
        raise FileNotFoundError(f"Script penelitian asli tidak ditemukan di {source_path}")

    with open(source_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    s1 = [l for l in lines[71:377] if not l.strip().startswith(("display(", "print(")) and "example_passengers = generate_passengers" not in l]
    s2 = [l for l in lines[400:421] if not l.strip().startswith(("display(", "print("))]
    s3 = [l for l in lines[458:489] if not l.strip().startswith(("display(", "print("))]

    class MockPD:
        @staticmethod
        def DataFrame(data):
            return data

    ns = {
        "random": random,
        "itertools": __import__("itertools"),
        "math": math,
        "pd": MockPD,
    }
    exec("".join(s1 + s2 + s3), ns)
    return ns


class TestModelEquivalence(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.src = load_source_script_namespace()
        cls.backend = b_core

    def test_01_physical_and_azbo_constants(self):
        """Memverifikasi konstanta geometri seluler P0-A dan distribusi stokastik P0-B."""
        self.assertEqual(N_ROWS, 30)
        self.assertEqual(SEATS, ["A", "B", "C", "D", "E", "F"])
        self.assertEqual(CAPACITY, 180)
        self.assertEqual(ROW_PITCH_M, 0.8)
        self.assertEqual(CELL_M, 0.4)
        self.assertEqual(DT_S, 0.25)
        self.assertEqual(SPEED_MEAN_M_S, 0.8)
        self.assertEqual(SPEED_STD_M_S, 0.1)
        self.assertEqual(SPEED_MAX_M_S, 0.8)
        self.assertEqual(WEIBULL_SHAPE, 1.7)
        self.assertEqual(WEIBULL_SCALE_S, 16.0)
        self.assertEqual(TRIANGULAR_MIN_S, 1.8)
        self.assertEqual(TRIANGULAR_MODE_S, 2.4)
        self.assertEqual(TRIANGULAR_MAX_S, 3.0)
        self.assertEqual((MOVES_ZERO_BLOCKERS, MOVES_ONE_BLOCKER, MOVES_TWO_BLOCKERS), (1, 5, 9))

    def test_02_seat_map_exact_match(self):
        """Memverifikasi 180 kursi memiliki identitas dan blocking structure yang identik."""
        src_seats = self.src["ALL_SEATS"]
        b_seats = self.backend.ALL_SEATS
        self.assertEqual(len(src_seats), 180)
        self.assertEqual(len(b_seats), 180)

        for s_src, s_b in zip(src_seats, b_seats):
            self.assertEqual(s_src["seat_id"], s_b["seat_id"])
            self.assertEqual(s_src["row"], s_b["row"])
            self.assertEqual(s_src["seat"], s_b["seat"])
            self.assertEqual(s_src["seat_index"], s_b["seat_index"])
            self.assertEqual(s_src["seat_priority"], s_b["seat_priority"])
            self.assertEqual(s_src["side"], s_b["side"])
            self.assertEqual(s_src["blocking_seat_ids"], s_b["blocking_seat_ids"])

    def test_03_passenger_generation_determinism_and_weibull(self):
        """
        Memverifikasi hasil generate_passengers() mempertahankan kesamaan alokasi bagasi
        dan waktu simpan Weibull, sekaligus menambahkan kecepatan jalan Normal terpotong
        dan sampel gerakan Triangular kursi.
        """
        for seed in [20261021, 20261022, 20261023]:
            for bag_ratio in [0.50, 0.60, 0.70]:
                with self.subTest(seed=seed, baggage_ratio=bag_ratio):
                    p_src = self.src["generate_passengers"](seed, bag_ratio)
                    p_b = self.backend.generate_passengers(seed, bag_ratio)

                    self.assertEqual(len(p_src), 180)
                    self.assertEqual(len(p_b), 180)

                    expected_bags = int(math.floor(180 * bag_ratio + 0.5))
                    self.assertEqual(sum(p["has_bag"] for p in p_b), expected_bags)

                    for pax_src, pax_b in zip(p_src, p_b):
                        self.assertEqual(pax_src["seat_id"], pax_b["seat_id"])
                        self.assertEqual(pax_src["has_bag"], pax_b["has_bag"])
                        self.assertAlmostEqual(pax_src["bag_time_s"], pax_b["bag_time_s"], delta=1e-9)
                        self.assertTrue(0.0 < pax_b["speed_m_s"] <= 0.8)
                        self.assertEqual(pax_b["sit_time_s"], 0.0)

    def test_04_boarding_order_exact_match(self):
        """Memverifikasi urutan antrean penumpang untuk seluruh 12 metode boarding."""
        seed = 20261021
        pax = self.backend.generate_passengers(seed, 0.60)

        methods_map = {
            "Back-to-Front-WILMA": lambda p, s: self.src["back_to_front_wilma_order"](p),
            "Reverse Pyramid (approximation)": lambda p, s: self.src["reverse_pyramid_order"](p),
            "GA-Zone-WMA": lambda p, s: self.src["ga_zone_wma_order"](p, (5, 18), (3, 2, 1)),
            "Exhaustive-Zone-WMA": lambda p, s: self.src["ga_zone_wma_order"](p, (5, 18), (3, 2, 1)),
            "Fixed-Zone-WMA": lambda p, s: self.src["fixed_zone_wma_order"](p),
            "Back-to-Front": lambda p, s: self.src["back_to_front_order"](p, s),
            "Outside-In/WMA": lambda p, s: self.src["outside_in_order"](p),
            "Modified Optimal (implementation variant)": lambda p, s: self.src["modified_optimal_order"](p),
            "Steffen (staggered-row implementation)": lambda p, s: self.src["steffen_order"](p),
            "Random": lambda p, s: self.src["random_order"](p, s),
            "Rotating Zones": lambda p, s: self.src["rotating_zones_order"](p),
            "Front-to-Back": lambda p, s: self.src["front_to_back_order"](p, s),
        }

        for name, src_fn in methods_map.items():
            with self.subTest(method=name):
                ord_src = src_fn(pax, seed)
                ord_b = self.backend.build_passenger_order(name, pax, seed=seed)

                ids_src = [p["seat_id"] for p in ord_src]
                ids_b = [p["seat_id"] for p in ord_b]
                self.assertEqual(len(ids_b), 180)
                self.assertEqual(ids_src, ids_b)

    def test_05_cellular_simulation_all_12_methods_invariants(self):
        """
        Memverifikasi simulasi antrean berbasis sel (Cellular Blocking Flow P0-A)
        berjalan bebas pelanggaran kapasitas maupun salip untuk seluruh 12 metode.
        """
        seed = 20261021
        pax = self.backend.generate_passengers(seed, 0.60)
        for method_info in self.backend.SUPPORTED_METHODS:
            m_name = method_info["name"]
            with self.subTest(method=m_name):
                ord_b = self.backend.build_passenger_order(m_name, pax, seed=seed)
                metrics, details, trace = self.backend.simulate_boarding_cellular(ord_b, seed=seed)
                audit = self.backend.validate_cellular_trace(trace, 180, 60, details)
                self.assertTrue(audit["valid"])
                self.assertEqual(metrics["passenger_count"], 180)
                self.assertEqual(metrics["baggage_count"], 108)


if __name__ == "__main__":
    unittest.main()
