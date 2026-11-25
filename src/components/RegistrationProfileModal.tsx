import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { Activity, CheckCircle2, Calendar, User, Moon, Sun, Globe } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Logo } from './Logo';

export default function RegistrationProfileModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { userData, registerPatient } = useAuth();
  const [loading, setLoading] = useState(false);
  const { t, language, setLanguage } = useLanguage();
  // Same rule as the dashboard: an explicit saved choice wins over the OS
  // setting. Previously a patient who picked light mode on a dark-mode phone
  // was flipped back to dark (and the choice overwritten) whenever this
  // dialog opened.
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [formData, setFormData] = useState({
    lastName: userData?.lastName || '',
    firstName: userData?.firstName || '',
    fatherName: userData?.fatherName || '',
    birthDate: userData?.birthDate || '',
    telegramUsername: userData?.telegramUsername || ''
  });
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  if (!isOpen) return null;

  const needsPin = true;
  const isFormValid = formData.lastName && formData.firstName && formData.fatherName && formData.birthDate
    && (!needsPin || /^[0-9]{6}$/.test(pin));

  const handleSubmit = async () => {
    if (!isFormValid) return;

    setErrorMessage('');
    setLoading(true);
    try {
      {
        await registerPatient({
          lastName: formData.lastName.trim(),
          firstName: formData.firstName.trim(),
          fatherName: formData.fatherName.trim(),
          birthDate: formData.birthDate,
          telegramUsername: formData.telegramUsername.trim(),
          fullName: `${formData.lastName.trim()} ${formData.firstName.trim()} ${formData.fatherName.trim()}`,
          pin
        });
      }
      onClose();
    } catch (e: any) {
      console.error(e);
      if (e?.message === 'wrong-pin') {
        setErrorMessage(t('wrongPinError' as any) as string);
      } else if (e?.message === 'locked') {
        setErrorMessage(t('pinLocked' as any) as string);
      } else {
        setErrorMessage(t('errorOccurred' as any) as string);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xl overflow-y-auto" data-lenis-prevent>
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white dark:bg-[#1C1C1E] p-6 sm:p-8 rounded-[32px] w-full max-w-lg border border-black/5 dark:border-white/10 shadow-[0_32px_120px_rgba(0,0,0,0.5)] my-auto max-h-[96vh] overflow-hidden flex flex-col"
          >
            <div className="overflow-y-auto custom-scrollbar -mx-6 px-6 sm:-mx-8 sm:px-8 pb-2 pt-1" style={{ maxHeight: 'calc(96vh - 48px)' }} data-lenis-prevent>
              <div className="flex justify-between items-center mb-4">
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-black/40 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-black/60 transition-colors"
                title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <div className="flex gap-1 bg-zinc-100 dark:bg-black/40 p-1 rounded-full">
                {['uz', 'uz-cyrl', 'ru', 'en'].map(lang => (
                  <button 
                    key={lang}
                    onClick={() => setLanguage(lang as any)}
                    className={`h-8 px-2.5 rounded-full text-xs font-bold uppercase transition-all flex items-center justify-center ${language === lang ? 'bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-zinc-500 hover:bg-black/5 dark:hover:bg-white/5'}`}
                  >
                    {lang === 'uz-cyrl' ? 'УЗ' : lang}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6 lg:mb-8 text-center pt-2">
                <div className="inline-flex items-center justify-center mb-3 md:mb-4">
                  <Logo className="w-16 h-16 shadow-2xl shadow-cyan-500/20 rounded-2xl" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-black mb-2 sm:mb-3 text-zinc-900 dark:text-white tracking-tight">{t('registration')}</h2>
                <p className="text-zinc-500 dark:text-white/40 font-medium text-sm sm:text-base leading-relaxed px-2">{t('registrationDesc' as any)}</p>
            </div>

            <div className="space-y-4 sm:space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[11px] sm:text-[12px] font-black text-zinc-400 dark:text-zinc-500 uppercase ml-2 tracking-[0.15em]">{t('lastName' as any)}</label>
                      <div className="relative group">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                             <User className="w-4 h-4" />
                          </div>
                        <input 
                            value={formData.lastName} 
                            onChange={e => setFormData({...formData, lastName: e.target.value})} 
                            className="w-full p-3 sm:p-4 pl-11 sm:pl-12 bg-zinc-100 dark:bg-black/40 rounded-[20px] sm:rounded-[24px] border-2 border-transparent focus:border-blue-500/50 dark:border-white/5 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all text-zinc-900 dark:text-white font-bold text-sm sm:text-base" 
                        />
                      </div>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[11px] sm:text-[12px] font-black text-zinc-400 dark:text-zinc-500 uppercase ml-2 tracking-[0.15em]">{t('firstName' as any)}</label>
                      <div className="relative group">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                             <User className="w-4 h-4" />
                          </div>
                        <input 
                            value={formData.firstName} 
                            onChange={e => setFormData({...formData, firstName: e.target.value})} 
                            className="w-full p-3 sm:p-4 pl-11 sm:pl-12 bg-zinc-100 dark:bg-black/40 rounded-[20px] sm:rounded-[24px] border-2 border-transparent focus:border-blue-500/50 dark:border-white/5 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all text-zinc-900 dark:text-white font-bold text-sm sm:text-base" 
                        />
                      </div>
                  </div>
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-[11px] sm:text-[12px] font-black text-zinc-400 dark:text-zinc-500 uppercase ml-2 tracking-[0.15em]">{t('fatherName' as any)}</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                           <User className="w-4 h-4" />
                        </div>
                      <input 
                          value={formData.fatherName} 
                          onChange={e => setFormData({...formData, fatherName: e.target.value})} 
                          className="w-full p-3 sm:p-4 pl-11 sm:pl-12 bg-zinc-100 dark:bg-black/40 rounded-[20px] sm:rounded-[24px] border-2 border-transparent focus:border-blue-500/50 dark:border-white/5 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all text-zinc-900 dark:text-white font-bold text-sm sm:text-base" 
                      />
                    </div>
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-[11px] sm:text-[12px] font-black text-zinc-400 dark:text-zinc-500 uppercase ml-2 tracking-[0.15em]">{t('birthDate')}</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                           <Calendar className="w-4 h-4" />
                        </div>
                      <input 
                          type="date" 
                          min="1900-01-01"
                          max={new Date().toISOString().split('T')[0]}
                          value={formData.birthDate} 
                          onChange={e => setFormData({...formData, birthDate: e.target.value})} 
                          className="w-full p-3 sm:p-4 pl-11 sm:pl-12 bg-zinc-100 dark:bg-black/40 rounded-[20px] sm:rounded-[24px] border-2 border-transparent focus:border-blue-500/50 dark:border-white/5 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all text-zinc-900 dark:text-white font-bold text-sm sm:text-base [color-scheme:light] dark:[color-scheme:dark]" 
                      />
                    </div>
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-[11px] sm:text-[12px] font-black text-zinc-400 dark:text-zinc-500 uppercase ml-2 tracking-[0.15em]">{t('telegramUsername' as any)}</label>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 font-black text-lg">@</span>
                      <input 
                          value={formData.telegramUsername} 
                          onChange={e => setFormData({...formData, telegramUsername: e.target.value.replace('@', '')})} 
                          className="w-full p-3 sm:p-4 pl-9 sm:pl-10 bg-zinc-100 dark:bg-black/40 rounded-[20px] sm:rounded-[24px] border-2 border-transparent focus:border-blue-500/50 dark:border-white/5 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all text-zinc-900 dark:text-white font-bold text-sm sm:text-base" 
                      />
                    </div>
                </div>

                {needsPin && (
                  <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[11px] sm:text-[12px] font-black text-zinc-400 dark:text-zinc-500 uppercase ml-2 tracking-[0.15em]">{t('pinLabel' as any)}</label>
                      <input
                          value={pin}
                          onChange={e => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder={t('pinPlaceholder' as any)}
                          className="w-full p-3 sm:p-4 bg-zinc-100 dark:bg-black/40 rounded-[20px] sm:rounded-[24px] border-2 border-transparent focus:border-blue-500/50 dark:border-white/5 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all text-zinc-900 dark:text-white font-bold text-sm sm:text-base tracking-[0.3em] text-center"
                      />
                      <p className="text-[10px] sm:text-[11px] text-zinc-400 dark:text-zinc-500 font-medium ml-2">
                        {t('pinHelper' as any)}
                      </p>
                  </div>
                )}

                {errorMessage && (
                  <div className="p-3 sm:p-4 bg-red-500/10 border border-red-500/20 rounded-[16px] sm:rounded-[20px] text-red-600 dark:text-red-400 text-xs sm:text-sm font-bold">
                    {errorMessage}
                  </div>
                )}

                <div className="pt-2 sm:pt-4">
                  <button 
                      disabled={!isFormValid || loading}
                      onClick={handleSubmit} 
                      className="w-full py-4 sm:py-5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-[20px] sm:rounded-[24px] font-black text-lg sm:text-xl shadow-[0_15px_40px_rgba(37,99,235,0.3)] hover:shadow-[0_20px_50px_rgba(37,99,235,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale disabled:scale-100 flex items-center justify-center gap-2 sm:gap-3"
                  >
                      {loading ? (
                        <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                          {t('saveChanges')}
                        </>
                      )}
                  </button>
                  {needsPin && (
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={loading}
                      className="w-full mt-3 py-3.5 rounded-[20px] font-bold text-zinc-500 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      {t('cancel')}
                    </button>
                  )}
                  <p className="text-[10px] sm:text-[11px] text-center text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-[0.2em] mt-4 sm:mt-5">
                    {t('requiredFields' as any)}
                  </p>
                </div>
            </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
