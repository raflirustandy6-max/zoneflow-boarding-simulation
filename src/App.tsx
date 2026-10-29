/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from "react";
import { Sidebar, NavTab } from "./components/Sidebar";
import { InfoModal } from "./components/InfoModal";
import { DemoLoginView, DemoSessionInfo } from "./components/DemoLoginView";
import { AircraftLayoutView } from "./views/AircraftLayoutView";
import { SimulationView } from "./views/SimulationView";
import { AzboResultsView } from "./views/AzboResultsView";
import {
  AIRCRAFT_LAYOUTS,
  AircraftLayoutConfig,
  BASE_SEED,
  AzboOptimizationSummary,
  computeDeterministicBaggageCount,
  runAzboV2EvaluationViaBackend,
} from "./simulation/engine";

const DEMO_SESSION_STORAGE_KEY = "zoneflow_demo_session_v3";

export default function App() {
  // 1. State Sesi Login / Akses Demo
  const [demoSession, setDemoSession] = useState<DemoSessionInfo | null>(() => {
    try {
      const saved = window.sessionStorage.getItem(DEMO_SESSION_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as DemoSessionInfo) : null;
    } catch {
      return null;
    }
  });

  // 2. Navigasi 3 Menu Utama: "aircraft" | "simulation" | "results"
  const [activeTab, setActiveTab] = useState<NavTab>("aircraft");
  const [isInfoModalOpen, setIsInfoModalOpen] = useState<boolean>(false);

  // 3. State Konfigurasi Pesawat & Persentase Bagasi (Sesuai Blueprint AZBO: 100% Kursi Terisi)
  const [selectedLayout, setSelectedLayout] = useState<AircraftLayoutConfig>(
    AIRCRAFT_LAYOUTS[0]
  );
  // Persentase penumpang membawa bagasi kabin (0 - 100%), default 70%
  const [baggagePercentInput, setBaggagePercentInput] = useState<string>("70");

  // Jumlah penumpang otomatis mengikuti kapasitas layout (100% kursi terisi)
  const passengerCountInput = String(selectedLayout.capacity);

  // Seed deterministik internal untuk reproduksibilitas
  const seed = BASE_SEED;

  // 4. Hasil Evaluasi & Optimasi AZBO V2 dari Backend Python
  const [azboSummary, setAzboSummary] =
    useState<AzboOptimizationSummary | null>(null);
  const [lastEvaluatedScenarioKey, setLastEvaluatedScenarioKey] =
    useState<string>("");
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evaluationProgressMessage, setEvaluationProgressMessage] =
    useState<string>("");
  const [evaluationProgressPercent, setEvaluationProgressPercent] =
    useState<number>(0);

  // Validasi Persentase Penumpang Membawa Bagasi (0% hingga 100%)
  const baggageError = useMemo((): string | null => {
    const trimmed = baggagePercentInput.trim();
    if (trimmed === "") {
      return "Masukkan persentase penumpang yang membawa bagasi kabin (0% hingga 100%).";
    }
    const pct = Number(trimmed);
    if (Number.isNaN(pct)) {
      return "Persentase penumpang membawa bagasi harus berupa angka (0 hingga 100).";
    }
    if (pct < 0) {
      return "Persentase penumpang membawa bagasi tidak boleh kurang dari 0%.";
    }
    if (pct > 100) {
      return "Persentase penumpang membawa bagasi tidak boleh melebihi 100%.";
    }
    return null;
  }, [baggagePercentInput]);

  // Jumlah penumpang otomatis 100% terisi sehingga selalu valid
  const passengerError: string | null = null;

  // Jumlah orang yang membawa bagasi dihitung secara otomatis: floor(n * (pct/100) + 0.5)
  const computedBaggagePassengerCount = useMemo((): number => {
    if (baggageError) return 0;
    const pct = Number(baggagePercentInput.trim());
    return computeDeterministicBaggageCount(selectedLayout.capacity, pct);
  }, [baggagePercentInput, baggageError, selectedLayout.capacity]);

  const baggageCountInput = String(computedBaggagePassengerCount);

  const currentScenarioKey = useMemo(() => {
    return `${selectedLayout.id}|${selectedLayout.capacity}|${baggagePercentInput.trim()}|${seed}`;
  }, [selectedLayout.id, selectedLayout.capacity, baggagePercentInput, seed]);

  // Menandai apabila pilihan pesawat atau persentase bagasi pada Menu 1 diubah setelah evaluasi terakhir
  const isScenarioDirty =
    azboSummary !== null && lastEvaluatedScenarioKey !== currentScenarioKey;

  const handleEnterDemo = (session: DemoSessionInfo) => {
    setDemoSession(session);
    try {
      window.sessionStorage.setItem(
        DEMO_SESSION_STORAGE_KEY,
        JSON.stringify(session)
      );
    } catch {
      // Abaikan jika sessionStorage dibatasi
    }
  };

  const handleExitDemo = () => {
    setDemoSession(null);
    try {
      window.sessionStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
    } catch {
      // Abaikan
    }
  };

  const handleSelectLayout = (newLayout: AircraftLayoutConfig) => {
    setSelectedLayout(newLayout);
  };

  const handleRunSimulationAndAzbo = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
  }> => {
    if (baggageError) {
      return {
        ok: false,
        error: baggageError,
      };
    }

    const bagPct = Number(baggagePercentInput.trim());
    if (!Number.isFinite(bagPct) || bagPct < 0 || bagPct > 100) {
      return {
        ok: false,
        error: "Persentase penumpang membawa bagasi harus berada pada rentang 0% hingga 100%.",
      };
    }

    setIsEvaluating(true);
    setEvaluationProgressMessage("Menghubungi server simulasi...");
    setEvaluationProgressPercent(5);

    try {
      const summary = await runAzboV2EvaluationViaBackend({
        layout: selectedLayout,
        baggagePercent: bagPct,
        seed,
        onProgress: (msg, pct) => {
          setEvaluationProgressMessage(msg);
          setEvaluationProgressPercent(pct);
        },
      });
      setAzboSummary(summary);
      setLastEvaluatedScenarioKey(currentScenarioKey);
      setIsEvaluating(false);
      return { ok: true };
    } catch (err) {
      setIsEvaluating(false);
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Gagal menjalankan simulasi boarding pada server.",
      };
    }
  }, [baggageError, baggagePercentInput, selectedLayout, seed, currentScenarioKey]);

  // Tampilkan Halaman Login / Akses Demo terlebih dahulu jika belum masuk sesi demo
  if (!demoSession) {
    return <DemoLoginView onEnterDemo={handleEnterDemo} />;
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-slate-800 flex flex-col font-sans selection:bg-[#97D7FF] selection:text-slate-900">
      {/* Navigasi Kapsul Horizontal di Bagian Atas */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        selectedLayout={selectedLayout}
        passengerCountInput={passengerCountInput}
        baggageCountInput={baggageCountInput}
        hasSimulationResult={azboSummary !== null && !isScenarioDirty}
        operatorName={demoSession.operatorName}
        onOpenInfoModal={() => setIsInfoModalOpen(true)}
        onExitDemo={handleExitDemo}
      />

      {/* Area Konten Utama */}
      <main className="flex-1 pb-16">
        {activeTab === "aircraft" && (
          <AircraftLayoutView
            selectedLayout={selectedLayout}
            onSelectLayout={handleSelectLayout}
            passengerCountInput={passengerCountInput}
            baggagePercentInput={baggagePercentInput}
            onChangeBaggagePercentInput={setBaggagePercentInput}
            computedBaggageCount={computedBaggagePassengerCount}
            passengerError={passengerError}
            baggageError={baggageError}
            onProceedToSimulation={() => {
              setActiveTab("simulation");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}

        {activeTab === "simulation" && (
          <SimulationView
            selectedLayout={selectedLayout}
            passengerCountInput={passengerCountInput}
            baggagePercentInput={baggagePercentInput}
            computedBaggageCount={computedBaggagePassengerCount}
            passengerError={passengerError}
            baggageError={baggageError}
            isEvaluating={isEvaluating}
            evaluationProgressMessage={evaluationProgressMessage}
            evaluationProgressPercent={evaluationProgressPercent}
            onRunSimulationAndAzbo={handleRunSimulationAndAzbo}
            onNavigateToResults={() => {
              setActiveTab("results");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onBackToAircraftLayout={() => {
              setActiveTab("aircraft");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}

        {activeTab === "results" && (
          <AzboResultsView
            selectedLayout={selectedLayout}
            passengerCountInput={passengerCountInput}
            baggagePercentInput={baggagePercentInput}
            computedBaggageCount={computedBaggagePassengerCount}
            passengerError={passengerError}
            baggageError={baggageError}
            azboSummary={azboSummary}
            isScenarioDirty={isScenarioDirty}
            isEvaluating={isEvaluating}
            evaluationProgressMessage={evaluationProgressMessage}
            evaluationProgressPercent={evaluationProgressPercent}
            onRunAzboEvaluation={handleRunSimulationAndAzbo}
            onGoToAircraftLayout={() => {
              setActiveTab("aircraft");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}
      </main>

      {/* Modal Integritas Sumber Data & Batasan Ilmiah */}
      <InfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
      />
    </div>
  );
}

