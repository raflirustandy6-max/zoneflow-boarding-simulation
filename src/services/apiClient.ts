/**
 * ZoneFlow API Client Service
 * Menghubungkan Frontend React dengan Layanan Backend Python FastAPI.
 */

import { PassengerTimelineDetail, SimulationMetrics } from "../simulation/engine";

export interface BackendHealthInfo {
  status: "online" | "offline";
  engine: string;
  version: string;
  python_version: string;
  supported_methods_count: number;
}

export interface BackendMethodItem {
  id: string;
  name: string;
  category: string;
  description: string;
  note: string;
}

export interface PythonSimulationResponse {
  status: string;
  engine: string;
  method: string;
  baggage_ratio: number;
  baggage_percent: number;
  seed: number;
  execution_time_ms: number;
  metrics: SimulationMetrics;
  timeline_details: PassengerTimelineDetail[];
}

export interface PythonSimulationRequest {
  method: string;
  baggage_ratio: number;
  load_factor?: number;
  seed: number;
  parameters?: {
    walk_per_row_s?: number;
    entry_gap_s?: number;
    aisle_headway_s?: number;
    sit_time_s?: number;
    weibull_scale_s?: number;
    weibull_shape?: number;
    moves_one_blocker?: number;
    moves_two_blockers?: number;
  };
  custom_zone_config?: {
    boundaries: number[];
    zone_order: number[];
  };
}

export function normalizeApiBaseUrl(rawUrl?: string): string {
  const cleaned = (rawUrl || "/api/v1").trim().replace(/\/+$/, "");
  return cleaned || "/api/v1";
}

const API_BASE_URL = normalizeApiBaseUrl(
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_API_BASE_URL
    : undefined
);

export function getConfiguredApiBaseUrl(): string {
  return API_BASE_URL;
}

export function isJsonContentType(contentType?: string | null): boolean {
  if (!contentType) return false;
  return contentType.toLowerCase().includes("application/json");
}

async function parseVerifiedJson<T>(res: Response, endpointDesc: string): Promise<T> {
  const contentType = res.headers.get("content-type");
  if (!isJsonContentType(contentType)) {
    throw new Error(
      `Layanan backend Python (${endpointDesc}) belum terhubung pada host publik ini (server mengembalikan halaman statis HTML, bukan respons JSON API).`
    );
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(`Respons dari ${endpointDesc} bukan format JSON yang valid.`);
  }
}

/**
 * Pemeriksaan kesehatan layanan backend Python dengan timeout
 */
export async function checkBackendHealth(timeoutMs: number = 2500): Promise<{
  online: boolean;
  info: BackendHealthInfo | null;
  error?: string;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { online: false, info: null, error: `HTTP ${res.status}: ${res.statusText}` };
    }

    const contentType = res.headers.get("content-type");
    if (!isJsonContentType(contentType)) {
      return {
        online: false,
        info: null,
        error: "Host statis tidak menjalankan layanan backend Python (/api/v1/health mengembalikan HTML).",
      };
    }

    const data = (await res.json()) as BackendHealthInfo;
    const isValidHealth =
      Boolean(data) &&
      data.status === "online" &&
      typeof data.engine === "string" &&
      typeof data.supported_methods_count === "number";

    if (!isValidHealth) {
      return {
        online: false,
        info: null,
        error: "Respons /api/v1/health tidak sesuai kontrak backend Python ZoneFlow.",
      };
    }

    return { online: true, info: data };
  } catch (err: any) {
    clearTimeout(timer);
    const message =
      err.name === "AbortError"
        ? "Timeout menghubungkan ke backend Python"
        : err.message || "Gagal menghubungi server";
    return { online: false, info: null, error: message };
  }
}

/**
 * Mengambil katalog metode boarding dari Python
 */
export async function getBackendMethods(): Promise<BackendMethodItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/methods`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await parseVerifiedJson<{ methods?: BackendMethodItem[] }>(res, "/api/v1/methods");
    return Array.isArray(data?.methods) ? data.methods : [];
  } catch {
    return [];
  }
}

/**
 * Menjalankan satu replikasi simulasi pada backend Python asli
 */
export async function runPythonSimulation(
  payload: PythonSimulationRequest,
  timeoutMs: number = 10000
): Promise<PythonSimulationResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE_URL}/simulate`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    clearTimeout(timer);

    if (!res.ok) {
      let detailMsg = `HTTP ${res.status}`;
      try {
        if (isJsonContentType(res.headers.get("content-type"))) {
          const errJson = await res.json();
          if (errJson.detail) {
            detailMsg = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
          }
        }
      } catch {
        // no json body
      }
      throw new Error(detailMsg);
    }

    const data = await parseVerifiedJson<PythonSimulationResponse>(res, "/api/v1/simulate");
    if (
      !data ||
      !data.metrics ||
      typeof data.metrics.boarding_time_seconds !== "number" ||
      !Array.isArray(data.timeline_details)
    ) {
      throw new Error("Respons simulasi dari server tidak memuat data metrik atau timeline penumpang yang valid.");
    }
    return data;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new Error("Permintaan simulasi ke backend Python melebihi batas waktu (timeout).");
    }
    throw err;
  }
}

// ============================================================================
// Batch Simulation Types & Client (Tahap 5A)
// ============================================================================

export interface MetricStats {
  mean: number;
  std: number;
  median: number;
  min: number;
  max: number;
  ci95_low: number;
  ci95_high: number;
  margin_of_error: number;
}

export interface MinMaxMeanStats {
  mean: number;
  min: number;
  max: number;
}

export interface BatchStatistics {
  boarding_time_seconds: MetricStats;
  boarding_time_minutes: MetricStats;
  aisle_interference_events: MinMaxMeanStats;
  aggregate_aisle_wait_person_seconds: MinMaxMeanStats;
  seat_interference_events: MinMaxMeanStats;
  occupied_blocker_count: MinMaxMeanStats;
  baggage_count: MinMaxMeanStats;
}

export interface ReplicationRecord {
  replication_id: number;
  seed: number;
  boarding_time_seconds: number;
  boarding_time_minutes: number;
  aisle_interference_events: number;
  aggregate_aisle_wait_person_seconds: number;
  seat_interference_events: number;
  occupied_blocker_count: number;
  baggage_count: number;
  passenger_count: number;
}

export interface PythonBatchSimulationRequest {
  method: string;
  baggage_ratio: number;
  replications: number;
  base_seed: number;
  load_factor?: number;
  parameters?: {
    walk_per_row_s?: number;
    entry_gap_s?: number;
    aisle_headway_s?: number;
    sit_time_s?: number;
    weibull_scale_s?: number;
    weibull_shape?: number;
    moves_one_blocker?: number;
    moves_two_blockers?: number;
  };
  custom_zone_config?: {
    boundaries: number[];
    zone_order: number[];
  };
}

export interface PythonBatchSimulationResponse {
  status: string;
  engine: string;
  method: string;
  baggage_ratio: number;
  baggage_percent: number;
  base_seed: number;
  requested_replications: number;
  successful_replications: number;
  failed_replications: number;
  execution_time_ms: number;
  statistics: BatchStatistics;
  replications_data: ReplicationRecord[];
}

/**
 * Menjalankan sejumlah 10–100 replikasi simulasi pada backend Python asli (Batch Simulator)
 */
export async function runPythonBatchSimulation(
  payload: PythonBatchSimulationRequest,
  timeoutMs: number = 30000,
  externalSignal?: AbortSignal
): Promise<PythonBatchSimulationResponse> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      throw new DOMException("Eksekusi batch simulasi dibatalkan oleh pengguna.", "AbortError");
    }
    externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  try {
    const res = await fetch(`${API_BASE_URL}/simulate/batch`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    clearTimeout(timer);

    if (!res.ok) {
      let detailMsg = `HTTP ${res.status}`;
      try {
        if (isJsonContentType(res.headers.get("content-type"))) {
          const errJson = await res.json();
          if (errJson.detail) {
            detailMsg = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
          }
        }
      } catch {
        // no json body
      }
      throw new Error(detailMsg);
    }

    const data = await parseVerifiedJson<PythonBatchSimulationResponse>(res, "/api/v1/simulate/batch");
    if (!data || !data.statistics || !Array.isArray(data.replications_data)) {
      throw new Error("Respons batch simulasi tidak memuat statistik atau data replikasi yang valid.");
    }
    return data;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      if (externalSignal?.aborted && !timedOut) {
        throw new DOMException("Eksekusi batch simulasi dibatalkan oleh pengguna.", "AbortError");
      }
      throw new Error("Permintaan batch simulasi ke backend Python melebihi batas waktu (timeout).");
    }
    throw err;
  } finally {
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}

// ============================================================================
// Types & API Methods untuk Exhaustive Search 546 Kandidat (Tahap 5B-1)
// ============================================================================

export interface CandidateConfig {
  candidate_id: number;
  zone_boundaries: number[];
  zone_sizes: number[];
  zone_order: number[];
  training_fitness_seconds: number;
  training_fitness_minutes: number;
}

export interface TrainingConfig {
  k_zones: number;
  min_rows_per_zone: number;
  max_rows_per_zone: number;
  baggage_ratios: number[];
  replications_per_ratio: number;
  total_training_batches: number;
  base_seed: number;
}

export interface StoredReference {
  boundaries: number[];
  sizes: number[];
  order: number[];
  expected_fitness_seconds: number;
  expected_fitness_minutes: number;
}

export interface ExhaustiveJobStatus {
  job_id: string;
  status: "running" | "completed" | "cancelled" | "failed";
  progress_percent: number;
  evaluated_candidates: number;
  total_candidates: number;
  elapsed_time_seconds: number;
  best_candidate?: CandidateConfig | null;
  matches_stored_optimum?: boolean | null;
  stored_reference?: StoredReference | null;
  training_config?: TrainingConfig | null;
  execution_time_seconds?: number | null;
  top_candidates?: CandidateConfig[] | null;
  error_message?: string | null;
}

export interface ExhaustiveCandidatesCatalog {
  total_candidates: number;
  total_partitions: number;
  total_permutations: number;
  sample_candidates: Array<{
    candidate_id: number;
    boundaries: number[];
    zone_sizes: number[];
    zone_order: number[];
  }>;
}

async function fetchJsonWithTimeout<T>(
  url: string,
  options: RequestInit,
  timeoutMs: number = 15000,
  timeoutLabel: string = "Permintaan optimasi ke backend Python melebihi batas waktu (timeout)."
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      let detailMsg = `HTTP ${res.status}`;
      try {
        if (isJsonContentType(res.headers.get("content-type"))) {
          const errJson = await res.json();
          if (errJson.detail) {
            detailMsg = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
          }
        }
      } catch {
        // no json body
      }
      throw new Error(detailMsg);
    }

    return await parseVerifiedJson<T>(res, url);
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new Error(timeoutLabel);
    }
    throw err;
  }
}

/**
 * Memulai pekerjaan Exhaustive Search nyata untuk seluruh 546 kandidat pada backend Python
 */
export async function startExhaustiveSearch(
  baseSeed: number = 20261021,
  timeoutMs: number = 15000
): Promise<ExhaustiveJobStatus> {
  return fetchJsonWithTimeout<ExhaustiveJobStatus>(
    `${API_BASE_URL}/optimize/exhaustive`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ base_seed: baseSeed }),
    },
    timeoutMs,
    "Permintaan memulai Exhaustive Search melebihi batas waktu (timeout)."
  );
}

/**
 * Mengambil status kemajuan dan hasil pekerjaan Exhaustive Search
 */
export async function getExhaustiveJobStatus(
  jobId: string,
  timeoutMs: number = 15000
): Promise<ExhaustiveJobStatus> {
  return fetchJsonWithTimeout<ExhaustiveJobStatus>(
    `${API_BASE_URL}/optimize/exhaustive/status/${jobId}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    },
    timeoutMs,
    "Pemeriksaan status Exhaustive Search melebihi batas waktu (timeout)."
  );
}

/**
 * Membatalkan pekerjaan Exhaustive Search yang sedang berjalan
 */
export async function cancelExhaustiveJob(
  jobId: string,
  timeoutMs: number = 10000
): Promise<any> {
  return fetchJsonWithTimeout<any>(
    `${API_BASE_URL}/optimize/exhaustive/cancel/${jobId}`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    },
    timeoutMs,
    "Permintaan pembatalan Exhaustive Search melebihi batas waktu (timeout)."
  );
}

/**
 * Mengambil katalog 546 kandidat partisi dan urutan zona
 */
export async function getExhaustiveCandidatesCatalog(
  timeoutMs: number = 10000
): Promise<ExhaustiveCandidatesCatalog> {
  const data = await fetchJsonWithTimeout<ExhaustiveCandidatesCatalog>(
    `${API_BASE_URL}/optimize/exhaustive/candidates`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    },
    timeoutMs,
    "Pengambilan katalog kandidat Exhaustive Search melebihi batas waktu (timeout)."
  );
  if (!data || !Array.isArray(data.sample_candidates)) {
    throw new Error("Respons katalog kandidat tidak memuat daftar sample_candidates yang valid.");
  }
  return data;
}

// ============================================================================
// Types & API Methods untuk Genetic Algorithm Dinamis (Tahap 5B-2)
// ============================================================================

export interface GAStartPayload {
  population_size: number;
  generations: number;
  elite_count: number;
  mutation_rate: number;
  tournament_size: number;
  ga_seed: number;
  base_seed: number;
}

export interface GAParameters {
  population_size: number;
  generations: number;
  elite_count: number;
  mutation_rate: number;
  tournament_size: number;
  ga_seed: number;
  training_base_seed: number;
}

export interface GAGenerationRecord {
  generation: number;
  best_fitness_seconds: number;
  best_fitness_minutes: number;
  generation_best_fitness_seconds: number;
  mean_fitness_seconds: number;
  mean_fitness_minutes: number;
  worst_fitness_seconds: number;
  best_boundaries: number[];
  best_sizes: number[];
  best_order: number[];
  unique_candidates_evaluated: number;
}

export interface ExhaustiveComparison {
  is_exhaustive_optimum_verified: boolean;
  comparison_type: "exhaustive_optimum" | "reference_chromosome" | string;
  comparison_label: string;
  reference_label: string;
  matches_reference_chromosome: boolean;
  exhaustive_boundaries: number[];
  exhaustive_sizes: number[];
  exhaustive_order: number[];
  exhaustive_fitness_seconds: number;
  exhaustive_fitness_minutes: number;
  fitness_gap_seconds: number;
  fitness_gap_percent: number;
  exhaustive_candidates_evaluated: number;
  ga_unique_candidates_evaluated: number;
}

export interface GAJobStatus {
  job_id: string;
  status: "running" | "completed" | "cancelled" | "failed";
  progress_percent: number;
  current_generation: number;
  total_generations: number;
  unique_candidates_evaluated: number;
  total_chromosome_evaluations: number;
  search_space_size: number;
  evaluation_reduction_percent?: number | null;
  elapsed_time_seconds: number;
  best_candidate?: CandidateConfig | null;
  matches_exhaustive_optimum?: boolean | null;
  ga_parameters?: GAParameters | null;
  exhaustive_comparison?: ExhaustiveComparison | null;
  training_config?: TrainingConfig | null;
  generation_history: GAGenerationRecord[];
  top_candidates?: CandidateConfig[] | null;
  execution_time_seconds?: number | null;
  error_message?: string | null;
}

/**
 * Memulai pekerjaan optimasi Genetic Algorithm (GA-Zone-WMA) pada backend Python
 */
export async function startGAOptimization(
  payload: GAStartPayload,
  timeoutMs: number = 15000
): Promise<GAJobStatus> {
  return fetchJsonWithTimeout<GAJobStatus>(
    `${API_BASE_URL}/optimize/ga`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    },
    timeoutMs,
    "Permintaan memulai optimasi GA melebihi batas waktu (timeout)."
  );
}

/**
 * Mengambil status kemajuan evolusi per generasi dan hasil akhir optimasi GA
 */
export async function getGAJobStatus(
  jobId: string,
  timeoutMs: number = 15000
): Promise<GAJobStatus> {
  return fetchJsonWithTimeout<GAJobStatus>(
    `${API_BASE_URL}/optimize/ga/status/${jobId}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    },
    timeoutMs,
    "Pemeriksaan status optimasi GA melebihi batas waktu (timeout)."
  );
}

/**
 * Membatalkan pekerjaan optimasi GA yang sedang berjalan
 */
export async function cancelGAJob(
  jobId: string,
  timeoutMs: number = 10000
): Promise<any> {
  return fetchJsonWithTimeout<any>(
    `${API_BASE_URL}/optimize/ga/cancel/${jobId}`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    },
    timeoutMs,
    "Permintaan pembatalan optimasi GA melebihi batas waktu (timeout)."
  );
}


