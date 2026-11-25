// Doctor / admin panel. Talks only to our own backend (server/), with a real
// login session — the old version trusted a localStorage flag and a password
// written in the page's own source code.
import React, { useEffect, useState } from 'react';
import { LogOut, Activity, Users, Inbox as InboxIcon, Newspaper, Video, Settings as SettingsIcon, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api, poll } from '../lib/api';
import { Logo } from './Logo';
import Overview from './admin/Overview';
import { PatientList, PatientDetail } from './admin/Patients';
import Inbox from './admin/Inbox';
import ContentManager from './admin/Content';
import Settings from './admin/Settings';
import { cn } from '../lib/utils';

type Tab = 'overview' | 'patients' | 'inbox' | 'news' | 'videos' | 'settings';
const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'overview', label: 'Umumiy', icon: Activity },
  { id: 'patients', label: 'Bemorlar', icon: Users },
  { id: 'inbox', label: 'Xabarlar', icon: InboxIcon },
  { id: 'news', label: 'Yangiliklar', icon: Newspaper },
  { id: 'videos', label: 'Video darslar', icon: Video },
  { id: 'settings', label: 'Sozlamalar', icon: SettingsIcon },
];
const TITLES: Record<Tab, string> = {
  overview: 'Umumiy statistika', patients: 'Bemorlar', inbox: "Xabarlar va so'rovlar",
  news: 'Yangiliklar', videos: 'Video darslar', settings: 'Sozlamalar',
};

export default function AdminPanel() {
  const { staff, logoutStaff } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>(() => {
    try { return (sessionStorage.getItem('bigus_admin_tab') as Tab) || 'overview'; } catch { return 'overview'; }
  });
  const [patientId, setPatientId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [badge, setBadge] = useState(0);

  useEffect(() => { try { sessionStorage.setItem('bigus_admin_tab', tab); } catch { /* ignore */ } }, [tab]);
  useEffect(() => {
    const load = () => api('/api/admin/overview').then(d => setBadge(d.newReports + d.pendingRedemptions)).catch(() => {});
    load();
    return poll(load, 30_000);
  }, []);

  const scrollTop = () => document.getElementById('admin-main')?.scrollTo({ top: 0 });
  const go = (t: string) => { setTab(t as Tab); setPatientId(null); scrollTop(); };
  const openPatient = (id: string) => { setTab('patients'); setPatientId(id); scrollTop(); };
  const logout = async () => { await logoutStaff(); navigate('/admin/login'); };

  return (
    <div className="flex h-[100dvh] bg-[#0B1120] text-white overflow-hidden font-sans">
      <aside className="hidden md:flex w-64 shrink-0 flex-col justify-between border-r border-white/10 bg-[#0B1120]">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-10">
            <Logo className="w-11 h-11 rounded-2xl" />
            <div>
              <h1 className="text-xl font-black tracking-tight">BIGUS</h1>
              <p className="text-[10px] text-cyan-400 font-bold tracking-widest uppercase">Shifokor paneli</p>
            </div>
          </div>
          <nav className="space-y-1.5">
            {TABS.map(t => (
              <button key={t.id} onClick={() => go(t.id)} className={cn('w-full flex items-center gap-3 font-bold px-4 py-3 rounded-2xl transition-all text-sm',
                tab === t.id ? 'text-cyan-300 bg-cyan-400/10 border border-cyan-400/20' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent')}>
                <t.icon className="w-5 h-5" /> {t.label}
                {t.id === 'inbox' && badge > 0 && <span className="ml-auto min-w-[22px] h-[22px] px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-black flex items-center justify-center">{badge}</span>}
              </button>
            ))}
          </nav>
        </div>
        <div className="p-6 space-y-3">
          <div className="px-1">
            <p className="text-sm font-bold text-white truncate">{staff?.name}</p>
            <p className="text-[11px] text-zinc-500 truncate">{staff?.email}</p>
          </div>
          <button onClick={logout} className="w-full p-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm">
            <LogOut className="w-4 h-4" /> Chiqish
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden flex items-center gap-2 px-3 py-3 border-b border-white/10 overflow-x-auto shrink-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => go(t.id)} className={cn('relative shrink-0 px-3.5 py-2 rounded-full text-xs font-bold',
              tab === t.id ? 'text-cyan-300 bg-cyan-400/10 border border-cyan-400/20' : 'text-zinc-400 bg-white/5 border border-transparent')}>
              {t.label}
              {t.id === 'inbox' && badge > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[9px] font-black flex items-center justify-center">{badge}</span>}
            </button>
          ))}
          <button onClick={logout} className="shrink-0 p-2 rounded-full bg-red-500/10 text-red-400" aria-label="Chiqish"><LogOut className="w-4 h-4" /></button>
        </div>

        <header className="px-4 md:px-10 py-4 md:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 shrink-0">
          <h2 className="text-xl md:text-2xl font-black tracking-tight">{TITLES[tab]}</h2>
          {tab !== 'settings' && (
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input value={search} onChange={e => { setSearch(e.target.value); if (e.target.value) { setTab('patients'); setPatientId(null); } }}
                placeholder="Bemorni qidirish..." className="w-full bg-white/5 border border-white/10 focus:border-cyan-500/50 rounded-full py-2.5 pl-11 pr-4 text-sm outline-none placeholder-zinc-500" />
            </div>
          )}
        </header>

        <main id="admin-main" className="flex-1 overflow-y-auto p-4 md:p-10" data-lenis-prevent>
          {tab === 'overview' && <Overview openPatient={openPatient} goTo={go} />}
          {tab === 'patients' && (patientId
            ? <PatientDetail id={patientId} onBack={() => setPatientId(null)} onDeleted={() => setPatientId(null)} />
            : <PatientList openPatient={openPatient} search={search} />)}
          {tab === 'inbox' && <Inbox openPatient={openPatient} />}
          {tab === 'news' && <ContentManager kind="news" />}
          {tab === 'videos' && <ContentManager kind="videos" />}
          {tab === 'settings' && <Settings staff={staff} />}
        </main>
      </div>
    </div>
  );
}
