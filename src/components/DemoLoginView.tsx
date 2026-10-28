import React, { useState } from "react";
import { User, Briefcase } from "lucide-react";

export interface DemoSessionInfo {
  operatorName: string;
  role: string;
  enteredAt: string;
}

interface DemoLoginViewProps {
  onEnterDemo: (session: DemoSessionInfo) => void;
}

export const DemoLoginView: React.FC<DemoLoginViewProps> = ({ onEnterDemo }) => {
  const [operatorName, setOperatorName] = useState<string>(
    "Petugas Operasional Bandara"
  );
  const [role, setRole] = useState<string>("Teknisi & Evaluasi Operasional");

  const backgroundUrl = `${import.meta.env.BASE_URL}assets/zoneflow-login-background.jpg`;
  const fullLogoUrl = `${import.meta.env.BASE_URL}assets/zoneflow-logo-full.png`;
  const iconLogoUrl = `${import.meta.env.BASE_URL}assets/zoneflow-logo-icon.png`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedName = operatorName.trim() || "Petugas Operasional Bandara";
    onEnterDemo({
      operatorName: cleanedName,
      role: role.trim() || "Teknisi & Evaluasi Operasional",
      enteredAt: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
  };

  return (
    <div
      className="min-h-screen w-full relative flex flex-col justify-between font-sans selection:bg-[#97D7FF] selection:text-slate-900 bg-slate-900 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url("${backgroundUrl}")` }}
    >
      {/* Lapisan Gelap Transparan agar Teks & Formulir Mudah Dibaca */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/60 to-slate-950/75 backdrop-blur-[1.5px]" />

      {/* Logo Lengkap Resmi ZoneFlow (Simbol + Tulisan ZoneFlow) di Kiri Atas dengan Background Transparan */}
      <div className="relative z-10 px-6 sm:px-10 pt-6 sm:pt-8">
        <img
          src={fullLogoUrl}
          alt="ZoneFlow"
          className="h-9 sm:h-11 w-auto object-contain select-none drop-shadow-[0_2px_6px_rgba(2,6,23,0.45)]"
        />
      </div>

      {/* Formulir Akses di Tengah Halaman */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-3xl bg-slate-900/55 backdrop-blur-md border border-white/20 shadow-2xl p-7 sm:p-9 text-white flex flex-col items-center">
          {/* Simbol Icon Resmi ZoneFlow (Tanpa Tulisan) di Atas Judul Login */}
          <img
            src={iconLogoUrl}
            alt="Simbol ZoneFlow"
            className="h-11 sm:h-12 w-auto object-contain select-none mb-3.5"
          />

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white text-center mb-6">
            Login
          </h1>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
            {/* Input Nama Pengguna / Tim Evaluasi berbentuk kapsul */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="demo-operator-name"
                className="text-xs font-semibold text-slate-200 pl-4"
              >
                Nama Pengguna / Tim Evaluasi
              </label>
              <div className="relative flex items-center">
                <input
                  id="demo-operator-name"
                  type="text"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  placeholder="Nama pengguna atau tim evaluasi"
                  className="w-full pl-5 pr-11 py-3 rounded-full bg-slate-950/45 border border-white/30 text-xs sm:text-sm text-white placeholder-slate-300/70 focus:outline-none focus:border-[#97D7FF] focus:ring-2 focus:ring-[#97D7FF]/30 transition-all"
                />
                <User className="w-4 h-4 text-[#97D7FF] absolute right-4 pointer-events-none" />
              </div>
            </div>

            {/* Pilihan Unit / Peran Operasional berbentuk kapsul */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="demo-operator-role"
                className="text-xs font-semibold text-slate-200 pl-4"
              >
                Unit / Peran Operasional
              </label>
              <div className="relative flex items-center">
                <select
                  id="demo-operator-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full pl-5 pr-11 py-3 rounded-full bg-slate-950/45 border border-white/30 text-xs sm:text-sm text-white appearance-none focus:outline-none focus:border-[#97D7FF] focus:ring-2 focus:ring-[#97D7FF]/30 transition-all cursor-pointer"
                >
                  <option
                    value="Teknisi & Evaluasi Operasional"
                    className="bg-slate-900 text-white"
                  >
                    Teknisi & Evaluasi Operasional
                  </option>
                  <option
                    value="Petugas Operasional Gate & Boarding"
                    className="bg-slate-900 text-white"
                  >
                    Petugas Operasional Gate & Boarding
                  </option>
                  <option
                    value="Analis Turnaround & Ground Handling"
                    className="bg-slate-900 text-white"
                  >
                    Analis Turnaround & Ground Handling
                  </option>
                  <option
                    value="Peneliti / Penguji Akademik"
                    className="bg-slate-900 text-white"
                  >
                    Peneliti / Penguji Akademik
                  </option>
                </select>
                <Briefcase className="w-4 h-4 text-[#97D7FF] absolute right-4 pointer-events-none" />
              </div>
            </div>

            {/* Tombol Utama Masuk ke Demo */}
            <button
              type="submit"
              className="mt-3 w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-[#086288] to-[#4D8DBA] hover:from-[#064e6d] hover:to-[#3b78a3] text-white font-bold text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-[#086288]/40 border border-[#97D7FF]/30 transition-all cursor-pointer"
            >
              Masuk ke Demo
            </button>
          </form>
        </div>
      </main>

      {/* Ruang Bawah Seimbang Tanpa Menu/Footer Template Eksternal */}
      <div className="relative z-10 h-6" />
    </div>
  );
};
