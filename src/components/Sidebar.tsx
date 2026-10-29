import React from "react";
import {
  Plane,
  BarChart3,
  PlayCircle,
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
  passengerCountInput?: string;
  baggageCountInput?: string;
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
      description: "Menu 1 — Pilih Pesawat & Kondisi Penumpang",
      icon: Plane,
    },
    {
      id: "simulation",
      label: "Simulasi",
      description: "Menu 2 — Simulasi Boarding & Jalankan Simulasi",
      icon: PlayCircle,
    },
    {
      id: "results",
      label: "Hasil",
      description:
        "Menu 3 — Metode yang Direkomendasikan, Perbandingan Metode & Animasi Boarding",
      icon: BarChart3,
      showReadyDot: hasSimulationResult,
    },
  ];

  const iconLogoUrl = `${import.meta.env.BASE_URL}assets/zoneflow-logo-icon.png`;

  return (
    <header className="sticky top-0 z-40 w-full px-4 sm:px-6 lg:px-8 pt-3.5 pb-1.5">
      <div className="max-w-7xl mx-auto flex flex-col gap-2.5 lg:grid lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-4">
        {/* Baris Atas pada Mobile/Tablet (Logo di Kiri + Pengguna & Keluar di Kanan) / Kolom Kiri pada Desktop */}
        <div className="flex items-center justify-between lg:justify-start gap-3">
          {/* Area Kiri: Identitas Merek ZoneFlow */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#0d1522]/95 backdrop-blur-md border border-slate-700/80 shadow-md shadow-slate-900/10 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-white/95 border border-[#97D7FF]/40 p-1 flex items-center justify-center shadow-xs shrink-0">
              <img
                src={iconLogoUrl}
                alt="Simbol ZoneFlow"
                className="w-full h-full object-contain select-none"
              />
            </div>
            <span className="font-bold text-base tracking-tight text-white">
              ZoneFlow
            </span>
          </div>

          {/* Kontrol Pengguna & Keluar pada Layar Tablet/Mobile (Hanya Ikon) */}
          <div className="flex lg:hidden items-center justify-end gap-2 px-2.5 py-1.5 rounded-full bg-[#0d1522]/95 backdrop-blur-md border border-slate-700/80 shadow-md shadow-slate-900/10">
            <div
              role="img"
              title="Petugas Operasional Bandara"
              aria-label={operatorName || "Petugas Operasional Bandara"}
              className="w-9 h-9 rounded-full bg-slate-800/80 border border-slate-700/80 inline-flex items-center justify-center text-slate-200 transition-colors"
            >
              <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            </div>

            {onOpenInfoModal && (
              <button
                type="button"
                onClick={onOpenInfoModal}
                className="w-9 h-9 rounded-full bg-slate-800/90 hover:bg-slate-700 text-[#97D7FF] border border-slate-700 inline-flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#97D7FF]"
                title="Informasi model & batasan simulasi"
                aria-label="Informasi model & batasan simulasi"
              >
                <Info className="w-4 h-4 shrink-0" />
              </button>
            )}

            {onExitDemo && (
              <button
                type="button"
                onClick={onExitDemo}
                className="w-9 h-9 rounded-full bg-slate-800/90 hover:bg-slate-700 text-white border border-slate-600/80 inline-flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#97D7FF]"
                title="Keluar Demo"
                aria-label="Keluar Demo"
              >
                <LogOut className="w-4 h-4 text-[#FFEFC4] shrink-0" />
              </button>
            )}
          </div>
        </div>

        {/* Area Tengah: Kapsul Navigasi Utama 3 Menu (Pesawat, Simulasi, Hasil) */}
        <nav
          aria-label="Navigasi Utama"
          className="justify-self-center w-full sm:w-auto grid grid-cols-3 sm:flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-full bg-[#0d1522]/95 backdrop-blur-md border border-slate-700/80 shadow-lg shadow-slate-900/15"
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
                className={`justify-center px-3.5 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#97D7FF] ${
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

        {/* Area Kanan pada Desktop: Kapsul Ikon Pengguna, Info Model, & Keluar Demo */}
        <div className="hidden lg:flex items-center justify-self-end gap-2 px-2.5 py-1.5 rounded-full bg-[#0d1522]/95 backdrop-blur-md border border-slate-700/80 shadow-md shadow-slate-900/10">
          <div
            role="img"
            title="Petugas Operasional Bandara"
            aria-label={operatorName || "Petugas Operasional Bandara"}
            className="w-9 h-9 rounded-full bg-slate-800/80 border border-slate-700/80 inline-flex items-center justify-center text-slate-200 transition-colors"
          >
            <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>

          {onOpenInfoModal && (
            <button
              type="button"
              onClick={onOpenInfoModal}
              className="w-9 h-9 rounded-full bg-slate-800/80 hover:bg-slate-700 text-[#97D7FF] border border-slate-700 inline-flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#97D7FF]"
              title="Informasi model & batasan simulasi"
              aria-label="Informasi model & batasan simulasi"
            >
              <Info className="w-4 h-4 shrink-0" />
            </button>
          )}

          {onExitDemo && (
            <button
              type="button"
              onClick={onExitDemo}
              className="w-9 h-9 rounded-full bg-slate-800/90 hover:bg-slate-700 text-white border border-slate-600/80 inline-flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#97D7FF]"
              title="Keluar Demo"
              aria-label="Keluar Demo"
            >
              <LogOut className="w-4 h-4 text-[#FFEFC4] shrink-0" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
