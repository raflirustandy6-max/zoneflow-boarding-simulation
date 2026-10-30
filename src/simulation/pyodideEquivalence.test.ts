import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPyodide, type PyodideInterface } from "pyodide";
import { AIRCRAFT_LAYOUTS, mapAzboV2ResponseToSummary } from "./engine";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const azboCorePath = path.join(repoRoot, "backend/app/azbo_core.py");

interface EquivalenceScenarioInput {
  label: string;
  layout_id: string;
  layout_name: string;
  rows: number;
  left_seats: number;
  right_seats: number;
  left_letters: string[];
  right_letters: string[];
  row_pitch_m: number;
  cell_m: number;
  bag_ratio: number;
  ga_population: number;
  ga_generations: number;
  train_reps: number;
  test_reps: number;
  seed: number;
  dt: number;
  zone_call_overhead_s: number;
}

const PYTHON_BRIDGE_BOOTSTRAP = `
import json
import sys

if "/home/pyodide" not in sys.path:
    sys.path.insert(0, "/home/pyodide")

import azbo_core

def run_zoneflow_azbo_v2_from_json(payload_json: str) -> str:
    req = json.loads(payload_json)
    cabin = azbo_core.CabinSpec(
        layout_id=str(req["layout_id"]),
        layout_name=str(req["layout_name"]),
        rows=int(req["rows"]),
        left_seats=int(req["left_seats"]),
        right_seats=int(req["right_seats"]),
        left_letters=tuple(req.get("left_letters") or ()),
        right_letters=tuple(req.get("right_letters") or ()),
        row_pitch_m=float(req.get("row_pitch_m", 0.8)),
        cell_m=float(req.get("cell_m", 0.4)),
    )
    result = azbo_core.run_azbo_v2_evaluation(
        cabin=cabin,
        bag_ratio=float(req["bag_ratio"]),
        ga_population=int(req.get("ga_population", 14)),
        ga_generations=int(req.get("ga_generations", 8)),
        train_reps=int(req.get("train_reps", 3)),
        test_reps=int(req.get("test_reps", 20)),
        seed=int(req.get("seed", 20261028)),
        dt=float(req.get("dt", 0.25)),
        zone_call_overhead_s=float(req.get("zone_call_overhead_s", 0.0)),
    )
    return json.dumps(result)
`;

function runNativePythonAzboV2(scenario: EquivalenceScenarioInput): Record<string, any> {
  const inlineScript = `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.join(repoRoot, "backend"))})
from app import azbo_core

req = json.loads(sys.argv[1])
cabin = azbo_core.CabinSpec(
    layout_id=str(req["layout_id"]),
    layout_name=str(req["layout_name"]),
    rows=int(req["rows"]),
    left_seats=int(req["left_seats"]),
    right_seats=int(req["right_seats"]),
    left_letters=tuple(req.get("left_letters") or ()),
    right_letters=tuple(req.get("right_letters") or ()),
    row_pitch_m=float(req.get("row_pitch_m", 0.8)),
    cell_m=float(req.get("cell_m", 0.4)),
)
res = azbo_core.run_azbo_v2_evaluation(
    cabin=cabin,
    bag_ratio=float(req["bag_ratio"]),
    ga_population=int(req["ga_population"]),
    ga_generations=int(req["ga_generations"]),
    train_reps=int(req["train_reps"]),
    test_reps=int(req["test_reps"]),
    seed=int(req["seed"]),
    dt=float(req["dt"]),
    zone_call_overhead_s=float(req["zone_call_overhead_s"]),
)
print(json.dumps(res))
`;

  const stdout = execFileSync(
    "python3",
    ["-c", inlineScript, JSON.stringify(scenario)],
    {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }
  );
  return JSON.parse(stdout.trim());
}

let cachedPyodide: PyodideInterface | null = null;

async function getPyodideWithAzboCore(): Promise<PyodideInterface> {
  if (cachedPyodide) {
    return cachedPyodide;
  }
  const pyodide = await loadPyodide({
    indexURL: path.join(repoRoot, "node_modules/pyodide"),
  });
  const azboCoreSource = fs.readFileSync(azboCorePath, "utf8");
  pyodide.FS.writeFile("/home/pyodide/azbo_core.py", azboCoreSource);
  await pyodide.runPythonAsync(PYTHON_BRIDGE_BOOTSTRAP);
  cachedPyodide = pyodide;
  return pyodide;
}

async function runPyodideAzboV2(scenario: EquivalenceScenarioInput): Promise<Record<string, any>> {
  const pyodide = await getPyodideWithAzboCore();
  const runFn = pyodide.globals.get("run_zoneflow_azbo_v2_from_json");
  try {
    const outStr = String(runFn(JSON.stringify(scenario)));
    return JSON.parse(outStr);
  } finally {
    if (typeof runFn.destroy === "function") {
      runFn.destroy();
    }
  }
}

const SCENARIOS: EquivalenceScenarioInput[] = [
  {
    label: "1. Konfigurasi Kecil (8 Baris / 32 Penumpang, 2-2)",
    layout_id: "mini-8-rows-32",
    layout_name: "Kabin Uji Mini 8 Baris (2-2)",
    rows: 8,
    left_seats: 2,
    right_seats: 2,
    left_letters: ["A", "B"],
    right_letters: ["C", "D"],
    row_pitch_m: 0.8,
    cell_m: 0.4,
    bag_ratio: 0.7,
    ga_population: 10,
    ga_generations: 4,
    train_reps: 3,
    test_reps: 10,
    seed: 20261029,
    dt: 0.25,
    zone_call_overhead_s: 0.0,
  },
  {
    label: "2. Konfigurasi Menengah ATR 72-600 (18 Baris / 72 Penumpang, 2-2)",
    layout_id: "atr72-600-72",
    layout_name: "ATR 72-600",
    rows: 18,
    left_seats: 2,
    right_seats: 2,
    left_letters: ["A", "B"],
    right_letters: ["C", "D"],
    row_pitch_m: 0.8,
    cell_m: 0.4,
    bag_ratio: 0.7,
    ga_population: 12,
    ga_generations: 6,
    train_reps: 3,
    test_reps: 10,
    seed: 20261029,
    dt: 0.25,
    zone_call_overhead_s: 0.0,
  },
  {
    label: "3. Konfigurasi Penuh Boeing 737-800 / A320-200 (30 Baris / 180 Penumpang, 3-3)",
    layout_id: "b737-800-180",
    layout_name: "Boeing 737-800 / Airbus A320-200",
    rows: 30,
    left_seats: 3,
    right_seats: 3,
    left_letters: ["A", "B", "C"],
    right_letters: ["D", "E", "F"],
    row_pitch_m: 0.8,
    cell_m: 0.4,
    bag_ratio: 0.7,
    ga_population: 14,
    ga_generations: 8,
    train_reps: 3,
    test_reps: 10,
    seed: 20261029,
    dt: 0.25,
    zone_call_overhead_s: 0.0,
  },
];

for (const scenario of SCENARIOS) {
  test(`Kesetaraan Penuh Python Asli (Versi A) vs Pyodide WebAssembly (Versi B): ${scenario.label}`, async () => {
    const nativeRes = runNativePythonAzboV2(scenario);
    const pyodideRes = await runPyodideAzboV2(scenario);

    // 1. Kesetaraan Skenario & Parameter Fisik
    assert.deepEqual(pyodideRes.scenario, nativeRes.scenario);

    // 2. Kesetaraan Hasil Optimasi GA, Cakupan K=1..N, dan Seed Training/Testing
    assert.equal(pyodideRes.optimization.k_zones, nativeRes.optimization.k_zones);
    assert.deepEqual(pyodideRes.optimization.cut_rows, nativeRes.optimization.cut_rows);
    assert.deepEqual(pyodideRes.optimization.zone_ranges, nativeRes.optimization.zone_ranges);
    assert.deepEqual(pyodideRes.optimization.zone_sizes, nativeRes.optimization.zone_sizes);
    assert.deepEqual(pyodideRes.optimization.zone_order, nativeRes.optimization.zone_order);
    assert.equal(pyodideRes.optimization.in_zone_rule, nativeRes.optimization.in_zone_rule);
    assert.equal(
      pyodideRes.optimization.best_training_fitness_s,
      nativeRes.optimization.best_training_fitness_s
    );
    assert.deepEqual(
      pyodideRes.optimization.initial_k_coverage,
      Array.from({ length: scenario.rows }, (_, i) => i + 1)
    );
    assert.deepEqual(
      pyodideRes.optimization.initial_k_coverage,
      nativeRes.optimization.initial_k_coverage
    );
    assert.deepEqual(
      pyodideRes.optimization.train_seeds,
      nativeRes.optimization.train_seeds
    );
    assert.deepEqual(
      pyodideRes.optimization.test_seeds,
      nativeRes.optimization.test_seeds
    );
    assert.deepEqual(pyodideRes.optimization, nativeRes.optimization);

    // 3. Kesetaraan Evaluasi 12 Metode Boarding, Waktu Boarding, Aisle Wait, & Seat Interference
    assert.equal(pyodideRes.recommendation.evaluated_strategies.length, 12);
    assert.equal(
      pyodideRes.recommendation.winner_by_sample_mean,
      nativeRes.recommendation.winner_by_sample_mean
    );
    assert.equal(pyodideRes.recommendation.mean_s, nativeRes.recommendation.mean_s);
    assert.equal(pyodideRes.recommendation.sd_s, nativeRes.recommendation.sd_s);
    assert.deepEqual(
      pyodideRes.recommendation.evaluated_strategies,
      nativeRes.recommendation.evaluated_strategies
    );
    assert.deepEqual(
      pyodideRes.recommendation.paired_comparisons,
      nativeRes.recommendation.paired_comparisons
    );
    assert.deepEqual(
      pyodideRes.recommendation.equivalent_methods,
      nativeRes.recommendation.equivalent_methods
    );

    // 4. Kesetaraan Replikasi Representatif & Trace Animasi
    assert.equal(
      pyodideRes.animation.replication_seed,
      nativeRes.animation.replication_seed
    );
    assert.equal(
      pyodideRes.animation.replication_index,
      nativeRes.animation.replication_index
    );
    assert.equal(
      pyodideRes.animation.boarding_time_s,
      nativeRes.animation.boarding_time_s
    );
    assert.deepEqual(pyodideRes.animation.metrics, nativeRes.animation.metrics);
    assert.deepEqual(
      pyodideRes.animation.timeline_details,
      nativeRes.animation.timeline_details
    );
    assert.equal(pyodideRes.animation.trace.length, nativeRes.animation.trace.length);
    assert.deepEqual(pyodideRes.animation.trace, nativeRes.animation.trace);

    // 5. Jika cocok dengan katalog pesawat utama, pastikan pemetaan ringkasan frontend juga 100% identik
    const matchingLayout = AIRCRAFT_LAYOUTS.find((l) => l.id === scenario.layout_id);
    if (matchingLayout) {
      const nativeSummary = mapAzboV2ResponseToSummary(nativeRes, matchingLayout);
      const pyodideSummary = mapAzboV2ResponseToSummary(pyodideRes, matchingLayout);
      assert.deepEqual(pyodideSummary, nativeSummary);
    }
  });
}
