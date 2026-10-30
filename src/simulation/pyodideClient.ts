import type {
  AzboWorkerRequestMessage,
  AzboWorkerResponseMessage,
  AzboWorkerRunPayload,
} from "./azboPyodide.worker";

let sharedWorker: Worker | null = null;
let requestCounter = 0;

function getOrCreateAzboPyodideWorker(): Worker {
  if (typeof Worker === "undefined") {
    throw new Error(
      "Lingkungan saat ini tidak mendukung Web Worker untuk menjalankan Pyodide di browser."
    );
  }
  if (!sharedWorker) {
    sharedWorker = new Worker(
      new URL("./azboPyodide.worker.ts", import.meta.url),
      { type: "module" }
    );
  }
  return sharedWorker;
}

/**
 * Menjalankan mesin Python AZBO V2 (`backend/app/azbo_core.py`) secara langsung
 * di dalam browser menggunakan Pyodide + Web Worker tanpa memerlukan server FastAPI.
 */
export async function runAzboV2InBrowserPyodide(
  payload: AzboWorkerRunPayload,
  onProgress?: (message: string, percent: number) => void
): Promise<Record<string, unknown>> {
  const worker = getOrCreateAzboPyodideWorker();
  const requestId = `azbo-pyodide-${Date.now()}-${++requestCounter}`;
  const baseUrl =
    typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
      ? import.meta.env.BASE_URL
      : "/";

  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const handleMessage = (event: MessageEvent<AzboWorkerResponseMessage>) => {
      const data = event.data;
      if (!data || data.requestId !== requestId) {
        return;
      }

      if (data.type === "PROGRESS") {
        onProgress?.(data.message, data.percent);
        return;
      }

      if (data.type === "RESULT") {
        cleanup();
        resolve(data.result);
        return;
      }

      if (data.type === "ERROR") {
        cleanup();
        reject(new Error(data.error));
      }
    };

    const handleError = (event: ErrorEvent) => {
      cleanup();
      // Reset worker jika mengalami crash fatal (misal kehabisan memori WebAssembly)
      if (sharedWorker === worker) {
        sharedWorker.terminate();
        sharedWorker = null;
      }
      reject(
        new Error(
          event.message ||
            "Gagal memuat atau menjalankan Web Worker simulasi Python (Pyodide) di browser."
        )
      );
    };

    const cleanup = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);

    const requestMessage: AzboWorkerRequestMessage = {
      type: "RUN_AZBO_V2",
      requestId,
      baseUrl,
      payload,
    };
    worker.postMessage(requestMessage);
  });
}
