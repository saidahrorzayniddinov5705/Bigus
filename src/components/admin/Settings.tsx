import React, { useEffect, useState } from 'react';
import { KeyRound, Users, Trash2, PlusCircle, Server, History } from 'lucide-react';
import { api } from '../../lib/api';
import { Card, Btn, Field, inputCls, Empty, errText, fmtDateTime, fmtDate } from './ui';
import { cn } from '../../lib/utils';

const ACTIONS: Record<string, string> = {
  login: 'Tizimga kirdi', 'password-changed': "Parolni o'zgartirdi", 'patient-note': 'Bemor eslatmasini yozdi', 'reset-pin': "PIN'ni tikladi",
  'delete-patient': "Bemorni o'chirdi", 'assign-med': 'Dori tayinladi', 'edit-med': 'Dorini tahrirladi', 'delete-med': "Dorini o'chirdi",
  'fulfill-redemption': "Sovg'ani berdi", 'cancel-redemption': "So'rovni bekor qildi", 'review-report': "Xabarni ko'rib chiqdi",
  'add-news': "Yangilik qo'shdi", 'edit-news': 'Yangilikni tahrirladi', 'delete-news': "Yangilikni o'chirdi",
  'add-video': "Video qo'shdi", 'edit-video': 'Videoni tahrirladi', 'delete-video': "Videoni o'chirdi",
  'export-patients': "Bemorlar ro'yxatini yuklab oldi", 'add-staff': "Xodim qo'shdi", 'delete-staff': "Xodimni o'chirdi",
};

export default function Settings({ staff }: { staff: any }) {
  const isAdmin = staff?.role === 'admin';
  const [pw, setPw] = useState({ current: '', next: '', again: '' });
  const [system, setSystem] = useState<any>(null);
  const [list, setList] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [nu, setNu] = useState({ name: '', email: '', password: '', role: 'doctor' });

  const loadStaff = () => isAdmin && api<any[]>('/api/admin/staff').then(setList).catch(() => {});
  useEffect(() => {
    api('/api/admin/system').then(setSystem).catch(() => {});
    loadStaff();
    if (isAdmin) api<any[]>('/api/admin/audit').then(setAudit).catch(() => {});
  }, [isAdmin]);

  const changePw = async () => {
    if (pw.next !== pw.again) return alert('Yangi parollar mos kelmadi.');
    try {
      await api('/api/admin/password', { body: { currentPassword: pw.current, newPassword: pw.next } });
      setPw({ current: '', next: '', again: '' });
      alert("Parol o'zgartirildi.");
    } catch (e) { alert(errText(e)); }
  };

  const addStaff = async () => {
    try {
      await api('/api/admin/staff', { body: nu });
      setNu({ name: '', email: '', password: '', role: 'doctor' });
      loadStaff();
      alert("Xodim qo'shildi. Email va parolni unga xavfsiz yo'l bilan bering.");
    } catch (e) { alert(errText(e)); }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <Card className="space-y-4">
        <h3 className="text-lg font-black text-white flex items-center gap-2"><KeyRound className="w-5 h-5 text-cyan-400" /> Parolni o'zgartirish</h3>
        <p className="text-xs text-zinc-500">{staff?.name} · {staff?.email} · {staff?.role === 'admin' ? 'Administrator' : 'Shifokor'}</p>
        <Field label="Joriy parol"><input type="password" autoComplete="current-password" className={inputCls} value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} /></Field>
        <Field label="Yangi parol" hint="Kamida 8 belgi"><input type="password" autoComplete="new-password" className={inputCls} value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} /></Field>
        <Field label="Yangi parol (takror)"><input type="password" autoComplete="new-password" className={inputCls} value={pw.again} onChange={e => setPw({ ...pw, again: e.target.value })} /></Field>
        <Btn className="w-full" disabled={!pw.current || pw.next.length < 8} onClick={changePw}>Saqlash</Btn>
      </Card>

      <Card className="space-y-3">
        <h3 className="text-lg font-black text-white flex items-center gap-2"><Server className="w-5 h-5 text-emerald-400" /> Tizim holati</h3>
        {!system ? <Empty>Yuklanmoqda...</Empty> : (
          <>
            {[
              ['Server va baza', true, `Ishlayapti · baza hajmi ${system.dbSizeKb} KB`],
              ['AI yordamchi (Gemini)', system.ai, system.ai ? 'Ulangan' : "Ulanmagan — server/.env faylida GEMINI_API_KEY ni kiriting"],
              ['Telegram eslatmalari', system.telegram && system.telegramBot, system.telegramBot ? `Bot: @${system.telegramBot}` : "O'chiq — server/.env faylida TELEGRAM_BOT_TOKEN ni kiriting"],
            ].map(([k, ok, v]) => (
              <div key={k as string} className="flex items-start gap-3 p-3 rounded-xl bg-white/5">
                <span className={cn('w-2.5 h-2.5 mt-1.5 rounded-full shrink-0', ok ? 'bg-emerald-400' : 'bg-amber-400')} />
                <div><p className="font-bold text-white text-sm">{k as string}</p><p className="text-xs text-zinc-400">{v as string}</p></div>
              </div>
            ))}
          </>
        )}
      </Card>

      {isAdmin && (
        <Card className="space-y-4">
          <h3 className="text-lg font-black text-white flex items-center gap-2"><Users className="w-5 h-5 text-blue-400" /> Xodimlar</h3>
          <div className="space-y-2">
            {list.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5">
                <div className="min-w-0">
                  <p className="font-bold text-white text-sm truncate">{s.name} {s.id === staff.id && <span className="text-cyan-400">(siz)</span>}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{s.email} · {s.role === 'admin' ? 'Administrator' : 'Shifokor'} · {fmtDate(s.createdAt)}</p>
                </div>
                {s.id !== staff.id && <Btn variant="danger" onClick={async () => { if (confirm(`${s.name} hisobini o'chirasizmi?`)) { try { await api(`/api/admin/staff/${s.id}`, { method: 'DELETE' }); loadStaff(); } catch (e) { alert(errText(e)); } } }} aria-label="O'chirish"><Trash2 className="w-4 h-4" /></Btn>}
              </div>
            ))}
          </div>
          <div className="pt-4 border-t border-white/5 space-y-3">
            <h4 className="font-bold text-white text-sm flex items-center gap-2"><PlusCircle className="w-4 h-4" /> Yangi xodim</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className={inputCls} placeholder="F.I.O." value={nu.name} onChange={e => setNu({ ...nu, name: e.target.value })} />
              <input className={inputCls} placeholder="Email" type="email" value={nu.email} onChange={e => setNu({ ...nu, email: e.target.value })} />
              <input className={inputCls} placeholder="Parol (kamida 8 belgi)" type="text" value={nu.password} onChange={e => setNu({ ...nu, password: e.target.value })} />
              <select className={inputCls} value={nu.role} onChange={e => setNu({ ...nu, role: e.target.value })}>
                <option value="doctor">Shifokor</option><option value="admin">Administrator</option>
              </select>
            </div>
            <Btn className="w-full" disabled={!nu.name || !nu.email || nu.password.length < 8} onClick={addStaff}>Qo'shish</Btn>
          </div>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2"><History className="w-5 h-5 text-purple-400" /> Harakatlar jurnali</h3>
          {audit.length === 0 ? <Empty>Bo'sh</Empty> : (
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1" data-lenis-prevent>
              {audit.map(a => (
                <div key={a.id} className="p-2.5 rounded-xl bg-white/5 text-sm">
                  <div className="flex justify-between gap-2"><span className="font-bold text-white">{a.staffName || '—'}</span><span className="text-[11px] text-zinc-500 shrink-0">{fmtDateTime(a.createdAt)}</span></div>
                  <p className="text-zinc-400 text-xs break-words">{ACTIONS[a.action] || a.action}{a.details ? `: ${a.details}` : ''}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
