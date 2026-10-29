import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plane,
  Users,
  Luggage,
  Cpu,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Layers,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Clock,
  Activity,
  Sliders,
  Info,
  Search,
  XCircle,
} from "lucide-react";
import { AIRCRAFT_LAYOUTS, AircraftLayoutConfig } from "../simulation/engine";
import {
  AzboDecodedCandidate,
  AzboHealthResponse,
  AzboJobStatusResponse,
  AzboOptimizationResult,
  AzboOptimizeRequestPayload,
  AzboPassengerLog,
  AzboTraceEvent,
} from "../services/azboV2Client";

// Palet warna zona untuk membedakan hingga N zona secara jelas
const ZONE_PALETTE = [
  { bg: "bg-sky-500/20", border: "border-sky-400", text: "text-sky-300", badge: "bg-sky-600 text-white", hex: "#0284c7" },
  { bg: "bg-amber-500/20", border: "border-amber-400", text: "text-amber-300", badge: "bg-amber-600 text-white", hex: "#d97706" },
  { bg: "bg-emerald-500/20", border: "border-emerald-400", text: "text-emerald-300", badge: "bg-emerald-600 text-white", hex: "#059669" },
  { bg: "bg-purple-500/20", border: "border-purple-400", text: "text-purple-300", badge: "bg-purple-600 text-white", hex: "#7c3aed" },
  { bg: "bg-rose-500/20", border: "border-rose-400", text: "text-rose-300", badge: "bg-rose-600 text-white", hex: "#e11d48" },
  { bg: "bg-teal-500/20", border: "border-teal-400", text: "text-teal-300", badge: "bg-teal-600 text-white", hex: "#0d9488" },
  { bg: "bg-indigo-500/20", border: "border-indigo-400", text: "text-indigo-300", badge: "bg-indigo-600 text-white", hex: "#4f46e5" },
  { bg: "bg-orange-500/20", border: "border-orange-400", text: "text-orange-300", badge: "bg-orange-600 text-white", hex: "#ea580c" },
];

function getZoneStyle(zoneId: number) {
  return ZONE_PALETTE[(Math.max(1, zoneId) - 1) % ZONE_PALETTE.length];
}

function formatSeconds(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || Number.isNaN(sec)) return "—";
  return `${sec.toFixed(1)} dtk`;
}

function formatMinutes(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || Number.isNaN(sec)) return "—";
  return `${(sec / 60).toFixed(2)} mnt`;
}

/**
 * Komponen Mini Ilustrasi Skematis Denah Kabin dari Atas secara Utuh
 */
const MiniCabinSchematic: React.FC<{
  layout: AircraftLayoutConfig;
  isSelected: boolean;
}> = ({ layout, isSelected }) => {
  const allRows = Array.from({ length: layout.nRows }, (_, i) => i + 1);

  return (
    <div
      className={`rounded-2xl p-3 border transition-colors h-[138px] flex flex-col justify-between overflow-hidden ${
        isSelected
          ? "bg-slate-900 border-[#086288] text-slate-200"
          : "bg-slate-900/95 border-slate-800 text-slate-300"
      }`}
    >
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800 text-[10px] shrink-0">
        <span className="font-semibold text-[#97D7FF] flex items-center gap-1 truncate">
          <Plane className="w-3 h-3 shrink-0" />
          <span>
            Denah Kabin Utuh ({layout.seatConfiguration} • {layout.nRows} Baris)
          </span>
        </span>
        <span className="px-2 py-0.5 rounded bg-slate-800 text-[#FFEFC4] font-mono text-[10px] shrink-0">
          {layout.capacity} Kursi (100%)
        </span>
      </div>

      <div className="flex items-center gap-1 w-full h-[92px] overflow-hidden">
        <div className="w-7 h-full rounded-l-full bg-slate-800 border-r border-slate-700 flex flex-col items-center justify-center shrink-0">
          <span className="text-[7px] font-bold text-slate-400 leading-none">
            DEPAN
          </span>
          <span className="text-[7px] text-emerald-400 font-mono mt-0.5 leading-none">
            1L
          </span>
        </div>

        <div
          className="grid gap-[1px] flex-1 min-w-0 items-center h-full py-0.5"
          style={{
            gridTemplateColumns: `repeat(${layout.nRows}, minmax(0, 1fr))`,
          }}
        >
          {allRows.map((r) => (
            <div
              key={r}
              className="flex flex-col items-stretch justify-center gap-[1px] min-w-0"
            >
              <div className="flex flex-col gap-[1px]">
                {layout.leftSeats.map((s) => (
                  <div
                    key={s}
                    className="h-[10px] rounded-[1.5px] bg-sky-900/85 border border-sky-500/40 text-[5.5px] font-mono text-sky-200 flex items-center justify-center leading-none select-none"
                  >
                    {s}
                  </div>
                ))}
              </div>
              <div className="h-[11px] rounded-[1.5px] bg-slate-800 text-[5.5px] font-mono text-slate-300 flex items-center justify-center leading-none select-none my-[0.5px]">
                {r}
              </div>
              <div className="flex flex-col gap-[1px]">
                {layout.rightSeats.map((s) => (
                  <div
                    key={s}
                    className="h-[10px] rounded-[1.5px] bg-sky-900/85 border border-sky-500/40 text-[5.5px] font-mono text-sky-200 flex items-center justify-center leading-none select-none"
                  >
                    {s}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="w-7 h-full rounded-r-2xl bg-slate-800 border-l border-slate-700 flex flex-col items-center justify-center shrink-0">
          <span className="text-[7px] font-bold text-slate-400 leading-none">
            EKOR
          </span>
          <span className="text-[6.5px] font-mono text-slate-400 mt-0.5 leading-none">
            R{layout.nRows}
          </span>
        </div>
      </div>
    </div>
  );
};

// ==============================================================================
// HALAMAN 1 — KONFIGURASI PENERBANGAN (FLIGHT CONFIGURATION)
// ==============================================================================

export interface FlightConfigPageProps {
  selectedLayout: AircraftLayoutConfig;
  onSelectLayout: (layout: AircraftLayoutConfig) => void;
  baggagePercent: number;
  onChangeBaggagePercent: (val: number) => void;
  gaParams: {
    popSize: number;
    generations: number;
    trainReps: number;
    testReps: number;
    mutationRate: number;
    seed: number;
    zoneCallOverheadS: number;
  };
  onChangeGaParams: (next: FlightConfigPageProps["gaParams"]) => void;
  backendHealth: AzboHealthResponse | null;
  backendError: string | null;
  isCheckingHealth: boolean;
  onRecheckHealth: () => void;
  onStartOptimization: () => void;
  isJobRunning: boolean;
}

export const FlightConfigPage: React.FC<FlightConfigPageProps> = ({
  selectedLayout,
  onSelectLayout,
  baggagePercent,
  onChangeBaggagePercent,
  gaParams,
  onChangeGaParams,
  backendHealth,
  backendError,
  isCheckingHealth,
  onRecheckHealth,
  onStartOptimization,
  isJobRunning,
}) => {
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const capacity = selectedLayout.capacity;
  const bagRatio = Math.max(0, Math.min(1, baggagePercent / 100));
  const deterministicBagCarriers = Math.floor(capacity * bagRatio + 0.5);
  const nonBagCarriers = capacity - deterministicBagCarriers;
  const totalAisleCells = selectedLayout.nRows * 2; // row_pitch=0.8m, cell=0.4m -> 2 sel/baris

  const handleScrollCarousel = (direction: "left" | "right") => {
    if (!carouselRef.current) return;
    carouselRef.current.scrollBy({
      left: direction === "left" ? -480 : 480,
      behavior: "smooth",
    });
  };

  const applyPresetMode = (mode: "fast" | "standard" | "deep") => {
    if (mode === "fast") {
      onChangeGaParams({
        ...gaParams,
        popSize: 10,
        generations: 6,
        trainReps: 5,
        testReps: 15,
      });
    } else if (mode === "standard") {
      onChangeGaParams({
        ...gaParams,
        popSize: 16,
        generations: 12,
        trainReps: 8,
        testReps: 25,
      });
    } else {
      onChangeGaParams({
        ...gaParams,
        popSize: 24,
        generations: 20,
        trainReps: 10,
        testReps: 30,
      });
    }
  };

  return (
    <div className="flex flex-col gap-6 p-5 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Status Koneksi Backend Python (Single Source of Truth) */}
      <div
        className={`rounded-2xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          backendHealth
            ? "bg-emerald-950/90 border-emerald-700/70 text-emerald-100"
            : "bg-amber-950/95 border-amber-600/80 text-amber-100"
        }`}
      >
        <div className="flex items-start sm:items-center gap-3">
          {backendHealth ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
          )}
          <div>
            <div className="text-xs sm:text-sm font-bold flex flex-wrap items-center gap-2">
              <span>
                {backendHealth
                  ? "Backend Python AZBO V2 Terhubung (Single Source of Truth)"
                  : "Backend Python AZBO V2 Belum Terhubung"}
              </span>
              {backendHealth && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-800/80 text-emerald-200 font-mono text-[11px]">
                  Python {backendHealth.python_version} • FastAPI v{backendHealth.version}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {backendHealth
                ? "Seluruh simulasi sel lorong fisik (0.4 m/sel) dan optimasi GA variabel-K dijalankan secara nyata di server Python."
                : backendError ||
                  "Jalankan server Python (python3 backend/run_server.py pada port 8001). Sistem tidak menggunakan fallback simulasi lokal."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRecheckHealth}
          disabled={isCheckingHealth}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? "animate-spin" : ""}`} />
          <span>Periksa Koneksi</span>
        </button>
      </div>

      {/* 1. Katalog Layout Kabin Pesawat Terverifikasi (Horizontal Carousel) */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              Halaman 1 — Konfigurasi Penerbangan & Parameter Optimasi AZBO
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih tipe pesawat lorong tunggal, atur proporsi pembawa bagasi kabin, dan tentukan parameter evaluasi Genetic Algorithm (GA).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <span className="inline-flex items-center text-xs font-semibold text-[#086288] bg-sky-50 px-3.5 py-2 rounded-full border border-sky-200 whitespace-nowrap">
              {AIRCRAFT_LAYOUTS.length} Layout Kabin Lorong Tunggal
            </span>

            <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-slate-200 shadow-2xs text-xs whitespace-nowrap">
              <span className="font-semibold text-slate-500">Pesawat Aktif:</span>
              <strong className="font-bold text-[#086288]">{selectedLayout.name}</strong>
            </div>

            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleScrollCarousel("left")}
                aria-label="Geser katalog pesawat ke kiri"
                className="p-2 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-sky-50 hover:text-[#086288] transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleScrollCarousel("right")}
                aria-label="Geser katalog pesawat ke kanan"
                className="p-2 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-sky-50 hover:text-[#086288] transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Carousel Kartu Pesawat */}
        <div
          ref={carouselRef}
          className="zoneflow-scrollbar flex items-stretch gap-4 overflow-x-auto pb-3 pt-1 px-1 scroll-smooth snap-x snap-mandatory"
        >
          {AIRCRAFT_LAYOUTS.map((layout) => {
            const isSelected = layout.id === selectedLayout.id;
            return (
              <div
                key={layout.id}
                onClick={() => onSelectLayout(layout)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectLayout(layout);
                  }
                }}
                className={`snap-start shrink-0 w-[330px] sm:w-[370px] rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  isSelected
                    ? "bg-white border-2 border-[#086288] shadow-md shadow-[#086288]/10"
                    : "bg-white/90 border-slate-200 hover:border-sky-300"
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#086288]">
                        {layout.category}
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                        {layout.name}
                      </h3>
                    </div>
                    {isSelected && (
                      <span className="px-2.5 py-1 rounded-full bg-[#086288] text-white text-[11px] font-semibold shrink-0">
                        Aktif
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 rounded-xl p-2 border border-slate-200/80">
                    <div>
                      <div className="text-[10px] text-slate-500">Baris (N)</div>
                      <div className="text-xs font-bold font-mono text-slate-900">
                        {layout.nRows} Baris
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">Susunan</div>
                      <div className="text-xs font-bold font-mono text-slate-900">
                        {layout.seatConfiguration} ({layout.seatsPerRow}/brs)
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">Okupansi 100%</div>
                      <div className="text-xs font-bold font-mono text-[#086288]">
                        {layout.capacity} Penumpang
                      </div>
                    </div>
                  </div>
                </div>

                <MiniCabinSchematic layout={layout} isSelected={isSelected} />
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Panel Asumsi Terkunci (Okupansi 100% + Proporsi Bagasi Deterministik) & Parameter GA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri (7 kolom): Kondisi Penerbangan theta = (L, n, rho_b) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#086288]/10 text-[#086288] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Kondisi Penerbangan & Proporsi Pembawa Bagasi
                </h2>
                <p className="text-xs text-slate-500">
                  Asumsi penelitian terkunci: Okupansi 100% penuh dan jumlah pembawa bagasi deterministik.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-mono text-xs font-semibold">
              θ = (L, n={capacity}, ρ_b={bagRatio.toFixed(2)})
            </span>
          </div>

          {/* Kartu Okupansi Kursi 100% (Terkunci Sesuai Desain Penelitian) */}
          <div className="rounded-xl bg-slate-900 text-white p-4 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <div className="text-[11px] text-slate-400">Okupansi Kursi (ρ_o)</div>
              <div className="text-base font-bold font-mono text-[#FFEFC4] mt-0.5">
                100% Penuh
              </div>
              <div className="text-[10px] text-slate-400">Seluruh kursi terisi</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Total Penumpang (n)</div>
              <div className="text-base font-bold font-mono text-[#97D7FF] mt-0.5">
                {capacity} Orang
              </div>
              <div className="text-[10px] text-slate-400">
                {selectedLayout.nRows} × {selectedLayout.seatsPerRow} kursi
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Panjang Sel Lorong</div>
              <div className="text-base font-bold font-mono text-white mt-0.5">
                0.4 m / sel
              </div>
              <div className="text-[10px] text-slate-400">
                {totalAisleCells} sel lorong (0.8 m/baris)
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Ruang Zona Variabel (K)</div>
              <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                K ∈ &#123;1..{selectedLayout.nRows}&#125;
              </div>
              <div className="text-[10px] text-slate-400">Dieksplorasi oleh GA</div>
            </div>
          </div>

          {/* Kontrol Proporsi Penumpang Membawa Bagasi Kabin (rho_b) */}
          <div className="flex flex-col gap-3 bg-sky-50/60 rounded-xl p-4 border border-sky-200/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label
                htmlFor="baggage-percent-input"
                className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2"
              >
                <Luggage className="w-4 h-4 text-[#086288]" />
                <span>Proporsi Penumpang Membawa Bagasi Kabin (ρ_b)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="baggage-percent-input"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={baggagePercent}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isNaN(v)) {
                      onChangeBaggagePercent(Math.max(0, Math.min(100, Math.round(v))));
                    }
                  }}
                  className="w-20 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-right font-mono text-sm font-bold text-[#086288] focus:outline-none focus:ring-2 focus:ring-[#086288]"
                />
                <span className="text-sm font-bold text-slate-700">%</span>
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={baggagePercent}
              onChange={(e) => onChangeBaggagePercent(Number(e.target.value))}
              aria-label="Slider persentase penumpang membawa bagasi kabin"
              className="w-full accent-[#086288] cursor-pointer"
            />

            {/* Tombol Preset Cepat Proporsi Bagasi */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {[0, 30, 50, 70, 85, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => onChangeBaggagePercent(pct)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                      baggagePercent === pct
                        ? "bg-[#086288] text-white border-[#086288]"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-sky-100"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              <div className="text-xs font-mono text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                n_b = ⌊{capacity} × {bagRatio.toFixed(2)} + 0.5⌋ ={" "}
                <strong className="text-[#086288]">{deterministicBagCarriers} orang</strong>{" "}
                ({nonBagCarriers} tanpa bagasi)
              </div>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              Jumlah penumpang pembawa bagasi ditentukan secara deterministik sebesar{" "}
              <strong className="font-mono text-slate-900">{deterministicBagCarriers} orang</strong> dari{" "}
              <strong className="font-mono text-slate-900">{capacity} penumpang</strong>. Siapa saja penumpang
              yang membawa bagasi diacak pada setiap replikasi simulasi dengan durasi penyimpanan{" "}
              <span className="font-mono">Weibull(shape=1.7, scale=16 dtk)</span>.
            </p>
          </div>

          {/* Diagram Kabin & Sel Lorong Fisik (0.4 m per sel) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Pratinjau Geometri Kabin & Sel Lorong ({selectedLayout.nRows} Baris • {totalAisleCells} Sel Lorong @ 0.4 m)
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                Pintu Masuk: Depan (Sel 0 → Sel {totalAisleCells - 1})
              </span>
            </div>
            <MiniCabinSchematic layout={selectedLayout} isSelected={true} />
          </div>
        </div>

        {/* Kolom Kanan (5 kolom): Parameter Genetic Algorithm & Replikasi 2-Tahap */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#086288]/10 text-[#086288] flex items-center justify-center">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Parameter Optimasi GA & Replikasi CRN
                </h2>
                <p className="text-xs text-slate-500">
                  Evaluasi 2-tahap: Training GA + Testing Independen dengan Common Random Numbers.
                </p>
              </div>
            </div>
          </div>

          {/* Mode Preset Kecepatan Evaluasi */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => applyPresetMode("fast")}
              className={`px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                gaParams.popSize === 10 && gaParams.generations === 6
                  ? "bg-sky-50 border-[#086288] text-[#086288]"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <div className="text-xs font-bold">Mode Cepat</div>
              <div className="text-[10px] font-mono text-slate-500">Pop 10 • Gen 6 • R 5/15</div>
            </button>
            <button
              type="button"
              onClick={() => applyPresetMode("standard")}
              className={`px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                gaParams.popSize === 16 && gaParams.generations === 12
                  ? "bg-sky-50 border-[#086288] text-[#086288]"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <div className="text-xs font-bold">Standar AZBO</div>
              <div className="text-[10px] font-mono text-slate-500">Pop 16 • Gen 12 • R 8/25</div>
            </button>
            <button
              type="button"
              onClick={() => applyPresetMode("deep")}
              className={`px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                gaParams.popSize === 24 && gaParams.generations === 20
                  ? "bg-sky-50 border-[#086288] text-[#086288]"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              <div className="text-xs font-bold">Riset Penuh</div>
              <div className="text-[10px] font-mono text-slate-500">Pop 24 • Gen 20 • R 10/30</div>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ukuran Populasi GA
              </label>
              <input
                type="number"
                min={4}
                max={60}
                value={gaParams.popSize}
                onChange={(e) =>
                  onChangeGaParams({
                    ...gaParams,
                    popSize: Math.max(4, Math.min(60, Number(e.target.value) || 12)),
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Jumlah Generasi GA
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={gaParams.generations}
                onChange={(e) =>
                  onChangeGaParams({
                    ...gaParams,
                    generations: Math.max(1, Math.min(50, Number(e.target.value) || 8)),
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Replikasi Training (R_train)
              </label>
              <input
                type="number"
                min={2}
                max={40}
                value={gaParams.trainReps}
                onChange={(e) =>
                  onChangeGaParams({
                    ...gaParams,
                    trainReps: Math.max(2, Math.min(40, Number(e.target.value) || 5)),
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Replikasi Testing Baru (R_test)
              </label>
              <input
                type="number"
                min={2}
                max={80}
                value={gaParams.testReps}
                onChange={(e) =>
                  onChangeGaParams({
                    ...gaParams,
                    testReps: Math.max(2, Math.min(80, Number(e.target.value) || 15)),
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Overhead Panggilan Zona (dtk)
              </label>
              <input
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={gaParams.zoneCallOverheadS}
                onChange={(e) =>
                  onChangeGaParams({
                    ...gaParams,
                    zoneCallOverheadS: Math.max(0, Math.min(30, Number(e.target.value) || 0)),
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Seed Dasar CRN
              </label>
              <input
                type="number"
                value={gaParams.seed}
                onChange={(e) =>
                  onChangeGaParams({
                    ...gaParams,
                    seed: Number(e.target.value) || 20260419,
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm font-bold text-slate-900"
              />
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-600 leading-relaxed">
            <strong className="text-slate-800">Representasi Kromosom AZBO:</strong> Vektor biner pemotongan{" "}
            <span className="font-mono">c ∈ &#123;0,1&#125;^({selectedLayout.nRows - 1})</span> menghasilkan jumlah
            zona variabel <span className="font-mono">K = 1 + Σ c_j ∈ &#123;1, ..., {selectedLayout.nRows}&#125;</span>,
            dikombinasikan dengan urutan pemanggilan zona dan aturan internal{" "}
            <span className="font-mono">WMA_IN_ZONE</span> atau <span className="font-mono">BTF_IN_ZONE</span>.
          </div>

          <button
            type="button"
            onClick={onStartOptimization}
            disabled={isJobRunning}
            className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#086288] to-[#4D8DBA] hover:from-[#064e6d] hover:to-[#3b76a0] disabled:opacity-60 text-white font-bold text-sm shadow-md shadow-[#086288]/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#FFEFC4]" />
            <span>
              {isJobRunning
                ? "Optimasi AZBO Sedang Berjalan..."
                : "Mulai Optimasi AZBO"}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ==============================================================================
// HALAMAN 2 — PROSES OPTIMASI (REAL-TIME GA PROGRESS & K EXPLORATION)
// ==============================================================================

export interface OptimizationProcessPageProps {
  jobStatus: AzboJobStatusResponse | null;
  result: AzboOptimizationResult | null;
  backendError: string | null;
  onCancelJob: () => void;
  onGoToConfig: () => void;
  onGoToResults: () => void;
}

export const OptimizationProcessPage: React.FC<OptimizationProcessPageProps> = ({
  jobStatus,
  result,
  backendError,
  onCancelJob,
  onGoToConfig,
  onGoToResults,
}) => {
  const history = result?.generation_history || jobStatus?.generation_history || [];
  const exploredK =
    result?.ga_config?.explored_k_distribution || jobStatus?.explored_k_counts || {};
  const bestCandidate: AzboDecodedCandidate | null =
    result?.best_zone_configuration || jobStatus?.best_candidate || null;
  const bestTrainMean =
    result?.best_zone_configuration?.training_mean_s ??
    jobStatus?.best_training_mean_s ??
    null;

  const isRunning = jobStatus?.status === "running";
  const isCompleted = jobStatus?.status === "completed" || result !== null;

  return (
    <div className="flex flex-col gap-6 p-5 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900">
            Halaman 2 — Proses Optimasi Genetic Algorithm (AZBO)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pemantauan langsung evolusi generasi GA, jumlah kandidat zona unik, dan eksplorasi jumlah zona variabel K di backend Python.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isRunning && (
            <button
              type="button"
              onClick={onCancelJob}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
              <span>Batalkan Job</span>
            </button>
          )}
          {isCompleted && (
            <button
              type="button"
              onClick={onGoToResults}
              className="px-4 py-2 rounded-xl bg-[#086288] hover:bg-[#064e6d] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <span>Lihat Hasil Rekomendasi</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Pesan Error Jujur Apabila Backend Tidak Aktif (Tanpa Fake Progress Bar) */}
      {backendError && (
        <div className="rounded-2xl bg-rose-950 border border-rose-700 p-5 text-rose-100 flex flex-col gap-3">
          <div className="flex items-center gap-2.5 text-sm font-bold text-rose-300">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>Koneksi Backend Python Terputus / Gagal Menjalankan Job</span>
          </div>
          <p className="text-xs leading-relaxed text-rose-200 font-mono">
            {backendError}
          </p>
          <p className="text-xs text-rose-300">
            Sesuai arsitektur Single Source of Truth AZBO, frontend tidak menampilkan progres palsu atau menjalankan simulator pengganti di browser.
          </p>
          <div>
            <button
              type="button"
              onClick={onGoToConfig}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer"
            >
              Kembali ke Konfigurasi Penerbangan
            </button>
          </div>
        </div>
      )}

      {/* Jika belum ada job yang dijalankan */}
      {!jobStatus && !result && !backendError && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center flex flex-col items-center gap-3">
          <Cpu className="w-10 h-10 text-[#086288]" />
          <h2 className="text-base font-bold text-slate-900">
            Belum Ada Pekerjaan Optimasi AZBO yang Dijalankan
          </h2>
          <p className="text-xs text-slate-600 max-w-md">
            Silakan pilih konfigurasi pesawat, proporsi penumpang pembawa bagasi, dan klik tombol{" "}
            <strong>Mulai Optimasi AZBO</strong> pada Halaman 1.
          </p>
          <button
            type="button"
            onClick={onGoToConfig}
            className="mt-2 px-4 py-2.5 rounded-xl bg-[#086288] text-white text-xs font-bold cursor-pointer"
          >
            Buka Halaman 1 — Konfigurasi Penerbangan
          </button>
        </div>
      )}

      {(jobStatus || result) && (
        <>
          {/* Kartu Status & Metrik Progres Real-Time */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 border border-slate-800 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    isCompleted
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : isRunning
                      ? "bg-sky-500/20 text-[#97D7FF] border border-sky-400/40"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  }`}
                >
                  {isCompleted
                    ? "Selesai (Training GA + Testing CRN)"
                    : isRunning
                    ? "Sedang Mengevaluasi Kandidat di Python..."
                    : jobStatus?.status}
                </span>
                {jobStatus?.job_id && (
                  <span className="text-xs font-mono text-slate-400">
                    Job ID: {jobStatus.job_id.slice(0, 8)}
                  </span>
                )}
              </div>

              <div className="text-xs font-mono text-[#FFEFC4]">
                Waktu Komputasi:{" "}
                {(result?.execution_time_s ?? jobStatus?.elapsed_s ?? 0).toFixed(2)} dtk
              </div>
            </div>

            {/* Bar Progres Nyata dari Backend */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300">
                  Generasi GA:{" "}
                  <strong className="text-white">
                    {result
                      ? result.ga_config.generations
                      : jobStatus?.current_generation ?? 0}
                  </strong>{" "}
                  /{" "}
                  {result
                    ? result.ga_config.generations
                    : jobStatus?.total_generations ?? 0}
                </span>
                <span className="text-[#97D7FF] font-bold">
                  {(isCompleted ? 100 : jobStatus?.progress_percent ?? 0).toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden p-0.5 border border-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#086288] via-[#4D8DBA] to-[#97D7FF] transition-all duration-300"
                  style={{
                    width: `${Math.max(
                      4,
                      Math.min(100, isCompleted ? 100 : jobStatus?.progress_percent ?? 0)
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* 4 Metrik Kunci Proses Optimasi */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              <div className="rounded-xl bg-slate-800/80 border border-slate-700/80 p-3.5">
                <div className="text-[11px] text-slate-400">
                  Kandidat Fenotipe Zona Unik
                </div>
                <div className="text-lg font-bold font-mono text-white mt-0.5">
                  {result?.ga_config.unique_candidates_evaluated ??
                    jobStatus?.unique_candidates_evaluated ??
                    0}{" "}
                  kandidat
                </div>
                <div className="text-[10px] text-slate-400">
                  Dievaluasi dengan CRN
                </div>
              </div>

              <div className="rounded-xl bg-slate-800/80 border border-slate-700/80 p-3.5">
                <div className="text-[11px] text-slate-400">
                  Waktu Training Terbaik Sementara
                </div>
                <div className="text-lg font-bold font-mono text-[#FFEFC4] mt-0.5">
                  {formatSeconds(bestTrainMean)}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {formatMinutes(bestTrainMean)}
                </div>
              </div>

              <div className="rounded-xl bg-slate-800/80 border border-slate-700/80 p-3.5">
                <div className="text-[11px] text-slate-400">
                  Jumlah Zona (K) Terbaik Saat Ini
                </div>
                <div className="text-lg font-bold font-mono text-[#97D7FF] mt-0.5">
                  {bestCandidate ? `K = ${bestCandidate.K} Zona` : "—"}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Aturan: {bestCandidate?.internal_rule || "—"}
                </div>
              </div>

              <div className="rounded-xl bg-slate-800/80 border border-slate-700/80 p-3.5">
                <div className="text-[11px] text-slate-400">
                  Rentang Nilai K yang Dieksplorasi
                </div>
                <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                  {Object.keys(exploredK).length} nilai K berbeda
                </div>
                <div className="text-[10px] text-slate-400">
                  Dari K ∈ &#123;1..N&#125;
                </div>
              </div>
            </div>
          </div>

          {/* Grafik Riwayat Konvergensi Generasi GA & Distribusi Eksplorasi K */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Riwayat Evolusi Fitness per Generasi (Training CRN)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Rata-rata waktu boarding kandidat terbaik vs rata-rata populasi pada tiap generasi.
                  </p>
                </div>
              </div>

              {history.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  Menunggu generasi pertama selesai dievaluasi...
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[320px] zoneflow-scrollbar">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 px-2.5">Gen</th>
                        <th className="py-2 px-2.5 text-right">Terbaik (dtk)</th>
                        <th className="py-2 px-2.5 text-right">Rata-rata Populasi</th>
                        <th className="py-2 px-2.5 text-center">K Terbaik</th>
                        <th className="py-2 px-2.5">Aturan Dalam Zona</th>
                        <th className="py-2 px-2.5 text-right">Kandidat Unik</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {history.map((h) => (
                        <tr key={h.generation} className="hover:bg-slate-50">
                          <td className="py-2 px-2.5 font-bold text-slate-800">
                            G{h.generation}
                          </td>
                          <td className="py-2 px-2.5 text-right font-bold text-[#086288]">
                            {h.best_training_mean_s.toFixed(2)} dtk
                          </td>
                          <td className="py-2 px-2.5 text-right text-slate-600">
                            {h.population_mean_s.toFixed(2)} dtk
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            <span className="px-2 py-0.5 rounded bg-sky-100 text-[#086288] font-bold">
                              K={h.best_K}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-slate-700">
                            {h.best_internal_rule}
                          </td>
                          <td className="py-2 px-2.5 text-right text-slate-500">
                            {h.unique_candidates_evaluated}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Distribusi Eksplorasi Jumlah Zona K in {1..N} */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Distribusi Eksplorasi Jumlah Zona (K)
                </h2>
                <p className="text-xs text-slate-500">
                  Membuktikan K tidak dikunci pada K=3, melainkan variabel keputusan K = 1 + Σ c_j.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {Object.entries(exploredK).map(([kStr, count]) => (
                  <div
                    key={kStr}
                    className={`px-3 py-2 rounded-xl border text-xs font-mono flex items-center gap-2 ${
                      bestCandidate && String(bestCandidate.K) === kStr
                        ? "bg-[#086288] text-white border-[#086288] font-bold"
                        : "bg-slate-50 text-slate-800 border-slate-200"
                    }`}
                  >
                    <span>K = {kStr}</span>
                    <span className="px-1.5 py-0.5 rounded bg-black/10 text-[10px]">
                      {count}×
                    </span>
                  </div>
                ))}
              </div>

              {bestCandidate && (
                <div className="mt-auto rounded-xl bg-slate-900 text-white p-4 flex flex-col gap-2">
                  <div className="text-xs font-bold text-[#FFEFC4]">
                    Struktur Kandidat Zona Terbaik Saat Ini (K = {bestCandidate.K})
                  </div>
                  <div className="text-[11px] font-mono text-slate-300">
                    Urutan Pemanggilan Zona:{" "}
                    {bestCandidate.ordered_zones
                      .map(
                        (oz) =>
                          `Zona ${oz.zone_id} (Baris ${oz.start_row}–${oz.end_row})`
                      )
                      .join(" → ")}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ==============================================================================
// HALAMAN 3 — HASIL REKOMENDASI (RECOMMENDATION & STATISTICAL EVALUATION)
// ==============================================================================

export interface RecommendationResultsPageProps {
  result: AzboOptimizationResult | null;
  onGoToConfig: () => void;
  onGoToVisualization: () => void;
}

export const RecommendationResultsPage: React.FC<RecommendationResultsPageProps> = ({
  result,
  onGoToConfig,
  onGoToVisualization,
}) => {
  if (!result) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center flex flex-col items-center gap-3">
          <BarChart3 className="w-10 h-10 text-[#086288]" />
          <h2 className="text-base font-bold text-slate-900">
            Hasil Rekomendasi AZBO Belum Tersedia
          </h2>
          <p className="text-xs text-slate-600 max-w-md">
            Jalankan proses optimasi dan evaluasi 2-tahap AZBO terlebih dahulu untuk melihat strategi boarding yang direkomendasikan beserta interval kepercayaan 95%.
          </p>
          <button
            type="button"
            onClick={onGoToConfig}
            className="mt-2 px-4 py-2.5 rounded-xl bg-[#086288] text-white text-xs font-bold cursor-pointer"
          >
            Ke Halaman 1 — Konfigurasi Penerbangan
          </button>
        </div>
      </div>
    );
  }

  const {
    scenario,
    ga_config,
    recommended_strategy,
    recommended_strategy_label,
    recommended_summary,
    best_zone_configuration,
    strategies,
    ranked_strategy_ids,
    paired_comparisons,
    equivalences,
    top_training_candidates,
  } = result;

  const maxUpperCi = Math.max(
    ...Object.values(strategies).map((s) => s.ci95_upper_s),
    1
  );

  // Petakan setiap baris 1..N ke zone_id pada best_zone_configuration
  const rowToZoneMap: Record<number, { zoneId: number; callSeq: number }> = {};
  best_zone_configuration.ordered_zones.forEach((oz) => {
    for (let r = oz.start_row; r <= oz.end_row; r++) {
      rowToZoneMap[r] = { zoneId: oz.zone_id, callSeq: oz.call_sequence };
    }
  });

  return (
    <div className="flex flex-col gap-6 p-5 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Banner Utama Rekomendasi Kondisional AZBO */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0d1522] via-[#0f2338] to-[#086288] text-white p-6 border border-sky-400/30 shadow-lg flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FFEFC4]">
              <Sparkles className="w-4 h-4" />
              <span>Halaman 3 — Rekomendasi Kondisional Kerangka Optimasi AZBO</span>
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-white">
              Rekomendasi: {recommended_strategy_label}
            </h1>
            <p className="text-xs sm:text-sm text-sky-100 max-w-3xl">
              {result.scientific_statement} Rekomendasi bersifat kondisional terhadap skenario{" "}
              <span className="font-mono text-[#FFEFC4]">
                ({scenario.rows} baris × {scenario.seats_per_row} kursi = {scenario.capacity} penumpang, bagasi {scenario.bag_percent}% / {scenario.baggage_passenger_count} orang)
              </span>
              .
            </p>
          </div>

          <button
            type="button"
            onClick={onGoToVisualization}
            className="px-4 py-3 rounded-xl bg-[#FFEFC4] hover:bg-amber-200 text-slate-900 font-bold text-xs sm:text-sm inline-flex items-center gap-2 shrink-0 cursor-pointer shadow-md"
          >
            <Play className="w-4 h-4 fill-slate-900" />
            <span>Simulasikan Pergerakan Sel Lorong</span>
          </button>
        </div>

        {/* Ringkasan Statistik Rekomendasi Utama pada Replikasi Testing Baru */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2 border-t border-white/15">
          <div className="bg-white/10 rounded-xl p-3">
            <div className="text-[11px] text-sky-200">Rata-rata Waktu Boarding</div>
            <div className="text-base sm:text-lg font-bold font-mono text-[#FFEFC4] mt-0.5">
              {recommended_summary.mean_s.toFixed(2)} dtk
            </div>
            <div className="text-[10px] font-mono text-sky-200">
              ({recommended_summary.mean_minutes.toFixed(2)} menit)
            </div>
          </div>

          <div className="bg-white/10 rounded-xl p-3">
            <div className="text-[11px] text-sky-200">Simpangan Baku Sampel (s)</div>
            <div className="text-base sm:text-lg font-bold font-mono text-white mt-0.5">
              ±{recommended_summary.std_s.toFixed(2)} dtk
            </div>
            <div className="text-[10px] font-mono text-sky-200">
              R_test = {recommended_summary.replications} replikasi
            </div>
          </div>

          <div className="bg-white/10 rounded-xl p-3">
            <div className="text-[11px] text-sky-200">Interval Kepercayaan 95%</div>
            <div className="text-sm font-bold font-mono text-[#97D7FF] mt-0.5">
              [{recommended_summary.ci95_lower_s.toFixed(1)}, {recommended_summary.ci95_upper_s.toFixed(1)}] dtk
            </div>
            <div className="text-[10px] font-mono text-sky-200">
              ±{recommended_summary.ci95_half_width_s.toFixed(2)} dtk
            </div>
          </div>

          <div className="bg-white/10 rounded-xl p-3">
            <div className="text-[11px] text-sky-200">Tercepat / Terlambat</div>
            <div className="text-sm font-bold font-mono text-emerald-300 mt-0.5">
              {recommended_summary.min_s.toFixed(1)}s / {recommended_summary.max_s.toFixed(1)}s
            </div>
            <div className="text-[10px] font-mono text-sky-200">
              Rentang min–maks testing
            </div>
          </div>

          <div className="bg-white/10 rounded-xl p-3">
            <div className="text-[11px] text-sky-200">Jumlah Zona GA (K)</div>
            <div className="text-base sm:text-lg font-bold font-mono text-white mt-0.5">
              K = {best_zone_configuration.K} Zona
            </div>
            <div className="text-[10px] font-mono text-sky-200">
              Aturan: {best_zone_configuration.internal_rule}
            </div>
          </div>

          <div className="bg-white/10 rounded-xl p-3">
            <div className="text-[11px] text-sky-200">Replikasi Train / Test</div>
            <div className="text-base sm:text-lg font-bold font-mono text-white mt-0.5">
              {ga_config.train_reps} / {ga_config.test_reps}
            </div>
            <div className="text-[10px] font-mono text-sky-200">
              Common Random Numbers
            </div>
          </div>
        </div>
      </div>

      {/* Peringatan Ekuivalensi Strategi (Jika GA_ZONE Ekuivalen dengan WMA atau BTF) */}
      {equivalences.length > 0 && (
        <div className="rounded-2xl bg-sky-950 text-sky-100 border border-sky-700 p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-[#97D7FF] shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong className="text-white block mb-0.5">
              Deteksi Ekuivalensi Strategi Boarding:
            </strong>
            {equivalences.map((eq, i) => (
              <div key={i}>{eq.note}</div>
            ))}
          </div>
        </div>
      )}

      {/* Detail Konfigurasi Zona Terbaik Hasil GA (Batas Baris & Urutan Panggilan Zona) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Konfigurasi Pembagian Zona Terbaik Hasil GA (K = {best_zone_configuration.K} Zona)
            </h2>
            <p className="text-xs text-slate-500">
              Batas baris tiap zona, urutan pemanggilan zona dari pintu depan, dan aturan pengurutan kursi di dalam zona.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-[#086288] font-mono text-xs font-bold">
            Aturan Internal: {best_zone_configuration.internal_rule}
          </span>
        </div>

        {/* Kartu Urutan Panggilan Zona */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {best_zone_configuration.ordered_zones.map((oz) => {
            const zStyle = getZoneStyle(oz.zone_id);
            return (
              <div
                key={oz.call_sequence}
                className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/70 flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Panggilan Ke-{oz.call_sequence}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${zStyle.badge}`}>
                    Zona {oz.zone_id}
                  </span>
                </div>
                <div className="text-sm font-bold font-mono text-slate-900">
                  Baris {oz.start_row} s.d. Baris {oz.end_row}
                </div>
                <div className="text-xs text-slate-600 font-mono">
                  {oz.row_count} baris ({oz.row_count * scenario.seats_per_row} kursi)
                </div>
              </div>
            );
          })}
        </div>

        {/* Peta Visual Pembagian Zona Sepanjang Baris 1..N */}
        <div className="rounded-xl bg-slate-900 p-4 border border-slate-800 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] text-slate-300">
            <span>Peta Partisi Zona Kabin (Baris 1 di Depan s.d. Baris {scenario.rows} di Belakang)</span>
            <span className="font-mono text-[#FFEFC4]">
              Vektor Biner Pemotongan: K = 1 + Σ c_j = {best_zone_configuration.K}
            </span>
          </div>
          <div
            className="grid gap-1 pt-1"
            style={{
              gridTemplateColumns: `repeat(${scenario.rows}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: scenario.rows }, (_, idx) => {
              const r = idx + 1;
              const zInfo = rowToZoneMap[r] || { zoneId: 1, callSeq: 1 };
              const zStyle = getZoneStyle(zInfo.zoneId);
              return (
                <div
                  key={r}
                  className={`rounded-md p-1 border text-center flex flex-col items-center justify-center ${zStyle.bg} ${zStyle.border}`}
                  title={`Baris ${r} — Zona ${zInfo.zoneId} (Panggilan ke-${zInfo.callSeq})`}
                >
                  <span className="text-[9px] font-mono font-bold text-white">
                    R{r}
                  </span>
                  <span className={`text-[8px] font-mono ${zStyle.text}`}>
                    Z{zInfo.zoneId}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabel & Grafik Perbandingan Strategi pada Replikasi Testing Baru (CRN) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col gap-4">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Perbandingan Statistik Strategi Boarding (Testing R_test = {ga_config.test_reps} Replikasi Baru)
            </h2>
            <p className="text-xs text-slate-500">
              Seluruh strategi diuji pada realisasi penumpang dan bagasi yang identik (Common Random Numbers).
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 px-2">Peringkat & Strategi</th>
                  <th className="py-2.5 px-2 text-right">Rata-rata</th>
                  <th className="py-2.5 px-2 text-right">SD (s)</th>
                  <th className="py-2.5 px-2 text-right">95% CI (dtk)</th>
                  <th className="py-2.5 px-2 text-right">Min / Maks</th>
                  <th className="py-2.5 px-2 text-right">Interferensi Kursi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {ranked_strategy_ids.map((sid, idx) => {
                  const st = strategies[sid];
                  const isRec = sid === recommended_strategy;
                  return (
                    <tr
                      key={sid}
                      className={isRec ? "bg-sky-50/90 font-semibold" : "hover:bg-slate-50"}
                    >
                      <td className="py-2.5 px-2 font-sans">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                              isRec
                                ? "bg-[#086288] text-white"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-bold text-slate-900">{st.label}</div>
                            {isRec && (
                              <span className="text-[10px] text-[#086288] font-bold">
                                ★ Direkomendasikan pada skenario ini
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-[#086288]">
                        {st.mean_s.toFixed(2)} dtk
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-600">
                        {st.std_s.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-700">
                        [{st.ci95_lower_s.toFixed(1)}, {st.ci95_upper_s.toFixed(1)}]
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-600">
                        {st.min_s.toFixed(1)} / {st.max_s.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-700">
                        {st.mean_seat_interference_events.toFixed(1)} kejadian
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Grafik Batang Horizontal dengan Interval Kepercayaan 95% */}
          <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-700">
              Visualisasi Rata-rata Waktu Boarding & Rentang 95% CI
            </div>
            {ranked_strategy_ids.map((sid) => {
              const st = strategies[sid];
              const isRec = sid === recommended_strategy;
              const widthPct = Math.max(8, (st.mean_s / maxUpperCi) * 100);
              return (
                <div key={sid} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{st.label}</span>
                    <span className="font-mono font-bold text-slate-900">
                      {st.mean_s.toFixed(2)} dtk (±{st.ci95_half_width_s.toFixed(2)})
                    </span>
                  </div>
                  <div className="w-full h-3.5 rounded-full bg-slate-100 overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full ${
                        isRec
                          ? "bg-gradient-to-r from-[#086288] to-[#4D8DBA]"
                          : "bg-slate-400"
                      }`}
                      style={{ width: `${Math.min(100, widthPct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabel Perbandingan Berpasangan (Paired Comparison Delta_r = T_A,r - T_B,r) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col gap-4">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Perbandingan Berpasangan (Paired Difference CRN)
            </h2>
            <p className="text-xs text-slate-500">
              Selisih waktu per replikasi Δ_r = T_(A,r) − T_(B,r). Nilai negatif berarti strategi A lebih cepat daripada B.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 px-2">Pasangan (A vs B)</th>
                  <th className="py-2 px-2 text-right">Rata-rata Δ (dtk)</th>
                  <th className="py-2 px-2 text-right">95% CI Δ</th>
                  <th className="py-2 px-2 text-center">Menang (A/B/=)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {paired_comparisons.map((pc, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-2 px-2 font-bold text-slate-800">
                      {pc.strategy_a} vs {pc.strategy_b}
                    </td>
                    <td
                      className={`py-2 px-2 text-right font-bold ${
                        pc.mean_diff_s < -1e-6
                          ? "text-emerald-600"
                          : pc.mean_diff_s > 1e-6
                          ? "text-rose-600"
                          : "text-slate-600"
                      }`}
                    >
                      {pc.mean_diff_s > 0 ? `+${pc.mean_diff_s.toFixed(2)}` : pc.mean_diff_s.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-right text-slate-600">
                      [{pc.ci95_lower_s.toFixed(1)}, {pc.ci95_upper_s.toFixed(1)}]
                    </td>
                    <td className="py-2 px-2 text-center text-slate-700">
                      {pc.a_faster_count}/{pc.b_faster_count}/{pc.tie_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 5 Kandidat Zona Teratas selama Training GA */}
          {top_training_candidates && top_training_candidates.length > 0 && (
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-800">
                Kandidat Konfigurasi Zona Teratas selama Evolusi GA
              </div>
              <div className="flex flex-col gap-1.5">
                {top_training_candidates.slice(0, 4).map((cand, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 flex items-center justify-between text-xs font-mono"
                  >
                    <div>
                      <span className="font-bold text-[#086288]">#{idx + 1}</span>{" "}
                      <span className="font-bold text-slate-800">K={cand.K} Zona</span>{" "}
                      <span className="text-slate-500">({cand.internal_rule})</span>
                    </div>
                    <span className="font-bold text-slate-900">
                      {cand.training_mean_s?.toFixed(2)} dtk (train)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==============================================================================
// HALAMAN 4 — VISUALISASI SIMULASI (BACKEND EVENT TRACE PLAYBACK)
// ==============================================================================

export interface SimulationVisualizationPageProps {
  result: AzboOptimizationResult | null;
  selectedLayout: AircraftLayoutConfig;
  onGoToConfig: () => void;
}

interface ReconstructedFrameState {
  aisleCells: Array<{
    seatId: string;
    status: "walking" | "blocked" | "stowing" | "seating";
    hasBag: boolean;
    blockers: number;
    row: number;
  } | null>;
  seatedSet: Set<string>;
  enteredCount: number;
  recentEvents: AzboTraceEvent[];
}

export const SimulationVisualizationPage: React.FC<
  SimulationVisualizationPageProps
> = ({ result, selectedLayout, onGoToConfig }) => {
  const [traceMode, setTraceMode] = useState<"recommended" | "ga_zone">("recommended");
  const [currentTimeS, setCurrentTimeS] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(2);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const activeTrace: AzboTraceEvent[] = useMemo(() => {
    if (!result) return [];
    return traceMode === "ga_zone"
      ? result.visualization.ga_zone_trace
      : result.visualization.trace;
  }, [result, traceMode]);

  const activeLogs: AzboPassengerLog[] = useMemo(() => {
    if (!result) return [];
    return traceMode === "ga_zone"
      ? result.visualization.ga_zone_passenger_logs
      : result.visualization.passenger_logs;
  }, [result, traceMode]);

  const totalSimTimeS = useMemo(() => {
    if (!result) return 0;
    return traceMode === "ga_zone"
      ? result.visualization.ga_zone_total_time_s
      : result.visualization.total_time_s;
  }, [result, traceMode]);

  useEffect(() => {
    setCurrentTimeS(0);
    setIsPlaying(false);
  }, [result, traceMode]);

  useEffect(() => {
    if (!isPlaying || totalSimTimeS <= 0) return;
    const intervalMs = 80;
    const timer = window.setInterval(() => {
      setCurrentTimeS((prev) => {
        const next = prev + (intervalMs / 1000) * playbackSpeed * 4;
        if (next >= totalSimTimeS) {
          setIsPlaying(false);
          return totalSimTimeS;
        }
        return next;
      });
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isPlaying, playbackSpeed, totalSimTimeS]);

  const paxMetaMap = useMemo(() => {
    const map: Record<string, AzboPassengerLog> = {};
    for (const log of activeLogs) {
      map[log.seat_id] = log;
    }
    return map;
  }, [activeLogs]);

  // Rekonstruksi state sel lorong & kursi dari event log backend Python (trace) hingga currentTimeS
  const frameState: ReconstructedFrameState = useMemo(() => {
    const nCells = result?.visualization.total_cells || selectedLayout.nRows * 2;
    const cells: ReconstructedFrameState["aisleCells"] = Array.from(
      { length: nCells },
      () => null
    );
    const paxCell: Record<string, number> = {};
    const paxSeatingInfo: Record<
      string,
      { startT: number; stowS: number; seatS: number; blockers: number }
    > = {};
    const paxLastMoveT: Record<string, number> = {};
    const seatedSet = new Set<string>();
    let enteredCount = 0;
    const recentEvents: AzboTraceEvent[] = [];

    for (const ev of activeTrace) {
      const evTime = ev[0];
      if (evTime > currentTimeS + 1e-6) break;

      recentEvents.push(ev);
      if (recentEvents.length > 8) recentEvents.shift();

      const evType = ev[1];
      const seatId = ev[2];
      if (evType === "entry") {
        const cIdx = ev[3];
        paxCell[seatId] = cIdx;
        paxLastMoveT[seatId] = evTime;
        enteredCount += 1;
      } else if (evType === "move") {
        const toCell = ev[4];
        paxCell[seatId] = toCell;
        paxLastMoveT[seatId] = evTime;
      } else if (evType === "seating_started") {
        paxSeatingInfo[seatId] = {
          startT: evTime,
          stowS: ev[4],
          seatS: ev[5],
          blockers: ev[6],
        };
      } else if (evType === "seated") {
        delete paxCell[seatId];
        delete paxSeatingInfo[seatId];
        seatedSet.add(seatId);
      }
    }

    for (const [seatId, cIdx] of Object.entries(paxCell)) {
      if (cIdx < 0 || cIdx >= nCells) continue;
      const meta = paxMetaMap[seatId];
      const sInfo = paxSeatingInfo[seatId];
      let status: "walking" | "blocked" | "stowing" | "seating" = "walking";
      let blockers = 0;

      if (sInfo) {
        blockers = sInfo.blockers;
        const elapsedService = currentTimeS - sInfo.startT;
        if (sInfo.stowS > 0 && elapsedService < sInfo.stowS) {
          status = "stowing";
        } else {
          status = "seating";
        }
      } else {
        const sinceLastMove = currentTimeS - (paxLastMoveT[seatId] ?? 0);
        if (sinceLastMove > 0.8) {
          status = "blocked";
        }
      }

      cells[cIdx] = {
        seatId,
        status,
        hasBag: meta?.has_bag ?? false,
        blockers,
        row: meta?.row ?? 1,
      };
    }

    return {
      aisleCells: cells,
      seatedSet,
      enteredCount,
      recentEvents,
    };
  }, [activeTrace, currentTimeS, paxMetaMap, result, selectedLayout.nRows]);

  if (!result) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center flex flex-col items-center gap-3">
          <Play className="w-10 h-10 text-[#086288]" />
          <h2 className="text-base font-bold text-slate-900">
            Visualisasi Simulasi Belum Tersedia
          </h2>
          <p className="text-xs text-slate-600 max-w-md">
            Visualisasi digerakkan langsung oleh event log (<span className="font-mono">trace</span>) dari backend Python. Jalankan optimasi AZBO terlebih dahulu pada Halaman 1.
          </p>
          <button
            type="button"
            onClick={onGoToConfig}
            className="mt-2 px-4 py-2.5 rounded-xl bg-[#086288] text-white text-xs font-bold cursor-pointer"
          >
            Buka Halaman 1 — Konfigurasi Penerbangan
          </button>
        </div>
      </div>
    );
  }

  const { scenario, best_zone_configuration } = result;
  const rowToZoneId: Record<number, number> = {};
  best_zone_configuration.zones.forEach((z) => {
    for (let r = z.start_row; r <= z.end_row; r++) {
      rowToZoneId[r] = z.zone_id;
    }
  });

  const filteredLogs = activeLogs.filter((log) =>
    searchQuery.trim() === ""
      ? true
      : log.seat_id.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 p-5 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header & Pemilih Mode Trace */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900">
            Halaman 4 — Visualisasi Simulasi Sel Lorong Fisik (Backend Event Log)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Merekonstruksi pergerakan {scenario.capacity} penumpang sepanjang {scenario.total_aisle_cells} sel lorong (0.4 m/sel) dari event trace Python.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTraceMode("recommended")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${
              traceMode === "recommended"
                ? "bg-[#086288] text-white border-[#086288]"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Strategi Rekomendasi ({result.recommended_strategy})
          </button>
          <button
            type="button"
            onClick={() => setTraceMode("ga_zone")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${
              traceMode === "ga_zone"
                ? "bg-[#086288] text-white border-[#086288]"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Konfigurasi Zona GA (K={best_zone_configuration.K})
          </button>
        </div>
      </div>

      {/* Panel Kontrol Playback & Statistik Real-Time */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (currentTimeS >= totalSimTimeS) {
                  setCurrentTimeS(0);
                }
                setIsPlaying((p) => !p);
              }}
              className="px-4 py-2 rounded-xl bg-[#086288] hover:bg-[#4D8DBA] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isPlaying ? "Jeda" : "Putar Simulasi"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setCurrentTimeS(0);
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
              title="Reset waktu ke 0.0 detik"
              aria-label="Reset waktu ke 0.0 detik"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 ml-2">
              {[0.5, 1, 2, 5, 10].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold cursor-pointer ${
                    playbackSpeed === spd
                      ? "bg-[#FFEFC4] text-slate-900"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {spd}×
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            <div>
              Waktu:{" "}
              <strong className="text-[#FFEFC4]">{currentTimeS.toFixed(1)} dtk</strong> /{" "}
              {totalSimTimeS.toFixed(1)} dtk
            </div>
            <div>
              Di Pintu/Lorong:{" "}
              <strong className="text-[#97D7FF]">
                {frameState.aisleCells.filter(Boolean).length} org
              </strong>
            </div>
            <div>
              Sudah Duduk:{" "}
              <strong className="text-emerald-400">
                {frameState.seatedSet.size} / {scenario.capacity} kursi
              </strong>
            </div>
          </div>
        </div>

        {/* Scrubber Waktu */}
        <input
          type="range"
          min={0}
          max={Math.max(1, totalSimTimeS)}
          step={0.25}
          value={currentTimeS}
          onChange={(e) => {
            setIsPlaying(false);
            setCurrentTimeS(Number(e.target.value));
          }}
          aria-label="Penggeser waktu simulasi"
          className="w-full accent-[#97D7FF] cursor-pointer"
        />

        {/* Legenda Status Sel Lorong */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-300 pt-1 border-t border-slate-800">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-sky-400 inline-block" />
            <span>Berjalan di Sel Lorong (0.4 m)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
            <span>Tertahan Antrean (Queue Blocking)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
            <span>Menyimpan Bagasi (Weibull)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-purple-400 inline-block" />
            <span>Interferensi Masuk Kursi (Triangular)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
            <span>Sudah Duduk di Kursi</span>
          </span>
        </div>

        {/* Visualisasi Kabin Utuh & Sel Lorong (2 Sel per Baris) */}
        <div className="overflow-x-auto pb-2 zoneflow-scrollbar">
          <div className="min-w-[820px] bg-slate-950 rounded-xl p-4 border border-slate-800">
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${scenario.rows}, minmax(24px, 1fr))`,
              }}
            >
              {Array.from({ length: scenario.rows }, (_, rIdx) => {
                const rowNum = rIdx + 1;
                const zId = rowToZoneId[rowNum] || 1;
                const zStyle = getZoneStyle(zId);
                const cellFrontIdx = (rowNum - 1) * 2;
                const cellTargetIdx = rowNum * 2 - 1;
                const cellFront = frameState.aisleCells[cellFrontIdx];
                const cellTarget = frameState.aisleCells[cellTargetIdx];

                const renderCellDot = (
                  cellObj: ReconstructedFrameState["aisleCells"][number],
                  cIdx: number
                ) => {
                  if (!cellObj) {
                    return (
                      <div
                        key={cIdx}
                        className="h-5 rounded bg-slate-900 border border-slate-800 text-[7px] font-mono text-slate-600 flex items-center justify-center"
                        title={`Sel Lorong ${cIdx} (Kosong)`}
                      >
                        c{cIdx}
                      </div>
                    );
                  }
                  const colorCls =
                    cellObj.status === "stowing"
                      ? "bg-amber-400 text-slate-950 border-amber-200"
                      : cellObj.status === "seating"
                      ? "bg-purple-400 text-slate-950 border-purple-200"
                      : cellObj.status === "blocked"
                      ? "bg-rose-500 text-white border-rose-300"
                      : "bg-sky-400 text-slate-950 border-sky-200";
                  return (
                    <div
                      key={cIdx}
                      className={`h-5 rounded border font-mono text-[7.5px] font-bold flex items-center justify-center ${colorCls}`}
                      title={`Sel ${cIdx}: Penumpang ${cellObj.seatId} (${cellObj.status})`}
                    >
                      {cellObj.seatId}
                    </div>
                  );
                };

                return (
                  <div
                    key={rowNum}
                    className={`rounded-lg p-1 border flex flex-col gap-1 ${zStyle.bg} ${zStyle.border}`}
                  >
                    {/* Label Baris & Zona */}
                    <div className="text-center text-[8px] font-mono font-bold text-slate-200">
                      R{rowNum}•Z{zId}
                    </div>

                    {/* Kursi Sisi Kiri */}
                    <div className="flex flex-col gap-0.5">
                      {selectedLayout.leftSeats.map((sLbl) => {
                        const sid = `${rowNum}${sLbl}`;
                        const isSeated = frameState.seatedSet.has(sid);
                        return (
                          <div
                            key={sid}
                            className={`h-4 rounded text-[7.5px] font-mono flex items-center justify-center border ${
                              isSeated
                                ? "bg-emerald-500 text-slate-950 font-bold border-emerald-300"
                                : "bg-slate-900/90 text-slate-400 border-slate-700"
                            }`}
                          >
                            {sid}
                          </div>
                        );
                      })}
                    </div>

                    {/* 2 Sel Lorong (0.4 m + 0.4 m = 0.8 m per baris) */}
                    <div className="flex flex-col gap-0.5 my-0.5 py-0.5 border-y border-slate-700/80">
                      {renderCellDot(cellFront, cellFrontIdx)}
                      {renderCellDot(cellTarget, cellTargetIdx)}
                    </div>

                    {/* Kursi Sisi Kanan */}
                    <div className="flex flex-col gap-0.5">
                      {selectedLayout.rightSeats.map((sLbl) => {
                        const sid = `${rowNum}${sLbl}`;
                        const isSeated = frameState.seatedSet.has(sid);
                        return (
                          <div
                            key={sid}
                            className={`h-4 rounded text-[7.5px] font-mono flex items-center justify-center border ${
                              isSeated
                                ? "bg-emerald-500 text-slate-950 font-bold border-emerald-300"
                                : "bg-slate-900/90 text-slate-400 border-slate-700"
                            }`}
                          >
                            {sid}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Tabel Event Log Penumpang dari Backend Python */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Log Detail Pergerakan Penumpang dari Backend Python ({activeLogs.length} Penumpang)
            </h2>
            <p className="text-xs text-slate-500">
              Menampilkan kecepatan jalan individu, waktu tunggu antrean sel lorong, durasi bagasi Weibull, dan interferensi kursi Triangular.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nomor kursi (mis. 15A)..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs font-mono"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[340px] zoneflow-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 px-2">Antrean</th>
                <th className="py-2 px-2">Kursi</th>
                <th className="py-2 px-2">Bagasi</th>
                <th className="py-2 px-2 text-right">Kecepatan (m/s)</th>
                <th className="py-2 px-2 text-right">Masuk Sel 0</th>
                <th className="py-2 px-2 text-right">Tiba Baris</th>
                <th className="py-2 px-2 text-right">Tunggu Lorong</th>
                <th className="py-2 px-2 text-right">Stow Bagasi</th>
                <th className="py-2 px-2 text-right">Gerak Kursi</th>
                <th className="py-2 px-2 text-right">Selesai Duduk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredLogs.slice(0, 80).map((log) => (
                <tr key={log.seat_id} className="hover:bg-slate-50">
                  <td className="py-1.5 px-2 text-slate-600">#{log.queue_position}</td>
                  <td className="py-1.5 px-2 font-bold text-[#086288]">{log.seat_id}</td>
                  <td className="py-1.5 px-2">
                    {log.has_bag ? (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                        Ya
                      </span>
                    ) : (
                      <span className="text-slate-400">Tidak</span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-right">{log.walk_speed_mps.toFixed(3)}</td>
                  <td className="py-1.5 px-2 text-right">{log.entry_time_s.toFixed(1)}s</td>
                  <td className="py-1.5 px-2 text-right">{log.arrival_target_s.toFixed(1)}s</td>
                  <td className="py-1.5 px-2 text-right text-rose-600">
                    {log.aisle_wait_s.toFixed(1)}s
                  </td>
                  <td className="py-1.5 px-2 text-right text-amber-700">
                    {log.bag_stow_time_s.toFixed(1)}s
                  </td>
                  <td className="py-1.5 px-2 text-right text-purple-700">
                    {log.seat_movement_time_s.toFixed(1)}s ({log.movements_count}×)
                  </td>
                  <td className="py-1.5 px-2 text-right font-bold text-emerald-700">
                    {log.finish_time_s.toFixed(1)}s
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ==============================================================================
// HALAMAN 5 — METODOLOGI (MATHEMATICAL FORMULATION, DISTRIBUTIONS & REFERENCES)
// ==============================================================================

export const MethodologyPage: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 p-5 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FFEFC4]">
          <BookOpen className="w-4 h-4" />
          <span>Halaman 5 — Spesifikasi Ilmiah & Metodologi Komputasi AZBO</span>
        </div>
        <h1 className="text-lg sm:text-2xl font-bold">
          Aircraft Zone-Based Boarding Optimization (AZBO)
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-4xl leading-relaxed">
          AZBO merupakan <strong>kerangka optimasi berbasis simulasi komputasi</strong> untuk
          merekomendasikan strategi boarding pesawat lorong tunggal dengan estimasi rata-rata
          waktu boarding terendah pada kondisi penerbangan <span className="font-mono text-[#97D7FF]">θ = (L, n, ρ_b, p_sim)</span>.
          AZBO bukan satu metode boarding tunggal yang kaku dan tidak diklaim selalu mengalahkan WMA, Back-to-Front, atau Random di setiap kondisi.
        </p>
      </div>

      {/* 1. Model Matematika & Vektor Biner Pemotongan Zona */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col gap-3">
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            1. Representasi Variabel Jumlah Zona (K) & Kromosom GA
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Untuk pesawat dengan <span className="font-mono font-bold">N</span> baris kursi, terdapat{" "}
            <span className="font-mono font-bold">N − 1</span> posisi batas potensial antarbaris.
            Kandidat pembagian zona direpresentasikan oleh vektor biner pemotongan{" "}
            <span className="font-mono font-bold">c = (c_1, ..., c_(N-1)) ∈ &#123;0, 1&#125;^(N-1)</span>:
          </p>
          <div className="rounded-xl bg-slate-900 text-[#FFEFC4] p-3.5 font-mono text-xs">
            <div>c_j = 1 jika terdapat batas zona setelah baris j, dan 0 jika tidak.</div>
            <div className="mt-1 text-[#97D7FF]">
              Jumlah zona: K(c) = 1 + Σ_(j=1..N-1) c_j ∈ &#123;1, 2, ..., N&#125;
            </div>
          </div>
          <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
            <li>
              <strong>Pembangkitan Awal K:</strong> Pada populasi awal GA, jumlah zona dipilih
              secara seragam <span className="font-mono">K ~ UniformDiscrete(1, N)</span> dengan{" "}
              <span className="font-mono">P(K = k) = 1/N</span>, lalu dipilih{" "}
              <span className="font-mono">K − 1</span> titik potong berbeda secara acak tanpa pengembalian.
            </li>
            <li>
              <strong>Kromosom Lengkap:</strong> <span className="font-mono">x = (c, p, q)</span>, di mana{" "}
              <span className="font-mono">p ∈ [0,1]^N</span> menentukan urutan pemanggilan zona dan{" "}
              <span className="font-mono">q ∈ &#123;WMA_IN_ZONE, BTF_IN_ZONE&#125;</span> menentukan aturan di dalam zona.
            </li>
            <li>
              <strong>Okupansi & Bagasi Terkunci:</strong> Okupansi kursi selalu 100% (
              <span className="font-mono">n = kapasitas</span>) dan jumlah pembawa bagasi deterministik{" "}
              <span className="font-mono">n_b = ⌊n · ρ_b + 0.5⌋</span>.
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col gap-3">
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            2. Simulator Sel Lorong Fisik & Proses Rekomendasi 2-Tahap
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Lorong pesawat dimodelkan sebagai sel-sel diskrit sepanjang{" "}
            <span className="font-mono font-bold">cell_m = 0.4 m</span> dengan jarak antarbaris{" "}
            <span className="font-mono font-bold">row_pitch_m = 0.8 m</span> (2 sel per baris kursi):
          </p>
          <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
            <li>
              Setiap sel lorong paling banyak ditempati oleh <strong>1 penumpang</strong> pada satu waktu dan{" "}
              <strong>tidak ada salip-menyalip (no overtaking)</strong>.
            </li>
            <li>
              Penumpang yang tiba di baris kursinya <strong>tetap memblokir sel lorong</strong> selama menyimpan bagasi (Weibull) ditambah waktu masuk kursi (Triangular), dan baru membebaskan sel lorong setelah duduk.
            </li>
            <li>
              <strong>Tahap 1 (Training GA):</strong> Mencari konfigurasi zona terbaik pada{" "}
              <span className="font-mono">R_train</span> replikasi menggunakan Common Random Numbers (CRN).
            </li>
            <li>
              <strong>Tahap 2 (Testing Independen):</strong> Menguji kandidat terbaik hasil GA bersama WMA, Back-to-Front, dan Random pada{" "}
              <span className="font-mono">R_test</span> replikasi baru untuk menghasilkan rekomendasi yang bebas bias seleksi.
            </li>
          </ul>
        </div>
      </div>

      {/* 3. Tabel Distribusi Probabilitas & Status Kalibrasi */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col gap-3">
        <h2 className="text-sm sm:text-base font-bold text-slate-900">
          3. Spesifikasi Distribusi Probabilitas & Parameter Fisik Simulator
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2.5 px-3">Komponen Proses</th>
                <th className="py-2.5 px-3">Model / Distribusi</th>
                <th className="py-2.5 px-3">Parameter & Satuan</th>
                <th className="py-2.5 px-3">Status Ilmiah & Kalibrasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-900">
                  Kecepatan Jalan Bebas (V)
                </td>
                <td className="py-2.5 px-3 font-mono text-[#086288]">
                  Truncated Normal
                </td>
                <td className="py-2.5 px-3 font-mono">
                  Normal(μ = 0.8 m/s, σ = 0.1 m/s), dipotong pada 0 &lt; V ≤ 0.8 m/s
                </td>
                <td className="py-2.5 px-3 text-slate-600">
                  Parameter prototipe berbasis literatur (Schultz 2018); perlu kalibrasi observasi lapangan.
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-900">
                  Waktu Menyimpan Bagasi
                </td>
                <td className="py-2.5 px-3 font-mono text-[#086288]">
                  Weibull(α, β)
                </td>
                <td className="py-2.5 px-3 font-mono">
                  shape α = 1.7, scale β = 16.0 detik (0 detik jika tidak membawa bagasi)
                </td>
                <td className="py-2.5 px-3 text-slate-600">
                  Mengikuti model stokastik penyimpanan bagasi kabin (Schultz 2018; Sadeghi Lahijani et al. 2020).
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-900">
                  Durasi Pergerakan Masuk Kursi
                </td>
                <td className="py-2.5 px-3 font-mono text-[#086288]">
                  Triangular(a, m, b)
                </td>
                <td className="py-2.5 px-3 font-mono">
                  min = 1.8 dtk, mode = 2.4 dtk, max = 3.0 dtk per gerakan (1, 5, atau 9 gerakan)
                </td>
                <td className="py-2.5 px-3 text-slate-600">
                  Jumlah gerakan ditentukan oleh posisi kursi & penumpang penghalang yang sudah duduk (tanpa double counting).
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-900">
                  Waktu Tunggu Antrean Lorong
                </td>
                <td className="py-2.5 px-3 font-mono text-[#086288]">
                  Emergent Cellular Queue
                </td>
                <td className="py-2.5 px-3 font-mono">
                  Muncul otomatis dari kepadatan sel 0.4 m & pemblokiran baris (dt = 0.25 dtk)
                </td>
                <td className="py-2.5 px-3 text-slate-600">
                  Bukan variabel acak independen; hasil interaksi fisik sel lorong.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Referensi Jurnal & Batasan Penelitian */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col gap-3">
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            4. Referensi Literatur Ilmiah Utama
          </h2>
          <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4 leading-relaxed">
            <li>
              <strong>Schultz, M. (2018).</strong> <em>Field Trial Measurements to Validate a Stochastic Aircraft Boarding Model.</em> Aerospace, 5(1), 27.
            </li>
            <li>
              <strong>Sadeghi Lahijani, M., Islam, T., Srinivasan, A., & Namilae, S. (2020).</strong> <em>Constrained Linear Movement Model (CALM): Simulation of passenger movement in airplanes.</em> PLOS ONE, 15(3), e0229690.
            </li>
            <li>
              <strong>Jafer, S., & Mi, Xiao. (2017).</strong> <em>Comparative Study of Aircraft Boarding Strategies Using Cellular Discrete Event Simulation.</em> Aerospace, 4(4), 57.
            </li>
            <li>
              <strong>Moreira, W. H., et al. (2023).</strong> <em>Simulation-based evaluation of aircraft boarding methods and cabin luggage impact.</em>
            </li>
            <li>
              <strong>Schultz, M., et al. (2023); Jaehn, F., Meissner, J., & Neumann, S. (2025/2026).</strong> <em>Analytical and computational optimization perspectives on zone and group boarding strategies.</em>
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col gap-3">
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            5. Batasan Penelitian & Kejujuran Ilmiah
          </h2>
          <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4 leading-relaxed">
            <li>
              <strong>Tidak Mengklaim Global Optimum:</strong> Genetic Algorithm adalah metode metaheuristik yang mengevaluasi sub-ruang kandidat; solusi yang dihasilkan adalah solusi terbaik di antara kandidat yang dievaluasi.
            </li>
            <li>
              <strong>Parameter Prototipe:</strong> Distribusi kecepatan jalan, waktu bagasi, dan gerakan kursi digunakan untuk demonstrasi prototipe komputasi dan memerlukan kalibrasi data observasi maskapai nyata sebelum digunakan untuk keputusan operasional lapangan.
            </li>
            <li>
              <strong>Kepatuhan Urutan & Lorong Tunggal:</strong> Simulator mengasumsikan kepatuhan panggilan zona di pintu masuk depan pada kabin lorong tunggal (single-aisle) dengan okupansi penuh 100%.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
