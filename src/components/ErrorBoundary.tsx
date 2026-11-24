import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Terjadi kesalahan yang tidak terduga.',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#fcfbf8] px-6 text-[#111110]">
          <div className="max-w-md border border-[#e2ded5] bg-white p-8">
            <p className="m-0 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[#c86d1f]">
              Gangguan Aplikasi
            </p>
            <h1 className="mb-3 mt-2 font-serif text-2xl font-bold uppercase">
              Gagal Memuat Halaman
            </h1>
            <p className="mb-6 mt-0 text-sm leading-relaxed text-[#5c5b55]">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="border-0 bg-[#111110] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-white"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
