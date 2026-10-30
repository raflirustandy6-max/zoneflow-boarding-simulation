"""
Unit and Integration Tests for ZoneFlow × AZBO Python Backend (P0-A, P0-B, P0-C).
Mencakup seluruh 11 kriteria uji wajib Blueprint Bagian 10 (Test A s.d. Test I).
"""

import unittest
import sys
import os
import random
import math

backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from app.config import (
    N_ROWS, CAPACITY, BASE_SEED, K_ZONES,
    ROW_PITCH_M, CELL_M, DT_S,
    SPEED_MAX_M_S,
    TRIANGULAR_MIN_S, TRIANGULAR_MODE_S, TRIANGULAR_MAX_S,
    MOVES_ZERO_BLOCKERS, MOVES_ONE_BLOCKER, MOVES_TWO_BLOCKERS,
    GA_POPULATION_SIZE, GA_GENERATIONS, GA_ELITE_COUNT,
    GA_MUTATION_RATE, GA_TOURNAMENT_SIZE, GA_DEFAULT_SEED,
    BEST_GA_CHROMOSOME, FIXED_ZONE_CHROMOSOME
)
from app.simulation_core import (
    create_seat_list, generate_passengers, deterministic_baggage_count,
    sample_truncated_normal_speed, sample_seat_access_moves, sample_seat_access_time,
    build_passenger_order, validate_order,
    simulate_boarding, simulate_boarding_cellular, validate_cellular_trace,
    SUPPORTED_METHODS,
    get_t_critical_95, calculate_series_statistics,
    calculate_min_max_mean, run_batch_simulation,
    all_valid_zone_sizes, sizes_to_boundaries,
    boundaries_to_sizes, validate_zone_chromosome,
    generate_exhaustive_candidates, make_training_batches,
    run_exhaustive_search, VALID_ZONE_SIZES,
    equal_zone_boundaries, BALANCED_SEED,
    random_chromosome, repair_sizes, order_crossover,
    crossover, mutate, tournament_select,
    evaluate_chromosome_fitness, run_genetic_algorithm,
    CutChromosome, decode_zones, zones_to_boundaries_and_sizes,
    zone_order_from_keys, decode_cut_chromosome,
    random_cut_chromosome_conditional_k, init_variable_k_population,
    crossover_variable_k, mutate_variable_k,
    run_mini_exhaustive_variable_k, run_variable_k_ga,
    compute_mc_summary, compute_paired_difference_summary,
    run_azbo_optimization
)
try:
    from fastapi.testclient import TestClient
    from app.main import app
except ImportError:
    TestClient = None
    app = None


class TestP0ACellularBlockingFlow(unittest.TestCase):
    """
    Pengujian P0-A: Mesin Antrean Lorong Berbasis Sel Diskret Satu Dimensi (Cellular Blocking Flow).
    Mencakup Test A (No Cell Overlap & No Overtaking) dan Test B (Completion & Causality).
    """

    def test_a_and_b_no_cell_overlap_no_overtaking_and_100_percent_completion(self):
        """
        Test A & Test B:
        - Tidak ada sel lorong yang ditempati > 1 penumpang pada waktu yang sama.
        - Tidak ada aksi saling mendahului (no overtaking) di lorong.
        - 100% penumpang mencapai status 'seated' dan finish_time_s > entry_time_s.
        """
        pax = generate_passengers(seed=20261021, baggage_ratio=0.60)
        n_cells = N_ROWS * int(round(ROW_PITCH_M / CELL_M))
        self.assertEqual(n_cells, 60)

        for method_info in SUPPORTED_METHODS:
            m_name = method_info["name"]
            with self.subTest(method=m_name):
                ordered = build_passenger_order(m_name, pax, seed=20261021)
                metrics, details, trace = simulate_boarding_cellular(ordered, seed=20261021)

                audit = validate_cellular_trace(trace, len(ordered), n_cells, details)
                self.assertTrue(audit["valid"])
                self.assertEqual(audit["overlap_violations"], 0)
                self.assertEqual(audit["overtaking_violations"], 0)
                self.assertEqual(audit["seated_count"], 180)
                self.assertTrue(audit["causality_ok"])

                self.assertEqual(metrics["passenger_count"], 180)
                self.assertEqual(len(details), 180)
                self.assertGreater(metrics["boarding_time_seconds"], 100.0)

                # Periksa kontinuitas segmen aisle_transit untuk animasi UI
                for d in details:
                    self.assertEqual(len(d["aisle_transit"]), d["row"])
                    self.assertTrue(d["aisle_transit"][-1]["is_target_row"])
                    self.assertGreater(d["finish_time_s"], d["entry_time_s"])
                    for seg_idx in range(len(d["aisle_transit"]) - 1):
                        self.assertFalse(d["aisle_transit"][seg_idx]["is_target_row"])
                        self.assertLessEqual(
                            d["aisle_transit"][seg_idx]["leave_s"],
                            d["aisle_transit"][seg_idx + 1]["enter_s"] + 1e-6,
                        )

    def test_front_row_stowage_physically_blocks_following_passengers(self):
        """
        Memverifikasi bahwa penumpang pertama yang berhenti menyimpan bagasi di Baris 1 (sel 1)
        secara fisik menahan penumpang di belakangnya (di sel 0) hingga penumpang pertama selesai duduk.
        """
        pax = generate_passengers(seed=20261021, baggage_ratio=1.0, n_rows=5, passenger_count=6, baggage_count=6)
        # Urutkan Front-to-Back agar penumpang Baris 1 masuk paling awal
        ordered = build_passenger_order("Front-to-Back", pax, seed=20261021)
        _, details, trace = simulate_boarding_cellular(ordered, seed=20261021)
        validate_cellular_trace(trace, len(ordered), 10, details)

        p1 = details[0]
        p2 = details[1]
        self.assertEqual(p1["row"], 1)
        # Penumpang ke-2 yang menuju baris >= 1 tidak boleh meninggalkan Baris 1 sebelum p1 selesai duduk
        p2_row1_leave = p2["aisle_transit"][0]["leave_s"]
        self.assertGreaterEqual(p2_row1_leave, p1["finish_time_s"])


class TestP0BStochasticPassengerModeling(unittest.TestCase):
    """
    Pengujian P0-B: Pemodelan Stokastik Aktivitas Penumpang.
    Mencakup Test C (Baggage Count & Random Allocation) dan Test D (Speed Truncation & Triangular Seat Access).
    """

    def test_c_deterministic_baggage_count_and_randomized_identities(self):
        """
        Test C:
        - Jumlah penumpang pembawa bagasi tepat sebesar floor(n * bag_ratio + 0.5) pada setiap replikasi.
        - Identitas kursi penumpang yang membawa bagasi teracak ulang antar-seed replikasi.
        """
        for ratio, expected in [(0.0, 0), (0.50, 90), (0.60, 108), (0.70, 126), (1.0, 180)]:
            self.assertEqual(deterministic_baggage_count(180, ratio), expected)
            for rep in range(5):
                pax = generate_passengers(seed=20261021 + rep, baggage_ratio=ratio)
                actual_bags = sum(1 for p in pax if p["has_bag"])
                self.assertEqual(actual_bags, expected)
                for p in pax:
                    if p["has_bag"]:
                        self.assertGreater(p["bag_time_s"], 0.0)
                    else:
                        self.assertEqual(p["bag_time_s"], 0.0)

        # Verifikasi identitas pembawa bagasi berbeda antar seed replikasi
        pax_seed_1 = generate_passengers(seed=20261021, baggage_ratio=0.60)
        pax_seed_2 = generate_passengers(seed=20261022, baggage_ratio=0.60)
        bags_1 = {p["seat_id"] for p in pax_seed_1 if p["has_bag"]}
        bags_2 = {p["seat_id"] for p in pax_seed_2 if p["has_bag"]}
        self.assertEqual(len(bags_1), 108)
        self.assertEqual(len(bags_2), 108)
        self.assertNotEqual(bags_1, bags_2)

    def test_d_truncated_normal_speed_and_triangular_seat_moves_no_double_counting(self):
        """
        Test D:
        - Seluruh sampel kecepatan berjalan memenuhi 0 < speed_m_s <= 0.8 m/s.
        - Gerakan akses kursi M_i in {1, 5, 9} menggunakan distribusi Triangular(1.8, 2.4, 3.0)
          tanpa menambahkan lagi sit_time_s = 2.0 detik (sit_time_s == 0.0).
        """
        rng = random.Random(20261021)
        for _ in range(500):
            v = sample_truncated_normal_speed(rng)
            self.assertGreater(v, 0.0)
            self.assertLessEqual(v, SPEED_MAX_M_S)

        pax = generate_passengers(seed=20261021, baggage_ratio=0.60)
        for p in pax:
            self.assertGreater(p["speed_m_s"], 0.0)
            self.assertLessEqual(p["speed_m_s"], SPEED_MAX_M_S)
            self.assertEqual(p["sit_time_s"], 0.0)
            self.assertEqual(len(p["seat_move_samples_s"]), 9)
            for u in p["seat_move_samples_s"]:
                self.assertGreaterEqual(u, TRIANGULAR_MIN_S)
                self.assertLessEqual(u, TRIANGULAR_MAX_S)

        # Pemetaan M_i in {1, 5, 9}
        self.assertEqual(sample_seat_access_moves(0), 1)
        self.assertEqual(sample_seat_access_moves(1), 5)
        self.assertEqual(sample_seat_access_moves(2), 9)

        t0 = sample_seat_access_time(rng, 1)
        t1 = sample_seat_access_time(rng, 5)
        t2 = sample_seat_access_time(rng, 9)
        self.assertTrue(1.8 <= t0 <= 3.0)
        self.assertTrue(5 * 1.8 <= t1 <= 5 * 3.0)
        self.assertTrue(9 * 1.8 <= t2 <= 9 * 3.0)


class TestP0CVariableKGeneticAlgorithmAndMonteCarlo(unittest.TestCase):
    """
    Pengujian P0-C: Algoritma Genetika Jumlah Zona Variabel K in {1..N}
    dan Evaluasi Monte Carlo Train/Test Split (CRN).
    Mencakup Test E, Test F, Test G, Test H, dan Test I.
    """

    def test_e_variable_k_zone_decoding_covers_1_to_n(self):
        """
        Test E:
        - Untuk setiap vektor pemotong biner c in {0,1}^{N-1}, zona hasil decode mempartisi
          baris 1..N secara kontigu tanpa celah atau tumpang tindih.
        - Jumlah zona K = 1 + sum(cuts) dapat bernilai berapa pun dari 1 hingga N.
        """
        n_rows = 12
        rng = random.Random(20261021)

        # Uji eksplisit setiap nilai K dari 1 sampai n_rows
        for k in range(1, n_rows + 1):
            cuts = [0] * (n_rows - 1)
            if k > 1:
                for pos in rng.sample(range(n_rows - 1), k - 1):
                    cuts[pos] = 1
            chrom = CutChromosome(
                cuts=cuts,
                priority_keys=[rng.random() for _ in range(n_rows)],
                internal_rule="WMA_IN_ZONE",
            )
            decoded = decode_cut_chromosome(chrom)
            self.assertEqual(decoded["k_zones"], k)
            self.assertEqual(len(decoded["zones"]), k)
            self.assertEqual(len(decoded["boundaries"]), k - 1)
            self.assertEqual(sum(decoded["sizes"]), n_rows)
            self.assertEqual(sorted(decoded["zone_order"]), list(range(1, k + 1)))

            # Pastikan baris 1..n_rows terpartisi tanpa celah atau overlap
            covered_rows = []
            for r_start, r_end in decoded["zones"]:
                self.assertLessEqual(r_start, r_end)
                covered_rows.extend(range(r_start, r_end + 1))
            self.assertEqual(covered_rows, list(range(1, n_rows + 1)))

    def test_f_ga_operators_validity_and_mini_cabin_exhaustive_comparison(self):
        """
        Test F:
        - Operator inisialisasi, crossover, dan mutasi selalu menghasilkan kromosom K-variabel yang valid.
        - Pada kabin mini (N = 4 baris), solusi GA berada dalam margin <= 2% dari solusi
          enumerasi eksak lintas seluruh K in {1..4}.
        """
        rng = random.Random(20262020)
        pop = init_variable_k_population(rng, n_rows=10, population_size=20)
        self.assertEqual(len(pop), 20)
        k_set = {1 + sum(c.cuts) for c in pop}
        self.assertIn(1, k_set)
        self.assertIn(10, k_set)
        self.assertGreaterEqual(len(k_set), 5)

        for _ in range(100):
            pa = random_cut_chromosome_conditional_k(rng, 10)
            pb = random_cut_chromosome_conditional_k(rng, 10)
            child = crossover_variable_k(pa, pb, rng)
            child = mutate_variable_k(child, rng, mutation_rate=0.8)
            decoded = decode_cut_chromosome(child)
            self.assertTrue(1 <= decoded["k_zones"] <= 10)
            self.assertEqual(sum(decoded["sizes"]), 10)
            self.assertEqual(sorted(decoded["zone_order"]), list(range(1, decoded["k_zones"] + 1)))

        # Uji konvergensi GA vs Enumerasi Eksak pada kabin mini N = 4 baris
        n_mini = 4
        mini_batches = [
            {
                "replication": r + 1,
                "seed": 20261021 + r,
                "passengers": generate_passengers(seed=20261021 + r, baggage_ratio=0.60, n_rows=n_mini),
            }
            for r in range(3)
        ]
        exact_res = run_mini_exhaustive_variable_k(mini_batches, n_rows=n_mini)
        ga_res = run_variable_k_ga(
            train_batches=mini_batches,
            n_rows=n_mini,
            population_size=16,
            generations=8,
            elite_count=2,
            mutation_rate=0.35,
            ga_seed=20262020,
        )
        exact_best_s = exact_res["best_candidate"]["training_fitness_seconds"]
        ga_best_s = ga_res["best_training_fitness_seconds"]
        gap_pct = ((ga_best_s - exact_best_s) / exact_best_s) * 100.0
        self.assertLessEqual(gap_pct, 2.0, f"Gap GA vs Exact pada kabin mini ({gap_pct:.2f}%) harus <= 2%")

    def test_g_monte_carlo_train_test_disjoint_seeds_and_paired_difference(self):
        """
        Test G:
        - train_seeds dan test_seeds benar-benar saling lepas (disjoint).
        - Evaluasi metode pada test_seeds menggunakan Common Random Numbers (CRN).
        - Menghasilkan mean, SD, 95% CI, serta paired difference Delta_r = T_r^GA - T_r^Method.
        """
        res = run_azbo_optimization(
            n_rows=6,
            left_seats=["A", "B"],
            right_seats=["C", "D"],
            bag_ratio=0.50,
            train_replications=3,
            test_replications=6,
            base_seed=20261021,
            population_size=10,
            generations=4,
        )
        proto = res["evaluation_protocol"]
        self.assertTrue(proto["seeds_disjoint"])
        self.assertTrue(proto["common_random_numbers"])
        self.assertTrue(set(proto["train_seeds"]).isdisjoint(set(proto["test_seeds"])))

        policy = res["best_zone_policy"]
        self.assertTrue(1 <= policy["k_zones"] <= 6)
        self.assertGreater(policy["train_mean_s"], 0.0)
        self.assertGreater(policy["test_mean_s"], 0.0)
        self.assertLessEqual(policy["test_ci95_low_s"], policy["test_mean_s"])
        self.assertGreaterEqual(policy["test_ci95_high_s"], policy["test_mean_s"])

        comparisons = res["baseline_comparison"]
        self.assertGreaterEqual(len(comparisons), 5)
        for item in comparisons:
            self.assertIn("paired_diff_ga_minus_method", item)
            pd_info = item["paired_diff_ga_minus_method"]
            self.assertEqual(pd_info["replications"], 6)
            self.assertEqual(len(pd_info["paired_deltas_s"]), 6)


@unittest.skipIf(TestClient is None, "FastAPI TestClient not installed in bare stdlib Python environment")
class TestApiEndpoints(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)

    def test_health_endpoint(self):
        res = self.client.get("/api/v1/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "online")
        self.assertEqual(data["supported_methods_count"], 12)

    def test_methods_endpoint(self):
        res = self.client.get("/api/v1/methods")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["count"], 12)

    def test_simulate_endpoint_success_and_variable_k_custom_zones(self):
        payload = {
            "method": "GA-Zone-WMA",
            "baggage_ratio": 0.60,
            "seed": 20261021,
            "custom_zone_config": {
                "boundaries": [6, 12, 18, 24],
                "zone_order": [5, 4, 3, 2, 1],
                "internal_rule": "WMA_IN_ZONE"
            }
        }
        res = self.client.post("/api/v1/simulate", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["metrics"]["passenger_count"], 180)
        self.assertEqual(len(data["timeline_details"]), 180)

    def test_v2_azbo_optimize_endpoint(self):
        """
        Test H & Test I: Memverifikasi kontrak terpadu GET /api/v2/azbo/health dan POST /api/v2/azbo/optimize.
        """
        health_res = self.client.get("/api/v2/azbo/health")
        self.assertEqual(health_res.status_code, 200)
        health_data = health_res.json()
        self.assertEqual(health_data["status"], "online")
        self.assertIn("ZONE", health_data["supported_strategies"])

        payload = {
            "n_rows": 6,
            "left_seats": ["A", "B"],
            "right_seats": ["C", "D"],
            "bag_ratio": 0.50,
            "train_replications": 2,
            "test_replications": 4,
            "base_seed": 20261021,
            "population_size": 8,
            "generations": 3,
        }
        res = self.client.post("/api/v2/azbo/optimize", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("scenario", data)
        self.assertIn("optimization", data)
        self.assertIn("recommendation", data)
        self.assertIn("animation", data)
        self.assertEqual(data["scenario"]["capacity"], 24)
        self.assertEqual(data["scenario"]["passenger_count"], 24)
        self.assertEqual(data["scenario"]["baggage_passenger_count"], 12)
        self.assertEqual(len(data["recommendation"]["evaluated_strategies"]), 12)
        self.assertEqual(len(data["animation"]["timeline_details"]), 24)
        self.assertTrue(len(data["animation"]["trace"]) > 0)


class TestStatisticalCalculations(unittest.TestCase):

    def test_t_critical_comparison_with_nist_reference(self):
        nist_references = {
            9: 2.26215716,
            29: 2.04522964,
            99: 1.98421695,
        }
        for df, ref in nist_references.items():
            calc = get_t_critical_95(df)
            diff = abs(calc - ref)
            self.assertLess(diff, 0.0005)

    def test_small_dataset_statistics_independent_verification(self):
        values = [100.0, 102.0, 104.0, 105.0, 107.0, 108.0, 110.0, 112.0, 115.0, 117.0]
        stats = calculate_series_statistics(values)
        self.assertEqual(stats["mean"], 108.0)
        self.assertEqual(stats["std"], 5.538)
        self.assertEqual(stats["median"], 107.5)
        self.assertEqual(stats["min"], 100.0)
        self.assertEqual(stats["max"], 117.0)


if __name__ == "__main__":
    unittest.main()
