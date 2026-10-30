import { loadPyodide, type PyodideInterface } from "pyodide";
import azboCorePythonSource from "../../backend/app/azbo_core.py?raw";

export interface AzboWorkerRunPayload {
  layout_id: string;
  layout_name: string;
  rows: number;
  left_seats: number;
  right_seats: number;
  left_letters: string[];
  right_letters: string[];
  row_pitch_m: number;
  cell_m: number;
  bag_ratio: number;
  ga_population: number;
  ga_generations: number;
  train_reps: number;
  test_reps: number;
  seed: number;
  dt?: number;
  zone_call_overhead_s: number;
}

export interface AzboWorkerRequestMessage {
  type: "RUN_AZBO_V2";
  requestId: string;
  baseUrl?: string;
  payload: AzboWorkerRunPayload;
}

export type AzboWorkerResponseMessage =
  | {
      type: "PROGRESS";
      requestId: string;
      message: string;
      percent: number;
    }
  | {
      type: "RESULT";
      requestId: string;
      result: Record<string, unknown>;
    }
  | {
      type: "ERROR";
      requestId: string;
      error: string;
    };

const PYODIDE_VERSION = "0.27.8";
const PYODIDE_CDN_FALLBACK_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

const PYTHON_BRIDGE_BOOTSTRAP = `
import json
import sys

if "/home/pyodide" not in sys.path:
    sys.path.insert(0, "/home/pyodide")

import azbo_core

def run_zoneflow_azbo_v2_from_json(payload_json: str, progress_cb=None) -> str:
    req = json.loads(payload_json)
    cabin = azbo_core.CabinSpec(
        layout_id=str(req["layout_id"]),
        layout_name=str(req["layout_name"]),
        rows=int(req["rows"]),
        left_seats=int(req["left_seats"]),
        right_seats=int(req["right_seats"]),
        left_letters=tuple(req.get("left_letters") or ()),
        right_letters=tuple(req.get("right_letters") or ()),
        row_pitch_m=float(req.get("row_pitch_m", 0.8)),
        cell_m=float(req.get("cell_m", 0.4)),
    )

    def _cb(msg: str, pct: float) -> None:
        if progress_cb is not None:
            progress_cb(str(msg), float(pct))

    result = azbo_core.run_azbo_v2_evaluation(
        cabin=cabin,
        bag_ratio=float(req["bag_ratio"]),
        ga_population=int(req.get("ga_population", 14)),
        ga_generations=int(req.get("ga_generations", 8)),
        train_reps=int(req.get("train_reps", 3)),
        test_reps=int(req.get("test_reps", 20)),
        seed=int(req.get("seed", 20261028)),
        dt=float(req.get("dt", 0.25)),
        zone_call_overhead_s=float(req.get("zone_call_overhead_s", 0.0)),
        progress_callback=_cb,
    )
    return json.dumps(result)
`;

let pyodideInstancePromise: Promise<PyodideInterface> | null = null;

function resolveLocalPyodideIndexUrl(baseUrl?: string): string {
  const origin = self.location?.origin || "";
  const rawBase = baseUrl || import.meta.env.BASE_URL || "/";
  const normalizedBase = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;
  if (origin && normalizedBase.startsWith("/")) {
    return `${origin}${normalizedBase}pyodide/`;
  }
  return `${normalizedBase}pyodide/`;
}

async function initPyodideEngine(baseUrl?: string): Promise<PyodideInterface> {
  if (pyodideInstancePromise) {
    return pyodideInstancePromise;
  }

  pyodideInstancePromise = (async () => {
    const localIndexUrl = resolveLocalPyodideIndexUrl(baseUrl);
    let pyodide: PyodideInterface;

    try {
      pyodide = await loadPyodide({
        indexURL: localIndexUrl,
      });
    } catch {
      // Fallback ke CDN resmi Pyodide versi stabil yang sama jika aset statis lokal gagal dimuat
      pyodide = await loadPyodide({
        indexURL: PYODIDE_CDN_FALLBACK_URL,
      });
    }

    pyodide.FS.writeFile("/home/pyodide/azbo_core.py", azboCorePythonSource);
    await pyodide.runPythonAsync(PYTHON_BRIDGE_BOOTSTRAP);
    return pyodide;
  })().catch((err) => {
    pyodideInstancePromise = null;
    throw err;
  });

  return pyodideInstancePromise;
}

function formatStageProgressMessage(rawMessage: string): string {
  if (rawMessage.includes("Mencari pembagian zona")) {
    return "Menjalankan Genetic Algorithm: memeriksa cakupan zona K = 1..N...";
  }
  if (rawMessage.includes("Mengoptimalkan konfigurasi zona")) {
    return rawMessage.replace(
      "Mengoptimalkan konfigurasi zona boarding",
      "Menjalankan Genetic Algorithm"
    );
  }
  if (rawMessage.includes("Menguji perbandingan")) {
    return rawMessage.replace(
      "Menguji perbandingan",
      "Membandingkan"
    );
  }
  if (rawMessage.includes("Selesai menyusun")) {
    return "Menyelesaikan hasil simulasi dan menyusun animasi kabin...";
  }
  return rawMessage;
}

self.addEventListener("message", async (event: MessageEvent<AzboWorkerRequestMessage>) => {
  const data = event.data;
  if (!data || data.type !== "RUN_AZBO_V2") {
    return;
  }

  const { requestId, baseUrl, payload } = data;

  const postProgress = (message: string, percent: number) => {
    const msg: AzboWorkerResponseMessage = {
      type: "PROGRESS",
      requestId,
      message,
      percent,
    };
    self.postMessage(msg);
  };

  try {
    postProgress("Menyiapkan mesin simulasi Python di browser...", 5);
    const pyodide = await initPyodideEngine(baseUrl);

    postProgress("Menjalankan Genetic Algorithm & memeriksa cakupan zona...", 10);

    const runFn = pyodide.globals.get("run_zoneflow_azbo_v2_from_json");
    if (!runFn) {
      throw new Error(
        "Fungsi evaluasi Python AZBO V2 tidak ditemukan di dalam lingkungan Pyodide."
      );
    }

    const payloadJson = JSON.stringify(payload);
    const progressBridge = (msg: string, pct: number) => {
      postProgress(formatStageProgressMessage(String(msg)), Number(pct));
    };

    let resultJsonStr: string;
    try {
      resultJsonStr = String(runFn(payloadJson, progressBridge));
    } finally {
      if (typeof runFn.destroy === "function") {
        runFn.destroy();
      }
    }

    postProgress("Menyelesaikan hasil simulasi dan rekomendasi boarding...", 100);
    const parsedResult = JSON.parse(resultJsonStr) as Record<string, unknown>;

    const responseMsg: AzboWorkerResponseMessage = {
      type: "RESULT",
      requestId,
      result: parsedResult,
    };
    self.postMessage(responseMsg);
  } catch (err) {
    const rawErrMessage =
      err instanceof Error ? err.message : String(err || "Kesalahan tidak diketahui");

    let friendlyError =
      "Simulasi Python di browser mengalami kendala saat memproses perhitungan.";
    if (
      rawErrMessage.toLowerCase().includes("memory") ||
      rawErrMessage.toLowerCase().includes("out of bounds")
    ) {
      friendlyError =
        "Memori browser tidak mencukupi untuk menyelesaikan seluruh replikasi simulasi. Silakan tutup tab lain yang berat atau kurangi jumlah replikasi pengujian.";
    } else if (
      rawErrMessage.toLowerCase().includes("pyodide") ||
      rawErrMessage.toLowerCase().includes("fetch") ||
      rawErrMessage.toLowerCase().includes("wasm")
    ) {
      friendlyError = `Gagal memuat mesin simulasi Python (Pyodide WebAssembly) di browser: ${rawErrMessage}`;
    } else {
      friendlyError = `Gagal menjalankan simulasi AZBO V2 di browser: ${rawErrMessage}`;
    }

    const errorMsg: AzboWorkerResponseMessage = {
      type: "ERROR",
      requestId,
      error: friendlyError,
    };
    self.postMessage(errorMsg);
  }
});
