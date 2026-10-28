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
  runAzboOptimizationForScenario,
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

  // 3. State Konfigurasi Pesawat & Input Manual (Sumber Data Utama dari Menu 1)
  const [selectedLayout, setSelectedLayout] = useState<AircraftLayoutConfig>(
    AIRCRAFT_LAYOUTS[0]
  );
  const [passengerCountInput, setPassengerCountInput] = useState<string>("");
  const [baggageCountInput, setBaggageCountInput] = useState<string>("");

  // Seed deterministik internal untuk konsistensi perbandingan antar-metode
  const seed = BASE_SEED;

  // 4. Hasil Evaluasi & Optimasi AZBO untuk Skenario yang Dijalankan
  const [azboSummary, setAzboSummary] =
    useState<AzboOptimizationSummary | null>(null);
  const [lastEvaluatedScenarioKey, setLastEvaluatedScenarioKey] =
    useState<string>("");

  // Validasi Jumlah Penumpang terhadap Kapasitas Layout Aktif
  const passengerError = useMemo((): string | null => {
    const trimmed = passengerCountInput.trim();
    if (trimmed === "") {
      return `Masukkan jumlah penumpang secara manual (1 hingga ${selectedLayout.capacity} kursi untuk ${selectedLayout.name}).`;
    }
    const num = Number(trimmed);
    if (Number.isNaN(num) || !Number.isInteger(num)) {
      return "Jumlah penumpang harus berupa bilangan bulat.";
    }
    if (num < 0) {
      return "Jumlah penumpang tidak boleh bernilai negatif.";
    }
    if (num === 0) {
      return "Jumlah penumpang saat ini 0 orang. Masukkan minimal 1 penumpang untuk menjalankan simulasi boarding.";
    }
    if (num > selectedLayout.capacity) {
      return `Jumlah penumpang (${num} orang) melebihi kapasitas kursi ${selectedLayout.name} (maksimum ${selectedLayout.capacity} kursi). Silakan kurangi jumlah penumpang.`;
    }
    return null;
  }, [passengerCountInput, selectedLayout]);

  // Validasi Jumlah Penumpang Membawa Bagasi Kabin (Orang)
  const baggageError = useMemo((): string | null => {
    const trimmedBag = baggageCountInput.trim();
    const trimmedPax = passengerCountInput.trim();
    const paxNum = trimmedPax === "" ? NaN : Number(trimmedPax);
    const hasValidPaxCount =
      Number.isInteger(paxNum) &&
      paxNum >= 0 &&
      paxNum <= selectedLayout.capacity;

    if (trimmedBag === "") {
      const maxLabel = hasValidPaxCount ? paxNum : selectedLayout.capacity;
      return `Masukkan jumlah penumpang membawa bagasi kabin secara manual (0 hingga ${maxLabel} orang).`;
    }

    const bagNum = Number(trimmedBag);
    if (Number.isNaN(bagNum) || !Number.isInteger(bagNum)) {
      return "Jumlah penumpang membawa bagasi kabin harus berupa bilangan bulat (orang).";
    }
    if (bagNum < 0) {
      return "Jumlah penumpang membawa bagasi kabin tidak boleh bernilai negatif.";
    }
    if (hasValidPaxCount && bagNum > paxNum) {
      return `Jumlah penumpang membawa bagasi kabin (${bagNum} orang) tidak boleh melebihi jumlah penumpang (${paxNum} orang).`;
    }
    if (!hasValidPaxCount && bagNum > selectedLayout.capacity) {
      return `Jumlah penumpang membawa bagasi kabin (${bagNum} orang) melebihi kapasitas maksimum pesawat (${selectedLayout.capacity} kursi).`;
    }
    return null;
  }, [baggageCountInput, passengerCountInput, selectedLayout]);

  const currentScenarioKey = useMemo(() => {
    return `${selectedLayout.id}|${passengerCountInput.trim()}|${baggageCountInput.trim()}|${seed}`;
  }, [selectedLayout.id, passengerCountInput, baggageCountInput, seed]);

  // Menandai apabila input pada Menu 1 telah diubah setelah evaluasi terakhir dijalankan
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
    // Pertahankan input pengguna dan validasi ulang terhadap kapasitas layout baru
    setSelectedLayout(newLayout);
  };

  const handleRunSimulationAndAzbo = useCallback((): {
    ok: boolean;
    error?: string;
  } => {
    if (passengerError || baggageError) {
      return {
        ok: false,
        error:
          passengerError ||
          baggageError ||
          "Input skenario belum valid untuk dievaluasi.",
      };
    }

    const paxCount = Number(passengerCountInput.trim());
    const bagCount = Number(baggageCountInput.trim());

    if (
      !Number.isInteger(paxCount) ||
      paxCount <= 0 ||
      paxCount > selectedLayout.capacity
    ) {
      return {
        ok: false,
        error: `Jumlah penumpang harus berada pada rentang 1 hingga ${selectedLayout.capacity} orang.`,
      };
    }

    if (!Number.isInteger(bagCount) || bagCount < 0 || bagCount > paxCount) {
      return {
        ok: false,
        error: `Jumlah penumpang membawa bagasi kabin harus berada pada rentang 0 hingga ${paxCount} orang.`,
      };
    }

    try {
      const summary = runAzboOptimizationForScenario({
        layout: selectedLayout,
        passengerCount: paxCount,
        baggagePassengerCount: bagCount,
        seed,
      });
      setAzboSummary(summary);
      setLastEvaluatedScenarioKey(currentScenarioKey);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Gagal menjalankan evaluasi optimasi AZBO.",
      };
    }
  }, [
    passengerError,
    baggageError,
    passengerCountInput,
    baggageCountInput,
    selectedLayout,
    seed,
    currentScenarioKey,
  ]);

  // Tampilkan Halaman Login / Akses Demo terlebih dahulu jika belum masuk sesi demo
  if (!demoSession) {
    return <DemoLoginView onEnterDemo={handleEnterDemo} />;
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-slate-800 flex flex-col font-sans selection:bg-[#97D7FF] selection:text-slate-900">
      {/* Navigasi Kapsul Horizontal di Bagian Atas (Tanpa Header Lama) */}
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
            onChangePassengerCountInput={setPassengerCountInput}
            baggageCountInput={baggageCountInput}
            onChangeBaggageCountInput={setBaggageCountInput}
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
            baggageCountInput={baggageCountInput}
            passengerError={passengerError}
            baggageError={baggageError}
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
            baggageCountInput={baggageCountInput}
            passengerError={passengerError}
            baggageError={baggageError}
            azboSummary={azboSummary}
            isScenarioDirty={isScenarioDirty}
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
