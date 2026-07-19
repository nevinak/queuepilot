import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function AnalyticsPanel({ metrics, config }) {
  const data = [
    { name: 'Today', value: metrics?.todayPatients ?? 0 },
    { name: 'Waiting', value: metrics?.waitingPatients ?? 0 },
    { name: 'Complete', value: metrics?.completedConsultations ?? 0 },
    { name: 'Cancelled', value: metrics?.cancelledPatients ?? 0 },
  ];

  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-white">Analytics snapshot</div>
          <div className="text-sm text-slate-400">Queue volume and operational efficiency for the day</div>
        </div>
        <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-200">EMA {config?.averageConsultationTime ?? 8}m</div>
      </div>
      <div className="mt-5 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Bar dataKey="value" fill="#34d399" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
