import { useState } from 'react';
import { Bell, Moon, ShieldCheck, Sparkles, SunMedium, UserCircle2 } from 'lucide-react';

export function SettingsPanel({ user }) {
  const [theme, setTheme] = useState('dark');
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="rounded-[32px] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/20">
      <div className="flex items-center gap-2 text-lg font-semibold text-white">
        <ShieldCheck className="h-5 w-5 text-emerald-300" /> Settings and preferences
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-emerald-200"><UserCircle2 className="h-4 w-4" /> Profile</div>
          <p className="mt-2 text-sm text-slate-400">{user?.fullName || 'Signed in user'}</p>
          <p className="mt-1 text-sm text-slate-400">Manage your account preferences and security settings.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-emerald-200"><Bell className="h-4 w-4" /> Notifications</div>
          <label className="mt-3 flex items-center justify-between text-sm text-slate-300">
            <span>Queue alerts</span>
            <input type="checkbox" checked={notifications} onChange={() => setNotifications((value) => !value)} className="h-4 w-4 rounded border-white/10 bg-slate-950" />
          </label>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-emerald-200"><Sparkles className="h-4 w-4" /> Consultation defaults</div>
          <p className="mt-2 text-sm text-slate-400">Default consultation duration and queue automation remain configurable for receptionists.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-emerald-200"><Moon className="h-4 w-4" /> Theme</div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => setTheme('dark')} className={`rounded-full px-3 py-2 text-sm ${theme === 'dark' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-slate-300'}`}>
              <Moon className="mr-2 inline h-4 w-4" /> Dark
            </button>
            <button onClick={() => setTheme('light')} className={`rounded-full px-3 py-2 text-sm ${theme === 'light' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-slate-300'}`}>
              <SunMedium className="mr-2 inline h-4 w-4" /> Light
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
