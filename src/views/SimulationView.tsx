import React, { useState } from "react";
import {
  Play,
  Luggage,
  Users,
  Clock,
  AlertCircle,
  CheckCircle2,
  Plane,
  ArrowLeft,
  Cpu,
  ShieldCheck,
} from "lucide-react";
import {
  AircraftLayoutConfig,
  WEIBULL_SCALE_S,
  WEIBULL_SHAPE,
} from "../simulation/engine";

interface SimulationViewProps {
  selectedLayout: AircraftLayoutConfig;
  passengerCountInput: string;
  baggagePercentInput: string;
  computedBaggageCount: number;
  passengerError: string | null;
  baggageError: string | null;
  isEvaluating: boolean;
  evaluationProgressMessage: string;
  evaluationProgressPercent: number;
  onRunSimulationAndAzbo: () => Promise<{ ok: boolean; error?: string }>;
  onNavigateToResults: () => void;
  onBackToAircraftLayout: () => void;
}

export const SimulationView: React.FC<SimulationViewProps> = ({
  selectedLayout,
  baggagePercentInput,
  computedBaggageCount,
  passengerError,
  baggageError,
  isEvaluating,
  evaluationProgressMessage,
  evaluationProgressPercent,
  onRunSimulationAndAzbo,
  onNavigateToResults,
  onBackToAircraftLayout,
}) => {
  const [evaluationError, setEvaluationError] = useState<string | null>(null);

  const parsedBagPct =
    baggagePercentInput.trim() === "" ? NaN : Number(baggagePercentInput.trim());

  const isInputValid =
    !passengerError &&
    !baggageError &&
    !Number.isNaN(parsedBagPct) &&
    parsedBagPct >= 0 &&
    parsedBagPct <= 100;

  const effectivePaxCount = selectedLayout.capacity;
  const effectiveBagCount = isInputValid ? computedBaggageCount : null;
  const effectiveBagPct = isInputValid ? parsedBagPct : null;
  const withoutBagCount =
    effectiveBagCount !== null
      ? Math.max(0, effectivePaxCount - effectiveBagCount)
      : null;

  const handleExecuteEvaluation = async () => {
    setEvaluationError(null);

    if (!isInputValid) {
      setEvaluationError(
        baggageError ||
          "Persentase penumpang membawa bagasi belum valid. Silakan periksa kembali di halaman Pesawat."
      );
      return;
    }

    try {
      const result = await onRunSimulationAndAzbo();
      if (!result.ok) {
        setEvaluationError(
          result.error ||
            "Simulasi gagal dijalankan. Pastikan server simulasi Python aktif dan coba kembali."
        );
        return;
      }
      onNavigateToResults();
    } catch (err) {
      setEvaluationError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menjalankan simulasi boarding."
      );
    }
  };

  return (
    <div className="flex flex-col gap-6 p-5 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Kontainer Utama Verifikasi Skenario & Parameter Gerakan dan Waktu */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs flex flex-col gap-6">
        {/* Header Bagian */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#086288]">
              Simulasi Boarding
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
              Ringkasan Kondisi Penerbangan Sebelum Menjalankan Simulasi
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Periksa kembali pilihan pesawat, kondisi penumpang, dan persentase penumpang membawa
              bagasi sebelum menjalankan simulasi boarding.
            </p>
          </div>

          <button
            type="button"
            onClick={onBackToAircraftLayout}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs inline-flex items-center gap-2 transition-colors self-start sm:self-auto shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ubah Kondisi Penerbangan</span>
          </button>
        </div>

        {/* 3 Informasi Skenario Utama: Pilih Pesawat, Kondisi Penumpang, Penumpang Membawa Bagasi */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Informasi 1: Pilih Pesawat */}
          <div className="p-5 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex flex-col justify-between gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#086288] block">
                  Pilih Pesawat
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {selectedLayout.name}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  {selectedLayout.variant}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-sky-100/80 text-[#086288] shrink-0">
                <Plane className="w-5 h-5" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200/70 text-xs">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/60">
                <span className="text-[11px] text-slate-500 block">
                  Susunan Kursi
                </span>
                <strong className="tabular-nums text-slate-900">
                  {selectedLayout.seatConfiguration} ({selectedLayout.seatsPerRow}/baris)
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/60">
                <span className="text-[11px] text-slate-500 block">
                  Jumlah Baris
                </span>
                <strong className="tabular-nums text-slate-900">
                  {selectedLayout.nRows} Baris
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-200/70">
                <span className="text-[11px] text-[#086288] font-semibold block">
                  Kapasitas Kabin
                </span>
                <strong className="tabular-nums text-[#086288]">
                  {selectedLayout.capacity} Kursi
                </strong>
              </div>
            </div>
          </div>

          {/* Informasi 2: Kondisi Penumpang */}
          <div className="p-5 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex flex-col justify-between gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#086288] block">
                  Kondisi Penumpang
                </span>
                <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
                  {effectivePaxCount} Orang
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Seluruh kursi diasumsikan terisi penuh melalui pintu depan (1L)
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-sky-100/80 text-[#086288] shrink-0">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-200/70 text-xs">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/60">
                <span className="text-[11px] text-slate-500 block">
                  Tingkat Keterisian Kursi
                </span>
                <strong className="tabular-nums text-slate-900">
                  100% ({effectivePaxCount}/{selectedLayout.capacity})
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/60">
                <span className="text-[11px] text-slate-500 block">
                  Kursi Kosong
                </span>
                <strong className="tabular-nums text-slate-900">0 Kursi</strong>
              </div>
            </div>
          </div>

          {/* Informasi 3: Penumpang Membawa Bagasi */}
          <div className="p-5 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex flex-col justify-between gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 block">
                  Penumpang Membawa Bagasi
                </span>
                <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
                  {effectiveBagCount !== null
                    ? `${effectiveBagCount} Orang (${effectiveBagPct}%)`
                    : "Belum Valid"}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Dihitung otomatis dari persentase penumpang pembawa bagasi kabin
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-100/80 text-amber-800 shrink-0">
                <Luggage className="w-5 h-5" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-200/70 text-xs">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/60">
                <span className="text-[11px] text-slate-500 block">
                  Membawa Bagasi Kabin
                </span>
                <strong className="tabular-nums text-amber-900">
                  {effectiveBagCount !== null ? `${effectiveBagCount} Orang` : "Belum valid"}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/60">
                <span className="text-[11px] text-slate-500 block">
                  Tanpa Bagasi Kabin
                </span>
                <strong className="tabular-nums text-slate-900">
                  {withoutBagCount !== null ? `${withoutBagCount} Orang` : "Belum valid"}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Informasi 4: Parameter Gerakan dan Waktu (Kartu Kecil Rata Tengah & Bahasa Mudah Dipahami) */}
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#086288] block">
                Parameter Pergerakan Penumpang
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                Acuan Pergerakan Penumpang di Dalam Kabin
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Aturan pergerakan berikut diterapkan secara seragam saat membandingkan setiap metode
                boarding.
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-100/80 text-[#086288] shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          {/* 4 Kartu Kecil Rata Tengah (Judul di Atas, Nilai Utama di Bawah, Keterangan Jelas) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Parameter 1: Kecepatan berjalan di lorong */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col items-center justify-between text-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-slate-600">
                  Berjalan di lorong kabin
                </span>
                <strong className="text-base sm:text-lg font-bold text-[#086288] tabular-nums">
                  Antrean Berurutan
                </strong>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Penumpang berjalan satu per satu di lorong tanpa saling mendahului dan berhenti saat
                lorong di depannya sedang penuh.
              </p>
            </div>

            {/* Parameter 2: Waktu menyimpan bagasi */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col items-center justify-between text-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-slate-600">
                  Waktu menyimpan bagasi
                </span>
                <strong className="text-sm sm:text-base font-bold text-[#086288]">
                  Bervariasi Antarpenumpang
                </strong>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Selama penumpang menyimpan tas di kompartemen atas, lorong pada baris tersebut
                tertahan sementara bagi penumpang di belakangnya.
              </p>
            </div>

            {/* Parameter 3: Waktu masuk ke kursi */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col items-center justify-between text-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-slate-600">
                  Waktu masuk ke kursi
                </span>
                <strong className="text-base sm:text-lg font-bold text-[#086288] tabular-nums">
                  1,8 – 3,0 detik
                </strong>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Perkiraan waktu dasar ketika penumpang langsung duduk ke kursinya tanpa terhalang
                penumpang lain.
              </p>
            </div>

            {/* Parameter 4: Hambatan kursi terisi */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col items-center justify-between text-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-slate-600">
                  Hambatan kursi terisi
                </span>
                <strong className="text-sm sm:text-base font-bold text-[#086288] tabular-nums">
                  Bertambah jika Terhalang
                </strong>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Waktu duduk menjadi lebih lama apabila penumpang kursi tengah atau jendela harus
                melewati penumpang yang sudah duduk di dekat lorong.
              </p>
            </div>
          </div>

          {/* Detail Teknis Opsional yang Dapat Dibuka untuk Transparansi Penelitian */}
          <details className="text-xs text-slate-500 bg-white/80 rounded-xl border border-slate-200/70 px-4 py-2.5">
            <summary className="font-semibold text-slate-600 cursor-pointer select-none">
              Rincian teknis parameter model simulasi (opsional)
            </summary>
            <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 leading-relaxed">
              <div>
                • <strong>Grid lorong & langkah waktu:</strong> Jarak antarbaris 0,8 m (2 sel lorong
                @ 0,4 m per baris, kapasitas 1 penumpang/sel) dengan langkah waktu Δt = 0,25 detik.
              </div>
              <div>
                • <strong>Kecepatan jalan & waktu bagasi:</strong> Kecepatan bebas Normal Terpotong
                (rata-rata 0,8 m/dtk, simpangan 0,1 m/dtk pada (0, 0,8] m/dtk); waktu simpan bagasi
                Weibull (skala {WEIBULL_SCALE_S} detik, bentuk {WEIBULL_SHAPE}).
              </div>
              <div className="sm:col-span-2">
                • <strong>Gerakan masuk kursi:</strong> Durasi per gerakan Triangular(1,8; 2,4; 3,0)
                detik sebanyak 1 gerakan (tanpa penghalang), 5 gerakan (1 penghalang duduk), atau 9
                gerakan (2 penghalang duduk).
              </div>
            </div>
          </details>
        </div>

        {/* Panel Status Validasi Konfigurasi */}
        {isInputValid ? (
          <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold block text-sm text-emerald-950">
                  Kondisi Penerbangan Siap Disimulasikan
                </span>
                <p className="text-emerald-900/90 leading-relaxed">
                  Pesawat <strong>{selectedLayout.name}</strong> dengan{" "}
                  <strong>{effectivePaxCount} penumpang (100% kursi terisi)</strong> dan{" "}
                  <strong>
                    {effectiveBagCount} orang ({effectiveBagPct}%) membawa bagasi kabin
                  </strong>{" "}
                  siap diuji untuk menentukan metode dan urutan boarding tercepat.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-xs whitespace-nowrap self-start sm:self-center">
              Siap Dijalankan
            </span>
          </div>
        ) : (
          <div
            role="alert"
            className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block text-sm text-rose-950">
                  Input Kondisi Penerbangan Perlu Diperbaiki
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-rose-900">
                  {baggageError && <li>{baggageError}</li>}
                </ul>
              </div>
            </div>
            <button
              type="button"
              onClick={onBackToAircraftLayout}
              className="px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shrink-0 transition-colors cursor-pointer self-start sm:self-center"
            >
              Perbaiki di Menu Pesawat
            </button>
          </div>
        )}

        {/* Indikator Progres Nyata saat Backend Python Berjalan */}
        {isEvaluating && (
          <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#086288]">
              <span className="flex items-center gap-2">
                <Cpu className="w-4 h-4 animate-spin shrink-0" />
                <span>
                  {evaluationProgressMessage ||
                    "Menjalankan simulasi dan mencari urutan zona terbaik..."}
                </span>
              </span>
              <span className="font-mono font-bold">
                {Math.round(evaluationProgressPercent)}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-sky-200/70 overflow-hidden">
              <div
                className="h-full bg-[#086288] transition-all duration-300 rounded-full"
                style={{
                  width: `${Math.max(5, Math.min(100, evaluationProgressPercent))}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Pesan Error Eksekusi (Jika Backend Tidak Tersedia atau Gagal) */}
        {evaluationError && (
          <div
            role="alert"
            className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-xs text-rose-950 flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Simulasi Tidak Dapat Dijalankan:</span>
              <span>{evaluationError}</span>
            </div>
          </div>
        )}

        {/* Area Tombol Utama Jalankan Simulasi */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-[#086288] shrink-0" />
            <span>
              Setiap metode boarding diuji menggunakan kondisi penumpang dan distribusi bagasi yang
              sama persis sebelum menentukan rekomendasi di halaman Hasil.
            </span>
          </div>

          <button
            type="button"
            disabled={!isInputValid || isEvaluating}
            onClick={handleExecuteEvaluation}
            className={`w-full sm:w-auto py-3.5 px-6 rounded-xl font-bold text-xs flex items-center justify-center gap-2.5 transition-all shrink-0 ${
              isInputValid && !isEvaluating
                ? "bg-[#086288] hover:bg-[#064e6d] text-white shadow-md shadow-[#086288]/20 cursor-pointer"
                : "bg-slate-200 text-slate-500 cursor-not-allowed"
            }`}
          >
            {isEvaluating ? (
              <>
                <Cpu className="w-4 h-4 animate-spin" />
                <span>Menjalankan Simulasi...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Jalankan Simulasi</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

