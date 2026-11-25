// New patient features:
//  - "Message my doctor": report a side effect / problem, see the doctor's reply.
//  - Telegram reminders: link the patient's own Telegram with one button.
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, X, CheckCircle2, AlertTriangle, BellRing } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

export function DoctorMessageCard({ t, onOpen }: { t: any, onOpen: () => void }) {
  const { me } = useAuth();
  const replies = (me?.reports || []).filter((r: any) => r.doctorReply).length;
  return (
    <section className="glass-panel rounded-[32px] md:rounded-[40px] p-6 md:p-8 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
      <div className="w-14 h-14 shrink-0 rounded-2xl bg-rose-500/10 flex items-center justify-center">
        <MessageSquare className="w-7 h-7 text-rose-500" />
      </div>
      <div className="flex-1">
        <h3 className="text-[20px] md:text-[22px] font-black text-zinc-900 dark:text-white">{t('reportTitle')}</h3>
        <p className="text-zinc-500 dark:text-blue-100/70 text-[14px] md:text-[15px] font-medium mt-1">{t('reportCardDesc')}</p>
      </div>
      <button onClick={onOpen} className="relative w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black text-sm shadow-lg shadow-rose-500/30 transition-colors">
        {t('reportOpen')}
        {replies > 0 && <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1 rounded-full bg-cyan-500 text-white text-[11px] font-black flex items-center justify-center">{replies}</span>}
      </button>
    </section>
  );
}

export function DoctorMessageModal({ t, meds, onClose, locale }: { t: any, meds: any[], onClose: () => void, locale: string }) {
  const { me, refreshMe } = useAuth();
  const [text, setText] = useState('');
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('mild');
  const [medicationId, setMedicationId] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (text.trim().length < 3) return;
    setSending(true);
    try {
      await api('/api/reports', { body: { text, severity, medicationId: medicationId || undefined } });
      setText(''); setSent(true);
      refreshMe();
    } catch {
      alert(t('errorOccurred'));
    } finally {
      setSending(false);
    }
  };

  const reports = me?.reports || [];
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white dark:bg-[#12151C] rounded-t-[32px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl" data-lenis-prevent>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-2xl font-black text-zinc-900 dark:text-white">{t('reportTitle')}</h3>
          <button onClick={onClose} className="p-2 rounded-full bg-zinc-100 dark:bg-white/10" aria-label={t('close')}><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 mb-5 rounded-2xl bg-red-500/10 border border-red-500/20 flex gap-3 text-red-700 dark:text-red-300 text-sm font-bold">
          <AlertTriangle className="w-5 h-5 shrink-0" /> {t('reportEmergency')}
        </div>

        {sent ? (
          <div className="p-5 mb-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold flex gap-3 items-center">
            <CheckCircle2 className="w-6 h-6 shrink-0" /> {t('reportSent')}
            <button onClick={() => setSent(false)} className="ml-auto underline text-sm">{t('reportAnother')}</button>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            {meds.length > 0 && (
              <select value={medicationId} onChange={e => setMedicationId(e.target.value)}
                className="w-full p-4 rounded-2xl bg-zinc-100 dark:bg-white/5 text-zinc-900 dark:text-white font-bold outline-none">
                <option value="">{t('reportGeneral')}</option>
                {meds.map(m => <option key={m.id} value={m.id}>{m.customName || m.nameKey}</option>)}
              </select>
            )}
            <div className="grid grid-cols-3 gap-2">
              {(['mild', 'moderate', 'severe'] as const).map(s => (
                <button key={s} onClick={() => setSeverity(s)} className={cn('py-3 rounded-2xl text-sm font-black border-2 transition-colors',
                  severity === s ? (s === 'severe' ? 'border-red-500 bg-red-500/10 text-red-600' : s === 'moderate' ? 'border-amber-500 bg-amber-500/10 text-amber-600' : 'border-emerald-500 bg-emerald-500/10 text-emerald-600')
                    : 'border-zinc-200 dark:border-white/10 text-zinc-500')}>
                  {t(`severity_${s}`)}
                </button>
              ))}
            </div>
            <textarea value={text} onChange={e => setText(e.target.value)} maxLength={2000} rows={4} placeholder={t('reportPlaceholder')}
              className="w-full p-4 rounded-2xl bg-zinc-100 dark:bg-white/5 text-zinc-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-rose-500/40" />
            <button onClick={send} disabled={sending || text.trim().length < 3}
              className="w-full py-4 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black flex items-center justify-center gap-2 disabled:opacity-50">
              <Send className="w-5 h-5" /> {t('reportSend')}
            </button>
          </div>
        )}

        {reports.length > 0 && (
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-3">{t('reportHistory')}</h4>
            <div className="space-y-3">
              {reports.map((r: any) => (
                <div key={r.id} className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-black/5 dark:border-white/5">
                  <div className="flex justify-between text-[11px] font-bold text-zinc-400 mb-1">
                    <span>{t(`severity_${r.severity}`)}</span>
                    <span>{new Date(r.createdAt).toLocaleDateString(locale)}</span>
                  </div>
                  <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-words">{r.text}</p>
                  {r.doctorReply ? (
                    <div className="mt-3 p-3 rounded-xl bg-cyan-500/10 text-cyan-800 dark:text-cyan-200 text-sm">
                      <span className="block text-[11px] font-black uppercase tracking-widest mb-1">{t('doctorReply')}</span>
                      <span className="whitespace-pre-wrap break-words">{r.doctorReply}</span>
                    </div>
                  ) : (
                    <p className="mt-2 text-[12px] font-bold text-zinc-400">{r.status === 'reviewed' ? t('reportReviewed') : t('reportWaiting')}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export function TelegramLinkButton({ t }: { t: any }) {
  const { me, refreshMe } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!me?.features?.telegram) return null;
  const linked = !!me.user?.telegramLinked;

  const link = async () => {
    setBusy(true);
    try {
      const r = await api<{ url: string }>('/api/me/telegram-link', { body: {} });
      window.open(r.url, '_blank', 'noopener');
      // The bot confirms the link; refresh a few times to pick it up.
      [5000, 15000, 30000].forEach(ms => setTimeout(refreshMe, ms));
    } catch {
      alert(t('errorOccurred'));
    } finally {
      setBusy(false);
    }
  };
  const unlink = async () => {
    if (!confirm(t('telegramUnlinkConfirm'))) return;
    await api('/api/me/telegram-unlink', { body: {} }).catch(() => {});
    refreshMe();
  };

  return linked ? (
    <button onClick={unlink} className="w-full flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-[20px] text-emerald-700 dark:text-emerald-300">
      <span className="font-bold flex items-center gap-3"><BellRing className="w-5 h-5" /> {t('telegramLinked')}</span>
      <span className="text-xs font-bold underline">{t('telegramUnlink')}</span>
    </button>
  ) : (
    <button onClick={link} disabled={busy} className="w-full flex items-center justify-between p-4 bg-sky-50 dark:bg-sky-500/10 rounded-[20px] text-sky-700 dark:text-sky-300 disabled:opacity-60">
      <span className="font-bold flex items-center gap-3 text-left"><Send className="w-5 h-5 shrink-0" /> {t('telegramLink')}</span>
    </button>
  );
}

export { AnimatePresence };
