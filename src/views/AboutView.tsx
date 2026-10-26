import React from "react";
import {
  Plane,
  Terminal,
  Server,
} from "lucide-react";

export const AboutView: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 p-5 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Hero Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs flex flex-col gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#086288] to-[#4D8DBA] flex items-center justify-center text-white shadow-md shadow-[#086288]/30 shrink-0">
            <Plane className="w-6 h-6 -rotate-45" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Tentang ZoneFlow
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Platform Simulasi Interaktif & Analitik Boarding Pesawat
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed mt-1">
          <strong>ZoneFlow</strong> adalah aplikasi web analitik dan simulasi penelitian yang dirancang
          untuk mengeksplorasi strategi urutan boarding pesawat terbang, membandingkan kinerja 12 metode
          secara kuantitatif, mengevaluasi sensitivitas waktu boarding terhadap variasi muatan bagasi kabin,
          serta menjalankan optimasi pembagian zona berbasis pencarian menyeluruh (<em>Exhaustive Search</em>)
          dan Algoritma Genetika (GA).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-slate-500">Konfigurasi Kabin</span>
            <span className="text-sm font-bold text-slate-900 tabular-nums">Lorong Tunggal 3-3</span>
            <span className="text-xs text-slate-500 tabular-nums">30 baris • 180 kursi</span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-slate-500">Skenario Bagasi</span>
            <span className="text-sm font-bold text-slate-900 tabular-nums">50%, 60%, 70%</span>
            <span className="text-xs text-slate-500 tabular-nums">Distribusi Weibull (16,0 dtk; 1,7)</span>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-slate-500">Replikasi Benchmark</span>
            <span className="text-sm font-bold text-[#086288] tabular-nums">100 Replikasi / Metode</span>
            <span className="text-xs text-slate-500 tabular-nums">3.600 skenario tersimpan</span>
          </div>
        </div>
      </div>

      {/* Architecture & Decoupling Philosophy */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs flex flex-col gap-6">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <Server className="w-5 h-5 text-[#086288]" />
          <h3 className="text-base font-bold text-slate-900">
            Arsitektur Sistem & Pemisahan Frontend–Backend
          </h3>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          ZoneFlow menerapkan pemisahan yang jelas antara antarmuka visual, data benchmark tersimpan,
          dan mesin komputasi simulasi:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-sky-50/70 border border-sky-100 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#086288] text-white flex items-center justify-center font-bold text-xs">
              UI
            </div>
            <h4 className="text-sm font-bold text-slate-900">1. Antarmuka React</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Dashboard analitik responsif, visualisasi 2D kabin pesawat, kontrol animasi linimasa,
              filter skenario bagasi, dan panel pemantauan optimasi waktu-nyata.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-purple-50/70 border border-purple-100 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-700 text-white flex items-center justify-center font-bold text-xs">
              CSV
            </div>
            <h4 className="text-sm font-bold text-slate-900">2. Database Benchmark</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Seluruh metrik dan tabel benchmark diambil langsung dari keluaran eksperimen Python
              tersimpan (100 replikasi independen) tanpa modifikasi angka penelitian.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
              API
            </div>
            <h4 className="text-sm font-bold text-slate-900">3. Backend Python FastAPI</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Layanan REST API mandiri pada direktori <code className="text-emerald-800 font-mono text-[11px] bg-emerald-100/60 px-1.5 py-0.5 rounded">backend/</code> yang mengeksekusi simulasi tunggal, batch, Exhaustive Search, dan GA secara dinamis.
            </p>
          </div>
        </div>
      </div>

      {/* REST API Contract Documentation */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs flex flex-col gap-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <Terminal className="w-5 h-5 text-[#086288]" />
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Spesifikasi Kontrak API Python & Status Layanan
            </h3>
            <span className="text-xs text-slate-500">
              Layanan FastAPI berjalan pada port 8001 (diproksi melalui <code className="font-mono">/api/v1</code> atau variabel <code className="font-mono">VITE_API_BASE_URL</code>).
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          ZoneFlow dilengkapi backend FastAPI Python mandiri (<code className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">backend/app/main.py</code>) dengan pemeriksaan kesehatan otomatis (<code className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">GET /api/v1/health</code>) dan katalog metode (<code className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">GET /api/v1/methods</code>). Apabila server Python sedang tidak aktif, antarmuka secara transparan menampilkan status <strong>Offline</strong> dan menyediakan mode cadangan <strong>Demo Browser (TypeScript Engine)</strong> untuk simulasi tunggal:
        </p>

        {/* Daftar Endpoint Aktif */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col gap-1">
            <span className="font-mono font-bold text-[#086288]">GET /api/v1/health &amp; /api/v1/methods</span>
            <span className="text-slate-600">Pemeriksaan status layanan Python dan inventaris 12 metode boarding.</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col gap-1">
            <span className="font-mono font-bold text-emerald-700">POST /api/v1/simulate &amp; /api/v1/simulate/batch</span>
            <span className="text-slate-600">Simulasi tunggal (180 penumpang) dan eksperimen batch (10–100 replikasi, 95% CI).</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col gap-1">
            <span className="font-mono font-bold text-amber-700">/api/v1/optimize/exhaustive/*</span>
            <span className="text-slate-600">Katalog (<code className="font-mono">GET /candidates</code>), mulai job (<code className="font-mono">POST</code>), pemantauan (<code className="font-mono">GET /status/&#123;id&#125;</code>), &amp; pembatalan (<code className="font-mono">POST /cancel/&#123;id&#125;</code>) untuk 546 kandidat.</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col gap-1">
            <span className="font-mono font-bold text-indigo-700">/api/v1/optimize/ga/*</span>
            <span className="text-slate-600">Evolusi populasi GA dinamis (<code className="font-mono">POST</code>), progres per generasi (<code className="font-mono">GET /status/&#123;id&#125;</code>), &amp; pembatalan (<code className="font-mono">POST /cancel/&#123;id&#125;</code>).</span>
          </div>
        </div>

        {/* Endpoint 1 */}
        <div className="bg-slate-900 rounded-2xl p-5 text-slate-200 flex flex-col gap-3 font-mono text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-emerald-400 font-bold">POST /api/v1/simulate</span>
            <span className="text-[11px] text-slate-400">Simulasi Tunggal (1 Replikasi Python)</span>
          </div>
          <div className="text-slate-400 text-[11px]">Muatan Permintaan (JSON):</div>
          <pre className="bg-slate-950 p-3 rounded-xl overflow-x-auto text-sky-300">
{`{
  "method": "GA-Zone-WMA",
  "baggage_ratio": 0.60,
  "load_factor": 1.0,
  "seed": 20261021
}`}
          </pre>
          <div className="text-slate-400 text-[11px]">Respons (JSON — Ringkasan):</div>
          <pre className="bg-slate-950 p-3 rounded-xl overflow-x-auto text-emerald-300">
{`{
  "status": "success",
  "engine": "Python Backend Engine (FastAPI / Core v3)",
  "method": "GA-Zone-WMA",
  "baggage_ratio": 0.6,
  "baggage_percent": 60,
  "seed": 20261021,
  "metrics": {
    "boarding_time_seconds": 267.179,
    "boarding_time_minutes": 4.453,
    "aisle_interference_events": 135,
    "seat_interference_events": 0,
    "baggage_count": 108,
    "passenger_count": 180
  }
}`}
          </pre>
        </div>

        {/* Endpoint 2 */}
        <div className="bg-slate-900 rounded-2xl p-5 text-slate-200 flex flex-col gap-3 font-mono text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-purple-400 font-bold">POST /api/v1/optimize/ga</span>
            <span className="text-[11px] text-slate-400">Evolusi Populasi Algoritma Genetika Dinamis</span>
          </div>
          <div className="text-slate-400 text-[11px]">Muatan Permintaan (JSON):</div>
          <pre className="bg-slate-950 p-3 rounded-xl overflow-x-auto text-sky-300">
{`{
  "population_size": 24,
  "generations": 20,
  "elite_count": 2,
  "mutation_rate": 0.30,
  "tournament_size": 3,
  "ga_seed": 20262020,
  "base_seed": 20261021
}`}
          </pre>
          <div className="text-slate-400 text-[11px]">Respons Status Selesai (GET /api/v1/optimize/ga/status/&#123;job_id&#125;):</div>
          <pre className="bg-slate-950 p-3 rounded-xl overflow-x-auto text-purple-300">
{`{
  "status": "completed",
  "unique_candidates_evaluated": 121,
  "search_space_size": 546,
  "best_candidate": {
    "zone_boundaries": [5, 18],
    "zone_sizes": [5, 13, 12],
    "zone_order": [3, 2, 1],
    "training_fitness_seconds": 291.069,
    "training_fitness_minutes": 4.851
  },
  "matches_exhaustive_optimum": true
}`}
          </pre>
        </div>
      </div>

      {/* Disclaimers & Ethics */}
      <div className="p-6 rounded-3xl bg-slate-100 border border-slate-200 flex flex-col gap-3 text-xs text-slate-600 leading-relaxed">
        <span className="font-bold text-slate-900 text-sm">
          Penetapan Batasan & Kejujuran Akademik
        </span>
        <ul className="flex flex-col gap-1.5 list-disc list-inside">
          <li>Nama aplikasi adalah <strong>ZoneFlow</strong>. AZBO merupakan kerangka berpikir konseptual awal, bukan merek dagang.</li>
          <li>Keluaran simulasi adalah estimasi model matematis diskrit, bukan rekaman telemetri operasional maskapai penerbangan.</li>
          <li>Hasil eksperimen menunjukkan <strong>Back-to-Front-WILMA</strong> mencapai rata-rata waktu tersingkat di seluruh tingkat bagasi, sedangkan <strong>GA-Zone-WMA</strong> terbukti menemukan titik optimum eksak dalam ruang solusi 3 zona.</li>
        </ul>
      </div>
    </div>
  );
};
