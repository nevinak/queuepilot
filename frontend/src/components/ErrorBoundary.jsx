import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="rounded-[24px] border border-amber-400/20 bg-slate-900/70 p-8 text-center text-slate-300 shadow-2xl shadow-amber-950/20">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-amber-400/20 bg-amber-500/10 text-amber-200">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold text-white">Something went wrong</h2>
            <p className="mt-2 text-sm text-slate-400">The experience recovered gracefully and the page can be refreshed.</p>
            <button onClick={() => window.location.reload()} className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 font-medium text-slate-950">
              <RotateCcw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
