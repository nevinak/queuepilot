import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ShieldAlert } from 'lucide-react';

export function UnauthorizedPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center rounded-[32px] border border-white/10 bg-slate-900/70 p-10 text-center shadow-2xl shadow-slate-950/20">
      <ShieldAlert className="h-12 w-12 text-amber-300" />
      <h1 className="mt-6 text-3xl font-semibold text-white">401 • Authentication required</h1>
      <p className="mt-3 text-slate-400">Please sign in to access this secure area of QueuePilot.</p>
      <Link to="/login" className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 font-semibold text-slate-950"><ArrowLeft className="h-4 w-4" /> Sign in</Link>
    </div>
  );
}

export function ForbiddenPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center rounded-[32px] border border-white/10 bg-slate-900/70 p-10 text-center shadow-2xl shadow-slate-950/20">
      <AlertTriangle className="h-12 w-12 text-rose-300" />
      <h1 className="mt-6 text-3xl font-semibold text-white">403 • Access denied</h1>
      <p className="mt-3 text-slate-400">You do not have permission to view this section.</p>
      <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 font-semibold text-slate-950"><ArrowLeft className="h-4 w-4" /> Return home</Link>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center rounded-[32px] border border-white/10 bg-slate-900/70 p-10 text-center shadow-2xl shadow-slate-950/20">
      <AlertTriangle className="h-12 w-12 text-slate-300" />
      <h1 className="mt-6 text-3xl font-semibold text-white">404 • Page not found</h1>
      <p className="mt-3 text-slate-400">The page you requested could not be found.</p>
      <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 font-semibold text-slate-950"><ArrowLeft className="h-4 w-4" /> Go back home</Link>
    </div>
  );
}

export function ServerErrorPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center rounded-[32px] border border-white/10 bg-slate-900/70 p-10 text-center shadow-2xl shadow-slate-950/20">
      <AlertTriangle className="h-12 w-12 text-red-300" />
      <h1 className="mt-6 text-3xl font-semibold text-white">500 • Service unavailable</h1>
      <p className="mt-3 text-slate-400">The service is temporarily unavailable. Please try again shortly.</p>
      <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 font-semibold text-slate-950"><ArrowLeft className="h-4 w-4" /> Refresh dashboard</Link>
    </div>
  );
}
