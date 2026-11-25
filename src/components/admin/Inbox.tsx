import React, { useEffect, useState } from 'react';
import { MessageSquareWarning, Gift, Send } from 'lucide-react';
import { api, poll } from '../../lib/api';
import { Card, Btn, Empty, Modal, inputCls, SEVERITY, errText, fmtDateTime } from './ui';
import { RedemptionRow } from './Patients';
import { cn } from '../../lib/utils';

export default function Inbox({ openPatient }: { openPatient: (id: string) => void }) {
  const [reportStatus, setReportStatus] = useState<'new' | 'all'>('new');
  const [redStatus, setRedStatus] = useState<'pending' | 'all'>('pending');
  const [reports, setReports] = useState<any[] | null>(null);
  const [reds, setReds] = useState<any[] | null>(null);
  const [replyFor, setReplyFor] = useState<any | null>(null);
  const [reply, setReply] = useState('');

  const load = () => {
    api<any[]>(`/api/admin/reports?status=${reportStatus}`).then(setReports).catch(() => setReports(r => r ?? []));
    api<any[]>(`/api/admin/redemptions?status=${redStatus}`).then(setReds).catch(() => setReds(r => r ?? []));
  };
  useEffect(() => { load(); return poll(load, 30_000); }, [reportStatus, redStatus]);

  const review = async (id: string, text: string) => {
    try { await api(`/api/admin/reports/${id}/review`, { body: { reply: text } }); setReplyFor(null); load(); } catch (e) { alert(errText(e)); }
  };

  const Toggle = ({ value, set, opts }: { value: string; set: (v: any) => void; opts: [string, string][] }) => (
    <div className="flex gap-1 bg-white/5 p-1 rounded-full">
      {opts.map(([v, l]) => <button key={v} onClick={() => set(v)} className={cn('px-3 py-1 rounded-full text-xs font-bold', value === v ? 'bg-cyan-400/15 text-cyan-300' : 'text-zinc-400')}>{l}</button>)}
    </div>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h3 className="text-lg font-black text-white flex items-center gap-2"><MessageSquareWarning className="w-5 h-5 text-rose-400" /> Bemor xabarlari</h3>
          <Toggle value={reportStatus} set={setReportStatus} opts={[['new', 'Yangi'], ['all', 'Hammasi']]} />
        </div>
        {reports === null ? <Empty>Yuklanmoqda...</Empty> : reports.length === 0 ? <Empty>{reportStatus === 'new' ? "Yangi xabar yo'q" : "Xabar yo'q"}</Empty> : (
          <div className="space-y-3">
            {reports.map(r => (
              <div key={r.id} className={cn('p-4 rounded-2xl border', r.status === 'new' ? 'bg-rose-500/5 border-rose-500/20' : 'bg-white/5 border-white/5')}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <button onClick={() => openPatient(r.patientId)} className="font-bold text-cyan-300 hover:underline text-sm text-left truncate">{r.patientName}</button>
                  <span className={cn('px-2 py-0.5 rounded-md border text-[10px] font-black uppercase shrink-0', SEVERITY[r.severity]?.cls)}>{SEVERITY[r.severity]?.label}</span>
                </div>
                {r.medicationName && <p className="text-[11px] text-zinc-400 font-bold mb-1">💊 {r.medicationName}</p>}
                <p className="text-sm text-zinc-200 whitespace-pre-wrap break-words">{r.text}</p>
                <p className="text-[11px] text-zinc-500 mt-2">{fmtDateTime(r.createdAt)}</p>
                {r.doctorReply && <p className="mt-3 p-3 rounded-xl bg-cyan-500/10 text-cyan-100 text-sm whitespace-pre-wrap break-words"><b>Javob:</b> {r.doctorReply}</p>}
                {r.status === 'new' && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Btn onClick={() => { setReplyFor(r); setReply(''); }}><Send className="w-4 h-4" /> Javob yozish</Btn>
                    <Btn variant="ghost" onClick={() => review(r.id, '')}>Ko'rildi</Btn>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h3 className="text-lg font-black text-white flex items-center gap-2"><Gift className="w-5 h-5 text-yellow-400" /> Do'kon so'rovlari</h3>
          <Toggle value={redStatus} set={setRedStatus} opts={[['pending', 'Kutilmoqda'], ['all', 'Hammasi']]} />
        </div>
        {reds === null ? <Empty>Yuklanmoqda...</Empty> : reds.length === 0 ? <Empty>So'rov yo'q</Empty> : (
          <div className="space-y-2">{reds.map(r => <RedemptionRow key={r.id} r={r} onDone={load} showPatient openPatient={openPatient} />)}</div>
        )}
      </Card>

      {replyFor && (
        <Modal title={`Javob: ${replyFor.patientName}`} onClose={() => setReplyFor(null)}>
          <p className="text-sm text-zinc-300 p-3 rounded-xl bg-white/5 mb-4 whitespace-pre-wrap break-words">{replyFor.text}</p>
          <textarea className={inputCls} rows={5} value={reply} onChange={e => setReply(e.target.value)} placeholder="Javobingiz bemor ilovasida va Telegram'da ko'rinadi" autoFocus />
          <div className="flex gap-3 mt-4">
            <Btn variant="ghost" className="flex-1" onClick={() => setReplyFor(null)}>Bekor qilish</Btn>
            <Btn className="flex-[2]" disabled={!reply.trim()} onClick={() => review(replyFor.id, reply)}>Yuborish</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
