import React from "react";
import {
  Menu,
  Info,
  Layers,
  Users,
  Luggage,
  UserCheck,
} from "lucide-react";
import { NavTab } from "./Sidebar";
import { AircraftLayoutConfig } from "../simulation/engine";

interface HeaderProps {
  activeTab: NavTab;
  onOpenMobileMenu: () => void;
  selectedLayout: AircraftLayoutConfig;
  passengerCountInput: string;
  baggageCountInput: string;
  onOpenInfoModal: () => void;
  operatorName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenMobileMenu,
  selectedLayout,
  passengerCountInput,
  baggageCountInput,
  onOpenInfoModal,
  operatorName,
}) => {
  const titles: Record<NavTab, { title: string; desc: string }> = {
    aircraft: {
      title: "Menu 1 — Pemilihan Layout Pesawat",
      desc: "Pilih jenis pesawat, periksa diagram denah kabin dari atas, serta tentukan jumlah penumpang dan penumpang pembawa bagasi kabin.",
    },
    simulation: {
      title: "Menu 2 — Verifikasi Skenario & Evaluasi AZBO",
      desc: "Verifikasi ringkasan skenario dan parameter model sebelum menjalankan evaluasi komparatif serta optimasi zona AZBO.",
    },
    results: {
      title: "Menu 3 — Hasil Optimasi AZBO & Simulasi Metode Terbaik",
      desc: "Rekomendasi metode boarding tercepat, tabel peringkat seluruh metode, dan simulasi animasi gerakan penumpang metode terbaik.",
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
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sky-50 text-[#086288] border border-sky-200 whitespace-nowrap">
                <Layers className="w-3 h-3 text-[#086288]" />
                {selectedLayout.name} ({selectedLayout.seatConfiguration} • {selectedLayout.capacity} Kursi)
              </span>
            </div>
            <p className="text-xs text-slate-500 font-normal mt-0.5 max-w-2xl leading-relaxed">
              {current.desc}
            </p>
          </div>
        </div>

        {/* Right: Active Scenario Summary & Info Modal Trigger */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
          <div className="flex items-center gap-2 bg-slate-100/90 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <span className="inline-flex items-center gap-1 font-semibold text-slate-700 whitespace-nowrap">
              <Users className="w-3.5 h-3.5 text-[#086288]" />
              Penumpang:{" "}
              <strong className="font-mono text-slate-900">
                {passengerCountInput.trim() !== ""
                  ? `${passengerCountInput}/${selectedLayout.capacity}`
                  : `—/${selectedLayout.capacity}`}
              </strong>
            </span>
            <span className="text-slate-300">|</span>
            <span className="inline-flex items-center gap-1 font-semibold text-slate-700 whitespace-nowrap">
              <Luggage className="w-3.5 h-3.5 text-amber-700" />
              Bagasi:{" "}
              <strong className="font-mono text-slate-900">
                {baggageCountInput.trim() !== "" ? `${baggageCountInput} orang` : "— orang"}
              </strong>
            </span>
          </div>

          {/* Info Modal Trigger */}
          <button
            onClick={onOpenInfoModal}
            className="p-2 text-slate-600 hover:text-[#086288] hover:bg-slate-100 rounded-xl border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#086288] transition-colors shrink-0"
            title="Catatan sumber data & batasan penelitian"
            aria-label="Catatan sumber data & batasan penelitian"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* Demo Session Indicator */}
          <div className="hidden xl:flex items-center gap-2.5 pl-3 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shadow-2xs shrink-0 bg-gradient-to-tr from-[#086288] to-[#4D8DBA] text-white">
              DEMO
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-800 leading-tight whitespace-nowrap">
                {operatorName || "Mode Demo Publik"}
              </span>
              <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1 whitespace-nowrap">
                <UserCheck className="w-3 h-3 text-emerald-600" />
                Simulasi Browser Aktif
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
