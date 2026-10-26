import React, { useState, useRef } from "react";
import {
  Server,
  Play,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Download,
  Info,
  Clock,
  Layers,
  Users,
  Luggage,
  ShieldAlert,
  BarChart2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import {
  runPythonBatchSimulation,
  PythonBatchSimulationResponse,
  ReplicationRecord,
} from "../services/apiClient";
import { INVENTARIS_METODE, RINGKASAN_BENCHMARK } from "../data/benchmarkData";

interface BatchSimulationPanelProps {
  backendOnline: boolean;
  onRecheckBackend: () => void;
}

export const BatchSimulationPanel: React.FC<BatchSimulationPanelProps> = ({
  backendOnline,
  onRecheckBackend,
}) => {
  // Input form state
  const [method, setMethod] = useState<string>("Back-to-Front-WILMA");
  const [baggagePercent, setBaggagePercent] = useState<number>(60);
  const [replications, setReplications] = useState<number>(30);
  const [baseSeed, setBaseSeed] = useState<number>(20261021);

  // Execution state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<PythonBatchSimulationResponse | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Table filter state
  const [searchSeed, setSearchSeed] = useState<string>("");

  const handleStartBatch = async () => {
    if (!backendOnline) {
      setError("Layanan Python Backend Offline. Simulasi batch memerlukan eksekusi server Python dan tidak dapat dijalankan di browser demo lokal.");
      return;
    }

    setIsRunning(true);
    setError(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await runPythonBatchSimulation(
        {
          method,
          baggage_ratio: baggagePercent / 100,
          replications,
          base_seed: baseSeed,
        },
        30000,
        controller.signal
      );
      if (!controller.signal.aborted) {
        setBatchResult(response);
      }
    } catch (err: any) {
      if (err.name === "AbortError" || err.message?.includes("dibatalkan")) {
        setError("Eksekusi batch simulasi dibatalkan oleh pengguna.");
      } else {
        setError(err.message || "Terjadi kesalahan saat menjalankan batch simulasi di backend Python.");
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelBatch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsRunning(false);
  };

  const handleExportCSV = () => {
    if (!batchResult || !batchResult.replications_data.length) return;

    const headers = [
      "Replication_ID",
      "Seed",
      "Boarding_Time_Seconds",
      "Boarding_Time_Minutes",
      "Aisle_Interference_Events",
      "Aggregate_Aisle_Wait_Person_Seconds",
      "Seat_Interference_Events",
      "Occupied_Blocker_Count",
      "Baggage_Count",
      "Passenger_Count",
    ];

    const rows = batchResult.replications_data.map((r: ReplicationRecord) => [
      r.replication_id,
      r.seed,
      r.boarding_time_seconds,
      r.boarding_time_minutes,
      r.aisle_interference_events,
      r.aggregate_aisle_wait_person_seconds,
      r.seat_interference_events,
      r.occupied_blocker_count,
      r.baggage_count,
      r.passenger_count,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `zoneflow_batch_${batchResult.method}_${batchResult.baggage_percent}pct_${batchResult.successful_replications}reps.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Cari benchmark tersimpan pembanding
  const storedBenchmark = RINGKASAN_BENCHMARK.find(
    (b) =>
      b.baggage_percent === baggagePercent &&
      b.method.toLowerCase().trim() === method.toLowerCase().trim()
  );

  const filteredReplications = (batchResult?.replications_data || []).filter((r) => {
    if (!searchSeed) return true;
    return r.seed.toString().includes(searchSeed) || r.replication_id.toString().includes(searchSeed);
  });

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* Configuration Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-sky-50 text-[#086288]">
                <Server className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  Simulator Batch Replikasi Python (FastAPI / Core v3)
                </h3>
                <p className="text-xs text-slate-500">
                  Menjalankan eksperimen multi-replikasi (10–100 run) deterministik dan menghitung interval kepercayaan 95%.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                backendOnline
                  ? "bg-emerald-50 text-emerald-900 border border-emerald-300 shadow-2xs"
                  : "bg-rose-50 text-rose-900 border border-rose-300 shadow-2xs"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  backendOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                }`}
              />
              {backendOnline ? "Backend Python Siap" : "Backend Offline"}
            </span>
            {!backendOnline && (
              <button
                onClick={onRecheckBackend}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs flex items-center gap-1"
                title="Cek ulang koneksi backend"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Form Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Method Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Metode Boarding</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              disabled={isRunning}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#086288] disabled:opacity-50"
            >
              {INVENTARIS_METODE.map((m) => (
                <option key={m.method_id} value={m.method_name}>
                  {m.method_name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Baggage Level */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Tingkat Bagasi</label>
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              {[50, 60, 70].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setBaggagePercent(pct)}
                  disabled={isRunning}
                  className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${
                    baggagePercent === pct
                      ? "bg-[#086288] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  } disabled:opacity-50`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* 3. Replications */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">Jumlah Replikasi (N)</label>
              <span className="text-[11px] font-mono font-bold text-[#086288]">
                {replications} run
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {[10, 30, 50, 100].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setReplications(count)}
                  disabled={isRunning}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                    replications === count
                      ? "bg-slate-800 text-white border-slate-800 shadow-xs"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                  } disabled:opacity-50`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Base Seed */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Seed Dasar</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={baseSeed}
                onChange={(e) => setBaseSeed(parseInt(e.target.value) || 0)}
                disabled={isRunning}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#086288] disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setBaseSeed(20261021)}
                disabled={isRunning}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold border border-slate-200 shrink-0"
                title="Reset ke seed penelitian 20261021"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Action Button & Status Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2 border-t border-slate-100">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <Info className="w-4 h-4 text-[#086288] shrink-0" />
            <span>
              Eksperimen akan mengeksekusi seed <strong>{baseSeed}</strong> hingga{" "}
              <strong>{baseSeed + replications - 1}</strong> secara deterministik.
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isRunning ? (
              <button
                type="button"
                onClick={handleCancelBatch}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs"
              >
                <XCircle className="w-4 h-4" />
                Batalkan
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartBatch}
                disabled={!backendOnline}
                className="px-6 py-2.5 rounded-xl bg-[#086288] hover:bg-[#064e6d] text-white font-bold text-xs flex items-center gap-2 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4 fill-white" />
                Jalankan Batch Python ({replications} Replikasi)
              </button>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold">Gagal Menjalankan Batch:</span> {error}
            </div>
          </div>
        )}

        {/* Loading Spinner Indicator */}
        {isRunning && (
          <div className="p-6 rounded-2xl bg-sky-50 border border-sky-200 flex flex-col items-center justify-center gap-3 text-center animate-pulse">
            <RefreshCw className="w-6 h-6 text-[#086288] animate-spin" />
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Memproses {replications} Replikasi di Backend Python...
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Kalkulasi antrean lorong diskrit dan simulasi interferensi fisik kabin sedang berjalan.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Results Section */}
      {batchResult && (
        <div className="flex flex-col gap-6 animate-fadeIn">
          {/* Main Badge & Session Notice */}
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-emerald-950">
            <div className="flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold text-sm block">
                  Hasil Simulasi Batch Baru — Python Backend (Bukan Benchmark Tersimpan)
                </span>
                <p className="text-emerald-800 mt-0.5 leading-relaxed">
                  Berhasil mengeksekusi <strong>{batchResult.successful_replications}</strong> replikasi{" "}
                  (Metode: <strong>{batchResult.method}</strong>, Bagasi: <strong>{batchResult.baggage_percent}%</strong>) dengan durasi komputasi CPU{" "}
                  <strong>{batchResult.execution_time_ms.toFixed(1)} ms</strong>.
                </p>
              </div>
            </div>

            <button
              onClick={handleExportCSV}
              className="px-4 py-2 rounded-xl bg-white hover:bg-emerald-100 text-emerald-900 font-bold text-xs border border-emerald-300 shadow-2xs flex items-center gap-1.5 shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh CSV ({batchResult.successful_replications} Baris)
            </button>
          </div>

          {/* Statistical KPI Cards (4 Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Mean Boarding Time & 95% CI */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Rata-rata Waktu Boarding
                </span>
                <div className="p-1.5 rounded-lg bg-sky-50 text-[#086288]">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-extrabold text-slate-900 font-mono">
                  {batchResult.statistics.boarding_time_minutes.mean.toFixed(3)}{" "}
                  <span className="text-xs text-slate-500 font-sans">min</span>
                </div>
                <p className="text-xs font-mono font-semibold text-slate-600 mt-0.5">
                  {batchResult.statistics.boarding_time_seconds.mean.toFixed(1)} detik
                </p>
                <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  <strong>95% CI:</strong> [
                  {batchResult.statistics.boarding_time_minutes.ci95_low.toFixed(3)},{" "}
                  {batchResult.statistics.boarding_time_minutes.ci95_high.toFixed(3)}] min
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    Margin of Error: ±
                    {batchResult.statistics.boarding_time_minutes.margin_of_error.toFixed(3)} min
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Dispersion (Std Dev & Range) */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Variasi & Simpangan Baku
                </span>
                <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
                  <BarChart2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-extrabold text-slate-900 font-mono">
                  ±{batchResult.statistics.boarding_time_seconds.std.toFixed(2)}{" "}
                  <span className="text-xs text-slate-500 font-sans">detik</span>
                </div>
                <p className="text-xs font-mono text-slate-600 mt-0.5">
                  Median: {batchResult.statistics.boarding_time_minutes.median.toFixed(3)} min
                </p>
                <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  <strong>Rentang:</strong>{" "}
                  {batchResult.statistics.boarding_time_seconds.min.toFixed(1)}s –{" "}
                  {batchResult.statistics.boarding_time_seconds.max.toFixed(1)}s
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    ({(batchResult.statistics.boarding_time_minutes.min).toFixed(2)}m –{" "}
                    {(batchResult.statistics.boarding_time_minutes.max).toFixed(2)}m)
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Aisle & Seat Interferences */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Rata-rata Interferensi
                </span>
                <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-extrabold text-slate-900 font-mono">
                  {batchResult.statistics.aisle_interference_events.mean.toFixed(0)}{" "}
                  <span className="text-xs text-slate-500 font-sans">antrean</span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Konflik Kursi:{" "}
                  <strong>{batchResult.statistics.seat_interference_events.mean.toFixed(1)}</strong> kali
                </p>
                <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  <strong>Waktu Antre:</strong>{" "}
                  {batchResult.statistics.aggregate_aisle_wait_person_seconds.mean.toFixed(0)} org·s
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    Blocker terhalang:{" "}
                    {batchResult.statistics.occupied_blocker_count.mean.toFixed(1)} pax
                  </span>
                </div>
              </div>
            </div>

            {/* Card 4: Comparison with Stored Benchmark */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Komparasi vs Benchmark Tersimpan
                </span>
                <div className="p-1.5 rounded-lg bg-sky-50 text-[#086288]">
                  <CheckCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                {storedBenchmark ? (
                  <>
                    <div className="text-xl font-extrabold text-slate-900 font-mono">
                      {storedBenchmark.mean_minutes.toFixed(3)}{" "}
                      <span className="text-xs text-slate-500 font-sans">min (100 reps)</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Batch Baru:{" "}
                      <strong>{batchResult.statistics.boarding_time_minutes.mean.toFixed(3)} min</strong>
                    </p>
                    <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                      <strong>Selisih Sampel:</strong>{" "}
                      {(
                        batchResult.statistics.boarding_time_minutes.mean -
                        storedBenchmark.mean_minutes
                      ).toFixed(3)}{" "}
                      min
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        Benchmark tersimpan tidak berubah.
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-500 mt-2">
                    Metode ini tidak memiliki entri benchmark tersimpan pada tingkat bagasi ini.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Auditable Table of Individual Replications */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Log Audit {batchResult.successful_replications} Replikasi Individual
                </h4>
                <p className="text-xs text-slate-500">
                  Setiap baris mencatat hasil satu penerbangan simulasi lengkap dengan seed deterministiknya.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Cari Seed / Replikasi..."
                  value={searchSeed}
                  onChange={(e) => setSearchSeed(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#086288] w-48"
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-96 border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    <th className="px-4 py-3">Rep #</th>
                    <th className="px-4 py-3">Seed</th>
                    <th className="px-4 py-3">Durasi (s)</th>
                    <th className="px-4 py-3">Durasi (min)</th>
                    <th className="px-4 py-3">Antrean Lorong</th>
                    <th className="px-4 py-3">Waktu Antre (org·s)</th>
                    <th className="px-4 py-3">Konflik Kursi</th>
                    <th className="px-4 py-3">Blocker Terhalang</th>
                    <th className="px-4 py-3">Pax Bagasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px] text-slate-700">
                  {filteredReplications.map((rep) => (
                    <tr key={rep.replication_id} className="hover:bg-sky-50/50 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-[#086288]">
                        #{rep.replication_id}
                      </td>
                      <td className="px-4 py-2.5">{rep.seed}</td>
                      <td className="px-4 py-2.5 font-semibold text-slate-900">
                        {rep.boarding_time_seconds.toFixed(2)}s
                      </td>
                      <td className="px-4 py-2.5 font-bold text-slate-900">
                        {rep.boarding_time_minutes.toFixed(3)}m
                      </td>
                      <td className="px-4 py-2.5">{rep.aisle_interference_events}</td>
                      <td className="px-4 py-2.5">
                        {rep.aggregate_aisle_wait_person_seconds.toFixed(1)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full ${
                            rep.seat_interference_events === 0
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {rep.seat_interference_events}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">{rep.occupied_blocker_count}</td>
                      <td className="px-4 py-2.5">{rep.baggage_count} / 180</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Menampilkan {filteredReplications.length} dari {batchResult.successful_replications} replikasi</span>
              <span>Kalkulasi selesai dalam {batchResult.execution_time_ms.toFixed(1)} ms</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
