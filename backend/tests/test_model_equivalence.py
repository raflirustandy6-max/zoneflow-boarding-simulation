"""
Pengujian Regresi dan Kesetaraan Model (Differential Equivalence Testing)
ZoneFlow: Membandingkan implementasi backend/app/simulation_core.py secara langsung
terhadap script Python asli penelitian: public/assets/aistudio/SimulasiLogikaUI_6_export_untuk_Claude_416c7319.py.

Verifikasi mencakup:
1. Konstanta fisik kabin dan parameter Weibull
2. Peta 180 kursi (seat map 30 baris 3-3)
3. Generator penumpang deterministik (Weibull stowage time & baggage ratio)
4. Aturan pengurutan seluruh metode boarding (12 metode)
5. Metrik hasil simulasi antrean lorong & interferensi kursi
6. Konfigurasi kromosom optimum GA-Zone-WMA dan Fixed-Zone-WMA
"""

import unittest
import sys
import os
import random
import math

# Pastikan backend terdeteksi dalam path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
project_root = os.path.dirname(backend_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import app.simulation_core as b_core
from app.config import (
    N_ROWS, SEATS, CAPACITY, LOAD_FACTOR,
    WALK_PER_ROW_S, WEIBULL_SHAPE, WEIBULL_SCALE_S,
    ENTRY_GAP_S, AISLE_HEADWAY_S, SIT_TIME_S,
    MOVEMENT_TICK_S, MOVES_ONE_BLOCKER, MOVES_TWO_BLOCKERS,
    K_ZONES, BEST_GA_CHROMOSOME, FIXED_ZONE_CHROMOSOME
)


def load_source_script_namespace():
    """
    Mengekstrak dan mengeksekusi definisi fungsi murni dari script penelitian asli
    tanpa memicu eksekusi visualisasi atau notebook cell prints.
    """
    source_path = os.path.join(
        project_root, "public", "assets", "aistudio",
        "SimulasiLogikaUI_6_export_untuk_Claude_416c7319.py"
    )
    if not os.path.exists(source_path):
        raise FileNotFoundError(f"Script penelitian asli tidak ditemukan di {source_path}")

    with open(source_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    # Ekstrak Cell 2-5, Cell 7, dan Cell 8 (definisi fungsi logika murni)
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
    """Pengujian diferensial komparatif antara kode sumber Python dan backend adaptasi."""

    @classmethod
    def setUpClass(cls):
        cls.src = load_source_script_namespace()
        cls.backend = b_core

    def test_01_physical_constants_equivalence(self):
        """Memverifikasi seluruh konstanta fisik kabin persis sama."""
        self.assertEqual(self.src["N_ROWS"], N_ROWS)
        self.assertEqual(self.src["SEATS"], SEATS)
        self.assertEqual(self.src["LOAD_FACTOR"], LOAD_FACTOR)
        self.assertEqual(self.src["WALK_PER_ROW_S"], WALK_PER_ROW_S)
        self.assertEqual(self.src["WEIBULL_SHAPE"], WEIBULL_SHAPE)
        self.assertEqual(self.src["WEIBULL_SCALE_S"], WEIBULL_SCALE_S)
        self.assertEqual(self.src["ENTRY_GAP_S"], ENTRY_GAP_S)
        self.assertEqual(self.src["AISLE_HEADWAY_S"], AISLE_HEADWAY_S)
        self.assertEqual(self.src["SIT_TIME_S"], SIT_TIME_S)
        self.assertEqual(self.src["MOVEMENT_TICK_S"], MOVEMENT_TICK_S)
        self.assertEqual(self.src["MOVES_ONE_BLOCKER"], MOVES_ONE_BLOCKER)
        self.assertEqual(self.src["MOVES_TWO_BLOCKERS"], MOVES_TWO_BLOCKERS)
        self.assertEqual(self.src["K_ZONES"], K_ZONES)

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
        Memverifikasi hasil generate_passengers() pada berbagai kombinasi seed dan tingkat bagasi.
        Memeriksa kesesuaian alokasi bagasi dan distribusi Weibull secara presisi.
        """
        test_seeds = [20261021, 20261022, 20261023, 20261024, 20261025]
        baggage_ratios = [0.50, 0.60, 0.70]

        for seed in test_seeds:
            for bag_ratio in baggage_ratios:
                with self.subTest(seed=seed, baggage_ratio=bag_ratio):
                    p_src = self.src["generate_passengers"](seed, bag_ratio)
                    p_b = self.backend.generate_passengers(seed, bag_ratio)

                    self.assertEqual(len(p_src), 180)
                    self.assertEqual(len(p_b), 180)

                    # Periksa jumlah penumpang pembawa bagasi
                    expected_bags = round(180 * bag_ratio)
                    self.assertEqual(sum(p["has_bag"] for p in p_src), expected_bags)
                    self.assertEqual(sum(p["has_bag"] for p in p_b), expected_bags)

                    # Periksa setiap atribut per penumpang
                    for pax_src, pax_b in zip(p_src, p_b):
                        self.assertEqual(pax_src["seat_id"], pax_b["seat_id"])
                        self.assertEqual(pax_src["has_bag"], pax_b["has_bag"])
                        # Toleransi floating-point Weibull 1e-9
                        self.assertAlmostEqual(pax_src["bag_time_s"], pax_b["bag_time_s"], delta=1e-9)
                        self.assertAlmostEqual(pax_src["walk_per_row_s"], pax_b["walk_per_row_s"], delta=1e-9)
                        self.assertAlmostEqual(pax_src["sit_time_s"], pax_b["sit_time_s"], delta=1e-9)

    def test_04_boarding_order_exact_match(self):
        """Memverifikasi urutan antrean penumpang untuk seluruh 12 metode boarding."""
        seed = 20261021
        pax = self.src["generate_passengers"](seed, 0.60)

        # Seluruh 12 metode yang didukung
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
                self.assertEqual(len(ids_b), 180, f"Panjang urutan {name} bukan 180")
                self.assertEqual(ids_src, ids_b, f"Ketidakcocokan urutan pada metode {name}")

    def test_05_ga_and_exhaustive_zone_wma_order(self):
        """
        Memverifikasi GA-Zone-WMA dan Exhaustive-Zone-WMA menggunakan konfigurasi
        optimum terverifikasi batas [5, 18], ukuran [5, 13, 12], urutan [3, 2, 1].
        """
        seed = 20261021
        pax = self.src["generate_passengers"](seed, 0.60)

        best_boundaries = tuple(BEST_GA_CHROMOSOME["boundaries"])  # (5, 18)
        best_order = tuple(BEST_GA_CHROMOSOME["order"])            # (3, 2, 1)

        ord_src_ga = self.src["ga_zone_wma_order"](pax, best_boundaries, best_order)
        ord_b_ga = self.backend.build_passenger_order("GA-Zone-WMA", pax, seed=seed)
        ord_b_exact = self.backend.build_passenger_order("Exhaustive-Zone-WMA", pax, seed=seed)

        ids_src = [p["seat_id"] for p in ord_src_ga]
        ids_b_ga = [p["seat_id"] for p in ord_b_ga]
        ids_b_exact = [p["seat_id"] for p in ord_b_exact]

        self.assertEqual(ids_src, ids_b_ga, "GA-Zone-WMA urutan tidak cocok dengan script sumber")
        self.assertEqual(ids_src, ids_b_exact, "Exhaustive-Zone-WMA harus setara dengan optimum GA")

    def test_06_simulation_numerical_equivalence_all_12_methods(self):
        """
        Memverifikasi simulasi antrean lorong menghasilkan metrik yang identik
        untuk SELURUH 12 METODE BOARDING (termasuk Random, Front-to-Back, Back-to-Front,
        dan Exhaustive-Zone-WMA).
        """
        seed = 20261021
        pax = self.src["generate_passengers"](seed, 0.60)

        all_12_methods = [
            "Back-to-Front-WILMA",
            "Reverse Pyramid (approximation)",
            "GA-Zone-WMA",
            "Exhaustive-Zone-WMA",
            "Fixed-Zone-WMA",
            "Back-to-Front",
            "Outside-In/WMA",
            "Modified Optimal (implementation variant)",
            "Steffen (staggered-row implementation)",
            "Random",
            "Rotating Zones",
            "Front-to-Back",
        ]

        methods_fn_src = {
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

        for method_name in all_12_methods:
            with self.subTest(method=method_name):
                ord_src = methods_fn_src[method_name](pax, seed)
                ord_b = self.backend.build_passenger_order(method_name, pax, seed=seed)

                # Jalankan simulate_boarding pada kedua implementasi
                m_src = self.src["simulate_boarding"](ord_src)
                m_b, details_b = self.backend.simulate_boarding(ord_b)

                # Toleransi numerik floating point: 1e-3 detik (selisih pembulatan ms)
                self.assertAlmostEqual(
                    m_src["boarding_time_seconds"], m_b["boarding_time_seconds"], delta=1e-3,
                    msg=f"Total boarding time detik berbeda pada {method_name}"
                )
                self.assertAlmostEqual(
                    m_src["boarding_time_minutes"], m_b["boarding_time_minutes"], delta=1e-3,
                    msg=f"Total boarding time menit berbeda pada {method_name}"
                )
                self.assertAlmostEqual(
                    m_src["aggregate_aisle_wait_person_seconds"],
                    m_b["aggregate_aisle_wait_person_seconds"],
                    delta=1e-3,
                    msg=f"Aisle wait person-seconds berbeda pada {method_name}"
                )

                # Integer metrics: harus persis sama (exact match)
                self.assertEqual(m_src["aisle_interference_events"], m_b["aisle_interference_events"])
                self.assertEqual(m_src["seat_interference_events"], m_b["seat_interference_events"])
                self.assertEqual(m_src["occupied_blocker_count"], m_b["occupied_blocker_count"])
                self.assertEqual(m_src["baggage_count"], m_b["baggage_count"])
                self.assertEqual(m_src["passenger_count"], m_b["passenger_count"])
                self.assertEqual(len(details_b), 180)

    def test_07_seat_interference_delays(self):
        """Memverifikasi formula penalti gangguan kursi: 0 blocker=0s, 1=12.0s, 2+=21.6s."""
        for n_blocker in [0, 1, 2, 3]:
            src_delay = self.src["seat_interference_delay_s"](n_blocker)
            b_delay = self.backend.seat_interference_delay_s(n_blocker)
            self.assertAlmostEqual(src_delay, b_delay, delta=1e-9)

        self.assertAlmostEqual(self.backend.seat_interference_delay_s(0), 0.0, delta=1e-6)
        self.assertAlmostEqual(self.backend.seat_interference_delay_s(1), 12.0, delta=1e-6)
        self.assertAlmostEqual(self.backend.seat_interference_delay_s(2), 21.6, delta=1e-6)

    def test_08_chromosome_validations(self):
        """Memverifikasi representasi kromosom GA dan Fixed-Zone."""
        best_bounds = tuple(BEST_GA_CHROMOSOME["boundaries"])
        best_order = tuple(BEST_GA_CHROMOSOME["order"])
        self.assertEqual(best_bounds, (5, 18))
        self.assertEqual(best_order, (3, 2, 1))

        fixed_bounds = tuple(FIXED_ZONE_CHROMOSOME["boundaries"])
        fixed_order = tuple(FIXED_ZONE_CHROMOSOME["order"])
        self.assertEqual(fixed_bounds, (10, 20))
        self.assertEqual(fixed_order, (3, 2, 1))

        self.assertTrue(self.backend.validate_chromosome((best_bounds, best_order)))
        self.assertTrue(self.backend.validate_chromosome((fixed_bounds, fixed_order)))

    def test_09_multi_scenario_differential_sweep(self):
        """
        Pengujian sapuan menyeluruh (differential sweep) melintasi 2 seed, 3 tingkat bagasi
        (50%, 60%, 70%), dan seluruh 12 metode boarding (total 72 konfigurasi).
        """
        methods_fn_src = {
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

        for seed in [20261021, 20261022]:
            for bag_ratio in [0.50, 0.60, 0.70]:
                pax_src = self.src["generate_passengers"](seed, bag_ratio)
                pax_b = self.backend.generate_passengers(seed, bag_ratio)

                for method_name, src_fn in methods_fn_src.items():
                    with self.subTest(seed=seed, bag=bag_ratio, method=method_name):
                        ord_src = src_fn(pax_src, seed)
                        ord_b = self.backend.build_passenger_order(method_name, pax_b, seed=seed)

                        # 1. Passenger Order Exact Match
                        self.assertEqual(
                            [p["seat_id"] for p in ord_src],
                            [p["seat_id"] for p in ord_b]
                        )

                        # 2. Simulation Metrics Equivalence
                        m_src = self.src["simulate_boarding"](ord_src)
                        m_b, _ = self.backend.simulate_boarding(ord_b)

                        self.assertAlmostEqual(m_src["boarding_time_seconds"], m_b["boarding_time_seconds"], delta=1e-3)
                        self.assertEqual(m_src["aisle_interference_events"], m_b["aisle_interference_events"])
                        self.assertEqual(m_src["seat_interference_events"], m_b["seat_interference_events"])
                        self.assertEqual(m_src["occupied_blocker_count"], m_b["occupied_blocker_count"])
                        self.assertEqual(m_src["baggage_count"], m_b["baggage_count"])

    def test_10_per_passenger_timeline_equivalence(self):
        """
        Memverifikasi bahwa timeline detail per penumpang (arrival, wait, interference, finish)
        pada seluruh 180 kursi kabin cocok antara kode sumber dan backend adaptasi.
        """
        seed = 20261021
        pax = self.src["generate_passengers"](seed, 0.60)

        focus_methods = [
            ("Back-to-Front-WILMA", lambda p: self.src["back_to_front_wilma_order"](p)),
            ("Random", lambda p: self.src["random_order"](p, seed)),
            ("Front-to-Back", lambda p: self.src["front_to_back_order"](p, seed)),
            ("Back-to-Front", lambda p: self.src["back_to_front_order"](p, seed)),
            ("Exhaustive-Zone-WMA", lambda p: self.src["ga_zone_wma_order"](p, (5, 18), (3, 2, 1))),
        ]

        for method_name, src_order_fn in focus_methods:
            with self.subTest(method=method_name):
                ord_src = src_order_fn(pax)
                ord_b = self.backend.build_passenger_order(method_name, pax, seed=seed)

                _, details_src = self.src["simulate_boarding"](ord_src, collect_details=True)
                _, details_b = self.backend.simulate_boarding(ord_b)

                self.assertEqual(len(details_src), 180)
                self.assertEqual(len(details_b), 180)

                for i in range(180):
                    d_s = details_src[i]
                    d_b = details_b[i]

                    self.assertEqual(d_s["seat_id"], d_b["seat_id"])
                    self.assertEqual(d_s["has_bag"], d_b["has_bag"])
                    self.assertEqual(d_s["occupied_blockers"], d_b["occupied_blockers"])

                    # Verifikasi waktu fisik per penumpang (toleransi 1e-3 untuk pembulatan ms)
                    self.assertAlmostEqual(d_s["entry_time_s"], d_b["entry_time_s"], delta=1e-3)
                    self.assertAlmostEqual(d_s["arrival_target_s"], d_b["arrival_target_s"], delta=1e-3)
                    self.assertAlmostEqual(d_s["aisle_wait_s"], d_b["aisle_wait_s"], delta=1e-3)
                    self.assertAlmostEqual(d_s["seat_interference_s"], d_b["seat_interference_s"], delta=1e-3)
                    self.assertAlmostEqual(d_s["bag_stowage_s"], d_b["bag_stowage_s"], delta=1e-3)
                    self.assertAlmostEqual(d_s["finish_time_s"], d_b["finish_time_s"], delta=1e-3)


if __name__ == "__main__":
    unittest.main()

