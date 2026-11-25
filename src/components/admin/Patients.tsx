import React, { useEffect, useMemo, useState } from 'react';
import { Search, Download, ChevronLeft, Trash2, KeyRound, Pill, PlusCircle, Pencil, Pause, Play, Send, Gift, MessageSquareWarning, StickyNote, Clock } from 'lucide-react';
import { api, poll, downloadFile } from '../../lib/api';
import { pillsPerDay, dayIndexFor, takenOn, computeAdherence, courseDate, localDateStr } from '../../lib/adherence';
import { Card, Btn, Field, inputCls, Empty, Modal, FREQUENCY_LABELS, DEFAULT_TIMES, SHOP_ITEM_LABELS, SEVERITY, errText, fmtDate, fmtDateTime, relTime, rateColor } from './ui';
import { cn } from '../../lib/utils';

type Filter = 'all' | 'risk' | 'nomeds' | 'reports' | 'notelegram';
type Sort = 'newest' | 'name' | 'adherence' | 'lastSeen';

export function PatientList({ openPatient, search }: { openPatient: (id: string) => void; search: string }) {
  const [patients, setPatients] = useState<any[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [q, setQ] = useState(search);
  useEffect(() => setQ(search), [search]);

  useEffect(() => {
    const load = () => api<any[]>('/api/admin/patients').then(setPatients).catch(() => setPatients(p => p ?? []));
    load();
    return poll(load, 30_000);
  }, []);

  const shown = useMemo(() => {
    if (!patients) return [];
    const ql = q.trim().toLowerCase();
    let list = patients.filter(p => !ql || p.fullName.toLowerCase().includes(ql) || (p.telegramUsername || '').toLowerCase().includes(ql) || (p.birthDate || '').includes(ql));
    if (filter === 'risk') list = list.filter(p => p.activeMeds > 0 && p.adherenceRate !== null && p.adherenceRate < 70);
    if (filter === 'nomeds') list = list.filter(p => p.activeMeds === 0);
    if (filter === 'reports') list = list.filter(p => p.newReports > 0);
    if (filter === 'notelegram') list = list.filter(p => !p.telegramLinked);
    const sorters: Record<Sort, (a: any, b: any) => number> = {
      newest: (a, b) => b.createdAt - a.createdAt,
      name: (a, b) => a.fullName.localeCompare(b.fullName),
      adherence: (a, b) => (a.adherenceRate ?? 101) - (b.adherenceRate ?? 101),
      lastSeen: (a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0),
    };
    return [...list].sort(sorters[sort]);
  }, [patients, q, filter, sort]);

  const filters: [Filter, string][] = [['all', 'Hammasi'], ['risk', 'Aniqlik past'], ['reports', 'Yangi xabar'], ['nomeds', "Dori yo'q"], ['notelegram', 'Telegramsiz']];

  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ism, Telegram yoki tug'ilgan sana bo'yicha qidirish..." className={cn(inputCls, 'pl-11')} />
          </div>
          <select value={sort} onChange={e => setSort(e.target.value as Sort)} className={cn(inputCls, 'md:w-56')}>
            <option value="newest">Yangilari avval</option>
            <option value="name">Familiya bo'yicha</option>
            <option value="adherence">Aniqligi past avval</option>
            <option value="lastSeen">Oxirgi faollik</option>
          </select>
          <Btn variant="ghost" onClick={() => downloadFile('/api/admin/export/patients.csv', `bigus-bemorlar-${localDateStr()}.csv`).catch(() => alert('Yuklab bo\'lmadi'))}>
            <Download className="w-4 h-4" /> Excel (CSV)
          </Btn>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filters.map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)} className={cn('shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold border', filter === id ? 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30' : 'bg-white/5 text-zinc-400 border-transparent')}>{label}</button>
          ))}
        </div>
      </Card>

      {patients === null ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-white/10 border-t-cyan-400 rounded-full animate-spin" /></div>
      ) : shown.length === 0 ? (
        <Card><Empty>Bemor topilmadi</Empty></Card>
      ) : (
        <>
          <p className="text-xs font-bold text-zinc-500 px-1">{shown.length} ta bemor</p>
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3 md:gap-4">
            {shown.map(p => (
              <button key={p.id} onClick={() => openPatient(p.id)} className="admin-glass-panel rounded-3xl p-5 text-left hover:border-cyan-500/40 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-white truncate">{p.fullName}</p>
                    <p className="text-[12px] text-zinc-500 mt-0.5">{p.birthDate} {p.telegramUsername ? `· @${p.telegramUsername}` : ''}</p>
                  </div>
                  <span className={cn('text-xl font-black shrink-0', rateColor(p.adherenceRate))}>{p.adherenceRate === null ? '—' : `${p.adherenceRate}%`}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-4">
                  <span className="px-2 py-1 rounded-md bg-white/5 text-[11px] font-bold text-zinc-300">💊 {p.activeMeds} faol</span>
                  {p.activeMeds > 0 && <span className="px-2 py-1 rounded-md bg-white/5 text-[11px] font-bold text-zinc-300">Bugun qolgan: {p.todayPending}</span>}
                  {p.telegramLinked && <span className="px-2 py-1 rounded-md bg-sky-500/15 text-[11px] font-bold text-sky-300">Telegram</span>}
                  {p.newReports > 0 && <span className="px-2 py-1 rounded-md bg-red-500/15 text-[11px] font-bold text-red-300">{p.newReports} yangi xabar</span>}
                  {p.pendingRedemptions > 0 && <span className="px-2 py-1 rounded-md bg-amber-500/15 text-[11px] font-bold text-amber-300">{p.pendingRedemptions} so'rov</span>}
                  {!p.pinSet && <span className="px-2 py-1 rounded-md bg-zinc-500/15 text-[11px] font-bold text-zinc-400">PIN o'rnatilmagan</span>}
                </div>
                <p className="text-[11px] text-zinc-500 mt-3">Oxirgi faollik: {relTime(p.lastSeenAt)}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function MedForm({ initial, onSave, onClose, isEdit }: { initial?: any; onSave: (data: any) => Promise<void>; onClose: () => void; isEdit?: boolean }) {
  const [f, setF] = useState(() => ({
    name: initial?.customName || '',
    dosage: initial?.dosage || '',
    frequencyKey: initial?.frequencyKey === 'fourTimesDaily' ? 'fourDaily' : (initial?.frequencyKey || 'onceDaily'),
    durationDays: initial?.durationDays || 7,
    scheduledTimes: initial?.scheduledTimes?.length ? initial.scheduledTimes : DEFAULT_TIMES.onceDaily,
    startDate: initial?.startDate || localDateStr(),
    instructions: initial?.instructions || '',
  }));
  const [busy, setBusy] = useState(false);
  const ppd = pillsPerDay({ frequencyKey: f.frequencyKey });

  const setFreq = (frequencyKey: string) => setF(prev => ({ ...prev, frequencyKey, scheduledTimes: DEFAULT_TIMES[frequencyKey] }));
  const save = async () => {
    setBusy(true);
    try {
      const body: any = { name: f.name, dosage: f.dosage, frequencyKey: f.frequencyKey, durationDays: Number(f.durationDays), scheduledTimes: f.scheduledTimes, instructions: f.instructions };
      if (!isEdit) body.startDate = f.startDate;
      await onSave(body);
      onClose();
    } catch (e) {
      alert(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Dori nomi"><input className={inputCls} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Masalan: Amoksitsillin" autoFocus /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Dozasi"><input className={inputCls} value={f.dosage} onChange={e => setF({ ...f, dosage: e.target.value })} placeholder="500 mg, 1 tabletka" /></Field>
        <Field label="Chastota">
          <select className={inputCls} value={f.frequencyKey} onChange={e => setFreq(e.target.value)}>
            {['onceDaily', 'twiceDaily', 'thriceDaily', 'fourDaily'].map(k => <option key={k} value={k}>{FREQUENCY_LABELS[k]}</option>)}
          </select>
        </Field>
        <Field label="Kurs davomiyligi (kun)"><input type="number" min={1} max={365} className={inputCls} value={f.durationDays} onChange={e => setF({ ...f, durationDays: e.target.value as any })} /></Field>
        {!isEdit && <Field label="Boshlanish sanasi" hint="Bugun yoki keyinroq"><input type="date" min={localDateStr()} className={inputCls} value={f.startDate} onChange={e => setF({ ...f, startDate: e.target.value })} /></Field>}
      </div>
      <Field label={`Qabul vaqtlari (${ppd} ta)`}>
        <div className="grid grid-cols-2 gap-2">
          {f.scheduledTimes.map((tm: string, i: number) => (
            <input key={i} type="time" className={inputCls} value={tm} onChange={e => { const t = [...f.scheduledTimes]; t[i] = e.target.value; setF({ ...f, scheduledTimes: t }); }} />
          ))}
        </div>
      </Field>
      <Field label="Ko'rsatma (ixtiyoriy)" hint="Bemor ilovasida va Telegram eslatmasida ko'rinadi">
        <textarea className={inputCls} rows={2} value={f.instructions} onChange={e => setF({ ...f, instructions: e.target.value })} placeholder="Masalan: ovqatdan keyin, ko'p suv bilan" />
      </Field>
      <p className="text-xs text-zinc-500">Jami: {Number(f.durationDays) * ppd || 0} doza.</p>
      <div className="flex gap-3 pt-2">
        <Btn variant="ghost" className="flex-1" onClick={onClose}>Bekor qilish</Btn>
        <Btn className="flex-[2]" disabled={busy || !f.name.trim()} onClick={save}>{isEdit ? 'Saqlash' : 'Dorini tayinlash'}</Btn>
      </div>
    </div>
  );
}

function MedTimeline({ med }: { med: any }) {
  const today = dayIndexFor(med);
  const ppd = pillsPerDay(med);
  return (
    <div className="flex flex-wrap gap-1">
      {Array.from({ length: med.durationDays }, (_, i) => {
        const tk = takenOn(med, i);
        const d = courseDate(med, i);
        const cls = i > today ? 'bg-white/5' : tk >= ppd ? 'bg-emerald-500' : tk > 0 ? 'bg-amber-400' : i === today ? 'bg-white/20 ring-1 ring-cyan-400' : 'bg-red-500/70';
        return <span key={i} title={`${d ? d.toLocaleDateString('uz-UZ') : i + 1}: ${tk}/${ppd}`} className={cn('w-3.5 h-3.5 rounded-[4px]', cls)} />;
      })}
    </div>
  );
}

export function PatientDetail({ id, onBack, onDeleted }: { id: string; onBack: () => void; onDeleted: () => void }) {
  const [data, setData] = useState<any | null>(null);
  const [note, setNote] = useState('');
  const [noteDirty, setNoteDirty] = useState(false);
  const [medModal, setMedModal] = useState<null | { med?: any }>(null);
  const [replyFor, setReplyFor] = useState<any | null>(null);
  const [reply, setReply] = useState('');

  const load = () => api(`/api/admin/patients/${id}`).then(d => {
    setData(d);
    if (!noteDirty) setNote(d.patient.doctorNote || '');
  }).catch(e => { if (e?.status === 404) onBack(); });

  useEffect(() => { load(); return poll(load, 20_000); }, [id, noteDirty]);

  if (!data) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-white/10 border-t-cyan-400 rounded-full animate-spin" /></div>;
  const p = data.patient;

  const act = async (fn: () => Promise<any>, ok?: string) => {
    try { await fn(); if (ok) alert(ok); load(); } catch (e) { alert(errText(e)); }
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-zinc-400 hover:text-white flex items-center gap-2 font-bold text-sm bg-white/5 px-4 py-2 rounded-full"><ChevronLeft className="w-4 h-4" /> Bemorlar ro'yxati</button>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-900 border border-white/10 flex items-center justify-center text-2xl font-black text-white">{p.lastName?.[0]}{p.firstName?.[0]}</div>
              <div className="min-w-0">
                <h2 className="text-xl font-black text-white break-words">{p.fullName}</h2>
                <p className="text-xs text-zinc-500">Ro'yxatdan o'tgan: {fmtDate(p.createdAt)}</p>
              </div>
            </div>
            <dl className="space-y-2 text-sm">
              {[
                ["Tug'ilgan sana", p.birthDate],
                ['Telegram', p.telegramUsername ? `@${p.telegramUsername}` : '—'],
                ['Telegram eslatmalari', p.telegramLinked ? 'Ulangan ✅' : 'Ulanmagan'],
                ['Oxirgi faollik', relTime(p.lastSeenAt)],
                ['PIN', p.pinSet ? "O'rnatilgan" : "O'rnatilmagan (keyingi kirishda o'rnatadi)"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 p-3 rounded-xl bg-white/5"><dt className="text-zinc-400 font-bold">{k}</dt><dd className="text-white font-bold text-right">{v}</dd></div>
              ))}
            </dl>
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="p-3 rounded-xl bg-white/5"><p className="text-[10px] text-zinc-500 font-bold uppercase">Aniqlik</p><p className={cn('text-lg font-black', rateColor(p.adherenceRate))}>{p.adherenceRate === null ? '—' : `${p.adherenceRate}%`}</p></div>
              <div className="p-3 rounded-xl bg-white/5"><p className="text-[10px] text-zinc-500 font-bold uppercase">Seriya</p><p className="text-lg font-black text-white">{p.streak} kun</p></div>
              <div className="p-3 rounded-xl bg-white/5"><p className="text-[10px] text-zinc-500 font-bold uppercase">H-Coin</p><p className="text-lg font-black text-yellow-400">{p.hCoins}</p></div>
            </div>
            <div className="flex flex-wrap gap-2 mt-5">
              <Btn variant="ghost" onClick={() => confirm("Bemor PIN kodini tiklaysizmi? Bemor keyingi kirishda yangi PIN o'rnatadi va barcha qurilmalardan chiqariladi.") && act(() => api(`/api/admin/patients/${id}/reset-pin`, { body: {} }), "PIN tiklandi. Bemorga keyingi kirishda yangi PIN o'ylab topishini ayting.")}>
                <KeyRound className="w-4 h-4" /> PIN'ni tiklash
              </Btn>
              <Btn variant="danger" onClick={async () => {
                if (!confirm(`${p.fullName} — bemorni va uning BARCHA ma'lumotlarini (dorilar, tarix, xabarlar) o'chirasizmi? Buni qaytarib bo'lmaydi.`)) return;
                try { await api(`/api/admin/patients/${id}`, { method: 'DELETE' }); onDeleted(); } catch (e) { alert(errText(e)); }
              }}><Trash2 className="w-4 h-4" /> O'chirish</Btn>
            </div>
          </Card>

          <Card>
            <h3 className="font-black text-white mb-3 flex items-center gap-2"><StickyNote className="w-4 h-4 text-amber-400" /> Shifokor eslatmasi</h3>
            <p className="text-[11px] text-zinc-500 mb-2">Faqat shifokorlar ko'radi (tashxis, allergiya, kuzatuv rejasi...)</p>
            <textarea className={inputCls} rows={4} value={note} onChange={e => { setNote(e.target.value); setNoteDirty(true); }} placeholder="Masalan: penitsillinga allergiya" />
            <Btn className="mt-3 w-full" disabled={!noteDirty} onClick={() => act(async () => { await api(`/api/admin/patients/${id}`, { method: 'PATCH', body: { doctorNote: note } }); setNoteDirty(false); })}>Saqlash</Btn>
          </Card>
        </div>

        <div className="xl:col-span-2 space-y-6">
          <Card>
            <div className="flex items-center justify-between gap-3 mb-5">
              <h3 className="text-lg font-black text-white flex items-center gap-2"><Pill className="w-5 h-5 text-cyan-400" /> Dori-darmonlar ({data.meds.length})</h3>
              <Btn onClick={() => setMedModal({})}><PlusCircle className="w-4 h-4" /> Dori tayinlash</Btn>
            </div>
            {data.meds.length === 0 ? <Empty>Hali dori tayinlanmagan</Empty> : (
              <div className="space-y-4">
                {data.meds.map((m: any) => {
                  const rate = computeAdherence([m]).rate;
                  const idx = dayIndexFor(m);
                  const ppd = pillsPerDay(m);
                  const finished = idx >= m.durationDays;
                  const notStarted = idx < 0;
                  const lastTaken = [...(m.history || [])].reverse().find((h: any) => h.action === 'taken');
                  return (
                    <div key={m.id} className={cn('p-4 md:p-5 rounded-2xl border', m.status === 'stopped' ? 'bg-white/[0.02] border-white/5 opacity-70' : 'bg-white/5 border-white/10')}>
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="font-black text-white text-lg break-words">{m.customName}</h4>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {m.dosage && <span className="px-2 py-1 bg-white/10 rounded-md text-[11px] font-bold text-zinc-300">{m.dosage}</span>}
                            <span className="px-2 py-1 bg-cyan-500/15 text-cyan-300 rounded-md text-[11px] font-bold">{FREQUENCY_LABELS[m.frequencyKey] || m.frequencyKey}</span>
                            <span className="px-2 py-1 bg-blue-500/15 text-blue-300 rounded-md text-[11px] font-bold">{m.durationDays} kun · {fmtDate(courseDate(m, 0)?.getTime())} dan</span>
                            <span className="px-2 py-1 bg-white/10 rounded-md text-[11px] font-bold text-zinc-300 flex items-center gap-1"><Clock className="w-3 h-3" /> {m.scheduledTimes.join(', ')}</span>
                            {m.status === 'stopped' && <span className="px-2 py-1 bg-zinc-500/20 text-zinc-300 rounded-md text-[11px] font-bold">To'xtatilgan</span>}
                            {finished && m.status !== 'stopped' && <span className="px-2 py-1 bg-emerald-500/15 text-emerald-300 rounded-md text-[11px] font-bold">Kurs tugagan</span>}
                            {notStarted && <span className="px-2 py-1 bg-purple-500/15 text-purple-300 rounded-md text-[11px] font-bold">Hali boshlanmagan</span>}
                          </div>
                          {m.instructions && <p className="text-sm text-amber-200/80 mt-2">📝 {m.instructions}</p>}
                        </div>
                        <div className="text-left sm:text-right shrink-0">
                          <p className={cn('text-2xl font-black', rateColor(rate))}>{rate === null ? '—' : `${rate}%`}</p>
                          <p className="text-[11px] text-zinc-500">aniqlik</p>
                        </div>
                      </div>
                      <div className="mt-4"><MedTimeline med={m} /></div>
                      <div className="flex flex-wrap justify-between gap-2 mt-3 text-[12px] text-zinc-400 font-bold">
                        <span>Qabul qilingan: {m.totalPills - m.remainingPills}/{m.totalPills}</span>
                        {!finished && !notStarted && <span>Bugun: {takenOn(m, idx)}/{ppd}</span>}
                        <span>Oxirgi qabul: {lastTaken ? fmtDateTime(lastTaken.timestamp) : '—'}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Btn variant="ghost" onClick={() => setMedModal({ med: m })}><Pencil className="w-4 h-4" /> Tahrirlash</Btn>
                        {m.status === 'stopped'
                          ? <Btn variant="success" onClick={() => act(() => api(`/api/admin/medications/${m.id}`, { method: 'PATCH', body: { status: 'active' } }))}><Play className="w-4 h-4" /> Davom ettirish</Btn>
                          : <Btn variant="ghost" onClick={() => confirm("Kursni to'xtatasizmi? Bemorga bu dori ko'rsatilmaydi va eslatma kelmaydi.") && act(() => api(`/api/admin/medications/${m.id}`, { method: 'PATCH', body: { status: 'stopped' } }))}><Pause className="w-4 h-4" /> To'xtatish</Btn>}
                        <Btn variant="danger" onClick={() => confirm(`"${m.customName}" dorisini va uning butun tarixini o'chirasizmi?`) && act(() => api(`/api/admin/medications/${m.id}`, { method: 'DELETE' }))}><Trash2 className="w-4 h-4" /> O'chirish</Btn>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap gap-3 mt-4 text-[11px] text-zinc-500 font-bold">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500" /> to'liq</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400" /> qisman</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/70" /> o'tkazib yuborilgan</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white/5 border border-white/10" /> kelajak</span>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-black text-white mb-5 flex items-center gap-2"><MessageSquareWarning className="w-5 h-5 text-rose-400" /> Bemor xabarlari ({data.reports.length})</h3>
            {data.reports.length === 0 ? <Empty>Xabar yo'q</Empty> : (
              <div className="space-y-3">
                {data.reports.map((r: any) => (
                  <div key={r.id} className={cn('p-4 rounded-2xl border', r.status === 'new' ? 'bg-rose-500/5 border-rose-500/20' : 'bg-white/5 border-white/5')}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={cn('px-2 py-0.5 rounded-md border text-[10px] font-black uppercase', SEVERITY[r.severity]?.cls)}>{SEVERITY[r.severity]?.label}</span>
                      <span className="text-[11px] text-zinc-500">{fmtDateTime(r.createdAt)}</span>
                    </div>
                    {r.medicationId && <p className="text-[11px] text-cyan-300 font-bold mb-1">💊 {data.meds.find((m: any) => m.id === r.medicationId)?.customName || 'Dori'}</p>}
                    <p className="text-sm text-zinc-200 whitespace-pre-wrap break-words">{r.text}</p>
                    {r.doctorReply && <p className="mt-3 p-3 rounded-xl bg-cyan-500/10 text-cyan-100 text-sm whitespace-pre-wrap break-words"><b>Javob:</b> {r.doctorReply}</p>}
                    {r.status === 'new' && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Btn onClick={() => { setReplyFor(r); setReply(''); }}><Send className="w-4 h-4" /> Javob yozish</Btn>
                        <Btn variant="ghost" onClick={() => act(() => api(`/api/admin/reports/${r.id}/review`, { body: { reply: '' } }))}>Ko'rildi deb belgilash</Btn>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="text-lg font-black text-white mb-5 flex items-center gap-2"><Gift className="w-5 h-5 text-yellow-400" /> Do'kon so'rovlari ({data.redemptions.length})</h3>
            {data.redemptions.length === 0 ? <Empty>So'rov yo'q</Empty> : (
              <div className="space-y-2">
                {data.redemptions.map((r: any) => (
                  <RedemptionRow key={r.id} r={r} onDone={load} />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {medModal && (
        <Modal title={medModal.med ? 'Dorini tahrirlash' : 'Yangi dori tayinlash'} onClose={() => setMedModal(null)}>
          <MedForm initial={medModal.med} isEdit={!!medModal.med} onClose={() => setMedModal(null)} onSave={async (body) => {
            if (medModal.med) await api(`/api/admin/medications/${medModal.med.id}`, { method: 'PATCH', body });
            else await api(`/api/admin/patients/${id}/medications`, { body });
            load();
          }} />
        </Modal>
      )}

      {replyFor && (
        <Modal title="Bemorga javob" onClose={() => setReplyFor(null)}>
          <p className="text-sm text-zinc-300 p-3 rounded-xl bg-white/5 mb-4 whitespace-pre-wrap break-words">{replyFor.text}</p>
          <textarea className={inputCls} rows={5} value={reply} onChange={e => setReply(e.target.value)} placeholder="Javobingiz bemor ilovasida va (ulangan bo'lsa) Telegram'da ko'rinadi" autoFocus />
          <div className="flex gap-3 mt-4">
            <Btn variant="ghost" className="flex-1" onClick={() => setReplyFor(null)}>Bekor qilish</Btn>
            <Btn className="flex-[2]" disabled={!reply.trim()} onClick={() => act(async () => { await api(`/api/admin/reports/${replyFor.id}/review`, { body: { reply } }); setReplyFor(null); })}>Yuborish</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

export const RedemptionRow: React.FC<{ r: any; onDone: () => void; showPatient?: boolean; openPatient?: (id: string) => void }> = ({ r, onDone, showPatient, openPatient }) => {
  const run = async (action: 'fulfill' | 'cancel') => {
    if (action === 'cancel' && !confirm("So'rovni bekor qilasizmi? Tangalar bemorga qaytariladi.")) return;
    try { await api(`/api/admin/redemptions/${r.id}/${action}`, { body: {} }); onDone(); } catch (e) { alert(errText(e)); }
  };
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
      <div className="min-w-0">
        <p className="font-bold text-white text-sm">{SHOP_ITEM_LABELS[r.itemNameKey] || r.itemNameKey}</p>
        <p className="text-[11px] text-zinc-500">
          {showPatient && <button className="text-cyan-300 font-bold hover:underline mr-1" onClick={() => openPatient?.(r.patientId)}>{r.patientName}</button>}
          {r.price?.toLocaleString()} H-Coin · {fmtDate(r.createdAt)}
        </p>
      </div>
      {r.status === 'pending' ? (
        <div className="flex gap-2 shrink-0">
          <Btn variant="success" onClick={() => run('fulfill')}>Berildi</Btn>
          <Btn variant="ghost" onClick={() => run('cancel')}>Bekor qilish</Btn>
        </div>
      ) : (
        <span className={cn('shrink-0 text-[11px] font-black uppercase', r.status === 'fulfilled' ? 'text-emerald-400' : 'text-zinc-500')}>{r.status === 'fulfilled' ? `Berildi · ${fmtDate(r.fulfilledAt)}` : 'Bekor qilingan'}</span>
      )}
    </div>
  );
};
