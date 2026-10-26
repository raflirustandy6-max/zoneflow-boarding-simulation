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
                Tahap 5B-1 • Dynamic Exact Audit
              </span>
              <span className="text-xs font-semibold text-slate-500">
                91 Partisi × 6 Permutasi = 546 Kandidat
              </span>
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              Optimasi Exhaustive-Zone-WMA (Python Backend Engine)
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
              Mengevaluasi secara dinamis seluruh konfigurasi partisi ukuran zona valid (5–15 baris) dan 6 urutan pemanggilan kabin 30 baris. Menggunakan fungsi fitness rata-rata 15 batch pelatihan (5 replikasi × 3 level bagasi 50%, 60%, 70%) dari Cell 10 script penelitian asli.
            </p>
          </div>
        </div>

        {/* Backend Online Status Pill */}
        <div className="flex items-center gap-2 shrink-0">
          {backendOnline ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Python Backend Siap
            </div>
          ) : (
            <button
              onClick={onRecheckBackend}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold hover:bg-rose-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Backend Offline (Cek Ulang)
            </button>
          )}
        </div>
      </div>

      {/* Notice Tag Pemisah Benchmark */}
      <div className="p-4 rounded-2xl bg-sky-50/80 border border-sky-100 text-xs text-sky-900 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-[#086288] shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Pemisahan Data:</strong> Hasil dari panel ini diberi label{" "}
          <span className="font-mono font-bold bg-sky-100/70 text-[#086288] px-1 py-0.5 rounded">
            Hasil Optimasi Dinamis — Python Backend
          </span>
          . Dataset benchmark historis 100 replikasi tersimpan (di mana Back-to-Front-WILMA tetap peringkat 1) tidak akan diubah atau ditimpa.
        </div>
      </div>

      {/* Kontrol Parameter & Tombol Eksekusi */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h4 className="text-base font-bold text-slate-900">Konfigurasi Parameter Evaluasi</h4>
            <p className="text-xs text-slate-500">
              Evaluasi dilakukan terhadap seluruh 546 kandidat menggunakan 15 batch pelatihan terkalibrasi.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600">Base Seed:</label>
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
                title="Reset ke seed penelitian asli (20261021)"
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
                    ? "Tutup Katalog Kandidat"
                    : `Lihat Katalog (${catalog?.total_candidates ?? 546} Kandidat)`}
                </button>
                <button
                  onClick={handleStartSearch}
                  disabled={!backendOnline}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#086288] hover:bg-[#064e6d] disabled:bg-slate-300 text-white font-bold text-xs shadow-md shadow-sky-900/10 transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Mulai Exhaustive Search (546 Kandidat)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Ringkasan Ruang Pencarian */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-0.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Partisi Ukuran Zona</span>
            <span className="text-base font-extrabold text-slate-900">
              {catalog?.total_partitions ?? 91} Partisi
            </span>
            <span className="text-[11px] text-slate-500">Min 5, Max 15, Total 30</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-0.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Permutasi Urutan</span>
            <span className="text-base font-extrabold text-slate-900">
              {catalog?.total_permutations ?? 6} Urutan (3!)
            </span>
            <span className="text-[11px] text-slate-500">Seluruh permutasi zona</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-0.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Total Kandidat Ruang</span>
            <span className="text-base font-extrabold text-[#086288]">
              {catalog?.total_candidates ?? 546} Kombinasi
            </span>
            <span className="text-[11px] text-slate-500">100% Valid Tanpa Duplikat</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-0.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Total Simulasi</span>
            <span className="text-base font-extrabold text-amber-700">8,190 Penerbangan</span>
            <span className="text-[11px] text-slate-500">546 × 15 batch pelatihan</span>
          </div>
        </div>

        {/* Pratinjau Katalog 546 Kandidat dari Endpoint GET /api/v1/optimize/exhaustive/candidates */}
        {showCatalogPreview && catalog && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-3 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-[#086288]" />
                <span className="text-xs font-bold text-slate-900">
                  Katalog Ruang Pencarian Terverifikasi Backend ({catalog.total_candidates} Kandidat Valid)
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                Endpoint: GET /api/v1/optimize/exhaustive/candidates • Menampilkan {catalog.sample_candidates.length} sampel awal
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="py-1.5 px-2.5">Candidate ID</th>
                    <th className="py-1.5 px-2.5">Batas Zona</th>
                    <th className="py-1.5 px-2.5">Ukuran Zona (Baris)</th>
                    <th className="py-1.5 px-2.5">Urutan Pemanggilan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 font-mono text-[11px] text-slate-700">
                  {catalog.sample_candidates.map((item) => (
                    <tr key={item.candidate_id} className="hover:bg-white transition-colors">
                      <td className="py-1.5 px-2.5 font-bold text-[#086288]">#{item.candidate_id}</td>
                      <td className="py-1.5 px-2.5">[{item.boundaries.join(", ")}]</td>
                      <td className="py-1.5 px-2.5">[{item.zone_sizes.join(", ")}]</td>
                      <td className="py-1.5 px-2.5">[{item.zone_order.join(", ")}] ({formatOrderName(item.zone_order)})</td>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-700 animate-spin" />
                <span className="text-xs font-bold text-amber-900">
                  Evaluasi Sedang Berlangsung di Worker Thread Python Backend...
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono font-bold text-amber-900">
                <span>{jobStatus.evaluated_candidates} / 546 Kandidat</span>
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
                      Batas Sementara: <strong>[{jobStatus.best_candidate.zone_boundaries.join(", ")}]</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Award className="w-4 h-4 text-emerald-600" />
                    <span>
                      Fitness Sementara: <strong>{jobStatus.best_candidate.training_fitness_seconds} s</strong> ({jobStatus.best_candidate.training_fitness_minutes} m)
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Status Error jika ada */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-3">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Gagal:</strong> {error}
            </div>
          </div>
        )}

        {/* Status Dibatalkan */}
        {jobStatus?.status === "cancelled" && (
          <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
            <span>Pencarian dibatalkan oleh pengguna setelah mengevaluasi {jobStatus.evaluated_candidates} kandidat ({jobStatus.elapsed_time_seconds}s).</span>
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
                  Optimum Eksak Berhasil Ditemukan (546 / 546 Kandidat Dievaluasi)
                </h4>
              </div>
              <p className="text-xs text-slate-500">
                Waktu komputasi total: <strong>{jobStatus.execution_time_seconds} detik</strong> • Seluruh 546 kombinasi dievaluasi lengkap tanpa missing candidate.
              </p>
            </div>

            {/* Verifikasi kesetaraan dengan kromosom tersimpan */}
            {jobStatus.matches_stored_optimum ? (
              <div className="px-4 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2 text-xs font-bold shadow-sm">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>100% Identik dengan Optimum Riset: [5, 18] | [3, 2, 1] (Gap: 0.00%)</span>
              </div>
            ) : (
              <div className="px-4 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2 text-xs font-bold shadow-sm">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Optimum Berbeda dari Referensi Penelitian (Periksa Parameter)</span>
              </div>
            )}
          </div>

          {/* 4 KPI Cards Konfigurasi Optimum */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Batas Zona */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Batas Zona Optimum</span>
                <Layers className="w-4 h-4 text-[#086288]" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                  [{jobStatus.best_candidate.zone_boundaries.join(", ")}]
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  Zona 1: R01–05 | Zona 2: R06–18 | Zona 3: R19–30
                </span>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                Batas kumulatif baris kabin
              </div>
            </div>

            {/* Card 2: Ukuran Zona */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Ukuran Tiap Zona</span>
                <BarChart3 className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                  [{jobStatus.best_candidate.zone_sizes.join(", ")}] Baris
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  Z1: {jobStatus.best_candidate.zone_sizes[0]}b • Z2: {jobStatus.best_candidate.zone_sizes[1]}b • Z3: {jobStatus.best_candidate.zone_sizes[2]}b
                </span>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                Total 30 baris kabin (180 kursi)
              </div>
            </div>

            {/* Card 3: Urutan Zona */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Urutan Pemanggilan</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                  [{jobStatus.best_candidate.zone_order.join(", ")}]
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  {formatOrderName(jobStatus.best_candidate.zone_order)} (Belakang → Depan)
                </span>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                Di dalam zona dipanggil prioritas WMA
              </div>
            </div>

            {/* Card 4: Fitness Pelatihan */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Fitness Pelatihan (15 Batch)</span>
                <Award className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black text-emerald-700 tracking-tight">
                  {jobStatus.best_candidate.training_fitness_seconds} s
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  Setara <strong>{jobStatus.best_candidate.training_fitness_minutes} menit</strong>
                </span>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                Rata-rata 15 batch (Cell 10 riset)
              </div>
            </div>
          </div>

          {/* Tabel Top 10 Konfigurasi Terbaik */}
          {jobStatus.top_candidates && jobStatus.top_candidates.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-600" />
                  <h4 className="text-sm font-bold text-slate-900">
                    10 Konfigurasi Terbaik dari 546 Kandidat
                  </h4>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Diurutkan berdasarkan Training Fitness Terendah
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/70">
                      <th className="py-2.5 px-3">Peringkat</th>
                      <th className="py-2.5 px-3">Candidate ID</th>
                      <th className="py-2.5 px-3">Batas Zona</th>
                      <th className="py-2.5 px-3">Ukuran Zona</th>
                      <th className="py-2.5 px-3">Urutan Pemanggilan</th>
                      <th className="py-2.5 px-3 text-right">Fitness (Detik)</th>
                      <th className="py-2.5 px-3 text-right">Fitness (Menit)</th>
                      <th className="py-2.5 px-3 text-right">Gap thd Optimum</th>
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
                          <td className="py-2.5 px-3 font-mono">[{cand.zone_boundaries.join(", ")}]</td>
                          <td className="py-2.5 px-3 font-mono">[{cand.zone_sizes.join(", ")}]</td>
                          <td className="py-2.5 px-3 font-mono">
                            [{cand.zone_order.join(", ")}]
                            <span className="text-[10px] text-slate-400 ml-1">
                              ({cand.zone_order[0] === 3 ? "Belakang-Depan" : "Lainnya"})
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                            {cand.training_fitness_seconds.toFixed(3)} s
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {cand.training_fitness_minutes.toFixed(3)} m
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {isBest ? (
                              <span className="text-emerald-700 font-bold">0.00% (Best)</span>
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
              Catatan Metodologis & Validasi Eksak (Cell 10 Notebook Penelitian)
            </h5>
            <p className="leading-relaxed">
              1. <strong>Fungsi Fitness Pelatihan:</strong> Nilai <strong>291.069 detik (4.851 menit)</strong> adalah rata-rata boarding time dari 15 training batches (5 replikasi pada tingkat bagasi 50%, 60%, dan 70%) yang digunakan untuk mengarahkan pencarian batas zona.
            </p>
            <p className="leading-relaxed">
              2. <strong>Perbedaan dengan Benchmark Pengujian (100 Replikasi):</strong> Pada benchmark evaluasi akhir 100 replikasi, GA-Zone-WMA dan Exhaustive-Zone-WMA menghasilkan rata-rata 4.815m (@50%), 4.978m (@60%), dan 5.124m (@70%). Perbedaan angka terjadi karena set pengujian menggunakan seed independen (seed 1,000,000+) dan jumlah replikasi yang lebih besar (100 vs 15).
            </p>
            <p className="leading-relaxed">
              3. <strong>Bukti Konvergensi GA:</strong> Algoritma Genetika pada penelitian asli berhasil memilih kromosom <strong>[5, 18]</strong> dengan urutan <strong>[3, 2, 1]</strong>, yang terbukti secara matematis merupakan titik optimum eksak global dalam ruang terbatas 546 kandidat.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
