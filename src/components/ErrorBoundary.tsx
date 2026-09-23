import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  context?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  public componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(
      `[ErrorBoundary:${this.props.context ?? 'App'}] Uncaught render error:`,
      error,
      info.componentStack,
    );
  }

  public render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <main className="flex h-screen w-screen items-center justify-center bg-bg-primary p-6 text-text-primary">
        <section className="max-w-md rounded-2xl border border-border-subtle bg-bg-secondary p-6 text-center shadow-xl">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-400" />
          <h1 className="text-base font-semibold">Natively could not display this window</h1>
          <p className="mt-2 break-words text-xs text-text-secondary">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mx-auto mt-5 flex items-center gap-2 rounded-lg bg-accent-primary px-4 py-2 text-xs font-semibold text-on-accent"
          >
            <RefreshCw className="h-4 w-4" />
            Reload
          </button>
        </section>
      </main>
    );
  }
}

export default ErrorBoundary;
