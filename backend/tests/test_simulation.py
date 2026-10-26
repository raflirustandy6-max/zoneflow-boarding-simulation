"""
Unit and Integration Tests for ZoneFlow Python Backend.
"""

import unittest
import sys
import os

backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from app.config import (
    N_ROWS, CAPACITY, BASE_SEED, K_ZONES,
    MIN_ROWS_PER_ZONE, MAX_ROWS_PER_ZONE,
    GA_POPULATION_SIZE, GA_GENERATIONS, GA_ELITE_COUNT,
    GA_MUTATION_RATE, GA_TOURNAMENT_SIZE, GA_DEFAULT_SEED,
    BEST_GA_CHROMOSOME, FIXED_ZONE_CHROMOSOME
)
from app.simulation_core import (
    create_seat_list, generate_passengers,
    build_passenger_order, validate_order,
    simulate_boarding, SUPPORTED_METHODS,
    get_t_critical_95, calculate_series_statistics,
    calculate_min_max_mean, run_batch_simulation,
    all_valid_zone_sizes, sizes_to_boundaries,
    boundaries_to_sizes, validate_zone_chromosome,
    generate_exhaustive_candidates, make_training_batches,
    run_exhaustive_search, VALID_ZONE_SIZES,
    equal_zone_boundaries, BALANCED_SEED,
    random_chromosome, repair_sizes, order_crossover,
    crossover, mutate, tournament_select,
    evaluate_chromosome_fitness, run_genetic_algorithm
)
from fastapi.testclient import TestClient
from app.main import app
import random


class TestSimulationCore(unittest.TestCase):

    def test_seat_map_generation(self):
        seats = create_seat_list(30)
        self.assertEqual(len(seats), 180)
        seat_ids = [s["seat_id"] for s in seats]
        self.assertEqual(len(set(seat_ids)), 180)
        self.assertEqual(seat_ids[0], "R01A")
        self.assertEqual(seat_ids[-1], "R30F")

    def test_passenger_generation_determinism(self):
        pax1 = generate_passengers(seed=20261021, baggage_ratio=0.60)
        pax2 = generate_passengers(seed=20261021, baggage_ratio=0.60)
        self.assertEqual(len(pax1), 180)
        self.assertEqual(len(pax2), 180)
        # Check baggage allocation determinism
        self.assertEqual([p["has_bag"] for p in pax1], [p["has_bag"] for p in pax2])
        self.assertEqual([round(p["bag_time_s"], 4) for p in pax1], [round(p["bag_time_s"], 4) for p in pax2])
        # Verify baggage count is round(180 * 0.6) = 108
        n_bags = sum(1 for p in pax1 if p["has_bag"])
        self.assertEqual(n_bags, 108)

    def test_all_12_methods_validity(self):
        pax = generate_passengers(seed=20261021, baggage_ratio=0.60)
        for method_info in SUPPORTED_METHODS:
            method_name = method_info["name"]
            ordered = build_passenger_order(method_name, pax, seed=20261021)
            self.assertEqual(len(ordered), 180, f"Metode {method_name} harus menghasilkan 180 penumpang")
            # Validasi setiap kursi terpanggil tepat 1 kali
            self.assertTrue(validate_order(ordered, pax))

    def test_simulation_execution(self):
        pax = generate_passengers(seed=20261021, baggage_ratio=0.60)
        ordered = build_passenger_order("Back-to-Front-WILMA", pax, seed=20261021)
        metrics, details = simulate_boarding(ordered)
        self.assertEqual(len(details), 180)
        self.assertGreater(metrics["boarding_time_seconds"], 200.0)
        self.assertLess(metrics["boarding_time_seconds"], 500.0)
        # Verify aisle_transit segments
        first_pax = details[0]
        self.assertTrue(len(first_pax["aisle_transit"]) > 0)
        self.assertTrue(first_pax["aisle_transit"][-1]["is_target_row"])


class TestApiEndpoints(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)

    def test_health_endpoint(self):
        res = self.client.get("/api/v1/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "online")
        self.assertIn("Python Backend Engine", data["engine"])
        self.assertEqual(data["supported_methods_count"], 12)

    def test_methods_endpoint(self):
        res = self.client.get("/api/v1/methods")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["count"], 12)
        names = [m["name"] for m in data["methods"]]
        self.assertIn("Back-to-Front-WILMA", names)
        self.assertIn("GA-Zone-WMA", names)
        self.assertIn("Fixed-Zone-WMA", names)

    def test_simulate_endpoint_success(self):
        payload = {
            "method": "Back-to-Front-WILMA",
            "baggage_ratio": 0.60,
            "seed": 20261021
        }
        res = self.client.post("/api/v1/simulate", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["method"], "Back-to-Front-WILMA")
        self.assertEqual(data["baggage_percent"], 60)
        self.assertEqual(data["metrics"]["passenger_count"], 180)
        self.assertEqual(len(data["timeline_details"]), 180)

    def test_batch_simulate_success(self):
        payload = {
            "method": "Back-to-Front-WILMA",
            "baggage_ratio": 0.60,
            "replications": 15,
            "base_seed": 20261021
        }
        res = self.client.post("/api/v1/simulate/batch", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["requested_replications"], 15)
        self.assertEqual(data["successful_replications"], 15)
        self.assertEqual(data["failed_replications"], 0)
        self.assertIn("Python Backend Engine", data["engine"])
        self.assertEqual(len(data["replications_data"]), 15)

        # Check statistics structure
        stats = data["statistics"]["boarding_time_seconds"]
        self.assertIn("mean", stats)
        self.assertIn("std", stats)
        self.assertIn("median", stats)
        self.assertIn("ci95_low", stats)
        self.assertIn("ci95_high", stats)
        self.assertLessEqual(stats["ci95_low"], stats["mean"])
        self.assertGreaterEqual(stats["ci95_high"], stats["mean"])

    def test_batch_simulate_reproducibility(self):
        payload = {
            "method": "Back-to-Front-WILMA",
            "baggage_ratio": 0.60,
            "replications": 12,
            "base_seed": 20261021
        }
        res1 = self.client.post("/api/v1/simulate/batch", json=payload)
        res2 = self.client.post("/api/v1/simulate/batch", json=payload)
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res2.status_code, 200)

        d1 = res1.json()
        d2 = res2.json()

        # Determinism check across identical seeds
        self.assertEqual(
            d1["statistics"]["boarding_time_seconds"]["mean"],
            d2["statistics"]["boarding_time_seconds"]["mean"]
        )
        self.assertEqual(
            d1["statistics"]["boarding_time_seconds"]["std"],
            d2["statistics"]["boarding_time_seconds"]["std"]
        )
        times1 = [r["boarding_time_seconds"] for r in d1["replications_data"]]
        times2 = [r["boarding_time_seconds"] for r in d2["replications_data"]]
        self.assertEqual(times1, times2)

    def test_batch_simulate_validation_bounds(self):
        # Too few replications (< 10)
        res_low = self.client.post("/api/v1/simulate/batch", json={
            "method": "Back-to-Front-WILMA",
            "replications": 5
        })
        self.assertIn(res_low.status_code, [400, 422])

        # Too many replications (> 100)
        res_high = self.client.post("/api/v1/simulate/batch", json={
            "method": "Back-to-Front-WILMA",
            "replications": 150
        })
        self.assertIn(res_high.status_code, [400, 422])

        # Invalid method
        res_method = self.client.post("/api/v1/simulate/batch", json={
            "method": "Invalid-Method-XYZ",
            "replications": 20
        })
        self.assertEqual(res_method.status_code, 400)


class TestStatisticalCalculations(unittest.TestCase):
    """
    Pengujian akurasi perhitungan statistik deskriptif dan inferensial.
    Memverifikasi Student-t, koreksi Bessel, Standard Error, Margin of Error, dan CI 95%.
    """

    def test_t_critical_comparison_with_nist_reference(self):
        """
        Bandingkan nilai get_t_critical_95 dengan nilai referensi presisi NIST / scipy.stats.t.ppf(0.975, df).
        df = n - 1 untuk n = 10 (df=9), n = 30 (df=29), dan n = 100 (df=99).
        """
        nist_references = {
            9: 2.26215716,   # n = 10, df = 9
            29: 2.04522964,  # n = 30, df = 29
            99: 1.98421695,  # n = 100, df = 99
        }

        for df, ref in nist_references.items():
            calc = get_t_critical_95(df)
            diff = calc - ref
            pct_diff = abs(diff / ref) * 100.0

            # Toleransi selisih untuk formula Cornish-Fisher berorde tinggi
            if df == 9:
                self.assertLess(abs(diff), 0.0003, f"df=9 diff {diff} melebihi batas 0.0003")
                self.assertLess(pct_diff, 0.02, f"df=9 pct diff {pct_diff}% melebihi 0.02%")
            elif df == 29:
                self.assertLess(abs(diff), 0.00001, f"df=29 diff {diff} melebihi batas 0.00001")
                self.assertLess(pct_diff, 0.001, f"df=29 pct diff {pct_diff}% melebihi 0.001%")
            elif df == 99:
                self.assertLess(abs(diff), 0.000001, f"df=99 diff {diff} melebihi batas 0.000001")
                self.assertLess(pct_diff, 0.0001, f"df=99 pct diff {pct_diff}% melebihi 0.0001%")

    def test_small_dataset_statistics_independent_verification(self):
        """
        Dataset kecil n = 10 dengan nilai yang dapat dihitung secara independen:
        Nilai: [100.0, 102.0, 104.0, 105.0, 107.0, 108.0, 110.0, 112.0, 115.0, 117.0]
        Jumlah: 1080.0
        Mean: 108.0
        Varians sampel (Bessel n-1=9): 30.666667
        Simpangan baku sampel: 5.537749... -> 5.538
        Median: (107.0 + 108.0) / 2 = 107.5
        Min: 100.0, Max: 117.0
        SE: 5.537749 / sqrt(10) = 1.751190
        MoE: 2.261901 * 1.751190 = 3.961019 -> 3.961
        CI95: [108.0 - 3.961, 108.0 + 3.961] = [104.039, 111.961]
        """
        values = [100.0, 102.0, 104.0, 105.0, 107.0, 108.0, 110.0, 112.0, 115.0, 117.0]
        stats = calculate_series_statistics(values)

        self.assertEqual(stats["mean"], 108.0)
        self.assertEqual(stats["std"], 5.538)
        self.assertEqual(stats["median"], 107.5)
        self.assertEqual(stats["min"], 100.0)
        self.assertEqual(stats["max"], 117.0)
        self.assertEqual(stats["margin_of_error"], 3.961)
        self.assertEqual(stats["ci95_low"], 104.039)
        self.assertEqual(stats["ci95_high"], 111.961)

        # Verifikasi sifat interval kepercayaan: mean - MoE <= mean <= mean + MoE
        self.assertAlmostEqual(stats["ci95_low"], stats["mean"] - stats["margin_of_error"], places=3)
        self.assertAlmostEqual(stats["ci95_high"], stats["mean"] + stats["margin_of_error"], places=3)

    def test_odd_sample_size_statistics(self):
        """
        Dataset berukuran ganjil n = 5:
        Nilai: [10.0, 12.0, 14.0, 15.0, 19.0]
        Mean: 14.0
        Median: sorted[2] = 14.0
        Varians sampel: 46 / 4 = 11.5
        Std: sqrt(11.5) = 3.39116... -> 3.391
        """
        values = [10.0, 12.0, 14.0, 15.0, 19.0]
        stats = calculate_series_statistics(values)

        self.assertEqual(stats["mean"], 14.0)
        self.assertEqual(stats["median"], 14.0)
        self.assertEqual(stats["std"], 3.391)
        self.assertEqual(stats["min"], 10.0)
        self.assertEqual(stats["max"], 19.0)
        self.assertLess(stats["ci95_low"], stats["mean"])
        self.assertGreater(stats["ci95_high"], stats["mean"])

    def test_single_element_and_empty_edge_cases(self):
        """Uji penanganan sampel n=1 dan n=0."""
        empty_stats = calculate_series_statistics([])
        self.assertEqual(empty_stats["mean"], 0.0)
        self.assertEqual(empty_stats["std"], 0.0)

        single_stats = calculate_series_statistics([42.0])
        self.assertEqual(single_stats["mean"], 42.0)
        self.assertEqual(single_stats["std"], 0.0)
        self.assertEqual(single_stats["median"], 42.0)
        self.assertEqual(single_stats["min"], 42.0)
        self.assertEqual(single_stats["max"], 42.0)


class TestBatchDeterminismAndAudit(unittest.TestCase):
    """
    Pengujian determinisme batch dan korespondensi log individual dengan ringkasan statistik.
    """

    def test_batch_reproducibility_and_data_correspondence(self):
        """
        Memastikan batch dengan parameter dan seed identik menghasilkan data yang sama,
        dan bahwa log replikasi individual bersesuaian 100% dengan ringkasan statistik.
        """
        base_seed = 20261021
        reps = 10
        b1 = run_batch_simulation("Back-to-Front-WILMA", baggage_ratio=0.60, replications=reps, base_seed=base_seed)
        b2 = run_batch_simulation("Back-to-Front-WILMA", baggage_ratio=0.60, replications=reps, base_seed=base_seed)

        self.assertEqual(b1["successful_replications"], reps)
        self.assertEqual(b1["failed_replications"], 0)
        self.assertEqual(b2["successful_replications"], reps)
        self.assertEqual(b2["failed_replications"], 0)

        # 1. Determinisme penuh antar running
        self.assertEqual(b1["statistics"], b2["statistics"])
        for r1, r2 in zip(b1["replications_data"], b2["replications_data"]):
            self.assertEqual(r1["replication_id"], r2["replication_id"])
            self.assertEqual(r1["seed"], r2["seed"])
            self.assertEqual(r1["boarding_time_seconds"], r2["boarding_time_seconds"])

        # 2. Urutan seed deterministik: base_seed + (r - 1)
        expected_seeds = [base_seed + i for i in range(reps)]
        actual_seeds = [r["seed"] for r in b1["replications_data"]]
        self.assertEqual(actual_seeds, expected_seeds)

        # 3. Korespondensi data log individual terhadap ringkasan statistik
        raw_seconds = [r["boarding_time_seconds"] for r in b1["replications_data"]]
        computed_mean_s = round(sum(raw_seconds) / len(raw_seconds), 3)
        self.assertEqual(computed_mean_s, b1["statistics"]["boarding_time_seconds"]["mean"])
        self.assertEqual(min(raw_seconds), b1["statistics"]["boarding_time_seconds"]["min"])
        self.assertEqual(max(raw_seconds), b1["statistics"]["boarding_time_seconds"]["max"])

        raw_minutes = [r["boarding_time_minutes"] for r in b1["replications_data"]]
        computed_mean_m = round(sum(raw_minutes) / len(raw_minutes), 3)
        self.assertEqual(computed_mean_m, b1["statistics"]["boarding_time_minutes"]["mean"])

        # 4. Konsistensi konversi detik ke menit
        # Rata-rata menit harus bersesuaian dengan detik / 60
        self.assertAlmostEqual(
            b1["statistics"]["boarding_time_minutes"]["mean"],
            b1["statistics"]["boarding_time_seconds"]["mean"] / 60.0,
            delta=0.01
        )


class TestExhaustiveSearch(unittest.TestCase):
    """
    Pengujian komprehensif Exhaustive-Zone-WMA (Tahap 5B-1):
    1. Validasi 91 partisi ukuran zona valid.
    2. Validasi 6 permutasi urutan pemanggilan.
    3. Validasi tepat 546 kandidat tanpa duplikat.
    4. Validasi batasan ukuran zona [5..15] dan total 30 baris.
    5. Validasi 15 batch pelatihan reproduksibel.
    6. Validasi lifecycle API /api/v1/optimize/exhaustive.
    """

    def setUp(self):
        self.client = TestClient(app)

    def test_91_valid_zone_size_partitions(self):
        """Memverifikasi terdapat tepat 91 kombinasi partisi ukuran zona valid."""
        partitions = all_valid_zone_sizes(N_ROWS, K_ZONES, MIN_ROWS_PER_ZONE, MAX_ROWS_PER_ZONE)
        self.assertEqual(len(partitions), 91, f"Jumlah partisi harus 91, ditemukan {len(partitions)}")
        self.assertEqual(len(VALID_ZONE_SIZES), 91)

        # Periksa semua partisi memenuhi batasan
        for p in partitions:
            self.assertEqual(len(p), 3)
            self.assertEqual(sum(p), 30)
            for size in p:
                self.assertGreaterEqual(size, 5)
                self.assertLessEqual(size, 15)

    def test_546_exhaustive_candidates_without_duplicates(self):
        """Memverifikasi seluruh 546 kandidat valid di-generate tanpa duplikat."""
        candidates = generate_exhaustive_candidates()
        self.assertEqual(len(candidates), 546, f"Jumlah kandidat harus 546, ditemukan {len(candidates)}")

        keys = set()
        for c in candidates:
            self.assertIn("candidate_id", c)
            self.assertIn("boundaries", c)
            self.assertIn("zone_sizes", c)
            self.assertIn("zone_order", c)

            key = (tuple(c["boundaries"]), tuple(c["zone_order"]))
            self.assertNotIn(key, keys, f"Kandidat duplikat ditemukan: {key}")
            keys.add(key)

            # Validasi integritas kromosom
            self.assertTrue(validate_zone_chromosome(tuple(c["boundaries"]), tuple(c["zone_order"])))

        self.assertEqual(len(keys), 546)

    def test_boundaries_sizes_bijection(self):
        """Memverifikasi konversi bolak-balik antara sizes dan boundaries bersifat bijektif."""
        for sizes in VALID_ZONE_SIZES:
            bounds = sizes_to_boundaries(sizes)
            recovered_sizes = boundaries_to_sizes(bounds, N_ROWS)
            self.assertEqual(sizes, recovered_sizes)

    def test_training_batches_structure(self):
        """Memverifikasi pembangkitan 15 batch pelatihan (5 reps x 3 bag ratios)."""
        batches = make_training_batches(base_seed=BASE_SEED)
        self.assertEqual(len(batches), 15)

        # 5 reps @ 50%, 5 reps @ 60%, 5 reps @ 70%
        ratios = [b["baggage_ratio"] for b in batches]
        self.assertEqual(ratios[:5], [0.50] * 5)
        self.assertEqual(ratios[5:10], [0.60] * 5)
        self.assertEqual(ratios[10:], [0.70] * 5)

        for b in batches:
            self.assertEqual(len(b["passengers"]), 180)
            self.assertIn("seed", b)
            self.assertIn("replication", b)

    def test_candidates_api_endpoint(self):
        """Memverifikasi GET /api/v1/optimize/exhaustive/candidates."""
        res = self.client.get("/api/v1/optimize/exhaustive/candidates")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["total_candidates"], 546)
        self.assertEqual(data["total_partitions"], 91)
        self.assertEqual(data["total_permutations"], 6)
        self.assertEqual(len(data["sample_candidates"]), 10)

    def test_exhaustive_job_start_and_status(self):
        """Memverifikasi POST /api/v1/optimize/exhaustive dan GET status/{job_id}."""
        res_start = self.client.post("/api/v1/optimize/exhaustive", json={"base_seed": 20261021})
        self.assertEqual(res_start.status_code, 200)
        start_data = res_start.json()
        self.assertIn("job_id", start_data)
        job_id = start_data["job_id"]
        self.assertIn(start_data["status"], ["running", "completed"])

        # Poll status
        res_status = self.client.get(f"/api/v1/optimize/exhaustive/status/{job_id}")
        self.assertEqual(res_status.status_code, 200)
        status_data = res_status.json()
        self.assertEqual(status_data["job_id"], job_id)
        self.assertIn(status_data["status"], ["running", "completed", "cancelled"])
        self.assertEqual(status_data["total_candidates"], 546)

        # Cancel job agar tidak membebani test runner
        res_cancel = self.client.post(f"/api/v1/optimize/exhaustive/cancel/{job_id}")
        self.assertEqual(res_cancel.status_code, 200)


class TestGeneticAlgorithm(unittest.TestCase):
    """
    Pengujian komprehensif Tahap 5B-2:
    Validasi kromosom GA, operator seleksi/crossover/mutasi, ukuran populasi,
    evolusi fitness antar generasi, reproduktibilitas seed, konvergensi ke
    optimum eksak [5, 18] | [3, 2, 1], serta endpoint REST API GA.
    """

    def setUp(self):
        self.client = TestClient(app)

    def test_balanced_seed_and_random_chromosomes_validity(self):
        """Memverifikasi BALANCED_SEED dan 100 kromosom acak memenuhi batasan [5..15] baris dan total 30."""
        self.assertEqual(BALANCED_SEED, ((10, 20), (3, 2, 1)))
        self.assertTrue(validate_zone_chromosome(BALANCED_SEED[0], BALANCED_SEED[1]))

        rng = random.Random(20262020)
        for _ in range(100):
            chrom = random_chromosome(rng)
            bounds, order = chrom
            self.assertTrue(validate_zone_chromosome(bounds, order))
            sizes = boundaries_to_sizes(bounds, N_ROWS)
            self.assertEqual(sum(sizes), 30)
            for s in sizes:
                self.assertGreaterEqual(s, MIN_ROWS_PER_ZONE)
                self.assertLessEqual(s, MAX_ROWS_PER_ZONE)
            self.assertEqual(sorted(list(order)), [1, 2, 3])

    def test_ga_operators_crossover_mutate_repair_tournament(self):
        """Memverifikasi seluruh operator GA (repair_sizes, order_crossover, crossover, mutate, tournament_select) selalu menghasilkan kromosom valid."""
        rng = random.Random(20262020)

        # repair_sizes untuk input ekstrem di luar batas [5..15]
        repaired = repair_sizes((2, 20, 8), rng)
        self.assertIn(repaired, VALID_ZONE_SIZES)
        self.assertEqual(sum(repaired), 30)

        # 50 siklus crossover dan mutasi
        for _ in range(50):
            pa = random_chromosome(rng)
            pb = random_chromosome(rng)
            child_cx = crossover(pa, pb, rng)
            self.assertTrue(validate_zone_chromosome(child_cx[0], child_cx[1]))

            child_mut = mutate(child_cx, rng, mutation_rate=1.0)
            self.assertTrue(validate_zone_chromosome(child_mut[0], child_mut[1]))

        # tournament_select memilih kromosom terbaik dari sampel
        scored_pop = [
            (310.0, ((10, 20), (1, 2, 3))),
            (291.069, ((5, 18), (3, 2, 1))),
            (340.0, ((12, 22), (2, 1, 3))),
        ]
        selected = tournament_select(scored_pop, rng, tournament_size=3)
        self.assertEqual(selected, ((5, 18), (3, 2, 1)))

    def test_ga_seed_reproducibility_and_generation_history(self):
        """Memverifikasi GA deterministik dengan seed yang sama menghasilkan riwayat evolusi & kromosom terbaik yang identik."""
        batches = make_training_batches(base_seed=BASE_SEED)
        res1 = run_genetic_algorithm(
            population_size=10,
            generations=4,
            elite_count=2,
            mutation_rate=0.30,
            tournament_size=3,
            seed=20262020,
            base_seed=BASE_SEED,
            train_batches=batches,
        )
        res2 = run_genetic_algorithm(
            population_size=10,
            generations=4,
            elite_count=2,
            mutation_rate=0.30,
            tournament_size=3,
            seed=20262020,
            base_seed=BASE_SEED,
            train_batches=batches,
        )

        self.assertEqual(res1["best_candidate"], res2["best_candidate"])
        self.assertEqual(res1["generation_history"], res2["generation_history"])
        self.assertEqual(len(res1["generation_history"]), 5)  # Gen 0 .. Gen 4

        # Verifikasi best_fitness_seconds monoton tidak meningkat karena elit_count >= 1
        for i in range(1, len(res1["generation_history"])):
            prev_best = res1["generation_history"][i - 1]["best_fitness_seconds"]
            curr_best = res1["generation_history"][i]["best_fitness_seconds"]
            self.assertLessEqual(curr_best, prev_best)

    def test_ga_full_research_convergence_vs_exhaustive_optimum(self):
        """
        Memverifikasi konfigurasi GA penelitian asli (pop=24, gen=20, elite=2, mut=0.30, tour=3, seed=20262020)
        benar-benar konvergen ke titik optimum eksak Exhaustive Search:
        boundaries [5, 18], sizes [5, 13, 12], order [3, 2, 1], fitness 291.069 detik (4.851 menit).
        """
        result = run_genetic_algorithm(
            population_size=GA_POPULATION_SIZE,
            generations=GA_GENERATIONS,
            elite_count=GA_ELITE_COUNT,
            mutation_rate=GA_MUTATION_RATE,
            tournament_size=GA_TOURNAMENT_SIZE,
            seed=GA_DEFAULT_SEED,
            base_seed=BASE_SEED,
        )

        self.assertEqual(result["status"], "completed")
        self.assertEqual(len(result["generation_history"]), 21)  # Gen 0 .. Gen 20
        best = result["best_candidate"]
        self.assertEqual(best["zone_boundaries"], [5, 18])
        self.assertEqual(best["zone_sizes"], [5, 13, 12])
        self.assertEqual(best["zone_order"], [3, 2, 1])
        self.assertAlmostEqual(best["training_fitness_seconds"], 291.069, places=3)
        self.assertAlmostEqual(best["training_fitness_minutes"], 4.851, places=3)
        self.assertTrue(result["matches_exhaustive_optimum"])
        self.assertEqual(result["unique_candidates_evaluated"], 121)
        self.assertLess(result["unique_candidates_evaluated"], 546)

    def test_ga_api_endpoints_and_validation(self):
        """Memverifikasi POST /api/v1/optimize/ga, GET status/{job_id}, POST cancel/{job_id}, dan validasi input."""
        # Validasi error 422 jika elite_count >= population_size
        res_invalid = self.client.post(
            "/api/v1/optimize/ga",
            json={
                "population_size": 10,
                "generations": 5,
                "elite_count": 10,
                "mutation_rate": 0.3,
                "tournament_size": 3,
                "ga_seed": 20262020,
                "base_seed": 20261021,
            },
        )
        self.assertEqual(res_invalid.status_code, 422)

        # Start GA job valid
        res_start = self.client.post(
            "/api/v1/optimize/ga",
            json={
                "population_size": 8,
                "generations": 3,
                "elite_count": 2,
                "mutation_rate": 0.3,
                "tournament_size": 3,
                "ga_seed": 20262020,
                "base_seed": 20261021,
            },
        )
        self.assertEqual(res_start.status_code, 200)
        start_data = res_start.json()
        self.assertIn("job_id", start_data)
        job_id = start_data["job_id"]

        res_status = self.client.get(f"/api/v1/optimize/ga/status/{job_id}")
        self.assertEqual(res_status.status_code, 200)
        status_data = res_status.json()
        self.assertEqual(status_data["job_id"], job_id)
        self.assertEqual(status_data["total_generations"], 3)

        res_cancel = self.client.post(f"/api/v1/optimize/ga/cancel/{job_id}")
        self.assertEqual(res_cancel.status_code, 200)

    def test_ga_fitness_cache_isolation_and_direct_equivalence(self):
        """
        Tes regresi audit fitness_cache:
        1. Nilai yang diambil dari fitness_cache identik (1e-12) dengan evaluasi langsung tanpa cache.
        2. Jika dict fitness_cache yang sama digunakan pada train_batches dari base_seed berbeda,
           cache otomatis di-reset sehingga tidak pernah mencampur hasil antar base_seed/konfigurasi.
        3. Dua pekerjaan run_genetic_algorithm dengan base_seed berbeda terisolasi penuh.
        """
        batches_a = make_training_batches(base_seed=20261021)
        batches_b = make_training_batches(base_seed=20269999)
        target_chrom = ((5, 18), (3, 2, 1))

        # 1. Evaluasi langsung tanpa cache vs menggunakan fitness_cache pada batches_a
        shared_cache = {}
        direct_a = evaluate_chromosome_fitness(target_chrom, batches_a, fitness_cache=None)
        cached_a_first = evaluate_chromosome_fitness(target_chrom, batches_a, fitness_cache=shared_cache)
        cached_a_hit = evaluate_chromosome_fitness(target_chrom, batches_a, fitness_cache=shared_cache)

        self.assertAlmostEqual(direct_a, 291.069, places=3)
        self.assertAlmostEqual(direct_a, cached_a_first, places=12)
        self.assertAlmostEqual(direct_a, cached_a_hit, places=12)
        self.assertIn(target_chrom, shared_cache)

        # 2. Gunakan dict shared_cache yang SAMA pada batches_b (base_seed berbeda)
        # Harus otomatis mengosongkan entri lama dari batches_a dan menghitung ulang pada batches_b
        direct_b = evaluate_chromosome_fitness(target_chrom, batches_b, fitness_cache=None)
        self.assertNotAlmostEqual(direct_a, direct_b, places=2)

        cached_b = evaluate_chromosome_fitness(target_chrom, batches_b, fitness_cache=shared_cache)
        self.assertAlmostEqual(direct_b, cached_b, places=12)
        self.assertNotAlmostEqual(cached_b, direct_a, places=2)

        # 3. Verifikasi isolasi antar run_genetic_algorithm dengan base_seed berbeda
        ga_run_a = run_genetic_algorithm(
            population_size=8,
            generations=2,
            elite_count=2,
            mutation_rate=0.30,
            tournament_size=3,
            seed=20262020,
            base_seed=20261021,
            train_batches=batches_a,
        )
        ga_run_b = run_genetic_algorithm(
            population_size=8,
            generations=2,
            elite_count=2,
            mutation_rate=0.30,
            tournament_size=3,
            seed=20262020,
            base_seed=20269999,
            train_batches=batches_b,
        )
        self.assertEqual(ga_run_a["training_config"]["base_seed"], 20261021)
        self.assertEqual(ga_run_b["training_config"]["base_seed"], 20269999)
        self.assertNotEqual(
            ga_run_a["exhaustive_comparison"]["exhaustive_fitness_seconds"],
            ga_run_b["exhaustive_comparison"]["exhaustive_fitness_seconds"],
        )

        # Semua top_candidates pada ga_run_a harus cocok dengan evaluasi langsung tanpa cache pada batches_a
        for cand in ga_run_a["top_candidates"][:5]:
            chrom = (tuple(cand["zone_boundaries"]), tuple(cand["zone_order"]))
            direct_val = evaluate_chromosome_fitness(chrom, batches_a, fitness_cache=None)
            self.assertEqual(cand["training_fitness_seconds"], round(direct_val, 3))

    def test_ga_multi_seed_robustness_audit(self):
        """
        Memverifikasi perilaku multi-seed GA pada train_batches penelitian (base_seed=20261021):
        - Seed yang konvergen ke global optimum (mis. 20262020, 20262024) menghasilkan [5, 18] | [3, 2, 1] (291.069s, gap 0.0%).
        - Seed sub-optimum (mis. 179) tidak di-hardcode ke optimum, melainkan melaporkan solusi aktual
          [5, 17] | [3, 2, 1] (291.430s, gap +0.361s / +0.124%, matches_exhaustive_optimum=False).
        """
        batches = make_training_batches(base_seed=BASE_SEED)

        res_opt = run_genetic_algorithm(
            population_size=GA_POPULATION_SIZE,
            generations=GA_GENERATIONS,
            elite_count=GA_ELITE_COUNT,
            mutation_rate=GA_MUTATION_RATE,
            tournament_size=GA_TOURNAMENT_SIZE,
            seed=20262024,
            base_seed=BASE_SEED,
            train_batches=batches,
        )
        self.assertTrue(res_opt["matches_exhaustive_optimum"])
        self.assertEqual(res_opt["best_candidate"]["zone_boundaries"], [5, 18])
        self.assertEqual(res_opt["best_candidate"]["zone_order"], [3, 2, 1])
        self.assertEqual(res_opt["exhaustive_comparison"]["fitness_gap_seconds"], 0.0)

        res_subopt = run_genetic_algorithm(
            population_size=GA_POPULATION_SIZE,
            generations=GA_GENERATIONS,
            elite_count=GA_ELITE_COUNT,
            mutation_rate=GA_MUTATION_RATE,
            tournament_size=GA_TOURNAMENT_SIZE,
            seed=179,
            base_seed=BASE_SEED,
            train_batches=batches,
        )
        self.assertFalse(res_subopt["matches_exhaustive_optimum"])
        self.assertEqual(res_subopt["best_candidate"]["zone_boundaries"], [5, 17])
        self.assertEqual(res_subopt["best_candidate"]["zone_sizes"], [5, 12, 13])
        self.assertEqual(res_subopt["best_candidate"]["zone_order"], [3, 2, 1])
        self.assertAlmostEqual(res_subopt["best_candidate"]["training_fitness_seconds"], 291.430, places=3)
        self.assertAlmostEqual(res_subopt["exhaustive_comparison"]["fitness_gap_seconds"], 0.361, places=3)

    def test_ga_exhaustive_comparison_labels_standard_vs_custom_base_seed(self):
        """
        Memverifikasi pelabelan dan nilai pembanding pada exhaustive_comparison:
        1. Jika base_seed standar 20261021 digunakan, label adalah 'Gap terhadap Exhaustive Optimum'
           dengan is_exhaustive_optimum_verified=True dan exhaustive_candidates_evaluated=546.
        2. Jika base_seed kustom digunakan dan exhaustive search belum dijalankan pada kumpulan training tersebut,
           label adalah 'Gap terhadap Kromosom Referensi [5, 18]', is_exhaustive_optimum_verified=False,
           matches_exhaustive_optimum=None, dan nilai pembanding dihitung terhadap kromosom [5, 18] pada training tersebut.
        3. Jika base_seed kustom digunakan bersama hasil exhaustive search yang terverifikasi pada training yang sama,
           label kembali menjadi 'Gap terhadap Exhaustive Optimum' dengan is_exhaustive_optimum_verified=True.
        """
        batches_std = make_training_batches(base_seed=20261021)
        batches_custom = make_training_batches(base_seed=20265555)

        # 1. Standard base_seed = 20261021
        res_std = run_genetic_algorithm(
            population_size=8,
            generations=2,
            elite_count=2,
            mutation_rate=0.30,
            tournament_size=3,
            seed=20262020,
            base_seed=20261021,
            train_batches=batches_std,
        )
        comp_std = res_std["exhaustive_comparison"]
        self.assertTrue(comp_std["is_exhaustive_optimum_verified"])
        self.assertEqual(comp_std["comparison_type"], "exhaustive_optimum")
        self.assertEqual(comp_std["comparison_label"], "Gap terhadap Exhaustive Optimum")
        self.assertEqual(comp_std["reference_label"], "Exhaustive-Zone-WMA (Audit Eksak)")
        self.assertEqual(comp_std["exhaustive_candidates_evaluated"], 546)
        self.assertEqual(comp_std["exhaustive_fitness_seconds"], 291.069)
        self.assertIsNotNone(res_std["matches_exhaustive_optimum"])

        # 2. Custom base_seed = 20265555 tanpa exhaustive search
        res_custom = run_genetic_algorithm(
            population_size=8,
            generations=2,
            elite_count=2,
            mutation_rate=0.30,
            tournament_size=3,
            seed=20262020,
            base_seed=20265555,
            train_batches=batches_custom,
        )
        comp_custom = res_custom["exhaustive_comparison"]
        self.assertFalse(comp_custom["is_exhaustive_optimum_verified"])
        self.assertEqual(comp_custom["comparison_type"], "reference_chromosome")
        self.assertEqual(comp_custom["comparison_label"], "Gap terhadap Kromosom Referensi [5, 18]")
        self.assertEqual(comp_custom["reference_label"], "Kromosom Referensi [5, 18] | [3, 2, 1]")
        self.assertEqual(comp_custom["exhaustive_candidates_evaluated"], 1)
        self.assertIsNone(res_custom["matches_exhaustive_optimum"])

        expected_ref_custom = round(
            evaluate_chromosome_fitness(((5, 18), (3, 2, 1)), batches_custom, fitness_cache=None),
            3,
        )
        self.assertEqual(comp_custom["exhaustive_fitness_seconds"], expected_ref_custom)
        expected_gap_custom = round(
            res_custom["best_candidate"]["training_fitness_seconds"] - expected_ref_custom,
            3,
        )
        self.assertAlmostEqual(comp_custom["fitness_gap_seconds"], expected_gap_custom, places=3)

        # 3. Custom base_seed = 20265555 dengan hasil exhaustive search terverifikasi pada training yang sama
        verified_custom_opt = {
            "zone_boundaries": [5, 18],
            "zone_sizes": [5, 13, 12],
            "zone_order": [3, 2, 1],
            "training_fitness_seconds": expected_ref_custom,
            "training_fitness_minutes": round(expected_ref_custom / 60.0, 3),
        }
        res_custom_verified = run_genetic_algorithm(
            population_size=8,
            generations=2,
            elite_count=2,
            mutation_rate=0.30,
            tournament_size=3,
            seed=20262020,
            base_seed=20265555,
            train_batches=batches_custom,
            verified_exhaustive_optimum=verified_custom_opt,
        )
        comp_ver = res_custom_verified["exhaustive_comparison"]
        self.assertTrue(comp_ver["is_exhaustive_optimum_verified"])
        self.assertEqual(comp_ver["comparison_type"], "exhaustive_optimum")
        self.assertEqual(comp_ver["comparison_label"], "Gap terhadap Exhaustive Optimum")
        self.assertEqual(comp_ver["exhaustive_candidates_evaluated"], 546)
        self.assertIsNotNone(res_custom_verified["matches_exhaustive_optimum"])

    def test_deployment_job_pruning_and_concurrency_guard(self):
        """
        Memverifikasi kesiapan produksi manajemen background job:
        1. _prune_job_registry_unlocked menghapus job selesai paling lama tanpa menyentuh job 'running'.
        2. _parse_cors_origins membaca daftar domain atau '*' dengan benar.
        3. Batas konkurensi aktif (HTTP 429) bekerja ketika jumlah job 'running' mencapai MAX_CONCURRENT_JOBS.
        """
        from app.main import (
            EXHAUSTIVE_JOBS,
            GA_JOBS,
            JOBS_LOCK,
            _prune_job_registry_unlocked,
            _count_active_optimization_jobs_unlocked,
        )

        # 1. Uji pemangkasan (pruning) job selesai pada dictionary sementara
        mock_reg = {
            "job_old_1": {"job_id": "job_old_1", "status": "completed", "start_time": 100.0},
            "job_running": {"job_id": "job_running", "status": "running", "start_time": 105.0},
            "job_old_2": {"job_id": "job_old_2", "status": "cancelled", "start_time": 110.0},
            "job_new_3": {"job_id": "job_new_3", "status": "completed", "start_time": 120.0},
        }
        _prune_job_registry_unlocked(mock_reg, max_retained=2)
        self.assertEqual(len(mock_reg), 2)
        self.assertIn("job_running", mock_reg)
        self.assertIn("job_new_3", mock_reg)
        self.assertNotIn("job_old_1", mock_reg)
        self.assertNotIn("job_old_2", mock_reg)

        # 2. Uji proteksi HTTP 429 saat batas job aktif tercapai
        fake_id_1 = "test-active-guard-1"
        fake_id_2 = "test-active-guard-2"
        with JOBS_LOCK:
            EXHAUSTIVE_JOBS[fake_id_1] = {"job_id": fake_id_1, "status": "running", "start_time": 999999.0}
            GA_JOBS[fake_id_2] = {"job_id": fake_id_2, "status": "running", "start_time": 999999.0}
            self.assertGreaterEqual(_count_active_optimization_jobs_unlocked(), 2)

        try:
            res_429_ga = self.client.post(
                "/api/v1/optimize/ga",
                json={
                    "population_size": 8,
                    "generations": 2,
                    "elite_count": 2,
                    "mutation_rate": 0.3,
                    "tournament_size": 3,
                    "ga_seed": 20262020,
                    "base_seed": 20261021,
                },
            )
            self.assertEqual(res_429_ga.status_code, 429)
            self.assertIn("Batas konkurensi optimasi tercapai", res_429_ga.json()["detail"])

            res_429_ex = self.client.post(
                "/api/v1/optimize/exhaustive",
                json={"base_seed": 20261021},
            )
            self.assertEqual(res_429_ex.status_code, 429)
        finally:
            with JOBS_LOCK:
                EXHAUSTIVE_JOBS.pop(fake_id_1, None)
                GA_JOBS.pop(fake_id_2, None)


if __name__ == "__main__":
    unittest.main()

