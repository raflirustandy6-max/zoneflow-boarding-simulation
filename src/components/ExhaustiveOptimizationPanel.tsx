import React, { useState, useEffect, useRef } from "react";
import {
  Cpu,
  Play,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Clock,
  Layers,
  Award,
  BarChart3,
  XCircle,
  RefreshCw,
  Search,
  ExternalLink,
} from "lucide-react";
import {
  startExhaustiveSearch,
  getExhaustiveJobStatus,
  cancelExhaustiveJob,
  getExhaustiveCandidatesCatalog,
  ExhaustiveJobStatus,
  ExhaustiveCandidatesCatalog,
  CandidateConfig,
} from "../services/apiClient";
import { BEST_GA_CHROMOSOME } from "../simulation/engine";

interface ExhaustiveOptimizationPanelProps {
  backendOnline: boolean;
  onRecheckBackend: () => void;
}

export const ExhaustiveOptimizationPanel: React.FC<ExhaustiveOptimizationPanelProps> = ({
  backendOnline,
  onRecheckBackend,
}) => {
  const [baseSeed, setBaseSeed] = useState<number>(20261021);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<ExhaustiveJobStatus | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<ExhaustiveCandidatesCatalog | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(false);
  const [showCatalogPreview, setShowCatalogPreview] = useState<boolean>(false);

  const pollIntervalRef = useRef<any>(null);

  const handleLoadCatalog = async (togglePreview: boolean = false) => {
    if (!backendOnline) return;
    setIsLoadingCatalog(true);
    try {
      const data = await getExhaustiveCandidatesCatalog();
      setCatalog(data);
      if (togglePreview) {
        setShowCatalogPreview((prev) => !prev);
      }
    } catch (err: any) {
      if (togglePreview) {
        setError(err.message || "Gagal memuat katalog 546 kandidat dari backend Python.");
      }
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  useEffect(() => {
    if (backendOnline && !catalog) {
      handleLoadCatalog(false);
    }
  }, [backendOnline]);

  // Bersihkan interval saat unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const startPolling = (id: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const status = await getExhaustiveJobStatus(id);
        setJobStatus(status);

        if (status.status === "completed" || status.status === "cancelled" || status.status === "failed") {
          setIsRunning(false);
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          if (status.status === "failed") {
            setError(status.error_message || "Pekerjaan optimasi gagal di server backend Python.");
          }
        }
      } catch (err: any) {
        // Jangan hentikan polling pada transient error
        console.warn("Gagal polling status optimasi:", err);
      }
    }, 1200);
  };

  const handleStartSearch = async () => {
    if (!backendOnline) {
      setError("Layanan Python Backend Offline. Exhaustive Search 546 kandidat memerlukan Python Backend Engine.");
      return;
    }

    setIsRunning(true);
    setError(null);
    setJobStatus(null);

    try {
      const response = await startExhaustiveSearch(baseSeed);
      setJobId(response.job_id);
      setJobStatus(response);
      startPolling(response.job_id);
    } catch (err: any) {
      setIsRunning(false);
      setError(err.message || "Gagal memulai pekerjaan optimasi di backend Python.");
    }
  };

  const handleCancel = async () => {
    if (!jobId) return;
    try {
      await cancelExhaustiveJob(jobId);
      setIsRunning(false);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setJobStatus((prev) => (prev ? { ...prev, status: "cancelled" } : null));
    } catch (err: any) {
      console.error("Gagal membatalkan pekerjaan:", err);
    }
  };

  const formatOrderName = (order: number[]) => {
    return order.map((z) => `Zona ${z}`).join(" → ");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Banner Identitas & Scope */}
      <div className="bg-gradient-to-r from-amber-900/10 via-slate-900/5 to-slate-900/10 rounded-3xl p-6 border border-amber-500/20 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-600/10 border border-amber-500/30 text-amber-700 flex items-center justify-center shrink-0">
            <Cpu className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                Evaluasi Menyeluruh 546 Konfigurasi Zona
              </span>
              <span className="text-xs font-semibold text-slate-500">
                91 Pembagian Baris × 6 Urutan Boarding = 546 Kandidat
              </span>
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              Pencarian Menyeluruh Batas & Urutan Zona (Exhaustive-Zone-WMA)
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
              Mengevaluasi seluruh kombinasi pembagian zona yang sah (5–15 baris per zona) dan 6 urutan boarding kabin 30 baris. Setiap konfigurasi diuji pada 15 skenario uji (5 replikasi × 3 tingkat bagasi 50%, 60%, dan 70%) untuk menemukan konfigurasi dengan waktu boarding terendah.
            </p>
          </div>
        </div>

        {/* Backend Online Status Pill */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {backendOnline ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Layanan Server Python Terhubung
            </div>
          ) : (
            <button
              onClick={onRecheckBackend}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-[#086288] text-xs font-bold hover:bg-sky-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Hubungkan Server Python
            </button>
          )}
        </div>
      </div>

      {/* Stored Research Result Summary for Public Demo Mode */}
      {!jobStatus && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Hasil Optimasi Penelitian Tersimpan (546 Konfigurasi Zona)
                </h4>
                <p className="text-xs text-slate-500">
                  Konfigurasi dengan waktu boarding terendah hasil evaluasi menyeluruh 546 kombinasi pembagian zona
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 w-fit">
              Data Benchmark Tersimpan
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-0.5">
              <span className="text-slate-500 font-medium">Batas Zona Terbaik</span>
              <span className="text-base font-bold text-slate-900 tabular-nums">
                Baris 5 dan 18
              </span>
              <span className="text-[11px] text-slate-500">Zona 1: 1–5 • Zona 2: 6–18 • Zona 3: 19–30</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-0.5">
              <span className="text-slate-500 font-medium">Pembagian Zona</span>
              <span className="text-base font-bold text-slate-900 tabular-nums">
                5, 13, dan 12 baris
              </span>
              <span className="text-[11px] text-slate-500">Total 30 baris kabin (180 kursi)</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-0.5">
              <span className="text-slate-500 font-medium">Urutan Boarding</span>
              <span className="text-base font-bold text-[#086288] tabular-nums">
                Zona 3 ke Zona 2 ke Zona 1
              </span>
              <span className="text-[11px] text-slate-500">Belakang ke depan (prioritas kursi jendela)</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-0.5">
              <span className="text-slate-500 font-medium">Rata-rata Waktu Boarding</span>
              <span className="text-base font-bold text-emerald-700 tabular-nums">
                291,069 dtk (4,851 mnt)
              </span>
              <span className="text-[11px] text-slate-500">Rata-rata 15 skenario uji</span>
            </div>
          </div>
        </div>
      )}

      {/* Notice Tag Pemisah Benchmark */}
      <div className="p-4 rounded-2xl bg-sky-50/80 border border-sky-100 text-xs text-sky-900 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-[#086288] shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Informasi Layanan Komputasi:</strong> Evaluasi ulang seluruh 546 kombinasi secara langsung dijalankan melalui{" "}
          <span className="font-semibold bg-sky-100/70 text-[#086288] px-1.5 py-0.5 rounded">
            Layanan Komputasi Tambahan (Server Python)
          </span>
          . Data Benchmark Tersimpan (100 replikasi) di mana <strong>Back-to-Front-WILMA</strong> menempati peringkat #1 tidak akan berubah.
        </div>
      </div>

      {/* Kontrol Parameter & Tombol Eksekusi */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h4 className="text-base font-bold text-slate-900">Pengaturan Evaluasi 546 Konfigurasi Zona</h4>
            <p className="text-xs text-slate-500">
              Menguji seluruh 546 konfigurasi pembagian zona menggunakan 15 skenario pengujian.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">Angka Awal Pengacakan:</label>
              <input
                type="number"
                disabled={isRunning}
                value={baseSeed}
                onChange={(e) => setBaseSeed(parseInt(e.target.value) || 0)}
                className="w-32 px-3 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#086288] disabled:opacity-50"
              />
              <button
                disabled={isRunning}
                onClick={() => setBaseSeed(20261021)}
                title="Kembalikan ke angka awal standar penelitian (20261021)"
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {isRunning ? (
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                Batalkan Pencarian
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleLoadCatalog(true)}
                  disabled={!backendOnline || isLoadingCatalog}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold text-xs border border-slate-200 transition-all cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5 text-[#086288]" />
                  {showCatalogPreview
                    ? "Tutup Daftar Konfigurasi"
                    : `Lihat Daftar (${catalog?.total_candidates ?? 546} Konfigurasi)`}
                </button>
                <button
                  onClick={handleStartSearch}
                  disabled={!backendOnline}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#086288] hover:bg-[#064e6d] disabled:bg-slate-300 text-white font-bold text-xs shadow-md shadow-sky-900/10 transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Jalankan Evaluasi 546 Konfigurasi (Server Python)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Ringkasan Ruang Pencarian */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-0.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Kombinasi Ukuran Zona</span>
            <span className="text-base font-extrabold text-slate-900">
              {catalog?.total_partitions ?? 91} Pembagian
            </span>
            <span className="text-[11px] text-slate-500">5–15 baris per zona (total 30)</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-0.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Pilihan Urutan Zona</span>
            <span className="text-base font-extrabold text-slate-900">
              {catalog?.total_permutations ?? 6} Urutan Boarding
            </span>
            <span className="text-[11px] text-slate-500">Semua kemungkinan urutan 3 zona</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-0.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Total Konfigurasi Diuji</span>
            <span className="text-base font-extrabold text-[#086288]">
              {catalog?.total_candidates ?? 546} Kombinasi
            </span>
            <span className="text-[11px] text-slate-500">Seluruh kombinasi sah</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-0.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Total Simulasi</span>
            <span className="text-base font-extrabold text-amber-700">8.190 Penerbangan</span>
            <span className="text-[11px] text-slate-500">546 konfigurasi × 15 skenario</span>
          </div>
        </div>

        {/* Pratinjau Katalog 546 Kandidat */}
        {showCatalogPreview && catalog && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-3 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-[#086288]" />
                <span className="text-xs font-bold text-slate-900">
                  Daftar Konfigurasi Pembagian Zona ({catalog.total_candidates} Kombinasi Sah)
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                Menampilkan {catalog.sample_candidates.length} sampel konfigurasi awal
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="py-1.5 px-2.5">No. Kandidat</th>
                    <th className="py-1.5 px-2.5">Batas Zona</th>
                    <th className="py-1.5 px-2.5">Pembagian Zona (Baris)</th>
                    <th className="py-1.5 px-2.5">Urutan Boarding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 font-mono text-[11px] text-slate-700">
                  {catalog.sample_candidates.map((item) => (
                    <tr key={item.candidate_id} className="hover:bg-white transition-colors">
                      <td className="py-1.5 px-2.5 font-bold text-[#086288]">#{item.candidate_id}</td>
                      <td className="py-1.5 px-2.5">Baris {item.boundaries.join(" dan ")}</td>
                      <td className="py-1.5 px-2.5">{item.zone_sizes.join(", ")} baris</td>
                      <td className="py-1.5 px-2.5">{formatOrderName(item.zone_order)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Progress Bar & Live Stats jika sedang berjalan */}
        {isRunning && jobStatus && (
          <div className="p-5 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex flex-col gap-4 animate-in fade-in">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-700 animate-spin" />
                <span className="text-xs font-bold text-amber-900">
                  Evaluasi 546 Konfigurasi Sedang Berjalan di Server Python...
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono font-bold text-amber-900">
                <span>{jobStatus.evaluated_candidates} / 546 Konfigurasi</span>
                <span className="px-2 py-0.5 rounded-lg bg-amber-200/80 text-amber-950">
                  {jobStatus.progress_percent}%
                </span>
              </div>
            </div>

            {/* Progress track */}
            <div className="w-full h-3 bg-amber-200/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-600 to-amber-500 transition-all duration-300 rounded-full"
                style={{ width: `${Math.max(2, jobStatus.progress_percent)}%` }}
              />
            </div>

            {/* Live Preview Best-So-Far */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>Waktu Berjalan: <strong>{jobStatus.elapsed_time_seconds} detik</strong></span>
              </div>
              {jobStatus.best_candidate && (
                <>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Layers className="w-4 h-4 text-amber-600" />
                    <span>
                      Batas Zona Terbaik Sementara: <strong>Baris {jobStatus.best_candidate.zone_boundaries.join(" dan ")}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Award className="w-4 h-4 text-emerald-600" />
                    <span>
                      Rata-rata Waktu Boarding: <strong>{jobStatus.best_candidate.training_fitness_seconds} dtk</strong> ({jobStatus.best_candidate.training_fitness_minutes} mnt)
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Status Error jika ada */}
        {error && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Catatan Layanan:</strong> {error}
            </div>
          </div>
        )}

        {/* Status Dibatalkan */}
        {jobStatus?.status === "cancelled" && (
          <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
            <span>Pencarian dibatalkan oleh pengguna setelah mengevaluasi {jobStatus.evaluated_candidates} konfigurasi ({jobStatus.elapsed_time_seconds} dtk).</span>
            <span className="font-bold text-slate-500">Status: Dibatalkan</span>
          </div>
        )}
      </div>

      {/* Tampilan Hasil Pencarian Selesai */}
      {jobStatus?.status === "completed" && jobStatus.best_candidate && (
        <div className="flex flex-col gap-6 animate-in fade-in">
          {/* Header Hasil dan Badge Verifikasi */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <h4 className="text-lg font-black text-slate-900 tracking-tight">
                  Konfigurasi Terbaik Ditemukan (546 / 546 Kombinasi Diuji)
                </h4>
              </div>
              <p className="text-xs text-slate-500">
                Waktu komputasi total: <strong>{jobStatus.execution_time_seconds} detik</strong> • Seluruh 546 kombinasi telah dievaluasi lengkap.
              </p>
            </div>

            {jobStatus.matches_stored_optimum ? (
              <div className="px-4 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2 text-xs font-bold shadow-sm">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Sama Persis dengan Hasil Penelitian: Batas Baris 5 & 18 | Urutan Zona 3 → 2 → 1 (Selisih 0,00%)</span>
              </div>
            ) : (
              <div className="px-4 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2 text-xs font-bold shadow-sm">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Konfigurasi Berbeda dari Standar Penelitian (Sesuai Angka Awal Pengacakan Baru)</span>
              </div>
            )}
          </div>

          {/* 4 KPI Cards Konfigurasi Optimum */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Batas Zona */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Batas Zona Terbaik</span>
                <Layers className="w-4 h-4 text-[#086288]" />
              </div>
              <div className="mt-2">
                <div className="text-xl font-black text-slate-900 tracking-tight">
                  Baris {jobStatus.best_candidate.zone_boundaries.join(" dan ")}
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  Zona 1: 1–{jobStatus.best_candidate.zone_boundaries[0]} | Zona 2: {jobStatus.best_candidate.zone_boundaries[0] + 1}–{jobStatus.best_candidate.zone_boundaries[1]} | Zona 3: {jobStatus.best_candidate.zone_boundaries[1] + 1}–30
                </span>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                Titik batas antar-zona kabin
              </div>
            </div>

            {/* Card 2: Ukuran Zona */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Pembagian Zona</span>
                <BarChart3 className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="mt-2">
                <div className="text-xl font-black text-slate-900 tracking-tight">
                  {jobStatus.best_candidate.zone_sizes.join(", ")} Baris
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  Zona 1: {jobStatus.best_candidate.zone_sizes[0]} baris • Zona 2: {jobStatus.best_candidate.zone_sizes[1]} baris • Zona 3: {jobStatus.best_candidate.zone_sizes[2]} baris
                </span>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                Total 30 baris kabin (180 kursi)
              </div>
            </div>

            {/* Card 3: Urutan Zona */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Urutan Boarding</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2">
                <div className="text-xl font-black text-slate-900 tracking-tight">
                  {formatOrderName(jobStatus.best_candidate.zone_order)}
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  Belakang ke depan
                </span>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                Prioritas kursi jendela–tengah–lorong
              </div>
            </div>

            {/* Card 4: Waktu Boarding Terendah */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Rata-rata Waktu Boarding</span>
                <Award className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-emerald-700 tracking-tight tabular-nums">
                  {jobStatus.best_candidate.training_fitness_seconds} dtk
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  Setara <strong>{jobStatus.best_candidate.training_fitness_minutes} menit</strong>
                </span>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                Rata-rata 15 skenario uji
              </div>
            </div>
          </div>

          {/* Tabel Top 10 Konfigurasi Terbaik */}
          {jobStatus.top_candidates && jobStatus.top_candidates.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-600" />
                  <h4 className="text-sm font-bold text-slate-900">
                    10 Konfigurasi Pembagian Zona dengan Waktu Boarding Terendah
                  </h4>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Diurutkan dari rata-rata waktu boarding tercepat
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/70">
                      <th className="py-2.5 px-3">Peringkat</th>
                      <th className="py-2.5 px-3">No. Kandidat</th>
                      <th className="py-2.5 px-3">Batas Zona</th>
                      <th className="py-2.5 px-3">Pembagian Zona</th>
                      <th className="py-2.5 px-3">Urutan Boarding</th>
                      <th className="py-2.5 px-3 text-right">Waktu Boarding (Detik)</th>
                      <th className="py-2.5 px-3 text-right">Waktu Boarding (Menit)</th>
                      <th className="py-2.5 px-3 text-right">Selisih dari Terbaik</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {jobStatus.top_candidates.map((cand, idx) => {
                      const gap = cand.training_fitness_seconds - jobStatus.best_candidate!.training_fitness_seconds;
                      const gapPct = (gap / jobStatus.best_candidate!.training_fitness_seconds) * 100;
                      const isBest = idx === 0;

                      return (
                        <tr
                          key={cand.candidate_id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isBest ? "bg-emerald-50/40 font-bold" : ""
                          }`}
                        >
                          <td className="py-2.5 px-3 flex items-center gap-1.5">
                            {isBest && <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                            <span>#{idx + 1}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">#{cand.candidate_id}</td>
                          <td className="py-2.5 px-3">Baris {cand.zone_boundaries.join(" dan ")}</td>
                          <td className="py-2.5 px-3">{cand.zone_sizes.join(", ")} baris</td>
                          <td className="py-2.5 px-3">
                            {formatOrderName(cand.zone_order)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-900 tabular-nums">
                            {cand.training_fitness_seconds.toFixed(3)} dtk
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600 tabular-nums">
                            {cand.training_fitness_minutes.toFixed(3)} mnt
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            {isBest ? (
                              <span className="text-emerald-700 font-bold">0,00% (Tercepat)</span>
                            ) : (
                              <span className="text-slate-500">+{gapPct.toFixed(2)}%</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Penjelasan Metodologis & Konteks Desain Riset */}
          <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200/90 text-xs text-slate-600 flex flex-col gap-3">
            <h5 className="font-bold text-slate-900 flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-[#086288]" />
              Catatan Operasional & Validasi Pembagian Zona
            </h5>
            <p className="leading-relaxed">
              1. <strong>Rata-rata Waktu Boarding Pengujian (15 Skenario):</strong> Nilai <strong>291,069 detik (4,851 menit)</strong> adalah rata-rata waktu boarding dari 15 skenario uji (5 replikasi pada tingkat bagasi 50%, 60%, dan 70%) yang digunakan untuk menentukan batas zona terbaik.
            </p>
            <p className="leading-relaxed">
              2. <strong>Perbedaan dengan Data Benchmark Tersimpan (100 Replikasi):</strong> Pada evaluasi akhir 100 replikasi independen, GA-Zone-WMA dan Exhaustive-Zone-WMA menghasilkan rata-rata 4,815 menit (bagasi 50%), 4,978 menit (bagasi 60%), dan 5,124 menit (bagasi 70%).
            </p>
            <p className="leading-relaxed">
              3. <strong>Kesesuaian Konfigurasi Pembagian Zona:</strong> Metode optimasi memilih <strong>batas zona di baris 5 dan 18</strong> (pembagian zona: 5, 13, dan 12 baris) dengan <strong>urutan boarding Zona 3 ke Zona 2 ke Zona 1</strong>, sama persis dengan konfigurasi waktu boarding terendah dari seluruh 546 kombinasi.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
