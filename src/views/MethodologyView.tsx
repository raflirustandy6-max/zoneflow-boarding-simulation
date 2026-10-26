import React, { useState, useMemo } from "react";
import {
  Search,
  Database,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import {
  INVENTARIS_METODE,
  HASIL_STUDI_LITERATUR,
  PARAMETER_SIMULASI,
  SUMBER_LITERATUR,
  KAMUS_KOLOM,
  CATATAN_BATASAN,
} from "../data/benchmarkData";

type MethodologyTab = "metode" | "parameter" | "temuan" | "pustaka" | "kamus" | "batasan";

export const MethodologyView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MethodologyTab>("metode");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const q = searchQuery.toLowerCase();

  // Filter lists based on search query
  const filteredMetode = useMemo(() => {
    return INVENTARIS_METODE.filter(
      (m) =>
        m.method_name.toLowerCase().includes(q) ||
        m.aliases.toLowerCase().includes(q) ||
        m.rule_from_pdf.toLowerCase().includes(q) ||
        m.method_type.toLowerCase().includes(q)
    );
  }, [q]);

  const filteredParameter = useMemo(() => {
    return PARAMETER_SIMULASI.filter(
      (p) =>
        p.parameter_name.toLowerCase().includes(q) ||
        p.source_context.toLowerCase().includes(q) ||
        p.implementation_note.toLowerCase().includes(q) ||
        p.parameter_id.toLowerCase().includes(q)
    );
  }, [q]);

  const filteredTemuan = useMemo(() => {
    return HASIL_STUDI_LITERATUR.filter(
      (t) =>
        t.method.toLowerCase().includes(q) ||
        t.finding.toLowerCase().includes(q) ||
        t.caveat.toLowerCase().includes(q) ||
        t.aircraft_scope.toLowerCase().includes(q)
    );
  }, [q]);

  const filteredPustaka = useMemo(() => {
    return SUMBER_LITERATUR.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.authors.toLowerCase().includes(q) ||
        s.publication.toLowerCase().includes(q) ||
        s.source_id.toLowerCase().includes(q)
    );
  }, [q]);

  const filteredKamus = useMemo(() => {
    return KAMUS_KOLOM.filter(
      (k) =>
        k.column_name.toLowerCase().includes(q) ||
        k.meaning.toLowerCase().includes(q) ||
        k.file_name.toLowerCase().includes(q)
    );
  }, [q]);

  return (
    <div className="flex flex-col gap-6 p-5 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Metodologi & Database Literatur
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Transparansi penuh data sumber: inventaris metode, parameter kabin, temuan studi, dan sitasi rujukan.
              </p>
            </div>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-full md:w-80 shadow-2xs focus-within:ring-2 focus-within:ring-[#086288]">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Cari kata kunci di database..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none font-medium"
          />
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex items-center overflow-x-auto pb-1 gap-2 border-b border-slate-200">
        {[
          { id: "metode", label: "Inventaris Metode", count: filteredMetode.length },
          { id: "parameter", label: "Parameter Simulasi", count: filteredParameter.length },
          { id: "temuan", label: "Temuan Studi", count: filteredTemuan.length },
          { id: "pustaka", label: "Sumber Pustaka", count: filteredPustaka.length },
          { id: "kamus", label: "Kamus Kolom", count: filteredKamus.length },
          { id: "batasan", label: "Asumsi & Batasan", count: 5 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as MethodologyTab)}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#086288] ${
              activeTab === tab.id
                ? "bg-[#086288] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            {tab.label}
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-mono tabular-nums ${
                activeTab === tab.id
                  ? "bg-white/20 text-white"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab 1: Inventaris Metode */}
      {activeTab === "metode" && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold text-xs">
                  <th className="py-3.5 px-4 w-16">Kode</th>
                  <th className="py-3.5 px-4 w-48">Nama Metode</th>
                  <th className="py-3.5 px-4 w-44">Kategori</th>
                  <th className="py-3.5 px-4">Aturan dari Literatur</th>
                  <th className="py-3.5 px-4 w-64">Catatan Implementasi</th>
                  <th className="py-3.5 px-4 w-32 text-center">Status Bukti</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMetode.map((m) => (
                  <tr key={m.method_id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#086288] tabular-nums">
                      {m.method_id}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{m.method_name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{m.aliases}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {m.method_type}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 leading-relaxed">
                      {m.rule_from_pdf}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs leading-relaxed">
                      {m.implementation_notes}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {m.evidence_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Parameter Simulasi */}
      {activeTab === "parameter" && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold text-xs">
                  <th className="py-3.5 px-4 w-16">Kode</th>
                  <th className="py-3.5 px-4 w-64">Nama Parameter</th>
                  <th className="py-3.5 px-4 w-44">Nilai / Rentang</th>
                  <th className="py-3.5 px-4 w-32">Satuan</th>
                  <th className="py-3.5 px-4">Catatan Implementasi</th>
                  <th className="py-3.5 px-4 w-24 text-center">Sitasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredParameter.map((p) => (
                  <tr key={p.parameter_id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#086288] tabular-nums">
                      {p.parameter_id}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {p.parameter_name}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-800 tabular-nums">
                      {p.value_or_levels}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{p.unit}</td>
                    <td className="py-3.5 px-4 text-slate-600 leading-relaxed">
                      {p.implementation_note}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-xs font-semibold text-[#086288]">
                      {p.source_id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Temuan Studi Literatur */}
      {activeTab === "temuan" && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold text-xs">
                  <th className="py-3.5 px-4 w-16">Kode</th>
                  <th className="py-3.5 px-4 w-36">Tipe Pesawat</th>
                  <th className="py-3.5 px-4 w-40">Metode</th>
                  <th className="py-3.5 px-4 w-48">Kondisi Eksperimen</th>
                  <th className="py-3.5 px-4">Temuan yang Dilaporkan</th>
                  <th className="py-3.5 px-4 w-60">Catatan Batasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTemuan.map((t) => (
                  <tr key={t.result_id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#086288] tabular-nums">
                      {t.result_id}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {t.aircraft_scope}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{t.method}</td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs">{t.condition}</td>
                    <td className="py-3.5 px-4 text-slate-800 leading-relaxed">
                      {t.finding}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-xs italic leading-relaxed">
                      {t.caveat}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Sumber Pustaka (SRC01 - SRC16) */}
      {activeTab === "pustaka" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPustaka.map((src) => (
            <div
              key={src.source_id}
              className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col justify-between gap-3 hover:border-slate-300 transition-colors"
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#086288] bg-sky-50 px-2.5 py-0.5 rounded-md">
                    {src.source_id}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 font-mono tabular-nums">
                    {src.year}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 leading-snug">
                  {src.title}
                </h4>
                <p className="text-xs text-slate-600 font-medium">
                  {src.authors}
                </p>
                <div className="text-xs text-slate-500 italic">
                  {src.publication}
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-600 leading-snug">{src.source_use}</span>
                {src.doi_or_url && (
                  <a
                    href={src.doi_or_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#086288] font-semibold hover:underline inline-flex items-center gap-1 shrink-0"
                  >
                    Tautan DOI <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 5: Kamus Kolom */}
      {activeTab === "kamus" && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold text-xs">
                  <th className="py-3.5 px-4 w-64">Nama Berkas CSV</th>
                  <th className="py-3.5 px-4 w-52">Nama Kolom</th>
                  <th className="py-3.5 px-4">Arti & Definisi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredKamus.map((k, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                      {k.file_name}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                      {k.column_name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 leading-relaxed">{k.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Asumsi & Batasan Ilmiah */}
      {activeTab === "batasan" && (
        <div className="flex flex-col gap-6">
          <div className="p-6 rounded-3xl bg-amber-50/80 border border-amber-200/90 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-amber-900">
              <AlertCircle className="w-5 h-5 text-amber-700" />
              <h3 className="font-bold text-base">
                Catatan Sumber Data dan Batasan Penelitian
              </h3>
            </div>
            <p className="text-xs text-amber-900/90 leading-relaxed">
              ZoneFlow merupakan aplikasi simulasi dan analitik penelitian boarding pesawat. Data dan model
              memiliki batasan metodologi yang disajikan secara transparan:
            </p>
            <ul className="flex flex-col gap-2.5 text-xs text-amber-950 font-medium leading-relaxed">
              {CATATAN_BATASAN.keterbatasanKunci.map((caveat, index) => (
                <li key={index} className="flex items-start gap-2.5">
                  <span className="font-bold font-mono text-amber-800 shrink-0 tabular-nums">
                    [{index + 1}]
                  </span>
                  <span>{caveat}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col gap-4 text-xs text-slate-600">
            <h4 className="text-sm font-bold text-slate-900">
              Daftar Asumsi Implementasi Simulator v3
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-1.5 leading-relaxed">
                <span className="font-bold text-slate-900">Pemblokiran Lorong (Aisle Blocking)</span>
                <p>
                  Saat penumpang menyimpan bagasi atau masuk ke baris kursi, segmen lorong pada baris tujuan dianggap
                  tertutup hingga proses selesai. Asumsi konservatif ini memastikan urutan antrean di lorong
                  tercatat secara deterministik.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-1.5 leading-relaxed">
                <span className="font-bold text-slate-900">Interferensi Kursi (Seat Interference)</span>
                <p>
                  0 penghalang = 0 detik; 1 penghalang (kursi lorong atau tengah sudah terisi saat penumpang jendela/tengah masuk)
                  = 5 langkah (12,0 detik); 2 penghalang = 9 langkah (21,6 detik). Mengacu pada model Schultz (2018)
                  dan Possamai Viertel (2025).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
