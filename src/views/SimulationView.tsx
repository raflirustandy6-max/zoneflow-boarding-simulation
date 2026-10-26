import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Luggage,
  Users,
  Clock,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  Info,
  Layers,
  Sparkles,
  Plane,
  Server,
  RefreshCw,
  Cpu,
  Dna,
} from "lucide-react";
import {
  BOARDING_METHOD_BUILDERS,
  PassengerTimelineDetail,
  SimulationMetrics,
  SEATS,
  N_ROWS,
} from "../simulation/engine";
import { useSimulationRunner } from "../simulation/useSimulationRunner";
import { INVENTARIS_METODE } from "../data/benchmarkData";
import { BatchSimulationPanel } from "../components/BatchSimulationPanel";
import { ExhaustiveOptimizationPanel } from "../components/ExhaustiveOptimizationPanel";
import { GAOptimizationPanel } from "../components/GAOptimizationPanel";

interface SimulationViewProps {
  initialBaggage?: number;
}

export const SimulationView: React.FC<SimulationViewProps> = ({
  initialBaggage = 60,
}) => {
  const [activeSimulationMode, setActiveSimulationMode] = useState<"single" | "batch" | "exhaustive" | "ga">("single");
  const [selectedMethod, setSelectedMethod] = useState<string>("Back-to-Front-WILMA");
  const [baggageRatio, setBaggageRatio] = useState<number>(initialBaggage);
  const [seed, setSeed] = useState<number>(20261021);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(2.0); // 1x, 2x, 5x, 10x
  const [currentTimeS, setCurrentTimeS] = useState<number>(0);
  const [selectedSeatDetail, setSelectedSeatDetail] = useState<PassengerTimelineDetail | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const lastWallTimeRef = useRef<number | null>(null);

  // 1. Hook orkestrasi simulasi Python Backend asli & Browser Demo fallback
  const {
    selectedEngine,
    setSelectedEngine,
    activeSource,
    isLoading,
    error,
    metrics,
    details,
    detailsBySeat,
    executionTimeMs,
    backendOnline,
    backendInfo,
    recheckBackend,
    rerunSimulation,
  } = useSimulationRunner(selectedMethod, baggageRatio, seed);

  const simulationData = useMemo(() => {
    return { metrics, details, detailsBySeat };
  }, [metrics, details, detailsBySeat]);

  const totalDurationS = simulationData.metrics.boarding_time_seconds;

  // Sync baggageRatio when top Header baggage selector changes
  useEffect(() => {
    setBaggageRatio(initialBaggage);
  }, [initialBaggage]);

  // Reset playback whenever parameters change
  useEffect(() => {
    setCurrentTimeS(0);
    setIsPlaying(false);
    setSelectedSeatDetail(null);
  }, [selectedMethod, baggageRatio, seed]);

  // Animation Loop
  useEffect(() => {
    if (!isPlaying) {
      lastWallTimeRef.current = null;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    const step = (now: number) => {
      if (lastWallTimeRef.current === null) {
        lastWallTimeRef.current = now;
      }
      const deltaWallS = (now - lastWallTimeRef.current) / 1000;
      lastWallTimeRef.current = now;

      setCurrentTimeS((prev) => {
        const next = prev + deltaWallS * playbackSpeed;
        if (next >= totalDurationS) {
          setIsPlaying(false);
          return totalDurationS;
        }
        return next;
      });

      animationFrameRef.current = requestAnimationFrame(step);
    };

    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, totalDurationS]);

  // Current Seated Count and Live Status computation
  const seatedCount = useMemo(() => {
    return simulationData.details.filter((d) => d.finish_time_s <= currentTimeS).length;
  }, [simulationData.details, currentTimeS]);

  // Map each of the 30 aisle rows to the passenger currently occupying that segment
  const rowOccupation = useMemo(() => {
    const map: Record<
      number,
      {
        passenger: PassengerTimelineDetail;
        isTargetRow: boolean;
        hasConflict: boolean;
      } | null
    > = {};
    for (let r = 1; r <= N_ROWS; r++) map[r] = null;

    for (const p of simulationData.details) {
      if (currentTimeS < p.entry_time_s || currentTimeS >= p.finish_time_s) continue;
      const currentSeg = p.aisle_transit?.find(
        (seg) => currentTimeS >= seg.enter_s && currentTimeS < seg.leave_s
      );
      if (currentSeg) {
        map[currentSeg.row] = {
          passenger: p,
          isTargetRow: currentSeg.is_target_row,
          hasConflict: p.occupied_blockers > 0 && currentSeg.is_target_row,
        };
      }
    }
    return map;
  }, [simulationData.details, currentTimeS]);

  // Information about the selected method from the inventory
  const methodMeta = useMemo(() => {
    return (
      INVENTARIS_METODE.find((m) => m.method_name === selectedMethod) || {
        method_name: selectedMethod,
        aliases: "-",
        rule_from_pdf: "Strategi penataan urutan penumpang kabin.",
        implementation_notes: "Dijalankan menggunakan simulator v3.",
      }
    );
  }, [selectedMethod]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTimeS(val);
  };

  const handleInstantFinish = () => {
    setCurrentTimeS(totalDurationS);
    setIsPlaying(false);
  };

  const handleReset = () => {
    setCurrentTimeS(0);
    setIsPlaying(false);
  };

  // Helper formatting mm:ss
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Simulation Mode Tabs (Single 2D Visualizer vs Batch Statistics vs Exhaustive Optimization) */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-white rounded-2xl p-2.5 border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl flex-wrap">
          <button
            onClick={() => setActiveSimulationMode("single")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#086288] ${
              activeSimulationMode === "single"
                ? "bg-white text-[#086288] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Plane className="w-3.5 h-3.5 -rotate-45 shrink-0" />
            <span>Simulasi Tunggal Kabin 2D</span>
          </button>

          <button
            onClick={() => setActiveSimulationMode("batch")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#086288] ${
              activeSimulationMode === "batch"
                ? "bg-[#086288] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Server className="w-3.5 h-3.5 shrink-0" />
            <span>Simulasi Batch Python</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                activeSimulationMode === "batch"
                  ? "bg-white/20 text-white"
                  : "bg-sky-100 text-[#086288]"
              }`}
            >
              10–100 Replikasi
            </span>
          </button>

          <button
            onClick={() => setActiveSimulationMode("exhaustive")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 ${
              activeSimulationMode === "exhaustive"
                ? "bg-amber-700 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Cpu className="w-3.5 h-3.5 shrink-0" />
            <span>Optimasi Exhaustive-WMA</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                activeSimulationMode === "exhaustive"
                  ? "bg-white/20 text-white"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              546 Kandidat
            </span>
          </button>

          <button
            onClick={() => setActiveSimulationMode("ga")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 ${
              activeSimulationMode === "ga"
                ? "bg-indigo-700 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Dna className="w-3.5 h-3.5 shrink-0" />
            <span>Optimasi GA-Zone-WMA</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                activeSimulationMode === "ga"
                  ? "bg-white/20 text-white"
                  : "bg-indigo-100 text-indigo-800"
              }`}
            >
              GA Dinamis
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-500 px-3">
          {activeSimulationMode === "single" ? (
            <span>Visualisasi 2D kabin & pemantauan pergerakan penumpang waktu-nyata</span>
          ) : activeSimulationMode === "batch" ? (
            <span>Eksperimen multi-replikasi & estimasi interval kepercayaan 95%</span>
          ) : activeSimulationMode === "exhaustive" ? (
            <span>Evaluasi menyeluruh 546 kandidat batas zona dan urutan pemanggilan</span>
          ) : (
            <span>Evolusi populasi & generasi Algoritma Genetika dinamis pada backend Python</span>
          )}
        </div>
      </div>

      {activeSimulationMode === "ga" ? (
        <GAOptimizationPanel
          backendOnline={backendOnline}
          onRecheckBackend={recheckBackend}
        />
      ) : activeSimulationMode === "exhaustive" ? (
        <ExhaustiveOptimizationPanel
          backendOnline={backendOnline}
          onRecheckBackend={recheckBackend}
        />
      ) : activeSimulationMode === "batch" ? (
        <BatchSimulationPanel
          backendOnline={backendOnline}
          onRecheckBackend={recheckBackend}
        />
      ) : (
        <>
          {/* Top Header Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm flex flex-col gap-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-sky-50 text-[#086288]">
                    <Plane className="w-5 h-5 -rotate-45" />
                  </span>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                      Simulator Kabin Interaktif (30 Baris • 180 Kursi)
                    </h2>
                <p className="text-xs text-slate-500">
                  Model lorong tunggal generik layout 3-3 (Airbus A320 / Boeing 737 class)
                </p>
              </div>
            </div>
          </div>

          {/* Engine Selector & Explicit Mode Tag */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Engine Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                onClick={() => setSelectedEngine("python")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedEngine === "python"
                    ? "bg-[#086288] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Menjalankan kalkulasi simulasi melalui backend Python FastAPI asli"
              >
                <Server className="w-3.5 h-3.5" />
                Python Backend
                <span
                  className={`w-2 h-2 rounded-full ${
                    backendOnline ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                  }`}
                  title={backendOnline ? "Backend Python Online" : "Backend Python Offline"}
                />
              </button>
              <button
                onClick={() => setSelectedEngine("browser")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedEngine === "browser"
                    ? "bg-slate-800 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Menjalankan simulasi demo lokal di browser dengan engine TypeScript"
              >
                <Layers className="w-3.5 h-3.5" />
                Demo Browser
              </button>
            </div>

            {/* Active Execution Badge */}
            {activeSource === "python" ? (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-900 border border-emerald-300 shadow-2xs"
                title="Waktu eksekusi komputasi CPU backend Python untuk kalkulasi 1 replikasi"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Backend Python Online • Komputasi CPU: {executionTimeMs.toFixed(1)} ms
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200 shadow-2xs"
                title="Dijalankan di browser lokal dengan engine TypeScript"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Demo Browser Client • Engine TypeScript
              </span>
            )}

            {isLoading && (
              <span className="inline-flex items-center gap-1 text-xs text-[#086288] font-bold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Memuat...
              </span>
            )}
          </div>
        </div>

        {/* Backend Python Offline / Error Banner */}
        {selectedEngine === "python" && error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Backend Python Tidak Terhubung</span>
                <p className="text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setSelectedEngine("browser")}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs"
              >
                Gunakan Demo Browser
              </button>
              <button
                onClick={recheckBackend}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Coba Lagi
              </button>
            </div>
          </div>
        )}

        {/* Notice for Exhaustive-Zone-WMA */}
        {selectedMethod === "Exhaustive-Zone-WMA" && (
          <div className="p-3.5 rounded-2xl bg-purple-50/90 border border-purple-200 text-xs text-purple-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Status Metodologi Exhaustive-Zone-WMA:</span> Pada tab Simulasi Tunggal, konfigurasi menggunakan kromosom hasil audit eksak Python (Batas Zona [5, 18], ukuran [5, 13, 12], dan Urutan [3, 2, 1]). Untuk menjalankan evaluasi seluruh 546 kandidat secara dinamis di backend Python, gunakan tab <strong>Optimasi Exhaustive-WMA (546 Kandidat)</strong> di atas.
            </div>
          </div>
        )}

        {/* Configuration Controls Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* 1. Method Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Metode Boarding</label>
            <div className="relative">
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#086288] appearance-none"
              >
                {Object.keys(BOARDING_METHOD_BUILDERS).map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* 2. Baggage Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Tingkat Bagasi Kabin</label>
            <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-300">
              {[50, 60, 70].map((val) => (
                <button
                  key={val}
                  onClick={() => setBaggageRatio(val)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    baggageRatio === val
                      ? "bg-[#086288] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {val}%
                </button>
              ))}
            </div>
          </div>

          {/* 3. Random Seed Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Random Seed</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#086288]"
              />
              <button
                onClick={() => setSeed(Math.floor(Math.random() * 9000000) + 1000000)}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300"
                title="Acak Seed Penumpang"
              >
                Acak
              </button>
            </div>
          </div>

          {/* 4. Playback Speed Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Kecepatan Animasi</label>
            <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-300">
              {[0.5, 1, 2, 5, 10].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                    playbackSpeed === spd
                      ? "bg-slate-800 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Player Controls & Scrubber */}
        <div className="flex flex-col gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-xs ${
                  isPlaying
                    ? "bg-amber-600 text-white hover:bg-amber-700"
                    : "bg-[#086288] text-white hover:bg-[#064e6d]"
                }`}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                {isPlaying ? "Jeda Simulasi" : "Mulai Simulasi"}
              </button>

              <button
                onClick={handleReset}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                title="Kembali ke awal"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={handleInstantFinish}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center gap-1.5"
                title="Lompat ke akhir simulasi"
              >
                <FastForward className="w-3.5 h-3.5" />
                Langsung Selesai
              </button>
            </div>

            {/* Time Indicator */}
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Waktu Fisik Kabin
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold font-mono text-slate-900">
                  {formatTime(currentTimeS)}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  / {formatTime(totalDurationS)} ({totalDurationS.toFixed(1)}s • {(totalDurationS / 60).toFixed(2)} min)
                </span>
              </div>
            </div>
          </div>

          {/* Timeline slider */}
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max={totalDurationS || 100}
              step="0.5"
              value={currentTimeS}
              onChange={handleSeek}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#086288]"
            />
          </div>
        </div>
      </div>

      {/* Live KPI Bar (5 Metrik Fisik Model) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600">
              Durasi Fisik Kabin
            </span>
            <div className="p-1.5 rounded-lg bg-sky-50 text-[#086288] shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 tabular-nums">
            <div className="text-xl font-bold text-slate-900 font-mono">
              {(totalDurationS / 60).toFixed(2)} <span className="text-xs text-slate-500 font-sans font-medium">menit</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {totalDurationS.toFixed(1)} detik (1 replikasi)
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600">
              Penumpang Duduk
            </span>
            <div className="p-1.5 rounded-lg bg-sky-50 text-[#086288] shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 tabular-nums">
            <div className="text-xl font-bold text-slate-900 font-mono">
              {seatedCount} <span className="text-xs text-slate-500 font-sans font-medium">/ 180 kursi</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Okupansi kabin 100%
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600">
              Penumpang Berbagasi
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700 shrink-0">
              <Luggage className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 tabular-nums">
            <div className="text-xl font-bold text-slate-900 font-mono">
              {simulationData.metrics.baggage_count}
              <span className="text-xs text-slate-500 font-sans font-medium"> ({baggageRatio}%)</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Weibull (16,0 dtk; bentuk 1,7)
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600">
              Kongesti Lorong
            </span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-700 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 tabular-nums">
            <div className="text-xl font-bold text-slate-900 font-mono">
              {simulationData.metrics.aggregate_aisle_wait_person_seconds.toFixed(0)}
              <span className="text-xs text-slate-500 font-sans font-medium"> org·dtk</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {simulationData.metrics.aisle_interference_events} kejadian antre
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600">
              Interferensi Kursi
            </span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-700 shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 tabular-nums">
            <div className="text-xl font-bold text-slate-900 font-mono">
              {simulationData.metrics.seat_interference_events}
              <span className="text-xs text-slate-500 font-sans font-medium"> kejadian</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {simulationData.metrics.occupied_blocker_count} kursi penghalang
            </p>
          </div>
        </div>
      </div>

      {/* Informative distinction banner: Live Interactive (1 rep) vs Benchmark (100 reps) */}
      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#086288] shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold text-slate-800">Perbedaan Metrik Replikasi:</span> Angka pada visualisasi di atas merupakan hasil <strong>1 replikasi interaktif</strong> (seed: {seed}) dengan komputasi CPU {activeSource === "python" ? `server ${executionTimeMs.toFixed(1)} ms` : "instan di browser"}. Nilai ini merefleksikan satu skenario penerbangan tunggal. Untuk perbandingan statistik resmi lintas metode, buka halaman <strong>Hasil & Perbandingan</strong> yang menyajikan rata-rata dari <strong>100 replikasi independen</strong>.
        </div>
      </div>

      {/* Main 2D Cabin Layout Visualization */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Peta Kabin & Status Penumpang
            </h3>
            <span className="text-xs text-slate-400">
              Klik pada kursi untuk melihat riwayat waktu kedatangan & durasi stowage.
            </span>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-slate-100 border border-slate-300" />
              <span className="text-slate-600">Kosong</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-sky-400 border border-sky-300" />
              <span className="text-slate-600">Melintas di Lorong</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-amber-400 animate-pulse border border-amber-500" />
              <span className="text-slate-600">Stow Bagasi</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-orange-500 border border-orange-600" />
              <span className="text-slate-600">Konflik Kursi</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md bg-[#086288] border border-[#064e6d]" />
              <span className="text-slate-600">Duduk Selesai</span>
            </div>
          </div>
        </div>

        {/* Airplane Cabin Frame */}
        <div className="overflow-x-auto pb-4">
          <div className="min-w-[850px] bg-slate-900 rounded-3xl p-6 text-white shadow-inner flex flex-col gap-2 relative">
            {/* Front Cockpit Nose */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs font-bold text-slate-400">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                PINTU MASUK DEPAN (BARIS 01)
              </span>
              <span className="font-mono text-slate-500">KABIN 3-3 LORONG TUNGGAL</span>
              <span>BAGIAN BELAKANG (BARIS 30)</span>
            </div>

            {/* Column Labels */}
            <div
              className="gap-1 text-[10px] font-mono text-slate-400 text-center pb-1"
              style={{ display: "grid", gridTemplateColumns: "repeat(30, minmax(0, 1fr))" }}
            >
              {Array.from({ length: N_ROWS }).map((_, i) => (
                <div key={i} className="truncate">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Left Seats (A, B, C) */}
            <div className="flex flex-col gap-1.5">
              {(["A", "B", "C"] as Array<"A" | "B" | "C">).map((seatLetter) => (
                <div
                  key={seatLetter}
                  className="gap-1"
                  style={{ display: "grid", gridTemplateColumns: "repeat(30, minmax(0, 1fr))" }}
                >
                  {Array.from({ length: N_ROWS }).map((_, rIdx) => {
                    const rowNum = rIdx + 1;
                    const seatId = `R${rowNum.toString().padStart(2, "0")}${seatLetter}`;
                    const detail = simulationData.detailsBySeat[seatId];
                    if (!detail) return <div key={seatId} className="w-6 h-6 bg-slate-800 rounded" />;

                    // Determine seat state at currentTimeS
                    const isSeated = detail.finish_time_s <= currentTimeS;
                    const hasArrived = detail.arrival_target_s <= currentTimeS;
                    const isStowing = hasArrived && !isSeated;
                    const hasConflict = detail.occupied_blockers > 0;

                    let bg = "bg-slate-800 border-slate-700 hover:border-slate-500";
                    let text = "text-slate-500";

                    if (isSeated) {
                      bg = "bg-[#086288] border-[#4D8DBA] shadow-xs";
                      text = "text-white font-bold";
                    } else if (isStowing) {
                      if (hasConflict) {
                        bg = "bg-orange-500 border-orange-300 animate-pulse";
                        text = "text-white font-extrabold";
                      } else {
                        bg = "bg-amber-400 border-amber-200 animate-pulse";
                        text = "text-slate-900 font-extrabold";
                      }
                    }

                    return (
                      <button
                        key={seatId}
                        onClick={() => setSelectedSeatDetail(detail)}
                        className={`h-7 rounded-md border flex items-center justify-center text-[10px] transition-all cursor-pointer ${bg} ${text}`}
                        title={`${seatId}: Masuk t=${detail.entry_time_s.toFixed(1)}s, Duduk t=${detail.finish_time_s.toFixed(1)}s, Bagasi=${detail.has_bag ? `${detail.bag_stowage_s.toFixed(1)}s` : "Tidak"}`}
                      >
                        {seatLetter}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Aisle (Lorong Pesawat) */}
            <div className="my-2 py-1.5 bg-slate-800/80 rounded-xl border border-slate-700/60 flex items-center justify-between px-3 text-[10px] font-mono text-slate-400">
              <span className="text-[10px] font-bold text-slate-400 tracking-wider">LORONG</span>
              <div
                className="flex-1 gap-1 px-2"
                style={{ display: "grid", gridTemplateColumns: "repeat(30, minmax(0, 1fr))" }}
              >
                {Array.from({ length: N_ROWS }).map((_, rIdx) => {
                  const rowNum = rIdx + 1;
                  const occ = rowOccupation[rowNum];

                  return (
                    <div key={rowNum} className="flex items-center justify-center h-4">
                      {occ ? (
                        <span
                          className={`w-3.5 h-3.5 rounded-full shadow-xs flex items-center justify-center text-[7px] font-extrabold transition-all duration-100 ${
                            occ.isTargetRow
                              ? occ.hasConflict
                                ? "bg-orange-500 text-white ring-2 ring-orange-300 animate-pulse"
                                : "bg-amber-400 text-slate-900 ring-2 ring-amber-200 animate-pulse"
                              : "bg-sky-400 text-slate-950 ring-1 ring-sky-200"
                          }`}
                          title={`Baris ${rowNum}: Penumpang ${occ.passenger.seat_id} (${
                            occ.isTargetRow
                              ? occ.hasConflict
                                ? "Interferensi Kursi"
                                : "Stowage Bagasi / Duduk"
                              : "Sedang Melintas Menuju Baris " + occ.passenger.row
                          })`}
                        >
                          {occ.passenger.seat}
                        </span>
                      ) : (
                        <span className="w-1 h-1 rounded-full bg-slate-700" />
                      )}
                    </div>
                  );
                })}
              </div>
              <span className="text-[10px] text-slate-400 font-mono">AISLE</span>
            </div>

            {/* Right Seats (D, E, F) */}
            <div className="flex flex-col gap-1.5">
              {(["D", "E", "F"] as Array<"D" | "E" | "F">).map((seatLetter) => (
                <div
                  key={seatLetter}
                  className="gap-1"
                  style={{ display: "grid", gridTemplateColumns: "repeat(30, minmax(0, 1fr))" }}
                >
                  {Array.from({ length: N_ROWS }).map((_, rIdx) => {
                    const rowNum = rIdx + 1;
                    const seatId = `R${rowNum.toString().padStart(2, "0")}${seatLetter}`;
                    const detail = simulationData.detailsBySeat[seatId];
                    if (!detail) return <div key={seatId} className="w-6 h-6 bg-slate-800 rounded" />;

                    const isSeated = detail.finish_time_s <= currentTimeS;
                    const hasArrived = detail.arrival_target_s <= currentTimeS;
                    const isStowing = hasArrived && !isSeated;
                    const hasConflict = detail.occupied_blockers > 0;

                    let bg = "bg-slate-800 border-slate-700 hover:border-slate-500";
                    let text = "text-slate-500";

                    if (isSeated) {
                      bg = "bg-[#086288] border-[#4D8DBA] shadow-xs";
                      text = "text-white font-bold";
                    } else if (isStowing) {
                      if (hasConflict) {
                        bg = "bg-orange-500 border-orange-300 animate-pulse";
                        text = "text-white font-extrabold";
                      } else {
                        bg = "bg-amber-400 border-amber-200 animate-pulse";
                        text = "text-slate-900 font-extrabold";
                      }
                    }

                    return (
                      <button
                        key={seatId}
                        onClick={() => setSelectedSeatDetail(detail)}
                        className={`h-7 rounded-md border flex items-center justify-center text-[10px] transition-all cursor-pointer ${bg} ${text}`}
                        title={`${seatId}: Masuk t=${detail.entry_time_s.toFixed(1)}s, Duduk t=${detail.finish_time_s.toFixed(1)}s, Bagasi=${detail.has_bag ? `${detail.bag_stowage_s.toFixed(1)}s` : "Tidak"}`}
                      >
                        {seatLetter}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Passenger Detail Drawer if clicked */}
        {selectedSeatDetail && (
          <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#086288] text-white flex items-center justify-center font-extrabold text-sm font-mono">
                {selectedSeatDetail.seat_id}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900">
                  Detail Kursi {selectedSeatDetail.seat_id} (Baris {selectedSeatDetail.row}, Kursi {selectedSeatDetail.seat})
                </span>
                <span className="text-xs text-slate-500">
                  Urutan Antrean #{selectedSeatDetail.queue_position} • Waktu Masuk Kabin: {selectedSeatDetail.entry_time_s.toFixed(1)}s
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-700">
              <div>
                <span className="text-slate-400 block text-[10px]">Tiba di Baris:</span>
                <span className="font-bold text-slate-900">{selectedSeatDetail.arrival_target_s.toFixed(1)}s</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Antre Lorong:</span>
                <span className="font-bold text-slate-900">{selectedSeatDetail.aisle_wait_s.toFixed(1)}s</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Stowage Bagasi:</span>
                <span className="font-bold text-slate-900">
                  {selectedSeatDetail.has_bag ? `${selectedSeatDetail.bag_stowage_s.toFixed(1)}s` : "Tidak Ada"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Interferensi Kursi:</span>
                <span className="font-bold text-slate-900">
                  {selectedSeatDetail.occupied_blockers > 0
                    ? `${selectedSeatDetail.occupied_blockers} Blocker (${selectedSeatDetail.seat_interference_s.toFixed(1)}s)`
                    : "0 (Lancar)"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Selesai Duduk:</span>
                <span className="font-bold text-[#086288]">{selectedSeatDetail.finish_time_s.toFixed(1)}s</span>
              </div>
              <button
                onClick={() => setSelectedSeatDetail(null)}
                className="px-2.5 py-1 rounded-lg bg-sky-200 text-sky-900 font-bold text-xs hover:bg-sky-300"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Explanation of Selected Method */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Info className="w-4 h-4 text-[#086288]" />
            <h4 className="text-sm font-bold text-slate-900">
              Aturan Metode: {methodMeta.method_name}
            </h4>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            {methodMeta.rule_from_pdf}
          </p>
          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <strong>Catatan Implementasi:</strong> {methodMeta.implementation_notes}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Layers className="w-4 h-4 text-[#086288]" />
            <h4 className="text-sm font-bold text-slate-900">
              Asumsi Parameter Model Fisik Kabin
            </h4>
          </div>
          <ul className="text-xs text-slate-600 flex flex-col gap-1.5">
            <li>• Kecepatan Jalan: <strong>2.4 detik/baris</strong> (dari studi aviasi regional).</li>
            <li>• Stowage Bagasi: Distribusi <strong>Weibull (scale 16.0s, shape 1.7)</strong> dari Schultz (2018).</li>
            <li>• Jeda Masuk Antarpenumpang: <strong>1.0 detik</strong>.</li>
            <li>• Konflik Kursi: 1 blocker = <strong>12.0s</strong> (5 ticks), 2 blocker = <strong>21.6s</strong> (9 ticks).</li>
            <li>• Headway Lorong: <strong>1.0 detik</strong> antarpengguna saat melintas.</li>
          </ul>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
