import React from "react";
import {
  Plane,
  PlayCircle,
  BarChart3,
  Info,
  LogOut,
  CheckCircle2,
  UserCheck,
} from "lucide-react";
import { AircraftLayoutConfig } from "../simulation/engine";

export type NavTab = "aircraft" | "simulation" | "results";

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  selectedLayout: AircraftLayoutConfig;
  passengerCountInput: string;
  baggageCountInput: string;
  hasSimulationResult: boolean;
  operatorName?: string;
  onOpenInfoModal?: () => void;
  onExitDemo?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  hasSimulationResult,
  operatorName,
  onOpenInfoModal,
  onExitDemo,
}) => {
  const menuItems: Array<{
    id: NavTab;
    label: string;
    description: string;
    icon: React.ElementType;
    showReadyDot?: boolean;
  }> = [
    {
      id: "aircraft",
      label: "Pesawat",
      description: "Memilih layout dan memasukkan data skenario",
      icon: Plane,
    },
    {
      id: "simulation",
      label: "Simulasi",
      description: "Memeriksa skenario dan menjalankan evaluasi AZBO",
      icon: PlayCircle,
    },
    {
      id: "results",
      label: "Hasil",
      description: "Melihat perbandingan metode dan simulasi metode terbaik",
      icon: BarChart3,
      showReadyDot: hasSimulationResult,
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full px-4 sm:px-6 lg:px-8 pt-3.5 pb-1.5">
      <div className="max-w-7xl mx-auto flex flex-col gap-2.5 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-4">
        {/* Baris Atas pada Mobile/Tablet (Logo di Kiri + Pengguna & Keluar di Kanan) / Kolom Kiri pada Desktop */}
        <div className="flex items-center justify-between lg:justify-start gap-3">
          {/* Area Kiri: Identitas Merek ZoneFlow */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#0d1522]/95 backdrop-blur-md border border-slate-700/80 shadow-md shadow-slate-900/10 shrink-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#086288] to-[#4D8DBA] border border-[#97D7FF]/40 flex items-center justify-center text-white shadow-xs shrink-0">
              <Plane className="w-3.5 h-3.5 -rotate-45" />
            </div>
            <span className="font-bold text-base tracking-tight text-white">
              ZoneFlow
            </span>
          </div>

          {/* Kontrol Pengguna & Keluar pada Layar Tablet/Mobile */}
          <div className="flex flex-wrap lg:hidden items-center justify-end gap-1.5 px-2.5 py-1.5 rounded-full bg-[#0d1522]/95 backdrop-blur-md border border-slate-700/80 shadow-md shadow-slate-900/10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-[11px] text-slate-200">
              <UserCheck className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="font-medium">
                {operatorName || "Petugas Operasional"}
              </span>
            </div>

            {onOpenInfoModal && (
              <button
                type="button"
                onClick={onOpenInfoModal}
                className="p-1.5 rounded-full bg-slate-800/90 hover:bg-slate-700 text-[#97D7FF] border border-slate-700 transition-colors cursor-pointer"
                title="Informasi model & batasan simulasi"
                aria-label="Informasi model & batasan simulasi"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            )}

            {onExitDemo && (
              <button
                type="button"
                onClick={onExitDemo}
                className="px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Keluar ke halaman login"
              >
                <LogOut className="w-3.5 h-3.5 text-[#FFEFC4]" />
                <span>Keluar Demo</span>
              </button>
            )}
          </div>
        </div>

        {/* Area Tengah: Kapsul Navigasi Utama (Seimbang Tepat di Tengah Layar) */}
        <nav
          aria-label="Navigasi Utama"
          className="justify-self-center w-full sm:w-auto flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#0d1522]/95 backdrop-blur-md border border-slate-700/80 shadow-lg shadow-slate-900/15"
        >
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                title={item.description}
                aria-current={isActive ? "page" : undefined}
                className={`flex-1 sm:flex-initial justify-center px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#97D7FF] ${
                  isActive
                    ? "bg-gradient-to-r from-[#086288] to-[#4D8DBA] text-white shadow-md shadow-[#086288]/30 border border-[#97D7FF]/40"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? "text-[#FFEFC4]" : "text-[#97D7FF]"
                  }`}
                />
                <span>{item.label}</span>
                {item.showReadyDot && (
                  <CheckCircle2
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive ? "text-[#FFEFC4]" : "text-emerald-400"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Area Kanan pada Desktop: Kapsul Informasi Pengguna, Info Model, & Keluar Demo Terpisah */}
        <div className="hidden lg:flex items-center justify-self-end gap-2 px-3 py-1.5 rounded-full bg-[#0d1522]/95 backdrop-blur-md border border-slate-700/80 shadow-md shadow-slate-900/10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs text-slate-200">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-medium whitespace-nowrap">
              {operatorName || "Petugas Operasional"}
            </span>
          </div>

          {onOpenInfoModal && (
            <button
              type="button"
              onClick={onOpenInfoModal}
              className="p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-[#97D7FF] border border-slate-700 transition-colors cursor-pointer"
              title="Informasi model & batasan simulasi"
              aria-label="Informasi model & batasan simulasi"
            >
              <Info className="w-4 h-4" />
            </button>
          )}

          {onExitDemo && (
            <button
              type="button"
              onClick={onExitDemo}
              className="px-3.5 py-1 rounded-full bg-slate-800/90 hover:bg-slate-700 text-white border border-slate-600/80 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              title="Kembali ke halaman login"
            >
              <LogOut className="w-3.5 h-3.5 text-[#FFEFC4]" />
              <span>Keluar Demo</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
