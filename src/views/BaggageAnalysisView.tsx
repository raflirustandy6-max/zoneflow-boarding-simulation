import React, { useState, useMemo } from "react";
import {
  Luggage,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { RINGKASAN_BENCHMARK } from "../data/benchmarkData";

export const BaggageAnalysisView: React.FC = () => {
  const [selectedMethodFocus, setSelectedMethodFocus] = useState<string>("All");

  // Calculate degradation from 50% to 70% for each method
  const degradationList = useMemo(() => {
    const methods = Array.from(new Set(RINGKASAN_BENCHMARK.map((r) => r.method)));

    return methods
      .map((method) => {
        const at50 = RINGKASAN_BENCHMARK.find(
          (r) => r.method === method && r.baggage_percent === 50
        );
        const at60 = RINGKASAN_BENCHMARK.find(
          (r) => r.method === method && r.baggage_percent === 60
        );
        const at70 = RINGKASAN_BENCHMARK.find(
          (r) => r.method === method && r.baggage_percent === 70
        );

        const t50 = at50?.mean_minutes || 0;
        const t60 = at60?.mean_minutes || 0;
        const t70 = at70?.mean_minutes || 0;

        const deltaMin = t70 - t50;
        const pctIncrease = t50 > 0 ? (deltaMin / t50) * 100 : 0;

        return {
          method,
          t50,
          t60,
          t70,
          deltaMin,
          pctIncrease,
        };
      })
      .sort((a, b) => a.deltaMin - b.deltaMin);
  }, []);

  const displayList = useMemo(() => {
    if (selectedMethodFocus === "All") return degradationList;
    return degradationList.filter((d) => d.method === selectedMethodFocus);
  }, [degradationList, selectedMethodFocus]);

  return (
    <div className="flex flex-col gap-6 p-5 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-800">
              <Luggage className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Analisis Sensitivitas Bagasi Kabin (50% → 60% → 70%)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Mengukur ketahanan setiap strategi boarding terhadap peningkatan proporsi barang bawaan penumpang.
              </p>
            </div>
          </div>
        </div>

        {/* Method filter selector */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-600 font-semibold whitespace-nowrap">Fokus Metode:</span>
          <select
            value={selectedMethodFocus}
            onChange={(e) => setSelectedMethodFocus(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#086288]"
          >
            <option value="All">Semua 12 Metode</option>
            {degradationList.map((d) => (
              <option key={d.method} value={d.method}>
                {d.method}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Key Takeaways Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-[#EAF8EE] border border-[#C3ECD0] flex flex-col justify-between gap-3 shadow-2xs">
          <div>
            <span className="text-xs font-semibold text-emerald-800">
              Paling Tahan Kenaikan Bagasi
            </span>
            <div className="text-xl font-bold text-slate-900 mt-1">
              GA-Zone-WMA & Back-to-Front-WILMA
            </div>
          </div>
          <div className="text-xs text-slate-700 leading-relaxed tabular-nums">
            Hanya bertambah <strong>+0,31 s/d +0,32 menit</strong> (+18,5–19,4 detik atau ~7,3%) saat proporsi bagasi naik dari 50% ke 70%.
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#FFF9EA] border border-[#FFE7A8] flex flex-col justify-between gap-3 shadow-2xs">
          <div>
            <span className="text-xs font-semibold text-amber-800">
              Rentan terhadap Kongesti Lorong
            </span>
            <div className="text-xl font-bold text-slate-900 mt-1">
              Rotating Zones & Front-to-Back
            </div>
          </div>
          <div className="text-xs text-slate-700 leading-relaxed tabular-nums">
            Bertambah tajam <strong>+4,22 hingga +8,78 menit</strong> akibat penumpukan antrean simpan bagasi di area depan kabin.
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#EFF8FF] border border-[#BAE1FD] flex flex-col justify-between gap-3 shadow-2xs">
          <div>
            <span className="text-xs font-semibold text-[#086288]">
              Model Penyimpanan Bagasi Stokastik
            </span>
            <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
              Weibull (α = 16,0 dtk; β = 1,7)
            </div>
          </div>
          <div className="text-xs text-slate-700 leading-relaxed">
            Mengacu pada distribusi empiris Schultz (2018) untuk memodelkan variasi waktu simpan barang ke kompartemen kabin.
          </div>
        </div>
      </div>

      {/* Sensitivity Curves & Visualization */}
      <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/90 shadow-xs flex flex-col gap-6">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            Perbandingan Pertambahan Waktu Boarding Antar-Tingkat Bagasi
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Diurutkan dari metode yang paling tahan kenaikan bagasi (selisih waktu terendah) hingga yang paling sensitif.
          </p>
        </div>

        {/* Visual Line/Trend Representation for Methods */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {displayList.map((item) => {
            const isWinner = item.method === "Back-to-Front-WILMA";
            const isGA = item.method === "GA-Zone-WMA";
            const isWorst = item.deltaMin > 3.0;

            return (
              <div
                key={item.method}
                className={`p-4 rounded-2xl border transition-all flex flex-col gap-3 ${
                  isWinner
                    ? "bg-emerald-50/50 border-emerald-200"
                    : isGA
                    ? "bg-sky-50/50 border-sky-200"
                    : isWorst
                    ? "bg-rose-50/30 border-rose-200"
                    : "bg-slate-50/50 border-slate-200"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="font-semibold text-sm text-slate-900 break-words">
                      {item.method}
                    </span>
                    {isWinner && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 whitespace-nowrap">
                        Tercepat
                      </span>
                    )}
                    {isGA && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-[#086288] whitespace-nowrap">
                        Paling Stabil
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs font-semibold font-mono tabular-nums px-2.5 py-0.5 rounded-full whitespace-nowrap ${
                      isWorst
                        ? "bg-rose-100 text-rose-800"
                        : "bg-slate-200/80 text-slate-800"
                    }`}
                  >
                    +{item.deltaMin.toFixed(2)} menit (+{item.pctIncrease.toFixed(1)}%)
                  </span>
                </div>

                {/* 3 Step Trend Nodes */}
                <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex flex-col">
                    <span className="text-[11px] text-slate-500 font-medium">Bagasi 50%</span>
                    <span className="text-sm font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                      {item.t50.toFixed(2)} menit
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex flex-col">
                    <span className="text-[11px] text-slate-500 font-medium">Bagasi 60%</span>
                    <span className="text-sm font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                      {item.t60.toFixed(2)} menit
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex flex-col">
                    <span className="text-[11px] text-slate-500 font-medium">Bagasi 70%</span>
                    <span className="text-sm font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                      {item.t70.toFixed(2)} menit
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Methodology Section on Baggage Generation */}
      <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/90 shadow-xs flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Activity className="w-5 h-5 text-[#086288]" />
          <h3 className="text-base font-bold text-slate-900">
            Metodologi Pembangkitan Bagasi & Distribusi Waktu Simpan
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-600 leading-relaxed">
          <div className="flex flex-col gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <span className="font-bold text-slate-900 text-sm">
              1. Penentuan Jumlah Penumpang Berbagasi
            </span>
            <p>
              Persentase skenario (50%, 60%, dan 70%) menentukan proporsi penumpang yang membawa
              tas kabin menggunakan pembulatan deterministik:
            </p>
            <code className="bg-slate-200/80 px-2.5 py-1 rounded-md text-xs font-mono text-slate-800 w-fit">
              n_bags = round(n_passengers × baggage_ratio)
            </code>
            <p>
              Untuk kapasitas penuh 180 kursi: 50% = 90 penumpang, 60% = 108 penumpang, dan 70% = 126 penumpang.
              Penempatan penumpang berbagasi diacak secara independen pada setiap replikasi berdasarkan <em>seed</em>.
            </p>
          </div>

          <div className="flex flex-col gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <span className="font-bold text-slate-900 text-sm">
              2. Distribusi Durasi Penyimpanan (Weibull)
            </span>
            <p>
              Durasi penumpang menyimpan barang ke kompartemen atas (<em>overhead bin</em>) dimodelkan
              secara stokastik dengan distribusi Weibull kontinu:
            </p>
            <code className="bg-slate-200/80 px-2.5 py-1 rounded-md text-xs font-mono text-slate-800 w-fit">
              scale (α) = 16,0 detik • shape (β) = 1,7
            </code>
            <p>
              Parameter ini mengacu pada pengukuran lapangan Schultz (2018). Selama penumpang menyimpan
              bagasi pada baris tujuannya, segmen lorong di baris tersebut tertutup sementara bagi penumpang di belakangnya.
            </p>
          </div>
        </div>

        {/* Notice for other baggage levels */}
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5 leading-relaxed">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Cakupan Data Benchmark:</span> Database hasil eksperimen tersimpan saat ini
            mengevaluasi tiga tingkat bagasi standar penelitian (<strong>50%, 60%, dan 70%</strong>).
            Untuk menguji skenario kustom atau replikasi baru secara langsung, gunakan panel <strong>Simulasi Batch Python</strong> pada menu Simulasi Boarding.
          </div>
        </div>
      </div>
    </div>
  );
};
