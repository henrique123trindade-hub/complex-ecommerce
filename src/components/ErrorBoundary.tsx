import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message || 'Erro inesperado na aplicação.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F1EEE8] text-[#171717] flex items-center justify-center px-6">
          <div className="max-w-md w-full border border-[#171717]/20 p-8 bg-[#F1EEE8]">
            <p className="font-mono-tabular text-[11px] uppercase tracking-[0.14em] text-[#99968F] mb-3">
              COMPLEX / SISTEMA
            </p>
            <h1 className="font-display text-2xl font-bold tracking-tight mb-3">
              Algo interrompeu esta visualização.
            </h1>
            <p className="text-sm text-[#171717]/75 mb-6 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-[#171717] text-[#F1EEE8] text-xs uppercase tracking-[0.12em] font-medium hover:bg-[#171717]/90 transition-colors cursor-pointer"
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
