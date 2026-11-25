import React, { useEffect, useState } from 'react';
import { Users, Activity, HeartPulse, Send, MessageSquareWarning, Gift, Newspaper, Video, AlertTriangle } from 'lucide-react';
import { api, poll } from '../../lib/api';
import { Card, Stat, Empty, SEVERITY, rateColor, relTime, fmtDate } from './ui';
import { cn } from '../../lib/utils';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const UZ_MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
const dayLabel = (iso: string) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${UZ_MONTHS[m - 1]}`; };

function TrendCard({ trend }: { trend: { date: string, rate: number | null, expected: number, taken: number }[] }) {
  const data = trend.map(d => ({ ...d, label: dayLabel(d.date) }));
  const withData = data.filter(d => d.rate !== null);
  const totalExp = data.reduce((s, d) => s + d.expected, 0), totalTaken = data.reduce((s, d) => s + d.taken, 0);
  const avg = totalExp ? Math.round((totalTaken / totalExp) * 100) : null;
  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h3 className="text-lg font-black text-white">Klinika bo'yicha qat'iyat — 14 kun</h3>
          <p className="text-sm text-slate-400 mt-0.5">Har kuni ichilishi kerak bo'lgan dozalardan nechtasi ichilgani (barcha bemorlar)</p>
        </div>
        <div className="flex gap-5 text-right">
          <div><p className="text-xs text-slate-400 font-semibold">O'rtacha</p><p className={cn('text-2xl font-black', avg === null ? 'text-slate-500' : rateColor(avg))}>{avg === null ? '—' : `${avg}%`}</p></div>
          <div><p className="text-xs text-slate-400 font-semibold">Ichilgan dozalar</p><p className="text-2xl font-black text-white tabular-nums">{totalTaken}<span className="text-slate-500 text-base">/{totalExp}</span></p></div>
        </div>
      </div>
      {withData.length === 0 ? (
        <Empty>So'nggi 14 kunda hali dozalar vaqti kelmagan</Empty>
      ) : (
        <div className="h-56 md:h-64 -ml-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
              <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={36} unit="%" />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, color: '#fff' }}
                formatter={(v: any, _n: any, item: any) => [v === null ? '—' : `${v}% (${item.payload.taken}/${item.payload.expected})`, "Qat'iyat"]}
              />
              <Area type="monotone" dataKey="rate" connectNulls stroke="#22d3ee" strokeWidth={3} fill="url(#trendFill)" dot={{ r: 3, fill: '#22d3ee', strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export default function Overview({ openPatient, goTo }: { openPatient: (id: string) => void; goTo: (tab: string) => void }) {
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = () => api('/api/admin/overview').then(d => { setData(d); setError(false); }).catch(() => setError(true));
    load();
    return poll(load, 30_000);
  }, []);

  if (error && !data) return <Card><Empty>Ma'lumotlarni yuklab bo'lmadi. Server ishlayotganini tekshiring.</Empty></Card>;
  if (!data) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-white/10 border-t-cyan-400 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
        <Stat label="Jami bemorlar" value={data.totalPatients} icon={<Users className="w-5 h-5" />} onClick={() => goTo('patients')} />
        <Stat label="Davolanayotganlar" value={data.activeTreatments} icon={<Activity className="w-5 h-5" />} tone="blue" />
        <Stat label="O'rtacha aniqlik" value={data.avgAdherence === null ? '—' : `${data.avgAdherence}%`} icon={<HeartPulse className="w-5 h-5" />} tone="green" />
        <Stat label="Telegram ulangan" value={data.telegramLinked} icon={<Send className="w-5 h-5" />} tone="purple" />
        <Stat label="Yangi xabarlar" value={data.newReports} icon={<MessageSquareWarning className="w-5 h-5" />} tone={data.newReports ? 'red' : 'cyan'} onClick={() => goTo('inbox')} />
        <Stat label="Do'kon so'rovlari" value={data.pendingRedemptions} icon={<Gift className="w-5 h-5" />} tone="amber" onClick={() => goTo('inbox')} />
        <Stat label="Yangiliklar" value={data.totalNews} icon={<Newspaper className="w-5 h-5" />} onClick={() => goTo('news')} />
        <Stat label="Video darslar" value={data.totalVideos} icon={<Video className="w-5 h-5" />} onClick={() => goTo('videos')} />
      </div>

      {data.trend && <TrendCard trend={data.trend} />}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-black text-white mb-1 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-400" /> E'tibor talab qiladigan bemorlar</h3>
          <p className="text-xs text-zinc-500 mb-5">Faol kursi bor va dori ichish aniqligi 70% dan past</p>
          {data.atRisk.length === 0 ? <Empty>Hozircha bunday bemor yo'q 👍</Empty> : (
            <div className="space-y-2">
              {data.atRisk.map((p: any) => (
                <button key={p.id} onClick={() => openPatient(p.id)} className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-left">
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{p.fullName}</p>
                    <p className="text-[11px] text-zinc-500">Oxirgi faollik: {relTime(p.lastSeenAt)} · bugun qolgan: {p.todayPending}</p>
                  </div>
                  <span className={cn('text-lg font-black shrink-0', rateColor(p.adherenceRate))}>{p.adherenceRate}%</span>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-lg font-black text-white mb-1 flex items-center gap-2"><MessageSquareWarning className="w-5 h-5 text-rose-400" /> Bemorlardan yangi xabarlar</h3>
          <p className="text-xs text-zinc-500 mb-5">Nojo'ya ta'sirlar va shikoyatlar — kuchlilari birinchi</p>
          {data.recentReports.length === 0 ? <Empty>Yangi xabar yo'q</Empty> : (
            <div className="space-y-2">
              {data.recentReports.map((r: any) => (
                <button key={r.id} onClick={() => openPatient(r.patientId)} className="w-full p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-left">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-white text-sm truncate">{r.patientName}</span>
                    <span className={cn('px-2 py-0.5 rounded-md border text-[10px] font-black uppercase shrink-0', SEVERITY[r.severity]?.cls)}>{SEVERITY[r.severity]?.label}</span>
                  </div>
                  <p className="text-sm text-zinc-300 line-clamp-2 break-words">{r.text}</p>
                  <p className="text-[11px] text-zinc-500 mt-1">{relTime(r.createdAt)}</p>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="text-lg font-black text-white mb-5">So'nggi ro'yxatdan o'tganlar</h3>
        {data.recentPatients.length === 0 ? <Empty>Bemorlar yo'q</Empty> : (
          <div className="divide-y divide-white/5">
            {data.recentPatients.map((p: any) => (
              <button key={p.id} onClick={() => openPatient(p.id)} className="w-full flex items-center justify-between gap-3 py-3 text-left hover:bg-white/5 px-2 rounded-xl">
                <div className="min-w-0">
                  <p className="font-bold text-white truncate">{p.fullName}</p>
                  <p className="text-[11px] text-zinc-500">{p.telegramUsername ? `@${p.telegramUsername} · ` : ''}{fmtDate(p.createdAt)}</p>
                </div>
                <span className="text-xs font-bold text-cyan-400 shrink-0">Ko'rish →</span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
