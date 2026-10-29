/**
 * AZBO V2 Backend API Client (Single Source of Truth).
 *
 * Seluruh simulasi lorong fisik berbasis sel (cell_m = 0.4 m) dan optimasi
 * Genetic Algorithm variabel-K (K in {1, ..., N}) dieksekusi di backend Python FastAPI
 * (/api/v2/azbo/*). Klien ini TIDAK PERNAH memalsukan atau mengganti hasil
 * rekomendasi dengan simulator lokal TypeScript apabila backend Python tidak aktif.
 */

export interface AzboHealthResponse {
  status: "online" | string;
  engine: string;
  version: string;
  python_version: string;
  single_source_of_truth: boolean;
  locked_assumptions: {
    occupancy_rate: number;
    baggage_count_formula: string;
    zone_count_variable: string;
    walk_speed_distribution: string;
    baggage_stow_distribution: string;
    seat_movement_distribution: string;
  };
  presets_count: number;
}

export interface AzboZoneRange {
  zone_id: number;
  start_row: number;
  end_row: number;
  row_count: number;
  call_sequence?: number;
}

export interface AzboDecodedCandidate {
  K: number;
  cuts: number[];
  zones: AzboZoneRange[];
  zone_call_order: number[];
  ordered_zones: Required<AzboZoneRange>[];
  internal_rule: "WMA_IN_ZONE" | "BTF_IN_ZONE";
  training_mean_s?: number;
  testing_mean_s?: number;
  testing_std_s?: number;
  testing_ci95_lower_s?: number;
  testing_ci95_upper_s?: number;
  rank?: number;
}

export interface AzboGenerationRecord {
  generation: number;
  best_training_mean_s: number;
  population_mean_s: number;
  best_K: number;
  best_internal_rule: "WMA_IN_ZONE" | "BTF_IN_ZONE";
  unique_candidates_evaluated: number;
}

export interface AzboStrategySummary {
  strategy_id: "GA_ZONE" | "WMA" | "BTF" | "RANDOM" | string;
  label: string;
  replications: number;
  mean_s: number;
  std_s: number;
  ci95_half_width_s: number;
  ci95_lower_s: number;
  ci95_upper_s: number;
  min_s: number;
  max_s: number;
  mean_minutes: number;
  mean_aggregate_aisle_wait_s: number;
  mean_seat_interference_events: number;
  replication_times_s: number[];
}

export interface AzboPairedComparison {
  strategy_a: string;
  strategy_b: string;
  mean_diff_s: number;
  std_diff_s: number;
  ci95_lower_s: number;
  ci95_upper_s: number;
  a_faster_count: number;
  b_faster_count: number;
  tie_count: number;
  is_equivalent: boolean;
}

export interface AzboEquivalenceNotice {
  strategy_a: string;
  strategy_b: string;
  identical_sequence: boolean;
  identical_times: boolean;
  note: string;
}

export interface AzboPassengerLog {
  queue_position: number;
  seat_id: string;
  row: number;
  seat: string;
  side: "L" | "R";
  has_bag: boolean;
  walk_speed_mps: number;
  entry_time_s: number;
  arrival_target_s: number;
  aisle_wait_s: number;
  bag_stow_time_s: number;
  seat_movement_time_s: number;
  occupied_blockers: number;
  movements_count: number;
  finish_time_s: number;
  target_cell: number;
}

export type AzboTraceEvent =
  | [number, "entry", string, number, number]
  | [number, "move", string, number, number]
  | [number, "seating_started", string, number, number, number, number]
  | [number, "seated", string, number, number];

export interface AzboOptimizationResult {
  status: "completed" | "cancelled";
  engine: string;
  scientific_statement: string;
  scenario: {
    aircraft_id: string;
    rows: number;
    left_seats: number;
    right_seats: number;
    seats_per_row: number;
    capacity: number;
    occupancy_rate: number;
    passenger_count: number;
    bag_ratio: number;
    bag_percent: number;
    baggage_passenger_count: number;
    row_pitch_m: number;
    cell_m: number;
    total_aisle_cells: number;
    dt_s: number;
    zone_call_overhead_s: number;
  };
  ga_config: {
    pop_size: number;
    generations: number;
    train_reps: number;
    test_reps: number;
    mutation_rate: number;
    elite_count: number;
    tournament_size: number;
    base_seed: number;
    test_base_seed: number;
    unique_candidates_evaluated: number;
    explored_k_distribution: Record<string, number>;
  };
  recommended_strategy: string;
  recommended_strategy_label: string;
  recommended_summary: AzboStrategySummary;
  best_zone_configuration: AzboDecodedCandidate;
  strategies: Record<string, AzboStrategySummary>;
  ranked_strategy_ids: string[];
  paired_comparisons: AzboPairedComparison[];
  equivalences: AzboEquivalenceNotice[];
  generation_history: AzboGenerationRecord[];
  top_training_candidates: AzboDecodedCandidate[];
  visualization: {
    strategy_shown: string;
    total_time_s: number;
    dt_s: number;
    total_cells: number;
    cells_per_row: number;
    trace: AzboTraceEvent[];
    passenger_logs: AzboPassengerLog[];
    ga_zone_trace: AzboTraceEvent[];
    ga_zone_passenger_logs: AzboPassengerLog[];
    ga_zone_total_time_s: number;
  };
  execution_time_s: number;
}

export interface AzboJobStatusResponse {
  job_id: string;
  status: "running" | "completed" | "cancelled" | "failed";
  stage: string;
  progress_percent: number;
  current_generation: number;
  total_generations: number;
  unique_candidates_evaluated: number;
  best_training_mean_s: number | null;
  best_candidate: AzboDecodedCandidate | null;
  explored_k_counts: Record<string, number>;
  generation_history: AzboGenerationRecord[];
  elapsed_s: number;
  scenario_preview: {
    aircraft_id: string;
    rows: number;
    left_seats: number;
    right_seats: number;
    capacity: number;
    bag_ratio: number;
    baggage_passenger_count: number;
  };
  result: AzboOptimizationResult | null;
  error_message: string | null;
}

export interface AzboOptimizeRequestPayload {
  aircraft_id: string;
  rows: number;
  left_seats: number;
  right_seats: number;
  bag_ratio: number;
  row_pitch_m?: number;
  cell_m?: number;
  dt?: number;
  zone_call_overhead_s?: number;
  pop_size: number;
  generations: number;
  train_reps: number;
  test_reps: number;
  mutation_rate?: number;
  elite_count?: number;
  tournament_size?: number;
  seed?: number;
}

export class AzboBackendOfflineError extends Error {
  public readonly endpoint: string;
  public readonly statusCode?: number;

  constructor(message: string, endpoint: string, statusCode?: number) {
    super(message);
    this.name = "AzboBackendOfflineError";
    this.endpoint = endpoint;
    this.statusCode = statusCode;
  }
}

/**
 * Menentukan base URL untuk endpoint AZBO V2 (/api/v2/azbo).
 */
export function resolveAzboV2BaseUrl(): string {
  const rawEnv = (import.meta.env.VITE_API_BASE_URL || "").trim();
  if (!rawEnv) {
    return "/api/v2/azbo";
  }
  const clean = rawEnv.replace(/\/+$/, "");
  if (clean.endsWith("/api/v2/azbo")) {
    return clean;
  }
  if (clean.endsWith("/api/v1")) {
    return clean.replace(/\/api\/v1$/, "/api/v2/azbo");
  }
  if (clean.endsWith("/api")) {
    return `${clean}/v2/azbo`;
  }
  return `${clean}/api/v2/azbo`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = resolveAzboV2BaseUrl();
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
  } catch {
    throw new AzboBackendOfflineError(
      `Backend Python AZBO V2 tidak dapat dihubungi pada ${url}. Pastikan server FastAPI berjalan (python3 backend/run_server.py pada port 8001).`,
      url
    );
  }

  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.json();
      detail = errBody?.detail || errBody?.message || "";
    } catch {
      // Abaikan jika respons bukan JSON
    }

    if (response.status === 502 || response.status === 503 || response.status === 504 || response.status === 404) {
      throw new AzboBackendOfflineError(
        detail ||
          `Endpoint backend Python AZBO V2 (${url}) mengembalikan HTTP ${response.status}. Pastikan proses backend Python aktif di port 8001.`,
        url,
        response.status
      );
    }

    throw new Error(detail || `Permintaan API gagal dengan kode HTTP ${response.status}.`);
  }

  return (await response.json()) as T;
}

export async function checkAzboV2Health(): Promise<AzboHealthResponse> {
  return requestJson<AzboHealthResponse>("/health", { method: "GET" });
}

export async function startAzboV2Job(
  payload: AzboOptimizeRequestPayload
): Promise<AzboJobStatusResponse> {
  return requestJson<AzboJobStatusResponse>("/jobs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchAzboV2JobStatus(
  jobId: string
): Promise<AzboJobStatusResponse> {
  return requestJson<AzboJobStatusResponse>(`/jobs/${encodeURIComponent(jobId)}`, {
    method: "GET",
  });
}

export async function cancelAzboV2Job(
  jobId: string
): Promise<{ status: string; job_id: string }> {
  return requestJson<{ status: string; job_id: string }>(
    `/jobs/${encodeURIComponent(jobId)}/cancel`,
    { method: "POST" }
  );
}

export async function runAzboV2OptimizeSync(
  payload: AzboOptimizeRequestPayload
): Promise<AzboOptimizationResult> {
  return requestJson<AzboOptimizationResult>("/optimize", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
