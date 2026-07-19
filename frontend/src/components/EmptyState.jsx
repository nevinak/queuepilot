import { Sparkles } from 'lucide-react';

export function EmptyState({ title, description }) {
  return (
    <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 p-8 text-center text-slate-400">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/10 text-emerald-200">
        <Sparkles className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm">{description}</p>
    </div>
  );
}
