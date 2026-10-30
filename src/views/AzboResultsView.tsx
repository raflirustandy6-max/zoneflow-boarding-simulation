import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Award,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Plane,
  Users,
  Luggage,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Info,
  Cpu,
  ShieldCheck,
  X,
  ArrowDown,
} from "lucide-react";
import {
  AircraftLayoutConfig,
  AzboExecutionEngine,
  AzboOptimizationSummary,
  BOARDING_METHOD_CATALOG,
  getAzboExecutionEngineLabel,
  zoneOfRow,
  PassengerTimelineDetail,
} from "../simulation/engine";

interface AzboResultsViewProps {
  selectedLayout: AircraftLayoutConfig;
  passengerCountInput: string;
  baggagePercentInput: string;
  computedBaggageCount: number;
  passengerError: string | null;
  baggageError: string | null;
  azboSummary: AzboOptimizationSummary | null;
  isScenarioDirty: boolean;
  isEvaluating: boolean;
  evaluationProgressMessage: string;
  evaluationProgressPercent: number;
  executionEngine: AzboExecutionEngine;
  canOfferPyodideFallback: boolean;
  onChangeExecutionEngine: (engine: AzboExecutionEngine) => void;
  onRunAzboEvaluation: (overrideEngine?: AzboExecutionEngine) => Promise<{
    ok: boolean;
    error?: string;
    canFallbackToPyodide?: boolean;
    engineUsed?: AzboExecutionEngine;
  }>;
  onGoToAircraftLayout: () => void;
}

export const AzboResultsView: React.FC<AzboResultsViewProps> = ({
  selectedLayout,
  passengerCountInput,
  baggagePercentInput,
  computedBaggageCount,
  passengerError,
  baggageError,
  azboSummary,
  isScenarioDirty,
  isEvaluating,
  evaluationProgressMessage,
  evaluationProgressPercent,
  executionEngine,
  canOfferPyodideFallback,
  onChangeExecutionEngine,
  onRunAzboEvaluation,
  onGoToAircraftLayout,
}) => {
  const animationSectionRef = useRef<HTMLDivElement | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [showPyodideFallbackButton, setShowPyodideFallbackButton] =
    useState<boolean>(false);

  // State Animasi Metode Terbaik pada Halaman Hasil Akhir
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(5);
  const [currentTimeS, setCurrentTimeS] = useState<number>(0);
  const [selectedSeatDetail, setSelectedSeatDetail] =
    useState<PassengerTimelineDetail | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const lastWallTimeRef = useRef<number | null>(null);

  const hasValidationError = Boolean(passengerError || baggageError);
  const unsupportedMethods = useMemo(
    () => BOARDING_METHOD_CATALOG.filter((m) => !m.supportedInSimulator),
    []
  );

  // Gunakan langsung event trace / timeline_details dari backend Python AZBO V2
  const bestMethodSimulationData = useMemo(() => {
    if (!azboSummary) return null;
    if (
      azboSummary.animationDetails &&
      azboSummary.animationDetails.length > 0 &&
      azboSummary.animationMetrics
    ) {
      return {
        metrics: azboSummary.animationMetrics,
        details: azboSummary.animationDetails,
      };
    }
    return null;
  }, [azboSummary]);

  const totalDurationS =
    bestMethodSimulationData?.metrics.boarding_time_seconds || 0;

  // Reset state animasi setiap kali hasil evaluasi AZBO berganti
  useEffect(() => {
    setCurrentTimeS(0);
    setIsPlaying(false);
    setSelectedSeatDetail(null);
  }, [
    azboSummary?.scenario.layout.id,
    azboSummary?.scenario.passengerCount,
    azboSummary?.scenario.baggagePassengerCount,
    azboSummary?.scenario.seed,
    azboSummary?.recommendedMethod.methodName,
  ]);

  // Loop Animasi Metode Terbaik
  useEffect(() => {
    if (!isPlaying || !bestMethodSimulationData || totalDurationS <= 0) {
      lastWallTimeRef.current = null;
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
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
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, totalDurationS, bestMethodSimulationData]);

  // Hitung status penumpang pada detik currentTimeS
  const seatedCount = useMemo(() => {
    if (!bestMethodSimulationData) return 0;
    return bestMethodSimulationData.details.filter(
      (d) => d.finish_time_s <= currentTimeS
    ).length;
  }, [bestMethodSimulationData, currentTimeS]);

  const inAisleCount = useMemo(() => {
    if (!bestMethodSimulationData) return 0;
    return bestMethodSimulationData.details.filter(
      (d) => currentTimeS >= d.entry_time_s && currentTimeS < d.finish_time_s
    ).length;
  }, [bestMethodSimulationData, currentTimeS]);

  const waitingInQueueCount = useMemo(() => {
    if (!bestMethodSimulationData) return 0;
    return Math.max(
      0,
      bestMethodSimulationData.metrics.passenger_count -
        seatedCount -
        inAisleCount
    );
  }, [bestMethodSimulationData, seatedCount, inAisleCount]);

  // Pemetaan setiap sel (0..2N-1) dan baris lorong (1..nRows) terhadap penumpang dari data backend Python
  const rowOccupation = useMemo(() => {
    const map: Record<
      number,
      {
        passenger: PassengerTimelineDetail;
        secondaryPassenger?: PassengerTimelineDetail;
        cellIndex?: number;
        isTargetRow: boolean;
        hasConflict: boolean;
      } | null
    > = {};
    if (!azboSummary) return map;
    const nRows = azboSummary.scenario.layout.nRows;
    for (let r = 1; r <= nRows; r++) map[r] = null;
    if (!bestMethodSimulationData) return map;

    // 1. Petakan setiap sel diskret (kapasitas ketat 1 penumpang per sel)
    const cellMap: Record<
      number,
      {
        passenger: PassengerTimelineDetail;
        row: number;
        isTargetRow: boolean;
        hasConflict: boolean;
      }
    > = {};

    for (const p of bestMethodSimulationData.details) {
      if (currentTimeS < p.entry_time_s || currentTimeS >= p.finish_time_s)
        continue;

      if (Array.isArray(p.cell_intervals) && p.cell_intervals.length > 0) {
        const activeCell = p.cell_intervals.find(
          (iv) => currentTimeS >= iv.enter_s && currentTimeS < iv.leave_s
        );
        if (activeCell) {
          const isTarget =
            activeCell.row === p.row && currentTimeS >= p.arrival_target_s;
          cellMap[activeCell.cell] = {
            passenger: p,
            row: activeCell.row,
            isTargetRow: isTarget,
            hasConflict: p.occupied_blockers > 0 && isTarget,
          };
          continue;
        }
      }

      const currentSeg = p.aisle_transit?.find(
        (seg) => currentTimeS >= seg.enter_s && currentTimeS < seg.leave_s
      );
      if (currentSeg) {
        const fallbackCell = currentSeg.row * 2 - (currentSeg.is_target_row ? 1 : 2);
        cellMap[fallbackCell] = {
          passenger: p,
          row: currentSeg.row,
          isTargetRow: currentSeg.is_target_row,
          hasConflict: p.occupied_blockers > 0 && currentSeg.is_target_row,
        };
      }
    }

    // 2. Susun tampilan per baris tanpa menimpa penumpang yang berada pada sub-sel berbeda
    const sortedCells = Object.keys(cellMap)
      .map(Number)
      .sort((a, b) => a - b);

    for (const cIdx of sortedCells) {
      const entry = cellMap[cIdx];
      const existing = map[entry.row];
      if (!existing) {
        map[entry.row] = {
          passenger: entry.passenger,
          cellIndex: cIdx,
          isTargetRow: entry.isTargetRow,
          hasConflict: entry.hasConflict,
        };
      } else if (entry.isTargetRow && !existing.isTargetRow) {
        map[entry.row] = {
          passenger: entry.passenger,
          secondaryPassenger: existing.passenger,
          cellIndex: cIdx,
          isTargetRow: entry.isTargetRow,
          hasConflict: entry.hasConflict,
        };
      } else if (existing.passenger.seat_id !== entry.passenger.seat_id) {
        map[entry.row] = {
          ...existing,
          secondaryPassenger: entry.passenger,
        };
      }
    }
    return map;
  }, [bestMethodSimulationData, currentTimeS, azboSummary]);

  // Lookup detail kursi berdasarkan seat_id
  const seatDetailsMap = useMemo(() => {
    const map: Record<string, PassengerTimelineDetail> = {};
    if (!bestMethodSimulationData) return map;
    for (const d of bestMethodSimulationData.details) {
      map[d.seat_id] = d;
    }
    return map;
  }, [bestMethodSimulationData]);

  // Batas zona hanya digunakan apabila metode yang direkomendasikan adalah metode berbasis zona (ZONE)
  const activeZoneBoundaries = useMemo<number[] | null>(() => {
    if (!azboSummary) return null;
    if (azboSummary.recommendedMethod.zoneConfigUsed) {
      return azboSummary.recommendedMethod.zoneConfigUsed.boundaries;
    }
    return null;
  }, [azboSummary]);

  const progressPercent =
    totalDurationS > 0 ? Math.min(100, (currentTimeS / totalDurationS) * 100) : 0;

  const handleStartOrResume = () => {
    if (!bestMethodSimulationData) return;
    if (currentTimeS >= totalDurationS) {
      setCurrentTimeS(0);
    }
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleRepeat = () => {
    setIsPlaying(false);
    setCurrentTimeS(0);
  };

  const scrollToAnimationSection = () => {
    if (animationSectionRef.current) {
      animationSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const handleTriggerEvaluation = async (overrideEngine?: AzboExecutionEngine) => {
    if (isEvaluating) return;
    setRunError(null);
    setShowPyodideFallbackButton(false);
    const res = await onRunAzboEvaluation(overrideEngine);
    if (!res.ok) {
      setRunError(
        res.error ||
          "Gagal menjalankan simulasi. Pastikan server simulasi Python aktif."
      );
      setShowPyodideFallbackButton(Boolean(res.canFallbackToPyodide));
    }
  };

  // Jika input saat ini tidak valid, tampilkan pesan kesalahan yang jelas dan tombol perbaikan
  if (hasValidationError) {
    return (
      <div className="flex flex-col gap-6 p-5 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-rose-200 shadow-xs flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-700 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900">
                Kondisi Penerbangan Perlu Diperbaiki Sebelum Menjalankan Simulasi
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Sistem tidak menjalankan perhitungan atau menampilkan rekomendasi ketika persentase
                penumpang membawa bagasi belum valid untuk pesawat yang dipilih.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-xs">
            {baggageError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 font-medium">
                • <strong>Penumpang Membawa Bagasi:</strong> {baggageError}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onGoToAircraftLayout}
              className="px-4 py-2.5 rounded-xl bg-[#086288] hover:bg-[#064e6d] text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Perbaiki Input di Menu Pesawat
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Jika belum ada hasil evaluasi atau pengguna baru masuk ke halaman Hasil
  if (!azboSummary) {
    return (
      <div className="flex flex-col gap-6 p-5 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-sky-50 text-[#086288] shrink-0">
              <Cpu className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-900">
                Siap Menjalankan Simulasi Boarding
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Kondisi penerbangan Anda ({selectedLayout.name}, {passengerCountInput} penumpang —
                100% kursi terisi, {computedBaggageCount} orang atau {baggagePercentInput}% membawa
                bagasi kabin) siap dievaluasi. Klik tombol di bawah untuk menjalankan simulasi dan
                melihat metode yang direkomendasikan beserta animasi boarding.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Cpu className="w-4 h-4 text-[#086288] shrink-0" />
              <span data-testid="results-active-engine-label">
                {getAzboExecutionEngineLabel(executionEngine)}
              </span>
            </div>
            <div className="inline-flex items-center p-1 rounded-xl bg-white border border-slate-200/90 self-start sm:self-center">
              <button
                type="button"
                disabled={isEvaluating}
                onClick={() => {
                  onChangeExecutionEngine("pythonanywhere");
                  setRunError(null);
                  setShowPyodideFallbackButton(false);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  executionEngine === "pythonanywhere"
                    ? "bg-[#086288] text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                PythonAnywhere (Utama)
              </button>
              <button
                type="button"
                disabled={isEvaluating}
                onClick={() => {
                  onChangeExecutionEngine("pyodide");
                  setRunError(null);
                  setShowPyodideFallbackButton(false);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  executionEngine === "pyodide"
                    ? "bg-[#086288] text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Pyodide di Browser
              </button>
            </div>
          </div>

          {isEvaluating && (
            <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#086288]">
                <span className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 animate-spin shrink-0" />
                  <span>
                    {evaluationProgressMessage || "Menjalankan simulasi boarding..."}
                  </span>
                </span>
                <span className="font-mono font-bold">
                  {Math.round(evaluationProgressPercent)}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-sky-200/70 overflow-hidden">
                <div
                  className="h-full bg-[#086288] transition-all duration-300 rounded-full"
                  style={{
                    width: `${Math.max(5, Math.min(100, evaluationProgressPercent))}%`,
                  }}
                />
              </div>
            </div>
          )}

          {runError && (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-xs text-rose-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <strong className="block">Simulasi Tidak Dapat Dijalankan:</strong>
                <span>{runError}</span>
              </div>
              {(showPyodideFallbackButton || canOfferPyodideFallback) && (
                <button
                  type="button"
                  disabled={isEvaluating}
                  onClick={() => handleTriggerEvaluation("pyodide")}
                  className="px-4 py-2.5 rounded-xl bg-[#086288] hover:bg-[#064e6d] text-white font-bold text-xs shrink-0 transition-colors cursor-pointer self-start sm:self-center inline-flex items-center gap-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Jalankan Simulasi dengan Pyodide di Browser</span>
                </button>
              )}
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              disabled={isEvaluating}
              onClick={() => handleTriggerEvaluation()}
              className={`px-5 py-3 rounded-xl font-bold text-xs shadow-md transition-all inline-flex items-center gap-2 ${
                isEvaluating
                  ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                  : "bg-[#086288] hover:bg-[#064e6d] text-white shadow-[#086288]/20 cursor-pointer"
              }`}
            >
              {isEvaluating ? (
                <>
                  <Cpu className="w-4 h-4 animate-spin" />
                  <span>Menjalankan Simulasi...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Jalankan Simulasi Sekarang</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const {
    scenario,
    recommendedMethod,
    evaluatedMethods,
    zoneOptimizationAudit,
    selectionRationale,
    closeCompetitionNote,
    scientificCaveats,
    azboImplementationNotes,
  } = azboSummary;

  const activeResultEngineLabel =
    azboSummary.executionEngineLabel ||
    getAzboExecutionEngineLabel(azboSummary.executionEngine ?? executionEngine);

  const slowestTimeS =
    evaluatedMethods[evaluatedMethods.length - 1]?.metrics.boarding_time_seconds ||
    recommendedMethod.metrics.boarding_time_seconds;

  const callingSteps =
    recommendedMethod.callingSteps && recommendedMethod.callingSteps.length > 0
      ? recommendedMethod.callingSteps
      : [];

  return (
    <div className="flex flex-col gap-6 p-5 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Pemberitahuan jika input pada Menu 1 telah diubah namun evaluasi belum diperbarui */}
      {isScenarioDirty && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Kondisi Penerbangan Baru Belum Disimulasikan:</span>{" "}
              Hasil di bawah ini berasal dari simulasi sebelumnya ({scenario.layout.name},{" "}
              {scenario.passengerCount} penumpang, {scenario.baggagePassengerCount} orang membawa
              bagasi kabin). Klik tombol di samping untuk memperbarui hasil sesuai kondisi terbaru (
              {selectedLayout.name}, {passengerCountInput} penumpang, {computedBaggageCount} orang
              membawa bagasi kabin).
            </div>
          </div>
          <button
            type="button"
            disabled={isEvaluating}
            onClick={() => handleTriggerEvaluation()}
            className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs shrink-0 transition-colors cursor-pointer"
          >
            {isEvaluating ? "Memperbarui..." : "Perbarui Simulasi"}
          </button>
        </div>
      )}

      {runError && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-xs text-rose-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div>
            <strong className="block">Gagal Memperbarui Simulasi:</strong>
            <span>{runError}</span>
          </div>
          {(showPyodideFallbackButton || canOfferPyodideFallback) && (
            <button
              type="button"
              disabled={isEvaluating}
              onClick={() => handleTriggerEvaluation("pyodide")}
              className="px-4 py-2 rounded-xl bg-[#086288] hover:bg-[#064e6d] text-white font-bold text-xs shrink-0 transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Jalankan Simulasi dengan Pyodide di Browser</span>
            </button>
          )}
        </div>
      )}

      {/* 1. Ringkasan Kondisi Penerbangan yang Disimulasikan */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              1. Ringkasan Kondisi Penerbangan
            </span>
            <span
              data-testid="results-active-engine-label"
              className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-[#086288] border border-sky-200 inline-flex items-center gap-1.5"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>{activeResultEngineLabel}</span>
            </span>
          </div>
          <button
            type="button"
            disabled={isEvaluating}
            onClick={() => handleTriggerEvaluation()}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
          >
            {isEvaluating ? "Menjalankan..." : "Jalankan Ulang Simulasi"}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
              <Plane className="w-3.5 h-3.5 text-[#086288]" />
              Pilih Pesawat
            </span>
            <span className="text-sm font-bold text-slate-900">
              {scenario.layout.name}
            </span>
            <span className="text-xs text-slate-600 font-mono">
              Susunan {scenario.layout.seatConfiguration} • {scenario.layout.nRows} Baris •{" "}
              {scenario.layout.capacity} Kursi
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#086288]" />
              Kondisi Penumpang
            </span>
            <span className="text-lg font-bold text-slate-900 font-mono">
              {scenario.passengerCount} Orang
            </span>
            <span className="text-xs text-slate-600 font-mono">
              100% kursi terisi ({scenario.layout.capacity} kursi)
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
              <Luggage className="w-3.5 h-3.5 text-amber-700" />
              Penumpang Membawa Bagasi
            </span>
            <span className="text-lg font-bold text-slate-900 font-mono">
              {scenario.baggagePassengerCount} Orang (
              {scenario.baggagePercent ??
                Math.round(
                  (scenario.baggagePassengerCount / Math.max(1, scenario.passengerCount)) * 100
                )}
              %)
            </span>
            <span className="text-xs text-slate-600 font-mono">
              {Math.max(0, scenario.passengerCount - scenario.baggagePassengerCount)} orang tanpa
              bagasi kabin
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-100 flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-[#086288] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#086288]" />
              Metode yang Diuji
            </span>
            <span className="text-lg font-bold text-[#086288] font-mono">
              {evaluatedMethods.length} Metode
            </span>
            <span className="text-xs text-slate-600 font-mono">
              Rata-rata dari {scenario.testReplications ?? 20} simulasi berulang
            </span>
          </div>
        </div>
      </div>

      {/* 2. Kartu Metode yang Direkomendasikan & Urutan Boarding */}
      <div className="bg-gradient-to-r from-[#086288] via-[#12739E] to-[#4D8DBA] rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-[#086288]/10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-3.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold text-[#FFEFC4]">
              <Award className="w-4 h-4" />
              <span>2. METODE YANG DIREKOMENDASIKAN</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {recommendedMethod.shortLabel}
            </h2>

            <p className="text-xs sm:text-sm text-sky-100 leading-relaxed">
              {selectionRationale}
            </p>

            {closeCompetitionNote && (
              <div className="p-3 rounded-2xl bg-white/10 border border-white/20 text-xs text-[#FFEFC4] leading-relaxed">
                {closeCompetitionNote}
              </div>
            )}

            {/* Urutan Boarding (Urutan Pemanggilan Penumpang untuk Petugas Operasional) */}
            {callingSteps.length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-900/35 border border-white/15 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-[#FFEFC4]">
                  Urutan Boarding (Panduan Pemanggilan Penumpang):
                </div>
                <ol className="space-y-1.5 text-xs text-sky-50 leading-relaxed list-decimal list-inside">
                  {callingSteps.map((stepText, idx) => (
                    <li key={idx} className="font-medium">
                      {stepText}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {recommendedMethod.zoneConfigUsed && (
              <div className="p-3 rounded-2xl bg-slate-900/30 border border-white/15 text-xs font-mono text-[#FFEFC4]">
                Jumlah Zona: {recommendedMethod.zoneConfigUsed.kZones ?? recommendedMethod.zoneConfigUsed.sizes.length} Zona •{" "}
                {recommendedMethod.zoneConfigUsed.boundaries.length > 0
                  ? `Batas baris [${recommendedMethod.zoneConfigUsed.boundaries.join(", ")}] • `
                  : ""}
                Ukuran [{recommendedMethod.zoneConfigUsed.sizes.join(", ")} baris] • Urutan panggilan
                Zona {recommendedMethod.zoneConfigUsed.order.join(" → ")}
              </div>
            )}

            <div className="pt-1 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  scrollToAnimationSection();
                  handleStartOrResume();
                }}
                className="px-4 py-2.5 rounded-xl bg-[#FFEFC4] hover:bg-[#ffe59e] text-slate-900 font-bold text-xs shadow-sm transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Lihat Animasi Boarding di Bawah</span>
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 gap-3 bg-slate-900/35 backdrop-blur-md p-5 rounded-2xl border border-white/15">
            <div className="p-3.5 rounded-xl bg-white/10">
              <span className="text-[11px] text-sky-200 block">
                Perkiraan Waktu Boarding (Detik)
              </span>
              <span className="text-2xl font-bold text-white font-mono tabular-nums">
                {recommendedMethod.metrics.boarding_time_seconds.toFixed(1)} dtk
              </span>
              {recommendedMethod.sdSeconds !== undefined && (
                <span className="block text-[10px] text-sky-200 font-mono mt-0.5">
                  ±{recommendedMethod.sdSeconds.toFixed(1)} dtk (Rentang 95%:{" "}
                  {recommendedMethod.ci95Seconds?.[0].toFixed(1)}–
                  {recommendedMethod.ci95Seconds?.[1].toFixed(1)} dtk)
                </span>
              )}
            </div>
            <div className="p-3.5 rounded-xl bg-white/10">
              <span className="text-[11px] text-sky-200 block">
                Perkiraan Waktu Boarding (Menit)
              </span>
              <span className="text-2xl font-bold text-[#FFEFC4] font-mono tabular-nums">
                {recommendedMethod.metrics.boarding_time_minutes.toFixed(2)} mnt
              </span>
              <span className="block text-[10px] text-sky-200 font-mono mt-0.5">
                Rata-rata {scenario.testReplications ?? 20} kali simulasi
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-white/10">
              <span className="text-[11px] text-sky-200 block">
                Rata-rata Antre di Lorong
              </span>
              <span className="text-lg font-bold text-white font-mono tabular-nums">
                {recommendedMethod.metrics.aisle_interference_events} kali
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-white/10">
              <span className="text-[11px] text-sky-200 block">
                Rata-rata Halangan Kursi
              </span>
              <span className="text-lg font-bold text-white font-mono tabular-nums">
                {recommendedMethod.metrics.seat_interference_events} kali
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Perbandingan Metode yang Benar-Benar Diuji */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#086288]" />
              <span>3. Perbandingan Metode Boarding</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Diurutkan berdasarkan rata-rata perkiraan waktu boarding tercepat dari{" "}
              {scenario.testReplications ?? 20} simulasi berulang pada {scenario.layout.name}.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Satuan: Detik (dtk) & Menit (mnt)
          </span>
        </div>

        {/* Grafik Batang Horisontal Skala Konsisten */}
        <div className="flex flex-col gap-3">
          {evaluatedMethods.map((row) => {
            const widthPct =
              slowestTimeS > 0
                ? Math.max(
                    12,
                    (row.metrics.boarding_time_seconds / slowestTimeS) * 100
                  )
                : 100;
            const isBest = row.rank === 1;

            return (
              <div
                key={row.methodName}
                className={`p-3.5 rounded-2xl border transition-all ${
                  isBest
                    ? "bg-emerald-50/50 border-emerald-200"
                    : "bg-slate-50/70 border-slate-200/80"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-full text-xs font-bold font-mono flex items-center justify-center shrink-0 ${
                        isBest
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {row.rank}
                    </span>
                    <span className="font-bold text-slate-900 break-words">
                      {row.shortLabel}
                    </span>
                    <span className="text-[11px] text-slate-500 hidden sm:inline">
                      ({row.category})
                    </span>
                    {isBest && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Direkomendasikan (Tercepat)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 font-mono text-xs shrink-0">
                    <span className="font-bold text-slate-900">
                      {row.metrics.boarding_time_seconds.toFixed(1)} dtk (
                      {row.metrics.boarding_time_minutes.toFixed(2)} mnt)
                    </span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-md ${
                        isBest
                          ? "bg-emerald-100 text-emerald-800 font-bold"
                          : "bg-slate-200/80 text-slate-600"
                      }`}
                    >
                      {isBest
                        ? "Tercepat"
                        : `+${row.differenceFromBestSeconds.toFixed(1)} dtk (+${row.differenceFromBestPercent.toFixed(1)}%)`}
                    </span>
                  </div>
                </div>

                <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isBest ? "bg-emerald-600" : "bg-[#086288]"
                    }`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Tabel Detail Evaluasi */}
        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                <th className="py-3 px-4">Peringkat</th>
                <th className="py-3 px-4">Metode Boarding</th>
                <th className="py-3 px-4 text-right">Waktu (Detik)</th>
                <th className="py-3 px-4 text-right">Waktu (Menit)</th>
                <th className="py-3 px-4 text-right">Selisih dr Tercepat</th>
                <th className="py-3 px-4 text-right">Antre Lorong</th>
                <th className="py-3 px-4 text-right">Halangan Kursi</th>
                <th className="py-3 px-4 text-center">Status Evaluasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {evaluatedMethods.map((row) => {
                const isBest = row.rank === 1;
                return (
                  <tr
                    key={row.methodName}
                    className={
                      isBest
                        ? "bg-emerald-50/40 font-medium"
                        : "hover:bg-slate-50/80"
                    }
                  >
                    <td className="py-3 px-4 font-mono font-bold">
                      #{row.rank}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">
                        {row.shortLabel}
                      </div>
                      {row.zoneConfigUsed && (
                        <div className="text-[11px] font-mono text-slate-500">
                          Batas baris [{row.zoneConfigUsed.boundaries.join(", ")}] • Urutan [
                          {row.zoneConfigUsed.order.join("→")}]
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {row.metrics.boarding_time_seconds.toFixed(1)} dtk
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      {row.metrics.boarding_time_minutes.toFixed(2)} mnt
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {isBest
                        ? "0,0 dtk (Tercepat)"
                        : `+${row.differenceFromBestSeconds.toFixed(1)} dtk`}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      {row.metrics.aisle_interference_events} kali
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      {row.metrics.seat_interference_events} kali
                    </td>
                    <td className="py-3 px-4 text-center">
                      {isBest ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-[11px] inline-flex items-center gap-1">
                          <Award className="w-3 h-3" />
                          <span>Metode Terbaik</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 font-mono text-[11px]">
                          Peringkat #{row.rank}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Bagian Simulasi Gerakan Metode Terbaik & Visualisasi Animasi Denah Kabin */}
      {bestMethodSimulationData && (
        <div
          ref={animationSectionRef}
          className="flex flex-col gap-5 scroll-mt-24"
        >
          {/* Kontrol Pemutaran Animasi & Indikator Kemajuan Metode Terbaik */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#086288]">
                  4. Simulasi Gerakan Metode Terbaik
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                  Visualisasi Pergerakan Boarding: {recommendedMethod.shortLabel}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Menampilkan simulasi pergerakan {scenario.passengerCount} penumpang (
                  {scenario.baggagePassengerCount} orang membawa bagasi kabin) pada{" "}
                  {scenario.layout.name} menggunakan metode terbaik hasil optimasi AZBO.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 self-start sm:self-auto">
                Metode Terbaik: {recommendedMethod.shortLabel}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Tombol Mulai, Jeda, Lanjutkan, Ulangi */}
              <div className="flex flex-wrap items-center gap-2">
                {!isPlaying ? (
                  <button
                    type="button"
                    onClick={handleStartOrResume}
                    className="px-4 py-2.5 rounded-xl bg-[#086288] hover:bg-[#064e6d] text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>
                      {currentTimeS > 0 && currentTimeS < totalDurationS
                        ? "Lanjutkan"
                        : "Mulai"}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePause}
                    className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Jeda</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleRepeat}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Ulangi</span>
                </button>

                {/* Pengatur Kecepatan Animasi */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 ml-1">
                  <span className="text-[11px] font-semibold text-slate-500 px-2 flex items-center gap-1">
                    <FastForward className="w-3 h-3" />
                    Kecepatan Visual:
                  </span>
                  {[1, 2, 5, 10, 20].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setPlaybackSpeed(spd)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                        playbackSpeed === spd
                          ? "bg-[#086288] text-white shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Catatan Pemisahan Kecepatan Visual vs Waktu Model */}
              <div className="text-[11px] text-slate-500">
                Kecepatan visual ({playbackSpeed}x) hanya mempercepat tayangan animasi dan{" "}
                <strong>tidak mengubah hasil waktu boarding model</strong>.
              </div>
            </div>

            {/* Slider Kemajuan Simulasi */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-[#086288]">
                  Waktu Berjalan: {currentTimeS.toFixed(1)} dtk / {totalDurationS.toFixed(1)}{" "}
                  dtk ({bestMethodSimulationData.metrics.boarding_time_minutes.toFixed(2)} menit)
                </span>
                <span className="font-bold text-slate-700">
                  Kemajuan Simulasi: {progressPercent.toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={totalDurationS}
                step={0.1}
                value={currentTimeS}
                onChange={(e) => {
                  setIsPlaying(false);
                  setCurrentTimeS(parseFloat(e.target.value));
                }}
                className="w-full accent-[#086288] cursor-pointer h-2 rounded-lg bg-slate-200"
                aria-label="Linimasa waktu simulasi metode terbaik"
              />
            </div>

            {/* 4 Kartu Indikator Animasi Real-Time */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    Waktu Boarding Model
                  </span>
                  <span className="text-lg font-bold text-slate-900 font-mono">
                    {totalDurationS.toFixed(1)} dtk
                  </span>
                  <span className="block text-[11px] text-[#086288] font-mono font-semibold">
                    ({bestMethodSimulationData.metrics.boarding_time_minutes.toFixed(2)} menit)
                  </span>
                </div>
                <Clock className="w-5 h-5 text-[#086288]" />
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-emerald-800 block">
                    Penumpang Sudah Duduk
                  </span>
                  <span className="text-lg font-bold text-emerald-950 font-mono">
                    {seatedCount} / {bestMethodSimulationData.metrics.passenger_count}
                  </span>
                  <span className="block text-[11px] text-emerald-700 font-mono">
                    (
                    {(
                      (seatedCount / bestMethodSimulationData.metrics.passenger_count) *
                      100
                    ).toFixed(0)}
                    % selesai)
                  </span>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-amber-900 block">
                    Masih Menunggu / di Lorong
                  </span>
                  <span className="text-lg font-bold text-amber-950 font-mono">
                    {waitingInQueueCount + inAisleCount} orang
                  </span>
                  <span className="block text-[11px] text-amber-800 font-mono">
                    {inAisleCount} di lorong • {waitingInQueueCount} antre pintu
                  </span>
                </div>
                <Users className="w-5 h-5 text-amber-700" />
              </div>

              <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-[#086288] block">
                    Antre Lorong & Halangan Kursi
                  </span>
                  <span className="text-lg font-bold text-slate-900 font-mono">
                    {bestMethodSimulationData.metrics.aisle_interference_events} antrean
                  </span>
                  <span className="block text-[11px] text-slate-600 font-mono">
                    {bestMethodSimulationData.metrics.seat_interference_events} halangan kursi
                  </span>
                </div>
                <Layers className="w-5 h-5 text-[#086288]" />
              </div>
            </div>
          </div>

          {/* Visualisasi Denah Kabin & Animasi Pergerakan Penumpang Metode Terbaik */}
          <div className="bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-lg text-slate-200 flex flex-col gap-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Plane className="w-4 h-4 text-[#97D7FF]" />
                  <h4 className="text-base font-bold text-white">
                    Animasi Denah Kabin dari Atas: {scenario.layout.name} (
                    {scenario.layout.seatConfiguration})
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#97D7FF]/20 text-[#97D7FF]">
                    Metode Rekomendasi: {recommendedMethod.shortLabel}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Klik kursi untuk memeriksa waktu masuk, durasi simpan bagasi, dan halangan
                  kursi penumpang tersebut.
                </p>
              </div>

              {/* Legenda Status Visual */}
              <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-800/80 px-3.5 py-2 rounded-2xl border border-slate-700">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-sky-400 inline-block" />
                  <span>Berjalan di Lorong</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                  <span>Menyimpan Bagasi</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                  <span>Terhalang Kursi</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
                  <span>Sudah Duduk</span>
                </span>
              </div>
            </div>

            {/* Area Denah Kabin Adaptif (Mendukung 2-2, 2-3, dan 3-3) */}
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[680px] flex flex-col gap-2">
                {/* Baris Kursi Sisi Kiri */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Sisi Kiri Kabin (Kursi {scenario.layout.leftSeats.join(", ")})
                  </span>
                  {scenario.layout.leftSeats.map((seatLetter) => (
                    <div
                      key={`left-${seatLetter}`}
                      className="grid gap-1"
                      style={{
                        gridTemplateColumns: `repeat(${scenario.layout.nRows}, minmax(20px, 1fr))`,
                      }}
                    >
                      {Array.from(
                        { length: scenario.layout.nRows },
                        (_, i) => i + 1
                      ).map((rowNum) => {
                        const rowStr = rowNum.toString().padStart(2, "0");
                        const seatId = `R${rowStr}${seatLetter}`;
                        const detail = seatDetailsMap[seatId];
                        const isOccupied = Boolean(detail);
                        const isSeated =
                          detail && currentTimeS >= detail.finish_time_s;
                        const isEnteringSeat =
                          detail &&
                          currentTimeS >= detail.arrival_target_s &&
                          currentTimeS < detail.finish_time_s;

                        return (
                          <button
                            key={seatId}
                            type="button"
                            onClick={() => detail && setSelectedSeatDetail(detail)}
                            className={`h-6 rounded-md text-[9px] font-mono font-bold border transition-all flex items-center justify-center ${
                              !isOccupied
                                ? "bg-slate-900/50 border-slate-800 text-slate-600 cursor-default"
                                : isSeated
                                ? "bg-emerald-600 border-emerald-400 text-white shadow-2xs cursor-pointer"
                                : isEnteringSeat
                                ? "bg-amber-500 border-amber-300 text-slate-950 animate-pulse cursor-pointer"
                                : "bg-slate-800 border-slate-600 text-slate-300 hover:border-sky-400 cursor-pointer"
                            }`}
                            title={
                              detail
                                ? `Kursi ${seatId} (Antrean #${detail.queue_position}, Selesai: ${detail.finish_time_s.toFixed(1)}s)`
                                : `Kursi ${seatId} (Kosong pada skenario ini)`
                            }
                          >
                            {seatLetter}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Lorong Pesawat (1..nRows) */}
                <div className="py-2 px-2 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                    <span className="font-semibold text-emerald-400">
                      → PINTU MASUK DEPAN (Baris 1)
                    </span>
                    <span className="font-mono text-[#97D7FF]">
                      LORONG TUNGGAL KABIN ({scenario.layout.nRows} BARIS)
                    </span>
                    <span>BAGIAN EKOR (Baris {scenario.layout.nRows})</span>
                  </div>

                  <div
                    className="grid gap-1"
                    style={{
                      gridTemplateColumns: `repeat(${scenario.layout.nRows}, minmax(20px, 1fr))`,
                    }}
                  >
                    {Array.from(
                      { length: scenario.layout.nRows },
                      (_, i) => i + 1
                    ).map((rowNum) => {
                      const occ = rowOccupation[rowNum];
                      const zoneId =
                        activeZoneBoundaries !== null
                          ? zoneOfRow(rowNum, activeZoneBoundaries)
                          : null;

                      return (
                        <div
                          key={`aisle-row-${rowNum}`}
                          className={`h-8 rounded-lg border flex flex-col items-center justify-center relative transition-all ${
                            occ
                              ? occ.hasConflict
                                ? "bg-rose-600 border-rose-300 text-white shadow-md"
                                : occ.isTargetRow
                                ? "bg-amber-500 border-amber-200 text-slate-950 shadow-md"
                                : "bg-sky-500 border-sky-200 text-slate-950"
                              : zoneId === 2
                              ? "bg-slate-900/80 border-slate-800 text-slate-500"
                              : "bg-slate-900 border-slate-800 text-slate-500"
                          }`}
                          title={
                            occ
                              ? occ.secondaryPassenger
                                ? `Baris ${rowNum}: Sel #1 Penumpang #${occ.secondaryPassenger.queue_position} (${occ.secondaryPassenger.seat_id}) & Sel #2 Penumpang #${occ.passenger.queue_position} (${occ.passenger.seat_id})`
                                : `Baris ${rowNum}: Penumpang #${occ.passenger.queue_position} menuju ${occ.passenger.seat_id}`
                              : zoneId !== null
                              ? `Lorong Baris ${rowNum} (Zona ${zoneId})`
                              : `Lorong Baris ${rowNum}`
                          }
                        >
                          {occ ? (
                            occ.secondaryPassenger ? (
                              <span className="text-[7px] leading-tight font-mono font-extrabold text-center">
                                #{occ.secondaryPassenger.queue_position}
                                <br />#{occ.passenger.queue_position}
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono font-extrabold">
                                #{occ.passenger.queue_position}
                              </span>
                            )
                          ) : (
                            <span className="text-[9px] font-mono">{rowNum}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Baris Kursi Sisi Kanan */}
                <div className="flex flex-col gap-1">
                  {scenario.layout.rightSeats.map((seatLetter) => (
                    <div
                      key={`right-${seatLetter}`}
                      className="grid gap-1"
                      style={{
                        gridTemplateColumns: `repeat(${scenario.layout.nRows}, minmax(20px, 1fr))`,
                      }}
                    >
                      {Array.from(
                        { length: scenario.layout.nRows },
                        (_, i) => i + 1
                      ).map((rowNum) => {
                        const rowStr = rowNum.toString().padStart(2, "0");
                        const seatId = `R${rowStr}${seatLetter}`;
                        const detail = seatDetailsMap[seatId];
                        const isOccupied = Boolean(detail);
                        const isSeated =
                          detail && currentTimeS >= detail.finish_time_s;
                        const isEnteringSeat =
                          detail &&
                          currentTimeS >= detail.arrival_target_s &&
                          currentTimeS < detail.finish_time_s;

                        return (
                          <button
                            key={seatId}
                            type="button"
                            onClick={() => detail && setSelectedSeatDetail(detail)}
                            className={`h-6 rounded-md text-[9px] font-mono font-bold border transition-all flex items-center justify-center ${
                              !isOccupied
                                ? "bg-slate-900/50 border-slate-800 text-slate-600 cursor-default"
                                : isSeated
                                ? "bg-emerald-600 border-emerald-400 text-white shadow-2xs cursor-pointer"
                                : isEnteringSeat
                                ? "bg-amber-500 border-amber-300 text-slate-950 animate-pulse cursor-pointer"
                                : "bg-slate-800 border-slate-600 text-slate-300 hover:border-sky-400 cursor-pointer"
                            }`}
                            title={
                              detail
                                ? `Kursi ${seatId} (Antrean #${detail.queue_position}, Selesai: ${detail.finish_time_s.toFixed(1)}s)`
                                : `Kursi ${seatId} (Kosong pada skenario ini)`
                            }
                          >
                            {seatLetter}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                    Sisi Kanan Kabin (Kursi {scenario.layout.rightSeats.join(", ")})
                  </span>
                </div>
              </div>
            </div>

            {/* Urutan Antrean Penumpang sesuai Metode Terbaik */}
            <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200">
                  Urutan Antrean Masuk Penumpang ({recommendedMethod.shortLabel}):
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Menampilkan 30 urutan pertama dari{" "}
                  {bestMethodSimulationData.details.length} penumpang
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {bestMethodSimulationData.details.slice(0, 30).map((d) => {
                  const done = currentTimeS >= d.finish_time_s;
                  const active =
                    currentTimeS >= d.entry_time_s &&
                    currentTimeS < d.finish_time_s;
                  return (
                    <button
                      key={d.seat_id}
                      type="button"
                      onClick={() => setSelectedSeatDetail(d)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold shrink-0 border transition-colors cursor-pointer ${
                        done
                          ? "bg-emerald-950/80 border-emerald-700 text-emerald-300"
                          : active
                          ? "bg-amber-500 border-amber-300 text-slate-950 font-bold"
                          : "bg-slate-800 border-slate-700 text-slate-300"
                      }`}
                    >
                      #{d.queue_position} {d.seat_id} {d.has_bag ? "🧳" : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detail Penumpang Terpilih */}
            {selectedSeatDetail && (
              <div className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#FFEFC4] text-sm">
                      Kursi {selectedSeatDetail.seat_id} (Antrean #
                      {selectedSeatDetail.queue_position})
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-200 text-[10px]">
                      {selectedSeatDetail.has_bag
                        ? "Membawa Bagasi Kabin"
                        : "Tanpa Bagasi Kabin"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-slate-300 font-mono text-[11px]">
                    <span>
                      Masuk Pintu: {selectedSeatDetail.entry_time_s.toFixed(1)} dtk
                    </span>
                    <span>
                      Tiba di Baris {selectedSeatDetail.row}:{" "}
                      {selectedSeatDetail.arrival_target_s.toFixed(1)} dtk
                    </span>
                    <span>
                      Antre Lorong: {selectedSeatDetail.aisle_wait_s.toFixed(1)} dtk
                    </span>
                    <span>
                      Simpan Bagasi: {selectedSeatDetail.bag_stowage_s.toFixed(1)} dtk
                    </span>
                    <span>
                      Halangan Kursi: {selectedSeatDetail.seat_interference_s.toFixed(1)}{" "}
                      dtk ({selectedSeatDetail.occupied_blockers} penghalang)
                    </span>
                    <span className="text-emerald-300 font-bold">
                      Selesai Duduk: {selectedSeatDetail.finish_time_s.toFixed(1)} dtk
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSeatDetail(null)}
                  className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 self-end sm:self-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Keterangan Ringkas Batasan Estimasi Simulasi & Informasi Model Opsional */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col gap-3">
        <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-[#086288] shrink-0 mt-0.5" />
          <p>
            {azboSummary.disclaimer ||
              "Hasil merupakan perkiraan berdasarkan model simulasi dan belum menggantikan pengujian operasional di lapangan."}
          </p>
        </div>

        <details className="text-xs text-slate-600 bg-slate-50/90 rounded-2xl border border-slate-200/80 px-4 py-3">
          <summary className="font-semibold text-slate-700 cursor-pointer select-none flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-[#086288] shrink-0" />
            <span>Lihat Rincian Penelitian: Informasi Model, Statistik Simulasi, & Referensi Jurnal</span>
          </summary>

          <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-col gap-4 leading-relaxed">
            {/* Ringkasan Audit Optimasi Zona AZBO */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 flex flex-col justify-between gap-1.5">
                <div>
                  <span className="font-bold text-[#086288]">
                    Konfigurasi Zona Terbaik ({zoneOptimizationAudit.kZones} Zona)
                  </span>
                  <div className="text-base font-bold text-slate-900 tabular-nums mt-0.5">
                    {zoneOptimizationAudit.bestZoneConfig.boardingTimeSeconds.toFixed(1)} detik (
                    {zoneOptimizationAudit.bestZoneConfig.boardingTimeMinutes.toFixed(2)} mnt)
                  </div>
                </div>
                <div className="text-[11px] text-slate-700 space-y-0.5 pt-1.5 border-t border-sky-200/70">
                  <div>
                    Batas baris:{" "}
                    {zoneOptimizationAudit.bestZoneConfig.boundaries.length > 0
                      ? `Baris ${zoneOptimizationAudit.bestZoneConfig.boundaries.join(" & ")}`
                      : "Seluruh baris dalam 1 zona"}
                  </div>
                  <div>
                    Ukuran zona: {zoneOptimizationAudit.bestZoneConfig.sizes.join(", ")} baris •
                    Urutan: Zona {zoneOptimizationAudit.bestZoneConfig.order.join(" → Zona ")}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex flex-col justify-between gap-1.5">
                <div>
                  <span className="font-bold text-slate-700">
                    Aturan Dalam Zona & Replikasi Evaluasi
                  </span>
                  <div className="text-base font-bold text-slate-900 tabular-nums mt-0.5">
                    {zoneOptimizationAudit.inZoneRule === "BTF_IN_ZONE"
                      ? "Belakang ke Depan (BTF)"
                      : "Jendela–Tengah–Lorong (WMA)"}
                  </div>
                </div>
                <div className="text-[11px] text-slate-600 space-y-0.5 pt-1.5 border-t border-slate-100">
                  <div>
                    Replikasi optimasi: {scenario.trainReplications ?? 3} run •
                    Evaluasi akhir: {scenario.testReplications ?? 20} run
                  </div>
                  <div>
                    Invarian fisik lorong:{" "}
                    <strong>
                      Maks. 1 penumpang per sel (0,4 m) tanpa saling mendahului (FIFO)
                    </strong>
                  </div>
                  <div>
                    Kesetaraan urutan AZBO &amp; WMA:{" "}
                    <strong>
                      {zoneOptimizationAudit.azboWilmaEquivalenceVerified
                        ? "Identik pada seluruh replikasi (K = 1 + WMA)"
                        : "Berbeda (konfigurasi zona spesifik)"}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between gap-1.5">
                <div>
                  <span className="font-bold text-emerald-900">
                    Cakupan Kandidat Zona Diuji
                  </span>
                  <div className="text-base font-bold text-emerald-950 tabular-nums mt-0.5">
                    {zoneOptimizationAudit.totalZoneCandidatesEvaluated} Evaluasi Kandidat
                  </div>
                </div>
                <p className="text-[11px] text-emerald-900/90 pt-1.5 border-t border-emerald-200/70">
                  Jumlah zona boarding (K), batas baris, urutan pemanggilan zona, dan aturan dalam
                  zona ditentukan melalui pencarian optimasi heuristik tanpa batas K tetap.
                </p>
              </div>
            </div>

            {/* Tabel Statistik Ketidakpastian & Perbandingan Berpasangan (CRN) */}
            <div className="space-y-2">
              <div className="font-bold text-slate-900">
                Rincian Statistik Replikasi Pengujian (Rerata, Simpangan Baku, CI 95%, & Selisih Berpasangan CRN):
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Metode</th>
                      <th className="py-2 px-3 text-right">Rerata ± SD (dtk)</th>
                      <th className="py-2 px-3 text-right">Rentang CI 95% (dtk)</th>
                      <th className="py-2 px-3 text-right">Min–Maks (dtk)</th>
                      <th className="py-2 px-3 text-right">CI 95% Selisih Berpasangan vs #1</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {evaluatedMethods.map((row) => (
                      <tr key={`stat-${row.methodName}`}>
                        <td className="py-2 px-3 font-bold">#{row.rank}</td>
                        <td className="py-2 px-3 font-sans font-semibold text-slate-900">
                          {row.shortLabel}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {row.metrics.boarding_time_seconds.toFixed(1)} ± {(row.sdSeconds ?? 0).toFixed(1)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          [{row.ci95Seconds?.[0].toFixed(1) ?? row.metrics.boarding_time_seconds.toFixed(1)},{" "}
                          {row.ci95Seconds?.[1].toFixed(1) ?? row.metrics.boarding_time_seconds.toFixed(1)}]
                        </td>
                        <td className="py-2 px-3 text-right">
                          {(row.minSeconds ?? row.metrics.boarding_time_seconds).toFixed(1)}–
                          {(row.maxSeconds ?? row.metrics.boarding_time_seconds).toFixed(1)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {row.rank === 1
                            ? "Acuan #1 (0,0 dtk)"
                            : `[${row.pairedDiffCi95Seconds?.[0].toFixed(1) ?? "0.0"}, +${row.pairedDiffCi95Seconds?.[1].toFixed(1) ?? "0.0"}] dtk`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="font-bold text-slate-900">
                  Mekanisme Evaluasi, Catatan Model, & Referensi Jurnal (2025):
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  {azboImplementationNotes.implementedInCode.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                  {scientificCaveats.map((item, idx) => (
                    <li key={`caveat-${idx}`}>{item}</li>
                  ))}
                  <li>
                    <strong>Referensi Ilmiah 12 Metode Boarding (Varian/Adaptasi Model Seragam):</strong>{" "}
                    Possamai Viertel, S., Pessini, L., Secomandi, L., Cavion, R., &amp; Hedler Staudt, F. (2025).{" "}
                    <em>Boarding Efficiency in Regional Aviation: A Comparative Analysis of Methods.</em>{" "}
                    (Reverse Pyramid, Rotating Zones, Modified Optimal, WMA, BTF, Random);{" "}
                    Płanda, B., &amp; Skorupski, J. (2025).{" "}
                    <em>Model for Evaluation of Aircraft Boarding Under Disturbances.</em>{" "}
                    <em>Aerospace</em>, 12(5), 403.{" "}
                    <a
                      href="https://doi.org/10.3390/aerospace12050403"
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-[#086288]"
                    >
                      https://doi.org/10.3390/aerospace12050403
                    </a>{" "}
                    (Front-to-Back Bagian 2.2.3, Reverse Pyramid Gambar 3, Rotating Zone, Steffen Gambar 4);{" "}
                    Gehlen, M. A., &amp; Ronzani, G. M. R. (2025).{" "}
                    <em>Setting Airport Boarding Strategies Based on Passengers’ Operational Data through Machine Learning Techniques.</em>{" "}
                    <em>J. Aerosp. Technol. Manag.</em>, 17, e2125 (Steffen, Block/BTF, Random);{" "}
                    Steffen, J. H., &amp; Hotchkiss, J. (2012).{" "}
                    <em>Experimental test of airplane boarding methods.</em>{" "}
                    <em>J. Air Transp. Manag.</em>, 18(1), 64–67 (Four-Row Blocks / Blok 4 Baris);{" "}
                    Dong, Y., Jia, X., Yanagisawa, D., &amp; Nishinari, K. (2025).{" "}
                    <em>Boarding strategies accounting for properties of the blended wing body aircraft.</em>{" "}
                    <em>Physica A</em>, 658, 130298 (Model sel lorong 0,4 m, adaptasi Double Outside-In Bagian 3.2 Gambar 5 untuk kabin satu lorong, &amp; reduksi N-Steffen ke Steffen klasik pada lorong tunggal).
                  </li>
                </ul>
                {azboSummary.animationReplication && (
                  <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700">
                    <span className="font-bold block text-slate-900">
                      Sumber Lintasan Animasi (Satu Replikasi Testing Nyata):
                    </span>
                    Animasi menampilkan replikasi pengujian{" "}
                    {azboSummary.animationReplication.replicationIndex !== undefined
                      ? `#${azboSummary.animationReplication.replicationIndex} `
                      : ""}
                    (seed {azboSummary.animationReplication.replicationSeed}) dengan durasi{" "}
                    {azboSummary.animationReplication.boardingTimeS.toFixed(1)} dtk yang paling
                    mendekati rata-rata sampel metode terpilih (
                    {(
                      azboSummary.animationReplication.sampleMeanS ??
                      recommendedMethod.metrics.boarding_time_seconds
                    ).toFixed(1)}{" "}
                    dtk), bukan penyamaan durasi animasi dengan rata-rata statistik.
                  </div>
                )}
                {azboImplementationNotes.missingFormalSpecInSource[0] && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
                    <span className="font-bold block">Catatan Cakupan Literatur BWB & Gangguan Operasional:</span>
                    {azboImplementationNotes.missingFormalSpecInSource[0]}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="font-bold text-slate-900">
                  Metode Literatur di Luar Cakupan Simulator Lorong Tunggal:
                </div>
                <div className="flex flex-col gap-2">
                  {unsupportedMethods.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">{m.shortLabel}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                          Di Luar Cakupan Lorong Tunggal
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Sumber: {m.sourceCitation}
                      </span>
                      <p className="text-slate-600">{m.unsupportedReason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};
