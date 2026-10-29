import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {spawn} from 'child_process';
import net from 'net';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig, loadEnv, Plugin} from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

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

function zoneflowPythonBackendPlugin(): Plugin {
  return {
    name: 'zoneflow-python-backend-autostart',
    configureServer() {
      ensurePythonBackendRunning(8001);
    },
    configurePreviewServer() {
      ensurePythonBackendRunning(8001);
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const backendProxyTarget = env.VITE_BACKEND_PROXY_TARGET || process.env.VITE_BACKEND_PROXY_TARGET || 'http://127.0.0.1:8001';

  return {
    base: './',
    plugins: [react(), tailwindcss(), zoneflowPythonBackendPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
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

