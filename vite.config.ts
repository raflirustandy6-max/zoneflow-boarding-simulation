import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {spawn} from 'child_process';
import fs from 'fs';
import net from 'net';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig, loadEnv, Plugin} from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const GITHUB_PAGES_BASE = '/zoneflow-boarding-simulation/';

function ensurePyodidePublicAssets(): void {
  const srcDir = path.resolve(rootDir, 'node_modules/pyodide');
  const destDir = path.resolve(rootDir, 'public/pyodide');
  const requiredFiles = [
    'pyodide.mjs',
    'pyodide.js',
    'pyodide.asm.js',
    'pyodide.asm.wasm',
    'python_stdlib.zip',
    'pyodide-lock.json',
    'package.json',
  ];

  if (!fs.existsSync(srcDir)) {
    return;
  }

  fs.mkdirSync(destDir, {recursive: true});
  for (const fileName of requiredFiles) {
    const srcFile = path.join(srcDir, fileName);
    const destFile = path.join(destDir, fileName);
    if (fs.existsSync(srcFile) && !fs.existsSync(destFile)) {
      fs.copyFileSync(srcFile, destFile);
    }
  }
}

function ensurePythonBackendRunning(port = 8001): void {
  const socket = new net.Socket();
  socket.setTimeout(400);
  socket.once('connect', () => {
    socket.destroy();
  });
  const launch = () => {
    socket.destroy();
    try {
      const child = spawn('python3', ['backend/run_server.py'], {
        cwd: rootDir,
        detached: true,
        stdio: 'ignore',
        env: {...process.env, ZONEFLOW_BACKEND_PORT: String(port)},
      });
      child.unref();
    } catch {
      // Ignore spawn errors if python3 is managed externally
    }
  };
  socket.once('error', launch);
  socket.once('timeout', launch);
  socket.connect(port, '127.0.0.1');
}

function zoneflowDualArchitecturePlugin(): Plugin {
  return {
    name: 'zoneflow-dual-architecture-plugin',
    buildStart() {
      ensurePyodidePublicAssets();
    },
    closeBundle() {
      const aistudioAttachmentsInDist = path.resolve(rootDir, 'dist/assets/aistudio');
      if (fs.existsSync(aistudioAttachmentsInDist)) {
        fs.rmSync(aistudioAttachmentsInDist, {recursive: true, force: true});
      }
    },
    configureServer(server) {
      ensurePyodidePublicAssets();
      ensurePythonBackendRunning(8001);
      server.middlewares.use((req, _res, next) => {
        if (req.url === '/' || req.url === '/index.html') {
          req.url = GITHUB_PAGES_BASE;
        }
        next();
      });
    },
    configurePreviewServer(server) {
      ensurePyodidePublicAssets();
      ensurePythonBackendRunning(8001);
      server.middlewares.use((req, _res, next) => {
        if (req.url === '/' || req.url === '/index.html') {
          req.url = GITHUB_PAGES_BASE;
        }
        next();
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const backendProxyTarget =
    env.VITE_BACKEND_PROXY_TARGET ||
    process.env.VITE_BACKEND_PROXY_TARGET ||
    'http://127.0.0.1:8001';

  return {
    base: GITHUB_PAGES_BASE,
    plugins: [react(), tailwindcss(), zoneflowDualArchitecturePlugin()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    worker: {
      format: 'es',
    },
    server: {
      proxy: {
        '/api': {
          target: backendProxyTarget,
          changeOrigin: true,
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      proxy: {
        '/api': {
          target: backendProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});


