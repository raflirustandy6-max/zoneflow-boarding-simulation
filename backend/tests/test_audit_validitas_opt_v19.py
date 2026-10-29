"""Pengujian regresi tambahan untuk audit Blueprint AZBO, 29 Oktober 2026.

Bukan validasi waktu boarding nyata; memeriksa rancangan algoritma, cakupan
K, split seed, perbandingan berpasangan, ekuivalensi, dan sumber animasi.
"""
import math
import unittest

from app.azbo_core import (
    CabinSpec,
    SUPPORTED_AZBO_V2_STRATEGIES,
    build_boarding_sequence,
    generate_replication_passengers,
    run_ga_variable_k,
    run_azbo_v2_evaluation,
    simulate,
)


class TestAuditOptimasiV19(unittest.TestCase):
    def test_ga_cakupan_30_nilai_k_meskipun_populasi_14(self):
        cabin = CabinSpec(rows=30, left_seats=2, right_seats=2)
        kw = dict(cabin=cabin, bag_ratio=0.60, ga_population=14,
                  ga_generations=1, train_reps=2, seed=725)
        res = run_ga_variable_k(**kw)
        self.assertEqual(res["initial_k_coverage"], list(range(1, 31)))
        self.assertEqual(res["explored_k_values"], list(range(1, 31)))
        self.assertEqual(res["initial_coverage_candidates_evaluated"], 30)
        self.assertEqual(res["ga_population_requested"], 14)
        self.assertGreaterEqual(res["unique_candidates_evaluated"], 30)
        self.assertEqual(set(res["initial_coverage_fitness_by_k_s"]), set(range(1, 31)))
        self.assertEqual(res["best_training_fitness_s"], run_ga_variable_k(**kw)["best_training_fitness_s"])

    def test_replikasi_seed_terpisah_dan_ekuivalensi_semua_replikasi(self):
        cabin = CabinSpec(rows=8, left_seats=2, right_seats=3)
        res = run_azbo_v2_evaluation(
            cabin, 0.50, ga_population=7, ga_generations=3,
            train_reps=3, test_reps=5, seed=991,
        )
        opt = res["optimization"]
        rec = res["recommendation"]
        self.assertEqual(opt["initial_k_coverage"], list(range(1, 9)))
        self.assertEqual(len(opt["train_seeds"]), 3)
        self.assertEqual(len(opt["test_seeds"]), 5)
        self.assertTrue(set(opt["train_seeds"]).isdisjoint(opt["test_seeds"]))
        self.assertEqual(len(rec["evaluated_strategies"]), 12)
        self.assertEqual(
            {s["strategy_id"] for s in rec["evaluated_strategies"]},
            set(SUPPORTED_AZBO_V2_STRATEGIES),
        )
        reported_pairs = {frozenset(x) for x in rec["equivalent_methods"]}
        reported = {m["strategy_id"]: m for m in rec["evaluated_strategies"]}
        for pair in reported_pairs:
            m1, m2 = tuple(pair)
            for seed in opt["test_seeds"]:
                passengers = generate_replication_passengers(cabin, 0.50, seed)
                # Hasil urutan ZONE mempunyai prioritas panggilan spesifik dan tidak
                # bisa direkonstruksi hanya dari cut_rows. Untuk pasangan non-ZONE,
                # audit ulang seluruh seed secara langsung.
                if "ZONE" in pair:
                    self.assertEqual(reported[m1]["mean_s"], reported[m2]["mean_s"])
                    continue
                a, _ = build_boarding_sequence(passengers, m1, seed)
                b, _ = build_boarding_sequence(passengers, m2, seed)
                self.assertEqual([x["seat_id"] for x in a], [x["seat_id"] for x in b])
        self.assertTrue(all(m["mean_s"] > 0 for m in rec["evaluated_strategies"]))

    def test_trace_representatif_adalah_replikasi_nyata(self):
        cabin = CabinSpec(rows=6, left_seats=3, right_seats=3)
        res = run_azbo_v2_evaluation(
            cabin, 0.75, ga_population=8, ga_generations=3,
            train_reps=2, test_reps=8, seed=409,
        )
        anim = res["animation"]
        opt = res["optimization"]
        winner = res["recommendation"]["winner_by_sample_mean"]
        self.assertEqual(anim["strategy_id"], winner)
        self.assertTrue(anim["is_single_replication"])
        self.assertEqual(anim["selection_method"], "testing_replication_closest_to_winner_sample_mean")
        self.assertIn(anim["replication_seed"], opt["test_seeds"])
        self.assertGreater(len(anim["trace"]), 0)
        self.assertEqual(len(anim["timeline_details"]), cabin.capacity)
        self.assertEqual(anim["boarding_time_s"], anim["metrics"]["boarding_time_seconds"])
        self.assertAlmostEqual(anim["sample_mean_s"], res["recommendation"]["mean_s"])
        # Audit ketepatan pemilihan replikasi untuk metode pembanding non-ZONE.
        if winner != "ZONE":
            times = []
            for seed in opt["test_seeds"]:
                passengers = generate_replication_passengers(cabin, .75, seed)
                ordered, groups = build_boarding_sequence(passengers, winner, seed)
                times.append(simulate(ordered, cabin, group_ids=groups,
                                      record_trace=False, verify_invariants=False)["boarding_time_s"])
            self.assertEqual(
                anim["replication_index"],
                min(range(len(times)), key=lambda i: (abs(times[i] - anim["sample_mean_s"]), i)) + 1,
            )
            self.assertEqual(anim["boarding_time_s"], times[anim["replication_index"] - 1])

    def test_kabin_3_kiri_2_kanan_label_kursi_unik(self):
        from app.azbo_core import create_cabin_seats
        spec = CabinSpec(rows=4, left_seats=3, right_seats=2)
        seats = create_cabin_seats(spec)
        self.assertEqual(len(seats), spec.capacity)
        self.assertEqual(len({seat["seat_id"] for seat in seats}), spec.capacity)
        self.assertEqual(spec.resolved_right_letters(), ("D", "E"))
        with self.assertRaises(ValueError):
            CabinSpec(rows=4, left_seats=3, right_seats=2,
                      left_letters=("A", "B", "C"), right_letters=("C", "D"))

    def test_audit_100_replikasi_dapat_dijalankan(self):
        cabin = CabinSpec(rows=3, left_seats=2, right_seats=2)
        res = run_azbo_v2_evaluation(
            cabin, 0.50, ga_population=4, ga_generations=2,
            train_reps=2, test_reps=100, seed=8123,
        )
        self.assertEqual(res["scenario"]["test_reps"], 100)
        self.assertEqual(len(res["optimization"]["test_seeds"]), 100)
        self.assertEqual(len(res["recommendation"]["paired_comparisons"]), 12)
        self.assertTrue(math.isfinite(res["recommendation"]["mean_s"]))


if __name__ == "__main__":
    unittest.main()
