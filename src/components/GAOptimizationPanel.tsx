import React, { useState, useEffect, useRef } from "react";
import {
  Dna,
  Play,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Clock,
  Layers,
  Award,
  BarChart3,
  XCircle,
  RefreshCw,
  TrendingDown,
  GitCompare,
  ExternalLink,
  Sliders,
} from "lucide-react";
import {
  startGAOptimization,
  getGAJobStatus,
  cancelGAJob,
  GAJobStatus,
  GAGenerationRecord,
} from "../services/apiClient";

interface GAOptimizationPanelProps {
  backendOnline: boolean;
  onRecheckBackend: () => void;
}

const DEFAULT_RESEARCH_PARAMS = {
  population_size: 24,
  generations: 20,
  elite_count: 2,
  mutation_rate: 0.3,
  tournament_size: 3,
  ga_seed: 20262020,
  base_seed: 20261021,
};

export const GAOptimizationPanel: React.FC<GAOptimizationPanelProps> = ({
  backendOnline,
  onRecheckBackend,
}) => {
  const [populationSize, setPopulationSize] = useState<number>(DEFAULT_RESEARCH_PARAMS.population_size);
  const [generations, setGenerations] = useState<number>(DEFAULT_RESEARCH_PARAMS.generations);
  const [eliteCount, setEliteCount] = useState<number>(DEFAULT_RESEARCH_PARAMS.elite_count);
  const [mutationRate, setMutationRate] = useState<number>(DEFAULT_RESEARCH_PARAMS.mutation_rate);
  const [tournamentSize, setTournamentSize] = useState<number>(DEFAULT_RESEARCH_PARAMS.tournament_size);
  const [gaSeed, setGaSeed] = useState<number>(DEFAULT_RESEARCH_PARAMS.ga_seed);
  const [baseSeed, setBaseSeed] = useState<number>(DEFAULT_RESEARCH_PARAMS.base_seed);

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<GAJobStatus | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<"generations" | "top_candidates">("generations");

  const pollIntervalRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const startPolling = (id: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const status = await getGAJobStatus(id);
        setJobStatus(status);

        if (
          status.status === "completed" ||
          status.status === "cancelled" ||
          status.status === "failed"
        ) {
          setIsRunning(false);
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          if (status.status === "failed") {
            setError(status.error_message || "Pekerjaan optimasi GA gagal di server backend Python.");
          }
        }
      } catch (err: any) {
        console.warn("Gagal polling status optimasi GA:", err);
      }
    }, 600);
  };

  const handleResetDefaults = () => {
    setPopulationSize(DEFAULT_RESEARCH_PARAMS.population_size);
    setGenerations(DEFAULT_RESEARCH_PARAMS.generations);
    setEliteCount(DEFAULT_RESEARCH_PARAMS.elite_count);
    setMutationRate(DEFAULT_RESEARCH_PARAMS.mutation_rate);
    setTournamentSize(DEFAULT_RESEARCH_PARAMS.tournament_size);
    setGaSeed(DEFAULT_RESEARCH_PARAMS.ga_seed);
    setBaseSeed(DEFAULT_RESEARCH_PARAMS.base_seed);
    setError(null);
  };

  const handleStartGA = async () => {
    if (!backendOnline) {
      setError(
        "Layanan Python Backend Offline. Optimasi Genetic Algorithm memerlukan eksekusi nyata pada Python Backend Engine."
      );
      return;
    }

    if (eliteCount >= populationSize) {
      setError(`Elitisme (${eliteCount}) harus lebih kecil dari ukuran populasi (${populationSize}).`);
      return;
    }
    if (tournamentSize > populationSize) {
      setError(`Ukuran turnamen (${tournamentSize}) tidak boleh melebihi ukuran populasi (${populationSize}).`);
      return;
    }

    setIsRunning(true);
    setError(null);
    setJobStatus(null);

    try {
      const response = await startGAOptimization({
        population_size: populationSize,
        generations,
        elite_count: eliteCount,
        mutation_rate: mutationRate,
        tournament_size: tournamentSize,
        ga_seed: gaSeed,
        base_seed: baseSeed,
      });
      setJobId(response.job_id);
      setJobStatus(response);
      startPolling(response.job_id);
    } catch (err: any) {
      setIsRunning(false);
      setError(err.message || "Gagal memulai optimasi GA di backend Python.");
    }
  };

  const handleCancel = async () => {
    if (!jobId) return;
    try {
      await cancelGAJob(jobId);
      setIsRunning(false);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setJobStatus((prev) => (prev ? { ...prev, status: "cancelled" } : null));
    } catch (err: any) {
      console.error("Gagal membatalkan pekerjaan GA:", err);
    }
  };

  const formatOrderName = (order: number[]) => {
    return order.map((z) => `Zona ${z}`).join(" → ");
  };

  // Render SVG Convergence Chart dari data generation_history nyata
  const renderFitnessConvergenceChart = (history: GAGenerationRecord[]) => {
    if (!history || history.length === 0) return null;

    const width = 760;
    const height = 250;
    const padLeft = 56;
    const padRight = 28;
    const padTop = 24;
    const padBottom = 38;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const allBest = history.map((h) => h.best_fitness_seconds);
    const allMean = history.map((h) => h.mean_fitness_seconds);
    const isVerifiedOptimum = jobStatus?.exhaustive_comparison
      ? jobStatus.exhaustive_comparison.is_exhaustive_optimum_verified
      : (jobStatus?.ga_parameters?.training_base_seed ?? baseSeed) === 20261021;
    const exhaustiveRef =
      jobStatus?.exhaustive_comparison?.exhaustive_fitness_seconds ??
      (isVerifiedOptimum ? 291.069 : null);

    const minY =
      (exhaustiveRef !== null ? Math.min(...allBest, exhaustiveRef) : Math.min(...allBest)) - 3;
    const maxY = Math.max(...allMean, ...allBest) + 6;
    const maxGen = Math.max(1, history[history.length - 1].generation, generations);

    const getX = (gen: number) => padLeft + (gen / maxGen) * plotW;
    const getY = (val: number) =>
      padTop + plotH - ((val - minY) / Math.max(1e-6, maxY - minY)) * plotH;

    const bestPoints = history.map((h) => `${getX(h.generation).toFixed(1)},${getY(h.best_fitness_seconds).toFixed(1)}`).join(" ");
    const meanPoints = history.map((h) => `${getX(h.generation).toFixed(1)},${getY(h.mean_fitness_seconds).toFixed(1)}`).join(" ");
    const refY = exhaustiveRef !== null ? getY(exhaustiveRef) : null;

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => minY + t * (maxY - minY));

    return (
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-[#086288]" />
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Kurva Evolusi Fitness per Generasi (Data Eksekusi Nyata Backend Python)
              </h4>
              <p className="text-xs text-slate-500">
                Melacak penurunan rata-rata waktu boarding (15 batch pelatihan) dari Generasi 0 hingga Generasi {history[history.length - 1].generation}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-full bg-[#086288]" />
              <span className="font-bold text-slate-700">Best Fitness (Elit)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-full bg-amber-500" />
              <span className="font-semibold text-slate-600">Mean Populasi</span>
            </div>
            {exhaustiveRef !== null && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-b-2 border-dashed border-emerald-600" />
                <span className="font-semibold text-emerald-700">
                  {isVerifiedOptimum
                    ? `Exhaustive Optimum (${exhaustiveRef.toFixed(3)}s)`
                    : `Kromosom Referensi [5, 18] (${exhaustiveRef.toFixed(3)}s)`}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto min-w-[540px] select-none"
          >
            {/* Grid lines Y */}
            {yTicks.map((val, i) => {
              const y = getY(val);
              return (
                <g key={i}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={width - padRight}
                    y2={y}
                    stroke="#f1f5f9"
                    strokeWidth="1"
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 3}
                    textAnchor="end"
                    className="text-[10px] fill-slate-400 font-mono"
                  >
                    {val.toFixed(0)}s
                  </text>
                </g>
              );
            })}

            {/* Garis Referensi (Exhaustive Optimum jika base_seed terverifikasi, atau Kromosom Referensi [5, 18]) */}
            {refY !== null && exhaustiveRef !== null && (
              <>
                <line
                  x1={padLeft}
                  y1={refY}
                  x2={width - padRight}
                  y2={refY}
                  stroke="#059669"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                />
                <text
                  x={width - padRight - 4}
                  y={refY - 5}
                  textAnchor="end"
                  className="text-[9px] fill-emerald-700 font-mono font-bold"
                >
                  {isVerifiedOptimum
                    ? `Exhaustive Optimum: ${exhaustiveRef.toFixed(3)}s`
                    : `Kromosom Referensi [5, 18]: ${exhaustiveRef.toFixed(3)}s`}
                </text>
              </>
            )}

            {/* Kurva Mean Fitness Populasi */}
            {history.length > 1 && (
              <polyline
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeDasharray="3 3"
                points={meanPoints}
              />
            )}

            {/* Kurva Best Fitness */}
            {history.length > 1 && (
              <polyline
                fill="none"
                stroke="#086288"
                strokeWidth="3"
                points={bestPoints}
              />
            )}

            {/* Titik per Generasi */}
            {history.map((h) => {
              const cx = getX(h.generation);
              const cyBest = getY(h.best_fitness_seconds);
              const cyMean = getY(h.mean_fitness_seconds);
              return (
                <g key={h.generation}>
                  <circle
                    cx={cx}
                    cy={cyMean}
                    r="3"
                    fill="#f59e0b"
                  >
                    <title>
                      {`Gen ${h.generation} • Mean Populasi: ${h.mean_fitness_seconds.toFixed(3)}s (${h.mean_fitness_minutes.toFixed(3)}m)`}
                    </title>
                  </circle>
                  <circle
                    cx={cx}
                    cy={cyBest}
                    r="4"
                    fill="#086288"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  >
                    <title>
                      {`Gen ${h.generation} • Best Fitness: ${h.best_fitness_seconds.toFixed(3)}s (${h.best_fitness_minutes.toFixed(3)}m) • Batas [${h.best_boundaries.join(", ")}] Urutan [${h.best_order.join(", ")}]`}
                    </title>
                  </circle>
                  {(h.generation % Math.max(1, Math.floor(maxGen / 10)) === 0 ||
                    h.generation === maxGen) && (
                    <text
                      x={cx}
                      y={height - 12}
                      textAnchor="middle"
                      className="text-[10px] fill-slate-500 font-mono"
                    >
                      G{h.generation}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Banner Identitas & Scope */}
      <div className="bg-gradient-to-r from-sky-900/10 via-indigo-900/5 to-slate-900/10 rounded-3xl p-6 border border-sky-500/20 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#086288]/10 border border-[#086288]/30 text-[#086288] flex items-center justify-center shrink-0">
            <Dna className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-[#086288] bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-full">
                Tahap 5B-2 • Dynamic Evolutionary Search
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Hasil Optimasi Dinamis — Python Backend
              </span>
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              Optimasi Genetic Algorithm Dinamis (GA-Zone-WMA)
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
              Menjalankan evolusi populasi kromosom batas zona dan urutan pemanggilan secara nyata di backend Python (Cell 8 & Cell 9 script penelitian). Menggunakan seleksi turnamen, uniform crossover dengan proyeksi Euclidean (repair ukuran zona), mutasi L1-neighbor, dan elitisme.
            </p>
          </div>
        </div>

        {/* Status Backend */}
        <div className="flex items-center gap-2 shrink-0">
          {backendOnline ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Python Backend Siap
            </div>
          ) : (
            <button
              onClick={onRecheckBackend}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold hover:bg-rose-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Backend Offline (Cek Ulang)
            </button>
          )}
        </div>
      </div>

      {/* Notice Pemisahan Data Benchmark */}
      <div className="p-4 rounded-2xl bg-sky-50/80 border border-sky-100 text-xs text-sky-900 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-[#086288] shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Pemisahan Data & Metodologi:</strong> Seluruh hasil pada panel ini diberi label{" "}
          <span className="font-mono font-bold bg-sky-100/70 text-[#086288] px-1 py-0.5 rounded">
            Hasil Optimasi Dinamis — Python Backend
          </span>
          . Fitness dievaluasi pada <strong>15 batch pelatihan</strong> (5 replikasi × 3 level bagasi 50%, 60%, 70%). Dataset benchmark historis 100 replikasi tersimpan (di mana <strong>Back-to-Front-WILMA</strong> tetap peringkat #1 secara keseluruhan) tidak diubah.
        </div>
      </div>

      {/* Form Parameter Konfigurasi GA */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-[#086288]" />
            <div>
              <h4 className="text-base font-bold text-slate-900">
                Parameter Evolusi Genetic Algorithm (Konfigurasi Penelitian)
              </h4>
              <p className="text-xs text-slate-500">
                Default disesuaikan dengan script penelitian asli: Populasi 24, Generasi 20, Elitisme 2, Mutasi 0.30, Turnamen 3, GA Seed 20262020.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleResetDefaults}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
              title="Kembalikan ke parameter penelitian asli"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Parameter Riset
            </button>

            {isRunning ? (
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                Batalkan Optimasi GA
              </button>
            ) : (
              <button
                onClick={handleStartGA}
                disabled={!backendOnline}
                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#086288] hover:bg-[#064e6d] disabled:bg-slate-300 text-white font-bold text-xs shadow-md shadow-sky-900/10 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                Mulai Optimasi GA (Python Backend)
              </button>
            )}
          </div>
        </div>

        {/* Grid Input Parameter GA */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-600">
              Ukuran Populasi (6–100)
            </label>
            <input
              type="number"
              min={6}
              max={100}
              disabled={isRunning}
              value={populationSize}
              onChange={(e) => setPopulationSize(Math.max(6, Math.min(100, parseInt(e.target.value) || 24)))}
              className="px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#086288] disabled:opacity-50"
            />
            <span className="text-[10px] text-slate-400">Default riset: 24</span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-600">
              Jumlah Generasi (1–100)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              disabled={isRunning}
              value={generations}
              onChange={(e) => setGenerations(Math.max(1, Math.min(100, parseInt(e.target.value) || 20)))}
              className="px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#086288] disabled:opacity-50"
            />
            <span className="text-[10px] text-slate-400">Default riset: 20</span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-600">
              Laju Mutasi (0.0–1.0)
            </label>
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              disabled={isRunning}
              value={mutationRate}
              onChange={(e) => setMutationRate(Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)))}
              className="px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#086288] disabled:opacity-50"
            />
            <span className="text-[10px] text-slate-400">Default riset: 0.30</span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-600">
              Individu Elit (0–10)
            </label>
            <input
              type="number"
              min={0}
              max={10}
              disabled={isRunning}
              value={eliteCount}
              onChange={(e) => setEliteCount(Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))}
              className="px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#086288] disabled:opacity-50"
            />
            <span className="text-[10px] text-slate-400">Default riset: 2</span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-600">
              Ukuran Turnamen (2–10)
            </label>
            <input
              type="number"
              min={2}
              max={10}
              disabled={isRunning}
              value={tournamentSize}
              onChange={(e) => setTournamentSize(Math.max(2, Math.min(10, parseInt(e.target.value) || 3)))}
              className="px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#086288] disabled:opacity-50"
            />
            <span className="text-[10px] text-slate-400">Default riset: 3</span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-600">
              Random Seed GA
            </label>
            <input
              type="number"
              disabled={isRunning}
              value={gaSeed}
              onChange={(e) => setGaSeed(parseInt(e.target.value) || 0)}
              className="px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#086288] disabled:opacity-50"
            />
            <span className="text-[10px] text-slate-400">Riset: 20262020</span>
          </div>
        </div>

        {/* Live Progress Indicator saat berjalan */}
        {isRunning && jobStatus && (
          <div className="p-5 rounded-2xl bg-sky-50/90 border border-sky-200 flex flex-col gap-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-[#086288] animate-spin" />
                <span className="text-xs font-bold text-slate-900">
                  Evolusi Populasi GA Sedang Berjalan di Python Backend...
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono font-bold text-[#086288]">
                <span>
                  Generasi {jobStatus.current_generation} / {jobStatus.total_generations}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-sky-200/80 text-sky-950">
                  {jobStatus.progress_percent}%
                </span>
              </div>
            </div>

            <div className="w-full h-3 bg-sky-200/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#086288] to-sky-500 transition-all duration-300 rounded-full"
                style={{ width: `${Math.max(4, jobStatus.progress_percent)}%` }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>
                  Waktu: <strong>{jobStatus.elapsed_time_seconds}s</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Dna className="w-4 h-4 text-[#086288]" />
                <span>
                  Kandidat Unik: <strong>{jobStatus.unique_candidates_evaluated}</strong> / 546
                </span>
              </div>
              {jobStatus.best_candidate && (
                <>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Layers className="w-4 h-4 text-amber-600" />
                    <span>
                      Batas Terbaik: <strong>[{jobStatus.best_candidate.zone_boundaries.join(", ")}]</strong> | Urutan{" "}
                      <strong>[{jobStatus.best_candidate.zone_order.join(", ")}]</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Award className="w-4 h-4 text-emerald-600" />
                    <span>
                      Fitness: <strong>{jobStatus.best_candidate.training_fitness_seconds}s</strong> (
                      {jobStatus.best_candidate.training_fitness_minutes}m)
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-3">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Gagal:</strong> {error}
            </div>
          </div>
        )}

        {/* Cancelled Banner */}
        {jobStatus?.status === "cancelled" && (
          <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
            <span>
              Optimasi GA dibatalkan oleh pengguna pada generasi {jobStatus.current_generation} ({jobStatus.unique_candidates_evaluated} kandidat unik dievaluasi).
            </span>
            <span className="font-bold text-slate-500">Status: Dibatalkan</span>
          </div>
        )}
      </div>

      {/* Live / Completed Chart if generation_history exists */}
      {jobStatus &&
        jobStatus.generation_history &&
        jobStatus.generation_history.length > 0 &&
        renderFitnessConvergenceChart(jobStatus.generation_history)}

      {/* Tampilan Hasil Selesai */}
      {jobStatus?.status === "completed" && jobStatus.best_candidate && (
        <div className="flex flex-col gap-6 animate-in fade-in">
          {/* Status Konvergensi & Verifikasi terhadap Exhaustive Search */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <h4 className="text-lg font-black text-slate-900 tracking-tight">
                  Evolusi GA Selesai ({jobStatus.total_generations} Generasi • {jobStatus.unique_candidates_evaluated} Kandidat Unik Dievaluasi)
                </h4>
              </div>
              <p className="text-xs text-slate-500">
                Waktu eksekusi: <strong>{jobStatus.execution_time_seconds} detik</strong> • Menghemat{" "}
                <strong>{jobStatus.evaluation_reduction_percent}%</strong> evaluasi kandidat unik dibanding Exhaustive Search (546 kandidat).
              </p>
            </div>

            {jobStatus.exhaustive_comparison?.is_exhaustive_optimum_verified !== false ? (
              jobStatus.matches_exhaustive_optimum ? (
                <div className="px-4 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2 text-xs font-bold shadow-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>
                    Konvergen ke Exhaustive Optimum: [
                    {jobStatus.exhaustive_comparison?.exhaustive_boundaries.join(", ") ?? "5, 18"}] | [
                    {jobStatus.exhaustive_comparison?.exhaustive_order.join(", ") ?? "3, 2, 1"}] (
                    {jobStatus.exhaustive_comparison?.comparison_label ?? "Gap terhadap Exhaustive Optimum"}: 0.00%)
                  </span>
                </div>
              ) : (
                <div className="px-4 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2 text-xs font-bold shadow-sm">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>
                    Solusi Dekat-Optimum ({jobStatus.exhaustive_comparison?.comparison_label ?? "Gap terhadap Exhaustive Optimum"}:{" "}
                    {(jobStatus.exhaustive_comparison?.fitness_gap_percent ?? 0) >= 0 ? "+" : ""}
                    {(jobStatus.exhaustive_comparison?.fitness_gap_percent ?? 0).toFixed(2)}%)
                  </span>
                </div>
              )
            ) : (
              <div className="px-4 py-2 rounded-2xl bg-sky-50 border border-sky-200 text-sky-950 flex items-center gap-2 text-xs font-bold shadow-sm">
                <GitCompare className="w-4 h-4 text-[#086288]" />
                <span>
                  {jobStatus.exhaustive_comparison.comparison_label}:{" "}
                  {jobStatus.exhaustive_comparison.fitness_gap_seconds >= 0 ? "+" : ""}
                  {jobStatus.exhaustive_comparison.fitness_gap_seconds.toFixed(3)}s (
                  {jobStatus.exhaustive_comparison.fitness_gap_percent >= 0 ? "+" : ""}
                  {jobStatus.exhaustive_comparison.fitness_gap_percent.toFixed(2)}%)
                </span>
              </div>
            )}
          </div>

          {/* 4 KPI Cards Solusi Terbaik GA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Batas Zona Terbaik GA</span>
                <Layers className="w-4 h-4 text-[#086288]" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                  [{jobStatus.best_candidate.zone_boundaries.join(", ")}]
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  Z1: R01–{jobStatus.best_candidate.zone_boundaries[0].toString().padStart(2, "0")} | Z2: R
                  {(jobStatus.best_candidate.zone_boundaries[0] + 1).toString().padStart(2, "0")}–
                  {jobStatus.best_candidate.zone_boundaries[1].toString().padStart(2, "0")} | Z3: R
                  {(jobStatus.best_candidate.zone_boundaries[1] + 1).toString().padStart(2, "0")}–30
                </span>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                Kromosom hasil seleksi & mutasi GA
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Ukuran Zona Terbaik GA</span>
                <BarChart3 className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                  [{jobStatus.best_candidate.zone_sizes.join(", ")}] Baris
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  Z1: {jobStatus.best_candidate.zone_sizes[0]}b • Z2: {jobStatus.best_candidate.zone_sizes[1]}b • Z3:{" "}
                  {jobStatus.best_candidate.zone_sizes[2]}b
                </span>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                Valid pada rentang [5..15] baris (Total 30)
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Urutan Zona Terbaik GA</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                  [{jobStatus.best_candidate.zone_order.join(", ")}]
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  {formatOrderName(jobStatus.best_candidate.zone_order)}
                </span>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                Permutasi hasil Order Crossover (OX)
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Best Fitness GA (15 Batch)</span>
                <Award className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-emerald-700 tracking-tight">
                  {jobStatus.best_candidate.training_fitness_seconds} s
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  Setara <strong>{jobStatus.best_candidate.training_fitness_minutes} menit</strong>
                </span>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                Dievaluasi pada {jobStatus.unique_candidates_evaluated} kandidat unik
              </div>
            </div>
          </div>

          {/* Perbandingan Langsung: GA vs Exhaustive Search (546 Kandidat) atau Kromosom Referensi [5, 18] */}
          {jobStatus.exhaustive_comparison && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <GitCompare className="w-5 h-5 text-[#086288]" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {jobStatus.exhaustive_comparison.is_exhaustive_optimum_verified
                        ? "Perbandingan Hasil: Genetic Algorithm (GA-Zone-WMA) vs Exhaustive Search (546 Kandidat)"
                        : "Perbandingan Hasil: Genetic Algorithm (GA-Zone-WMA) vs Kromosom Referensi [5, 18]"}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {jobStatus.exhaustive_comparison.is_exhaustive_optimum_verified
                        ? "Membandingkan keakuratan solusi dan penghematan komputasi antara pencarian metaheuristik GA dan enumerasi penuh 546 kandidat pada training yang sama"
                        : `Base seed kustom (${jobStatus.training_config?.base_seed ?? baseSeed}) belum dievaluasi dengan Exhaustive Search 546 kandidat — pembanding menggunakan Kromosom Referensi [5, 18] | [3, 2, 1] pada training yang sama`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/70">
                      <th className="py-2.5 px-3">Metrik Evaluasi</th>
                      <th className="py-2.5 px-3">Genetic Algorithm (GA-Zone-WMA)</th>
                      <th className="py-2.5 px-3">
                        {jobStatus.exhaustive_comparison.reference_label}
                      </th>
                      <th className="py-2.5 px-3 text-right">Selisih / Efisiensi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">
                        {jobStatus.exhaustive_comparison.is_exhaustive_optimum_verified
                          ? "Batas Zona Optimum"
                          : "Batas Zona Referensi [5, 18]"}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        [{jobStatus.best_candidate.zone_boundaries.join(", ")}]
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        [{jobStatus.exhaustive_comparison.exhaustive_boundaries.join(", ")}]
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                        {JSON.stringify(jobStatus.best_candidate.zone_boundaries) ===
                        JSON.stringify(jobStatus.exhaustive_comparison.exhaustive_boundaries)
                          ? "Identik"
                          : "Berbeda"}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">Ukuran Ketiga Zona</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        [{jobStatus.best_candidate.zone_sizes.join(", ")}] baris
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        [{jobStatus.exhaustive_comparison.exhaustive_sizes.join(", ")}] baris
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                        {JSON.stringify(jobStatus.best_candidate.zone_sizes) ===
                        JSON.stringify(jobStatus.exhaustive_comparison.exhaustive_sizes)
                          ? "Identik"
                          : "Berbeda"}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">Urutan Pemanggilan Zona</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        [{jobStatus.best_candidate.zone_order.join(", ")}]
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        [{jobStatus.exhaustive_comparison.exhaustive_order.join(", ")}]
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                        {JSON.stringify(jobStatus.best_candidate.zone_order) ===
                        JSON.stringify(jobStatus.exhaustive_comparison.exhaustive_order)
                          ? "Identik"
                          : "Berbeda"}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">Training Fitness (15 Batch)</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                        {jobStatus.best_candidate.training_fitness_seconds.toFixed(3)} s (
                        {jobStatus.best_candidate.training_fitness_minutes.toFixed(3)} m)
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        {jobStatus.exhaustive_comparison.exhaustive_fitness_seconds.toFixed(3)} s (
                        {jobStatus.exhaustive_comparison.exhaustive_fitness_minutes.toFixed(3)} m)
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                        {jobStatus.exhaustive_comparison.comparison_label}:{" "}
                        {jobStatus.exhaustive_comparison.fitness_gap_seconds >= 0 ? "+" : ""}
                        {jobStatus.exhaustive_comparison.fitness_gap_seconds.toFixed(3)} s (
                        {jobStatus.exhaustive_comparison.fitness_gap_percent >= 0 ? "+" : ""}
                        {jobStatus.exhaustive_comparison.fitness_gap_percent.toFixed(2)}%)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">Kandidat Unik Dievaluasi</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#086288]">
                        {jobStatus.unique_candidates_evaluated} kandidat unik
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        {jobStatus.exhaustive_comparison.is_exhaustive_optimum_verified
                          ? `${jobStatus.exhaustive_comparison.exhaustive_candidates_evaluated} kandidat (seluruh ruang)`
                          : `${jobStatus.exhaustive_comparison.exhaustive_candidates_evaluated} kromosom referensi (tanpa 546 kandidat)`}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#086288]">
                        Hemat {jobStatus.evaluation_reduction_percent}% thd ruang 546 kandidat
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tabel Riwayat Generasi & Top 10 Kandidat Unik */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedTab("generations")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedTab === "generations"
                      ? "bg-[#086288] text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Riwayat Evolusi per Generasi (G0–G{jobStatus.total_generations})
                </button>
                <button
                  onClick={() => setSelectedTab("top_candidates")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedTab === "top_candidates"
                      ? "bg-[#086288] text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  10 Kandidat Unik Terbaik selama Evolusi
                </button>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Total Simulasi Pelatihan: {jobStatus.unique_candidates_evaluated * 15} penerbangan
              </span>
            </div>

            {selectedTab === "generations" ? (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Generasi</th>
                      <th className="py-2.5 px-3">Batas Terbaik</th>
                      <th className="py-2.5 px-3">Ukuran Terbaik</th>
                      <th className="py-2.5 px-3">Urutan Terbaik</th>
                      <th className="py-2.5 px-3 text-right">Best Fitness (s)</th>
                      <th className="py-2.5 px-3 text-right">Mean Populasi (s)</th>
                      <th className="py-2.5 px-3 text-right">Worst Populasi (s)</th>
                      <th className="py-2.5 px-3 text-right">Kandidat Unik</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {jobStatus.generation_history.map((gen) => {
                      const isOptimum =
                        jobStatus.exhaustive_comparison?.is_exhaustive_optimum_verified !== false &&
                        Math.abs(
                          gen.best_fitness_seconds -
                            (jobStatus.exhaustive_comparison?.exhaustive_fitness_seconds ?? 291.069)
                        ) < 0.01;
                      return (
                        <tr
                          key={gen.generation}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isOptimum ? "bg-emerald-50/30" : ""
                          }`}
                        >
                          <td className="py-2 px-3 font-mono font-bold text-slate-800">
                            Gen {gen.generation}
                          </td>
                          <td className="py-2 px-3 font-mono">[{gen.best_boundaries.join(", ")}]</td>
                          <td className="py-2 px-3 font-mono">[{gen.best_sizes.join(", ")}]</td>
                          <td className="py-2 px-3 font-mono">[{gen.best_order.join(", ")}]</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-[#086288]">
                            {gen.best_fitness_seconds.toFixed(3)} s ({gen.best_fitness_minutes.toFixed(3)} m)
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">
                            {gen.mean_fitness_seconds.toFixed(3)} s
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-400">
                            {gen.worst_fitness_seconds.toFixed(3)} s
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700">
                            {gen.unique_candidates_evaluated}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/70">
                      <th className="py-2.5 px-3">Peringkat</th>
                      <th className="py-2.5 px-3">Batas Zona</th>
                      <th className="py-2.5 px-3">Ukuran Zona</th>
                      <th className="py-2.5 px-3">Urutan Pemanggilan</th>
                      <th className="py-2.5 px-3 text-right">Fitness (Detik)</th>
                      <th className="py-2.5 px-3 text-right">Fitness (Menit)</th>
                      <th className="py-2.5 px-3 text-right">Gap thd Best GA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(jobStatus.top_candidates || []).map((cand, idx) => {
                      const gap =
                        cand.training_fitness_seconds -
                        jobStatus.best_candidate!.training_fitness_seconds;
                      const gapPct =
                        (gap / jobStatus.best_candidate!.training_fitness_seconds) * 100;
                      const isBest = idx === 0;
                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isBest ? "bg-emerald-50/40 font-bold" : ""
                          }`}
                        >
                          <td className="py-2.5 px-3 flex items-center gap-1.5">
                            {isBest && <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                            <span>#{idx + 1}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono">[{cand.zone_boundaries.join(", ")}]</td>
                          <td className="py-2.5 px-3 font-mono">[{cand.zone_sizes.join(", ")}]</td>
                          <td className="py-2.5 px-3 font-mono">[{cand.zone_order.join(", ")}]</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                            {cand.training_fitness_seconds.toFixed(3)} s
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {cand.training_fitness_minutes.toFixed(3)} m
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {isBest ? (
                              <span className="text-emerald-700 font-bold">0.00% (Best)</span>
                            ) : (
                              <span className="text-slate-500">+{gapPct.toFixed(2)}%</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Catatan Metodologis */}
          <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200/90 text-xs text-slate-600 flex flex-col gap-3">
            <h5 className="font-bold text-slate-900 flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-[#086288]" />
              Catatan Metodologis Evolusi GA Dinamis, Variabilitas Seed & Pemisahan dari Benchmark Historis
            </h5>
            <p className="leading-relaxed">
              1. <strong>Mekanisme Evolusi Nyata:</strong> Populasi awal (24 individu) dimulai dengan kromosom seimbang{" "}
              <code>((10, 20), (3, 2, 1))</code>, 6 permutasi batas seimbang, serta individu acak unik. Setiap generasi mempertahankan 2 individu elit terbaik, memilih induk dengan turnamen (k=3), melakukan crossover ukuran zona diikuti proyeksi Euclidean ke partisi valid (<code>repair_sizes</code>) serta Order Crossover (OX) pada urutan zona, lalu memutasi ukuran zona dalam jarak L1 ≤ 4 dan menukar urutan zona dengan probabilitas 0.30.
            </p>
            <p className="leading-relaxed">
              2. <strong>Sifat Stokastik Multi-Seed & Isolasi Fitness Cache:</strong> Setiap pekerjaan optimasi menggunakan{" "}
              <code>fitness_cache</code> terisolasi yang terikat pada tanda tangan <code>base_seed</code> pelatihan. Pada seed penelitian (<code>ga_seed = 20262020</code>), GA mengevaluasi <strong>121 kandidat unik</strong> dari 546 kemungkinan (hemat 77.8% evaluasi) dan menemukan global optimum eksak <strong>[5, 18] | [3, 2, 1]</strong> (<strong>291.069 detik / 4.851 menit</strong>) pertama kali pada <strong>Generasi ke-6</strong>. Karena GA bersifat stokastik terhadap <code>ga_seed</code>, tidak setiap seed dijamin konvergen ke global optimum (misalnya <code>ga_seed = 179</code> dan <code>247</code> berhenti pada solusi peringkat #2 <code>[5, 17] | [3, 2, 1]</code> dengan fitness <code>291.430 detik</code>, gap <code>+0.124%</code>).
            </p>
            <p className="leading-relaxed">
              3. <strong>Pemisahan Hasil Optimasi Dinamis vs Benchmark Akhir (100 Replikasi):</strong> Nilai fitness di atas merupakan <strong>hasil optimasi dinamis pada 15 batch pelatihan</strong> (5 replikasi × bagasi 50%, 60%, 70%), terpisah dari dataset benchmark historis 100 replikasi independen di mana <strong>Back-to-Front-WILMA</strong> tetap menempati peringkat #1 secara keseluruhan.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
