import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class RootErrorBoundary extends React.Component<{children: React.ReactNode}, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    console.error('ZoneFlow runtime render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F4F7FB] text-slate-800 flex items-center justify-center p-6 font-sans">
          <div className="max-w-lg w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full w-fit">
              Pemulihan Antarmuka ZoneFlow
            </span>
            <h1 className="text-xl font-bold text-slate-900">
              Terjadi kesalahan saat memuat tampilan
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed font-mono bg-slate-50 p-3 rounded-xl border border-slate-200 break-words">
              {this.state.errorMessage || 'Unknown runtime error'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.reload();
              }}
              className="px-5 py-2.5 rounded-xl bg-[#086288] hover:bg-[#064e6d] text-white text-xs font-semibold w-fit transition-colors"
            >
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  );
}
