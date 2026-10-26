import React, { useState } from "react";
import {
  Trophy,
  Cpu,
  Clock,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  PlayCircle,
  HelpCircle,
} from "lucide-react";
import { StatCard } from "../components/StatCard";
import {
  RINGKASAN_BENCHMARK,
  PEMENANG_PER_TINGKAT_BAGASI,
  PERBANDINGAN_BERPASANGAN_GA,
  CATATAN_BATASAN,
} from "../data/benchmarkData";
import { NavTab } from "../components/Sidebar";

interface DashboardViewProps {
  selectedBaggage: number; // 50, 60, 70
  onNavigate: (tab: NavTab) => void;
  onSelectBaggage: (ratio: number) => void;
}

const formatIdNumber = (num: number, decimals = 2): string =>
  num.toLocaleString("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export const DashboardView: React.FC<DashboardViewProps> = ({
  selectedBaggage,
  onNavigate,
  onSelectBaggage,
}) => {
  const [hoveredMethod, setHoveredMethod] = useState<string | null>(null);

  // Filter benchmark data for current baggage ratio
  const currentSummary = RINGKASAN_BENCHMARK.filter(
    (item) => item.baggage_percent === selectedBaggage
  ).sort((a, b) => a.mean_minutes - b.mean_minutes);

  const winner = PEMENANG_PER_TINGKAT_BAGASI.find(
    (w) => w.baggage_percent === selectedBaggage
  );

  const gaItem = currentSummary.find((s) => s.method === "GA-Zone-WMA");
  const fixedZoneItem = currentSummary.find((s) => s.method === "Fixed-Zone-WMA");

  // Paired comparison GA vs Fixed-Zone-WMA
  const gaVsFixed = PERBANDINGAN_BERPASANGAN_GA.find(
    (p) =>
      p.baggage_percent === selectedBaggage &&
      p.comparison.includes("Fixed-Zone-WMA")
  );

  // Accurate calculations for KPI Cards
  const winnerMinutes = winner?.mean_minutes ?? 4.645;
  const winnerSeconds = winnerMinutes * 60;

  const gaMinutes = gaItem?.mean_minutes ?? 4.978;
  const gaSeconds = gaMinutes * 60;
  const gaRank = Math.round(gaItem?.rank_within_baggage ?? 3);

  const fixedMinutes = fixedZoneItem?.mean_minutes ?? 5.031;
  const fixedSeconds = fixedMinutes * 60;
  const gaFasterSeconds = gaVsFixed
    ? Math.abs(gaVsFixed.mean_difference_seconds)
    : Math.max(0, fixedSeconds - gaSeconds);
  const gaFasterPct =
    fixedSeconds > 0 ? (gaFasterSeconds / fixedSeconds) * 100 : 0;
  const gaWinReplications = gaVsFixed
    ? Math.round(gaVsFixed.fraction_GA_faster * gaVsFixed.n_pairs)
    : 54;
  const totalPairs = gaVsFixed?.n_pairs ?? 100;

  const passengersWithBags = Math.round(180 * (selectedBaggage / 100));

  // Max value for chart scaling
  const maxTime = Math.max(...currentSummary.map((c) => c.mean_minutes));

  return (
    <div className="flex flex-col gap-6 p-5 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Top Banner / Introduction */}
      <div className="bg-gradient-to-r from-[#086288] via-[#10749e] to-[#4D8DBA] rounded-3xl p-6 lg:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-12 bottom-0 w-48 h-48 bg-[#97D7FF]/20 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex flex-col gap-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-medium backdrop-blur-xs w-fit">
              <ShieldCheck className="w-3.5 h-3.5 text-[#97D7FF] shrink-0" />
              <span>Data Benchmark Tersimpan • 100 Replikasi Independen per Skenario</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold tracking-tight leading-tight">
              Eksplorasi Metode Boarding & Optimasi Zona GA
            </h2>
            <p className="text-sm text-slate-100/95 leading-relaxed">
              ZoneFlow memodelkan kabin pesawat lorong tunggal berkapasitas 180 kursi
              (30 baris, konfigurasi 3-3) untuk mengukur antrean lorong, interferensi
              kursi, dan efisiensi waktu boarding pada berbagai tingkat muatan bagasi kabin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => onNavigate("simulation")}
              className="px-5 py-3 rounded-xl bg-white text-[#086288] font-semibold text-sm shadow-sm hover:bg-[#FFEFC4] hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-all duration-200 flex items-center gap-2"
            >
              <PlayCircle className="w-4 h-4 text-[#086288]" />
              Buka Simulasi Kabin 2D
            </button>
            <button
              onClick={() => onNavigate("results")}
              className="px-5 py-3 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-sm backdrop-blur-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors flex items-center gap-2"
            >
              Lihat Tabel Hasil Lengkap
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Row of 4 KPI Stat Cards — Responsive 1 -> 2 -> 4 Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Card 1: Metode Tercepat */}
        <StatCard
          title="Metode Tercepat"
          value={formatIdNumber(winnerMinutes, 2)}
          unit="menit"
          badge="Peringkat #1"
          subtitle={winner?.method || "Back-to-Front-WILMA"}
          secondaryText={`Tercepat dari 12 metode (${formatIdNumber(winnerSeconds, 1)} detik)`}
          variant="mint"
          icon={Trophy}
          tooltip="Metode dengan rata-rata waktu boarding tercepat dari 100 replikasi pada tingkat bagasi yang dipilih."
        />

        {/* Card 2: Hasil GA-Zone-WMA */}
        <StatCard
          title="Hasil GA-Zone-WMA"
          value={formatIdNumber(gaMinutes, 2)}
          unit="menit"
          badge="Kromosom [5, 18]"
          subtitle={`Peringkat #${gaRank} dari 12 metode (${formatIdNumber(gaSeconds, 1)} detik)`}
          secondaryText="Batas zona: baris 5 & 18 • Selisih dari Exhaustive Search: 0,00%"
          variant="sky"
          icon={Cpu}
          tooltip="Hasil optimasi Algoritma Genetika: batas zona di baris 5 dan 18 (ukuran zona [5, 13, 12]), urutan panggil zona 3 → 2 → 1."
        />

        {/* Card 3: Baseline Zona Tetap (Fixed-Zone) */}
        <StatCard
          title="Baseline Zona Tetap"
          value={formatIdNumber(fixedMinutes, 2)}
          unit="menit"
          badge="Fixed-Zone (3 Zona)"
          subtitle={`GA rata-rata ${formatIdNumber(gaFasterSeconds, 1)} detik (${formatIdNumber(gaFasterPct, 2)}%) lebih cepat`}
          secondaryText={`10 baris/zona (${formatIdNumber(fixedSeconds, 1)} dtk) • GA unggul di ${gaWinReplications}/${totalPairs} replikasi`}
          variant="cream"
          icon={Layers}
          tooltip="Pembanding tiga zona seimbang (masing-masing 10 baris: 1–10, 11–20, 21–30) dengan urutan belakang ke depan dan aturan WMA."
        />

        {/* Card 4: Skenario Simulasi */}
        <StatCard
          title="Skenario Simulasi"
          value={`${selectedBaggage}%`}
          unit="penumpang berbagasi"
          badge="100 Replikasi"
          subtitle="180 kursi (30 baris, konfigurasi 3-3)"
          secondaryText={`${passengersWithBags} dari 180 penumpang membawa bagasi kabin`}
          variant="lavender"
          icon={Clock}
          tooltip="Proporsi penumpang yang membawa tas kabin (carry-on luggage) dengan distribusi waktu simpan Weibull (skala 16,0 detik, bentuk 1,7)."
        />
      </div>

      {/* Main Section: Benchmark Comparison Bar Chart */}
      <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/90 shadow-xs flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                Peringkat Rata-rata Waktu Boarding (Bagasi {selectedBaggage}%)
              </h3>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                12 Metode
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Diurutkan dari durasi rata-rata tercepat hingga paling lambat berdasarkan 100 replikasi independen per metode.
            </p>
          </div>

          {/* Quick Baggage Pill Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold shrink-0">
            <span className="text-xs text-slate-600 px-2.5">Tingkat Bagasi:</span>
            {[50, 60, 70].map((b) => (
              <button
                key={b}
                onClick={() => onSelectBaggage(b)}
                className={`px-3 py-1.5 rounded-lg transition-colors tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#086288] ${
                  selectedBaggage === b
                    ? "bg-[#086288] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {b}%
              </button>
            ))}
          </div>
        </div>

        {/* Custom Visual Bar List with High Clarity */}
        <div className="flex flex-col gap-2.5">
          {currentSummary.map((item) => {
            const isWinner = item.rank_within_baggage === 1;
            const isGA = item.method === "GA-Zone-WMA";
            const isExhaustive = item.method === "Exhaustive-Zone-WMA";
            const isSlow = item.mean_minutes > 15;

            const widthPct = Math.max(6, (item.mean_minutes / maxTime) * 100);

            let barColor = "bg-[#4D8DBA]";
            if (isWinner) {
              barColor = "bg-gradient-to-r from-emerald-500 to-teal-600";
            } else if (isGA || isExhaustive) {
              barColor = "bg-gradient-to-r from-[#086288] to-[#4D8DBA]";
            } else if (isSlow) {
              barColor = "bg-gradient-to-r from-amber-500 to-rose-500";
            }

            return (
              <div
                key={item.method}
                onMouseEnter={() => setHoveredMethod(item.method)}
                onMouseLeave={() => setHoveredMethod(null)}
                className={`group p-3.5 rounded-2xl border transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  hoveredMethod === item.method
                    ? "bg-slate-50 border-slate-300 shadow-2xs"
                    : "bg-white border-slate-100 hover:border-slate-200"
                }`}
              >
                {/* Method Name & Rank Badge */}
                <div className="flex items-center gap-3 sm:w-80 shrink-0 min-w-0">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold tabular-nums shrink-0 ${
                      isWinner
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {Math.round(item.rank_within_baggage)}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs sm:text-sm font-semibold text-slate-900 group-hover:text-[#086288] transition-colors break-words">
                      {item.method}
                    </span>
                    <span className="text-[11px] text-slate-500 tabular-nums">
                      Simpangan baku: ±{formatIdNumber(item.std_minutes, 2)} menit (±
                      {Math.round(item.std_minutes * 60)} detik)
                    </span>
                  </div>
                </div>

                {/* Bar representation */}
                <div className="flex-1 flex items-center gap-3 min-w-0">
                  <div className="w-full bg-slate-100 h-6 rounded-xl overflow-hidden relative p-0.5">
                    <div
                      className={`h-full rounded-lg transition-all duration-500 flex items-center justify-end pr-2.5 text-[11px] font-semibold text-white tabular-nums shadow-2xs ${barColor}`}
                      style={{ width: `${widthPct}%` }}
                    >
                      {widthPct > 22 && `${formatIdNumber(item.mean_minutes, 2)} mnt`}
                    </div>
                  </div>
                </div>

                {/* Numeric values */}
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:w-52 shrink-0 text-right">
                  <div className="flex flex-col tabular-nums">
                    <span className="text-sm font-bold text-slate-900">
                      {formatIdNumber(item.mean_minutes, 2)} menit
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {formatIdNumber(item.mean_minutes * 60, 1)} detik
                    </span>
                  </div>
                  {isWinner && (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                      Tercepat
                    </span>
                  )}
                  {isGA && (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sky-100 text-[#086288] border border-sky-200 whitespace-nowrap">
                      GA Usulan
                    </span>
                  )}
                  {isExhaustive && (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 whitespace-nowrap">
                      Optimum Eksak
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Scientific Context & Interpretation Note */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3 text-xs text-slate-600 leading-relaxed">
          <HelpCircle className="w-4 h-4 text-[#086288] shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-slate-800">
              Catatan Interpretasi Ilmiah & Asumsi Simulator
            </span>
            <p>
              Pada model kabin 180 kursi ini, metode terstruktur berbasis posisi kursi luar-ke-dalam (
              <strong>Back-to-Front-WILMA</strong>) menghasilkan penumpukan lorong terendah karena
              penumpang kursi jendela dan tengah duduk lebih dahulu dari baris belakang, sehingga mencegah
              interferensi kursi. Algoritma Genetika (<strong>GA-Zone-WMA</strong>) menemukan batas zona
              di baris 5 dan 18 (ukuran zona [5, 13, 12]) dengan urutan belakang-ke-depan [3, 2, 1],
              identik dengan solusi terbaik dari pencarian menyeluruh (<em>Exhaustive Search</em>) atas 546 kandidat.
            </p>
          </div>
        </div>
      </div>

      {/* Two Columns: GA Deep-Dive vs System Integrity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GA Highlights */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between gap-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-50 text-[#086288]">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    Optimasi Algoritma Genetika (GA)
                  </h4>
                  <span className="text-xs text-slate-500">
                    Konfigurasi Batas & Urutan Pemanggilan Zona Terbaik
                  </span>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                Sesuai Optimum Exhaustive (0,00%)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-0.5">
                <span className="text-xs text-slate-500 font-medium">Batas Zona</span>
                <span className="text-base font-bold text-slate-900 font-mono tabular-nums">
                  [5, 18]
                </span>
                <span className="text-[11px] text-slate-500">Ukuran baris: [5, 13, 12]</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-0.5">
                <span className="text-xs text-slate-500 font-medium">Urutan Panggil</span>
                <span className="text-base font-bold text-slate-900 font-mono tabular-nums">
                  [3, 2, 1]
                </span>
                <span className="text-[11px] text-slate-500">Belakang → Tengah → Depan</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-0.5">
                <span className="text-xs text-slate-500 font-medium">Ruang Solusi</span>
                <span className="text-base font-bold text-[#086288] font-mono tabular-nums">
                  546 Kandidat
                </span>
                <span className="text-[11px] text-slate-500">91 partisi × 6 urutan</span>
              </div>
            </div>

            {/* Pembagian Zona Detail */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-sky-50/70 border border-sky-100 text-xs text-slate-700">
              <div className="flex flex-col items-center text-center gap-0.5">
                <span className="font-semibold text-[#086288]">Zona 1 (Depan)</span>
                <span className="font-mono text-slate-900 font-semibold tabular-nums">Baris 1–5</span>
                <span className="text-[11px] text-slate-500">5 baris (30 kursi)</span>
              </div>
              <div className="flex flex-col items-center text-center border-x border-sky-200/60 px-2 gap-0.5">
                <span className="font-semibold text-[#086288]">Zona 2 (Tengah)</span>
                <span className="font-mono text-slate-900 font-semibold tabular-nums">Baris 6–18</span>
                <span className="text-[11px] text-slate-500">13 baris (78 kursi)</span>
              </div>
              <div className="flex flex-col items-center text-center gap-0.5">
                <span className="font-semibold text-[#086288]">Zona 3 (Belakang)</span>
                <span className="font-mono text-slate-900 font-semibold tabular-nums">Baris 19–30</span>
                <span className="text-[11px] text-slate-500">12 baris (72 kursi)</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Hasil Algoritma Genetika telah diverifikasi terhadap pencarian menyeluruh (
              <em>Exhaustive Search</em>). Pada himpunan pelatihan 15 skenario (3 tingkat bagasi × 5 replikasi),
              GA mencapai <strong>selisih 0,00%</strong> terhadap solusi eksak terbaik (batas baris [5, 18] dan urutan zona [3, 2, 1]).
            </p>
          </div>

          <button
            onClick={() => onNavigate("results")}
            className="w-full py-2.5 px-4 rounded-xl border border-[#086288] text-[#086288] hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#086288] font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            Lihat Tabel Perbandingan Berpasangan GA
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Dataset Provenance & Model Boundaries */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between gap-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-800">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    Integritas Sumber Data & Batasan Model
                  </h4>
                  <span className="text-xs text-slate-500">
                    Transparansi Asumsi Simulasi & Metodologi Penelitian
                  </span>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                Terverifikasi
              </span>
            </div>

            <ul className="flex flex-col gap-2.5 text-xs text-slate-600 leading-relaxed">
              {CATATAN_BATASAN.keterbatasanKunci.slice(0, 3).map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#086288] mt-1.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500 font-mono">
              Model Kabin: Lorong Tunggal 3-3 (30 Baris)
            </span>
            <button
              onClick={() => onNavigate("methodology")}
              className="text-xs font-semibold text-[#086288] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#086288] rounded flex items-center gap-1"
            >
              Buka Metodologi Lengkap
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
