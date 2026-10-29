import test from "node:test";
import assert from "node:assert/strict";
import {
  AIRCRAFT_LAYOUTS,
  computeDeterministicBaggageCount,
  mapAzboV2ResponseToSummary,
} from "./engine";

test("computeDeterministicBaggageCount implements n_b = floor(n * rho_b + 0.5)", () => {
  assert.equal(computeDeterministicBaggageCount(180, 0), 0);
  assert.equal(computeDeterministicBaggageCount(180, 100), 180);
  assert.equal(computeDeterministicBaggageCount(180, 70), 126);
  assert.equal(computeDeterministicBaggageCount(72, 70), 50);
  assert.equal(computeDeterministicBaggageCount(125, 70), 88);
  assert.equal(computeDeterministicBaggageCount(144, 70), 101);
});

test("mapAzboV2ResponseToSummary maps Python AZBO V2 API payload accurately", () => {
  const layout = AIRCRAFT_LAYOUTS[0];
  const mockApiPayload = {
    scenario: {
      layout_id: layout.id,
      layout_name: layout.name,
      rows: 30,
      left_seats: 3,
      right_seats: 3,
      seats_per_row: 6,
      capacity: 180,
      occupancy_rate: 1.0,
      passenger_count: 180,
      bag_ratio: 0.7,
      baggage_percent: 70,
      baggage_passenger_count: 126,
      without_baggage_count: 54,
      row_pitch_m: 0.8,
      cell_m: 0.4,
      cells_per_row: 2,
      total_cells: 60,
      dt_s: 0.25,
      zone_call_overhead_s: 0.0,
      seed: 20261021,
      train_reps: 3,
      test_reps: 20,
    },
    optimization: {
      k_zones: 4,
      cut_rows: [7, 15, 23],
      zone_ranges: [
        [1, 7],
        [8, 15],
        [16, 23],
        [24, 30],
      ],
      zone_sizes: [7, 8, 8, 7],
      zone_order: [4, 3, 2, 1],
      in_zone_rule: "WMA_IN_ZONE",
      best_training_fitness_s: 612.5,
      explored_k_values: [1, 2, 3, 4, 5, 6],
      unique_candidates_evaluated: 72,
      ga_population: 14,
      ga_generations: 8,
      fitness_history: [],
    },
    recommendation: {
      winner_by_sample_mean: "ZONE",
      winner_short_label: "Boarding Berbasis Zona (Hasil Optimasi AZBO)",
      winner_category: "Berbasis Zona",
      mean_s: 615.2,
      sd_s: 14.5,
      approx_95ci_s: [608.8, 621.6],
      mean_min: 10.25,
      sd_min: 0.24,
      calling_steps: [
        "Panggilan 1 — Zona 4 (Baris 24 s/d Baris 30): Panggil penumpang pada Baris 24 s/d Baris 30.",
      ],
      zone_config: {
        k_zones: 4,
        boundaries: [7, 15, 23],
        sizes: [7, 8, 8, 7],
        order: [4, 3, 2, 1],
        zone_ranges: [
          [1, 7],
          [8, 15],
          [16, 23],
          [24, 30],
        ],
        in_zone_rule: "WMA_IN_ZONE",
      },
      evaluated_strategies: [
        {
          rank: 1,
          strategy_id: "ZONE",
          short_label: "Boarding Berbasis Zona (Hasil Optimasi AZBO)",
          category: "Berbasis Zona",
          mean_s: 615.2,
          sd_s: 14.5,
          ci95_low_s: 608.8,
          ci95_high_s: 621.6,
          min_s: 590.0,
          max_s: 640.0,
          mean_min: 10.25,
          sd_min: 0.24,
          mean_aisle_interference_events: 42,
          mean_seat_interference_events: 0,
          zone_config: {
            k_zones: 4,
            boundaries: [7, 15, 23],
            sizes: [7, 8, 8, 7],
            order: [4, 3, 2, 1],
            zone_ranges: [
              [1, 7],
              [8, 15],
              [16, 23],
              [24, 30],
            ],
            in_zone_rule: "WMA_IN_ZONE",
          },
          calling_steps: [
            "Panggilan 1 — Zona 4 (Baris 24 s/d Baris 30): Panggil penumpang pada Baris 24 s/d Baris 30.",
          ],
          diff_from_best_s: 0.0,
          diff_from_best_pct: 0.0,
          paired_diff_sd_s: 0.0,
          paired_diff_ci95_s: [0.0, 0.0],
        },
        {
          rank: 2,
          strategy_id: "WMA",
          short_label: "Jendela–Tengah–Lorong (Window–Middle–Aisle / WMA)",
          category: "Berdasarkan Posisi Kursi",
          mean_s: 622.4,
          sd_s: 15.1,
          ci95_low_s: 615.8,
          ci95_high_s: 629.0,
          min_s: 598.0,
          max_s: 650.0,
          mean_min: 10.37,
          sd_min: 0.25,
          mean_aisle_interference_events: 48,
          mean_seat_interference_events: 0,
          zone_config: null,
          calling_steps: ["Panggilan 1 — Kursi Jendela"],
          diff_from_best_s: 7.2,
          diff_from_best_pct: 1.17,
          paired_diff_sd_s: 5.2,
          paired_diff_ci95_s: [4.9, 9.5],
        },
      ],
      paired_comparisons: [],
      equivalent_methods: [],
      disclaimer:
        "Hasil merupakan perkiraan berdasarkan model simulasi dan belum menggantikan pengujian operasional di lapangan.",
    },
    animation: {
      strategy_id: "ZONE",
      strategy_label: "Boarding Berbasis Zona (Hasil Optimasi AZBO)",
      replication_seed: 70261021,
      boarding_time_s: 614.0,
      metrics: {
        boarding_time_seconds: 614.0,
        boarding_time_minutes: 10.233,
        aisle_interference_events: 41,
        aggregate_aisle_wait_person_seconds: 180.0,
        aisle_wait_seconds: 180.0,
        seat_interference_events: 0,
        occupied_blocker_count: 0,
        baggage_count: 126,
        passenger_count: 180,
      },
      timeline_details: [
        {
          queue_position: 1,
          seat_id: "R30A",
          row: 30,
          seat: "A",
          has_bag: true,
          entry_time_s: 0.0,
          arrival_target_s: 32.0,
          aisle_wait_s: 0.0,
          occupied_blockers: 0,
          seat_interference_s: 2.4,
          bag_stowage_s: 14.0,
          finish_time_s: 48.4,
          aisle_transit: [
            { row: 1, enter_s: 0.0, leave_s: 1.0, is_target_row: false },
            { row: 30, enter_s: 31.0, leave_s: 48.4, is_target_row: true },
          ],
        },
      ],
      trace: [],
    },
  };

  const summary = mapAzboV2ResponseToSummary(mockApiPayload, layout);
  assert.equal(summary.scenario.passengerCount, 180);
  assert.equal(summary.scenario.baggagePassengerCount, 126);
  assert.equal(summary.scenario.baggagePercent, 70);
  assert.equal(summary.recommendedMethod.methodName, "ZONE");
  assert.equal(summary.recommendedMethod.zoneConfigUsed?.kZones, 4);
  assert.deepEqual(summary.recommendedMethod.zoneConfigUsed?.boundaries, [7, 15, 23]);
  assert.equal(summary.zoneOptimizationAudit.fixedZoneBaseline, undefined);
  assert.equal(summary.animationDetails?.length, 1);
  assert.equal(summary.animationDetails?.[0].seat_id, "R30A");
});

test("mapAzboV2ResponseToSummary does not attach GA zone config to non-zone winning method", () => {
  const layout = AIRCRAFT_LAYOUTS[1]; // ATR 72-600
  const mockWmaWinnerPayload = {
    scenario: {
      layout_id: layout.id,
      layout_name: layout.name,
      rows: 18,
      left_seats: 2,
      right_seats: 2,
      seats_per_row: 4,
      capacity: 72,
      occupancy_rate: 1.0,
      passenger_count: 72,
      bag_ratio: 0.7,
      baggage_percent: 70,
      baggage_passenger_count: 50,
      without_baggage_count: 22,
      row_pitch_m: 0.8,
      cell_m: 0.4,
      cells_per_row: 2,
      total_cells: 36,
      dt_s: 0.25,
      zone_call_overhead_s: 0.0,
      seed: 20261021,
      train_reps: 3,
      test_reps: 20,
    },
    optimization: {
      k_zones: 3,
      cut_rows: [6, 12],
      zone_ranges: [
        [1, 6],
        [7, 12],
        [13, 18],
      ],
      zone_sizes: [6, 6, 6],
      zone_order: [3, 2, 1],
      in_zone_rule: "WMA_IN_ZONE",
      best_training_fitness_s: 310.0,
      explored_k_values: [1, 2, 3, 4],
      unique_candidates_evaluated: 40,
      ga_population: 14,
      ga_generations: 8,
      fitness_history: [],
    },
    recommendation: {
      winner_by_sample_mean: "WMA",
      winner_short_label: "Jendela–Tengah–Lorong (Window–Middle–Aisle / WMA)",
      winner_category: "Berdasarkan Posisi Kursi",
      mean_s: 305.0,
      sd_s: 10.2,
      approx_95ci_s: [300.5, 309.5],
      mean_min: 5.08,
      sd_min: 0.17,
      calling_steps: [
        "Panggilan 1 — Kursi Jendela: Panggil seluruh penumpang kursi jendela (Baris 18 hingga Baris 1).",
        "Panggilan 2 — Kursi Lorong: Panggil seluruh penumpang kursi tepi lorong (Baris 18 hingga Baris 1).",
      ],
      zone_config: null,
      evaluated_strategies: [
        {
          rank: 1,
          strategy_id: "WMA",
          short_label: "Jendela–Tengah–Lorong (Window–Middle–Aisle / WMA)",
          category: "Berdasarkan Posisi Kursi",
          mean_s: 305.0,
          sd_s: 10.2,
          ci95_low_s: 300.5,
          ci95_high_s: 309.5,
          min_s: 290.0,
          max_s: 325.0,
          mean_min: 5.08,
          sd_min: 0.17,
          mean_aisle_interference_events: 18,
          mean_seat_interference_events: 0,
          zone_config: null,
          calling_steps: [
            "Panggilan 1 — Kursi Jendela: Panggil seluruh penumpang kursi jendela (Baris 18 hingga Baris 1).",
            "Panggilan 2 — Kursi Lorong: Panggil seluruh penumpang kursi tepi lorong (Baris 18 hingga Baris 1).",
          ],
          diff_from_best_s: 0.0,
          diff_from_best_pct: 0.0,
          paired_diff_sd_s: 0.0,
          paired_diff_ci95_s: [0.0, 0.0],
        },
        {
          rank: 2,
          strategy_id: "ZONE",
          short_label: "Boarding Berbasis Zona (Hasil Optimasi AZBO)",
          category: "Berbasis Zona",
          mean_s: 308.4,
          sd_s: 11.0,
          ci95_low_s: 303.6,
          ci95_high_s: 313.2,
          min_s: 292.0,
          max_s: 330.0,
          mean_min: 5.14,
          sd_min: 0.18,
          mean_aisle_interference_events: 20,
          mean_seat_interference_events: 0,
          zone_config: {
            k_zones: 3,
            boundaries: [6, 12],
            sizes: [6, 6, 6],
            order: [3, 2, 1],
            zone_ranges: [
              [1, 6],
              [7, 12],
              [13, 18],
            ],
            in_zone_rule: "WMA_IN_ZONE",
          },
          calling_steps: ["Panggilan 1 — Zona 3 (Baris 13 s/d Baris 18)"],
          diff_from_best_s: 3.4,
          diff_from_best_pct: 1.11,
          paired_diff_sd_s: 4.1,
          paired_diff_ci95_s: [1.6, 5.2],
        },
      ],
      paired_comparisons: [],
      equivalent_methods: [],
      disclaimer:
        "Hasil merupakan perkiraan berdasarkan model simulasi dan belum menggantikan pengujian operasional di lapangan.",
    },
    animation: {
      strategy_id: "WMA",
      strategy_label: "Jendela–Tengah–Lorong (Window–Middle–Aisle / WMA)",
      replication_seed: 70261021,
      boarding_time_s: 304.0,
      metrics: {
        boarding_time_seconds: 304.0,
        boarding_time_minutes: 5.067,
        aisle_interference_events: 18,
        aggregate_aisle_wait_person_seconds: 64.0,
        aisle_wait_seconds: 64.0,
        seat_interference_events: 0,
        occupied_blocker_count: 0,
        baggage_count: 50,
        passenger_count: 72,
      },
      timeline_details: [],
      trace: [],
    },
  };

  const summary = mapAzboV2ResponseToSummary(mockWmaWinnerPayload, layout);
  assert.equal(summary.recommendedMethod.methodName, "WMA");
  assert.equal(summary.recommendedMethod.zoneConfigUsed, undefined);
  assert.equal(summary.zoneOptimizationAudit.fixedZoneBaseline, undefined);
});

test("resolveAzboV2BaseUrl and buildAzboV2EndpointUrl support local proxy and production HTTPS URLs", async () => {
  const { resolveAzboV2BaseUrl, buildAzboV2EndpointUrl } = await import(
    "../services/apiClient"
  );
  assert.equal(resolveAzboV2BaseUrl(""), "/api/v2/azbo");
  assert.equal(resolveAzboV2BaseUrl("/api/v1"), "/api/v2/azbo");
  assert.equal(
    resolveAzboV2BaseUrl("https://zoneflow-api.example.com"),
    "https://zoneflow-api.example.com/api/v2/azbo"
  );
  assert.equal(
    resolveAzboV2BaseUrl("https://zoneflow-api.example.com/api/v1/"),
    "https://zoneflow-api.example.com/api/v2/azbo"
  );
  assert.equal(
    buildAzboV2EndpointUrl("/jobs", "https://zoneflow-api.example.com"),
    "https://zoneflow-api.example.com/api/v2/azbo/jobs"
  );
  assert.equal(buildAzboV2EndpointUrl("/jobs", "/api/v1"), "/api/v2/azbo/jobs");
});

test("mapAzboV2ResponseToSummary maps all 12 boarding methods and closeCompetitionNote accurately", async () => {
  const { BOARDING_METHOD_CATALOG } = await import("./engine");
  const layout = AIRCRAFT_LAYOUTS[0];
  const twelveStrategies = [
    ["STEFFEN", "Metode Steffen (Urutan Kursi Berselang-seling)", "Urutan Kursi Berselang-seling", 520.0],
    ["REVERSE_PYRAMID", "Piramida Terbalik (Reverse Pyramid)", "Kombinasi Diagonal Baris & Kursi", 523.2],
    ["ZONE", "Boarding Berbasis Zona (Hasil Optimasi AZBO)", "Berbasis Zona (Optimasi GA)", 528.0],
    ["BTF_WMA_FIXED", "Back-to-Front + WMA (3 Zona Tetap)", "Hibrida Zona Tetap & Posisi Kursi", 531.5],
    ["DOUBLE_OUTSIDE_IN", "Double Outside-In (Adaptasi Kabin Satu Lorong)", "Hibrida Dua Bagian Kabin & Posisi Kursi", 533.8],
    ["WMA", "Jendela–Tengah–Lorong (Window–Middle–Aisle / WMA)", "Berdasarkan Posisi Kursi", 535.0],
    ["MODIFIED_OPTIMAL", "Optimal Termodifikasi (Modified Optimal)", "Baris Genap/Ganjil & Sisi Kabin", 548.0],
    ["RANDOM", "Acak (Tanpa Urutan Khusus / Random)", "Pembanding Dasar", 590.0],
    ["ROTATING_ZONES", "Zona Berputar (Rotating Zones)", "Blok Zona Bergantian", 610.0],
    ["BLOCKS_4_ROWS", "Blok 4 Baris (Four-Row Blocks)", "Blok Baris Tetap Bergantian", 618.0],
    ["BTF", "Belakang ke Depan (Back-to-Front)", "Berdasarkan Baris", 625.0],
    ["FRONT_TO_BACK", "Depan ke Belakang (Front-to-Back)", "Berdasarkan Baris (Depan ke Belakang)", 695.0],
  ] as const;

  const mockPayload = {
    scenario: {
      layout_id: layout.id,
      layout_name: layout.name,
      rows: 30,
      left_seats: 3,
      right_seats: 3,
      seats_per_row: 6,
      capacity: 180,
      occupancy_rate: 1.0,
      passenger_count: 180,
      bag_ratio: 0.7,
      baggage_percent: 70,
      baggage_passenger_count: 126,
      without_baggage_count: 54,
      row_pitch_m: 0.8,
      cell_m: 0.4,
      cells_per_row: 2,
      total_cells: 60,
      dt_s: 0.25,
      zone_call_overhead_s: 0.0,
      seed: 20261028,
      train_reps: 3,
      test_reps: 20,
    },
    optimization: {
      k_zones: 4,
      cut_rows: [7, 15, 23],
      zone_ranges: [
        [1, 7],
        [8, 15],
        [16, 23],
        [24, 30],
      ],
      zone_sizes: [7, 8, 8, 7],
      zone_order: [4, 3, 2, 1],
      in_zone_rule: "WMA_IN_ZONE",
      best_training_fitness_s: 526.0,
      explored_k_values: [1, 2, 3, 4, 5],
      unique_candidates_evaluated: 60,
      ga_population: 14,
      ga_generations: 8,
      fitness_history: [],
    },
    recommendation: {
      winner_by_sample_mean: "STEFFEN",
      winner_short_label: "Metode Steffen (Urutan Kursi Berselang-seling)",
      winner_category: "Urutan Kursi Berselang-seling",
      mean_s: 520.0,
      sd_s: 12.0,
      approx_95ci_s: [514.7, 525.3],
      mean_min: 8.67,
      sd_min: 0.2,
      calling_steps: ["Tahap 1 — Kursi Jendela Berselang-seling"],
      zone_config: null,
      close_competition_note:
        "Catatan Operasional: Metode peringkat #2 (Piramida Terbalik (Reverse Pyramid)) memiliki perkiraan waktu boarding yang sangat berdekatan.",
      evaluated_strategies: twelveStrategies.map(([id, label, cat, meanS], idx) => ({
        rank: idx + 1,
        strategy_id: id,
        short_label: label,
        category: cat,
        mean_s: meanS,
        sd_s: 12.0,
        ci95_low_s: meanS - 5.0,
        ci95_high_s: meanS + 5.0,
        min_s: meanS - 15.0,
        max_s: meanS + 15.0,
        mean_min: Number((meanS / 60).toFixed(2)),
        sd_min: 0.2,
        mean_aisle_interference_events: 25 + idx * 5,
        mean_seat_interference_events: idx * 2,
        zone_config:
          id === "ZONE"
            ? {
                k_zones: 4,
                boundaries: [7, 15, 23],
                sizes: [7, 8, 8, 7],
                order: [4, 3, 2, 1],
                zone_ranges: [
                  [1, 7],
                  [8, 15],
                  [16, 23],
                  [24, 30],
                ],
                in_zone_rule: "WMA_IN_ZONE",
              }
            : id === "BTF_WMA_FIXED"
            ? {
                k_zones: 3,
                boundaries: [10, 20],
                sizes: [10, 10, 10],
                order: [3, 2, 1],
                zone_ranges: [
                  [1, 10],
                  [11, 20],
                  [21, 30],
                ],
                in_zone_rule: "WMA_IN_ZONE",
              }
            : null,
        calling_steps: [`Panduan untuk ${label}`],
        diff_from_best_s: Number((meanS - 520.0).toFixed(1)),
        diff_from_best_pct: Number((((meanS - 520.0) / 520.0) * 100).toFixed(2)),
        paired_diff_sd_s: 4.5,
        paired_diff_ci95_s: [meanS - 520.0 - 2.0, meanS - 520.0 + 2.0],
      })),
      paired_comparisons: [],
      equivalent_methods: [],
      disclaimer:
        "Hasil merupakan perkiraan berdasarkan model simulasi dan belum menggantikan pengujian operasional di lapangan.",
    },
    animation: {
      strategy_id: "STEFFEN",
      strategy_label: "Metode Steffen (Urutan Kursi Berselang-seling)",
      replication_seed: 20311028,
      boarding_time_s: 518.5,
      metrics: {
        boarding_time_seconds: 518.5,
        boarding_time_minutes: 8.642,
        aisle_interference_events: 24,
        aggregate_aisle_wait_person_seconds: 95.0,
        aisle_wait_seconds: 95.0,
        seat_interference_events: 0,
        occupied_blocker_count: 0,
        baggage_count: 126,
        passenger_count: 180,
      },
      timeline_details: [],
      trace: [],
    },
  };

  const summary = mapAzboV2ResponseToSummary(mockPayload, layout);
  assert.equal(summary.evaluatedMethods.length, 12);
  assert.equal(summary.recommendedMethod.methodName, "STEFFEN");
  assert.equal(summary.recommendedMethod.zoneConfigUsed, undefined);
  assert.ok(summary.closeCompetitionNote?.includes("Piramida Terbalik"));

  const btfWmaEntry = summary.evaluatedMethods.find((m) => m.methodName === "BTF_WMA_FIXED");
  assert.ok(btfWmaEntry);
  assert.deepEqual(btfWmaEntry.zoneConfigUsed?.boundaries, [10, 20]);
  assert.deepEqual(btfWmaEntry.zoneConfigUsed?.order, [3, 2, 1]);

  const supportedIds = BOARDING_METHOD_CATALOG.filter((m) => m.supportedInSimulator).map(
    (m) => m.id
  );
  assert.ok(supportedIds.includes("BLOCKS_4_ROWS"));
  assert.ok(supportedIds.includes("DOUBLE_OUTSIDE_IN"));
  assert.ok(supportedIds.includes("BTF_WMA_FIXED"));
  assert.ok(supportedIds.includes("Front-to-Back"));

  const unsupportedIds = BOARDING_METHOD_CATALOG.filter((m) => !m.supportedInSimulator).map(
    (m) => m.id
  );
  assert.ok(unsupportedIds.includes("N-Steffen-BWB"));
});

test("mapAzboV2ResponseToSummary maps v19 optimization validity audit metadata (K=1..N coverage, train/test seeds, representative animation replication)", () => {
  const layout = AIRCRAFT_LAYOUTS[0];
  const kCov = Array.from({ length: 30 }, (_, i) => i + 1);
  const mockPayload = {
    scenario: {
      layout_id: layout.id,
      layout_name: layout.name,
      rows: 30,
      left_seats: 3,
      right_seats: 3,
      seats_per_row: 6,
      capacity: 180,
      occupancy_rate: 1.0,
      passenger_count: 180,
      bag_ratio: 0.7,
      baggage_percent: 70,
      baggage_passenger_count: 126,
      without_baggage_count: 54,
      row_pitch_m: 0.8,
      cell_m: 0.4,
      cells_per_row: 2,
      total_cells: 60,
      dt_s: 0.25,
      zone_call_overhead_s: 0.0,
      seed: 20261029,
      train_reps: 3,
      test_reps: 20,
    },
    optimization: {
      k_zones: 1,
      cut_rows: [],
      zone_ranges: [[1, 30]],
      zone_sizes: [30],
      zone_order: [1],
      in_zone_rule: "WMA_IN_ZONE",
      best_training_fitness_s: 512.0,
      explored_k_values: kCov,
      initial_k_coverage: kCov,
      initial_coverage_candidates_evaluated: 30,
      initial_coverage_fitness_by_k_s: { "1": 512.0, "30": 620.0 },
      ga_population_requested: 14,
      train_seeds: [30261029, 30271036, 30281043],
      test_seeds: [70261029, 70271036, 70281043],
      unique_candidates_evaluated: 98,
      ga_population: 14,
      ga_generations: 8,
      fitness_history: [],
    },
    recommendation: {
      winner_by_sample_mean: "ZONE",
      winner_short_label: "Boarding Berbasis Zona (Hasil Optimasi AZBO)",
      winner_category: "Berbasis Zona",
      mean_s: 515.4,
      sd_s: 11.2,
      approx_95ci_s: [510.5, 520.3],
      mean_min: 8.59,
      sd_min: 0.19,
      calling_steps: ["Panggilan 1 — Zona 1 (Baris 1 s/d Baris 30)"],
      zone_config: {
        k_zones: 1,
        boundaries: [],
        sizes: [30],
        order: [1],
        zone_ranges: [[1, 30]],
        in_zone_rule: "WMA_IN_ZONE",
      },
      evaluated_strategies: [
        {
          rank: 1,
          strategy_id: "ZONE",
          short_label: "Boarding Berbasis Zona (Hasil Optimasi AZBO)",
          category: "Berbasis Zona",
          mean_s: 515.4,
          sd_s: 11.2,
          ci95_low_s: 510.5,
          ci95_high_s: 520.3,
          min_s: 498.0,
          max_s: 534.0,
          mean_min: 8.59,
          sd_min: 0.19,
          mean_aisle_interference_events: 28,
          mean_seat_interference_events: 0,
          zone_config: {
            k_zones: 1,
            boundaries: [],
            sizes: [30],
            order: [1],
            zone_ranges: [[1, 30]],
            in_zone_rule: "WMA_IN_ZONE",
          },
          calling_steps: ["Panggilan 1 — Zona 1 (Baris 1 s/d Baris 30)"],
          diff_from_best_s: 0.0,
          diff_from_best_pct: 0.0,
          paired_diff_sd_s: 0.0,
          paired_diff_ci95_s: [0.0, 0.0],
        },
      ],
      paired_comparisons: [],
      equivalent_methods: [["ZONE", "WMA"]],
      disclaimer:
        "Hasil merupakan perkiraan berdasarkan model simulasi dan belum menggantikan pengujian operasional di lapangan.",
    },
    animation: {
      strategy_id: "ZONE",
      strategy_label: "Boarding Berbasis Zona (Hasil Optimasi AZBO)",
      replication_seed: 70271036,
      replication_index: 2,
      selection_method: "testing_replication_closest_to_winner_sample_mean",
      sample_mean_s: 515.4,
      is_single_replication: true,
      boarding_time_s: 515.0,
      metrics: {
        boarding_time_seconds: 515.0,
        boarding_time_minutes: 8.583,
        aisle_interference_events: 27,
        aggregate_aisle_wait_person_seconds: 112.0,
        aisle_wait_seconds: 112.0,
        seat_interference_events: 0,
        occupied_blocker_count: 0,
        baggage_count: 126,
        passenger_count: 180,
      },
      timeline_details: [],
      trace: [],
    },
  };

  const summary = mapAzboV2ResponseToSummary(mockPayload, layout);
  assert.deepEqual(summary.zoneOptimizationAudit.initialKCoverage, kCov);
  assert.equal(summary.zoneOptimizationAudit.initialCoverageCandidatesEvaluated, 30);
  assert.equal(summary.zoneOptimizationAudit.gaPopulationRequested, 14);
  assert.deepEqual(summary.zoneOptimizationAudit.trainSeeds, [30261029, 30271036, 30281043]);
  assert.deepEqual(summary.zoneOptimizationAudit.testSeeds, [70261029, 70271036, 70281043]);
  assert.equal(summary.zoneOptimizationAudit.azboWilmaEquivalenceVerified, true);
  assert.equal(summary.animationReplication?.replicationIndex, 2);
  assert.equal(summary.animationReplication?.replicationSeed, 70271036);
  assert.equal(summary.animationReplication?.isSingleReplication, true);
  assert.equal(summary.animationReplication?.boardingTimeS, 515.0);
  assert.equal(summary.animationReplication?.sampleMeanS, 515.4);
  assert.ok(
    summary.scientificCaveats.some((c) => c.includes("acuan audit 100 pada Blueprint"))
  );
  assert.ok(
    summary.scientificCaveats.some((c) => c.includes("satu replikasi TEST nyata"))
  );
});


