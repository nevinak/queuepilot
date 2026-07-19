import { motion } from 'framer-motion';

export function LoadingSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-4 rounded-[24px] border border-white/10 bg-white/10 p-6 shadow-2xl shadow-slate-950/20 backdrop-blur">
      {Array.from({ length: rows }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: [0.5, 0.9, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.2, delay: index * 0.1 }}
          className="h-16 rounded-2xl bg-gradient-to-r from-slate-700/70 via-slate-600/50 to-slate-700/70"
        />
      ))}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="rounded-[24px] border border-emerald-400/20 bg-slate-900/70 p-8 text-center text-slate-300 shadow-2xl shadow-emerald-950/20">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-400/30 border-t-emerald-400" />
        <p className="text-lg font-semibold text-white">Preparing your healthcare workspace…</p>
      </div>
    </div>
  );
}
