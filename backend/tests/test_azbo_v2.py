"""
Comprehensive Unit & Integration Tests for AZBO V2 Engine and FastAPI Endpoints.
Covers Acceptance Tests A through L from Blueprint_AZBO.pdf Section 10.
"""

import unittest
import sys
import os
import random
import time

backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from app.azbo_core import (
    CabinSpec,
    SUPPORTED_AZBO_V2_STRATEGIES,
    ZoneGenome,
    deterministic_baggage_count,
    create_cabin_seats,
    sample_truncated_normal_speed,
    generate_replication_passengers,
    random_genome_with_k,
    random_genome,
    equal_rotating_zone_ranges,
    rotating_zone_calling_order,
    reverse_pyramid_row_segments,
    four_row_block_ranges,
    double_outside_in_row_split,
    fixed_btf_wma_zone_ranges,
    build_boarding_sequence,
    simulate,
    verify_simulation_invariants,
    crossover_genomes,
    mutate_genome,
    evaluate_genome_training_fitness,
    run_ga_variable_k,
    run_exhaustive_mini_cabin,
    compute_sample_stats,
    run_azbo_v2_evaluation,
)
try:
    from fastapi.testclient import TestClient
    from app.main import app
except ImportError:
    TestClient = None
    app = None


class TestAzboV2BlueprintAcceptance(unittest.TestCase):
    """
    Acceptance Tests A through M from Blueprint_AZBO.pdf Section 10 + 12-method journal expansion.
    """

    def test_A_aisle_physical_invariants_and_overlap_rejection(self):
        """
        Test A — Fisik lorong pada seluruh 12 metode boarding:
        1. Tidak ada dua penumpang menempati sel lorong yang sama pada tick yang sama.
        2. Tidak ada penumpang menyalip penumpang di depannya.
        3. Selama stowage/seating, sel baris target tidak dimasuki penumpang lain.
        4. Penumpang tertahan tetap di sel asal tanpa akumulasi progres gerak.
        5. Trace yang sengaja dibuat overlap ditolak oleh verify_simulation_invariants.
        """
        self.assertEqual(len(SUPPORTED_AZBO_V2_STRATEGIES), 12)
        specs = [
            CabinSpec(rows=10, left_seats=3, right_seats=3),
            CabinSpec(rows=8, left_seats=2, right_seats=2),
            CabinSpec(rows=9, left_seats=2, right_seats=3),
        ]
        for spec in specs:
            pax = generate_replication_passengers(spec, bag_ratio=0.70, seed=10101)
            rng_g = random.Random(20202)
            genome = random_genome_with_k(spec.rows, min(3, spec.rows), rng_g)

            for strategy in SUPPORTED_AZBO_V2_STRATEGIES:
                ordered, groups = build_boarding_sequence(
                    pax,
                    strategy=strategy,
                    seed=30303,
                    genome=genome if strategy == "ZONE" else None,
                )
                sim = simulate(
                    ordered,
                    cabin=spec,
                    group_ids=groups,
                    record_trace=True,
                    verify_invariants=True,
                )
                self.assertEqual(len(sim["details"]), spec.capacity)
                self.assertTrue(verify_simulation_invariants(sim["details"], spec))

        # Verify that a synthetic overlapping trace is rejected by verify_simulation_invariants
        spec_small = CabinSpec(rows=4, left_seats=2, right_seats=2)
        pax_small = generate_replication_passengers(spec_small, bag_ratio=0.50, seed=99)
        ordered_small, groups_small = build_boarding_sequence(
            pax_small, strategy="WMA", seed=99
        )
        sim_small = simulate(
            ordered_small,
            cabin=spec_small,
            group_ids=groups_small,
            record_trace=True,
            verify_invariants=True,
        )
        bad_details = [dict(d) for d in sim_small["details"]]
        bad_details[0]["cell_intervals"] = [
            {"cell": 0, "row": 1, "enter_s": 0.0, "leave_s": 2.0}
        ]
        bad_details[1]["cell_intervals"] = [
            {"cell": 0, "row": 1, "enter_s": 0.5, "leave_s": 2.5}
        ]
        with self.assertRaises(AssertionError):
            verify_simulation_invariants(bad_details, spec_small)

    def test_B_entry_and_seating_completion(self):
        """
        Test B — Masuk & keluar:
        Setiap penumpang masuk ke kabin tepat satu kali dan duduk tepat satu kali
        dengan finish_time_s > entry_time_s.
        """
        spec = CabinSpec(rows=12, left_seats=3, right_seats=3)
        pax = generate_replication_passengers(spec, bag_ratio=0.65, seed=777)
        ordered, groups = build_boarding_sequence(pax, strategy="BTF", seed=777)
        sim = simulate(
            ordered, cabin=spec, group_ids=groups, record_trace=True, verify_invariants=True
        )
        details = sim["details"]

        self.assertEqual(len(details), spec.capacity)
        seen_seats = set()
        for d in details:
            self.assertNotIn(d["seat_id"], seen_seats)
            seen_seats.add(d["seat_id"])
            self.assertGreaterEqual(d["entry_time_s"], 0.0)
            self.assertGreater(d["finish_time_s"], d["entry_time_s"])
            self.assertGreaterEqual(d["arrival_target_s"], d["entry_time_s"])
            self.assertGreater(d["finish_time_s"], d["arrival_target_s"])

    def test_C_passenger_100pct_occupancy_and_deterministic_baggage_count(self):
        """
        Test C — Penumpang:
        1. Seluruh kursi terisi 100% (n = N * S).
        2. Jumlah penumpang berbagasi deterministik n_b = floor(n * rho_b + 0.5).
        3. Identitas penumpang pembawa bagasi berubah antar replikasi seed berbeda.
        """
        spec = CabinSpec(rows=30, left_seats=3, right_seats=3)
        self.assertEqual(spec.capacity, 180)
        self.assertEqual(deterministic_baggage_count(180, 0.0), 0)
        self.assertEqual(deterministic_baggage_count(180, 1.0), 180)
        self.assertEqual(deterministic_baggage_count(180, 0.70), 126)
        self.assertEqual(deterministic_baggage_count(72, 0.70), 50)
        self.assertEqual(deterministic_baggage_count(125, 0.70), 88)

        pax_rep1 = generate_replication_passengers(spec, bag_ratio=0.70, seed=1001)
        pax_rep2 = generate_replication_passengers(spec, bag_ratio=0.70, seed=1002)

        self.assertEqual(len(pax_rep1), 180)
        self.assertEqual(len(pax_rep2), 180)
        self.assertEqual(sum(1 for p in pax_rep1 if p["has_bag"]), 126)
        self.assertEqual(sum(1 for p in pax_rep2 if p["has_bag"]), 126)

        bag_seats_1 = [p["seat_id"] for p in pax_rep1 if p["has_bag"]]
        bag_seats_2 = [p["seat_id"] for p in pax_rep2 if p["has_bag"]]
        self.assertNotEqual(bag_seats_1, bag_seats_2)

    def test_D_walking_speed_and_stochastic_durations(self):
        """
        Test D — Kecepatan & durasi:
        1. 0 < V_p <= 0.8 m/s (TruncatedNormal(0.8, 0.1) pada (0, 0.8]).
        2. S_p > 0 bila B_p = 1 dan S_p = 0 bila B_p = 0.
        3. M_p in [1.8, 3.0] s.
        4. Seed sama menghasilkan penumpang identik.
        """
        rng = random.Random(42)
        for _ in range(500):
            v = sample_truncated_normal_speed(rng)
            self.assertGreater(v, 0.0)
            self.assertLessEqual(v, 0.8)

        spec = CabinSpec(rows=10, left_seats=3, right_seats=3)
        p1 = generate_replication_passengers(spec, bag_ratio=0.50, seed=5555)
        p2 = generate_replication_passengers(spec, bag_ratio=0.50, seed=5555)
        self.assertEqual(p1, p2)

        for p in p1:
            self.assertGreater(p["speed_m_s"], 0.0)
            self.assertLessEqual(p["speed_m_s"], 0.8)
            self.assertEqual(len(p["seat_move_draws"]), 9)
            for draw in p["seat_move_draws"]:
                self.assertGreaterEqual(draw, 1.8)
                self.assertLessEqual(draw, 3.0)
            if p["has_bag"]:
                self.assertGreater(p["bag_stowage_s"], 0.0)
            else:
                self.assertEqual(p["bag_stowage_s"], 0.0)

    def test_E_variable_k_zones_representation(self):
        """
        Test E — Zona:
        1. Mendukung semua K = 1..N.
        2. Setiap zona tidak kosong dan kontigu.
        3. Urutan panggilan zona adalah permutasi valid dari {1..K}.
        """
        n_rows = 12
        rng = random.Random(1234)
        for k in range(1, n_rows + 1):
            genome = random_genome_with_k(n_rows, k, rng)
            self.assertEqual(genome.k_zones, k)
            ranges = genome.zone_row_ranges()
            sizes = genome.zone_sizes()
            self.assertEqual(len(ranges), k)
            self.assertEqual(len(sizes), k)
            covered_rows = []
            for (start_row, end_row), sz in zip(ranges, sizes):
                self.assertGreaterEqual(end_row, start_row)
                self.assertEqual(sz, end_row - start_row + 1)
                covered_rows.extend(range(start_row, end_row + 1))
            self.assertEqual(covered_rows, list(range(1, n_rows + 1)))
            order = genome.zone_calling_order()
            self.assertEqual(sorted(order), list(range(1, k + 1)))

    def test_F_and_G_ga_operators_and_exhaustive_mini_cabin_audit(self):
        """
        Test F & G — GA & GA vs Exhaustive Mini Cabin:
        1. Crossover dan mutasi selalu menghasilkan kromosom valid.
        2. Populasi mengeksplorasi lebih dari satu nilai K.
        3. Pada mini cabin (rows=4, left=2, right=2), fitness GA >= optimum eksak exhaustive,
           dan gap heuristik kecil serta dilaporkan.
        """
        spec = CabinSpec(rows=4, left_seats=2, right_seats=2)
        rng = random.Random(2026)
        seen_k = set()
        for _ in range(30):
            g1 = random_genome(spec.rows, rng)
            g2 = random_genome(spec.rows, rng)
            seen_k.add(g1.k_zones)
            child = crossover_genomes(g1, g2, rng)
            m1 = mutate_genome(child, rng, mutation_rate=1.0)
            self.assertEqual(len(m1.cuts), spec.rows - 1)
            self.assertEqual(len(m1.row_priorities), spec.rows)
            self.assertIn(m1.in_zone_rule, ("WMA_IN_ZONE", "BTF_IN_ZONE"))
        self.assertGreater(len(seen_k), 1)

        ex = run_exhaustive_mini_cabin(
            cabin=spec,
            bag_ratio=0.70,
            train_reps=3,
            seed=20261028,
        )
        ga = run_ga_variable_k(
            cabin=spec,
            bag_ratio=0.70,
            ga_population=16,
            ga_generations=8,
            train_reps=3,
            seed=20261028,
            zone_call_overhead_s=0.0,
        )
        self.assertGreater(len(ga["explored_k_values"]), 1)
        self.assertGreaterEqual(
            ga["best_training_fitness_s"] + 1e-6,
            ex["best_fitness_s"],
            "GA heuristic cannot beat exact mathematical optimum on identical training seeds",
        )
        gap_pct = (
            (ga["best_training_fitness_s"] - ex["best_fitness_s"])
            / ex["best_fitness_s"]
        ) * 100.0
        self.assertLessEqual(gap_pct, 5.0)

    def test_H_and_I_train_test_separation_crn_and_statistics(self):
        """
        Test H & I — Replikasi & Statistik:
        1. Seed optimasi (train) dan seed evaluasi akhir (test) terpisah (disjoint).
        2. Common Random Numbers (CRN) digunakan antar seluruh 12 strategi.
        3. Mean, SD, dan CI 95% dihitung dari R > 1 replikasi.
        """
        spec = CabinSpec(rows=8, left_seats=2, right_seats=2)
        result = run_azbo_v2_evaluation(
            cabin=spec,
            bag_ratio=0.70,
            ga_population=12,
            ga_generations=5,
            train_reps=3,
            test_reps=6,
            seed=12345,
            zone_call_overhead_s=0.0,
        )
        self.assertEqual(result["scenario"]["train_reps"], 3)
        self.assertEqual(result["scenario"]["test_reps"], 6)
        self.assertEqual(result["scenario"]["capacity"], 32)
        self.assertEqual(result["scenario"]["passenger_count"], 32)

        evaluated = result["recommendation"]["evaluated_strategies"]
        self.assertEqual(len(evaluated), 12)
        evaluated_ids = {m["strategy_id"] for m in evaluated}
        self.assertEqual(evaluated_ids, set(SUPPORTED_AZBO_V2_STRATEGIES))

        for m in evaluated:
            self.assertIn(m["strategy_id"], SUPPORTED_AZBO_V2_STRATEGIES)
            self.assertGreater(m["mean_s"], 0.0)
            self.assertGreaterEqual(m["sd_s"], 0.0)
            self.assertLessEqual(m["ci95_low_s"], m["mean_s"])
            self.assertGreaterEqual(m["ci95_high_s"], m["mean_s"])
            self.assertGreater(len(m["calling_steps"]), 0)
            if m["strategy_id"] == "BTF_WMA_FIXED":
                self.assertIsNotNone(m["zone_config"])
                self.assertEqual(m["zone_config"]["k_zones"], 3)
                self.assertEqual(m["zone_config"]["order"], [3, 2, 1])

    @unittest.skipIf(TestClient is None, "FastAPI TestClient not installed in bare stdlib Python environment")
    def test_J_and_K_api_contract_and_overhead_parameter(self):
        """
        Test J & K — API Contract (/api/v2/azbo/health, /api/v2/azbo/optimize & /api/v2/azbo/jobs):
        1. Endpoint menerima parameter sesuai Blueprint dan mengembalikan
           struktur JSON rekomendasi 12 metode, statistik, dan animasi.
        2. Menguji zone_call_overhead_s > 0.
        """
        client = TestClient(app)

        health_res = client.get("/api/v2/azbo/health")
        self.assertEqual(health_res.status_code, 200)
        health_data = health_res.json()
        self.assertEqual(len(health_data["supported_strategies"]), 12)
        self.assertEqual(
            set(health_data["supported_strategies"]),
            set(SUPPORTED_AZBO_V2_STRATEGIES),
        )

        payload = {
            "layout_id": "test-mini-24",
            "layout_name": "Mini Cabin 6x4",
            "rows": 6,
            "left_seats": 2,
            "right_seats": 2,
            "row_pitch_m": 0.8,
            "cell_m": 0.4,
            "bag_ratio": 0.70,
            "ga_population": 10,
            "ga_generations": 4,
            "train_reps": 3,
            "test_reps": 5,
            "seed": 42,
            "zone_call_overhead_s": 2.0,
        }
        res = client.post("/api/v2/azbo/optimize", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertIn(
            data["recommendation"]["winner_by_sample_mean"],
            list(SUPPORTED_AZBO_V2_STRATEGIES),
        )
        self.assertEqual(len(data["recommendation"]["evaluated_strategies"]), 12)
        self.assertEqual(data["scenario"]["capacity"], 24)
        self.assertEqual(data["scenario"]["passenger_count"], 24)
        self.assertEqual(data["scenario"]["baggage_passenger_count"], 17)
        self.assertGreaterEqual(data["optimization"]["k_zones"], 1)
        self.assertLessEqual(data["optimization"]["k_zones"], 6)
        self.assertEqual(len(data["animation"]["timeline_details"]), 24)
        self.assertGreater(len(data["animation"]["trace"]), 0)

        # Test async job lifecycle
        res_job = client.post("/api/v2/azbo/jobs", json=payload)
        self.assertEqual(res_job.status_code, 200)
        job_data = res_job.json()
        job_id = job_data["job_id"]

        p_data = job_data
        for _ in range(50):
            poll = client.get(f"/api/v2/azbo/jobs/{job_id}")
            self.assertEqual(poll.status_code, 200)
            p_data = poll.json()
            if p_data["status"] in ("completed", "failed"):
                break
            time.sleep(0.1)

        self.assertEqual(p_data["status"], "completed")
        self.assertIsNotNone(p_data["result"])
        self.assertEqual(
            p_data["result"]["recommendation"]["winner_by_sample_mean"],
            data["recommendation"]["winner_by_sample_mean"],
        )

    def test_L_and_M_all_12_methods_sequence_rules_and_layout_compatibility(self):
        """
        Test L & M — Verifikasi aturan urutan, pembedaan pasangan strategi, & kompatibilitas tata letak
        untuk seluruh 12 metode boarding:
        1. REVERSE_PYRAMID: Kelompok diagonal (5 kelompok pada 3-3 & 2-3, 4 kelompok pada 2-2).
        2. STEFFEN: Urutan kelas kursi (0 -> 1 -> 2), paritas baris dimulai dari N % 2,
           dan bergantian sisi kiri -> kanan.
        3. ROTATING_ZONES: Urutan panggilan zona bergantian Z_K -> Z_1 -> Z_{K-1} -> Z_2 -> ...
        4. MODIFIED_OPTIMAL: 4 kelompok (Genap Kiri -> Genap Kanan -> Ganjil Kiri -> Ganjil Kanan).
        5. FRONT_TO_BACK: Baris 1 menuju Baris N secara monoton tidak menurun.
        6. BLOCKS_4_ROWS: Blok tetap 4 baris (Steffen & Hotchkiss, 2012); untuk 12 baris tepat
           memanggil baris 9-12 -> 1-4 -> 5-8 dengan urutan acak di dalam blok.
        7. DOUBLE_OUTSIDE_IN: Adaptasi Dong et al. (2025) untuk kabin satu lorong; menghasilkan
           6 kelompok pada 3-3 & 2-3 dan 4 kelompok pada 2-2 (Rear -> Front per kelas kursi).
        8. BTF_WMA_FIXED: Hibrida 3 zona tetap seimbang (Zona 3 -> Zona 2 -> Zona 1) dengan WMA
           di dalam tiap zona (9 sub-kelompok pada 3-3 & 2-3, 6 sub-kelompok pada 2-2).
        9. Pemeriksaan pembedaan strategi wajib:
           - REVERSE_PYRAMID != BTF_WMA_FIXED
           - WMA != DOUBLE_OUTSIDE_IN
           - BLOCKS_4_ROWS != ROTATING_ZONES
           - FRONT_TO_BACK != BTF dan FRONT_TO_BACK != RANDOM
        """
        # Uji khusus kabin 12 baris untuk BLOCKS_4_ROWS sesuai Steffen & Hotchkiss (2012)
        cabin_12 = CabinSpec(rows=12, left_seats=3, right_seats=3, layout_id="steffen-hotchkiss-12")
        pax_12 = generate_replication_passengers(cabin_12, bag_ratio=0.70, seed=1212)
        b4_ordered_12, b4_groups_12 = build_boarding_sequence(
            pax_12, strategy="BLOCKS_4_ROWS", seed=1212
        )
        self.assertEqual(b4_groups_12, sorted(b4_groups_12))
        self.assertEqual(set(b4_groups_12), {1, 2, 3})
        g1_rows_12 = {p["row"] for p, g in zip(b4_ordered_12, b4_groups_12) if g == 1}
        g2_rows_12 = {p["row"] for p, g in zip(b4_ordered_12, b4_groups_12) if g == 2}
        g3_rows_12 = {p["row"] for p, g in zip(b4_ordered_12, b4_groups_12) if g == 3}
        self.assertEqual(g1_rows_12, {9, 10, 11, 12})
        self.assertEqual(g2_rows_12, {1, 2, 3, 4})
        self.assertEqual(g3_rows_12, {5, 6, 7, 8})

        test_cabins = [
            CabinSpec(rows=30, left_seats=3, right_seats=3, layout_id="b737-800-180"),
            CabinSpec(rows=24, left_seats=3, right_seats=3, layout_id="b737-700-144"),
            CabinSpec(rows=9, left_seats=3, right_seats=3, layout_id="b737-odd-9"),
            CabinSpec(rows=25, left_seats=2, right_seats=3, layout_id="a220-100-125"),
            CabinSpec(rows=6, left_seats=2, right_seats=3, layout_id="a220-even-6"),
            CabinSpec(rows=18, left_seats=2, right_seats=2, layout_id="atr72-600-72"),
            CabinSpec(rows=7, left_seats=2, right_seats=2, layout_id="atr72-odd-7"),
        ]

        for cabin in test_cabins:
            pax = generate_replication_passengers(cabin, bag_ratio=0.70, seed=8888)
            all_seat_ids = {p["seat_id"] for p in pax}
            # Gunakan genome non-uniform 4 zona untuk memastikan ZONE berbeda dari BTF_WMA_FIXED (3 zona seimbang)
            genome = random_genome_with_k(cabin.rows, min(4, cabin.rows), random.Random(999))

            seqs = {}
            groups_map = {}
            for strat in SUPPORTED_AZBO_V2_STRATEGIES:
                ordered, groups = build_boarding_sequence(
                    pax,
                    strategy=strat,
                    seed=8888,
                    genome=genome if strat == "ZONE" else None,
                )
                self.assertEqual(len(ordered), cabin.capacity)
                self.assertEqual(len(groups), cabin.capacity)
                self.assertEqual({p["seat_id"] for p in ordered}, all_seat_ids)
                seqs[strat] = [p["seat_id"] for p in ordered]
                groups_map[strat] = (ordered, groups)

            # 1. Pastikan seluruh 11 metode non-ZONE memiliki urutan yang berbeda satu sama lain
            non_zone = [s for s in SUPPORTED_AZBO_V2_STRATEGIES if s != "ZONE"]
            self.assertEqual(len(non_zone), 11)
            for i, s1 in enumerate(non_zone):
                for s2 in non_zone[i + 1:]:
                    self.assertNotEqual(
                        seqs[s1],
                        seqs[s2],
                        f"Urutan {s1} tidak boleh identik dengan {s2} pada {cabin.layout_id}",
                    )
            # Pastikan BTF_WMA_FIXED berbeda dari ZONE ketika genome ZONE berbeda dari 3 zona seimbang
            self.assertNotEqual(seqs["BTF_WMA_FIXED"], seqs["ZONE"])

            # 2. Verifikasi aturan REVERSE_PYRAMID
            rp_ordered, rp_groups = groups_map["REVERSE_PYRAMID"]
            self.assertEqual(rp_groups, sorted(rp_groups))
            expected_rp_group_count = 5 if cabin.seats_per_row >= 5 else 4
            self.assertEqual(set(rp_groups), set(range(1, expected_rp_group_count + 1)))
            self.assertEqual(rp_ordered[0]["row"], cabin.rows)
            self.assertEqual(rp_ordered[0]["seat_priority"], 0)
            self.assertEqual(rp_ordered[-1]["seat_priority"], 2)

            # 3. Verifikasi aturan STEFFEN
            st_ordered, st_groups = groups_map["STEFFEN"]
            self.assertEqual(st_groups, sorted(st_groups))
            st_priorities = [p["seat_priority"] for p in st_ordered]
            self.assertEqual(st_priorities, sorted(st_priorities))
            first_wave = [
                p for p, g in zip(st_ordered, st_groups) if g == 1
            ]
            self.assertTrue(all(p["seat_priority"] == 0 for p in first_wave))
            self.assertTrue(all(p["side"] == "left" for p in first_wave))
            self.assertTrue(all((p["row"] % 2) == (cabin.rows % 2) for p in first_wave))
            first_wave_rows = [p["row"] for p in first_wave]
            self.assertEqual(first_wave_rows, sorted(first_wave_rows, reverse=True))

            # 4. Verifikasi aturan ROTATING_ZONES
            rz_ordered, rz_groups = groups_map["ROTATING_ZONES"]
            self.assertEqual(rz_groups, sorted(rz_groups))
            rot_ranges = equal_rotating_zone_ranges(cabin.rows, max_zones=5)
            self.assertEqual(len(rot_ranges), 5)
            z5_start, z5_end = rot_ranges[-1]
            z1_start, z1_end = rot_ranges[0]
            g1_rows = {p["row"] for p, g in zip(rz_ordered, rz_groups) if g == 1}
            g2_rows = {p["row"] for p, g in zip(rz_ordered, rz_groups) if g == 2}
            self.assertEqual(g1_rows, set(range(z5_start, z5_end + 1)))
            self.assertEqual(g2_rows, set(range(z1_start, z1_end + 1)))

            # 5. Verifikasi aturan MODIFIED_OPTIMAL
            mo_ordered, mo_groups = groups_map["MODIFIED_OPTIMAL"]
            self.assertEqual(mo_groups, sorted(mo_groups))
            self.assertEqual(set(mo_groups), {1, 2, 3, 4})
            for p, g in zip(mo_ordered, mo_groups):
                if g == 1:
                    self.assertEqual(p["row"] % 2, 0)
                    self.assertEqual(p["side"], "left")
                elif g == 2:
                    self.assertEqual(p["row"] % 2, 0)
                    self.assertEqual(p["side"], "right")
                elif g == 3:
                    self.assertEqual(p["row"] % 2, 1)
                    self.assertEqual(p["side"], "left")
                elif g == 4:
                    self.assertEqual(p["row"] % 2, 1)
                    self.assertEqual(p["side"], "right")

            # 6. Verifikasi aturan FRONT_TO_BACK
            ftb_ordered, ftb_groups = groups_map["FRONT_TO_BACK"]
            ftb_rows = [p["row"] for p in ftb_ordered]
            self.assertEqual(ftb_rows, sorted(ftb_rows))
            self.assertEqual(ftb_groups, ftb_rows)
            self.assertEqual(ftb_ordered[0]["row"], 1)
            self.assertEqual(ftb_ordered[-1]["row"], cabin.rows)

            # 7. Verifikasi aturan BLOCKS_4_ROWS
            b4_ordered, b4_groups = groups_map["BLOCKS_4_ROWS"]
            self.assertEqual(b4_groups, sorted(b4_groups))
            b4_ranges = four_row_block_ranges(cabin.rows, block_size=4)
            self.assertEqual(set(b4_groups), set(range(1, len(b4_ranges) + 1)))
            # Kelompok 1 adalah blok 4 baris paling belakang, Kelompok 2 adalah blok 4 baris paling depan (Baris 1..min(4,N))
            b_last_start, b_last_end = b4_ranges[-1]
            b_first_start, b_first_end = b4_ranges[0]
            b4_g1_rows = {p["row"] for p, g in zip(b4_ordered, b4_groups) if g == 1}
            b4_g2_rows = {p["row"] for p, g in zip(b4_ordered, b4_groups) if g == 2}
            self.assertEqual(b4_g1_rows, set(range(b_last_start, b_last_end + 1)))
            self.assertEqual(b4_g2_rows, set(range(b_first_start, b_first_end + 1)))

            # 8. Verifikasi aturan DOUBLE_OUTSIDE_IN
            doi_ordered, doi_groups = groups_map["DOUBLE_OUTSIDE_IN"]
            self.assertEqual(doi_groups, sorted(doi_groups))
            expected_doi_groups = 6 if cabin.seats_per_row >= 5 else 4
            self.assertEqual(set(doi_groups), set(range(1, expected_doi_groups + 1)))
            (front_s, front_e), (rear_s, rear_e) = double_outside_in_row_split(cabin.rows)
            # Kelompok 1 = Jendela Belakang, Kelompok 2 = Jendela Depan
            doi_g1 = [p for p, g in zip(doi_ordered, doi_groups) if g == 1]
            doi_g2 = [p for p, g in zip(doi_ordered, doi_groups) if g == 2]
            self.assertTrue(all(p["seat_priority"] == 0 and rear_s <= p["row"] <= rear_e for p in doi_g1))
            self.assertTrue(all(p["seat_priority"] == 0 and front_s <= p["row"] <= front_e for p in doi_g2))
            # Kelompok terakhir = Lorong Depan
            doi_last = [p for p, g in zip(doi_ordered, doi_groups) if g == expected_doi_groups]
            self.assertTrue(all(p["seat_priority"] == 2 and front_s <= p["row"] <= front_e for p in doi_last))

            # 9. Verifikasi aturan BTF_WMA_FIXED
            bw_ordered, bw_groups = groups_map["BTF_WMA_FIXED"]
            self.assertEqual(bw_groups, sorted(bw_groups))
            expected_bw_groups = 9 if cabin.seats_per_row >= 5 else 6
            self.assertEqual(set(bw_groups), set(range(1, expected_bw_groups + 1)))
            fixed_ranges = fixed_btf_wma_zone_ranges(cabin.rows, max_zones=3)
            z3_s, z3_e = fixed_ranges[2]
            z2_s, z2_e = fixed_ranges[1]
            z1_s, z1_e = fixed_ranges[0]
            # Pastikan seluruh penumpang Zona 3 (Belakang) masuk sebelum Zona 2 (Tengah), dan Zona 2 sebelum Zona 1 (Depan)
            zone_seq = [
                3 if z3_s <= p["row"] <= z3_e else (2 if z2_s <= p["row"] <= z2_e else 1)
                for p in bw_ordered
            ]
            self.assertEqual(zone_seq, sorted(zone_seq, reverse=True))
            # Di dalam Zona 3, urutan kelas kursi adalah Jendela (0) -> Tengah (1, jika ada) -> Lorong (2)
            z3_priorities = [p["seat_priority"] for p in bw_ordered if z3_s <= p["row"] <= z3_e]
            self.assertEqual(z3_priorities, sorted(z3_priorities))


if __name__ == "__main__":
    unittest.main()
