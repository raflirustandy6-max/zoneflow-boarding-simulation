/**
 * ZoneFlow Simulation Runner Hook
 * Mengatur eksekusi simulasi baik melalui backend Python asli (FastAPI)
 * maupun fallback transparan/eksplisit ke engine TypeScript browser.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  generatePassengers,
  BOARDING_METHOD_BUILDERS,
  simulateBoarding,
  PassengerTimelineDetail,
  SimulationMetrics,
} from "./engine";
import {
  checkBackendHealth,
  runPythonSimulation,
  BackendHealthInfo,
} from "../services/apiClient";

export type EngineMode = "python" | "browser";

export interface SimulationRunnerState {
  selectedEngine: EngineMode;
  activeSource: "python" | "browser";
  isLoading: boolean;
  error: string | null;
  metrics: SimulationMetrics;
  details: PassengerTimelineDetail[];
  detailsBySeat: Record<string, PassengerTimelineDetail>;
  executionTimeMs: number;
  backendOnline: boolean;
  backendInfo: BackendHealthInfo | null;
}

export function useSimulationRunner(
  selectedMethod: string,
  baggageRatio: number,
  seed: number
) {
  const [selectedEngine, setSelectedEngine] = useState<EngineMode>("browser");
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [backendInfo, setBackendInfo] = useState<BackendHealthInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Default initial client calculation
  const initialClientData = () => {
    const rawPassengers = generatePassengers(seed, baggageRatio / 100);
    const builder =
      BOARDING_METHOD_BUILDERS[selectedMethod] ||
      BOARDING_METHOD_BUILDERS["Back-to-Front-WILMA"];
    const ordered = builder(rawPassengers, seed);
    const { metrics, details } = simulateBoarding(ordered, 1.0);
    const detailsBySeat: Record<string, PassengerTimelineDetail> = {};
    details.forEach((d) => {
      detailsBySeat[d.seat_id] = d;
    });
    return { metrics, details, detailsBySeat };
  };

  const [activeSource, setActiveSource] = useState<"python" | "browser">("browser");
  const [metrics, setMetrics] = useState<SimulationMetrics>(() => initialClientData().metrics);
  const [details, setDetails] = useState<PassengerTimelineDetail[]>(() => initialClientData().details);
  const [detailsBySeat, setDetailsBySeat] = useState<Record<string, PassengerTimelineDetail>>(
    () => initialClientData().detailsBySeat
  );
  const [executionTimeMs, setExecutionTimeMs] = useState<number>(0);

  const isMountedRef = useRef(true);

  // 1. On-demand Health Check (tidak dipanggil otomatis saat halaman dibuka di mode Demo Browser)
  const verifyBackend = useCallback(async () => {
    const health = await checkBackendHealth(2500);
    if (!isMountedRef.current) return false;
    setBackendOnline(health.online);
    setBackendInfo(health.info);
    return health.online;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 2. Run simulation whenever parameters or engine mode change
  const executeSimulation = useCallback(async () => {
    setError(null);

    // Mode Utama: Demo Browser (TypeScript Engine lokal tanpa request jaringan)
    if (selectedEngine === "browser") {
      setIsLoading(true);
      const startT = performance.now();
      try {
        const rawPassengers = generatePassengers(seed, baggageRatio / 100);
        const builder =
          BOARDING_METHOD_BUILDERS[selectedMethod] ||
          BOARDING_METHOD_BUILDERS["Back-to-Front-WILMA"];
        const ordered = builder(rawPassengers, seed);
        const { metrics: clientMetrics, details: clientDetails } = simulateBoarding(ordered, 1.0);
        const bySeat: Record<string, PassengerTimelineDetail> = {};
        clientDetails.forEach((d) => {
          bySeat[d.seat_id] = d;
        });

        const elapsed = performance.now() - startT;
        if (!isMountedRef.current) return;
        setMetrics(clientMetrics);
        setDetails(clientDetails);
        setDetailsBySeat(bySeat);
        setActiveSource("browser");
        setExecutionTimeMs(elapsed);
      } catch (err: any) {
        if (!isMountedRef.current) return;
        setError(err.message || "Gagal menjalankan simulasi lokal browser.");
      } finally {
        if (isMountedRef.current) setIsLoading(false);
      }
      return;
    }

    // Jika mode adalah Python Backend Engine
    setIsLoading(true);
    try {
      const response = await runPythonSimulation({
        method: selectedMethod,
        baggage_ratio: baggageRatio / 100,
        seed: seed,
      });

      if (!isMountedRef.current) return;
      if (
        !response ||
        !response.metrics ||
        typeof response.metrics.boarding_time_seconds !== "number" ||
        !Array.isArray(response.timeline_details)
      ) {
        throw new Error("Format respons simulasi dari server tidak valid.");
      }

      const bySeat: Record<string, PassengerTimelineDetail> = {};
      response.timeline_details.forEach((d) => {
        bySeat[d.seat_id] = d;
      });

      setMetrics(response.metrics);
      setDetails(response.timeline_details);
      setDetailsBySeat(bySeat);
      setActiveSource("python");
      setExecutionTimeMs(typeof response.execution_time_ms === "number" ? response.execution_time_ms : 0);
      setBackendOnline(true);
    } catch (pyErr: any) {
      if (!isMountedRef.current) return;
      setBackendOnline(false);
      setError(
        `Backend Python tidak dapat dihubungi: ${pyErr.message || "Koneksi gagal"}. Anda dapat beralih ke Mode Demo Browser.`
      );
      // PENTING: Jangan fallback diam-diam mengklaim Python. Biarkan error terlihat dan sediakan tombol ganti mode.
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [selectedEngine, selectedMethod, baggageRatio, seed]);

  useEffect(() => {
    executeSimulation();
  }, [executeSimulation]);

  return {
    selectedEngine,
    setSelectedEngine,
    activeSource,
    isLoading,
    error,
    metrics,
    details,
    detailsBySeat,
    executionTimeMs,
    backendOnline,
    backendInfo,
    recheckBackend: verifyBackend,
    rerunSimulation: executeSimulation,
  };
}
