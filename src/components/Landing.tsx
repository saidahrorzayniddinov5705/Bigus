/**
 * First screen for a visitor who isn't signed in: what BIGUS does, the main
 * features, and the sign-in button. (Language / theme controls are rendered by
 * the parent above this.)
 */
import React from 'react';
import { motion } from 'motion/react';
import { BellRing, ScanFace, Coins, Stethoscope, ShieldCheck, ArrowRight, LineChart } from 'lucide-react';
import { Logo } from './Logo';

export default function Landing({ t, onLogin }: { t: any, onLogin: () => void }) {
  const features = [
    { icon: BellRing, title: t('featRemindTitle'), text: t('featRemindText'), tone: 'text-blue-600 bg-blue-500/10 dark:text-blue-400' },
    { icon: ScanFace, title: t('featCameraTitle'), text: t('featCameraText'), tone: 'text-cyan-600 bg-cyan-500/10 dark:text-cyan-400' },
    { icon: Stethoscope, title: t('featDoctorTitle'), text: t('featDoctorText'), tone: 'text-rose-600 bg-rose-500/10 dark:text-rose-400' },
    { icon: Coins, title: t('featRewardTitle'), text: t('featRewardText'), tone: 'text-amber-600 bg-amber-500/10 dark:text-amber-400' },
  ];

  return (
    <div className="relative z-10 w-full max-w-6xl mx-auto px-1 sm:px-4 py-20 md:py-10 grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#1A1D24] shadow-lg border border-black/5 dark:border-white/10 p-2.5"><Logo className="w-full h-full" /></div>
          <span className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">BIGUS</span>
        </div>
        <h1 className="text-[34px] leading-[1.08] sm:text-5xl lg:text-[58px] font-black tracking-tight text-zinc-900 dark:text-white">
          {t('heroTitle1')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">{t('heroTitle2')}</span>
        </h1>
        <p className="mt-5 text-[16px] md:text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-xl">{t('heroText')}</p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onLogin}
            className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black text-lg shadow-[0_12px_32px_rgba(6,182,212,0.35)] hover:shadow-[0_16px_40px_rgba(6,182,212,0.45)] hover:-translate-y-0.5 active:translate-y-0 transition-all"
          >
            {t('loginButton')}<ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <a href="#/admin" className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl border border-black/10 dark:border-white/15 bg-white/60 dark:bg-white/5 text-zinc-800 dark:text-zinc-100 font-bold hover:bg-white dark:hover:bg-white/10 transition-colors">
            <Stethoscope className="w-5 h-5" />{t('forDoctors')}
          </a>
        </div>

        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-green-600" />{t('heroTrust1')}</span>
          <span className="flex items-center gap-1.5"><LineChart className="w-4 h-4 text-blue-600" />{t('heroTrust2')}</span>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-3xl p-5 md:p-6 bg-white/80 dark:bg-white/[0.04] backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.05)]"
          >
            <span className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 ${f.tone}`}><f.icon className="w-5.5 h-5.5" /></span>
            <h3 className="font-black text-[17px] text-zinc-900 dark:text-white mb-1.5">{f.title}</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{f.text}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
