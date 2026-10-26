import React from "react";
import {
  LayoutDashboard,
  PlayCircle,
  BarChart3,
  Luggage,
  BookOpen,
  Info,
  Plane,
  Terminal,
  ChevronRight,
  X,
} from "lucide-react";

export type NavTab =
  | "dashboard"
  | "simulation"
  | "results"
  | "baggage"
  | "methodology"
  | "about";

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const menuItems: Array<{
    id: NavTab;
    label: string;
    sublabel: string;
    icon: React.ElementType;
    badge?: string;
  }> = [
    {
      id: "dashboard",
      label: "Dashboard",
      sublabel: "Ringkasan & Metrik Kunci",
      icon: LayoutDashboard,
    },
    {
      id: "simulation",
      label: "Simulasi Boarding",
      sublabel: "Kabin 2D, Batch & GA",
      icon: PlayCircle,
      badge: "Aktif",
    },
    {
      id: "results",
      label: "Hasil & Perbandingan",
      sublabel: "Benchmark & Uji Pasangan",
      icon: BarChart3,
    },
    {
      id: "baggage",
      label: "Analisis Bagasi",
      sublabel: "Sensitivitas Muatan 50%–70%",
      icon: Luggage,
    },
    {
      id: "methodology",
      label: "Metodologi & Data",
      sublabel: "Parameter & Referensi",
      icon: BookOpen,
      badge: "5 CSV",
    },
    {
      id: "about",
      label: "Tentang ZoneFlow",
      sublabel: "Arsitektur & Kontrak API",
      icon: Info,
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-72 bg-[#0d1522] text-slate-200 flex flex-col justify-between p-4 transition-transform duration-300 lg:translate-x-0 shrink-0 ${
          isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col gap-6">
          {/* Logo & Brand Header */}
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-800/60 rounded-2xl border border-slate-700/50 backdrop-blur-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#086288] to-[#4D8DBA] flex items-center justify-center text-white shadow-md shadow-[#086288]/40 shrink-0">
                <Plane className="w-5 h-5 -rotate-45" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-lg tracking-tight text-white">
                    ZoneFlow
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#97D7FF]/20 text-[#97D7FF]">
                    v3.2
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  Simulasi & Analitik Boarding
                </span>
              </div>
            </div>
            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 lg:hidden"
                aria-label="Tutup menu navigasi"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Navigation Menu */}
          <nav className="flex flex-col gap-1.5" aria-label="Navigasi Utama">
            <div className="text-[11px] font-semibold text-slate-400 px-3 pb-1">
              Menu Navigasi
            </div>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#97D7FF] ${
                    isActive
                      ? "bg-[#086288] text-white shadow-md shadow-[#086288]/30 font-semibold"
                      : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`p-2 rounded-lg transition-colors shrink-0 ${
                        isActive
                          ? "bg-white/15 text-white"
                          : "bg-slate-800/90 text-slate-400 group-hover:text-white group-hover:bg-slate-700"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] leading-snug whitespace-nowrap">
                        {item.label}
                      </span>
                      <span
                        className={`text-[11px] leading-snug whitespace-nowrap ${
                          isActive ? "text-slate-200" : "text-slate-400"
                        }`}
                      >
                        {item.sublabel}
                      </span>
                    </div>
                  </div>

                  {item.badge ? (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${
                        isActive
                          ? "bg-[#FFEFC4] text-slate-900"
                          : "bg-slate-800 text-[#97D7FF] border border-slate-700"
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : (
                    isActive && (
                      <ChevronRight className="w-4 h-4 text-white/70 shrink-0" />
                    )
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Status Card */}
        <div className="flex flex-col gap-3 pt-4 border-t border-slate-800/80">
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                Data Benchmark
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded whitespace-nowrap">
                Tersimpan
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              100 replikasi × 3 tingkat bagasi (50%, 60%, 70%) dari eksperimen Python.
            </p>
          </div>

          <div className="flex items-center justify-between px-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-400" />
              Mesin Python v3
            </span>
            <span className="font-mono text-[10px] text-slate-400">Kabin 3-3 (180 Kursi)</span>
          </div>
        </div>
      </aside>
    </>
  );
};
