import React from "react";
import { ShieldCheck, AlertCircle, X, ExternalLink, Database } from "lucide-react";
import { CATATAN_BATASAN } from "../data/benchmarkData";

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-slate-200 flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-50 text-[#086288]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                Integritas Sumber Data & Batasan ZoneFlow
              </h3>
              <p className="text-xs text-slate-500">
                Pedoman kepatuhan saintifik & status eksekusi simulasi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold text-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 text-xs text-slate-600 leading-relaxed">
          <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-100 flex flex-col gap-1.5">
            <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Database className="w-4 h-4 text-[#086288]" />
              1. Asal Usul Angka Benchmark
            </span>
            <p>
              Seluruh metrik waktu rata-rata (mean), standar deviasi (std), peringkat (rank), dan
              selisih uji berpasangan diambil langsung dari file output tersimpan:
              <br />
              <code className="text-[#086288] font-bold font-mono text-[11px]">
                ringkasan_benchmark_dari_output_notebook.csv
              </code>
              <br />
              <code className="text-[#086288] font-bold font-mono text-[11px]">
                perbandingan_berpasangan_GA_dari_output_notebook.csv
              </code>
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col gap-1.5 text-amber-950">
            <span className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              2. Batasan Ilmiah Kunci
            </span>
            <ul className="flex flex-col gap-1.5 list-disc list-inside mt-1 font-medium text-xs">
              {CATATAN_BATASAN.keterbatasanKunci.map((caveat, i) => (
                <li key={i}>{caveat}</li>
              ))}
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-1.5">
            <span className="font-bold text-slate-900 text-sm">
              3. Status Eksekusi Python
            </span>
            <p>
              Di lingkungan browser, visualizer interaktif dijalankan oleh mesin simulasi berbasis
              TypeScript yang mereplikasi logika langkah per langkah Python v3. Eksekusi Python
              skala besar di masa mendatang dapat dihubungkan melalui backend REST API.
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#086288] text-white font-bold text-xs hover:bg-[#064e6d] transition-colors"
          >
            Saya Memahami
          </button>
        </div>
      </div>
    </div>
  );
};
