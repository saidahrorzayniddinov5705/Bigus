/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import {
  Activity,
  Calendar,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  BrainCircuit,
  Plus,
  Trophy,
  Zap,
  Leaf,
  Droplets,
  Search,
  Settings,
  Bell,
  ArrowRight,
  Sun,
  Moon,
  Clock,
  Pill,
  ChevronDown,
  ChevronLeft,
  ShieldCheck,
  X,
  Heart,
  Flame,
  Gamepad2,
  MousePointer2,
  Map as MapIcon,
  Video,
  Play,
  RotateCcw,
  Trash2,
  BellRing,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PlantGrowth } from './PlantGrowth';
import { Logo } from './Logo';

import RegistrationProfileModal from './RegistrationProfileModal';
import { DoctorMessageCard, DoctorMessageModal, TelegramLinkButton } from './PatientExtras';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar
} from 'recharts';
import { Medication, AdherenceData, ChatMessage, UserStats, HealthTip, VideoLesson, VideoQuizQuestion } from '../types';
import { chatWithAssistant, generateHealthTip } from '../lib/gemini';
import { pillsPerDay, dayIndexFor, courseDate, takenOn, totalTaken, computeAdherence, computeAdherenceInRange, computeStreak, todaySummary, localDateStr } from '../lib/adherence';
import { cn, extractYoutubeId } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';
import { Language, translations } from '../lib/i18n';

import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api, poll, ApiError } from '../lib/api';
import { SHOP_ITEMS, REWARD_LIMITS } from '../lib/shop';

// Lazy-loaded: these pull in heavy libraries (TensorFlow.js/handpose, Leaflet maps)
// that most sessions never touch, so we keep them out of the main bundle.
const CameraCheck = lazy(() => import('./CameraCheck'));
const TaskView = lazy(() => import('./TaskView'));
import { FlyingCapsuleGame, CoinTapGame } from './Games';
import NewsReader, { longDate } from './NewsReader';
import VideoLessons from './VideoLessons';
import Shop from './Shop';
import Landing from './Landing';
import { validQuiz } from '../lib/quiz';

// Honest, empty-until-real-data defaults. These used to be filled with
// impressive-looking fake numbers (14-day streak, 450 coins, two demo
// medications), which briefly flashed for every new patient before their
// real (usually empty/zero) data loaded from Firestore — misleading and
// unprofessional for a medical app.
const EMPTY_STATS: UserStats = {
  streak: 0,
  xp: 0,
  hCoins: 0,
  level: 1,
  adherenceRate: 0
};

const DEFAULT_HEALTH_TIPS: any[] = [
  { id: '1', category: 'nutrition', contentKey: 'tip1', icon: 'Leaf' },
  { id: '2', category: 'activity', contentKey: 'tip2', icon: 'Zap' }
];

export default function Dashboard() {
  const { t, language, setLanguage } = useLanguage();
  const { currentUser, userData, me, applyMe, refreshMe, logout } = useAuth();
  const navigate = useNavigate();

  // Medications come from GET /api/me (refreshed every 20 s and after each action).
  // Courses the doctor stopped are not shown on the patient's plan.
  const [meds, setMeds] = useState<any[]>([]);
  const medsLoaded = !!me;
  useEffect(() => {
    setMeds((me?.meds || []).filter((m: any) => m.status !== 'stopped'));
  }, [me?.meds]);
  const aiEnabled = !!me?.features?.ai;
  const [stats, setStats] = useState<UserStats>(EMPTY_STATS);
  const [healthTips, setHealthTips] = useState<any[]>(DEFAULT_HEALTH_TIPS);
  const [isGeneratingTip, setIsGeneratingTip] = useState(false);

  // All schedule math lives in lib/adherence.ts now (it used to be
  // copy-pasted ~8 times here with slightly different rules each time).
  // `adherenceRate` is null when nothing has been due yet, instead of the
  // old misleading "100%" for a patient with no medication at all.
  const adherence = useMemo(() => computeAdherence(meds), [meds]);
  // Medicines the patient has to deal with today come first; finished courses
  // sink to the bottom. Inside a group the newest prescription is on top.
  const orderedMeds = useMemo(() => {
    const rank = (m: any) => {
      const i = dayIndexFor(m);
      if (i < 0) return 2;                                        // starts later
      if (i >= (m.durationDays || 0)) return 3;                   // course over
      return takenOn(m, i) < pillsPerDay(m) ? 0 : 1;              // today: doses left / all done
    };
    return [...meds].sort((a, b) => rank(a) - rank(b) || (b.createdAt || 0) - (a.createdAt || 0));
  }, [meds]);
  const adherenceRate = adherence.rate;
  const realStreak = useMemo(() => computeStreak(meds), [meds]);
  const weekly = useMemo(() => {
    const to = new Date();
    const from = new Date(); from.setDate(from.getDate() - 6);
    return computeAdherenceInRange(meds, from, to);
  }, [meds]);
  const today = useMemo(() => todaySummary(meds), [meds]);
  const [videoIds, setVideoIds] = useState<string[]>([]);
  useEffect(() => {
    api<any[]>('/api/videos').then(v => setVideoIds(Array.isArray(v) ? v.map(x => x.id) : [])).catch(() => {});
  }, []);
  const videoCount = videoIds.length;
  const videosDone = videoIds.filter(id => (userData?.completedVideos || []).includes(id)).length;
  const locale = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : language === 'uz-cyrl' ? 'uz-Cyrl-UZ' : 'uz-UZ';
  // Browsers render Uzbek short month names as "M10", so we spell them out.
  const UZ_MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
  const UZ_CYRL_MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const shortDate = (d: Date) => language === 'uz' ? `${d.getDate()} ${UZ_MONTHS[d.getMonth()]}`
    : language === 'uz-cyrl' ? `${d.getDate()} ${UZ_CYRL_MONTHS[d.getMonth()]}`
    : d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const categoryLabel = (cat?: string) => cat === 'article' ? t('catArticle' as any) : cat === 'announcement' ? t('catAnnouncement' as any) : t('catNews' as any);

  // A rough "you're doing as well as the top X%" tier for the motivational
  // card — based on the patient's REAL adherence rate above, not on how much
  // they've played the mini-games or chatted with the AI (which is what this
  // number used to be derived from, with no real connection to whether they
  // actually took their medication).
  const rateForTier = adherenceRate ?? 0;
  const adherenceTierPercent = rateForTier >= 95 ? 5 : rateForTier >= 85 ? 10 : rateForTier >= 70 ? 25 : rateForTier >= 50 ? 50 : 100;

  // The `level` field stored in Firestore is set once at registration and
  // never updated again anywhere in the app — it always reads "1". The level
  // actually shown to patients has always been computed live from XP, so we
  // use that same computation everywhere instead of the stale stored field.
  const currentLevel = Math.max(1, Math.floor(stats.xp / 100));
  const [news, setNews] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'plan' | 'ai' | 'insights' | 'shop' | 'news' | 'games' | 'tasks' | 'videos'>('plan');
  // New tab → start at the top of the page (the bottom nav is used far down).
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [activeTab]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: t('welcomeMessage'), timestamp: Date.now() }
  ]);

  useEffect(() => {
    if (messages.length === 1) {
      setMessages([{ role: 'assistant', content: t('welcomeMessage'), timestamp: messages[0].timestamp }]);
    }
  }, [language]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastToggleTime = useRef<number>(0);

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [activeGame, setActiveGame] = useState<'none' | 'flappy' | 'clicker'>('none');
  const [shownNotifications, setShownNotifications] = useState<string[]>([]);
  const [activeReminder, setActiveReminder] = useState<{ id: string, name: string, time: string } | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // Kept in sync on every render so async callers (below) always see the latest
  // stats without needing `stats` in their dependency array. A stable
  // updateGlobalCoins reference matters because it's passed into the mini-games'
  // animation-loop effects (see FlappyBirdGame) — if it changed on every coin
  // earned, those effects would tear down and restart their rAF loop mid-game.
  const statsRef = useRef(stats);
  statsRef.current = stats;

  // All rewards are granted by the server, which also enforces the daily
  // limits (games, walking gifts) — the browser can't award itself coins.
  const applyUser = useCallback((user: any) => { if (user) applyMe({ user }); }, [applyMe]);

  const GAME_DAILY_LIMIT = REWARD_LIMITS.gamesPerDay;
  const gameEarnedRef = useRef(0);
  const [gameEarnedToday, setGameEarnedToday] = useState(0);
  useEffect(() => {
    const v = me?.rewardsToday?.games ?? 0;
    if (v > gameEarnedRef.current || pendingGameCoins.current === 0) {
      gameEarnedRef.current = v;
      setGameEarnedToday(v);
    }
  }, [me?.rewardsToday?.games]);

  // Taps are counted locally and sent in small batches (not one request per tap).
  const pendingGameCoins = useRef(0);
  const flushTimer = useRef<number | null>(null);
  const flushGameCoins = useCallback(async () => {
    flushTimer.current = null;
    const amount = pendingGameCoins.current;
    if (amount <= 0) return;
    pendingGameCoins.current = 0;
    try {
      const r = await api<any>('/api/rewards/game', { body: { amount } });
      applyMe({ user: r.user, rewardsToday: r.rewardsToday });
      gameEarnedRef.current = r.rewardsToday.games;
      setGameEarnedToday(r.rewardsToday.games);
    } catch (e) {
      console.error('Game reward failed', e);
    }
  }, [applyMe]);
  useEffect(() => () => { if (pendingGameCoins.current > 0) flushGameCoins(); }, [flushGameCoins]);

  const earnFromGame = useCallback((amount: number): number => {
    if (!currentUser) return 0;
    const granted = Math.max(0, Math.min(amount, GAME_DAILY_LIMIT - gameEarnedRef.current));
    if (granted === 0) return 0;
    gameEarnedRef.current += granted;
    setGameEarnedToday(gameEarnedRef.current);
    statsRef.current = { ...statsRef.current, hCoins: statsRef.current.hCoins + granted };
    setStats(statsRef.current);
    pendingGameCoins.current += granted;
    if (pendingGameCoins.current >= 40) flushGameCoins();
    else if (!flushTimer.current) flushTimer.current = window.setTimeout(flushGameCoins, 1500);
    return granted;
  }, [currentUser, flushGameCoins]);

  const handleWalkGift = useCallback(async (amount: number) => {
    const r = await api<any>('/api/rewards/walk-gift', { body: { amount } });
    applyMe({ user: r.user, rewardsToday: r.rewardsToday });
    return r.granted as number;
  }, [applyMe]);
  const handleWalkComplete = useCallback(async () => {
    const r = await api<any>('/api/rewards/walk-complete', { body: {} });
    applyMe({ user: r.user, rewardsToday: r.rewardsToday });
    return r.granted as number;
  }, [applyMe]);

  // The server checks the price and balance and records the request for staff.
  const handleRedeem = useCallback(async (itemId: string): Promise<boolean> => {
    try {
      const r = await api<any>('/api/shop/redeem', { body: { itemId } });
      applyUser(r.user);
      refreshMe();
      return true;
    } catch (e) {
      console.error("Failed to redeem item", e);
      alert(t('errorOccurred' as any));
      return false;
    }
  }, [applyUser, refreshMe, t]);

  // Apply dark mode class
  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Scroll to bottom of messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    const load = () => api<any[]>('/api/news').then(setNews).catch(e => console.error('News load error:', e));
    load();
    return poll(load, 60_000);
  }, []);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [pendingMedToggle, setPendingMedToggle] = useState<{medId: string, dayIndex: number} | null>(null);

  // Helper for localized name or fallback
  const getLangVal = (keyOrObj: any) => {
    if (!keyOrObj) return '';
    if (typeof keyOrObj === 'string') {
      const translation = (translations as any)[keyOrObj];
      if (translation && translation[language]) return translation[language];
      return keyOrObj;
    }
    return keyOrObj[language] || keyOrObj['uz'] || '';
  };

  const handleGenerateTip = async () => {
    if (isGeneratingTip) return;
    setIsGeneratingTip(true);
    try {
      const medNames = meds.map(med => getLangVal(med.customName || med.nameKey)).filter(Boolean);
      const tipText = await generateHealthTip(medNames, language);
      if (tipText) {
        setHealthTips(prev => [{ id: `ai-${Date.now()}`, content: tipText, isAiGenerated: true }, ...prev]);
      } else {
        alert(t('errorOccurred' as any));
      }
    } finally {
      setIsGeneratingTip(false);
    }
  };

  useEffect(() => {
    // Request notification permission
    if ("Notification" in window && Notification.permission !== "denied" && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const checkNotifications = () => {
      // Don't interrupt if one is already showing
      if (activeReminder || meds.length === 0) return;

      const now = new Date();
      const currentHour = String(now.getHours()).padStart(2, '0');
      const currentMin = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${currentHour}:${currentMin}`;
      const todayStr = localDateStr(now);

      meds.forEach(med => {
        if (med.scheduledTimes && Array.isArray(med.scheduledTimes)) {
          med.scheduledTimes.forEach((time: string) => {
            const notificationId = `${med.id}-${todayStr}-${time}`;
            if (time === currentTime && !shownNotifications.includes(notificationId)) {
              const medName = getLangVal(med.customName || med.nameKey);

              // 1. Try Browser Notification
              if ("Notification" in window && Notification.permission === "granted") {
                const title = t('medicationReminder' as any);
                const body = `${medName} - ${t('takeDoseMessage' as any)}`;
                new Notification(title, { body, icon: '/logo.png' });
              }

              // 2. ALWAYS show in-app reminder (more reliable in iframes)
              setActiveReminder({ id: med.id, name: medName, time });

              // 3. Telegram reminders are sent by the server now (even when the app is closed).

              // 4. Play a subtle sound if possible (optional but good)
              try {
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audio.play().catch(() => {}); // catch blocks for muted browsers
              } catch(e) {}

              setShownNotifications(prev => [...prev, notificationId]);
            }
          });
        }
      });
    };

    // Check more frequently (every 15 seconds) to ensure we don't miss the minute boundary
    const interval = setInterval(checkNotifications, 15000);
    return () => clearInterval(interval);
  }, [meds, shownNotifications, language, t, activeReminder]);
  const [selectedHistoryMed, setSelectedHistoryMed] = useState<{med: any, dayIndex: number, timestamp: number} | null>(null);
  const [selectedNews, setSelectedNews] = useState<any | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<{[key: number]: number}>({});
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);
  const [showQuizResult, setShowQuizResult] = useState<{correct: number, total: number, reward: number} | null>(null);
  const [showAllNewsModal, setShowAllNewsModal] = useState(false);

  // Reset the quiz only when another article is opened (not when the user's
  // data refreshes — that used to wipe the result right after submitting).
  useEffect(() => {
    if (selectedNews) {
       setQuizAnswers({});
       setShowQuizResult(null);
    }
  }, [selectedNews?.id]);
  useEffect(() => {
    if (selectedNews) setQuizSubmitted(userData?.completedQuizzes?.includes(selectedNews.id) || false);
  }, [selectedNews?.id, userData?.completedQuizzes]);
  const closeNews = useCallback(() => setSelectedNews(null), []);

  const handleQuizSubmit = async () => {
      const quizzes = validQuiz(selectedNews);
      if (!selectedNews || quizzes.length === 0) return;
      if (userData?.completedQuizzes?.includes(selectedNews.id)) return;

      try {
          const answers = quizzes.map((_: any, i: number) => quizAnswers[i]);
          const r = await api<any>(`/api/news/${selectedNews.id}/quiz`, { body: { answers } });
          applyUser(r.user);
          setQuizSubmitted(true);
          setShowQuizResult({ correct: r.correct, total: r.total, reward: r.reward });
      } catch (e) {
          console.error("Quiz result save error", e);
          alert(t('errorOccurred' as any));
      }
  };

  // Only TODAY's dose can be marked. The old timeline let a patient tap any
  // day — including future ones — and mark them "taken", which inflated the
  // adherence numbers their doctor sees.
  const toggleMed = (medId: string, dayIndex: number) => {
    const med = meds.find(m => m.id === medId);
    if (!med) return;

    if (takenOn(med, dayIndex) >= pillsPerDay(med)) {
       const historyEntry = med.history ? med.history.slice().reverse().find((h: any) => h.dayIndex === dayIndex && h.action === 'taken') : null;
       if (historyEntry) {
         setSelectedHistoryMed({ med, dayIndex, timestamp: historyEntry.timestamp });
       }
       return;
    }
    if (dayIndex !== dayIndexFor(med) && !userData?.rehearsal) return;
    setPendingMedToggle({ medId, dayIndex });
    setIsCameraOpen(true);
  };

  const applyMedToggle = async (medId: string, dayIndex: number) => {
    try {
      const r = await api<any>('/api/doses', { body: { medId, dayIndex } });
      applyMe({ user: r.user, meds: r.meds });
    } catch (e) {
      console.error("Failed to save dose", e);
      const code = e instanceof ApiError ? e.code : '';
      alert(code === 'not-today' ? t('futureDayHint' as any) : t('errorOccurred' as any));
      refreshMe();
    }
  };

  const handleCameraVerify = (success: boolean) => {
     setIsCameraOpen(false);
     if (success && pendingMedToggle) {
        applyMedToggle(pendingMedToggle.medId, pendingMedToggle.dayIndex);
     }
     setPendingMedToggle(null);
  };

  useEffect(() => {
    if (userData) {
      setStats(prev => ({
        ...prev,
        fullName: userData.fullName || prev.fullName || 'User',
        hCoins: userData.hCoins ?? prev.hCoins,
        xp: userData.xp ?? prev.xp,
        level: userData.level ?? prev.level,
        streak: userData.streak ?? prev.streak
      }));

      // Check for incomplete registration, only for patients
      if (userData.role === 'patient' && !userData.isProfileComplete) {
        setIsRegistrationModalOpen(true);
      } else {
        setIsRegistrationModalOpen(false);
      }
    }
  }, [userData]);

  // A doctor who opens the patient page is sent to the admin panel. This
  // used to call navigate() during render, which React warns about.
  useEffect(() => {
    if (userData?.role === 'doctor') navigate('/admin');
  }, [userData?.role]);

  // The old "invite friends" card showed a fixed fake referral link
  // (a hard-coded personal link) and promised 500 H-Coins that nothing paid
  // out; the Copy button did nothing. Now it really shares the app's address.
  const handleShareApp = async () => {
    const url = window.location.origin + window.location.pathname;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'BIGUS', text: t('shareJourney'), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      alert(t('linkCopied' as any));
    } catch (e) {
      // user cancelled the share sheet — nothing to do
    }
  };

  const handleSendMessage = async (preset?: string) => {
    const text = (typeof preset === 'string' ? preset : userInput).trim();
    if (!text || isTyping) return;
    const newMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, newMsg]);
    setUserInput('');
    setIsTyping(true);

    const history = messages.map(m => ({
      role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model',
      parts: [{ text: m.content }]
    }));

    const result = await chatWithAssistant(history, text, language);
    const reply = 'text' in result ? result.text : t((result.reason === 'not-configured' ? 'aiNotConfigured' : 'aiError') as any);
    setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: Date.now() }]);
    setIsTyping(false);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] dark:bg-[#020617] flex items-center justify-center p-6 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] relative overflow-hidden">
        <RegistrationProfileModal isOpen={isRegistrationModalOpen} onClose={() => setIsRegistrationModalOpen(false)} />
        {/* Animated Mesh Gradients — plain CSS animation, see .blob-* in index.css */}
        <div className="blob-1 absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/30 dark:bg-blue-600/30 blur-[60px] pointer-events-none" />
        <div className="blob-2 absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-400/30 dark:bg-cyan-500/30 blur-[60px] pointer-events-none" />
        <div className="blob-3 absolute top-[20%] right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-500/20 dark:bg-indigo-600/20 blur-[60px] pointer-events-none" />

        {/* Noise overlay for premium texture */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>

        {/* Top bar controls */}
        <div className="absolute top-6 right-6 flex items-center gap-3 z-50">
          <div className="relative">
            <button
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] text-xs font-bold text-zinc-700 dark:text-white uppercase outline-none shadow-sm backdrop-blur-md border border-white/40 dark:border-white/10"
            >
              <span className="w-5 text-center">{language === 'uz-cyrl' ? 'уз' : language}</span>
              <ChevronDown className={cn("w-3.5 h-3.5 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]", isLangMenuOpen && "rotate-180")} />
            </button>
            <AnimatePresence>
              {isLangMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsLangMenuOpen(false)}></div>
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute right-0 top-full mt-2 w-28 bg-white/90 dark:bg-[#2C2C2E]/90 backdrop-blur-lg border border-black/5 dark:border-white/10 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.15)] z-50 overflow-hidden py-1.5 p-1.5"
                  >
                    {(['uz', 'uz-cyrl', 'ru', 'en'] as Language[]).map(lang => (
                      <button
                        key={lang}
                        onClick={() => { setLanguage(lang); setIsLangMenuOpen(false); }}
                        className={cn(
                          "w-full text-left px-4 py-2.5 text-sm font-semibold uppercase rounded-xl transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                          language === lang ? "bg-black/5 dark:bg-white/10 text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5"
                        )}
                      >
                        {lang === 'uz-cyrl' ? 'УЗ' : lang}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20 rounded-full transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] relative border border-white/40 dark:border-white/10 shadow-sm backdrop-blur-md flex items-center justify-center w-[36px] h-[36px]"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-white" strokeWidth={2} /> : <Moon className="w-4 h-4 text-zinc-700" strokeWidth={2} />}
          </button>
        </div>

        <Landing t={t} onLogin={() => setIsRegistrationModalOpen(true)} />
      </div>
    );
  }

  if (userData?.role === 'doctor') return null;

  return (
    <div className="min-h-screen text-zinc-900 dark:text-white font-sans selection:bg-blue-500/30 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] bg-[#F2F2F7] dark:bg-[#020617] relative overflow-hidden">
      <RegistrationProfileModal isOpen={isRegistrationModalOpen} onClose={() => setIsRegistrationModalOpen(false)} />
      {/* Animated Mesh Gradients for Main App — plain CSS animation, see .blob-* in index.css */}
      <div className="blob-4 absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/20 dark:bg-blue-600/20 blur-[60px] pointer-events-none" />
      <div className="blob-5 absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-400/20 dark:bg-cyan-500/20 blur-[60px] pointer-events-none" />
      <div className="blob-6 absolute top-[30%] right-[10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 dark:bg-purple-600/10 blur-[60px] pointer-events-none" />

      {/* Noise overlay for premium texture */}
      <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04] pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>

      {/* Premium Header / Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-[70px] md:h-[80px] glass-panel border-b-0 z-50">
        <div className="max-w-[1600px] mx-auto h-full px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex items-center justify-center">
              <Logo className="w-10 h-10 md:w-12 md:h-12 shadow-lg shadow-blue-500/30 rounded-2xl" />
            </div>
            <span className="hidden md:inline font-extrabold text-lg sm:text-xl md:text-2xl tracking-tight tracking-tighter text-zinc-900 dark:text-white drop-shadow-sm transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-400 dark:from-blue-400 dark:to-cyan-300">BIGUS</span>
            </span>
          </div>

          <div className="hidden lg:flex items-center p-1.5 rounded-full bg-zinc-100/50 dark:bg-white/5 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-inner transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
            {['plan', 'news', 'ai', 'tasks', 'videos', 'insights', 'shop', 'games'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={cn("relative px-6 py-2 text-[15px] font-bold rounded-full transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]", activeTab === tab ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-blue-100/60 hover:text-zinc-800 dark:hover:text-white")}
              >
                {activeTab === tab && (
                  <motion.div
                    layoutId="active-nav-tab"
                    className="absolute inset-0 bg-white dark:bg-white/10 shadow-sm border border-white/60 dark:border-white/20 rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center justify-center gap-1.5">
                  {tab === 'plan' ? t('dashboard') : tab === 'news' ? (t('news') || 'Yangiliklar') : tab === 'ai' ? (
                     <>BIGUS AI <Zap className="w-3.5 h-3.5 md:w-4 md:h-4 text-cyan-500 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" /></>
                  ) : tab === 'tasks' ? t('tasks' as any) : tab === 'videos' ? t('videoLessons' as any) : tab === 'insights' ? t('insights') : tab === 'shop' ? t('shop' as any) : t('games' as any)}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 md:gap-5">
          <div className="relative">
            <button
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-zinc-100/50 dark:bg-white/10 hover:bg-zinc-300/50 dark:hover:bg-white/20 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] text-[11px] md:text-sm font-bold text-zinc-700 dark:text-white uppercase outline-none"
            >
              <span className="w-5 text-center">{language === 'uz-cyrl' ? 'уз' : language}</span>
              <ChevronDown className={cn("w-3.5 h-3.5 md:w-4 md:h-4 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]", isLangMenuOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {isLangMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsLangMenuOpen(false)}></div>
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute right-0 top-full mt-2 w-28 bg-white/90 dark:bg-[#2C2C2E]/90 backdrop-blur-lg border border-black/5 dark:border-white/10 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.15)] z-50 overflow-hidden py-1.5 p-1.5"
                  >
                    {(['uz', 'uz-cyrl', 'ru', 'en'] as Language[]).map(lang => (
                      <button
                        key={lang}
                        onClick={() => { setLanguage(lang); setIsLangMenuOpen(false); }}
                        className={cn(
                          "w-full text-left px-4 py-2.5 text-sm font-semibold uppercase rounded-xl transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                          language === lang ? "bg-black/5 dark:bg-white/10 text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5"
                        )}
                      >
                        {lang === 'uz-cyrl' ? 'УЗ' : lang}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          <button onClick={() => setActiveTab('shop')} className="flex items-center gap-1.5 glass-button px-2 md:px-4 py-2 rounded-full h-[36px] md:h-[40px] hover:scale-105 transition-transform active:scale-95">
             <Trophy className="w-3.5 h-3.5 md:w-4 md:h-4 text-yellow-500" strokeWidth={2.5} />
             <span className="text-[10px] md:text-[12px] font-black font-mono tracking-wider text-zinc-900 dark:text-white">{stats.hCoins}</span>
          </button>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-1.5 md:p-2.5 bg-white dark:bg-white/10 hover:bg-zinc-100 dark:hover:bg-white/20 rounded-full transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] relative border border-white/40 dark:border-white/10 shadow-sm backdrop-blur-md"
          >
            {isDarkMode ? <Sun className="w-4 h-4 md:w-5 md:h-5 text-white" strokeWidth={2} /> : <Moon className="w-4 h-4 md:w-5 md:h-5 text-zinc-700" strokeWidth={2} />}
          </button>

          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-[#FCD34D] to-[#F59E0B] text-amber-950 flex items-center justify-center text-[11px] md:text-[14px] font-bold shadow-lg shadow-amber-500/30 border-2 border-white/50 dark:border-white/20 shrink-0 hover:scale-110 transition-transform active:scale-95">
            {stats.fullName?.split(' ').map(n => n[0]).join('') || 'U'}
          </button>
        </div>
      </div>
    </nav>

      <main className="pt-24 md:pt-32 pb-32 md:pb-16 px-4 md:px-8 max-w-[1600px] mx-auto">
        {activeTab === 'plan' && (
        <header className="mb-10 md:mb-16 relative group">
          <div className="absolute inset-0 bg-yellow-500/10 dark:bg-yellow-500/15 rounded-[32px] md:rounded-[48px] blur-[40px] md:blur-[60px] opacity-100 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"></div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="glass-panel rounded-[32px] md:rounded-[48px] p-6 sm:p-10 md:p-12 lg:p-16 relative z-10 border-t border-white/60 dark:border-white/20 overflow-hidden"
          >
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 md:gap-12">
              <div className="relative z-10 flex-1 w-full text-center md:text-left">
                <div className="flex flex-col items-center md:items-start gap-4">
                  <h1 className="text-[32px] sm:text-[44px] md:text-[56px] lg:text-[72px] leading-[1.1] md:leading-[1.05] font-black tracking-tighter text-zinc-900 dark:text-white drop-shadow-sm transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
                    {t('welcomeBack')} <br className="hidden md:block" />
                    <span className="gradient-text gradient-yellow">{stats.fullName || t('user')}</span>
                  </h1>
                  <div className="flex items-center gap-3 bg-blue-500/10 dark:bg-blue-500/5 border border-blue-500/20 px-4 py-2 rounded-2xl backdrop-blur-md">
                      <Trophy className="w-5 h-5 text-blue-500 hover:scale-110 transition-transform" strokeWidth={2.5} />
                     <div className="flex flex-col">
                        <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 capitalize tracking-widest leading-none mb-1">{t('consistencyLevel')}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[16px] font-black text-zinc-900 dark:text-white font-mono leading-none">{t('lvl')} {currentLevel}</span>
                          <div className="w-24 md:w-32 h-1.5 bg-zinc-100 dark:bg-black/20 rounded-full overflow-hidden relative">
                             <motion.div
                               initial={{ width: 0 }}
                               animate={{ width: `${(stats.xp % 100)}%` }}
                               transition={{ duration: 1.5, ease: "easeOut" }}
                               className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full shadow-[0_0_10px_rgba(56,189,248,0.5)]"
                             ></motion.div>
                          </div>
                        </div>
                     </div>
                  </div>
                </div>
                {!medsLoaded ? (
                  <p className="text-[15px] md:text-[18px] text-zinc-400 mt-4 md:mt-6 font-medium mx-auto md:mx-0">{t('loading')}...</p>
                ) : <p className="text-[15px] md:text-[18px] lg:text-[20px] text-zinc-600 dark:text-blue-100/80 mt-4 md:mt-6 font-medium leading-relaxed max-w-2xl transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] mx-auto md:mx-0">
                  {t('youHave')} <span className="text-cyan-700 dark:text-cyan-300 font-bold px-2 md:px-3 py-1 md:py-1.5 bg-cyan-100/80 dark:bg-cyan-900/40 rounded-lg md:rounded-xl border border-cyan-200 dark:border-cyan-400/30 inline-block mx-1 shadow-inner">{today.pending} {t('pendingDosesPart1')}</span> {t('pendingDosesPart2')}{' '}
                  {t('dailyPlanPart1')} {today.activeCount} {t('dailyPlanPart2')} {today.dosesPerDay} {t('dailyPlanPart3')}
                </p>}
              </div>
              <div className="glass-panel px-5 md:px-8 py-3.5 md:py-6 rounded-[24px] md:rounded-[32px] flex items-center gap-4 md:gap-6 shadow-xl relative z-10 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] shrink-0 w-full md:w-auto overflow-visible group hover:border-cyan-400/50">
                 <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-400/5 dark:from-blue-500/10 dark:to-cyan-400/10 rounded-[24px] md:rounded-[32px]"></div>
                 <div className="w-10 h-10 md:w-16 md:h-16 bg-blue-100/80 dark:bg-blue-500/20 rounded-xl md:rounded-2xl flex items-center justify-center border border-blue-200/50 dark:border-blue-400/30 shadow-[0_0_30px_rgba(59,130,246,0.1)] dark:shadow-[0_0_30px_rgba(59,130,246,0.3)] backdrop-blur-md group-hover:scale-110 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-900/40 transition-all duration-500">
                   <Activity className="w-5 h-5 md:w-8 md:h-8 text-cyan-500 dark:text-cyan-400 group-hover:animate-pulse" strokeWidth={2.5}/>
                 </div>
                 <div className="relative z-10 text-left">
                    <p className="text-[10px] md:text-[13px] font-bold text-zinc-500 dark:text-blue-200/60 tracking-widest uppercase mb-0 md:mb-1">{t('treatmentAdherence')}</p>
                    <div>
                      <p className="text-[18px] md:text-[28px] font-black text-zinc-900 dark:text-white tracking-tight drop-shadow-md">{adherenceRate === null ? '—' : `${adherenceRate}%`} <span className="text-[12px] md:text-[16px] text-zinc-500 dark:text-zinc-400 font-bold ml-1">{t('accuracyTitle')}</span></p>
                      <p className="text-[10px] md:text-[12px] text-cyan-600 dark:text-cyan-400 mt-0.5 font-bold">{adherenceRate === null ? t('noDataYet' as any) : (rateForTier >= 95 ? t('tierExcellent' as any) : rateForTier >= 85 ? t('tierGood' as any) : rateForTier >= 70 ? t('tierFair' as any) : t('tierLow' as any))}</p>
                    </div>
                 </div>
              </div>
            </div>
          </motion.div>
        </header>
        )}

        <div className="grid grid-cols-12 gap-6 xl:gap-8">

          {/* Main Content Area */}
          <div className="col-span-12 lg:col-span-8 space-y-6 md:space-y-8">
            <AnimatePresence mode="wait">
              {activeTab === 'plan' ? (
                <motion.div
                  key="plan"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6 md:space-y-8"
                >
                  <section className="glass-panel rounded-[32px] md:rounded-[40px] p-5 sm:p-8 md:p-10">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-8">
                        <div>
                          <h2 className="text-[24px] md:text-[28px] font-black tracking-tight text-zinc-900 dark:text-white uppercase">{t('activeRegimens')}</h2>
                          <p className="text-zinc-500 dark:text-blue-100/70 text-[14px] md:text-[16px] mt-1 md:mt-2 font-medium">{t('trackProgress')}</p>
                        </div>
                        <div
                          className="w-full sm:w-auto px-6 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-[20px] sm:rounded-full text-[15px] md:text-[16px] font-bold shadow-xl shadow-blue-500/30 flex items-center justify-center gap-2 border border-white/20 cursor-default"
                        >
                          {t('doctorSupervised' as any)}
                        </div>
                      </div>

                      <div className="space-y-6">
                        {!medsLoaded && (
                          <div className="flex justify-center py-12">
                            <div className="w-10 h-10 border-4 border-zinc-200 dark:border-zinc-700 border-t-cyan-500 rounded-full animate-spin" />
                          </div>
                        )}
                        {medsLoaded && meds.length === 0 && (
                          <div className="text-center py-12 px-6 glass-panel rounded-[32px] border border-white/20">
                            <h3 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">{t('noPlanTitle' as any)}</h3>
                            <p className="text-zinc-500 dark:text-blue-100/70 font-medium max-w-lg mx-auto">
                              {t('noPlanDesc' as any)}
                            </p>
                          </div>
                        )}
                        {orderedMeds.map((med, index) => (
                          <motion.div
                            key={med.id}
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                            className="group relative"
                          >
                            <div className="absolute inset-0 bg-blue-500/10 rounded-[32px] scale-[0.98] blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"></div>
                            <div className="relative glass-panel border border-black/5 dark:border-white/10 rounded-[28px] md:rounded-[32px] p-5 sm:p-6 md:p-8 hover:border-blue-400/40 shadow-[0_8px_32px_rgba(0,0,0,0.05)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)] hover:shadow-[0_16px_48px_rgba(30,58,138,0.1)] dark:hover:shadow-[0_16px_48px_rgba(30,58,138,0.3)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
                              <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row justify-between gap-6 md:gap-8">
                                <div className="flex flex-col sm:flex-row gap-6">
                                  <div className="w-full sm:w-[100px] h-[100px] flex-shrink-0 flex items-center justify-center p-2 rounded-2xl md:rounded-3xl bg-blue-50/50 dark:bg-white/5 border border-white/40 dark:border-white/10 shadow-inner">
                                    <PlantGrowth
                                      progress={med.totalPills > 0 ? Math.min(1, totalTaken(med) / med.totalPills) : 0}
                                      className="w-full h-full max-w-[80px]"
                                    />
                                  </div>
                                  <div className="min-w-0 sm:min-w-[180px]">
                                    <div className="flex items-center gap-3 mb-2">
                                      <span className="px-3 py-1 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-blue-200/50 dark:border-blue-400/20">
                                        {t(med.typeKey as any)}
                                      </span>
                                      <span className="text-[11px] font-bold text-zinc-400 dark:text-blue-200/30">{med.dosage}</span>
                                    </div>
                                    <h3 className="text-[20px] md:text-[28px] font-black text-zinc-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] uppercase tracking-tight truncate">{getLangVal(med.customName || med.nameKey)}</h3>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                      <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-zinc-400 dark:text-blue-200/40" />
                                        <span className="text-[13px] font-bold text-zinc-500 dark:text-blue-200/60 uppercase">{t(med.frequencyKey as any)}</span>
                                      </div>
                                      {med.scheduledTimes && med.scheduledTimes.length > 0 && (
                                        <div className="flex items-center gap-2 px-2 py-0.5 bg-cyan-500/10 rounded-md border border-cyan-500/20">
                                          <span className="text-[11px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-tighter">
                                            {med.scheduledTimes.join(' • ')}
                                          </span>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-3">
                                        <div className="w-[80px] h-2.5 bg-white dark:bg-white/5 rounded-full overflow-hidden border border-black/5 dark:border-white/5 shadow-inner">
                                          <motion.div
                                            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_0_12px_rgba(56,189,248,0.4)]"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${med.totalPills > 0 ? Math.min(100, (totalTaken(med) / med.totalPills) * 100) : 0}%` }}
                                            transition={{ duration: 1, delay: 0.2 }}
                                          />
                                        </div>
                                        <span className="text-[12px] font-mono font-bold text-zinc-500 dark:text-blue-200/80">
                                          {totalTaken(med)}/{med.totalPills}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex-1 md:max-w-[440px] min-w-0">
                                      <div className="flex justify-between items-center mb-3 px-2">
                                    <span className="text-[12px] font-bold text-zinc-500 dark:text-blue-200/60 uppercase tracking-wider">{t('progressTimeline')}</span>
                                    <span className="text-[12px] font-bold text-cyan-600 dark:text-cyan-400">{med.durationDays} {t('daysTotal')}</span>
                                  </div>
                                  <div className="w-full overflow-hidden rounded-3xl relative">
                                    <div className="overflow-x-auto pb-4 pt-1 px-1 -mx-1 custom-scrollbar">
                                    <div className="flex gap-2.5 items-center px-1">
                                      {(med.pillsTaken || []).map((_: any, i: number) => {
                                        const ppd = pillsPerDay(med);
                                        const takenNum = takenOn(med, i);
                                        const isCompleted = takenNum >= ppd;
                                        const date = courseDate(med, i);
                                        const dateLabel = date ? String(date.getDate()) : `D${i+1}`;
                                        const todayIdx = dayIndexFor(med);
                                        const isToday = i === todayIdx;
                                        const isFuture = i > todayIdx;
                                        const isPast = i < todayIdx;
                                        return (
                                          <button
                                            key={i}
                                            onClick={() => toggleMed(med.id, i)}
                                            disabled={!isToday && !isCompleted && !userData?.rehearsal}
                                            title={isFuture ? t('futureDayHint' as any) : (isPast && !isCompleted) ? t('missedDayHint' as any) : (date ? date.toLocaleDateString(locale) : undefined)}
                                            aria-label={date ? date.toLocaleDateString(locale) : `D${i+1}`}
                                            className={cn(
                                              "group w-[42px] h-[54px] md:w-[48px] md:h-[60px] rounded-[14px] md:rounded-[16px] shrink-0 flex flex-col items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] shadow-sm relative overflow-hidden backdrop-blur-md",
                                              isCompleted
                                                ? "cursor-pointer shadow-[0_4px_15px_rgba(56,189,248,0.4)] hover:shadow-lg border border-white/20"
                                                : isToday
                                                  ? "cursor-pointer bg-white/80 dark:bg-white/10 border-2 border-cyan-400 text-cyan-500 dark:text-cyan-300 shadow-inner ring-4 ring-cyan-400/25 animate-pulse hover:animate-none hover:scale-110 hover:bg-cyan-500 hover:text-white hover:border-cyan-500 dark:hover:bg-cyan-500 active:scale-95"
                                                  : userData?.rehearsal
                                                    ? "cursor-pointer bg-white/80 dark:bg-white/10 border-2 border-dashed border-cyan-300 text-cyan-500 dark:text-cyan-300 hover:scale-110 hover:bg-cyan-500 hover:text-white active:scale-95"
                                                  : isFuture
                                                    ? "bg-white/40 dark:bg-white/[0.03] border border-black/5 dark:border-white/5 text-zinc-400 dark:text-blue-100/30 cursor-not-allowed"
                                                    : "bg-red-50/70 dark:bg-red-500/5 border border-red-200/60 dark:border-red-400/20 text-red-300 dark:text-red-300/40 cursor-not-allowed"
                                            )}
                                          >
                                            {/* Water-like progress indicator */}
                                            {takenNum > 0 && (
                                              <motion.div
                                                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500 to-cyan-400 animate-pulse-slow"
                                                initial={{ height: 0 }}
                                                animate={{ height: `${Math.min(1, takenNum / ppd) * 100}%` }}
                                                transition={{ type: 'spring', stiffness: 50, damping: 15 }}
                                              >
                                                <div className="absolute top-0 inset-x-0 h-1.5 bg-white/30 blur-[1px]"></div>
                                                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-30 mix-blend-overlay"></div>
                                              </motion.div>
                                            )}

                                            <div className="z-10 relative drop-shadow-sm text-white flex justify-center items-center">
                                              {isCompleted ? (
                                                <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-white" fill="currentColor" stroke="rgba(255,255,255,0.2)" strokeWidth={1}/>
                                              ) : (takenNum > 0 ? (
                                                <span className="text-[12px] md:text-[14px] font-extrabold text-white tracking-widest">{takenNum}/{ppd}</span>
                                              ) : (
                                                <span className={cn("text-[12px] md:text-[13px] font-black", isToday ? "text-cyan-600 dark:text-cyan-300 group-hover:text-white" : "text-current")}>{dateLabel}</span>
                                              ))}
                                            </div>

                                            {isCompleted && <div className="absolute inset-0 bg-white/20 opacity-0 hover:opacity-100 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] z-20"></div>}

                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  </div>
                                </div>
                              </div>

                              {med.instructions && (
                                <div className="mt-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-400/20 text-[14px] text-amber-900 dark:text-amber-100 font-medium">
                                  <span className="block text-[11px] font-black uppercase tracking-widest mb-1 text-amber-600 dark:text-amber-300">{t('doctorInstructions' as any)}</span>
                                  {med.instructions}
                                </div>
                              )}
                              {med.scientificContextKey && (
                                <div className="mt-8">
                                  <div className="relative p-6 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-500/10 dark:to-cyan-500/5 rounded-[24px] flex items-start gap-5 border border-black/5 dark:border-white/10 shadow-inner backdrop-blur-md">
                                    <div className="w-12 h-12 rounded-[16px] bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(59,130,246,0.1)] dark:shadow-[0_0_15px_rgba(59,130,246,0.3)] border border-blue-200 dark:border-blue-400/30">
                                      <BrainCircuit className="w-6 h-6 text-cyan-500 dark:text-cyan-400" strokeWidth={2.5} />
                                    </div>
                                    <div>
                                      <p className="text-[15px] leading-relaxed text-zinc-700 dark:text-white/90 font-medium">
                                        <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-300 uppercase text-[11px] tracking-widest block mb-1.5">{t('aiContext')}</span>
                                        {getLangVal(med.scientificContextKey)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                  </section>

                  <DoctorMessageCard t={t} onOpen={() => setIsReportOpen(true)} />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 xl:gap-8">
                    <motion.div
                      initial={{ opacity: 0, y: 40 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-50px" }}
                      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      className="glass-panel text-zinc-900 dark:text-white rounded-[32px] md:rounded-[40px] p-6 md:p-10 relative overflow-hidden group border border-white/60 dark:border-white/20"
                    >
                        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#EC4899] to-[#4F46E5] rounded-full blur-[60px] opacity-20 dark:opacity-40 group-hover:opacity-40 dark:group-hover:opacity-60 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"></div>
                      {(() => {
                        // Tier and wording follow the patient's real adherence. The old
                        // card said "Great result!" even at 10%, and "Elite" when the
                        // patient had no medication at all (100% of nothing).
                        const rate = adherenceRate;
                        const tierKey = rate === null ? null : rate >= 95 ? 'tierElite' : rate >= 85 ? 'tierPlatinum' : rate >= 70 ? 'tierGold' : rate >= 50 ? 'tierSilver' : 'tierStarter';
                        const titleKey = rate === null ? 'titleNoData' : rate >= 95 ? 'titleElite' : rate >= 70 ? 'titleGood' : rate >= 50 ? 'titleOk' : 'titleLow';
                        const desc = rate === null || !tierKey
                          ? t('noAdherenceDesc' as any)
                          : t('tierDesc' as any).replace('{rate}', String(rate)).replace('{tier}', t(tierKey as any));
                        return (
                          <>
                            <div className="flex justify-between items-start mb-8 relative z-10">
                              <div className="p-4 bg-white dark:bg-white/5 rounded-[20px] border border-black/5 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)]">
                                <TrendingUp className="w-8 h-8 text-blue-600 dark:text-white" strokeWidth={2} />
                              </div>
                              <div className="text-right">
                                <span className="text-[40px] md:text-[48px] font-black tracking-tighter text-zinc-900 dark:text-white drop-shadow-md">{rate === null ? '—' : `${rate}%`}</span>
                                <p className="text-[12px] text-zinc-500 dark:text-white/70 font-bold uppercase tracking-widest mt-1">{t('globalAdherence')}</p>
                              </div>
                            </div>
                            <h3 className="text-[22px] md:text-[24px] font-bold mb-3 relative z-10 text-zinc-900 dark:text-white">{t(titleKey as any)}</h3>
                            <p className="text-[15px] md:text-[16px] text-zinc-600 dark:text-white/80 leading-relaxed font-medium relative z-10">{desc}</p>
                          </>
                        );
                      })()}
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 40 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-50px" }}
                      transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                      className="glass-panel rounded-[32px] md:rounded-[40px] p-6 md:p-10 group relative border-white/60 dark:border-white/10"
                    >
                        <div className="absolute top-0 left-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-[60px] pointer-events-none"></div>
                        <h3 className="text-[24px] font-black mb-6 flex items-center gap-3 text-zinc-900 dark:text-white relative z-10">
                          <Zap className="w-6 h-6 text-cyan-500 dark:text-cyan-400" fill="currentColor" strokeWidth={0} /> {t('aiHealthTips')}
                        </h3>
                        <div className="space-y-4 relative z-10">
                          {healthTips.map(tip => (
                            <div key={tip.id} className="p-5 bg-white dark:bg-slate-800/40 dark:backdrop-blur-md rounded-[24px] border border-black/5 dark:border-white/5 hover:scale-[1.01] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-default shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
                              <p className="text-[15px] text-zinc-800 dark:text-blue-50 font-semibold leading-relaxed">{tip.isAiGenerated ? tip.content : t(tip.contentKey as any)}</p>
                            </div>
                          ))}
                        </div>
                        {aiEnabled && <button
                          onClick={handleGenerateTip}
                          disabled={isGeneratingTip}
                          className="relative z-10 w-full mt-6 py-4 bg-white/60 dark:bg-white/10 text-cyan-700 dark:text-cyan-300 border border-white/60 dark:border-white/20 shadow-sm rounded-[20px] text-[16px] font-bold hover:bg-white/80 dark:hover:bg-white/20 hover:text-cyan-800 dark:hover:text-cyan-200 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isGeneratingTip ? (
                            <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-600 dark:border-cyan-300/30 dark:border-t-cyan-300 rounded-full animate-spin" />
                          ) : null}
                          {t('generateMoreTips')}
                        </button>}
                    </motion.div>
                  </div>

                  <motion.section
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="glass-panel rounded-[32px] md:rounded-[40px] p-6 md:p-8 xl:p-10 border-white/60 dark:border-white/10 relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"></div>
                    <div className="relative z-10 flex flex-col items-center text-center md:text-left md:flex-row justify-between gap-6 md:gap-8">
                      <div className="max-w-xl">
                        <h3 className="text-[20px] md:text-[24px] font-black text-zinc-900 dark:text-white mb-2 md:mb-3">{t('inviteFriends')}</h3>
                        <p className="text-[14px] md:text-[16px] text-zinc-600 dark:text-blue-100/70 font-medium">{t('shareJourney')}</p>
                      </div>
                      <div className="w-full md:w-auto flex flex-col sm:flex-row items-center gap-3 md:gap-4 bg-white dark:bg-slate-800/40 dark:backdrop-blur-md p-3 md:p-4 rounded-[20px] md:rounded-[24px] border border-black/5 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)]">
                        <code className="text-blue-600 dark:text-blue-400 font-black tracking-wide text-[13px] md:text-[16px] break-all">{window.location.host}</code>
                        <button onClick={handleShareApp} className="w-full sm:w-auto px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-[14px] md:rounded-[16px] font-black transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] shadow-lg shadow-blue-500/20 active:scale-[0.98] text-sm md:text-base">{t('copy')}</button>
                      </div>
                    </div>
                  </motion.section>
                </motion.div>
              ) : activeTab === 'insights' ? (
                <motion.div
                  key="insights"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="space-y-8"
                >
                  <section className="glass-panel rounded-[32px] md:rounded-[40px] p-5 md:p-8 xl:p-10 border-white/60 dark:border-white/10">
                    <h2 className="text-[22px] md:text-[28px] font-black mb-6 md:mb-8 text-zinc-900 dark:text-white">{t('longTermReport')}</h2>
                    <div className="relative h-[300px] md:h-[400px] w-full bg-white dark:bg-slate-800/40 rounded-[24px] p-3 md:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-black/5 dark:border-white/5">
                        {weekly.rate === null && computeAdherence(meds).rate === null && (
                          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-6 pointer-events-none">
                            <Activity className="w-9 h-9 text-cyan-500/50 mb-3" />
                            <p className="font-bold text-zinc-700 dark:text-zinc-200">{t('chartEmptyTitle' as any)}</p>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs">{t('chartEmptyText' as any)}</p>
                          </div>
                        )}
                        <ResponsiveContainer width="100%" height="100%">
                          {(() => {
                            // Weekly adherence for the last 5 weeks; weeks with nothing
                            // due are left empty instead of being drawn as a 0% failure.
                            const data: { date: string, rate: number | null }[] = [];
                            for (let w = 4; w >= 0; w--) {
                               const eDate = new Date();
                               eDate.setDate(eDate.getDate() - (w * 7));
                               const sDate = new Date(eDate);
                               sDate.setDate(sDate.getDate() - 6);
                               const res = computeAdherenceInRange(meds, sDate, eDate);
                               data.push({
                                  date: w === 0 ? t('today' as any) : shortDate(eDate),
                                  rate: res.rate
                               });
                            }
                            return <AreaChart data={data}>
                           <defs>
                             <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4}/>
                               <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                             </linearGradient>
                           </defs>
                           <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: isDarkMode ? '#93c5fd' : '#64748b', fontSize: 13, fontWeight: 700}} dy={10} />
                           <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: isDarkMode ? '#93c5fd' : '#64748b', fontSize: 13, fontWeight: 700}} dx={-10} />
                           <Tooltip
                             cursor={{ stroke: '#38bdf8', strokeWidth: 2, strokeDasharray: '4 4' }}
                             contentStyle={{
                               borderRadius: '20px',
                               border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)',
                               boxShadow: isDarkMode ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.1)',
                               background: isDarkMode ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)',
                               backdropFilter: 'blur(24px)',
                               color: isDarkMode ? '#fff' : '#0f172a'
                             }}
                           />
                           <Area type="monotone" dataKey="rate" connectNulls name="%" dot={{ r: 5, fill: '#38bdf8', stroke: '#fff', strokeWidth: 2 }} stroke="#38bdf8" strokeWidth={5} fillOpacity={1} fill="url(#colorRate)" activeDot={{ r: 8, fill: '#38bdf8', stroke: '#fff', strokeWidth: 4, zIndex: 10 }} />
                         </AreaChart>
                         })()}
                       </ResponsiveContainer>
                    </div>
                  </section>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 xl:gap-8">
                    <div className="glass-panel p-6 md:p-8 rounded-[32px] md:rounded-[40px] relative overflow-hidden group border-white/60 dark:border-white/10">
                      <div className="absolute -right-4 -top-4 w-32 h-32 bg-emerald-500 rounded-full blur-[40px] opacity-10 dark:opacity-20 group-hover:opacity-20 dark:group-hover:opacity-40 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"></div>
                      <div className="p-4 bg-white dark:bg-white/5 dark:backdrop-blur-md rounded-[20px] w-fit mb-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-black/5 dark:border-white/5">
                        <Leaf className="w-8 h-8 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                      </div>
                      {/* Used to claim "<any drug> is improving your microbial balance" —
                          an invented medical effect shown for every medicine, even insulin. */}
                      <h4 className="text-[20px] font-bold text-zinc-900 dark:text-white tracking-tight">{t('bestMedTitle' as any)}</h4>
                      <p className="text-[15px] text-zinc-600 dark:text-blue-100/70 mt-2 font-medium leading-relaxed">
                        {(() => {
                          const scored = meds
                            .map(m => ({ name: getLangVal(m.customName || m.nameKey), rate: computeAdherence([m]).rate }))
                            .filter(x => x.rate !== null) as { name: string, rate: number }[];
                          if (scored.length === 0) return t('bioDesc');
                          const best = scored.sort((a, b) => b.rate - a.rate)[0];
                          return t('bestMedDesc' as any).replace('{name}', best.name).replace('{rate}', String(best.rate));
                        })()}
                      </p>
                    </div>
                    <div className="glass-panel p-6 md:p-8 rounded-[32px] md:rounded-[40px] relative overflow-hidden group border-white/60 dark:border-white/10">
                      <div className="absolute -right-4 -top-4 w-32 h-32 bg-blue-500 rounded-full blur-[40px] opacity-10 dark:opacity-20 group-hover:opacity-20 dark:group-hover:opacity-40 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"></div>
                      <div className="p-4 bg-white dark:bg-[#1C1C1E] rounded-[20px] w-fit mb-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-black/5 dark:border-white/5">
                        <Activity className="w-8 h-8 text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
                      </div>
                      <h4 className="text-[20px] font-bold text-zinc-900 dark:text-white tracking-tight">{t('weekDosesTitle' as any)}</h4>
                      <p className="text-[15px] text-zinc-600 dark:text-blue-100/70 mt-2 font-medium leading-relaxed">
                        {weekly.expected === 0 ? t('vascularDesc') : t('weekDosesDesc' as any).replace('{taken}', String(weekly.taken)).replace('{expected}', String(weekly.expected))}
                      </p>
                    </div>
                    <div className="glass-panel p-6 md:p-8 rounded-[32px] md:rounded-[40px] relative overflow-hidden group border-white/60 dark:border-white/10">
                      <div className="absolute -right-4 -top-4 w-32 h-32 bg-yellow-500 rounded-full blur-[40px] opacity-10 dark:opacity-20 group-hover:opacity-20 dark:group-hover:opacity-40 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"></div>
                      <div className="p-4 bg-white dark:bg-slate-800/40 dark:backdrop-blur-md rounded-[20px] w-fit mb-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-black/5 dark:border-white/5">
                        <Trophy className="w-8 h-8 text-yellow-600 dark:text-yellow-400" strokeWidth={2.5} />
                      </div>
                      <h4 className="text-[20px] font-bold text-zinc-900 dark:text-white tracking-tight">{t('milestoneLevel')}</h4>
                      <p className="text-[15px] text-zinc-600 dark:text-blue-100/70 mt-2 font-medium leading-relaxed">
                        {t('streakMilestoneDesc' as any).replace('{days}', String(5 - (realStreak % 5))).replace('{streak}', String(realStreak))}
                      </p>
                    </div>
                  </div>

                  <section className="glass-panel rounded-[32px] md:rounded-[40px] p-6 md:p-8 xl:p-10 border-white/60 dark:border-white/10 mt-8">
                     <h2 className="text-[24px] font-black tracking-tight text-zinc-900 dark:text-white mb-6 uppercase">{t('vitalsTitle')}</h2>
                     {/*
                       This used to show a heart rate / calories / steps / sleep grid filled with
                       numbers invented from the day-of-month (not from any sensor or wearable
                       device) — fabricated vital signs presented as real measurements, which is
                       not acceptable for a health app. There is no fitness-tracker integration in
                       this app, so until there is one, we say so honestly instead of making up
                       numbers.
                     */}
                     <div className="flex flex-col items-center justify-center py-10 gap-3 text-zinc-400 dark:text-zinc-500 text-center">
                       <Heart className="w-10 h-10 opacity-40" />
                       <p className="font-bold max-w-sm">{t('vitalsNotConnected' as any)}</p>
                     </div>
                  </section>
                </motion.div>
              ) : activeTab === 'news' ? (
                <motion.div
                  key="news"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="space-y-8"
                >
                  <section className="glass-panel rounded-[32px] md:rounded-[40px] p-6 md:p-8 xl:p-10">
                    <div className="flex items-center justify-between mb-8">
                       <h2 className="text-[22px] md:text-[28px] font-black tracking-tight text-zinc-900 dark:text-white uppercase">{t('news') || 'Yangiliklar'}</h2>
                       {news.length > 3 && (
                          <button onClick={() => setShowAllNewsModal(true)} className="px-5 py-2.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 font-bold text-xs uppercase tracking-widest transition-colors flex items-center gap-2 border border-cyan-500/20">
                             {t('allNewsTitle')} <ChevronRight className="w-4 h-4" />
                          </button>
                       )}
                    </div>
                    {news.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                         <Activity className="w-16 h-16 text-zinc-300 dark:text-zinc-600 mb-4" />
                         <p className="text-zinc-500 font-bold text-lg">{t('noNews')}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 items-start">
                        {news.slice(0, 3).map((item) => (
                          <div
                             key={item.id}
                             onClick={() => setSelectedNews(item)}
                             className="bg-white/50 dark:bg-white/5 cursor-pointer rounded-[30px] md:rounded-[40px] border border-white/60 dark:border-white/10 overflow-hidden group hover:border-cyan-500/50 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[0_16px_40px_rgba(6,182,212,0.15)] flex flex-col items-start text-left h-full shadow-lg dark:shadow-none backdrop-blur-xl"
                          >
                             {item.imageUrl ? (
                                <img src={item.imageUrl} alt="News" className="w-full h-48 md:h-56 object-cover opacity-90 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105" />
                             ) : (
                                <div className="w-full h-48 md:h-56 bg-zinc-100 dark:bg-black/20 flex items-center justify-center overflow-hidden border-b border-black/5 dark:border-white/5">
                                   <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 group-hover:scale-110 transition-transform duration-500"></div>
                                   <Activity className="w-10 h-10 text-cyan-500/40 relative z-10 group-hover:scale-110 transition-transform duration-500" />
                                </div>
                             )}
                             <div className="p-6 md:p-8 relative w-full flex-1 flex flex-col">
                               <div className="mb-4 inline-block">
                                  <span className="px-3 py-1.5 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 text-[10px] font-black uppercase tracking-widest border border-cyan-200 dark:border-cyan-500/20 shadow-sm">{categoryLabel(item.category)}</span>
                               </div>
                               <h4 className="text-[18px] md:text-[22px] font-black text-zinc-900 dark:text-white mb-3 line-clamp-2 leading-tight group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors tracking-tight">{item.title[language as keyof any] || item.title.uz}</h4>
                               <p className="text-[14px] text-zinc-600 dark:text-zinc-400 line-clamp-3 mb-6 font-medium leading-relaxed flex-1">{item.content[language as keyof any] || item.content.uz}</p>
                               <div className="mt-auto flex items-center justify-between w-full pt-6 border-t border-black/5 dark:border-white/5">
                                 <span className="text-[12px] text-zinc-500 dark:text-zinc-500 font-bold flex items-center gap-2 uppercase tracking-widest"><Calendar className="w-4 h-4 text-cyan-500/70" />{longDate(item.createdAt, language)}</span>
                                 <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                                   <ChevronRight className="w-4 h-4 text-zinc-500 dark:text-zinc-400 group-hover:text-cyan-500 transition-colors" />
                                 </div>
                               </div>
                             </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </motion.div>
              ) : activeTab === 'games' ? (
                <motion.div
                  key="games"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <section className="glass-panel rounded-[32px] md:rounded-[40px] p-6 md:p-8 xl:p-10 min-h-[600px] flex flex-col">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8 md:mb-10 text-center sm:text-left">
                      <div>
                        <h2 className="text-[22px] md:text-[28px] font-black tracking-tight text-zinc-900 dark:text-white uppercase">{t('games' as any)}</h2>
                        <p className="text-zinc-500 dark:text-blue-100/70 text-[13px] md:text-[16px] mt-1 md:mt-2 font-medium">{t('gamesSubtitle' as any)}</p>
                        {activeGame === 'none' && <p className={cn("text-[12px] md:text-[13px] mt-2 font-bold", gameEarnedToday >= GAME_DAILY_LIMIT ? "text-amber-600 dark:text-amber-400" : "text-cyan-600 dark:text-cyan-400")}>
                          {gameEarnedToday >= GAME_DAILY_LIMIT ? t('dailyGameLimitReached' as any) : t('dailyGameLimit' as any).replace('{earned}', String(gameEarnedToday)).replace('{limit}', String(GAME_DAILY_LIMIT))}
                        </p>}
                      </div>
                      <div className="flex items-center gap-3 md:gap-4 px-5 md:px-6 py-2.5 md:py-3 bg-yellow-500/10 dark:bg-white/5 border border-white/40 dark:border-white/10 rounded-2xl">
                        <Trophy className="w-5 h-5 md:w-6 md:h-6 text-yellow-500" />
                        <span className="text-[20px] md:text-[24px] font-black text-zinc-900 dark:text-white">{stats.hCoins}</span>
                      </div>
                    </div>

                    {activeGame === 'none' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
                        <div
                          onClick={() => setActiveGame('flappy')}
                          className="glass-panel rounded-[32px] p-8 border border-white/20 hover:border-blue-500/50 cursor-pointer group transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/10 flex flex-col items-center justify-center text-center relative overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          <div className="w-20 h-20 bg-blue-500/10 rounded-[24px] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Gamepad2 className="w-10 h-10 text-blue-500" strokeWidth={2.5} />
                          </div>
                          <h3 className="text-2xl font-black text-zinc-900 dark:text-white mb-3 uppercase tracking-tighter">{t('flappyBird' as any)}</h3>
                          <p className="text-zinc-500 dark:text-blue-100/60 font-medium mb-8">{t('flappyDesc' as any)}</p>
                          <span className="px-8 py-3 bg-blue-600 text-white rounded-full font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-500/30 group-hover:bg-blue-500 transition-colors">{t('playNow' as any)}</span>
                        </div>

                        <div
                          onClick={() => setActiveGame('clicker')}
                          className="glass-panel rounded-[32px] p-8 border border-white/20 hover:border-yellow-500/50 cursor-pointer group transition-all duration-500 hover:shadow-2xl hover:shadow-yellow-500/10 flex flex-col items-center justify-center text-center relative overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          <div className="w-20 h-20 bg-yellow-500/10 rounded-[24px] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <MousePointer2 className="w-10 h-10 text-yellow-500" strokeWidth={2.5} />
                          </div>
                          <h3 className="text-2xl font-black text-zinc-900 dark:text-white mb-3 uppercase tracking-tighter">{t('hCoinClicker' as any)}</h3>
                          <p className="text-zinc-500 dark:text-blue-100/60 font-medium mb-8">{t('clickerDesc' as any)}</p>
                          <span className="px-8 py-3 bg-yellow-600 text-white rounded-full font-black text-sm uppercase tracking-widest shadow-lg shadow-yellow-500/30 group-hover:bg-yellow-500 transition-colors">{t('playNow' as any)}</span>
                        </div>
                      </div>
                    ) : activeGame === 'flappy' ? (
                      <FlyingCapsuleGame onBack={() => setActiveGame('none')} onEarn={earnFromGame} earnedToday={gameEarnedToday} limit={GAME_DAILY_LIMIT} t={t} />
                    ) : (
                      <CoinTapGame onBack={() => setActiveGame('none')} onEarn={earnFromGame} earnedToday={gameEarnedToday} limit={GAME_DAILY_LIMIT} t={t} />
                    )}
                  </section>
                </motion.div>
              ) : activeTab === 'tasks' ? (
                <motion.div
                  key="tasks"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <Suspense fallback={<div className="flex-1 flex items-center justify-center min-h-[400px] text-zinc-400 font-bold">{t('loading')}...</div>}>
                    <TaskView
                      t={t}
                      rewardsToday={me?.rewardsToday}
                      onGift={handleWalkGift}
                      onComplete={handleWalkComplete}
                      checklist={[
                        today.dosesPerDay > 0
                          ? { key: 'doses', label: t('taskDoses' as any), value: t('taskDosesValue' as any).replace('{taken}', String(today.dosesPerDay - today.pending)).replace('{total}', String(today.dosesPerDay)), done: today.pending === 0, onGo: () => setActiveTab('plan') }
                          : { key: 'doses', label: t('taskDoses' as any), value: t('taskNoMeds' as any), done: false },
                        { key: 'walk', label: t('taskWalk' as any), value: me?.rewardsToday?.walkDone ? t('walkDoneShort' as any) : `+${REWARD_LIMITS.walkComplete} H-Coin`, done: !!me?.rewardsToday?.walkDone },
                        { key: 'gifts', label: t('taskGifts' as any), value: `${me?.rewardsToday?.walkGifts ?? 0} / ${REWARD_LIMITS.walkGiftsPerDay}`, done: (me?.rewardsToday?.walkGifts ?? 0) >= REWARD_LIMITS.walkGiftsPerDay },
                        { key: 'games', label: t('taskGames' as any), value: `${gameEarnedToday} / ${GAME_DAILY_LIMIT} H-Coin`, done: gameEarnedToday >= GAME_DAILY_LIMIT, onGo: () => setActiveTab('games') },
                        ...(videoCount > 0 ? [{ key: 'video', label: t('taskVideo' as any), value: t('taskVideoValue' as any).replace('{done}', String(videosDone)).replace('{total}', String(videoCount)), done: videosDone >= videoCount, onGo: () => setActiveTab('videos') }] : []),
                      ]}
                    />
                  </Suspense>
                </motion.div>
              ) : activeTab === 'videos' ? (
                <motion.div
                  key="videos"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <VideoLessons
                    t={t}
                    completedVideoIds={userData?.completedVideos || []}
                    onSubmitQuiz={async (videoId, answers) => {
                      const r = await api<any>(`/api/videos/${videoId}/quiz`, { body: { answers } });
                      applyUser(r.user);
                      return { passed: r.passed, reward: r.reward };
                    }}
                  />
                </motion.div>
              ) : activeTab === 'shop' ? (
                <motion.div
                  key="shop"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="space-y-8"
                >
                  <Shop t={t} language={language} balance={stats.hCoins} redemptions={me?.redemptions || []} onRedeem={handleRedeem} />
                </motion.div>
              ) : (
                <motion.div
                  key="ai"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="h-[calc(100dvh-220px)] min-h-[420px] lg:h-[calc(100vh-140px)] flex flex-col glass-panel rounded-[32px] md:rounded-[40px] overflow-hidden relative border-white/60 dark:border-white/10"
                >
                  <div className="absolute top-0 left-0 w-80 h-80 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-full blur-[140px] opacity-10 dark:opacity-20 pointer-events-none"></div>

                  <div className="p-5 md:p-8 bg-white/50 dark:bg-white/5 backdrop-blur-xl border-b border-white/60 dark:border-white/10 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center gap-4 md:gap-5">
                      <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-[20px] bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30 border border-white/20">
                        <BrainCircuit className="text-white w-5 h-5 md:w-7 md:h-7" strokeWidth={2.5} />
                      </div>
                      <div>
                        <h2 className="font-extrabold text-[18px] md:text-[22px] text-zinc-900 dark:text-white tracking-tight uppercase">BIGUS AI</h2>
                        <p className="text-[10px] md:text-[13px] text-cyan-600 dark:text-cyan-400 font-bold tracking-widest uppercase mt-0.5 md:mt-1">{t('scienceBacked')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-6 md:space-y-8 custom-scrollbar relative z-10" ref={scrollRef} data-lenis-prevent>
                    {messages.map((m, i) => (
                      <div key={i} className={cn(
                        "flex flex-col whitespace-pre-wrap max-w-[85%]",
                        m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                      )}>
                        <div className={cn(
                          "px-5 py-4 md:px-7 md:py-5 rounded-[28px] md:rounded-[32px] text-[15px] md:text-[16px] leading-relaxed font-medium shadow-sm break-words",
                          m.role === 'user'
                            ? "bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-tr-[8px] shadow-lg shadow-blue-500/20 border border-transparent"
                            : "bg-white/60 dark:bg-white/10 backdrop-blur-md text-zinc-800 dark:text-white border border-white/60 dark:border-white/10 rounded-tl-[8px]"
                        )}>
                          {m.content}
                        </div>
                        <span className="text-[10px] font-semibold text-zinc-500 dark:text-blue-100/50 mt-2 px-2 uppercase tracking-widest">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                    {isTyping && (
                      <div className="bg-white/60 dark:bg-white/10 border border-white/60 dark:border-white/10 p-5 rounded-[24px] rounded-tl-[8px] w-[72px] flex justify-center gap-1.5 shadow-sm backdrop-blur-md">
                        <div className="w-2 h-2 bg-cyan-600/60 dark:bg-cyan-400/60 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-cyan-600/60 dark:bg-cyan-400/60 rounded-full animate-bounce delay-100"></div>
                        <div className="w-2 h-2 bg-cyan-600/60 dark:bg-cyan-400/60 rounded-full animate-bounce delay-200"></div>
                      </div>
                    )}
                  </div>

                  <div className="p-3 md:p-6 bg-white/50 dark:bg-white/5 border-t border-white/60 dark:border-white/10 backdrop-blur-xl z-10">
                    {messages.length <= 1 && !isTyping && (
                      <div className="max-w-4xl mx-auto mb-3 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" data-lenis-prevent>
                        {['aiSuggest1', 'aiSuggest2', 'aiSuggest3'].map(k => (
                          <button key={k} onClick={() => handleSendMessage(t(k as any))}
                            className="shrink-0 px-4 py-2 rounded-full bg-white dark:bg-white/10 border border-black/5 dark:border-white/10 text-[13px] font-semibold text-zinc-700 dark:text-zinc-200 hover:border-cyan-500/50 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors">
                            {t(k as any)}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="relative group max-w-4xl mx-auto shadow-sm rounded-full">
                      <input
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSendMessage()}
                        placeholder={t('askBigus')}
                        className="w-full bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-full px-6 py-4 pr-16 text-[15px] font-medium focus:outline-none focus:bg-white/80 dark:focus:bg-white/10 text-zinc-900 dark:text-white placeholder-slate-500/60 dark:placeholder-blue-100/40 focus:ring-4 focus:ring-cyan-500/20 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] focus:border-cyan-500/50"
                      />
                      <button
                        onClick={() => handleSendMessage()}
                        className="absolute right-2 top-2 bottom-2 w-[40px] h-[40px] bg-gradient-to-br from-blue-500 to-cyan-400 text-white rounded-full flex items-center justify-center hover:scale-105 active:scale-[0.98] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] shadow-[0_4px_12px_rgba(56,189,248,0.3)]"
                      >
                        <ChevronRight className="w-5 h-5 text-white" strokeWidth={2.5} />
                      </button>
                    </div>
                    <p className="max-w-4xl mx-auto mt-2 text-center text-[11px] font-medium text-zinc-400 dark:text-zinc-500">{t('aiDisclaimer' as any)}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Side Panel: AI Assistant & Stats */}
          <div className={cn("col-span-12 lg:col-span-4 space-y-6 md:space-y-8", activeTab !== 'plan' && "hidden lg:block")}>

            {/* Gamification Card */}
            <div className="glass-panel-dark rounded-[32px] md:rounded-[40px] p-6 md:p-8 relative overflow-hidden text-zinc-900 dark:text-white border border-white/60 dark:border-white/20">
               <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#FCD34D] to-[#F59E0B] rounded-full blur-[50px] opacity-10 dark:opacity-20"></div>
               <div className="flex items-center justify-between mb-6 md:mb-8 relative z-10">
                  <div className="flex items-center gap-4 md:gap-5">
                    <div className="w-[60px] h-[60px] md:w-[72px] md:h-[72px] rounded-xl md:rounded-[24px] bg-gradient-to-br from-[#F59E0B] to-[#EF4444] flex items-center justify-center text-[28px] md:text-[36px] shadow-[0_8px_24px_rgba(245,158,11,0.2)] dark:shadow-[0_8px_24px_rgba(245,158,11,0.4)] text-white border border-white/20 hover:scale-105 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"><Trophy className="w-6 h-6 md:w-8 md:h-8" fill="currentColor" strokeWidth={0} /></div>
                    <div>
                      <h4 className="text-[32px] md:text-[40px] font-black font-mono leading-none tracking-tight text-zinc-900 dark:text-white mb-1">
                        {realStreak}
                      </h4>
                      <p className="text-[10px] md:text-[12px] font-bold text-zinc-500 dark:text-white/70 uppercase tracking-widest">{t('dayStreak')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <h4 className="text-[24px] md:text-[28px] font-black font-mono text-[#F59E0B] dark:text-[#FCD34D]">{stats.hCoins}</h4>
                    <p className="text-[10px] md:text-[12px] font-bold text-zinc-500 dark:text-white/70 uppercase tracking-widest mt-1">{t('totalHCoins')}</p>
                    <div className="mt-2 pt-2 border-t border-white/5 opacity-60">
                      <span className="text-[14px] font-black font-mono text-blue-400">{stats.xp}</span>
                      <span className="text-[8px] font-bold text-zinc-500 uppercase ml-2">{t('totalXp')}</span>
                    </div>
                  </div>
               </div>

               <div className="space-y-3 relative z-10">
                  <div className="flex items-center justify-between text-[11px] md:text-[13px] font-bold text-zinc-700 dark:text-white/80 uppercase tracking-wider">
                    <span>{t('weeklyGoal')}</span>
                    <span className="text-[#F59E0B] dark:text-[#FCD34D]">
                      {weekly.rate === null ? '—' : weekly.rate === 100 ? `100% ${t('completedPct').toUpperCase()}` : `${weekly.rate}% ${t('completedPct')}`}
                    </span>
                  </div>
                  <div className="h-2.5 md:h-3 bg-zinc-100 dark:bg-white/10 rounded-full overflow-hidden shadow-inner border border-zinc-300 dark:border-white/10">
                    <div className="h-full bg-gradient-to-r from-[#F59E0B] to-[#FCD34D] rounded-full transition-all duration-1000" style={{ width: `${weekly.rate ?? 0}%` }}></div>
                  </div>
               </div>
            </div>

            {activeTab === 'ai' && news && news.length > 0 ? (
              <div
                 onClick={() => setSelectedNews(news[0])}
                 className="glass-panel rounded-[32px] md:rounded-[40px] flex flex-col overflow-hidden relative border-white/60 dark:border-white/10 cursor-pointer group hover:border-cyan-500/50 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[0_16px_40px_rgba(6,182,212,0.15)] bg-white/50 dark:bg-white/5 backdrop-blur-xl"
              >
                {news[0].imageUrl ? (
                  <div className="relative w-full h-48 md:h-56 overflow-hidden">
                    <img src={news[0].imageUrl} alt="News" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>
                    <div className="absolute top-4 right-4">
                       <span className="px-3 py-1.5 rounded-full bg-cyan-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-cyan-500/30 backdrop-blur-md">
                         {categoryLabel(news[0].category)}
                       </span>
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full h-48 md:h-56 bg-zinc-100 dark:bg-black/20 flex items-center justify-center overflow-hidden border-b border-black/5 dark:border-white/5">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 group-hover:scale-110 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"></div>
                    <Activity className="w-12 h-12 text-cyan-500/40 relative z-10 group-hover:scale-110 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]" />
                    <div className="absolute top-4 right-4 z-20">
                       <span className="px-3 py-1.5 rounded-full bg-cyan-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-cyan-500/30 backdrop-blur-md">
                         {categoryLabel(news[0].category)}
                       </span>
                    </div>
                  </div>
                )}

                <div className="p-6 md:p-8 flex flex-col relative z-10">
                  <h3 className="text-[18px] md:text-[22px] font-extrabold text-zinc-900 dark:text-white mb-3 line-clamp-2 leading-tight group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors tracking-tight">
                    {news[0].title[language as keyof any] || news[0].title.uz}
                  </h3>
                  <p className="text-[14px] text-zinc-600 dark:text-zinc-400 line-clamp-3 mb-6 font-medium leading-relaxed">
                    {news[0].content[language as keyof any] || news[0].content.uz}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-5 border-t border-black/5 dark:border-white/10">
                    <span className="text-[11px] md:text-[12px] text-zinc-500 dark:text-zinc-400 font-bold flex items-center gap-2 uppercase tracking-widest">
                      <Calendar className="w-4 h-4 md:w-5 md:h-5 text-cyan-500/70" />
                      {new Date(news[0].createdAt).toLocaleDateString(locale)}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-white/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                      <ChevronRight className="w-4 h-4 text-zinc-500 dark:text-zinc-400 group-hover:text-cyan-500 transition-colors" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
            <div className="hidden lg:flex glass-panel rounded-[32px] md:rounded-[40px] h-[500px] md:h-[600px] flex-col overflow-hidden relative border-white/60 dark:border-white/10">
               <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-full blur-[60px] opacity-10 dark:opacity-20 pointer-events-none"></div>

               <div className="p-5 md:p-6 bg-white/50 dark:bg-white/5 backdrop-blur-xl border-b border-white/60 dark:border-white/10 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                 <div className="flex items-center gap-3 md:gap-4">
                   <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-[16px] bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30 border border-white/20">
                     <BrainCircuit className="text-white w-5 h-5 md:w-6 md:h-6" strokeWidth={2.5} />
                   </div>
                   <div>
                     <h3 className="font-extrabold text-[16px] md:text-[18px] text-zinc-900 dark:text-white uppercase tracking-tight">BIGUS AI</h3>
                     <p className="text-[10px] md:text-[11px] text-cyan-600 dark:text-cyan-400 font-bold tracking-wide uppercase">{t('medicalExpert')}</p>
                   </div>
                 </div>
               </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative z-10" ref={scrollRef} data-lenis-prevent>
                {messages.map((m, i) => (
                  <div key={i} className={cn(
                    "flex flex-col whitespace-pre-wrap max-w-[85%]",
                    m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                  )}>
                    <div className={cn(
                      "px-6 py-4 rounded-[28px] text-[15px] leading-relaxed font-medium shadow-sm",
                      m.role === 'user'
                        ? "bg-gradient-to-br from-blue-500 to-cyan-500 text-white rounded-tr-[8px] shadow-lg shadow-blue-500/20 border border-transparent"
                        : "bg-white/60 dark:bg-white/10 backdrop-blur-md text-zinc-800 dark:text-white border border-white/60 dark:border-white/10 rounded-tl-[8px]"
                    )}>
                      {m.content}
                    </div>
                    <span className="text-[10px] font-bold text-zinc-500 dark:text-blue-100/50 mt-2 px-2 uppercase tracking-widest">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
                {isTyping && (
                  <div className="bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/60 dark:border-white/10 text-zinc-800 dark:text-white p-5 rounded-[24px] rounded-tl-[8px] w-[80px] flex justify-center gap-2 shadow-sm">
                    <div className="w-2.5 h-2.5 bg-cyan-600/60 dark:bg-cyan-400/60 rounded-full animate-bounce"></div>
                    <div className="w-2.5 h-2.5 bg-cyan-600/60 dark:bg-cyan-400/60 rounded-full animate-bounce delay-100"></div>
                    <div className="w-2.5 h-2.5 bg-cyan-600/60 dark:bg-cyan-400/60 rounded-full animate-bounce delay-200"></div>
                  </div>
                )}
              </div>

              <div className="p-5 bg-white/50 dark:bg-white/5 backdrop-blur-xl border-t border-white/60 dark:border-white/10 relative z-10">
                <div className="relative group max-w-4xl mx-auto shadow-sm rounded-[24px]">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSendMessage()}
                    placeholder={t('askBigus')}
                    className="w-full bg-white/60 dark:bg-white/5 border border-white/60 dark:border-white/10 rounded-[24px] px-6 py-4 pr-16 text-[16px] font-medium focus:outline-none focus:bg-white/80 dark:focus:bg-white/10 placeholder-slate-500/60 dark:placeholder-blue-100/40 text-zinc-900 dark:text-white focus:ring-4 focus:ring-cyan-500/20 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] focus:border-cyan-500/50"
                  />
                  <button
                    onClick={handleSendMessage}
                    className="absolute right-2 top-2 bottom-2 w-[44px] h-[44px] bg-gradient-to-br from-blue-500 to-cyan-400 text-white rounded-[18px] flex items-center justify-center hover:scale-105 active:scale-[0.98] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] shadow-lg shadow-cyan-500/30 border border-transparent dark:border-white/20"
                  >
                    <ChevronRight className="w-6 h-6 text-white" strokeWidth={2.5}/>
                  </button>
                </div>
              </div>
            </div>
            )}

            {/* Educational card — this used to show a fabricated first-person
                "patient testimonial" plus a fake "4.2k patients joined today"
                stat, styled as real social proof. Neither was real data, so
                it's now a plain educational message. */}
            <div className="glass-panel-dark rounded-[40px] p-8 text-zinc-900 dark:text-white border border-white/60 dark:border-white/20 shadow-xl overflow-hidden relative group">
               <div className="absolute -right-10 -top-10 w-40 h-40 bg-cyan-400 rounded-full blur-[60px] opacity-10 group-hover:opacity-20 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"></div>
               <div className="flex items-center gap-4 mb-6 relative z-10">
                  <div className="w-12 h-12 bg-gradient-to-br from-cyan-400/20 to-blue-500/20 rounded-2xl flex items-center justify-center border border-cyan-400/30 shadow-inner">
                    <Droplets className="w-6 h-6 text-cyan-600 dark:text-cyan-400" strokeWidth={2.5}/>
                  </div>
                  <h4 className="font-extrabold text-[20px] text-zinc-900 dark:text-white">{t('fluidAdherence')}</h4>
               </div>
               <p className="text-[16px] text-zinc-700 dark:text-white/80 leading-relaxed relative z-10 font-medium">{t('fluidDesc')}</p>
               <div className="mt-8 flex items-center gap-4 relative z-10">
                 <span className="text-[13px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">{t('joinedBy')}</span>
               </div>
            </div>
          </div>

        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 6px;
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(56, 189, 248, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(56, 189, 248, 0.4);
        }

        @keyframes liquidWave {
           0% { transform: scaleY(0.96) translateY(2%); }
           50% { transform: scaleY(1.04) translateY(-2%); }
           100% { transform: scaleY(0.96) translateY(2%); }
        }
        .animate-pulse-slow {
           animation: liquidWave 3s ease-in-out infinite;
        }
      `}</style>

      <AnimatePresence>
        {isReportOpen && <DoctorMessageModal t={t} meds={meds} locale={locale} onClose={() => setIsReportOpen(false)} />}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {isProfileModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute inset-0 bg-white/40 dark:bg-[#020617]/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm glass-panel-dark rounded-[32px] md:rounded-[40px] p-6 sm:p-8 shadow-[0_32px_64px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_rgba(0,0,0,0.8)] border border-white/60 dark:border-white/10"
            >
              <div className="flex flex-col items-center mb-6">
                <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center text-[28px] font-bold shadow-xl shadow-blue-500/30 border-4 border-white/50 dark:border-white/20 mb-4">
                  {stats.fullName?.split(' ').map((n: string) => n[0]).join('') || 'U'}
                </div>
                <h3 className="text-[24px] font-black text-zinc-900 dark:text-white capitalize">
                  {stats.fullName}
                </h3>
                <p className="text-cyan-600 dark:text-cyan-400 font-bold uppercase tracking-widest text-[12px] mt-1">
                  {t('lvl')} {currentLevel}
                </p>
                <div className="mt-4 flex flex-col items-center gap-2">
                   <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-sm font-bold">
                     <Calendar className="w-4 h-4" /> {userData?.birthDate || t('notEntered' as any)}
                   </div>
                   {userData?.telegramUsername && (
                     <div className="flex items-center gap-2 text-blue-500 font-black text-sm">
                        <MessageSquare className="w-4 h-4" /> @{userData.telegramUsername}
                     </div>
                   )}
                </div>
              </div>

              <div className="space-y-3">
                <button onClick={() => { setIsDarkMode(!isDarkMode); }} className="w-full flex items-center justify-between p-4 bg-zinc-100 dark:bg-[#2C2C2E] border border-transparent dark:border-white/5 rounded-[20px] transition-all duration-500 active:scale-95">
                  <span className="font-bold text-zinc-700 dark:text-white flex items-center gap-3">
                    {isDarkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                    {t('settings')}
                  </span>
                  <ChevronRight className="w-5 h-5 text-zinc-400" />
                </button>
                <TelegramLinkButton t={t} />
                <button onClick={() => { setIsProfileModalOpen(false); setIsReportOpen(true); }} className="w-full flex items-center justify-between p-4 bg-rose-50 dark:bg-rose-500/10 rounded-[20px] text-rose-600 dark:text-rose-300">
                  <span className="font-bold flex items-center gap-3"><MessageSquare className="w-5 h-5" /> {t('reportTitle' as any)}</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button onClick={() => { setIsProfileModalOpen(false); logout(); }} className="w-full flex items-center justify-between p-4 bg-red-50 dark:bg-red-500/10 border border-transparent dark:border-red-500/20 rounded-[20px] transition-all duration-500 active:scale-95 text-red-600 dark:text-red-400">
                  <span className="font-bold flex items-center gap-3">
                    {t('logout')}
                  </span>
                </button>
              </div>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="w-full mt-6 py-4 bg-zinc-200 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/20 text-zinc-800 dark:text-white rounded-[20px] font-bold transition-all duration-500 active:scale-[0.98]"
              >
                {t('cancel')}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAllNewsModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => setShowAllNewsModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-[1200px] h-[90vh] bg-white dark:bg-[#12151C] rounded-[32px] md:rounded-[40px] shadow-2xl border border-white/60 dark:border-white/10 overflow-hidden flex flex-col"
            >
              <div className="p-6 md:p-10 border-b border-black/5 dark:border-white/5 flex items-center justify-between sticky top-0 bg-white/50 dark:bg-[#12151C]/50 backdrop-blur-xl z-20 shrink-0">
                <h2 className="text-[24px] md:text-[32px] font-black text-zinc-900 dark:text-white uppercase tracking-tight">{t('allNewsTitle')}</h2>
                <button onClick={() => setShowAllNewsModal(false)} className="p-3 md:p-4 bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 rounded-full transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] shadow-sm border border-white/60 dark:border-white/10 group">
                   <ChevronLeft className="w-6 h-6 text-zinc-500 font-bold group-hover:scale-110 group-hover:-translate-x-1 transition-transform dark:text-zinc-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar" data-lenis-prevent>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 items-start">
                    {news.map((item) => (
                        <div
                           key={item.id}
                           onClick={() => {
                               setShowAllNewsModal(false);
                               setSelectedNews(item);
                           }}
                           className="bg-white/50 dark:bg-white/5 cursor-pointer rounded-[30px] md:rounded-[40px] border border-white/60 dark:border-white/10 overflow-hidden group hover:border-cyan-500/50 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[0_16px_40px_rgba(6,182,212,0.15)] flex flex-col items-start text-left h-full shadow-lg dark:shadow-none backdrop-blur-xl"
                        >
                       {item.imageUrl ? (
                          <img src={item.imageUrl} alt="News" className="w-full h-48 md:h-56 object-cover opacity-90 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105" />
                       ) : (
                          <div className="w-full h-48 md:h-56 bg-zinc-100 dark:bg-black/20 flex items-center justify-center overflow-hidden border-b border-black/5 dark:border-white/5">
                             <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 group-hover:scale-110 transition-transform duration-500"></div>
                             <Activity className="w-10 h-10 text-cyan-500/40 relative z-10 group-hover:scale-110 transition-transform duration-500" />
                          </div>
                       )}
                       <div className="p-6 md:p-8 relative w-full flex-1 flex flex-col">
                         <div className="mb-4 inline-block">
                            <span className="px-3 py-1.5 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 text-[10px] font-black uppercase tracking-widest border border-cyan-200 dark:border-cyan-500/20 shadow-sm">{categoryLabel(item.category)}</span>
                         </div>
                         <h4 className="text-[18px] md:text-[22px] font-black text-zinc-900 dark:text-white mb-3 line-clamp-2 leading-tight group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors tracking-tight">{item.title[language as keyof any] || item.title.uz}</h4>
                         <p className="text-[14px] text-zinc-600 dark:text-zinc-400 line-clamp-3 mb-6 font-medium leading-relaxed flex-1">{item.content[language as keyof any] || item.content.uz}</p>
                         <div className="mt-auto flex items-center justify-between w-full pt-6 border-t border-black/5 dark:border-white/5">
                           <span className="text-[12px] text-zinc-500 dark:text-zinc-500 font-bold flex items-center gap-2 uppercase tracking-widest"><Calendar className="w-4 h-4 text-cyan-500/70" />{longDate(item.createdAt, language)}</span>
                           <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-white/5 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                             <ChevronRight className="w-4 h-4 text-zinc-500 dark:text-zinc-400 group-hover:text-cyan-500 transition-colors" />
                           </div>
                         </div>
                       </div>
                    </div>
                  ))}
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedNews && (
          <NewsReader
            item={selectedNews}
            allNews={news}
            language={language}
            t={t}
            categoryLabel={categoryLabel}
            quiz={validQuiz(selectedNews)}
            quizAnswers={quizAnswers}
            setQuizAnswers={setQuizAnswers}
            quizSubmitted={quizSubmitted}
            quizResult={showQuizResult}
            onSubmitQuiz={handleQuizSubmit}
            onOpen={setSelectedNews}
            onClose={closeNews}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeReminder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setActiveReminder(null)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm glass-panel border-2 border-cyan-500/50 rounded-[40px] p-8 overflow-hidden text-center"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500 animate-pulse" />

              <div className="w-24 h-24 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <BellRing className="w-12 h-12 text-cyan-500 animate-bounce" />
              </div>

              <h2 className="text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-tight mb-2">
                {t('medicationReminder' as any)}
              </h2>

              <div className="py-4 px-6 bg-zinc-100 dark:bg-white/5 rounded-3xl mb-6">
                <p className="text-xl font-black text-cyan-600 dark:text-cyan-400 uppercase">
                  {activeReminder.name}
                </p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Clock className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm font-bold text-zinc-500 uppercase">{activeReminder.time}</span>
                </div>
              </div>

              <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-8">
                {t('takeDoseMessage' as any)}
              </p>

              {(() => {
                const med = meds.find(m => m.id === activeReminder.id);
                const idx = med ? dayIndexFor(med) : -1;
                const canTake = med && idx >= 0 && idx < med.durationDays && takenOn(med, idx) < pillsPerDay(med);
                return canTake ? (
                  <button
                    onClick={() => { setActiveReminder(null); toggleMed(med.id, idx); }}
                    className="w-full py-5 mb-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-[24px] font-black uppercase tracking-widest transition-all shadow-[0_8px_24px_rgba(6,182,212,0.3)]"
                  >
                    {t('takeNow' as any)}
                  </button>
                ) : null;
              })()}
              <button
                onClick={() => setActiveReminder(null)}
                className="w-full py-4 bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 text-zinc-800 dark:text-white rounded-[24px] font-black uppercase tracking-widest transition-all"
              >
                {t('gotIt' as any)}
              </button>
            </motion.div>
          </div>
        )}

        {selectedHistoryMed && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedHistoryMed(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="relative w-full max-w-sm bg-white dark:bg-[#12151C] rounded-[32px] p-6 shadow-2xl border border-white/60 dark:border-white/10 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 dark:from-emerald-500/10 dark:to-teal-500/10 -z-10"></div>

              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-[20px] shadow-lg shadow-emerald-500/30 mb-6 mx-auto">
                <ShieldCheck className="w-8 h-8 text-white" />
              </div>

              <h3 className="text-xl font-black text-center text-zinc-900 dark:text-white mb-2 uppercase">{getLangVal(selectedHistoryMed.med.customName || selectedHistoryMed.med.nameKey)}</h3>

              <div className="bg-zinc-50 dark:bg-black/30 rounded-[20px] p-5 border border-zinc-200/50 dark:border-white/5 space-y-4 mb-6 relative">
                 <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-white dark:bg-[#12151C] rotate-45 border-l border-b border-zinc-200/50 dark:border-white/5"></div>
                 <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-zinc-500 uppercase tracking-widest">{t('dateLabel' as any)}</span>
                    <span className="text-[15px] font-black text-zinc-900 dark:text-white">
                      {new Date(selectedHistoryMed.timestamp).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                 </div>
                 <div className="w-full h-px bg-zinc-200 dark:bg-white/5"></div>
                 <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-zinc-500 uppercase tracking-widest">{t('timeLabel' as any)}</span>
                    <span className="text-[15px] font-black text-zinc-900 dark:text-white">
                      {new Date(selectedHistoryMed.timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                 </div>
              </div>

              <button
                onClick={() => setSelectedHistoryMed(null)}
                className="w-full py-4 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-800 dark:text-white rounded-[20px] font-bold transition-all duration-300"
              >
                {t('close' as any)}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isCameraOpen && (
        <Suspense fallback={
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        }>
          <CameraCheck
            onVerify={handleCameraVerify}
            onClose={() => { setIsCameraOpen(false); setPendingMedToggle(null); }}
            reward={(() => { const m = meds.find(x => x.id === pendingMedToggle?.medId); return Math.round(50 / pillsPerDay(m)); })()}
          />
        </Suspense>
      )}

      {/* Mobile "More" sheet for the tabs that don't fit in the bottom bar */}
      <AnimatePresence>
        {isMoreMenuOpen && (
          <>
            <div className="lg:hidden fixed inset-0 z-40" onClick={() => setIsMoreMenuOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed bottom-[96px] right-3 z-50 w-56 bg-white dark:bg-[#1C1F26] border border-black/5 dark:border-white/10 rounded-3xl shadow-2xl p-2"
            >
              {[
                { id: 'news', icon: Bell, label: t('news') },
                { id: 'insights', icon: TrendingUp, label: t('insights') },
                { id: 'games', icon: Gamepad2, label: t('games' as any) },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id as any); setIsMoreMenuOpen(false); window.scrollTo({ top: 0 }); }}
                    className={cn("w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left font-bold text-[15px] transition-colors",
                      activeTab === item.id ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "text-zinc-700 dark:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5")}
                  >
                    <Icon className="w-5 h-5" /> {item.label}
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-[440px] h-[72px] glass-panel border border-white/60 dark:border-white/20 rounded-[32px] z-50 flex items-center justify-between px-2 shadow-[0_16px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_24px_64px_rgba(0,0,0,0.5)]">
        {[
          { id: 'plan', icon: Calendar, label: t('dashboard') },
          { id: 'tasks', icon: MapIcon, label: t('tasks' as any) },
          { id: 'videos', icon: Video, label: t('videoLessons' as any) },
          { id: 'ai', icon: MessageSquare, label: 'AI' },
          { id: 'shop', icon: Trophy, label: t('shop' as any) },
          { id: 'more', icon: ChevronDown, label: t('moreTabs' as any) },
        ].map((tab) => {
          const Icon = tab.icon;
          const isMoreTab = ['news', 'insights', 'games'].includes(activeTab);
          const isActive = tab.id === 'more' ? (isMoreTab || isMoreMenuOpen) : activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'more') { setIsMoreMenuOpen(o => !o); return; }
                setIsMoreMenuOpen(false);
                setActiveTab(tab.id as any);
                window.scrollTo({ top: 0 });
              }}
              className={cn(
                "relative flex-1 flex flex-col items-center justify-center gap-1.5 h-[56px] rounded-[24px] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] px-1",
                isActive ? "text-blue-600 dark:text-blue-400" : "text-zinc-500 dark:text-blue-100/50 hover:text-zinc-800 dark:hover:text-blue-100"
              )}
            >
              {isActive && (
                <motion.div layoutId="active-mobile-tab" className="absolute inset-0 bg-blue-500/10 dark:bg-blue-500/20 shadow-inner rounded-[24px] border border-blue-500/20 dark:border-blue-400/20"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <Icon className={cn("relative z-10 w-5 h-5 transition-transform", tab.id === 'more' && isMoreMenuOpen && "rotate-180")} />
              <span className="relative z-10 text-[9px] sm:text-[10px] font-bold uppercase tracking-tight w-full text-center truncate">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  );
}

