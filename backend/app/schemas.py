"""
Pydantic Request & Response Schemas for ZoneFlow API.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator, model_validator


class SimulationParameters(BaseModel):
    walk_per_row_s: float = Field(default=2.4, ge=0.5, le=10.0, description="Waktu jalan per baris dalam detik")
    entry_gap_s: float = Field(default=1.0, ge=0.1, le=10.0, description="Jeda kedatangan antarpenumpang dalam detik")
    aisle_headway_s: float = Field(default=1.0, ge=0.1, le=10.0, description="Headway lorong per baris dalam detik")
    sit_time_s: float = Field(default=2.0, ge=0.0, le=20.0, description="Waktu duduk dasar dalam detik")
    weibull_scale_s: float = Field(default=16.0, ge=1.0, le=60.0, description="Scale parameter Weibull untuk bagasi")
    weibull_shape: float = Field(default=1.7, ge=0.5, le=5.0, description="Shape parameter Weibull untuk bagasi")
    moves_one_blocker: int = Field(default=5, ge=0, le=20, description="Jumlah gerakan saat 1 blocker")
    moves_two_blockers: int = Field(default=9, ge=0, le=40, description="Jumlah gerakan saat 2 blocker")


class CustomZoneConfig(BaseModel):
    boundaries: List[int] = Field(..., min_length=0, max_length=29, description="Titik batas baris menaik [b1, ..., b_{K-1}]")
    zone_order: List[int] = Field(..., min_length=1, max_length=30, description="Permutasi ID zona [z1, ..., zK]")
    internal_rule: Optional[str] = Field(default="WMA_IN_ZONE", description="Aturan urutan di dalam zona ('WMA_IN_ZONE' atau 'BTF_IN_ZONE')")

    @field_validator("boundaries")
    @classmethod
    def validate_boundaries(cls, v: List[int]) -> List[int]:
        for idx, b in enumerate(v):
            if not (1 <= b < 30):
                raise ValueError("Batas baris harus berada di dalam rentang baris 1-29")
            if idx > 0 and b <= v[idx - 1]:
                raise ValueError("Batas baris harus menaik secara ketat")
        return v

    @model_validator(mode="after")
    def validate_order(self) -> "CustomZoneConfig":
        k_zones = len(self.boundaries) + 1
        if sorted(self.zone_order) != list(range(1, k_zones + 1)):
            raise ValueError(f"Urutan zona harus merupakan permutasi dari 1..{k_zones}")
        return self


class SimulateRequest(BaseModel):
    method: str = Field(default="Back-to-Front-WILMA", description="Nama metode boarding yang didukung")
    baggage_ratio: float = Field(default=0.60, ge=0.0, le=1.0, description="Rasio penumpang membawa bagasi (0.0 - 1.0)")
    load_factor: float = Field(default=1.0, gt=0.0, le=1.0, description="Seat occupancy load factor (0.0 - 1.0]")
    seed: int = Field(default=20261021, ge=0, description="Random seed untuk determinisme")
    parameters: Optional[SimulationParameters] = Field(default_factory=SimulationParameters)
    custom_zone_config: Optional[CustomZoneConfig] = None


class AisleTransitSegmentModel(BaseModel):
    row: int
    enter_s: float
    leave_s: float
    is_target_row: bool


class PassengerTimelineModel(BaseModel):
    queue_position: int
    seat_id: str
    row: int
    seat: str
    has_bag: bool
    entry_time_s: float
    arrival_target_s: float
    aisle_wait_s: float
    occupied_blockers: int
    seat_interference_s: float
    bag_stowage_s: float
    finish_time_s: float
    aisle_transit: List[AisleTransitSegmentModel]


class SimulationMetricsModel(BaseModel):
    boarding_time_seconds: float
    boarding_time_minutes: float
    aisle_interference_events: int
    aggregate_aisle_wait_person_seconds: float
    aisle_wait_seconds: float
    seat_interference_events: int
    occupied_blocker_count: int
    baggage_count: int
    passenger_count: int


class SimulateResponse(BaseModel):
    status: str = "success"
    engine: str = "Python Backend Engine (FastAPI / Core v3)"
    method: str
    baggage_ratio: float
    baggage_percent: int
    seed: int
    execution_time_ms: float
    metrics: SimulationMetricsModel
    timeline_details: List[PassengerTimelineModel]


class HealthResponse(BaseModel):
    status: str
    engine: str
    version: str
    python_version: str
    supported_methods_count: int


class MethodItemModel(BaseModel):
    id: str
    name: str
    category: str
    description: str
    note: str


class MethodsResponse(BaseModel):
    status: str
    count: int
    methods: List[MethodItemModel]


# ============================================================================
# Schemas untuk Batch Simulation & Analisis Statistik (Tahap 5A)
# ============================================================================

class BatchSimulateRequest(BaseModel):
    method: str = Field(default="Back-to-Front-WILMA", description="Nama metode boarding yang didukung")
    baggage_ratio: float = Field(default=0.60, ge=0.0, le=1.0, description="Rasio penumpang membawa bagasi (0.0 - 1.0)")
    replications: int = Field(default=30, ge=10, le=100, description="Jumlah replikasi simulasi (10–100)")
    base_seed: int = Field(default=20261021, ge=0, description="Random seed dasar untuk urutan replikasi deterministik")
    load_factor: float = Field(default=1.0, gt=0.0, le=1.0, description="Seat occupancy load factor (0.0 - 1.0]")
    parameters: Optional[SimulationParameters] = Field(default_factory=SimulationParameters)
    custom_zone_config: Optional[CustomZoneConfig] = None


class ReplicationRecordModel(BaseModel):
    replication_id: int
    seed: int
    boarding_time_seconds: float
    boarding_time_minutes: float
    aisle_interference_events: int
    aggregate_aisle_wait_person_seconds: float
    seat_interference_events: int
    occupied_blocker_count: int
    baggage_count: int
    passenger_count: int


class MetricStatsModel(BaseModel):
    mean: float
    std: float
    median: float
    min: float
    max: float
    ci95_low: float
    ci95_high: float
    margin_of_error: float


class InterferenceStatsModel(BaseModel):
    mean: float
    min: float
    max: float


class BatchStatisticsModel(BaseModel):
    boarding_time_seconds: MetricStatsModel
    boarding_time_minutes: MetricStatsModel
    aisle_interference_events: InterferenceStatsModel
    aggregate_aisle_wait_person_seconds: InterferenceStatsModel
    seat_interference_events: InterferenceStatsModel
    occupied_blocker_count: InterferenceStatsModel
    baggage_count: InterferenceStatsModel


class BatchSimulateResponse(BaseModel):
    status: str = "success"
    engine: str = "Python Backend Engine (FastAPI / Core v3 Batch Simulator)"
    method: str
    baggage_ratio: float
    baggage_percent: int
    base_seed: int
    requested_replications: int
    successful_replications: int
    failed_replications: int
    execution_time_ms: float
    statistics: BatchStatisticsModel
    replications_data: List[ReplicationRecordModel]


# ============================================================================
# Schemas untuk Exhaustive Search & Optimasi Dinamis (Tahap 5B-1)
# ============================================================================

class ExhaustiveStartRequest(BaseModel):
    base_seed: int = Field(default=20261021, ge=0, description="Seed dasar untuk 15 batch pelatihan")


class CandidateConfigModel(BaseModel):
    candidate_id: int
    zone_boundaries: List[int]
    zone_sizes: List[int]
    zone_order: List[int]
    training_fitness_seconds: float
    training_fitness_minutes: float


class TrainingConfigModel(BaseModel):
    k_zones: int
    min_rows_per_zone: int
    max_rows_per_zone: int
    baggage_ratios: List[float]
    replications_per_ratio: int
    total_training_batches: int
    base_seed: int


class StoredReferenceModel(BaseModel):
    boundaries: List[int]
    sizes: List[int]
    order: List[int]
    expected_fitness_seconds: float
    expected_fitness_minutes: float


class ExhaustiveJobStatusResponse(BaseModel):
    job_id: str
    status: str = Field(description="'running', 'completed', 'cancelled', or 'failed'")
    progress_percent: float = 0.0
    evaluated_candidates: int = 0
    total_candidates: int = 546
    elapsed_time_seconds: float = 0.0
    best_candidate: Optional[CandidateConfigModel] = None
    matches_stored_optimum: Optional[bool] = None
    stored_reference: Optional[StoredReferenceModel] = None
    training_config: Optional[TrainingConfigModel] = None
    execution_time_seconds: Optional[float] = None
    top_candidates: Optional[List[CandidateConfigModel]] = None
    error_message: Optional[str] = None


class ExhaustiveCandidatesResponse(BaseModel):
    total_candidates: int
    total_partitions: int
    total_permutations: int
    sample_candidates: List[Dict[str, Any]]


# ============================================================================
# Schemas untuk Genetic Algorithm (GA-Zone-WMA) Dinamis (Tahap 5B-2)
# ============================================================================

class GAStartRequest(BaseModel):
    population_size: int = Field(default=24, ge=6, le=100, description="Ukuran populasi GA per generasi (default riset: 24)")
    generations: int = Field(default=20, ge=1, le=100, description="Jumlah generasi evolusi GA (default riset: 20)")
    elite_count: int = Field(default=2, ge=0, le=20, description="Jumlah individu elit yang dipertahankan (default riset: 2)")
    mutation_rate: float = Field(default=0.30, ge=0.0, le=1.0, description="Laju mutasi kromosom (default riset: 0.30)")
    tournament_size: int = Field(default=3, ge=2, le=10, description="Ukuran turnamen seleksi (default riset: 3)")
    ga_seed: int = Field(default=20262020, ge=0, description="Seed RNG proses evolusi GA (default riset: BASE_SEED + 999 = 20262020)")
    base_seed: int = Field(default=20261021, ge=0, description="Seed dasar untuk 15 batch pelatihan")


class GAParametersModel(BaseModel):
    population_size: int
    generations: int
    elite_count: int
    mutation_rate: float
    tournament_size: int
    ga_seed: int
    training_base_seed: int


class GAGenerationRecordModel(BaseModel):
    generation: int
    best_fitness_seconds: float
    best_fitness_minutes: float
    generation_best_fitness_seconds: float
    mean_fitness_seconds: float
    mean_fitness_minutes: float
    worst_fitness_seconds: float
    best_boundaries: List[int]
    best_sizes: List[int]
    best_order: List[int]
    unique_candidates_evaluated: int


class ExhaustiveComparisonModel(BaseModel):
    is_exhaustive_optimum_verified: bool = True
    comparison_type: str = "exhaustive_optimum"
    comparison_label: str = "Gap terhadap Exhaustive Optimum"
    reference_label: str = "Exhaustive-Zone-WMA (Audit Eksak)"
    matches_reference_chromosome: bool = False
    exhaustive_boundaries: List[int]
    exhaustive_sizes: List[int]
    exhaustive_order: List[int]
    exhaustive_fitness_seconds: float
    exhaustive_fitness_minutes: float
    fitness_gap_seconds: float
    fitness_gap_percent: float
    exhaustive_candidates_evaluated: int
    ga_unique_candidates_evaluated: int


class GAJobStatusResponse(BaseModel):
    job_id: str
    status: str = Field(description="'running', 'completed', 'cancelled', or 'failed'")
    progress_percent: float = 0.0
    current_generation: int = 0
    total_generations: int = 20
    unique_candidates_evaluated: int = 0
    total_chromosome_evaluations: int = 0
    search_space_size: int = 546
    evaluation_reduction_percent: Optional[float] = None
    elapsed_time_seconds: float = 0.0
    best_candidate: Optional[CandidateConfigModel] = None
    matches_exhaustive_optimum: Optional[bool] = None
    ga_parameters: Optional[GAParametersModel] = None
    exhaustive_comparison: Optional[ExhaustiveComparisonModel] = None
    training_config: Optional[TrainingConfigModel] = None
    generation_history: List[GAGenerationRecordModel] = Field(default_factory=list)
    top_candidates: Optional[List[CandidateConfigModel]] = None
    execution_time_seconds: Optional[float] = None
    error_message: Optional[str] = None


# ============================================================================
# Schemas untuk AZBO V2 (Blueprint AZBO & Audit ZoneFlow)
# ============================================================================

class AzboV2OptimizeRequest(BaseModel):
    layout_id: str = Field(default="b737-800-180", description="ID konfigurasi layout pesawat")
    layout_name: str = Field(default="Boeing 737-800 / Airbus A320-200", description="Nama layout pesawat")
    rows: int = Field(default=30, ge=1, le=80, description="Jumlah baris kabin (N)")
    left_seats: int = Field(default=3, ge=1, le=3, description="Jumlah kursi sisi kiri per baris")
    right_seats: int = Field(default=3, ge=1, le=3, description="Jumlah kursi sisi kanan per baris")
    left_letters: Optional[List[str]] = None
    right_letters: Optional[List[str]] = None
    bag_ratio: float = Field(default=0.70, ge=0.0, le=1.0, description="Proporsi penumpang membawa bagasi (0.0 - 1.0)")
    row_pitch_m: float = Field(default=0.8, gt=0.0, le=5.0, description="Jarak antarbaris (pitch) dalam meter")
    cell_m: float = Field(default=0.4, gt=0.0, le=5.0, description="Panjang satu sel lorong dalam meter")
    ga_population: int = Field(default=10, ge=4, le=100, description="Ukuran populasi GA variabel K")
    ga_generations: int = Field(default=5, ge=1, le=100, description="Jumlah generasi GA variabel K")
    train_reps: int = Field(default=3, ge=1, le=50, description="Jumlah replikasi TRAINING per kandidat GA")
    test_reps: int = Field(default=15, ge=2, le=200, description="Jumlah replikasi TESTING baru untuk evaluasi akhir")
    zone_call_overhead_s: float = Field(default=0.0, ge=0.0, le=120.0, description="Penundaan opsional pergantian zona (detik)")
    seed: int = Field(default=20261028, ge=0, description="Seed dasar untuk reproduksibilitas")

    @model_validator(mode="before")
    @classmethod
    def normalize_request_aliases(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        if "rows" not in normalized and "n_rows" in normalized:
            normalized["rows"] = normalized.pop("n_rows")
        if isinstance(normalized.get("left_seats"), list):
            letters = [str(x) for x in normalized["left_seats"]]
            normalized["left_letters"] = normalized.get("left_letters") or letters
            normalized["left_seats"] = len(letters)
        if isinstance(normalized.get("right_seats"), list):
            letters = [str(x) for x in normalized["right_seats"]]
            normalized["right_letters"] = normalized.get("right_letters") or letters
            normalized["right_seats"] = len(letters)
        if "ga_population" not in normalized:
            if "population_size" in normalized:
                normalized["ga_population"] = normalized.pop("population_size")
            elif "pop_size" in normalized:
                normalized["ga_population"] = normalized.pop("pop_size")
        if "ga_generations" not in normalized and "generations" in normalized:
            normalized["ga_generations"] = normalized.pop("generations")
        if "train_reps" not in normalized and "train_replications" in normalized:
            normalized["train_reps"] = normalized.pop("train_replications")
        if "test_reps" not in normalized and "test_replications" in normalized:
            normalized["test_reps"] = normalized.pop("test_replications")
        if "seed" not in normalized and "base_seed" in normalized:
            normalized["seed"] = normalized.pop("base_seed")
        return normalized


class AzboV2HealthResponse(BaseModel):
    status: str = "online"
    engine: str = "AZBO V2 Python Engine (azbo_core)"
    version: str = "2.0.0"
    supported_strategies: List[str] = [
        "ZONE",
        "WMA",
        "BTF",
        "RANDOM",
        "REVERSE_PYRAMID",
        "STEFFEN",
        "ROTATING_ZONES",
        "MODIFIED_OPTIMAL",
        "FRONT_TO_BACK",
        "BLOCKS_4_ROWS",
        "DOUBLE_OUTSIDE_IN",
        "BTF_WMA_FIXED",
    ]


class AzboV2OptimizeResponse(BaseModel):
    status: str = "success"
    engine: str = "AZBO V2 Python Engine (azbo_core)"
    execution_time_seconds: float
    scenario: Dict[str, Any]
    optimization: Dict[str, Any]
    recommendation: Dict[str, Any]
    animation: Dict[str, Any]


class AzboV2JobStatusResponse(BaseModel):
    job_id: str
    status: str = Field(description="'running', 'completed', 'cancelled', or 'failed'")
    progress_percent: float = 0.0
    progress_message: str = "Mempersiapkan simulasi..."
    elapsed_time_seconds: float = 0.0
    result: Optional[AzboV2OptimizeResponse] = None
    error_message: Optional[str] = None



