import React from "react";
import { ShieldCheck, AlertCircle, X, Database, Info } from "lucide-react";
import { CATATAN_BATASAN } from "../data/benchmarkData";
import { BOARDING_METHOD_CATALOG } from "../simulation/engine";

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const unsupportedMethods = BOARDING_METHOD_CATALOG.filter(
    (m) => !m.supportedInSimulator
  );

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
              <h3 className="text-lg font-bold text-slate-900">
                Informasi Model & Batasan Simulasi ZoneFlow
              </h3>
              <p className="text-xs text-slate-500">
                Ringkasan cakupan model simulasi, asumsi operasional, dan integritas sumber data
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold text-sm cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 text-xs text-slate-600 leading-relaxed">
          <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-100 flex flex-col gap-1.5">
            <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Database className="w-4 h-4 text-[#086288]" />
              1. Dasar Evaluasi & Optimasi Skenario
            </span>
            <p>
              Hasil merupakan estimasi berdasarkan model simulasi dan parameter yang digunakan. Hasil
              aktual dapat berbeda sesuai kondisi operasional pesawat. Seluruh metode yang didukung
              dievaluasi menggunakan penempatan kursi penumpang dan waktu simpan bagasi yang sama
              persis pada skenario yang dipilih.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col gap-1.5 text-amber-950">
            <span className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              2. Batasan Model Simulasi
            </span>
            <ul className="flex flex-col gap-1.5 list-disc list-inside mt-1 font-medium text-xs">
              {CATATAN_BATASAN.keterbatasanKunci.map((caveat, i) => (
                <li key={i}>{caveat}</li>
              ))}
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
            <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Info className="w-4 h-4 text-[#086288]" />
              3. Metode Literatur di Luar Cakupan Simulator Lorong Tunggal
            </span>
            <p>
              Metode literatur yang membutuhkan geometri kabin dua lorong atau atribut penumpang
              tambahan di luar model simulator saat ini tidak diberikan angka simulasi buatan:
            </p>
            <div className="flex flex-col gap-2 mt-1">
              {unsupportedMethods.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col gap-0.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">{m.shortLabel}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                      Belum Didukung ({m.sourceCitation})
                    </span>
                  </div>
                  <p className="text-slate-600">{m.unsupportedReason}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#086288] text-white font-bold text-xs hover:bg-[#064e6d] transition-colors cursor-pointer"
          >
            Tutup Informasi Model
          </button>
        </div>
      </div>
    </div>
  );
};
