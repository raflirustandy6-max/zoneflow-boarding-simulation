import React, { useState, useMemo } from "react";
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
  BOARDING_METHOD_CATALOG,
  WALK_PER_ROW_S,
  ENTRY_GAP_S,
  SIT_TIME_S,
  WEIBULL_SCALE_S,
  WEIBULL_SHAPE,
  MOVES_ONE_BLOCKER,
  MOVES_TWO_BLOCKERS,
  MOVEMENT_TICK_S,
} from "../simulation/engine";

interface SimulationViewProps {
  selectedLayout: AircraftLayoutConfig;
  passengerCountInput: string;
  baggageCountInput: string;
  passengerError: string | null;
  baggageError: string | null;
  onRunSimulationAndAzbo: () => { ok: boolean; error?: string };
  onNavigateToResults: () => void;
  onBackToAircraftLayout: () => void;
}

export const SimulationView: React.FC<SimulationViewProps> = ({
  selectedLayout,
  passengerCountInput,
  baggageCountInput,
  passengerError,
  baggageError,
  onRunSimulationAndAzbo,
  onNavigateToResults,
  onBackToAircraftLayout,
}) => {
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);

  const parsedPax =
    passengerCountInput.trim() === "" ? NaN : Number(passengerCountInput.trim());
  const parsedBag =
    baggageCountInput.trim() === "" ? NaN : Number(baggageCountInput.trim());

  const isInputValid =
    !passengerError &&
    !baggageError &&
    Number.isInteger(parsedPax) &&
    parsedPax > 0 &&
    parsedPax <= selectedLayout.capacity &&
    Number.isInteger(parsedBag) &&
    parsedBag >= 0 &&
    parsedBag <= parsedPax;

  const effectivePaxCount = isInputValid ? parsedPax : null;
  const effectiveBagCount = isInputValid ? parsedBag : null;
  const withoutBagCount =
    effectivePaxCount !== null && effectiveBagCount !== null
      ? Math.max(0, effectivePaxCount - effectiveBagCount)
      : null;
  const emptySeatCount =
    effectivePaxCount !== null
      ? Math.max(0, selectedLayout.capacity - effectivePaxCount)
      : null;
  const occupancyRatePct =
    effectivePaxCount !== null
      ? ((effectivePaxCount / selectedLayout.capacity) * 100).toFixed(1)
      : null;

  const supportedMethodsCount = useMemo(
    () => BOARDING_METHOD_CATALOG.filter((m) => m.supportedInSimulator).length,
    []
  );

  const walkPerRowLabel = WALK_PER_ROW_S.toString().replace(".", ",");
  const sitTimeLabel = SIT_TIME_S.toString().replace(".", ",");
  const oneBlockerDelayLabel = (MOVES_ONE_BLOCKER * MOVEMENT_TICK_S)
    .toFixed(1)
    .replace(".", ",");
  const twoBlockersDelayLabel = (MOVES_TWO_BLOCKERS * MOVEMENT_TICK_S)
    .toFixed(1)
    .replace(".", ",");

  const handleExecuteEvaluation = () => {
    setEvaluationError(null);

    if (!isInputValid) {
      setEvaluationError(
        passengerError ||
          baggageError ||
          "Input skenario belum valid. Silakan periksa kembali jumlah penumpang dan jumlah penumpang pembawa bagasi di halaman Pesawat."
      );
      return;
    }

    setIsEvaluating(true);
    try {
      const result = onRunSimulationAndAzbo();
      if (!result.ok) {
        setEvaluationError(
          result.error ||
            "Evaluasi gagal dijalankan. Silakan periksa input skenario Anda di halaman Pesawat."
        );
        setIsEvaluating(false);
        return;
      }
      setIsEvaluating(false);
      onNavigateToResults();
    } catch (err) {
      setEvaluationError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat mengevaluasi skenario."
      );
      setIsEvaluating(false);
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
              Ringkasan Skenario & Parameter Simulasi
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
              Verifikasi Skenario Sebelum Menjalankan Evaluasi
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Periksa kembali konfigurasi pesawat, jumlah penumpang, dan jumlah penumpang pembawa
              bagasi kabin yang telah Anda tetapkan sebelum menjalankan evaluasi metode boarding.
            </p>
          </div>

          <button
            type="button"
            onClick={onBackToAircraftLayout}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs inline-flex items-center gap-2 transition-colors self-start sm:self-auto shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ubah Input Skenario</span>
          </button>
        </div>

        {/* 3 Informasi Skenario Utama: Layout Pesawat, Jumlah Penumpang, Bagasi Kabin */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Informasi 1: Layout Pesawat */}
          <div className="p-5 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex flex-col justify-between gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#086288] block">
                  Layout Pesawat
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

          {/* Informasi 2: Jumlah Penumpang */}
          <div className="p-5 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex flex-col justify-between gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#086288] block">
                  Jumlah Penumpang
                </span>
                <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
                  {effectivePaxCount !== null
                    ? `${effectivePaxCount} Orang`
                    : passengerCountInput.trim() === ""
                    ? "Belum Diisi"
                    : `${passengerCountInput} (Tidak Valid)`}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Penumpang yang memasuki kabin melalui pintu depan (1L)
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
                  {occupancyRatePct !== null
                    ? `${occupancyRatePct}% (${effectivePaxCount}/${selectedLayout.capacity})`
                    : "Belum valid"}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/60">
                <span className="text-[11px] text-slate-500 block">
                  Kursi Kosong
                </span>
                <strong className="tabular-nums text-slate-900">
                  {emptySeatCount !== null ? `${emptySeatCount} Kursi` : "Belum valid"}
                </strong>
              </div>
            </div>
          </div>

          {/* Informasi 3: Bagasi Kabin */}
          <div className="p-5 rounded-2xl bg-slate-50/90 border border-slate-200/80 flex flex-col justify-between gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 block">
                  Bagasi Kabin
                </span>
                <div className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
                  {effectiveBagCount !== null
                    ? `${effectiveBagCount} Orang`
                    : baggageCountInput.trim() === ""
                    ? "Belum Diisi"
                    : `${baggageCountInput} (Tidak Valid)`}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Jumlah penumpang yang menyimpan bagasi di kompartemen atas
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
                Parameter Gerakan dan Waktu
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                Acuan Waktu Pergerakan Penumpang di Dalam Kabin
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Parameter berikut diterapkan secara seragam saat menguji seluruh {supportedMethodsCount}{" "}
                metode boarding dan pembagian zona.
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-100/80 text-[#086288] shrink-0">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          {/* 4 Kartu Kecil Rata Tengah (Judul di Atas, Nilai Utama di Bawah, Keterangan Jelas) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Parameter 1: Waktu berjalan per baris */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col items-center justify-between text-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-slate-600">
                  Waktu berjalan per baris
                </span>
                <strong className="text-lg sm:text-xl font-bold text-[#086288] tabular-nums">
                  {walkPerRowLabel} detik / baris
                </strong>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Menunjukkan perkiraan waktu yang dibutuhkan penumpang untuk bergerak melewati satu
                baris kabin.
              </p>
            </div>

            {/* Parameter 2: Waktu menyimpan bagasi */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col items-center justify-between text-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-slate-600">
                  Waktu menyimpan bagasi
                </span>
                <strong className="text-sm sm:text-base font-bold text-[#086288]">
                  Waktu menyimpan bagasi bervariasi antarpenumpang
                </strong>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Menunjukkan waktu yang dibutuhkan penumpang untuk menyimpan bagasi sebelum menuju
                kursinya. Simulator menggunakan variasi waktu agar proses tidak selalu sama.
              </p>
            </div>

            {/* Parameter 3: Waktu duduk */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col items-center justify-between text-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-slate-600">
                  Waktu duduk
                </span>
                <strong className="text-lg sm:text-xl font-bold text-[#086288] tabular-nums">
                  {sitTimeLabel} detik
                </strong>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Menunjukkan perkiraan waktu yang dibutuhkan penumpang untuk duduk di kursinya.
              </p>
            </div>

            {/* Parameter 4: Waktu tambahan akibat hambatan kursi */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-col items-center justify-between text-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-slate-600">
                  Waktu tambahan akibat hambatan kursi
                </span>
                <strong className="text-sm sm:text-base font-bold text-[#086288] tabular-nums">
                  +{oneBlockerDelayLabel} dtk (1 kursi) / +{twoBlockersDelayLabel} dtk (2 kursi)
                </strong>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Menunjukkan waktu tambahan pada simulator ketika penumpang perlu menunggu karena
                akses menuju kursinya terhalang penumpang lain.
              </p>
            </div>
          </div>

          {/* Detail Teknis Opsional yang Dapat Dibuka untuk Transparansi Audit Model */}
          <details className="text-xs text-slate-500 bg-white/80 rounded-xl border border-slate-200/70 px-4 py-2.5">
            <summary className="font-semibold text-slate-600 cursor-pointer select-none">
              Detail teknis parameter model simulator (untuk keperluan audit teknis)
            </summary>
            <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 leading-relaxed">
              <div>
                • <strong>Jeda masuk antrean pintu depan:</strong> {ENTRY_GAP_S} detik antarpenumpang
                (langkah pergerakan lorong {MOVEMENT_TICK_S} detik).
              </div>
              <div>
                • <strong>Distribusi waktu simpan bagasi:</strong> Distribusi Weibull dengan skala{" "}
                {WEIBULL_SCALE_S} detik dan parameter bentuk {WEIBULL_SHAPE}.
              </div>
              <div className="sm:col-span-2">
                • <strong>Perhitungan waktu tambahan hambatan kursi pada simulator:</strong>{" "}
                {MOVES_ONE_BLOCKER} langkah ({oneBlockerDelayLabel} detik) bila terhalang 1 kursi, dan{" "}
                {MOVES_TWO_BLOCKERS} langkah ({twoBlockersDelayLabel} detik) bila terhalang 2 kursi
                (nilai parameter model simulasi, bukan nilai pasti di lapangan).
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
                  Status Validasi: Konfigurasi Skenario Siap Dievaluasi
                </span>
                <p className="text-emerald-900/90 leading-relaxed">
                  Skenario <strong>{selectedLayout.name}</strong> dengan{" "}
                  <strong>{effectivePaxCount} penumpang</strong> dan{" "}
                  <strong>{effectiveBagCount} orang membawa bagasi kabin</strong> telah tervalidasi.
                  Sistem siap mengevaluasi seluruh {supportedMethodsCount} metode boarding yang
                  didukung beserta optimasi zona AZBO.
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
                  Status Validasi: Input Skenario Perlu Diperbaiki
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-rose-900">
                  {passengerError && <li>{passengerError}</li>}
                  {baggageError && <li>{baggageError}</li>}
                  {!passengerError && !baggageError && (
                    <li>
                      Masukkan jumlah penumpang minimal 1 orang dan jumlah penumpang berbagasi
                      yang valid di halaman Pesawat.
                    </li>
                  )}
                </ul>
              </div>
            </div>
            <button
              type="button"
              onClick={onBackToAircraftLayout}
              className="px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shrink-0 transition-colors cursor-pointer self-start sm:self-center"
            >
              Perbaiki Input Skenario
            </button>
          </div>
        )}

        {/* Pesan Error Eksekusi (Jika Evaluasi Gagal) */}
        {evaluationError && (
          <div
            role="alert"
            className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-xs text-rose-950 flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Evaluasi Gagal Dijalankan:</span>
              <span>{evaluationError}</span>
            </div>
          </div>
        )}

        {/* Area Tombol Utama Pelaksanaan Evaluasi & Optimasi AZBO */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-[#086288] shrink-0" />
            <span>
              Seluruh kandidat metode diuji pada penempatan kursi dan distribusi bagasi yang sama
              persis sebelum menentukan rekomendasi di halaman Hasil.
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
                <span>Menjalankan Evaluasi & Optimasi AZBO...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Jalankan Evaluasi & Optimasi AZBO</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
