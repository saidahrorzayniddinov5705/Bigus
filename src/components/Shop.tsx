/**
 * H-Coin shop: balance, ways to earn, the catalogue (with progress towards
 * items the patient can't afford yet), an in-app confirmation and the
 * patient's own order history. Prices and balance are checked by the server.
 */
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Coins, Pill, Video, Footprints, Gamepad2, Clock, CheckCircle2, XCircle, ShoppingBag, X, Loader2, Lock } from 'lucide-react';
import { SHOP_ITEMS, REWARD_LIMITS, ShopItem } from '../lib/shop';
import { longDate } from './NewsReader';

type Props = {
  t: any;
  language: string;
  balance: number;
  redemptions: any[];
  onRedeem: (itemId: string) => Promise<boolean>;
};

const fmt = (n: number) => n.toLocaleString('ru-RU').replace(/ /g, ' ');

export default function Shop({ t, language, balance, redemptions, onRedeem }: Props) {
  const [confirm, setConfirm] = useState<ShopItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ShopItem | null>(null);

  const items = useMemo(() => [...SHOP_ITEMS].sort((a, b) => a.price - b.price), []);
  const nextGoal = items.find(i => i.price > balance) || null;
  const prevPrice = [...items].reverse().find(i => i.price <= balance)?.price ?? 0;

  const earn = [
    { icon: Pill, label: t('earnDoses'), value: '≈50 / ' + t('perDay') },
    { icon: Video, label: t('earnVideo'), value: `${REWARD_LIMITS.videoQuiz} / ${t('lessonShort')}` },
    { icon: Footprints, label: t('earnWalk'), value: `≤${REWARD_LIMITS.walkComplete + REWARD_LIMITS.walkGiftsPerDay * REWARD_LIMITS.walkGiftMax} / ${t('perDay')}` },
    { icon: Gamepad2, label: t('earnGames'), value: `${REWARD_LIMITS.gamesPerDay} / ${t('perDay')}` },
  ];

  const buy = async () => {
    if (!confirm || busy) return;
    setBusy(true);
    const ok = await onRedeem(confirm.id);
    setBusy(false);
    if (ok) { setDone(confirm); setConfirm(null); }
  };

  const statusChip = (s: string) => s === 'fulfilled'
    ? <span className="px-2.5 py-1 rounded-full bg-green-500/15 text-green-700 dark:text-green-400 text-[11px] font-black flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{t('orderFulfilled')}</span>
    : s === 'cancelled'
    ? <span className="px-2.5 py-1 rounded-full bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 text-[11px] font-black flex items-center gap-1"><XCircle className="w-3.5 h-3.5" />{t('orderCancelled')}</span>
    : <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[11px] font-black flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{t('orderPending')}</span>;

  return (
    <div className="space-y-6">
      {/* Balance */}
      <section className="relative overflow-hidden rounded-[28px] md:rounded-[36px] p-6 md:p-8 bg-gradient-to-br from-zinc-900 via-zinc-900 to-indigo-950 text-white shadow-xl">
        <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full bg-amber-400/20 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">{t('redeemStore')}</p>
            <div className="flex items-baseline gap-3 mt-2">
              <span className="text-[44px] md:text-[56px] font-black leading-none tracking-tight">{fmt(balance)}</span>
              <span className="text-amber-300 font-black text-lg">H-Coin</span>
            </div>
            <p className="text-white/60 text-sm font-medium mt-2 max-w-md">{t('shopSubTitle')}</p>
          </div>
          {nextGoal && (
            <div className="md:w-72 bg-white/10 rounded-2xl p-4 backdrop-blur">
              <p className="text-[11px] font-black uppercase tracking-widest text-white/60 mb-1">{t('nextGoal')}</p>
              <p className="font-bold text-sm mb-3 truncate">{t(nextGoal.nameKey)} · {fmt(nextGoal.price)}</p>
              <div className="h-2 rounded-full bg-white/15 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-300" style={{ width: `${Math.min(100, ((balance - prevPrice) / Math.max(1, nextGoal.price - prevPrice)) * 100)}%` }} />
              </div>
              <p className="text-xs font-semibold text-white/70 mt-2">{t('coinsNeeded').replace('{n}', fmt(nextGoal.price - balance))}</p>
            </div>
          )}
        </div>
        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-6">
          {earn.map(e => (
            <div key={e.label} className="flex items-center gap-2.5 bg-white/[0.06] border border-white/10 rounded-2xl px-3 py-2.5">
              <e.icon className="w-4.5 h-4.5 text-amber-300 shrink-0" />
              <div className="min-w-0">
                <p className="text-[12px] font-bold leading-tight">{e.label}</p>
                <p className="text-[11px] text-white/55 font-semibold">{e.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Catalogue */}
      <section className="glass-panel rounded-[28px] md:rounded-[36px] p-5 md:p-7">
        <h2 className="text-lg md:text-xl font-black text-zinc-900 dark:text-white mb-5">{t('shopCatalogue')}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5">
          {items.map(item => {
            const can = balance >= item.price;
            const pct = Math.min(100, (balance / item.price) * 100);
            return (
              <div key={item.id} className="group flex flex-col rounded-[20px] md:rounded-[24px] overflow-hidden bg-white dark:bg-white/[0.04] border border-black/5 dark:border-white/10 hover:shadow-lg transition-shadow">
                <div className="relative aspect-square overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                  <img src={item.img} alt="" loading="lazy" className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${can ? '' : 'saturate-50'}`} />
                  <span className="absolute bottom-2 left-2 px-2.5 py-1 rounded-full bg-black/70 text-white text-[12px] font-black flex items-center gap-1 backdrop-blur">
                    <Coins className="w-3.5 h-3.5 text-amber-300" />{fmt(item.price)}
                  </span>
                </div>
                <div className="p-3 md:p-4 flex-1 flex flex-col">
                  <h3 className="text-[14px] md:text-[16px] font-bold text-zinc-900 dark:text-white leading-snug line-clamp-2 min-h-[2.5em]">{t(item.nameKey)}</h3>
                  <div className="mt-auto pt-3">
                    {can ? (
                      <button onClick={() => setConfirm(item)} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-[13px] transition-colors">
                        {t('redeem')}
                      </button>
                    ) : (
                      <div>
                        <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-white/10 overflow-hidden mb-1.5">
                          <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1"><Lock className="w-3 h-3" />{t('coinsNeeded').replace('{n}', fmt(item.price - balance))}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Orders */}
      <section className="glass-panel rounded-[28px] md:rounded-[36px] p-5 md:p-7">
        <h2 className="text-lg md:text-xl font-black text-zinc-900 dark:text-white mb-4 flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-blue-600 dark:text-blue-400" />{t('myOrders')}</h2>
        {redemptions.length === 0 ? (
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{t('noOrdersYet')}</p>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {redemptions.map(r => {
              const it = SHOP_ITEMS.find(i => i.id === r.itemId);
              return (
                <li key={r.id} className="flex items-center gap-3 py-3">
                  {it ? <img src={it.img} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" /> : <span className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-white/10 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">{t(r.itemNameKey)}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold">{longDate(r.createdAt, language)} · {fmt(r.price)} H-Coin</p>
                  </div>
                  {statusChip(r.status)}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Confirm / done */}
      <AnimatePresence>
        {(confirm || done) && (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { if (!busy) { setConfirm(null); setDone(null); } }} />
            <motion.div
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              className="relative w-full sm:max-w-sm bg-white dark:bg-[#16181F] rounded-t-[28px] sm:rounded-[28px] p-6 shadow-2xl"
              role="dialog" aria-modal="true"
            >
              <button onClick={() => { setConfirm(null); setDone(null); }} disabled={busy} aria-label={t('cancel')} className="absolute top-4 right-4 p-2 rounded-full bg-black/5 dark:bg-white/10 text-zinc-600 dark:text-zinc-300"><X className="w-4 h-4" /></button>
              {done ? (
                <div className="text-center pt-2">
                  <div className="w-16 h-16 rounded-full bg-green-500/15 text-green-600 flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-9 h-9" /></div>
                  <h3 className="text-xl font-black text-zinc-900 dark:text-white mb-2">{t('orderPlaced')}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 font-medium mb-6">{t('redeemSuccess')}</p>
                  <button onClick={() => setDone(null)} className="w-full py-3.5 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black">OK</button>
                </div>
              ) : confirm && (
                <>
                  <div className="flex items-center gap-4 mb-5 pr-8">
                    <img src={confirm.img} alt="" className="w-20 h-20 rounded-2xl object-cover shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{t('confirmOrder')}</p>
                      <h3 className="text-lg font-black text-zinc-900 dark:text-white leading-snug">{t(confirm.nameKey)}</h3>
                    </div>
                  </div>
                  <dl className="space-y-2 text-sm font-semibold mb-5 bg-zinc-50 dark:bg-white/5 rounded-2xl p-4">
                    <div className="flex justify-between"><dt className="text-zinc-500 dark:text-zinc-400">{t('price')}</dt><dd className="text-zinc-900 dark:text-white">{fmt(confirm.price)} H-Coin</dd></div>
                    <div className="flex justify-between"><dt className="text-zinc-500 dark:text-zinc-400">{t('balanceAfter')}</dt><dd className="text-zinc-900 dark:text-white">{fmt(balance - confirm.price)} H-Coin</dd></div>
                  </dl>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-5">{t('orderNote')}</p>
                  <button onClick={buy} disabled={busy} className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black flex items-center justify-center gap-2 disabled:opacity-70">
                    {busy && <Loader2 className="w-4 h-4 animate-spin" />}{t('redeem')}
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
