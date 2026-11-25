// Small shared building blocks for the doctor/admin panel.
import React from 'react';
import { cn } from '../../lib/utils';

export const FREQUENCY_LABELS: Record<string, string> = {
  onceDaily: 'Kuniga 1 mahal',
  twiceDaily: 'Kuniga 2 mahal',
  thriceDaily: 'Kuniga 3 mahal',
  fourDaily: 'Kuniga 4 mahal',
  fourTimesDaily: 'Kuniga 4 mahal',
};

export const DEFAULT_TIMES: Record<string, string[]> = {
  onceDaily: ['08:00'],
  twiceDaily: ['08:00', '20:00'],
  thriceDaily: ['08:00', '14:00', '20:00'],
  fourDaily: ['08:00', '12:00', '18:00', '22:00'],
};

export const SHOP_ITEM_LABELS: Record<string, string> = {
  notebook: 'Bloknot',
  cap: 'Kepka',
  tshirt: 'Futbolka',
  polyclinicDiscount: 'Poliklinika chegirmasi',
  sanatoriumVoucher: "Sanatoriya yo'llanmasi",
};

export const SEVERITY: Record<string, { label: string; cls: string }> = {
  mild: { label: 'Yengil', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  moderate: { label: "O'rtacha", cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  severe: { label: 'Kuchli', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
};

export const ERRORS: Record<string, string> = {
  'name-required': 'Dori nomini kiriting.',
  'bad-frequency': "Qabul chastotasi noto'g'ri.",
  'bad-duration': "Kurs davomiyligi 1 dan 365 kungacha bo'lishi kerak.",
  'times-mismatch': "Qabul vaqtlari soni chastotaga mos emas.",
  'bad-date': "Sana noto'g'ri.",
  'uz-required': "O'zbekcha sarlavha (va yangilik uchun matn) majburiy.",
  'bad-video-url': "YouTube havolasi noto'g'ri (masalan: https://www.youtube.com/watch?v=...).",
  'bad-image-url': "Rasm havolasi https:// bilan boshlanishi kerak.",
  'weak-password': "Parol kamida 8 belgidan iborat bo'lishi kerak.",
  'wrong-credentials': "Joriy parol noto'g'ri.",
  'email-taken': 'Bu email bilan hisob allaqachon bor.',
  'invalid': "Ma'lumotlar to'liq emas.",
  'cannot-delete-self': "O'zingizni o'chira olmaysiz.",
  'not-pending': "Bu so'rov allaqachon ko'rib chiqilgan.",
  network: "Server bilan bog'lanib bo'lmadi. Server ishlayotganini tekshiring.",
};
export const errText = (e: any) => ERRORS[e?.code] || 'Xatolik yuz berdi.';

export const fmtDate = (ts?: number | null) => ts ? new Date(ts).toLocaleDateString('uz-UZ') : '—';
export const fmtDateTime = (ts?: number | null) => ts ? new Date(ts).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export function relTime(ts?: number | null) {
  if (!ts) return 'hech qachon';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 2) return 'hozirgina';
  if (m < 60) return `${m} daqiqa oldin`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} soat oldin`;
  const d = Math.round(h / 24);
  return `${d} kun oldin`;
}

export const rateColor = (r: number | null | undefined) =>
  r === null || r === undefined ? 'text-zinc-500' : r >= 80 ? 'text-emerald-400' : r >= 60 ? 'text-amber-400' : 'text-red-400';

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('admin-glass-panel rounded-3xl p-5 md:p-7', className)} {...rest}>{children}</div>;
}

export function Btn({ variant = 'primary', className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'success' }) {
  const v = {
    primary: 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-cyan-500/20 hover:from-blue-500 hover:to-cyan-400',
    ghost: 'bg-white/5 text-zinc-200 hover:bg-white/10 border border-white/10',
    danger: 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20',
    success: 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500 hover:text-white border border-emerald-500/20',
  }[variant];
  return <button className={cn('px-4 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2', v, className)} {...rest} />;
}

export const inputCls = 'w-full px-4 py-3 bg-black/40 rounded-xl border border-white/10 outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 text-white font-medium placeholder-zinc-600';

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-zinc-500">{hint}</span>}
    </label>
  );
}

export function Stat({ label, value, icon, tone = 'cyan', onClick }: { label: string; value: React.ReactNode; icon: React.ReactNode; tone?: string; onClick?: () => void }) {
  const tones: Record<string, string> = {
    cyan: 'bg-cyan-500/10 text-cyan-400', blue: 'bg-blue-500/10 text-blue-400', green: 'bg-emerald-500/10 text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-400', red: 'bg-red-500/10 text-red-400', purple: 'bg-purple-500/10 text-purple-400',
  };
  return (
    <button onClick={onClick} disabled={!onClick} className="admin-glass-panel rounded-3xl p-5 text-left w-full enabled:hover:border-cyan-500/40 transition-colors">
      <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center mb-4', tones[tone])}>{icon}</div>
      <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider">{label}</p>
      <p className="text-2xl md:text-3xl font-black text-white mt-1">{value}</p>
    </button>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-zinc-500 text-center py-8 font-bold">{children}</p>;
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className={cn('relative w-full max-h-[92vh] overflow-y-auto bg-[#111827] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 sm:p-7 shadow-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')} data-lenis-prevent>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-black text-white">{title}</h3>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 font-black" aria-label="Yopish">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
