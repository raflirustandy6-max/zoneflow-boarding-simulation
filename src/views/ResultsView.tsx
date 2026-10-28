import React, { useState, useMemo } from "react";
import {
  BarChart3,
  Search,
  ArrowUpDown,
  Filter,
  Info,
  ChevronRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  RINGKASAN_BENCHMARK,
  PERBANDINGAN_BERPASANGAN_GA,
  INVENTARIS_METODE,
  BenchmarkSummaryItem,
  MethodCatalogItem,
} from "../data/benchmarkData";

export const ResultsView: React.FC = () => {
  const [selectedBaggageFilter, setSelectedBaggageFilter] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortField, setSortField] = useState<keyof BenchmarkSummaryItem>("mean_minutes");
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"benchmark" | "paired">("benchmark");
  const [selectedMethodDetail, setSelectedMethodDetail] = useState<MethodCatalogItem | null>(null);

  // Filtered and Sorted Benchmark Data
  const filteredBenchmark = useMemo(() => {
    return RINGKASAN_BENCHMARK.filter((item) => {
      const matchBaggage =
        selectedBaggageFilter === "all" || item.baggage_percent === selectedBaggageFilter;
      const matchSearch =
        item.method.toLowerCase().includes(searchQuery.toLowerCase());
      return matchBaggage && matchSearch;
    }).sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === "number" && typeof valB === "number") {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [selectedBaggageFilter, searchQuery, sortField, sortAsc]);

  // Filtered Paired Data for GA
  const filteredPaired = useMemo(() => {
    return PERBANDINGAN_BERPASANGAN_GA.filter((item) => {
      const matchBaggage =
        selectedBaggageFilter === "all" || item.baggage_percent === selectedBaggageFilter;
      const matchSearch = item.comparison
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      return matchBaggage && matchSearch;
    });
  }, [selectedBaggageFilter, searchQuery]);

  const handleSort = (field: keyof BenchmarkSummaryItem) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const openMethodDetail = (methodName: string) => {
    const meta =
      INVENTARIS_METODE.find(
        (m) =>
          m.method_name.toLowerCase().includes(methodName.toLowerCase()) ||
          methodName.toLowerCase().includes(m.method_name.toLowerCase())
      ) || null;
    setSelectedMethodDetail(meta);
  };

  return (
    <div className="flex flex-col gap-6 p-5 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Top Banner & Tab Controls */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-50 text-[#086288]">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Hasil & Analisis Komparatif
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Data benchmark resmi dari 100 replikasi independen per skenario tingkat bagasi.
              </p>
            </div>
          </div>
        </div>

        {/* Tab switcher: Benchmark Table vs Paired GA Comparison */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 flex-wrap">
          <button
            onClick={() => setActiveTab("benchmark")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#086288] ${
              activeTab === "benchmark"
                ? "bg-white text-[#086288] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Tabel Benchmark (12 Metode)
          </button>
          <button
            onClick={() => setActiveTab("paired")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#086288] ${
              activeTab === "paired"
                ? "bg-white text-[#086288] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Perbandingan Berpasangan GA
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-[#086288]">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Cari metode boarding..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none font-medium"
          />
        </div>

        {/* Baggage Level filter */}
        <div className="flex items-center gap-2 text-xs font-semibold flex-wrap">
          <span className="text-slate-600 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            Filter Bagasi:
          </span>
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            {(["all", 50, 60, 70] as Array<number | "all">).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setSelectedBaggageFilter(lvl)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tabular-nums transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#086288] ${
                  selectedBaggageFilter === lvl
                    ? "bg-[#086288] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {lvl === "all" ? "Semua" : `${lvl}%`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* View 1: Main Benchmark Table */}
      {activeTab === "benchmark" && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-semibold text-xs">
                  <th className="py-3.5 px-4 w-20">
                    <button
                      onClick={() => handleSort("rank_within_baggage")}
                      className="flex items-center gap-1 hover:text-slate-900"
                    >
                      Peringkat <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3.5 px-4">
                    <button
                      onClick={() => handleSort("method")}
                      className="flex items-center gap-1 hover:text-slate-900"
                    >
                      Metode Boarding <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3.5 px-4">
                    <button
                      onClick={() => handleSort("baggage_percent")}
                      className="flex items-center gap-1 hover:text-slate-900"
                    >
                      Tingkat Bagasi <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleSort("mean_minutes")}
                      className="inline-flex items-center gap-1 hover:text-slate-900 ml-auto"
                    >
                      Rata-rata (Menit) <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleSort("std_minutes")}
                      className="inline-flex items-center gap-1 hover:text-slate-900 ml-auto"
                    >
                      Simpangan Baku (Menit) <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-3.5 px-4 text-right">Rata-rata (Detik)</th>
                  <th className="py-3.5 px-4 text-center">Replikasi (n)</th>
                  <th className="py-3.5 px-4 text-center">Rincian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBenchmark.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Tidak ada metode yang cocok dengan kata kunci pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredBenchmark.map((row) => {
                    const isRank1 = row.rank_within_baggage === 1;
                    const isGA = row.method === "GA-Zone-WMA";
                    const isExhaustive = row.method === "Exhaustive-Zone-WMA";

                    return (
                      <tr
                        key={`${row.baggage_percent}-${row.method}`}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isRank1 ? "bg-emerald-50/30 font-medium" : ""
                        }`}
                      >
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold tabular-nums ${
                              isRank1
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {Math.round(row.rank_within_baggage)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900">
                              {row.method}
                            </span>
                            {isRank1 && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                                Tercepat
                              </span>
                            )}
                            {isGA && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-[#086288] border border-sky-200 whitespace-nowrap">
                                GA Usulan
                              </span>
                            )}
                            {isExhaustive && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-200 whitespace-nowrap">
                                Optimum Eksak
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md tabular-nums">
                            {row.baggage_percent}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono tabular-nums">
                          {row.mean_minutes.toFixed(3)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500 tabular-nums">
                          ±{row.std_minutes.toFixed(3)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600 tabular-nums">
                          {(row.mean_minutes * 60).toFixed(1)} dtk
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-500 tabular-nums">
                          {row.n}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => openMethodDetail(row.method)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#086288]"
                          >
                            Lihat <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View 2: Paired GA Comparison Table */}
      {activeTab === "paired" && (
        <div className="flex flex-col gap-6">
          {/* Overview Callout */}
          <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-xs text-slate-700 flex items-start gap-3 leading-relaxed">
            <Info className="w-5 h-5 text-[#086288] shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="font-bold text-slate-900">
                Panduan Membaca Uji Berpasangan (GA-Zone-WMA dikurangi Metode Pembanding)
              </span>
              <p>
                <strong>Selisih Negatif (Hijau):</strong> GA-Zone-WMA selesai lebih cepat daripada metode pembanding.
                Contoh: GA lebih cepat ~430–476 detik dibanding <em>Random</em> dan ~134–156 detik dibanding <em>Steffen</em>.<br />
                <strong>Selisih Positif (Merah):</strong> Metode pembanding selesai lebih cepat daripada GA-Zone-WMA.
                Contoh: <em>Back-to-Front-WILMA</em> lebih cepat ~20–22 detik daripada GA.<br />
                <strong>Selisih 0,000 detik (Abu-abu):</strong> GA-Zone-WMA dibanding <em>Exhaustive-Zone-WMA</em> bernilai tepat 0 karena GA menemukan konfigurasi pembagian zona terbaik (batas zona: baris 5 dan 18; urutan boarding: Zona 3 ke Zona 2 ke Zona 1) yang identik dengan solusi optimum eksak.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-semibold text-xs">
                    <th className="py-3.5 px-4">Bagasi</th>
                    <th className="py-3.5 px-4">Perbandingan (GA dikurangi Metode)</th>
                    <th className="py-3.5 px-4 text-right">Rerata Selisih (Detik)</th>
                    <th className="py-3.5 px-4 text-right">Median Selisih (Detik)</th>
                    <th className="py-3.5 px-4 text-center">Rentang 95% CI (Detik)</th>
                    <th className="py-3.5 px-4 text-right">Kemenangan Replikasi GA</th>
                    <th className="py-3.5 px-4 text-center">Pasangan (n)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPaired.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Tidak ada data berpasangan yang cocok dengan filter pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredPaired.map((row, idx) => {
                      const isFaster = row.mean_difference_seconds < -1e-6;
                      const isSlower = row.mean_difference_seconds > 1e-6;

                      return (
                        <tr
                          key={idx}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="py-3 px-4 font-semibold text-slate-800 tabular-nums">
                            {row.baggage_percent}%
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {row.comparison}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                            <span
                              className={`inline-flex items-center gap-1 ${
                                isFaster
                                  ? "text-emerald-700"
                                  : isSlower
                                  ? "text-rose-700"
                                  : "text-slate-600"
                              }`}
                            >
                              {isFaster && <TrendingDown className="w-3.5 h-3.5" />}
                              {isSlower && <TrendingUp className="w-3.5 h-3.5" />}
                              {row.mean_difference_seconds.toFixed(3)} dtk
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600 tabular-nums">
                            {row.median_difference_seconds.toFixed(3)} dtk
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-xs text-slate-500 tabular-nums">
                            [{row.ci95_low_seconds.toFixed(1)}, {row.ci95_high_seconds.toFixed(1)}]
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs ${
                                row.fraction_GA_faster >= 0.8
                                  ? "bg-emerald-100 text-emerald-800"
                                  : row.fraction_GA_faster === 0
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {Math.round(row.fraction_GA_faster * row.n_pairs)}/{row.n_pairs} ({(row.fraction_GA_faster * 100).toFixed(0)}%)
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-500 tabular-nums">
                            {row.n_pairs}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Method Detail Modal */}
      {selectedMethodDetail && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMethodDetail(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-200 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-mono font-bold text-[#086288] bg-sky-50 px-2.5 py-0.5 rounded-md">
                  {selectedMethodDetail.method_id}
                </span>
                <h3 className="text-xl font-bold text-slate-900 mt-1.5">
                  {selectedMethodDetail.method_name}
                </h3>
                <span className="text-xs text-slate-500">
                  Nama alternatif: {selectedMethodDetail.aliases}
                </span>
              </div>
              <button
                onClick={() => setSelectedMethodDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-sm font-bold"
                aria-label="Tutup rincian metode"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3.5 text-xs text-slate-700">
              <div>
                <span className="text-slate-500 block text-xs font-semibold mb-0.5">
                  Kategori Strategi
                </span>
                <span className="font-semibold text-slate-900">
                  {selectedMethodDetail.method_type}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-xs font-semibold mb-1">
                  Aturan dari Literatur (PDF)
                </span>
                <p className="leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  {selectedMethodDetail.rule_from_pdf}
                </p>
              </div>

              <div>
                <span className="text-slate-500 block text-xs font-semibold mb-0.5">
                  Cakupan Pesawat dalam Literatur
                </span>
                <span className="font-medium text-slate-800 leading-relaxed">
                  {selectedMethodDetail.aircraft_scope_in_source}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-xs font-semibold mb-0.5">
                  Catatan Implementasi & Batasan
                </span>
                <span className="font-medium text-slate-800 leading-relaxed">
                  {selectedMethodDetail.implementation_notes}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-xs font-semibold mb-0.5">
                  Kode Sitasi Literatur
                </span>
                <span className="font-mono font-semibold text-[#086288]">
                  {selectedMethodDetail.source_ids}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedMethodDetail(null)}
                className="px-5 py-2 rounded-xl bg-[#086288] text-white font-semibold text-xs hover:bg-[#064e6d] transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
