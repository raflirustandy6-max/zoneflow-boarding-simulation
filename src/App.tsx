/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Sidebar, NavTab } from "./components/Sidebar";
import { Header } from "./components/Header";
import { InfoModal } from "./components/InfoModal";
import { DashboardView } from "./views/DashboardView";
import { SimulationView } from "./views/SimulationView";
import { ResultsView } from "./views/ResultsView";
import { BaggageAnalysisView } from "./views/BaggageAnalysisView";
import { MethodologyView } from "./views/MethodologyView";
import { AboutView } from "./views/AboutView";

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [selectedBaggage, setSelectedBaggage] = useState<number>(60); // Default 60%
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-slate-800 flex flex-col lg:flex-row font-sans selection:bg-[#97D7FF] selection:text-slate-900">
      {/* Sleek Vertical Dark Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          activeTab={activeTab}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          selectedBaggage={selectedBaggage}
          onSelectBaggage={setSelectedBaggage}
          onOpenInfoModal={() => setIsInfoModalOpen(true)}
        />

        <main className="flex-1 pb-16">
          {activeTab === "dashboard" && (
            <DashboardView
              selectedBaggage={selectedBaggage}
              onNavigate={(tab) => {
                setActiveTab(tab);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              onSelectBaggage={setSelectedBaggage}
            />
          )}

          {activeTab === "simulation" && (
            <SimulationView initialBaggage={selectedBaggage} />
          )}

          {activeTab === "results" && <ResultsView />}

          {activeTab === "baggage" && <BaggageAnalysisView />}

          {activeTab === "methodology" && <MethodologyView />}

          {activeTab === "about" && <AboutView />}
        </main>
      </div>

      {/* Scientific Integrity / Disclaimer Modal */}
      <InfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
      />
    </div>
  );
}
