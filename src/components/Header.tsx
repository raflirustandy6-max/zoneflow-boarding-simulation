import React from "react";
import {
  Menu,
  SlidersHorizontal,
  Info,
  Calendar,
  Layers,
} from "lucide-react";
import { NavTab } from "./Sidebar";

interface HeaderProps {
  activeTab: NavTab;
  onOpenMobileMenu: () => void;
  selectedBaggage: number; // 50, 60, 70
  onSelectBaggage: (ratio: number) => void;
  onOpenInfoModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenMobileMenu,
  selectedBaggage,
  onSelectBaggage,
  onOpenInfoModal,
}) => {
  const titles: Record<NavTab, { title: string; desc: string }> = {
    dashboard: {
      title: "Ringkasan Dashboard",
      desc: "Evaluasi komparatif 12 metode boarding pesawat dan optimasi Algoritma Genetika (GA).",
    },
    simulation: {
      title: "Simulasi Boarding Interaktif",
      desc: "Visualisasi pergerakan penumpang, antrean lorong, dan optimasi zona pada kabin 3-3.",
    },
    results: {
      title: "Hasil & Perbandingan Benchmark",
      desc: "Tabel peringkat lengkap, metrik simpangan baku, dan uji berpasangan GA terhadap metode pembanding.",
    },
    baggage: {
      title: "Analisis Sensitivitas Bagasi",
      desc: "Dampak peningkatan proporsi bagasi kabin (50% → 60% → 70%) terhadap durasi boarding.",
    },
    methodology: {
      title: "Metodologi & Database Literatur",
      desc: "Dokumentasi lengkap 5 tabel referensi: inventaris metode, parameter simulasi, temuan studi, dan sitasi.",
    },
    about: {
      title: "Tentang ZoneFlow & Arsitektur",
      desc: "Tujuan penelitian, arsitektur frontend–backend Python, dan spesifikasi kontrak REST API.",
    },
  };

  const current = titles[activeTab];

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 px-5 sm:px-6 lg:px-8 py-4 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Mobile Toggle & Page Title */}
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <button
            onClick={onOpenMobileMenu}
            className="p-2 -ml-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#086288] lg:hidden shrink-0"
            aria-label="Buka menu navigasi"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                {current.title}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                <Layers className="w-3 h-3 text-[#086288]" />
                180 Kursi (30 Baris)
              </span>
            </div>
            <p className="text-xs text-slate-500 font-normal mt-0.5 max-w-2xl leading-relaxed">
              {current.desc}
            </p>
          </div>
        </div>

        {/* Right: Baggage Level Switcher & Actions */}
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap shrink-0">
          {/* Baggage selector */}
          <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 text-xs shadow-2xs">
            <span className="text-xs font-semibold text-slate-600 px-2.5 flex items-center gap-1.5 whitespace-nowrap">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              Bagasi:
            </span>
            {[50, 60, 70].map((val) => (
              <button
                key={val}
                onClick={() => onSelectBaggage(val)}
                className={`px-3 py-1.5 rounded-lg font-semibold tabular-nums transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#086288] ${
                  selectedBaggage === val
                    ? "bg-[#086288] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
                title={`Pilih skenario tingkat bagasi ${val}%`}
              >
                {val}%
              </button>
            ))}
          </div>

          {/* Info Modal Trigger */}
          <button
            onClick={onOpenInfoModal}
            className="p-2 text-slate-600 hover:text-[#086288] hover:bg-slate-100 rounded-xl border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#086288] transition-colors shrink-0"
            title="Catatan integritas sumber data & batasan penelitian"
            aria-label="Catatan integritas sumber data & batasan penelitian"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* Mode & Data Source Indicator */}
          <div className="hidden xl:flex items-center gap-2.5 pl-3 border-l border-slate-200">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shadow-2xs shrink-0 ${
                activeTab === "simulation"
                  ? "bg-gradient-to-tr from-[#086288] to-emerald-600 text-white"
                  : "bg-gradient-to-tr from-[#086288] to-[#4D8DBA] text-white"
              }`}
            >
              {activeTab === "simulation" ? "SIM" : "CSV"}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-800 leading-tight whitespace-nowrap">
                {activeTab === "simulation" ? "Mode Simulasi & Optimasi" : "Data Benchmark Tersimpan"}
              </span>
              <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1 whitespace-nowrap">
                <Calendar className="w-3 h-3" />
                {activeTab === "simulation" ? "Backend Python & Browser" : "100 Replikasi (Python)"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
