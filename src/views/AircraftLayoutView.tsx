import React, { useRef } from "react";
import {
  Plane,
  CheckCircle2,
  AlertTriangle,
  Users,
  Luggage,
  ArrowRight,
  Layers,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  AIRCRAFT_LAYOUTS,
  AircraftLayoutConfig,
  equalZoneBoundaries,
  zoneOfRow,
  K_ZONES,
} from "../simulation/engine";

interface AircraftLayoutViewProps {
  selectedLayout: AircraftLayoutConfig;
  onSelectLayout: (layout: AircraftLayoutConfig) => void;
  passengerCountInput: string;
  baggagePercentInput: string;
  onChangeBaggagePercentInput: (val: string) => void;
  computedBaggageCount: number;
  passengerError: string | null;
  baggageError: string | null;
  onProceedToSimulation: () => void;
}

/**
 * Komponen Mini Ilustrasi Skematis Denah Kabin dari Atas secara Utuh
 * Menampilkan seluruh baris (termasuk 30 baris pada baseline 180 kursi) secara proporsional
 * tanpa scrollbar internal dan dengan tinggi yang seragam di seluruh kartu katalog.
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
          {layout.capacity} Kursi
        </span>
      </div>

      {/* Representasi Horisontal Seluruh Baris Kabin Tanpa Scrollbar Internal */}
      <div className="flex items-center gap-1 w-full h-[92px] overflow-hidden">
        {/* Hidung & Pintu Masuk Depan */}
        <div className="w-7 h-full rounded-l-full bg-slate-800 border-r border-slate-700 flex flex-col items-center justify-center shrink-0">
          <span className="text-[7px] font-bold text-slate-400 leading-none">
            DEPAN
          </span>
          <span className="text-[7px] text-emerald-400 font-mono mt-0.5 leading-none">
            1L
          </span>
        </div>

        {/* Seluruh Baris Kursi (1..nRows) & Lorong Tengah Proporsional */}
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
              {/* Kursi Sisi Kiri */}
              <div className="flex flex-col gap-[1px]">
                {layout.leftSeats.map((s) => (
                  <div
                    key={s}
                    className="h-[10px] rounded-[1.5px] bg-sky-900/85 border border-sky-500/40 text-[5.5px] font-mono text-sky-200 flex items-center justify-center leading-none select-none"
                    title={`Baris ${r} Kursi ${s}`}
                  >
                    {s}
                  </div>
                ))}
              </div>

              {/* Lorong Tunggal */}
              <div className="h-[11px] rounded-[1.5px] bg-slate-800 text-[5.5px] font-mono text-slate-300 flex items-center justify-center leading-none select-none my-[0.5px]">
                {r}
              </div>

              {/* Kursi Sisi Kanan */}
              <div className="flex flex-col gap-[1px]">
                {layout.rightSeats.map((s) => (
                  <div
                    key={s}
                    className="h-[10px] rounded-[1.5px] bg-sky-900/85 border border-sky-500/40 text-[5.5px] font-mono text-sky-200 flex items-center justify-center leading-none select-none"
                    title={`Baris ${r} Kursi ${s}`}
                  >
                    {s}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Ekor Pesawat */}
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

export const AircraftLayoutView: React.FC<AircraftLayoutViewProps> = ({
  selectedLayout,
  onSelectLayout,
  baggagePercentInput,
  onChangeBaggagePercentInput,
  computedBaggageCount,
  passengerError,
  baggageError,
  onProceedToSimulation,
}) => {
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const validPaxForPreview = selectedLayout.capacity;
  const parsedBagPct =
    baggagePercentInput.trim() === "" ? NaN : Number(baggagePercentInput.trim());
  const validBagPctForPreview =
    !Number.isNaN(parsedBagPct) && parsedBagPct >= 0 && parsedBagPct <= 100
      ? parsedBagPct
      : null;
  const validBagForPreview =
    validBagPctForPreview !== null ? computedBaggageCount : null;

  const zoneBounds = equalZoneBoundaries(selectedLayout.nRows, K_ZONES);

  const handleScrollCarousel = (direction: "left" | "right") => {
    if (!carouselRef.current) return;
    const scrollAmount = 480;
    carouselRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const handleCarouselKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      handleScrollCarousel("left");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      handleScrollCarousel("right");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-5 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* 1. Katalog Layout Kabin Pesawat Terverifikasi (Horizontal Carousel) */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col justify-center">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              Katalog Layout Kabin Pesawat Terverifikasi
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Geser ke samping atau gunakan tombol panah untuk memilih konfigurasi denah kabin pesawat.
            </p>
          </div>

          {/* Indikator Jumlah Konfigurasi, Layout Terpilih, & Tombol Navigasi Katalog Sejajar */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <span className="inline-flex items-center text-xs font-semibold text-[#086288] bg-sky-50 px-3.5 py-2 rounded-full border border-sky-200 whitespace-nowrap">
              {AIRCRAFT_LAYOUTS.length} Konfigurasi Tersedia
            </span>

            {/* Ringkasan Layout Terpilih (Hanya Menampilkan Nama Pesawat) */}
            <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-slate-200 shadow-2xs text-xs whitespace-nowrap">
              <span className="font-semibold text-slate-500">
                Layout Terpilih:
              </span>
              <strong className="font-bold text-[#086288]">
                {selectedLayout.name}
              </strong>
            </div>

            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleScrollCarousel("left")}
                aria-label="Geser katalog pesawat ke kiri"
                className="p-2 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-sky-50 hover:text-[#086288] hover:border-sky-300 transition-colors shadow-2xs cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleScrollCarousel("right")}
                aria-label="Geser katalog pesawat ke kanan"
                className="p-2 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-sky-50 hover:text-[#086288] hover:border-sky-300 transition-colors shadow-2xs cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Kontainer Carousel Horizontal dengan Scrollbar Halus & Posisi Elemen Kartu Sejajar */}
        <div
          ref={carouselRef}
          tabIndex={0}
          onKeyDown={handleCarouselKeyDown}
          aria-label="Carousel Katalog Layout Kabin Pesawat"
          className="zoneflow-scrollbar flex items-stretch gap-4 overflow-x-auto pb-3 pt-1 px-1 scroll-smooth snap-x snap-mandatory focus:outline-none"
        >
          {AIRCRAFT_LAYOUTS.map((layout) => {
            const isSelected = layout.id === selectedLayout.id;
            return (
              <div
                key={layout.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectLayout(layout)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectLayout(layout);
                  }
                }}
                className={`w-[390px] sm:w-[450px] lg:w-[480px] shrink-0 snap-start text-left rounded-3xl p-5 border-2 transition-all duration-200 flex flex-col gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#086288] ${
                  isSelected
                    ? "bg-white border-[#086288] shadow-md shadow-[#086288]/10 ring-2 ring-[#97D7FF]/40"
                    : "bg-white/95 border-slate-200/90 hover:border-[#4D8DBA] hover:shadow-xs"
                }`}
              >
                {/* Baris 1: Kategori, Badge Baseline, & Status Pilihan (Tinggi Tetap) */}
                <div className="h-7 flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#086288] truncate">
                      {layout.category}
                    </span>
                    {layout.isBaseline180 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFEFC4] text-slate-900 shrink-0">
                        Baseline 180 Kursi
                      </span>
                    )}
                  </div>

                  <div
                    className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 shrink-0 ${
                      isSelected
                        ? "bg-[#086288] text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{isSelected ? "Aktif" : "Pilih"}</span>
                  </div>
                </div>

                {/* Baris 2: Nama Pesawat & Varian (Tinggi Tetap agar Denah Sejajar) */}
                <div className="h-12 flex flex-col justify-center shrink-0">
                  <h3 className="text-base font-bold text-slate-900 leading-snug truncate">
                    {layout.name}
                  </h3>
                  <p className="text-xs text-slate-600 font-medium leading-snug truncate mt-0.5">
                    {layout.variant}
                  </p>
                </div>

                {/* Baris 3: Ringkasan Spesifikasi Inti (Tinggi Tetap) */}
                <div className="grid grid-cols-4 gap-2 h-[54px] shrink-0">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-center">
                    <span className="text-[10px] text-slate-500 block leading-tight">
                      Susunan/Baris
                    </span>
                    <span className="text-xs font-bold font-mono text-slate-900 mt-0.5">
                      {layout.seatConfiguration} ({layout.seatsPerRow})
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-center">
                    <span className="text-[10px] text-slate-500 block leading-tight">
                      Jumlah Baris
                    </span>
                    <span className="text-xs font-bold font-mono text-slate-900 mt-0.5">
                      {layout.nRows} Baris
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-center">
                    <span className="text-[10px] text-slate-500 block leading-tight">
                      Lorong
                    </span>
                    <span className="text-xs font-bold font-mono text-slate-900 mt-0.5">
                      {layout.aisleCount} Lorong
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-sky-50/70 border border-sky-100 flex flex-col justify-center">
                    <span className="text-[10px] text-[#086288] font-semibold block leading-tight">
                      Kapasitas
                    </span>
                    <span className="text-xs font-bold font-mono text-[#086288] mt-0.5">
                      {layout.capacity} Kursi
                    </span>
                  </div>
                </div>

                {/* Baris 4: Mini Skema Denah Kabin Utuh (Sejajar & Tanpa Scrollbar Internal) */}
                <div className="mt-auto pt-1 shrink-0">
                  <MiniCabinSchematic layout={layout} isSelected={isSelected} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Susunan Vertikal: Denah Kabin dari Atas di Atas, Form Input Skenario di Bawah */}
      <div className="flex flex-col gap-6">
        {/* Bagian Atas: Denah Kabin dari Atas (Lebar Penuh) */}
        <div className="bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-lg text-slate-200 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#97D7FF]" />
                <h3 className="text-base font-bold text-white">
                  Denah Kabin dari Atas: {selectedLayout.name}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Menampilkan seluruh {selectedLayout.nRows} baris kursi ({selectedLayout.capacity}{" "}
                kursi) dari Pintu Masuk Depan (Baris 1) hingga Ekor (Baris {selectedLayout.nRows}).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-[#FFEFC4] border border-slate-700">
                Susunan {selectedLayout.seatConfiguration}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-[#97D7FF] border border-slate-700">
                {selectedLayout.nRows} Baris × {selectedLayout.seatsPerRow} Kursi ={" "}
                {selectedLayout.capacity} Kursi
              </span>
            </div>
          </div>

          {/* Legenda Posisi Kursi & Pembagian 3 Zona Dasar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-800/70 p-3 rounded-2xl border border-slate-800">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-slate-400 font-semibold">Kelas Kursi:</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-sky-600 border border-sky-400 inline-block" />
                <span>Jendela (Prioritas Luar)</span>
              </span>
              {selectedLayout.seatsPerRow >= 5 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-indigo-600 border border-indigo-400 inline-block" />
                  <span>Tengah</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-teal-600 border border-teal-400 inline-block" />
                <span>Lorong</span>
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              3 Zona Seimbang: Zona 1 (1–{zoneBounds[0]}) • Zona 2 ({zoneBounds[0] + 1}–
              {zoneBounds[1]}) • Zona 3 ({zoneBounds[1] + 1}–{selectedLayout.nRows})
            </div>
          </div>

          {/* Grid Kursi Seluruh Baris Kabin (Top-Down) */}
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[680px] flex flex-col gap-2">
              {/* Sisi Kiri */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Sisi Kiri Kabin (Kursi {selectedLayout.leftSeats.join(", ")})
                </span>
                {selectedLayout.leftSeats.map((seatLetter) => {
                  const prio = selectedLayout.seatPriorityMap[seatLetter] ?? 2;
                  const colorClass =
                    prio === 0
                      ? "bg-sky-900/80 border-sky-500/60 text-sky-100"
                      : prio === 1
                      ? "bg-indigo-900/80 border-indigo-500/60 text-indigo-100"
                      : "bg-teal-900/80 border-teal-500/60 text-teal-100";
                  return (
                    <div
                      key={`preview-left-${seatLetter}`}
                      className="grid gap-1"
                      style={{
                        gridTemplateColumns: `repeat(${selectedLayout.nRows}, minmax(20px, 1fr))`,
                      }}
                    >
                      {Array.from(
                        { length: selectedLayout.nRows },
                        (_, idx) => idx + 1
                      ).map((rowNum) => (
                        <div
                          key={`R${rowNum}${seatLetter}`}
                          className={`h-6 rounded-md border text-[9px] font-mono font-bold flex items-center justify-center ${colorClass}`}
                          title={`Baris ${rowNum} Kursi ${seatLetter} (Zona ${zoneOfRow(
                            rowNum,
                            zoneBounds
                          )})`}
                        >
                          {seatLetter}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Lorong Tunggal Tengah */}
              <div className="py-2 px-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-semibold text-emerald-400">
                    → PINTU BOARDING DEPAN (Baris 1)
                  </span>
                  <span className="font-mono text-[#97D7FF]">
                    LORONG TUNGGAL (BARIS 1 S/D {selectedLayout.nRows})
                  </span>
                  <span className="font-semibold text-slate-400">
                    BAGIAN EKOR (Baris {selectedLayout.nRows})
                  </span>
                </div>
                <div
                  className="grid gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${selectedLayout.nRows}, minmax(20px, 1fr))`,
                  }}
                >
                  {Array.from(
                    { length: selectedLayout.nRows },
                    (_, idx) => idx + 1
                  ).map((rowNum) => {
                    const zId = zoneOfRow(rowNum, zoneBounds);
                    return (
                      <div
                        key={`aisle-${rowNum}`}
                        className={`h-6 rounded-md text-[9px] font-mono flex items-center justify-center border ${
                          zId === 1
                            ? "bg-slate-900 border-slate-700 text-sky-300"
                            : zId === 2
                            ? "bg-slate-800/90 border-slate-700 text-amber-300"
                            : "bg-slate-900 border-slate-700 text-emerald-300"
                        }`}
                        title={`Baris ${rowNum} — Zona ${zId}`}
                      >
                        {rowNum}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sisi Kanan */}
              <div className="flex flex-col gap-1">
                {selectedLayout.rightSeats.map((seatLetter) => {
                  const prio = selectedLayout.seatPriorityMap[seatLetter] ?? 2;
                  const colorClass =
                    prio === 0
                      ? "bg-sky-900/80 border-sky-500/60 text-sky-100"
                      : prio === 1
                      ? "bg-indigo-900/80 border-indigo-500/60 text-indigo-100"
                      : "bg-teal-900/80 border-teal-500/60 text-teal-100";
                  return (
                    <div
                      key={`preview-right-${seatLetter}`}
                      className="grid gap-1"
                      style={{
                        gridTemplateColumns: `repeat(${selectedLayout.nRows}, minmax(20px, 1fr))`,
                      }}
                    >
                      {Array.from(
                        { length: selectedLayout.nRows },
                        (_, idx) => idx + 1
                      ).map((rowNum) => (
                        <div
                          key={`R${rowNum}${seatLetter}`}
                          className={`h-6 rounded-md border text-[9px] font-mono font-bold flex items-center justify-center ${colorClass}`}
                          title={`Baris ${rowNum} Kursi ${seatLetter} (Zona ${zoneOfRow(
                            rowNum,
                            zoneBounds
                          )})`}
                        >
                          {seatLetter}
                        </div>
                      ))}
                    </div>
                  );
                })}
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                  Sisi Kanan Kabin (Kursi {selectedLayout.rightSeats.join(", ")})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bagian Bawah: Kondisi Penumpang (100% Terisi) & Persentase Penumpang Membawa Bagasi */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs flex flex-col gap-6">
          <div className="pb-3 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-[#086288]">
              2. Kondisi Penumpang & Bagasi Kabin
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5">
              Kondisi Penumpang (100% Kursi Terisi) & Persentase Penumpang Membawa Bagasi
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Seluruh kursi pesawat diasumsikan terisi penuh (100%) mengikuti kapasitas layout yang
              dipilih. Masukkan persentase penumpang yang membawa bagasi kabin, dan jumlah orang yang
              membawa bagasi akan dihitung secara otomatis.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Input 1: Jumlah Penumpang (Otomatis 100% Mengikuti Kapasitas Layout) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="layout-passenger-count-input"
                  className="text-xs font-bold text-slate-800 flex items-center gap-1.5"
                >
                  <Users className="w-4 h-4 text-[#086288]" />
                  Jumlah Penumpang (Otomatis 100% Kursi Terisi)
                </label>
                <span className="text-[11px] font-mono text-[#086288] font-semibold">
                  Otomatis: {selectedLayout.capacity} kursi
                </span>
              </div>

              <div className="relative flex items-center">
                <input
                  id="layout-passenger-count-input"
                  type="text"
                  readOnly
                  value={`${selectedLayout.capacity} Orang (100% Kursi Terisi)`}
                  aria-label="Jumlah Penumpang (Otomatis 100% Kursi Terisi)"
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-slate-100/90 border-slate-300 text-slate-900 text-sm font-mono font-bold cursor-default focus:outline-none"
                />
              </div>

              <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Otomatis mengikuti kapasitas {selectedLayout.name}: seluruh{" "}
                  {selectedLayout.capacity} kursi terisi penuh (100%).
                </span>
              </div>
            </div>

            {/* Input 2: Persentase Penumpang Membawa Bagasi (%) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="layout-baggage-percent-input"
                  className="text-xs font-bold text-slate-800 flex items-center gap-1.5"
                >
                  <Luggage className="w-4 h-4 text-amber-700" />
                  Penumpang Membawa Bagasi (%)
                </label>
                <span className="text-[11px] font-mono text-slate-500">
                  Rentang: 0% – 100%
                </span>
              </div>

              <div className="relative flex items-center">
                <input
                  id="layout-baggage-percent-input"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={baggagePercentInput}
                  onChange={(e) => onChangeBaggagePercentInput(e.target.value)}
                  placeholder="Ketik persentase bagasi (0 - 100%)..."
                  className={`w-full pr-12 px-3.5 py-2.5 rounded-xl border text-sm font-mono font-bold transition-colors focus:outline-none focus:ring-2 ${
                    baggageError
                      ? "bg-rose-50/70 border-rose-400 text-rose-950 focus:ring-rose-600"
                      : "bg-slate-50 border-slate-300 text-slate-900 focus:ring-[#086288]"
                  }`}
                />
                <span className="absolute right-3.5 text-xs font-bold text-slate-500 font-mono">
                  %
                </span>
              </div>

              {baggageError ? (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                  <span>{baggageError}</span>
                </div>
              ) : (
                <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Dihitung otomatis:{" "}
                    <strong>{validBagForPreview ?? 0} orang</strong> membawa bagasi kabin (
                    {validBagPctForPreview ?? 0}%) dan{" "}
                    <strong>
                      {Math.max(0, validPaxForPreview - (validBagForPreview ?? 0))} orang
                    </strong>{" "}
                    tanpa bagasi kabin.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Kartu Ringkasan Input Skenario Aktif (Format Rata Tengah: Judul di Atas, Nilai di Bawah) */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 text-center sm:text-left">
              Ringkasan Kondisi Penerbangan Aktif
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Kartu 1: Kapasitas Maksimum Pesawat */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500">
                  Kapasitas Maksimum Pesawat
                </span>
                <strong className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
                  {selectedLayout.capacity} Kursi
                </strong>
              </div>

              {/* Kartu 2: Jumlah Penumpang (Otomatis 100%) */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500">
                  Kondisi Penumpang (100% Terisi)
                </span>
                <strong className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
                  {validPaxForPreview} Orang
                </strong>
              </div>

              {/* Kartu 3: Penumpang Membawa Bagasi (Otomatis) */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500">
                  Penumpang Membawa Bagasi
                </span>
                <strong
                  className={`text-xl sm:text-2xl font-bold font-mono ${
                    validBagForPreview !== null && !baggageError
                      ? "text-[#086288]"
                      : "text-slate-400 text-base sm:text-lg"
                  }`}
                >
                  {validBagForPreview !== null && !baggageError
                    ? `${validBagForPreview} Orang (${validBagPctForPreview}%)`
                    : "Belum valid"}
                </strong>
              </div>
            </div>
          </div>

          {/* Tombol Lanjut ke Menu 2 */}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              disabled={Boolean(passengerError || baggageError)}
              onClick={onProceedToSimulation}
              className={`w-full sm:w-auto py-3.5 px-6 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                passengerError || baggageError
                  ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                  : "bg-[#086288] hover:bg-[#064e6d] text-white shadow-md shadow-[#086288]/20 cursor-pointer"
              }`}
            >
              <span>Lanjut ke Simulasi</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
