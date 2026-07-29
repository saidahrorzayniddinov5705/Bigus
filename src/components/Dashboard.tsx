/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Gift as GiftIcon,
  Navigation,
  XCircle,
  Video,
  Play,
  RotateCcw,
  Trash2,
  BellRing,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { PlantGrowth } from './PlantGrowth';
import { Logo } from './Logo';

import RegistrationProfileModal from './RegistrationProfileModal';
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
import { Medication, AdherenceData, ChatMessage, UserStats, HealthTip, DailyTask, Gift, VideoLesson, VideoQuizQuestion } from '../types';
import { chatWithAssistant } from '../lib/gemini';
import { cn } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';
import { Language, translations } from '../lib/i18n';

import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import CameraCheck from './CameraCheck';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const INITIAL_MEDS: any[] = [
  {
    id: '1',
    nameKey: 'amoxicillin',
    dosage: '500mg',
    frequencyKey: 'thriceDaily',
    durationDays: 7,
    startDate: '2026-04-24',
    pillsTaken: [true, true, true, true, false, false, false],
    typeKey: 'antibiotic',
    scientificContextKey: 'context1',
    totalPills: 21,
    remainingPills: 17
  },
  {
    id: '2',
    nameKey: 'metformin',
    dosage: '850mg',
    frequencyKey: 'onceDaily',
    durationDays: 30,
    startDate: '2026-04-01',
    pillsTaken: new Array(30).fill(false).map((_, i) => i < 26),
    typeKey: 'metabolic',
    scientificContextKey: 'context2',
    totalPills: 30,
    remainingPills: 4
  }
];

const USER_STATS: UserStats = {
  streak: 14,
  xp: 1250,
  hCoins: 450,
  level: 8,
  adherenceRate: 0.94
};

const HEALTH_TIPS: any[] = [
  { id: '1', category: 'nutrition', contentKey: 'tip1', icon: 'Leaf' },
  { id: '2', category: 'activity', contentKey: 'tip2', icon: 'Zap' }
];

const FlappyBirdGame = ({ onBack, onEarn, t }: { onBack: () => void, onEarn: (coins: number) => void, t: any }) => {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameOver'>('idle');
  const [score, setScore] = useState(0);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [renderTick, setRenderTick] = useState(0);
  
  const birdRef = useRef({ y: 250, velocity: 0 });
  const pipesRef = useRef<{ x: number, top: number }[]>([]);
  const lastScoreRef = useRef(0);
  const frameRef = useRef<number>(0);

  const startGame = () => {
    birdRef.current = { y: 250, velocity: 0 };
    pipesRef.current = [
      { x: 500, top: 150 },
      { x: 800, top: 250 },
      { x: 1100, top: 200 }
    ];
    lastScoreRef.current = 0;
    setScore(0);
    setEarnedCoins(0);
    setGameState('playing');
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    const update = () => {
      // Physics
      birdRef.current.velocity += 0.4;
      birdRef.current.y += birdRef.current.velocity;

      // Pipe movement
      pipesRef.current = pipesRef.current.map(p => ({ ...p, x: p.x - 3.5 }));

      // Pipe recycling and scoring
      if (pipesRef.current.length > 0 && pipesRef.current[0].x < -60) {
        const lastPipeX = pipesRef.current[pipesRef.current.length - 1].x;
        pipesRef.current = [
          ...pipesRef.current.slice(1),
          { x: lastPipeX + 300, top: 100 + Math.random() * 200 }
        ];
        
        setScore(s => s + 1);
        setEarnedCoins(ec => ec + 2);
        onEarn(2);
      }

      // Collisions
      const birdY = birdRef.current.y;
      const birdX = 100;
      const birdWidth = 36; // A bit smaller than the div for leniency
      const birdHeight = 36;

      // Boundaries
      if (birdY < -50 || birdY > 480) {
        setGameState('gameOver');
        return;
      }

      // Pipes collision
      for (const pipe of pipesRef.current) {
        // Simple AABB collision
        const pipeWidth = 60;
        const gapHeight = 160;
        
        if (birdX + birdWidth > pipe.x && birdX < pipe.x + pipeWidth) {
          if (birdY < pipe.top || birdY + birdHeight > pipe.top + gapHeight) {
            setGameState('gameOver');
            return;
          }
        }
      }

      // Trigger re-render
      setRenderTick(t => t + 1);
      frameRef.current = requestAnimationFrame(update);
    };

    frameRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameRef.current);
  }, [gameState, onEarn]);

  const jump = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (gameState === 'playing') {
      birdRef.current.velocity = -7.5;
    } else if (gameState === 'idle') {
      startGame();
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-blue-400 rounded-3xl cursor-pointer select-none"
         onClick={() => jump()}
         onKeyDown={(e) => e.code === 'Space' && jump(e)}
         tabIndex={0}
    >
      <button 
        onClick={(e) => { e.stopPropagation(); onBack(); }}
        className="absolute top-4 left-4 z-20 p-2 bg-white/20 hover:bg-white/40 text-white rounded-full transition-colors"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <div className="absolute top-6 right-6 z-20 text-white font-black text-2xl flex flex-col items-end">
        <span>{t('score')}: {score}</span>
        <span className="text-yellow-400 text-sm">+{earnedCoins} H-Coin</span>
      </div>

      <AnimatePresence>
        {gameState === 'idle' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="z-10 text-center"
          >
            <div className="w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center mb-6 mx-auto shadow-2xl animate-bounce">
              <Zap className="w-12 h-12 text-zinc-900" />
            </div>
            <h3 className="text-4xl font-black text-white mb-4 shadow-sm">{t('flappyBird')}</h3>
            <p className="text-white/80 font-bold mb-8 uppercase tracking-widest">Boshlash uchun bosing!</p>
            <button className="px-10 py-4 bg-white text-blue-500 rounded-full font-black text-lg uppercase tracking-widest shadow-xl">{t('start')}</button>
          </motion.div>
        )}

        {gameState === 'gameOver' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="z-10 text-center bg-zinc-900/40 backdrop-blur-md p-10 rounded-[40px] border border-white/20 shadow-2xl"
          >
            <h3 className="text-4xl font-black text-white mb-4">{t('gameOver')}</h3>
            <div className="text-6xl font-black text-yellow-400 mb-8">{score}</div>
            <p className="text-white/60 font-bold mb-8">{t('earnedCoins')}: {earnedCoins}</p>
            <button 
              onClick={(e) => { e.stopPropagation(); startGame(); }}
              className="px-10 py-4 bg-white text-zinc-900 rounded-full font-black text-lg uppercase tracking-widest shadow-xl"
            >
              {t('restart')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative w-full h-[500px]">
        {/* Bird */}
        {gameState === 'playing' && (
          <div 
            className="absolute w-12 h-12 bg-yellow-400 rounded-lg shadow-lg border-2 border-zinc-900 flex items-center justify-center overflow-hidden"
            style={{ 
              top: birdRef.current.y, 
              left: 100,
              transform: `rotate(${Math.min(birdRef.current.velocity * 3, 45)}deg)` 
            }}
          >
             <div className="w-4 h-4 bg-white rounded-full absolute top-2 right-2 border border-black flex items-center justify-center">
               <div className="w-1.5 h-1.5 bg-black rounded-full" />
             </div>
             <div className="w-6 h-4 bg-orange-500 rounded-sm absolute bottom-2 right-0 transform translate-x-2" />
          </div>
        )}

        {/* Pipes */}
        {gameState === 'playing' && pipesRef.current.map((p, i) => (
          <React.Fragment key={i}>
            <div 
              className="absolute w-[60px] bg-green-500 border-2 border-zinc-900 rounded-b-xl shadow-inner"
              style={{ left: p.x, top: 0, height: p.top }}
            />
            <div 
              className="absolute w-[60px] bg-green-500 border-2 border-zinc-900 rounded-t-xl shadow-inner"
              style={{ left: p.x, top: p.top + 160, height: 500 - (p.top + 160) }}
            />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const HCoinClickerGame = ({ onBack, onEarn, t }: { onBack: () => void, onEarn: (coins: number) => void, t: any }) => {
  const [isClicking, setIsClicking] = useState(false);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [clickEffects, setClickEffects] = useState<{ id: number, x: number, y: number }[]>([]);

  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    // Determine position for effect
    const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const y = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    // Create new effect
    const id = Date.now();
    setClickEffects(prev => [...prev, { id, x: x - 20, y: y - 50 }]);
    
    // Cleanup effect
    setTimeout(() => {
      setClickEffects(prev => prev.filter(eff => eff.id !== id));
    }, 1000);

    onEarn(1);
    setEarnedCoins(s => s + 1);
    setIsClicking(true);
    setTimeout(() => setIsClicking(false), 100);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-b from-zinc-900 to-indigo-950 rounded-3xl p-10 select-none">
       <button 
        onClick={onBack}
        className="absolute top-4 left-4 z-20 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <div className="absolute top-6 right-6 z-20 text-white font-black text-2xl flex flex-col items-end">
        <span className="text-yellow-400">+{earnedCoins} H-Coin</span>
      </div>

      <div className="text-center mb-12">
        <h3 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">{t('hCoinClicker')}</h3>
        <p className="text-blue-200/50 font-medium tracking-widest text-xs uppercase">{t('clickToEarn')}</p>
      </div>

      <motion.button
        animate={{ scale: isClicking ? 0.9 : 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        onPointerDown={handleClick}
        className="relative group p-4"
      >
        <div className="absolute inset-0 bg-yellow-500/20 blur-[100px] group-hover:opacity-100 transition-opacity rounded-full"></div>
        <div className="relative w-64 h-64 md:w-80 md:h-80 bg-gradient-to-br from-yellow-300 via-yellow-500 to-amber-600 rounded-full flex items-center justify-center shadow-[0_0_80px_rgba(234,179,8,0.4)] border-8 border-white/20 overflow-hidden group-active:scale-95 transition-transform">
           <Trophy className="w-40 h-40 md:w-56 md:h-56 text-white drop-shadow-[0_10px_10px_rgba(0,0,0,0.3)]" fill="currentColor" strokeWidth={0} />
           <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
        </div>
      </motion.button>

      <AnimatePresence>
        {clickEffects.map(eff => (
          <motion.div
            key={eff.id}
            initial={{ opacity: 1, y: eff.y, x: eff.x, scale: 1 }}
            animate={{ opacity: 0, y: eff.y - 150, scale: 1.5 }}
            exit={{ opacity: 0 }}
            className="fixed pointer-events-none z-50 text-3xl font-black text-yellow-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]"
          >
            +1
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

const TaskView = ({ onEarn, t, language }: { onEarn: (coins: number) => void, t: any, language: string }) => {
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [heading, setHeading] = useState(0);
  const [task, setTask] = useState<DailyTask | null>(null);
  const [distanceTraveled, setDistanceTraveled] = useState(0);
  const [lastPos, setLastPos] = useState<[number, number] | null>(null);
  const [isFindingGifts, setIsFindingGifts] = useState(false);
  const [isTaskStarted, setIsTaskStarted] = useState(false);
  const [isLocationDenied, setIsLocationDenied] = useState(false);

  // Custom navigation arrow for user
  const userIcon = L.divIcon({
    className: 'custom-nav-icon',
    html: `<div style="transform: rotate(${heading}deg); transition: transform 0.3s ease-out; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 5L32 32L20 26L8 32L20 5Z" fill="#3b82f6" stroke="white" stroke-width="3" stroke-linejoin="round"/>
            </svg>
            <div style="position: absolute; width: 40px; height: 40px; border-radius: 50%; background: rgba(59, 130, 246, 0.2); animation: pulse 2s infinite;"></div>
          </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });

  // Custom icon for gifts
  const giftIcon = L.divIcon({
    className: 'gift-div-icon',
    html: `<div style="background-color: #f59e0b; width: 36px; height: 36px; border-radius: 12px; border: 3px solid white; box-shadow: 0 0 25px rgba(245, 158, 11, 0.7); display: flex; align-items: center; justify-content: center; animation: bounce 2s infinite;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>
          </div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21]
  });

  const startTask = () => {
    // Generate task
    const mockTask: DailyTask = {
      id: "task-" + Date.now(),
      type: 'walk',
      targetDistance: 100, 
      currentDistance: 0,
      completed: false,
      gifts: []
    };
    setTask(mockTask);
    setIsTaskStarted(true);

    // Prompt for location once started
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => {
        console.error("Location error:", err);
        setIsLocationDenied(true);
      },
      { enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    if (!isTaskStarted) return;

    // Watch position
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(newPos);
        if (pos.coords.heading !== null) {
          setHeading(pos.coords.heading);
        }
      },
      (err) => {
        console.error("Geolocation error", err);
        if (err.code === 1) setIsLocationDenied(true);
      },
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isTaskStarted]);

  // Update distance
  useEffect(() => {
    if (!userPos || !task || !isTaskStarted) return;

    if (lastPos) {
      const R = 6371e3; 
      const φ1 = lastPos[0] * Math.PI/180;
      const φ2 = userPos[0] * Math.PI/180;
      const Δφ = (userPos[0]-lastPos[0]) * Math.PI/180;
      const Δλ = (userPos[1]-lastPos[1]) * Math.PI/180;

      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const d = R * c; 

      if (d > 0.5) {
        // Simple smoothing for heading if not provided
        if (heading === 0) {
          const y = Math.sin(Δλ) * Math.cos(φ2);
          const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
          const brng = Math.atan2(y, x) * 180 / Math.PI;
          setHeading((brng + 360) % 360);
        }

        setDistanceTraveled(prev => {
          const total = prev + d;
          if (total >= task.targetDistance && !task.completed) {
            setTask(t => t ? { ...t, completed: true } : null);
          }
          return total;
        });
      }
    }
    setLastPos(userPos);

    // Spawn gifts
    if (task.gifts.filter(g => !g.collected).length < 2 && !isFindingGifts) {
      setIsFindingGifts(true);
      setTimeout(() => {
        const newGift: Gift = {
          id: `gift-${Date.now()}`,
          lat: userPos[0] + (Math.random() - 0.5) * 0.0005,
          lng: userPos[1] + (Math.random() - 0.5) * 0.0005,
          collected: false,
          reward: Math.floor(Math.random() * 25) + 15
        };
        setTask(t => t ? { ...t, gifts: [...t.gifts, newGift] } : null);
        setIsFindingGifts(false);
      }, 7000);
    }
  }, [userPos, task, isTaskStarted, lastPos, isFindingGifts, heading]);

  const collectGift = (giftId: string) => {
    const gift = task?.gifts.find(g => g.id === giftId);
    if (!gift || gift.collected) return;

    setTask(t => t ? {
      ...t,
      gifts: t.gifts.map(g => g.id === giftId ? { ...g, collected: true } : g)
    } : null);

    onEarn(gift.reward);
    alert(`${t('giftFound')}! +${gift.reward} H-Coins`);
  };

  const MapUpdater = ({ center }: { center: [number, number] }) => {
    const map = useMap();
    useEffect(() => {
      if (!center) return;
      map.setView(center, 19);
      const timer = setTimeout(() => {
        map.invalidateSize();
      }, 400);
      return () => clearTimeout(timer);
    }, [center, map]);
    return null;
  };

  return (
    <div className="flex-1 flex flex-col space-y-6 min-h-[650px]">
      <div className="glass-panel rounded-[32px] p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
           <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">{t('dailyTasks')}</h3>
           <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">{t('tasksDesc')}</p>
        </div>
        <div className="flex items-center gap-4">
          {isTaskStarted && (
            <div className="px-4 py-2 bg-blue-500/10 rounded-2xl border border-blue-500/20 shadow-sm">
               <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-1">{t('distanceLeft')}</span>
               <span className="text-xl font-black text-zinc-900 dark:text-white tracking-tighter">{Math.max(0, Math.round((task?.targetDistance || 100) - distanceTraveled))} {t('meters')}</span>
            </div>
          )}
          {task?.completed && (
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="px-4 py-2 bg-green-500 rounded-2xl border border-green-400 flex items-center gap-2 shadow-lg shadow-green-500/20"
            >
               <CheckCircle2 className="w-5 h-5 text-white" />
               <span className="text-sm font-black text-white uppercase tracking-widest">{t('completed' as any)}</span>
            </motion.div>
          )}
        </div>
      </div>

      <div className="flex-1 rounded-[40px] overflow-hidden border-2 border-white/80 dark:border-white/10 shadow-2xl relative min-h-[500px] bg-zinc-100 dark:bg-zinc-950">
        {!isTaskStarted ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-zinc-900 dark:to-zinc-950 z-20">
             <div className="w-24 h-24 bg-blue-600/10 rounded-[32px] flex items-center justify-center mb-8 rotate-12">
               <MapIcon className="w-12 h-12 text-blue-600" strokeWidth={2.5} />
             </div>
             <h4 className="text-3xl font-black text-zinc-900 dark:text-white mb-4 uppercase tracking-tighter">{t('walkTask')}</h4>
             <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-10 max-w-sm mx-auto">
               {t('walkTaskSubDesc')}
             </p>
             <button 
               onClick={startTask}
               className="px-12 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-[24px] font-black text-lg uppercase tracking-widest shadow-2xl shadow-blue-600/30 transition-all hover:scale-105 active:scale-95"
             >
               {t('start')}
             </button>
          </div>
        ) : isLocationDenied ? (
          <div className="absolute inset-0 bg-red-50 dark:bg-red-900/20 flex flex-col items-center justify-center p-10 text-center z-20">
            <XCircle className="w-16 h-16 text-red-500 mb-6" />
            <h4 className="text-2xl font-black text-zinc-900 dark:text-white mb-4 uppercase tracking-tighter">{t('locationNotDetected')}</h4>
            <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-8">{t('enableLocationPermission')}</p>
            <button onClick={() => location.reload()} className="px-8 py-3 bg-zinc-900 text-white rounded-2xl font-black uppercase tracking-widest">{t('reload')}</button>
          </div>
        ) : !userPos ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-14 text-center z-20 bg-zinc-50 dark:bg-zinc-900">
            <div className="relative">
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                 <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center">
                    <Navigation className="w-10 h-10 text-blue-500" />
                 </div>
              </motion.div>
              <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-ping"></div>
            </div>
            <h4 className="text-xl font-black text-zinc-900 dark:text-white mt-8 uppercase tracking-tighter tracking-widest">{t('loading' as any)}...</h4>
            <p className="text-xs text-zinc-400 mt-2 font-bold uppercase tracking-widest">{t('gpsSignalSending')}</p>
          </div>
        ) : (
          <div className="w-full h-full relative" style={{ minHeight: '500px' }}>
            <MapContainer center={userPos} zoom={19} style={{ height: '500px', width: '100%', zIndex: 1 }} zoomControl={false}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapUpdater center={userPos} />
              
              <Marker position={userPos} icon={userIcon}>
                <Popup className="custom-popup">
                  <div className="text-center font-black uppercase text-[10px] tracking-widest">{t('yourLocation')}</div>
                </Popup>
              </Marker>

              {task?.gifts.filter(g => !g.collected).map(gift => (
                <Marker 
                  key={gift.id} 
                  position={[gift.lat, gift.lng]} 
                  icon={giftIcon}
                  eventHandlers={{
                    click: () => collectGift(gift.id)
                  }}
                >
                  <Popup minWidth={160}>
                    <div className="text-center p-4">
                      <div className="w-14 h-14 bg-yellow-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <GiftIcon className="w-8 h-8 text-yellow-500" />
                      </div>
                      <p className="font-black text-zinc-900 uppercase text-xs mb-4 tracking-tighter">{t('giftNearby')}</p>
                      <button 
                        onClick={() => collectGift(gift.id)}
                        className="w-full py-3 bg-yellow-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-yellow-600 transition-colors shadow-lg shadow-yellow-500/30"
                      >
                        {t('open' as any)}
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        )}
        
        {isTaskStarted && (
          <div className="absolute bottom-6 left-6 z-[1000] right-6 sm:right-auto">
             <div className="p-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl rounded-[32px] border border-white/20 shadow-[0_12px_48px_rgba(0,0,0,0.2)] flex items-center gap-5">
               <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-600/40 relative">
                 <Navigation className="w-8 h-8" />
                 <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900"></div>
               </div>
               <div>
                 <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-1">Quest: {t('walkTask')}</p>
                 <p className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-tight">{t('walkTaskDesc').replace('{distance}', task?.targetDistance.toString() || '100')}</p>
               </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

const VideoView = ({ onEarn, t, isAdminUser }: { onEarn: (coins: number) => void, t: any, isAdminUser: boolean }) => {
  const { language } = useLanguage();
  const [lessons, setLessons] = useState<any[]>([]);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('aura_completed_videos');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedLesson, setSelectedLesson] = useState<any | null>(null);
  const [quizState, setQuizState] = useState<{ 
    active: boolean, 
    currentQuestion: number, 
    answers: number[],
    showingFeedback: boolean,
    lastCorrect: boolean | null,
    selectedOption: number | null
  }>({ 
    active: false, 
    currentQuestion: 0, 
    answers: [], 
    showingFeedback: false, 
    lastCorrect: null,
    selectedOption: null
  });
  const [isAddingMode, setIsAddingMode] = useState(false);
  
  // New Video Form State
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [newVideoDesc, setNewVideoDesc] = useState('');
  const [newQuizQuestions, setNewQuizQuestions] = useState<any[]>([
    { question: { uz: '', ru: '', en: '', 'uz-cyrl': '' }, options: [{ uz: '', ru: '', en: '', 'uz-cyrl': '' }, { uz: '', ru: '', en: '', 'uz-cyrl': '' }, { uz: '', ru: '', en: '', 'uz-cyrl': '' }, { uz: '', ru: '', en: '', 'uz-cyrl': '' }], correctOptionIndex: 0 }
  ]);

  useEffect(() => {
    const q = query(collection(db, 'videos'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const v: any[] = [];
      snapshot.forEach(doc => v.push({ id: doc.id, ...doc.data() }));
      
      if (v.length === 0) {
        // Fallback or Initial Data
        setLessons([
          {
            id: 'v1',
            title: { uz: 'Qandli diabet haqida 5 ta fakt', ru: '5 фактов о сахарном диабете' },
            iframeCode: '<iframe width="100%" height="315" src="https://www.youtube.com/embed/wZAjVQWbMlE" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>',
            description: { uz: 'Qandli diabet bilan sog\'lom hayot kechirish bo\'yicha muhim dars.', ru: 'Важный урок о здоровой жизни с сахарным диабетом.' },
            quiz: [
              { question: { uz: 'Qandli diabetning necha turi bor?', ru: 'Сколько типов диабета существует?' }, options: [{ uz: '1 tur', ru: '1 тип' }, { uz: '2 tur', ru: '2 тип' }, { uz: '3 tur', ru: '3 тип' }, { uz: '4 tur', ru: '4 тип' }], correctOptionIndex: 1 },
              { question: { uz: 'Insulin qayerda ishlab chiqariladi?', ru: 'Где вырабатывается инсулин?' }, options: [{ uz: 'Jigar', ru: 'Печень' }, { uz: 'Me\'da osti bezi', ru: 'Поджелудочная железа' }, { uz: 'Buyrak', ru: 'Почки' }, { uz: 'Yurak', ru: 'Сердце' }], correctOptionIndex: 1 }
            ]
          }
        ]);
      } else {
        setLessons(v);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAddQuestion = () => {
    setNewQuizQuestions([
      ...newQuizQuestions,
      { question: { uz: '', ru: '', en: '', 'uz-cyrl': '' }, options: [{ uz: '', ru: '', en: '', 'uz-cyrl': '' }, { uz: '', ru: '', en: '', 'uz-cyrl': '' }, { uz: '', ru: '', en: '', 'uz-cyrl': '' }, { uz: '', ru: '', en: '', 'uz-cyrl': '' }], correctOptionIndex: 0 }
    ]);
  };

  const handleUpdateQuestion = (idx: number, lang: string, value: string) => {
    const updated = [...newQuizQuestions];
    updated[idx].question[lang as any] = value;
    setNewQuizQuestions(updated);
  };

  const handleUpdateOption = (qIdx: number, oIdx: number, lang: string, value: string) => {
    const updated = [...newQuizQuestions];
    updated[qIdx].options[oIdx][lang as any] = value;
    setNewQuizQuestions(updated);
  };

  const setCorrectOption = (qIdx: number, oIdx: number) => {
    const updated = [...newQuizQuestions];
    updated[qIdx].correctOptionIndex = oIdx;
    setNewQuizQuestions(updated);
  };

  const handleCreateVideo = async () => {
    if (!newVideoUrl || !newVideoTitle) {
      alert('Iltimos, video sarlavhasi va linkini kiriting.');
      return;
    }
    
    let iframeCode = newVideoUrl;
    if (newVideoUrl.includes('youtube.com/watch?v=')) {
      const id = newVideoUrl.split('v=')[1]?.split('&')[0];
      iframeCode = `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${id}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
    } else if (newVideoUrl.includes('youtu.be/')) {
      const id = newVideoUrl.split('youtu.be/')[1]?.split('?')[0];
      iframeCode = `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${id}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
    }

    try {
      await addDoc(collection(db, 'videos'), {
        title: { uz: newVideoTitle, ru: newVideoTitle, en: newVideoTitle, 'uz-cyrl': newVideoTitle },
        iframeCode: iframeCode,
        videoUrl: newVideoUrl,
        description: { uz: newVideoDesc || 'Video dars', ru: newVideoDesc || 'Video dars', en: newVideoDesc || 'Video dars', 'uz-cyrl': newVideoDesc || 'Video dars' },
        quiz: newQuizQuestions,
        createdAt: Date.now()
      });
      
      // Reset Form
      setNewVideoUrl('');
      setNewVideoTitle('');
      setNewVideoDesc('');
      setNewQuizQuestions([{ question: { uz: '', ru: '', en: '', 'uz-cyrl': '' }, options: [{ uz: '', ru: '', en: '', 'uz-cyrl': '' }, { uz: '', ru: '', en: '', 'uz-cyrl': '' }, { uz: '', ru: '', en: '', 'uz-cyrl': '' }, { uz: '', ru: '', en: '', 'uz-cyrl': '' }], correctOptionIndex: 0 }]);
      setIsAddingMode(false);
    } catch (e) {
      console.error(e);
      alert("Xatolik yuz berdi");
    }
  };

  const handleDeleteVideo = async (id: string) => {
    if (confirm('Rostdan ham ushbu videoni o\'chirmoqchimisiz?')) {
      try {
        await deleteDoc(doc(db, 'videos', id));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const startQuiz = (lesson: any) => {
    setSelectedLesson(lesson);
    setQuizState({ 
        active: true, 
        currentQuestion: 0, 
        answers: [],
        showingFeedback: false,
        lastCorrect: null,
        selectedOption: null
    });
  };

  const submitAnswer = (optionIndex: number) => {
    if (quizState.showingFeedback) return;

    const isCorrect = optionIndex === selectedLesson?.quiz[quizState.currentQuestion].correctOptionIndex;
    
    setQuizState(prev => ({
      ...prev,
      showingFeedback: true,
      lastCorrect: isCorrect,
      selectedOption: optionIndex
    }));

    setTimeout(() => {
      const newAnswers = [...quizState.answers, optionIndex];
      if (quizState.currentQuestion + 1 < (selectedLesson?.quiz.length || 0)) {
        setQuizState(prev => ({ 
          ...prev, 
          currentQuestion: prev.currentQuestion + 1, 
          answers: newAnswers,
          showingFeedback: false,
          lastCorrect: null,
          selectedOption: null
        }));
      } else {
        const correctCount = newAnswers.filter((ans, idx) => ans === selectedLesson?.quiz[idx].correctOptionIndex).length;
        if (correctCount === (selectedLesson?.quiz?.length || 0)) {
          onEarn(50);
          const updatedIds = [...completedLessonIds, selectedLesson.id];
          setCompletedLessonIds(updatedIds);
          localStorage.setItem('aura_completed_videos', JSON.stringify(updatedIds));
          alert(`${t('congratulations')}! ${t('quizReward').replace('{amount}', '50')}`);
        } else {
          alert(`${t('incorrect')}! Iltimos, videoni qayta ko'ring va urinib ko'ring.`);
        }
        setQuizState({ 
            active: false, 
            currentQuestion: 0, 
            answers: [],
            showingFeedback: false,
            lastCorrect: null,
            selectedOption: null
        });
        setSelectedLesson(null);
      }
    }, 1000);
  };

  const getLangVal = (obj: any) => {
    if (!obj) return '';
    return obj[language] || obj['uz'] || '';
  };

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="glass-panel rounded-[32px] p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center">
             <Video className="w-6 h-6 text-blue-500" />
           </div>
           <div>
             <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">{t('videoLessons')}</h3>
             <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">{t('videosDesc')}</p>
           </div>
        </div>
        
        {isAdminUser && (
          <button 
            onClick={() => setIsAddingMode(!isAddingMode)}
            className={cn(
              "px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all",
              isAddingMode ? "bg-zinc-200 text-zinc-600" : "bg-blue-600 text-white shadow-xl shadow-blue-600/30"
            )}
          >
            {isAddingMode ? 'Bekor qilish' : 'Video qo\'shish'}
          </button>
        )}
      </div>

      {isAdminUser && isAddingMode && (
        <div className="glass-panel rounded-[32px] p-8 space-y-8 animate-in fade-in slide-in-from-top-4">
           <div className="space-y-4">
             <h4 className="font-black uppercase text-sm tracking-widest text-zinc-900 dark:text-white flex items-center gap-2">
               <Plus className="w-4 h-4" /> Yangi video dars ma'lumotlari
             </h4>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <input 
                 type="text" 
                 placeholder="Video Sarlavhasi" 
                 className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 outline-none focus:ring-2 ring-blue-500 transition-all font-bold"
                 value={newVideoTitle}
                 onChange={e => setNewVideoTitle(e.target.value)}
               />
               <input 
                 type="text" 
                 placeholder="YouTube URL yoki Iframe kodi" 
                 className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 outline-none focus:ring-2 ring-blue-500 transition-all font-bold"
                 value={newVideoUrl}
                 onChange={e => setNewVideoUrl(e.target.value)}
               />
             </div>
             <textarea 
               placeholder="Video tavsifi..." 
               className="w-full bg-zinc-100 dark:bg-zinc-800 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 outline-none focus:ring-2 ring-blue-500 transition-all font-bold min-h-[100px]"
               value={newVideoDesc}
               onChange={e => setNewVideoDesc(e.target.value)}
             />
           </div>

           <div className="space-y-6">
             <div className="flex items-center justify-between">
               <h4 className="font-black uppercase text-sm tracking-widest text-zinc-900 dark:text-white">Video uchun test (MCQ)</h4>
               <button 
                 onClick={handleAddQuestion}
                 className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-[10px] font-black uppercase tracking-widest border border-zinc-200 dark:border-zinc-700"
               >
                 Savol qo'shish
               </button>
             </div>

             <div className="space-y-8">
               {newQuizQuestions.map((q, qIdx) => (
                 <div key={qIdx} className="p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border border-zinc-200 dark:border-zinc-800 space-y-4">
                    <div className="flex items-center gap-4">
                      <span className="w-8 h-8 bg-blue-500 text-white rounded-lg flex items-center justify-center font-black">{qIdx + 1}</span>
                      <div className="flex-1 space-y-2">
                        <input 
                          type="text" 
                          placeholder="Savol matni (UZ)..." 
                          className="w-full bg-transparent border-b-2 border-zinc-200 dark:border-zinc-700 p-2 outline-none focus:border-blue-500 font-bold"
                          value={q.question.uz}
                          onChange={e => handleUpdateQuestion(qIdx, 'uz', e.target.value)}
                        />
                        <input 
                          type="text" 
                          placeholder="Вопрос (RU)..." 
                          className="w-full bg-transparent border-b-2 border-zinc-200 dark:border-zinc-700 p-2 outline-none focus:border-blue-500 font-bold"
                          value={q.question.ru}
                          onChange={e => handleUpdateQuestion(qIdx, 'ru', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {q.options.map((opt: any, oIdx: number) => (
                        <div key={oIdx} className="space-y-2">
                           <div className="flex items-center gap-2">
                             <input 
                               type="radio" 
                               name={`correct-${qIdx}`} 
                               checked={q.correctOptionIndex === oIdx}
                               onChange={() => setCorrectOption(qIdx, oIdx)}
                               className="w-4 h-4 text-blue-600"
                             />
                              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Variant {oIdx + 1}</span>
                           </div>
                           <input 
                             type="text" 
                             placeholder={`Variant ${oIdx + 1} (UZ)`} 
                             className="w-full bg-white dark:bg-zinc-800 p-3 rounded-xl border border-zinc-100 dark:border-zinc-700 text-sm font-medium"
                             value={opt.uz}
                             onChange={e => handleUpdateOption(qIdx, oIdx, 'uz', e.target.value)}
                           />
                           <input 
                             type="text" 
                             placeholder={`Вариант ${oIdx + 1} (RU)`} 
                             className="w-full bg-white dark:bg-zinc-800 p-3 rounded-xl border border-zinc-100 dark:border-zinc-700 text-sm font-medium"
                             value={opt.ru}
                             onChange={e => handleUpdateOption(qIdx, oIdx, 'ru', e.target.value)}
                           />
                        </div>
                      ))}
                    </div>
                 </div>
               ))}
             </div>
           </div>

           <button 
             onClick={handleCreateVideo}
             className="w-full py-5 bg-blue-600 text-white rounded-[24px] font-black uppercase tracking-widest shadow-2xl shadow-blue-600/40 hover:scale-[1.01] transition-all"
           >
             Video darsni saqlash va e'lon qilish
           </button>
        </div>
      )}

      {quizState.active && selectedLesson ? (
         <div className="flex-1 flex flex-col items-center justify-center space-y-8 p-10 bg-zinc-50 dark:bg-zinc-900 rounded-[40px] border border-zinc-200 dark:border-zinc-800 min-h-[500px]">
           <div className="text-center space-y-4">
             <span className="text-xs font-black text-blue-500 uppercase tracking-[0.3em]">Savol {quizState.currentQuestion + 1} / {selectedLesson.quiz.length}</span>
             <h4 className="text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-tighter max-w-xl">{getLangVal(selectedLesson.quiz[quizState.currentQuestion].question)}</h4>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
             {selectedLesson.quiz[quizState.currentQuestion].options.map((option: any, idx: number) => (
               <button 
                key={idx}
                disabled={quizState.showingFeedback}
                 onClick={() => submitAnswer(idx)}
                className={cn(
                    "p-6 bg-white dark:bg-zinc-800 rounded-3xl border-2 transition-all font-black uppercase text-sm tracking-tight text-left",
                    !quizState.showingFeedback && "border-zinc-200 dark:border-zinc-700 hover:border-blue-500",
                    quizState.showingFeedback && idx === selectedLesson.quiz[quizState.currentQuestion].correctOptionIndex && "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400",
                    quizState.showingFeedback && idx === quizState.selectedOption && !quizState.lastCorrect && "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400",
                    quizState.showingFeedback && idx !== selectedLesson.quiz[quizState.currentQuestion].correctOptionIndex && idx !== quizState.selectedOption && "border-zinc-200 dark:border-zinc-700 opacity-50"
                 )}
               >
                 {getLangVal(option)}
               </button>
             ))}
           </div>
           <button 
             onClick={() => setQuizState({ active: false, currentQuestion: 0, answers: [], showingFeedback: false, lastCorrect: null, selectedOption: null })}
             className="flex items-center gap-2 text-zinc-500 font-bold uppercase text-xs tracking-widest"
           >
             <RotateCcw className="w-4 h-4" /> Bekor qilish
           </button>
         </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {lessons.map(lesson => (
            <div key={lesson.id} className="glass-panel overflow-hidden rounded-[40px] flex flex-col group">
               <div className="h-[300px] bg-zinc-100 dark:bg-zinc-900 relative overflow-hidden" dangerouslySetInnerHTML={{ __html: lesson.iframeCode }} />
               <div className="p-8 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">{getLangVal(lesson.title)}</h4>
                      <p className="text-zinc-500 text-sm font-medium">{getLangVal(lesson.description)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                       {isAdminUser && (
                         <button 
                           onClick={() => handleDeleteVideo(lesson.id)}
                           className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                         >
                           <Trash2 className="w-5 h-5" />
                         </button>
                       )}
                       {lesson.completed && (
                         <div className="bg-green-500/10 text-green-500 p-2 rounded-xl">
                           <CheckCircle2 className="w-6 h-6" />
                         </div>
                       )}
                    </div>
                  </div>
                  <div className="pt-4 flex items-center gap-4">
                    <button 
                      onClick={() => startQuiz(lesson)}
                      className={cn(
                        "flex-1 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all",
                        completedLessonIds.includes(lesson.id) 
                          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed" 
                          : "bg-blue-600 text-white shadow-xl shadow-blue-600/30 hover:scale-[1.02]"
                      )}
                      disabled={completedLessonIds.includes(lesson.id)}
                    >
                      <Play className="w-4 h-4 fill-current" /> {t('completeQuiz')}
                    </button>
                  </div>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function Dashboard() {
  const { t, language, setLanguage } = useLanguage();
  const { currentUser, userData, logout } = useAuth();
  const navigate = useNavigate();

  const [meds, setMeds] = useState<any[]>(INITIAL_MEDS);
  const [stats, setStats] = useState<UserStats>(USER_STATS);
  const [news, setNews] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'plan' | 'ai' | 'insights' | 'shop' | 'news' | 'games' | 'tasks' | 'videos'>('plan');
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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
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

  const updateGlobalCoins = async (amount: number) => {
    if (!currentUser) return;
    const newCoins = stats.hCoins + amount;
    const newXp = stats.xp + Math.floor(amount / 5); // Some XP too
    
    setStats(prev => ({ ...prev, hCoins: newCoins, xp: newXp }));
    
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        hCoins: newCoins,
        xp: newXp
      });
    } catch (e) {
      console.error("Failed to update coins", e);
    }
  };

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
      const newsQ = query(collection(db, 'news'));
      const unsubscribe = onSnapshot(newsQ, (snapshot) => {
          const n: any[] = [];
          snapshot.forEach(d => n.push({id: d.id, ...d.data()}));
          setNews(n.sort((a,b) => b.createdAt - a.createdAt));
      });
      return () => unsubscribe();
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
      const todayStr = now.toISOString().split('T')[0];

      meds.forEach(med => {
        if (med.scheduledTimes && Array.isArray(med.scheduledTimes)) {
          med.scheduledTimes.forEach((time: string) => {
            const notificationId = `${med.id}-${todayStr}-${time}`;
            if (time === currentTime && !shownNotifications.includes(notificationId)) {
              const medName = getLangVal(med.nameKey || med.customName);
              
              // 1. Try Browser Notification
              if ("Notification" in window && Notification.permission === "granted") {
                const title = t('medicationReminder' as any);
                const body = `${medName} - ${t('takeDoseMessage' as any)}`;
                new Notification(title, { body, icon: '/logo.png' });
              }
              
              // 2. ALWAYS show in-app reminder (more reliable in iframes)
              setActiveReminder({ id: med.id, name: medName, time });

              // 3. Telegram Notification
              if (med.telegramBotToken && med.telegramChatId) {
                const text = `🔔 *${t('medicationReminder' as any)}*\n\n💊 *${medName}*\n🕒 ${t('medicationTimes' as any)}: ${time}\n\n👉 ${t('takeDoseMessage' as any)}`;
                fetch(`https://api.telegram.org/bot${med.telegramBotToken}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: med.telegramChatId,
                    text: text,
                    parse_mode: 'Markdown'
                  })
                }).catch(err => console.error('Telegram error:', err));
              }
              
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

  useEffect(() => {
    // Reset quiz when news changes
    if (selectedNews) {
       setQuizAnswers({});
       setQuizSubmitted(userData?.completedQuizzes?.includes(selectedNews.id) || false);
       setShowQuizResult(null);
    }
  }, [selectedNews, userData?.completedQuizzes]);

  const handleQuizSubmit = async () => {
      if (!selectedNews || !selectedNews.quiz || selectedNews.quiz.length === 0) return;
      if (userData?.completedQuizzes?.includes(selectedNews.id)) return;

      const quizzes = selectedNews.quiz;
      let correctCount = 0;
      quizzes.forEach((q: any, i: number) => {
          if (quizAnswers[i] === q.correctOptionIndex) {
              correctCount++;
          }
      });
      
      const reward = correctCount * 5;
      
      try {
          const newCompleted = [...(userData?.completedQuizzes || []), selectedNews.id];
          const newCoins = (userData?.hCoins || 0) + reward;
          const newXp = (userData?.xp || 0) + correctCount * 10;
          await updateDoc(doc(db, 'users', currentUser!.uid), {
             completedQuizzes: newCompleted,
             hCoins: newCoins,
             xp: newXp
          });
          setQuizSubmitted(true);
          setShowQuizResult({ correct: correctCount, total: quizzes.length, reward });
      } catch (e) {
          console.error("Quiz result save error", e);
      }
  };

  const toggleMed = (medId: string, dayIndex: number) => {
    const med = meds.find(m => m.id === medId);
    if (!med) return;
    
    const pillsPerDay = med.frequencyKey === 'thriceDaily' ? 3 : med.frequencyKey === 'twiceDaily' ? 2 : med.frequencyKey === 'fourTimesDaily' ? 4 : 1;
    const currentTakenNum = typeof med.pillsTaken[dayIndex] === 'number' ? med.pillsTaken[dayIndex] : (med.pillsTaken[dayIndex] ? pillsPerDay : 0);

    if (currentTakenNum >= pillsPerDay) {
       const historyEntry = med.history ? med.history.slice().reverse().find((h: any) => h.dayIndex === dayIndex && h.action === 'taken') : null;
       if (historyEntry) {
         setSelectedHistoryMed({ med, dayIndex, timestamp: historyEntry.timestamp });
       }
    } else {
       // Open camera to check
       setPendingMedToggle({ medId, dayIndex });
       setIsCameraOpen(true);
    }
  };

  const applyMedToggle = async (medId: string, dayIndex: number, isChecking: boolean) => {
    const med = meds.find(m => m.id === medId);
    if (!med) return;

    if (!isChecking) return; // We only support checking forwards for now

    const pillsPerDay = med.frequencyKey === 'thriceDaily' ? 3 : med.frequencyKey === 'twiceDaily' ? 2 : med.frequencyKey === 'fourTimesDaily' ? 4 : 1;
    
    const newTaken = [...med.pillsTaken];
    const currentTakenNum = typeof newTaken[dayIndex] === 'number' ? newTaken[dayIndex] : (newTaken[dayIndex] ? pillsPerDay : 0);
    const newVal = Math.min(pillsPerDay, currentTakenNum + 1);
    
    newTaken[dayIndex] = newVal;
    
    // total taken logic
    const totalTakenPills = newTaken.reduce((sum, val) => sum + (typeof val === 'number' ? val : (val ? pillsPerDay : 0)), 0);
    
    const updatedMed = { 
      ...med, 
      pillsTaken: newTaken,
      remainingPills: Math.max(0, med.totalPills - totalTakenPills),
      history: (med as any).history ? [...(med as any).history, { dayIndex, timestamp: Date.now(), action: 'taken' }] : [{ dayIndex, timestamp: Date.now(), action: 'taken' }]
    };

    const newMeds = meds.map(m => m.id === medId ? updatedMed : m);
    setMeds(newMeds);

    if (currentUser?.uid) {
      const pointsChange = Math.round(50 / pillsPerDay);
      const newHCoins = stats.hCoins + pointsChange;
      const newXp = stats.xp + pointsChange;
      
      // Calculate today's pending pills with NEW meds
      const todayPending = newMeds.reduce((total, md) => {
         const date = new Date(md.startDate);
         const t = new Date();
         const diffTime = t.getTime() - date.getTime();
         const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
         if (diffDays >= 0 && diffDays < md.durationDays) {
            const ppd = md.frequencyKey === 'thriceDaily' ? 3 : md.frequencyKey === 'twiceDaily' ? 2 : md.frequencyKey === 'fourTimesDaily' ? 4 : 1;
            const taken = md.pillsTaken[diffDays];
            const count = typeof taken === 'number' ? taken : (taken ? ppd : 0);
            return total + (ppd - count);
         }
         return total;
      }, 0);

      // If pending is 0 now (meaning they just finished the last one), increase streak 
      // Note: This relies on them not being able to un-toggle, or we'd need more complex logic.
      const newStreak = todayPending === 0 ? stats.streak + 1 : stats.streak;

      setStats(s => ({ ...s, hCoins: newHCoins, xp: newXp, streak: newStreak }));

      try {
        const medRef = doc(db, 'users', currentUser.uid, 'medications', medId);
        await updateDoc(medRef, {
           pillsTaken: updatedMed.pillsTaken,
           remainingPills: updatedMed.remainingPills,
           history: updatedMed.history
        });

        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
           hCoins: newHCoins,
           xp: newXp,
           streak: newStreak
        });
      } catch (e) {
        console.error("Failed to sync to firebase", e);
      }
    }
  };

  const handleCameraVerify = (success: boolean) => {
     setIsCameraOpen(false);
     if (success && pendingMedToggle) {
        applyMedToggle(pendingMedToggle.medId, pendingMedToggle.dayIndex, true);
     }
     setPendingMedToggle(null);
  };

  useEffect(() => {
    if (currentUser?.uid) {
      const q = query(collection(db, 'users', currentUser.uid, 'medications'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedMeds: any[] = [];
        snapshot.forEach((doc) => {
          fetchedMeds.push({ id: doc.id, ...doc.data() });
        });
        setMeds(fetchedMeds);
      });
      return () => unsubscribe();
    }
  }, [currentUser]);

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

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;
    const newMsg: ChatMessage = { role: 'user', content: userInput, timestamp: Date.now() };
    setMessages(prev => [...prev, newMsg]);
    setUserInput('');
    setIsTyping(true);

    const history = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    }));

    const response = await chatWithAssistant(history, userInput);
    setMessages(prev => [...prev, { role: 'assistant', content: response, timestamp: Date.now() }]);
    setIsTyping(false);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] dark:bg-[#020617] flex items-center justify-center p-6 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] relative overflow-hidden">
        <RegistrationProfileModal isOpen={isRegistrationModalOpen} onClose={() => setIsRegistrationModalOpen(false)} />
        {/* Animated Mesh Gradients */}
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
            x: [0, 50, 0],
            y: [0, -30, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/30 dark:bg-blue-600/30 blur-[120px] pointer-events-none" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
            x: [0, -40, 0],
            y: [0, 40, 0]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-400/30 dark:bg-cyan-500/30 blur-[120px] pointer-events-none" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.4, 1],
            opacity: [0.1, 0.3, 0.1],
            rotate: [0, 90, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 5 }}
          className="absolute top-[20%] right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-500/20 dark:bg-indigo-600/20 blur-[120px] pointer-events-none" 
        />

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
                    className="absolute right-0 top-full mt-2 w-28 bg-white/90 dark:bg-[#2C2C2E]/90 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.15)] z-50 overflow-hidden py-1.5 p-1.5"
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

        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[440px] bg-white dark:bg-[#12151C] p-10 md:p-12 rounded-[40px] md:rounded-[48px] border border-black/5 dark:border-white/5 shadow-[0_24px_64px_rgba(0,0,0,0.06)] dark:shadow-[0_32px_80px_rgba(0,0,0,0.8)] relative z-10 mx-4"
        >
          {/* Inner Glow Map */}
          <div className="absolute inset-0 rounded-[40px] md:rounded-[48px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] pointer-events-none"></div>
          
          <div className="flex justify-center mb-8 relative">
            <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full scale-150 pointer-events-none"></div>
            <div className="w-24 h-24 flex items-center justify-center relative z-10 bg-white dark:bg-[#1A1D24] rounded-3xl shadow-[0_16px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.4)] border border-black/5 dark:border-white/10 p-4">
              <Logo className="w-full h-full" />
            </div>
          </div>
          <h2 className="text-[32px] md:text-4xl tracking-tight font-black text-center mb-3 text-zinc-900 dark:text-white">BIGUS</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-center mb-10 font-black text-xs tracking-[0.2em] uppercase">Xush kelibsiz</p>
          
          <div className="space-y-4 relative w-full group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-[28px] blur opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
            <button 
              onClick={() => setIsRegistrationModalOpen(true)}
              className="relative w-full py-5 rounded-[24px] bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black text-lg shadow-[0_8px_30px_rgba(6,182,212,0.3)] hover:shadow-[0_16px_40px_rgba(6,182,212,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] flex items-center justify-center gap-2 overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <span>Kirish</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // If doctor accidentally ends up on dashboard
  if (userData?.role === 'doctor') {
    navigate('/admin');
    return null;
  }

  return (
    <div className="min-h-screen text-zinc-900 dark:text-white font-sans selection:bg-blue-500/30 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] bg-[#F2F2F7] dark:bg-[#020617] relative overflow-hidden">
      <RegistrationProfileModal isOpen={isRegistrationModalOpen} onClose={() => setIsRegistrationModalOpen(false)} />
      {/* Animated Mesh Gradients for Main App */}
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.15, 0.3, 0.15],
          x: [0, 40, 0],
          y: [0, -20, 0]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/20 dark:bg-blue-600/20 blur-[130px] pointer-events-none" 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.1, 0.25, 0.1],
          x: [0, -30, 0],
          y: [0, 30, 0]
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-400/20 dark:bg-cyan-500/20 blur-[130px] pointer-events-none" 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.3, 1],
          opacity: [0.1, 0.2, 0.1],
          rotate: [0, 45, 0]
        }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut", delay: 6 }}
        className="absolute top-[30%] right-[10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 dark:bg-purple-600/10 blur-[130px] pointer-events-none" 
      />

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
                    className="absolute right-0 top-full mt-2 w-28 bg-white/90 dark:bg-[#2C2C2E]/90 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.15)] z-50 overflow-hidden py-1.5 p-1.5"
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
        <header className="mb-10 md:mb-16 relative group">
          <div className="absolute inset-0 bg-yellow-500/10 dark:bg-yellow-500/15 rounded-[32px] md:rounded-[48px] blur-[60px] md:blur-[100px] opacity-100 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"></div>
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
                          <span className="text-[16px] font-black text-zinc-900 dark:text-white font-mono leading-none">{t('lvl')} {Math.max(1, Math.floor(stats.xp / 100))}</span>
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
                {(() => {
                  let todayPending = 0;
                  let activeCount = 0;
                  let totalPpd = 0;
                  
                  // For adherence
                  let totalExp = 0;
                  let totalTak = 0;

                  meds.forEach(med => {
                     const date = new Date(med.startDate);
                     const t = new Date();
                     const diffDays = Math.floor((t.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
                     const pillsPerDay = med.frequencyKey === 'thriceDaily' ? 3 : med.frequencyKey === 'twiceDaily' ? 2 : med.frequencyKey === 'fourTimesDaily' ? 4 : 1;
                     
                     if (diffDays >= 0 && diffDays < med.durationDays) {
                        activeCount++;
                        totalPpd += pillsPerDay;
                        const taken = med.pillsTaken?.[diffDays];
                        const count = typeof taken === 'number' ? taken : (taken ? pillsPerDay : 0);
                        todayPending += (pillsPerDay - count);
                     }
                     
                     if (diffDays >= 0) {
                        const upTo = Math.min(diffDays + 1, med.durationDays);
                        totalExp += upTo * pillsPerDay;
                        for (let i = 0; i < upTo; i++) {
                           const tk = med.pillsTaken?.[i];
                           totalTak += typeof tk === 'number' ? tk : (tk ? pillsPerDay : 0);
                        }
                     }
                  });
                  
                  const adherenceRate = totalExp === 0 ? 100 : Math.round((totalTak / totalExp) * 100);
                  const globalPercent = Math.max(1, 100 - (Math.floor(stats.xp / 100) * 3) - stats.streak);
                  
                  return (
                    <>
                      <p className="text-[15px] md:text-[18px] lg:text-[20px] text-zinc-600 dark:text-blue-100/80 mt-4 md:mt-6 font-medium leading-relaxed max-w-2xl transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] mx-auto md:mx-0">
                        {t('youHave')} <span className="text-cyan-700 dark:text-cyan-300 font-bold px-2 md:px-3 py-1 md:py-1.5 bg-cyan-100/80 dark:bg-cyan-900/40 rounded-lg md:rounded-xl border border-cyan-200 dark:border-cyan-400/30 backdrop-blur-md inline-block mx-1 shadow-inner">{todayPending} {t('pendingDosesPart1')}</span> {t('pendingDosesPart2')} 
                        {t('dailyPlanPart1')} {activeCount} {t('dailyPlanPart2')} {totalPpd} {t('dailyPlanPart3')}
                      </p>
                    </>
                  );
                })()}
              </div>
              <div className="glass-panel px-5 md:px-8 py-3.5 md:py-6 rounded-[24px] md:rounded-[32px] flex items-center gap-4 md:gap-6 shadow-xl relative z-10 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] shrink-0 w-full md:w-auto overflow-visible group hover:border-cyan-400/50">
                 <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-400/5 dark:from-blue-500/10 dark:to-cyan-400/10 rounded-[24px] md:rounded-[32px]"></div>
                 <div className="w-10 h-10 md:w-16 md:h-16 bg-blue-100/80 dark:bg-blue-500/20 rounded-xl md:rounded-2xl flex items-center justify-center border border-blue-200/50 dark:border-blue-400/30 shadow-[0_0_30px_rgba(59,130,246,0.1)] dark:shadow-[0_0_30px_rgba(59,130,246,0.3)] backdrop-blur-md group-hover:scale-110 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-900/40 transition-all duration-500">
                   <Activity className="w-5 h-5 md:w-8 md:h-8 text-cyan-500 dark:text-cyan-400 group-hover:animate-pulse" strokeWidth={2.5}/>
                 </div>
                 <div className="relative z-10 text-left">
                    <p className="text-[10px] md:text-[13px] font-bold text-zinc-500 dark:text-blue-200/60 tracking-widest uppercase mb-0 md:mb-1">{t('treatmentAdherence')}</p>
                    {(() => {
                        let totalExp = 0; let totalTak = 0;
                        meds.forEach(med => {
                           const diffDays = Math.floor((new Date().getTime() - new Date(med.startDate).getTime()) / (1000 * 60 * 60 * 24));
                           const pillsPerDay = med.frequencyKey === 'thriceDaily' ? 3 : med.frequencyKey === 'twiceDaily' ? 2 : med.frequencyKey === 'fourTimesDaily' ? 4 : 1;
                           if (diffDays >= 0) {
                              const upTo = Math.min(diffDays + 1, med.durationDays);
                              totalExp += upTo * pillsPerDay;
                              for (let i = 0; i < upTo; i++) {
                                 const tk = med.pillsTaken?.[i];
                                 totalTak += typeof tk === 'number' ? tk : (tk ? pillsPerDay : 0);
                              }
                           }
                        });
                        const adherenceRate = totalExp === 0 ? 100 : Math.round((totalTak / totalExp) * 100);
                        const globalPercent = Math.max(1, 100 - (Math.floor(stats.xp / 100) * 3) - stats.streak);
                        return (
                          <div>
                            <p className="text-[18px] md:text-[28px] font-black text-zinc-900 dark:text-white tracking-tight drop-shadow-md">{adherenceRate}% <span className="text-[12px] md:text-[16px] text-zinc-500 dark:text-zinc-400 font-bold ml-1">{t('accuracyTitle')}</span></p>
                            <p className="text-[10px] md:text-[12px] text-cyan-600 dark:text-cyan-400 mt-0.5 font-bold">{t('globalTopLabel')} {globalPercent}%</p>
                          </div>
                        );
                    })()}
                 </div>
              </div>
            </div>
          </motion.div>
        </header>

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
                          Doktor nazoratida
                        </div>
                      </div>

                      <div className="space-y-6">
                        {meds.length === 0 && (
                          <div className="text-center py-12 px-6 glass-panel rounded-[32px] border border-white/20">
                            <h3 className="text-2xl font-black text-zinc-900 dark:text-white mb-2">{t('noPlanTitle' as any)}</h3>
                            <p className="text-zinc-500 dark:text-blue-100/70 font-medium max-w-lg mx-auto">
                              {t('noPlanDesc' as any)}
                            </p>
                          </div>
                        )}
                        {meds.map((med, index) => (
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
                                      progress={med.totalPills > 0 ? (med.totalPills - med.remainingPills) / med.totalPills : 0} 
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
                                    <h3 className="text-[20px] md:text-[28px] font-black text-zinc-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] uppercase tracking-tight truncate">{t(med.nameKey as any)}</h3>
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
                                            animate={{ width: `${((med.totalPills - med.remainingPills)/med.totalPills) * 100}%` }}
                                            transition={{ duration: 1, delay: 0.2 }}
                                          />
                                        </div>
                                        <span className="text-[12px] font-mono font-bold text-zinc-500 dark:text-blue-200/80">
                                          {med.totalPills - med.remainingPills}/{med.totalPills}
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
                                      {med.pillsTaken.map((taken, i) => {
                                        const pillsPerDay = med.frequencyKey === 'thriceDaily' ? 3 : med.frequencyKey === 'twiceDaily' ? 2 : med.frequencyKey === 'fourTimesDaily' ? 4 : 1;
                                        const takenNum = typeof taken === 'number' ? taken : (taken ? pillsPerDay : 0);
                                        const isCompleted = takenNum === pillsPerDay;

                                        const date = new Date(med.startDate);
                                        if (!isNaN(date.getTime())) {
                                           date.setDate(date.getDate() + i);
                                        }
                                        const dateLabel = isNaN(date.getTime()) ? `D${i+1}` : String(date.getDate());
                                        
                                        const t = new Date();
                                        const isToday = !isNaN(date.getTime()) && date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear();
                                        
                                        return (
                                          <button
                                            key={i}
                                            onClick={() => toggleMed(med.id, i)}
                                            className={cn(
                                              "w-[42px] h-[54px] md:w-[48px] md:h-[60px] rounded-[14px] md:rounded-[16px] shrink-0 flex flex-col items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] shadow-sm relative overflow-hidden backdrop-blur-md",
                                              isCompleted 
                                                ? "shadow-[0_4px_15px_rgba(56,189,248,0.4)] hover:shadow-lg border border-white/20" 
                                                : isToday 
                                                  ? "bg-white/80 dark:bg-white/10 border-2 border-cyan-400 text-cyan-500 dark:text-cyan-300 shadow-inner"
                                                  : "bg-white/50 dark:bg-white/5 border border-black/5/50 dark:border-white/10 text-zinc-400 dark:text-blue-100/40 hover:bg-white dark:hover:bg-white/10"
                                            )}
                                          >
                                            {/* Water-like progress indicator */}
                                            {takenNum > 0 && (
                                              <motion.div 
                                                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500 to-cyan-400 animate-pulse-slow"
                                                initial={{ height: 0 }}
                                                animate={{ height: `${(takenNum / pillsPerDay) * 100}%` }}
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
                                                <span className="text-[12px] md:text-[14px] font-extrabold text-white tracking-widest">{takenNum}/{pillsPerDay}</span>
                                              ) : (
                                                <div className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-current opacity-30"></div>
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

                              {med.scientificContextKey && (
                                <div className="mt-8">
                                  <div className="relative p-6 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-500/10 dark:to-cyan-500/5 rounded-[24px] flex items-start gap-5 border border-black/5 dark:border-white/10 shadow-inner backdrop-blur-md">
                                    <div className="w-12 h-12 rounded-[16px] bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(59,130,246,0.1)] dark:shadow-[0_0_15px_rgba(59,130,246,0.3)] border border-blue-200 dark:border-blue-400/30">
                                      <BrainCircuit className="w-6 h-6 text-cyan-500 dark:text-cyan-400" strokeWidth={2.5} />
                                    </div>
                                    <div>
                                      <p className="text-[15px] leading-relaxed text-zinc-700 dark:text-white/90 font-medium">
                                        <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-300 uppercase text-[11px] tracking-widest block mb-1.5">{t('aiContext')}</span>
                                        {t(med.scientificContextKey)}
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 xl:gap-8">
                    <motion.div 
                      initial={{ opacity: 0, y: 40 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-50px" }}
                      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      className="glass-panel text-zinc-900 dark:text-white rounded-[40px] p-10 relative overflow-hidden group border border-white/60 dark:border-white/20"
                    >
                        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#EC4899] to-[#4F46E5] rounded-full blur-[100px] opacity-20 dark:opacity-40 group-hover:opacity-40 dark:group-hover:opacity-60 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"></div>
                      {(() => {
                        const globalPercent = Math.max(1, 100 - (Math.floor(stats.xp / 100) * 3) - stats.streak);
                        const adherenceRate = Math.min(100, Math.round(80 + (stats.streak * 0.8) + (Math.floor(stats.xp/100) * 1.5)));
                        const topPercentText = globalPercent <= 5 ? 5 : globalPercent <= 10 ? 10 : globalPercent <= 20 ? 20 : globalPercent <= 50 ? 50 : globalPercent;
                        const daysLeft = Math.max(1, 7 - (stats.streak % 7));
                        
                        let eliteDesc = '';
                        if (language === 'uz') eliteDesc = `Sizning qat'iyatingiz butun dunyodagi BIGUS foydalanuvchilarning eng yuqori ${topPercentText}% iga kiradi. ${topPercentText > 5 ? 'Elita darajaga' : 'Platinum darajaga'} yetish uchun buni yana ${daysLeft} kun davom ettiring.`;
                        else if (language === 'ru') eliteDesc = `Ваша стабильность ставит вас в топ ${topPercentText}% пользователей BIGUS по всему миру. Поддерживайте этот темп еще ${daysLeft} дней, чтобы достичь уровня ${topPercentText > 5 ? 'Элита' : 'Platinum'}.`;
                        else if (language === 'en') eliteDesc = `Your consistency puts you in the top ${topPercentText}% of BIGUS users globally. Keep this up for ${daysLeft} more days to reach ${topPercentText > 5 ? 'Elite' : 'Platinum'} tier.`;
                        else eliteDesc = `Сизнинг қатъиятингиз бутун дунёдаги BIGUS фойдаланувчиларнинг энг юқори ${topPercentText}% ига киради. ${topPercentText > 5 ? 'Элита даражага' : 'Platinum даражага'} етиш учун буни яна ${daysLeft} кун давом эттиринг.`;

                        let eliteTitle = '';
                        if (topPercentText <= 5) eliteTitle = language === 'uz' ? 'Siz elita darajadasiz.' : language === 'ru' ? 'Вы в элитной лиге.' : language === 'en' ? 'You\'re in the elite tier.' : 'Сиз элита даражадасиз.';
                        else eliteTitle = language === 'uz' ? 'Ajoyib natija!' : language === 'ru' ? 'Отличный результат!' : language === 'en' ? 'Great result!' : 'Ажойиб натижа!';

                        return (
                          <>
                            <div className="flex justify-between items-start mb-8 relative z-10">
                              <div className="p-4 bg-white dark:bg-white/5 dark:backdrop-blur-md rounded-[20px] border border-black/5 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)]">
                                <TrendingUp className="w-8 h-8 text-blue-600 dark:text-white" strokeWidth={2} />
                              </div>
                              <div className="text-right">
                                <span className="text-[48px] font-black tracking-tighter text-zinc-900 dark:text-white drop-shadow-md">{adherenceRate}%</span>
                                <p className="text-[12px] text-zinc-500 dark:text-white/70 font-bold uppercase tracking-widest mt-1">{t('globalAdherence')}</p>
                              </div>
                            </div>
                            <h3 className="text-[24px] font-bold mb-3 relative z-10 text-zinc-900 dark:text-white">{eliteTitle}</h3>
                            <p className="text-[16px] text-zinc-600 dark:text-white/80 leading-relaxed font-medium relative z-10">{eliteDesc}</p>
                          </>
                        );
                      })()}
                    </motion.div>

                    <motion.div 
                      initial={{ opacity: 0, y: 40 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-50px" }}
                      transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                      className="glass-panel rounded-[40px] p-10 group relative border-white/60 dark:border-white/10"
                    >
                        <div className="absolute top-0 left-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none"></div>
                        <h3 className="text-[24px] font-black mb-6 flex items-center gap-3 text-zinc-900 dark:text-white relative z-10">
                          <Zap className="w-6 h-6 text-cyan-500 dark:text-cyan-400" fill="currentColor" strokeWidth={0} /> {t('aiHealthTips')}
                        </h3>
                        <div className="space-y-4 relative z-10">
                          {HEALTH_TIPS.map(tip => (
                            <div key={tip.id} className="p-5 bg-white dark:bg-slate-800/40 dark:backdrop-blur-md rounded-[24px] border border-black/5 dark:border-white/5 hover:scale-[1.01] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-default shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
                              <p className="text-[15px] text-zinc-800 dark:text-blue-50 font-semibold leading-relaxed">{t(tip.contentKey as any)}</p>
                            </div>
                          ))}
                        </div>
                        <button className="relative z-10 w-full mt-6 py-4 bg-white/60 dark:bg-white/10 text-cyan-700 dark:text-cyan-300 border border-white/60 dark:border-white/20 shadow-sm rounded-[20px] text-[16px] font-bold hover:bg-white/80 dark:hover:bg-white/20 hover:text-cyan-800 dark:hover:text-cyan-200 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98]">
                          {t('generateMoreTips')}
                        </button>
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
                        <code className="text-blue-600 dark:text-blue-400 font-black tracking-widest text-[14px] md:text-[18px]">bigus.health/r/saidahror</code>
                        <button className="w-full sm:w-auto px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-[14px] md:rounded-[16px] font-black transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] shadow-lg shadow-blue-500/20 active:scale-[0.98] text-sm md:text-base">{t('copy')}</button>
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
                  <section className="glass-panel rounded-[40px] p-8 xl:p-10 border-white/60 dark:border-white/10">
                    <h2 className="text-[28px] font-black mb-8 text-zinc-900 dark:text-white">{t('longTermReport')}</h2>
                    <div className="h-[400px] w-full bg-white dark:bg-slate-800/40 dark:backdrop-blur-md rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-black/5 dark:border-white/5">
                        <ResponsiveContainer width="100%" height="100%">
                          {(() => {
                            const data = [];
                            const tDate = new Date();
                            tDate.setHours(0,0,0,0);
                            for (let w = 4; w >= 0; w--) {
                               const eDate = new Date(tDate);
                               eDate.setDate(eDate.getDate() - (w * 7));
                               const sDate = new Date(eDate);
                               sDate.setDate(sDate.getDate() - 6);
                               
                               let e=0, t_val=0;
                               meds.forEach(md => {
                                  const msd = new Date(md.startDate);
                                  msd.setHours(0,0,0,0);
                                  const ppd = md.frequencyKey === 'thriceDaily' ? 3 : md.frequencyKey === 'twiceDaily' ? 2 : md.frequencyKey === 'fourTimesDaily' ? 4 : 1;
                                  for(let i=0; i<md.durationDays; i++) {
                                      const d = new Date(msd); d.setDate(d.getDate()+i);
                                      if(d>=sDate && d<=eDate) {
                                          e+=ppd;
                                          const tk = md.pillsTaken?.[i];
                                          t_val += typeof tk === 'number' ? tk : (tk ? ppd : 0);
                                      }
                                  }
                               });
                               data.push({ 
                                  date: w === 0 ? 'Today' : `${eDate.getDate()} ${eDate.toLocaleString('default', {month:'short'})}`, 
                                  rate: e===0 ? 0 : Math.round((t_val/e)*100) 
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
                           <YAxis axisLine={false} tickLine={false} tick={{fill: isDarkMode ? '#93c5fd' : '#64748b', fontSize: 13, fontWeight: 700}} dx={-10} />
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
                           <Area type="monotone" dataKey="rate" stroke="url(#colorRate)" strokeWidth={5} fillOpacity={1} fill="url(#colorRate)" activeDot={{ r: 8, fill: '#38bdf8', stroke: '#fff', strokeWidth: 4, zIndex: 10 }} />
                         </AreaChart>
                         })()}
                       </ResponsiveContainer>
                    </div>
                  </section>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 xl:gap-8">
                    <div className="glass-panel p-8 rounded-[40px] relative overflow-hidden group border-white/60 dark:border-white/10">
                      <div className="absolute -right-4 -top-4 w-32 h-32 bg-emerald-500 rounded-full blur-[40px] opacity-10 dark:opacity-20 group-hover:opacity-20 dark:group-hover:opacity-40 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"></div>
                      <div className="p-4 bg-white dark:bg-white/5 dark:backdrop-blur-md rounded-[20px] w-fit mb-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-black/5 dark:border-white/5">
                        <Leaf className="w-8 h-8 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                      </div>
                      <h4 className="text-[20px] font-bold text-zinc-900 dark:text-white tracking-tight">{t('bioConsistency')}</h4>
                      <p className="text-[15px] text-zinc-600 dark:text-blue-100/70 mt-2 font-medium leading-relaxed">
                        {meds.length > 0 ? (
                           language === 'ru' ? `Регулярный прием препарата ${meds[0].medName} улучшает ваш микробный баланс.` :
                           language === 'en' ? `Regular intake of ${meds[0].medName} is improving your microbial balance.` :
                           language === 'uz-cyrl' ? `${meds[0].medName}ни мунтазам қабул қилишингиз ҳисобига микробиал балансингиз яхшиланмоқда.` :
                           `${meds[0].medName}ni muntazam qabul qilishingiz hisobiga mikrobial balansingiz yaxshilanmoqda.`
                        ) : t('bioDesc')}
                      </p>
                    </div>
                    <div className="glass-panel p-8 rounded-[40px] relative overflow-hidden group border-white/60 dark:border-white/10">
                      <div className="absolute -right-4 -top-4 w-32 h-32 bg-blue-500 rounded-full blur-[40px] opacity-10 dark:opacity-20 group-hover:opacity-20 dark:group-hover:opacity-40 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"></div>
                      <div className="p-4 bg-white dark:bg-[#1C1C1E] rounded-[20px] w-fit mb-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-black/5 dark:border-white/5">
                        <Activity className="w-8 h-8 text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
                      </div>
                      <h4 className="text-[20px] font-bold text-zinc-900 dark:text-white tracking-tight">{t('vascularHealth')}</h4>
                      <p className="text-[15px] text-zinc-600 dark:text-blue-100/70 mt-2 font-medium leading-relaxed">
                        {meds.length > 0 ? (
                           language === 'ru' ? `Прием ${meds[0].medName} обеспечил стабильность организма в последние дни.` :
                           language === 'en' ? `Taking ${meds[0].medName} has ensured body stability in recent days.` :
                           language === 'uz-cyrl' ? `${meds[0].medName} қабул қилиш охирги кунларда танадаги барқарорликни таъминлади.` :
                           `${meds[0].medName} qabul qilish oxirgi kunlarda tanadagi barqarorlikni ta'minladi.`
                        ) : t('vascularDesc')}
                      </p>
                    </div>
                    <div className="glass-panel p-8 rounded-[40px] relative overflow-hidden group border-white/60 dark:border-white/10">
                      <div className="absolute -right-4 -top-4 w-32 h-32 bg-yellow-500 rounded-full blur-[40px] opacity-10 dark:opacity-20 group-hover:opacity-20 dark:group-hover:opacity-40 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"></div>
                      <div className="p-4 bg-white dark:bg-slate-800/40 dark:backdrop-blur-md rounded-[20px] w-fit mb-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-black/5 dark:border-white/5">
                        <Trophy className="w-8 h-8 text-yellow-600 dark:text-yellow-400" strokeWidth={2.5} />
                      </div>
                      <h4 className="text-[20px] font-bold text-zinc-900 dark:text-white tracking-tight">{t('milestoneLevel')}</h4>
                      <p className="text-[15px] text-zinc-600 dark:text-blue-100/70 mt-2 font-medium leading-relaxed">
                        {language === 'ru' ? `До значка «Мастер упорства» осталось всего ${Math.max(1, 5 - stats.streak % 5)} дней.` : 
                         language === 'en' ? `Only ${Math.max(1, 5 - stats.streak % 5)} days left until the "Master of Tenacity" badge.` : 
                         language === 'uz-cyrl' ? `"Қатъият устаси" нишонига атиги ${Math.max(1, 5 - stats.streak % 5)} кун қолди.` : 
                         `"Qat'iyat ustasi" nishoniga atigi ${Math.max(1, 5 - stats.streak % 5)} kun qoldi.`}
                      </p>
                    </div>
                  </div>

                  <section className="glass-panel rounded-[40px] p-8 xl:p-10 border-white/60 dark:border-white/10 mt-8">
                     <h2 className="text-[24px] font-black tracking-tight text-zinc-900 dark:text-white mb-6 uppercase">{t('vitalsTitle')}</h2>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                        {(() => {
                           // Use date as seed to make these consistent per day
                           const seed = new Date().getDate();
                           const heartRate = 65 + (seed % 15);
                           const calories = 2000 + ((seed * 43) % 800);
                           const steps = 4000 + ((seed * 153) % 6000);
                           const sleepHours = (6.5 + ((seed * 3) % 25) / 10).toFixed(1);

                           return (
                             <>
                                <div className="bg-white dark:bg-slate-800/40 dark:backdrop-blur-md p-6 rounded-[24px] border border-black/5 dark:border-white/5 shadow-sm group">
                                   <div className="flex items-center gap-3 mb-4">
                                      <div className="bg-red-500/10 p-2.5 rounded-xl">
                                         <Heart className="w-5 h-5 text-red-500" />
                                      </div>
                                      <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">{t('heartRate')}</span>
                                   </div>
                                   <div className="flex items-end gap-2 text-zinc-900 dark:text-white">
                                      <span className="text-[32px] md:text-[40px] font-black font-mono leading-none tracking-tight">{heartRate}</span>
                                      <span className="text-sm font-bold opacity-60 mb-1">{t('bpm')}</span>
                                   </div>
                                </div>
                                <div className="bg-white dark:bg-slate-800/40 dark:backdrop-blur-md p-6 rounded-[24px] border border-black/5 dark:border-white/5 shadow-sm group">
                                   <div className="flex items-center gap-3 mb-4">
                                      <div className="bg-orange-500/10 p-2.5 rounded-xl">
                                         <Flame className="w-5 h-5 text-orange-500" />
                                      </div>
                                      <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">{t('calories')}</span>
                                   </div>
                                   <div className="flex items-end gap-2 text-zinc-900 dark:text-white">
                                      <span className="text-[32px] md:text-[40px] font-black font-mono leading-none tracking-tight">{calories}</span>
                                      <span className="text-sm font-bold opacity-60 mb-1">{t('kcal')}</span>
                                   </div>
                                </div>
                                <div className="bg-white dark:bg-slate-800/40 dark:backdrop-blur-md p-6 rounded-[24px] border border-black/5 dark:border-white/5 shadow-sm group">
                                   <div className="flex items-center gap-3 mb-4">
                                      <div className="bg-blue-500/10 p-2.5 rounded-xl">
                                         <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                      </div>
                                      <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">{t('steps')}</span>
                                   </div>
                                   <div className="flex items-end gap-2 text-zinc-900 dark:text-white">
                                      <span className="text-[32px] md:text-[40px] font-black font-mono leading-none tracking-tight">{steps.toLocaleString()}</span>
                                      <span className="text-sm font-bold opacity-60 mb-1">{t('stepsUnit')}</span>
                                   </div>
                                </div>
                                <div className="bg-white dark:bg-slate-800/40 dark:backdrop-blur-md p-6 rounded-[24px] border border-black/5 dark:border-white/5 shadow-sm group">
                                   <div className="flex items-center gap-3 mb-4">
                                      <div className="bg-indigo-500/10 p-2.5 rounded-xl">
                                         <Moon className="w-5 h-5 text-indigo-500" />
                                      </div>
                                      <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">{t('sleep')}</span>
                                   </div>
                                   <div className="flex items-end gap-2 text-zinc-900 dark:text-white">
                                      <span className="text-[32px] md:text-[40px] font-black font-mono leading-none tracking-tight">{sleepHours}</span>
                                      <span className="text-sm font-bold opacity-60 mb-1">{t('hoursUnit')}</span>
                                   </div>
                                </div>
                             </>
                           );
                        })()}
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
                                  <span className="px-3 py-1.5 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 text-[10px] font-black uppercase tracking-widest border border-cyan-200 dark:border-cyan-500/20 shadow-sm">{item.category === 'article' ? 'Maqola' : item.category === 'announcement' ? "E'lon" : "Yangilik"}</span>
                               </div>
                               <h4 className="text-[18px] md:text-[22px] font-black text-zinc-900 dark:text-white mb-3 line-clamp-2 leading-tight group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors uppercase tracking-tight">{item.title[language as keyof any] || item.title.uz}</h4>
                               <p className="text-[14px] text-zinc-600 dark:text-zinc-400 line-clamp-3 mb-6 font-medium leading-relaxed flex-1">{item.content[language as keyof any] || item.content.uz}</p>
                               <div className="mt-auto flex items-center justify-between w-full pt-6 border-t border-black/5 dark:border-white/5">
                                 <span className="text-[12px] text-zinc-500 dark:text-zinc-500 font-bold flex items-center gap-2 uppercase tracking-widest"><Calendar className="w-4 h-4 text-cyan-500/70" />{new Date(item.createdAt).toLocaleDateString()}</span>
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
                        <p className="text-zinc-500 dark:text-blue-100/70 text-[13px] md:text-[16px] mt-1 md:mt-2 font-medium">O'ynang va H-Coinlar ishlang!</p>
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
                          <p className="text-zinc-500 dark:text-blue-100/60 font-medium mb-8">To'siqlardan o'ting va har bir o'tgan to'siq uchun 2 H-Coin oling!</p>
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
                          <p className="text-zinc-500 dark:text-blue-100/60 font-medium mb-8">Not-coin uslubida: har bir bosish uchun 1 H-Coin ishlang!</p>
                          <span className="px-8 py-3 bg-yellow-600 text-white rounded-full font-black text-sm uppercase tracking-widest shadow-lg shadow-yellow-500/30 group-hover:bg-yellow-500 transition-colors">{t('playNow' as any)}</span>
                        </div>
                      </div>
                    ) : activeGame === 'flappy' ? (
                      <FlappyBirdGame onBack={() => setActiveGame('none')} onEarn={(coins) => updateGlobalCoins(coins)} t={t} />
                    ) : (
                      <HCoinClickerGame onBack={() => setActiveGame('none')} onEarn={(coins) => updateGlobalCoins(coins)} t={t} />
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
                  <TaskView onEarn={updateGlobalCoins} t={t} language={language} />
                </motion.div>
              ) : activeTab === 'videos' ? (
                <motion.div
                  key="videos"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <VideoView 
                    onEarn={updateGlobalCoins} 
                    t={t} 
                    isAdminUser={currentUser?.email === 'saidahrorzayniddinov@gmail.com'} 
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
                  <section className="glass-panel rounded-[32px] md:rounded-[40px] p-6 md:p-8 xl:p-10">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8 md:mb-10 text-center sm:text-left">
                      <div>
                        <h2 className="text-[22px] md:text-[28px] font-black tracking-tight text-zinc-900 dark:text-white uppercase">{t('redeemStore')}</h2>
                        <p className="text-zinc-500 dark:text-blue-100/70 text-[13px] md:text-[16px] mt-1 md:mt-2 font-medium">{t('shopSubTitle' as any)}</p>
                      </div>
                      <div className="flex items-center gap-3 md:gap-4 px-5 md:px-6 py-2.5 md:py-3 bg-blue-500/10 dark:bg-white/5 border border-white/40 dark:border-white/10 rounded-2xl">
                        <Trophy className="w-5 h-5 md:w-6 md:h-6 text-yellow-500" />
                        <span className="text-[20px] md:text-[24px] font-black text-zinc-900 dark:text-white">{stats.hCoins}</span>
                        <span className="text-[10px] md:text-[12px] font-bold text-zinc-400 uppercase tracking-widest">H-Coins</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                      {[
                        { id: '2', nameKey: 'notebook', price: 2500, img: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=400' },
                        { id: '3', nameKey: 'cap', price: 5000, img: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&q=80&w=400' },
                        { id: '4', nameKey: 'tshirt', price: 12000, img: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&q=80&w=400' },
                        { id: '5', nameKey: 'polyclinicDiscount', price: 25000, img: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=400' },
                        { id: '6', nameKey: 'polyclinicDiscount', price: 30000, img: 'https://images.unsplash.com/photo-1638202993928-7267aad84c31?auto=format&fit=crop&q=80&w=400' },
                        { id: '7', nameKey: 'sanatoriumVoucher', price: 50000, img: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80&w=400' },
                        { id: '8', nameKey: 'sanatoriumVoucher', price: 60000, img: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=400' },
                        { id: '9', nameKey: 'sanatoriumVoucher', price: 70000, img: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&q=80&w=400' }
                      ].map(item => (
                        <div key={item.id} className="bg-white dark:bg-slate-800/40 dark:backdrop-blur-md p-4 md:p-5 rounded-[24px] md:rounded-[32px] border border-black/5 dark:border-white/10 hover:border-blue-500/30 group relative flex flex-col transition-all duration-500 shadow-sm hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1">
                          
                          <div className="w-full aspect-[4/3] rounded-[16px] md:rounded-[24px] overflow-hidden mb-5 relative bg-zinc-100 dark:bg-zinc-800">
                             <img src={item.img} alt={t(item.nameKey as any)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]" />
                             <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                          </div>
                          
                          <div className="flex flex-col flex-grow px-2 md:px-3">
                            <h3 className="text-[18px] md:text-[20px] font-bold text-zinc-900 dark:text-white mb-2 leading-tight">{t(item.nameKey as any)}</h3>
                            
                            <div className="mt-auto pt-4">
                              <div className="flex items-center gap-2 mb-8 md:mb-10">
                                <div className="bg-yellow-500/10 p-2.5 rounded-xl">
                                  <Trophy className="w-5 h-5 text-yellow-600 dark:text-yellow-500" strokeWidth={2.5} />
                                </div>
                                <span className="text-[20px] md:text-[24px] font-black text-zinc-900 dark:text-white">{item.price.toLocaleString()}</span>
                              </div>
                              <button 
                                disabled={stats.hCoins < item.price}
                                className={cn(
                                  "w-full py-3.5 rounded-[16px] font-bold text-[14px] transition-all duration-300",
                                  stats.hCoins >= item.price 
                                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 shadow-lg active:scale-[0.98]" 
                                    : "bg-zinc-100 dark:bg-white/5 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
                                )}
                              >
                                {t('redeem')}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </motion.div>
              ) : (
                <motion.div 
                  key="ai"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="h-[calc(100vh-140px)] flex flex-col glass-panel rounded-[40px] overflow-hidden relative border-white/60 dark:border-white/10"
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

                  <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar relative z-10" ref={scrollRef}>
                    {messages.map((m, i) => (
                      <div key={i} className={cn(
                        "flex flex-col whitespace-pre-wrap max-w-[85%]",
                        m.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                      )}>
                        <div className={cn(
                          "px-7 py-5 rounded-[32px] text-[16px] leading-relaxed font-medium shadow-sm",
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

                  <div className="p-6 bg-white/50 dark:bg-white/5 border-t border-white/60 dark:border-white/10 backdrop-blur-xl z-10">
                    <div className="relative group max-w-4xl mx-auto shadow-sm rounded-full">
                      <input 
                        type="text" 
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder={t('askBigus')}
                        className="w-full bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-full px-6 py-4 pr-16 text-[15px] font-medium focus:outline-none focus:bg-white/80 dark:focus:bg-white/10 text-zinc-900 dark:text-white placeholder-slate-500/60 dark:placeholder-blue-100/40 focus:ring-4 focus:ring-cyan-500/20 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] focus:border-cyan-500/50"
                      />
                      <button 
                        onClick={handleSendMessage}
                        className="absolute right-2 top-2 bottom-2 w-[40px] h-[40px] bg-gradient-to-br from-blue-500 to-cyan-400 text-white rounded-full flex items-center justify-center hover:scale-105 active:scale-[0.98] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] shadow-[0_4px_12px_rgba(56,189,248,0.3)]"
                      >
                        <ChevronRight className="w-5 h-5 text-white" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Side Panel: AI Assistant & Stats */}
          <div className="col-span-12 lg:col-span-4 space-y-6 md:space-y-8">
            
            {/* Gamification Card */}
            <div className="glass-panel-dark rounded-[32px] md:rounded-[40px] p-6 md:p-8 relative overflow-hidden text-zinc-900 dark:text-white border border-white/60 dark:border-white/20">
               <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#FCD34D] to-[#F59E0B] rounded-full blur-[80px] opacity-10 dark:opacity-20"></div>
               <div className="flex items-center justify-between mb-6 md:mb-8 relative z-10">
                  <div className="flex items-center gap-4 md:gap-5">
                    <div className="w-[60px] h-[60px] md:w-[72px] md:h-[72px] rounded-xl md:rounded-[24px] bg-gradient-to-br from-[#F59E0B] to-[#EF4444] flex items-center justify-center text-[28px] md:text-[36px] shadow-[0_8px_24px_rgba(245,158,11,0.2)] dark:shadow-[0_8px_24px_rgba(245,158,11,0.4)] text-white border border-white/20 hover:scale-105 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"><Trophy className="w-6 h-6 md:w-8 md:h-8" fill="currentColor" strokeWidth={0} /></div>
                    <div>
                      <h4 className="text-[32px] md:text-[40px] font-black font-mono leading-none tracking-tight text-zinc-900 dark:text-white mb-1">
                        {(() => {
                           let computedStreak = 0;
                           const today = new Date();
                           today.setHours(0,0,0,0);
                           for (let i = 0; i < 365; i++) {
                              let d = new Date(today);
                              d.setDate(d.getDate() - i);
                              let e = 0, t_val = 0;
                              meds.forEach(md => {
                                 const s = new Date(md.startDate); s.setHours(0,0,0,0);
                                 const ppd = md.frequencyKey === 'thriceDaily' ? 3 : md.frequencyKey === 'twiceDaily' ? 2 : md.frequencyKey === 'fourTimesDaily' ? 4 : 1;
                                 const idx = Math.floor((d.getTime() - s.getTime()) / (1000*60*60*24));
                                 if (idx >= 0 && idx < md.durationDays) {
                                    e += ppd;
                                    const tk = md.pillsTaken?.[idx];
                                    t_val += typeof tk === 'number' ? tk : (tk ? ppd : 0);
                                 }
                              });
                              
                              if (i === 0) {
                                 if (e > 0 && t_val === e) computedStreak++;
                              } else {
                                 if (e > 0 && t_val === e) {
                                    computedStreak++;
                                 } else if (e > 0 && t_val !== e) {
                                    break;
                                 }
                              }
                           }
                           return Math.max(stats.streak, computedStreak);
                        })()}
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
                      {(() => {
                        let exp7 = 0; let tak7 = 0;
                        const tDate = new Date();
                        meds.forEach(md => {
                           const sDate = new Date(md.startDate);
                           const ppd = md.frequencyKey === 'thriceDaily' ? 3 : md.frequencyKey === 'twiceDaily' ? 2 : md.frequencyKey === 'fourTimesDaily' ? 4 : 1;
                           for (let i = 0; i < md.durationDays; i++) {
                              const d = new Date(sDate);
                              d.setDate(d.getDate() + i);
                              const diff = Math.floor((tDate.getTime() - d.getTime()) / (1000*60*60*24));
                              if (diff >= 0 && diff < 7) {
                                  exp7 += ppd;
                                  const tk = md.pillsTaken?.[i];
                                  tak7 += typeof tk === 'number' ? tk : (tk ? ppd : 0);
                              }
                           }
                        });
                        const weeklyPct = exp7 === 0 ? 0 : Math.round((tak7 / exp7) * 100);
                        return weeklyPct === 100 ? `100% ${t('completedPct').toUpperCase()}` : `${weeklyPct}% ${t('completedPct')}`;
                      })()}
                    </span>
                  </div>
                  <div className="h-2.5 md:h-3 bg-zinc-100 dark:bg-white/10 rounded-full overflow-hidden shadow-inner border border-zinc-300 dark:border-white/10">
                    <div className="h-full bg-gradient-to-r from-[#F59E0B] to-[#FCD34D] rounded-full transition-all duration-1000" style={{ width: `${(() => {
                        let exp7 = 0; let tak7 = 0;
                        const tDate = new Date();
                        meds.forEach(md => {
                           const sDate = new Date(md.startDate);
                           const ppd = md.frequencyKey === 'thriceDaily' ? 3 : md.frequencyKey === 'twiceDaily' ? 2 : md.frequencyKey === 'fourTimesDaily' ? 4 : 1;
                           for (let i = 0; i < md.durationDays; i++) {
                              const d = new Date(sDate);
                              d.setDate(d.getDate() + i);
                              const diff = Math.floor((tDate.getTime() - d.getTime()) / (1000*60*60*24));
                              if (diff >= 0 && diff < 7) {
                                  exp7 += ppd;
                                  const tk = md.pillsTaken?.[i];
                                  tak7 += typeof tk === 'number' ? tk : (tk ? ppd : 0);
                              }
                           }
                        });
                        return exp7 === 0 ? 0 : Math.round((tak7 / exp7) * 100);
                      })()}%` }}></div>
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
                         {news[0].category === 'article' ? 'Maqola' : news[0].category === 'announcement' ? "E'lon" : "Yangilik"}
                       </span>
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full h-48 md:h-56 bg-zinc-100 dark:bg-black/20 flex items-center justify-center overflow-hidden border-b border-black/5 dark:border-white/5">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 group-hover:scale-110 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"></div>
                    <Activity className="w-12 h-12 text-cyan-500/40 relative z-10 group-hover:scale-110 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]" />
                    <div className="absolute top-4 right-4 z-20">
                       <span className="px-3 py-1.5 rounded-full bg-cyan-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-cyan-500/30 backdrop-blur-md">
                         {news[0].category === 'article' ? 'Maqola' : news[0].category === 'announcement' ? "E'lon" : "Yangilik"}
                       </span>
                    </div>
                  </div>
                )}
                
                <div className="p-6 md:p-8 flex flex-col relative z-10">
                  <h3 className="text-[18px] md:text-[22px] font-extrabold text-zinc-900 dark:text-white mb-3 line-clamp-2 leading-tight group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors uppercase tracking-tight">
                    {news[0].title[language as keyof any] || news[0].title.uz}
                  </h3>
                  <p className="text-[14px] text-zinc-600 dark:text-zinc-400 line-clamp-3 mb-6 font-medium leading-relaxed">
                    {news[0].content[language as keyof any] || news[0].content.uz}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-5 border-t border-black/5 dark:border-white/10">
                    <span className="text-[11px] md:text-[12px] text-zinc-500 dark:text-zinc-400 font-bold flex items-center gap-2 uppercase tracking-widest">
                      <Calendar className="w-4 h-4 md:w-5 md:h-5 text-cyan-500/70" />
                      {new Date(news[0].createdAt).toLocaleDateString()}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-white/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                      <ChevronRight className="w-4 h-4 text-zinc-500 dark:text-zinc-400 group-hover:text-cyan-500 transition-colors" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
            <div className="glass-panel rounded-[32px] md:rounded-[40px] h-[500px] md:h-[600px] flex flex-col overflow-hidden relative border-white/60 dark:border-white/10">
               <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-full blur-[100px] opacity-10 dark:opacity-20 pointer-events-none"></div>
               
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
                 <button className="p-2.5 bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20 rounded-full transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] shadow-sm text-zinc-500 dark:text-blue-100 border border-white/60 dark:border-white/10">
                   <Settings className="w-4 h-4 md:w-5 md:h-5" />
                 </button>
               </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative z-10" ref={scrollRef}>
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
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
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

            {/* Educational / Social Proof */}
            <div className="glass-panel-dark rounded-[40px] p-8 text-zinc-900 dark:text-white border border-white/60 dark:border-white/20 shadow-xl overflow-hidden relative group">
               <div className="absolute -right-10 -top-10 w-40 h-40 bg-cyan-400 rounded-full blur-[60px] opacity-10 group-hover:opacity-20 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"></div>
               <div className="flex items-center gap-4 mb-6 relative z-10">
                  <div className="w-12 h-12 bg-gradient-to-br from-cyan-400/20 to-blue-500/20 rounded-2xl flex items-center justify-center border border-cyan-400/30 shadow-inner">
                    <Droplets className="w-6 h-6 text-cyan-600 dark:text-cyan-400" strokeWidth={2.5}/>
                  </div>
                  <h4 className="font-extrabold text-[20px] text-zinc-900 dark:text-white">{t('fluidAdherence')}</h4>
               </div>
               <p className="text-[16px] text-zinc-700 dark:text-white/80 leading-relaxed italic relative z-10 font-medium">{t('fluidDesc')}</p>
               <div className="mt-8 flex items-center gap-4 relative z-10">
                 <div className="flex -space-x-3">
                   {[1,2,3].map(v => <div key={v} className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 border-2 border-white dark:border-zinc-800 flex items-center justify-center text-[11px] font-bold text-zinc-500 dark:text-white/70 shadow-sm">U{v}</div>)}
                 </div>
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

      {/* Simplified Add Medication Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-white/40 dark:bg-[#020617]/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg glass-panel-dark rounded-[32px] md:rounded-[40px] p-6 sm:p-8 md:p-10 shadow-[0_32px_64px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_64px_rgba(0,0,0,0.5)] border border-white/60 dark:border-white/10"
            >
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <h2 className="text-[24px] sm:text-[32px] font-black tracking-tight text-zinc-900 dark:text-white drop-shadow-sm uppercase">{t('newRegimen')}</h2>
                <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-[16px] sm:rounded-[20px] shadow-lg shadow-blue-500/30 border border-transparent dark:border-white/20">
                  <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-white" strokeWidth={2.5} />
                </div>
              </div>
              
              <div className="space-y-4 md:space-y-6">
                <div>
                  <label className="text-[10px] md:text-[12px] font-bold uppercase text-zinc-500 dark:text-blue-200/60 tracking-wider block mb-2 px-1">{t('prescriptionName')}</label>
                  <input type="text" placeholder={t('egVitamin')} className="w-full p-4 bg-zinc-100 dark:bg-[#2C2C2E] border border-transparent dark:border-transparent rounded-[20px] outline-none focus:bg-white dark:focus:bg-[#3A3A3C] focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] text-zinc-900 dark:text-white placeholder-slate-500/50 dark:placeholder-blue-100/30 font-medium shadow-inner" />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div>
                    <label className="text-[10px] md:text-[12px] font-bold uppercase text-zinc-500 dark:text-blue-200/60 tracking-wider block mb-2 px-1">{t('dailyFrequency')}</label>
                    <select className="w-full p-4 bg-zinc-100 dark:bg-[#2C2C2E] border border-transparent dark:border-transparent rounded-[20px] outline-none focus:bg-white dark:focus:bg-[#3A3A3C] focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] text-zinc-900 dark:text-white font-medium shadow-inner appearance-none">
                      <option className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">{t('onceDaily')}</option>
                      <option className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">{t('twiceDaily')}</option>
                      <option className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">{t('thriceDaily')}</option>
                    </select>
                  </div>
                   <div>
                    <label className="text-[10px] md:text-[12px] font-bold uppercase text-zinc-500 dark:text-blue-200/60 tracking-wider block mb-2 px-1">{t('courseLength')}</label>
                    <input type="number" placeholder="30" className="w-full p-4 bg-zinc-100 dark:bg-[#2C2C2E] border border-transparent dark:border-transparent rounded-[20px] outline-none focus:bg-white dark:focus:bg-[#3A3A3C] focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] text-zinc-900 dark:text-white placeholder-slate-500/50 dark:placeholder-blue-100/30 font-medium shadow-inner" />
                  </div>
                </div>

                <div className="p-4 sm:p-5 bg-cyan-500/10 border border-cyan-400/20 rounded-[20px] flex items-start gap-3 shadow-inner backdrop-blur-md">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" strokeWidth={2.5} />
                  <p className="text-[12px] sm:text-[14px] text-cyan-800 dark:text-cyan-100 leading-relaxed font-bold">{t('bigusAutoGenerate')}</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 md:pt-6">
                  <button onClick={() => setIsAddModalOpen(false)} className="order-2 sm:order-1 flex-1 py-4 text-zinc-500 dark:text-blue-100/60 font-bold hover:text-zinc-800 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/10 rounded-[20px] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] border border-transparent">{t('cancel')}</button>
                  <button 
                    onClick={() => setIsAddModalOpen(false)}
                    className="order-1 sm:order-2 flex-[2] py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-[20px] font-bold shadow-xl shadow-cyan-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] border border-transparent dark:border-white/20"
                  >
                    {t('initializePlan')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
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
                  {t('lvl')} {stats.level}
                </p>
                <div className="mt-4 flex flex-col items-center gap-2">
                   <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-sm font-bold">
                     <Calendar className="w-4 h-4" /> {userData?.birthDate || 'Kiritilmagan'}
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
              <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
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
                            <span className="px-3 py-1.5 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 text-[10px] font-black uppercase tracking-widest border border-cyan-200 dark:border-cyan-500/20 shadow-sm">{item.category === 'article' ? 'Maqola' : item.category === 'announcement' ? "E'lon" : "Yangilik"}</span>
                         </div>
                         <h4 className="text-[18px] md:text-[22px] font-black text-zinc-900 dark:text-white mb-3 line-clamp-2 leading-tight group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors uppercase tracking-tight">{item.title[language as keyof any] || item.title.uz}</h4>
                         <p className="text-[14px] text-zinc-600 dark:text-zinc-400 line-clamp-3 mb-6 font-medium leading-relaxed flex-1">{item.content[language as keyof any] || item.content.uz}</p>
                         <div className="mt-auto flex items-center justify-between w-full pt-6 border-t border-black/5 dark:border-white/5">
                           <span className="text-[12px] text-zinc-500 dark:text-zinc-500 font-bold flex items-center gap-2 uppercase tracking-widest"><Calendar className="w-4 h-4 text-cyan-500/70" />{new Date(item.createdAt).toLocaleDateString()}</span>
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => setSelectedNews(null)}
            />
            <motion.div 
              initial={{ opacity: 0, y: 30, scale: 0.95 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-white dark:bg-[#12151C] rounded-[32px] md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="relative w-full h-64 md:h-80 shrink-0">
                {selectedNews.imageUrl ? (
                   <img src={selectedNews.imageUrl} alt="News Image" className="w-full h-full object-cover" />
                ) : (
                   <div className="w-full h-full bg-zinc-100 dark:bg-black/20 flex items-center justify-center">
                     <Activity className="w-16 h-16 text-cyan-500/40" />
                   </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <button 
                  onClick={() => setSelectedNews(null)}
                  className="absolute top-4 right-4 md:top-6 md:right-6 w-10 h-10 md:w-12 md:h-12 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all shadow-lg"
                >
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
                <div className="absolute bottom-0 left-0 w-full p-6 md:p-8">
                   <div className="mb-3 inline-block">
                     <span className="px-3 py-1.5 rounded-full bg-cyan-500/80 text-white text-[10px] md:text-[12px] font-black uppercase tracking-widest shadow-sm backdrop-blur-md">
                       {selectedNews.category === 'article' ? 'Maqola' : selectedNews.category === 'announcement' ? "E'lon" : "Yangilik"}
                     </span>
                   </div>
                   <h3 className="text-xl md:text-3xl font-black text-white leading-tight drop-shadow-md break-words break-all">
                      {selectedNews.title[language as keyof typeof selectedNews.title] || selectedNews.title.uz}
                   </h3>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 md:p-8 !pt-6">
                <div className="flex items-center gap-2 mb-8 text-sm md:text-base font-bold text-zinc-500 dark:text-zinc-400">
                  <Calendar className="w-4 h-4 md:w-5 md:h-5" />
                  {new Date(selectedNews.createdAt).toLocaleDateString()}
                </div>
                <div className="prose prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 font-medium leading-relaxed whitespace-pre-wrap break-words break-all text-[15px] md:text-[17px]">
                  {selectedNews.content[language as keyof typeof selectedNews.content] || selectedNews.content.uz}
                </div>

                {/* Quizzes section */}
                {selectedNews.quiz && selectedNews.quiz.length > 0 && (
                   <div className="mt-12 pt-10 border-t border-black/5 dark:border-white/5 space-y-8">
                       <h4 className="text-2xl font-black text-zinc-900 dark:text-white">Maqola Testi</h4>
                       
                       {quizSubmitted ? (
                           <div className="bg-green-500/10 border border-green-500/20 p-6 md:p-8 rounded-[32px] text-center">
                               <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-green-500">
                                   <CheckCircle2 className="w-8 h-8" />
                               </div>
                               <h5 className="text-xl font-black text-green-600 dark:text-green-400 mb-2">Siz allaqachon bu testni muvaffaqiyatli topshirgansiz!</h5>
                               {showQuizResult && (
                                  <p className="text-zinc-600 dark:text-zinc-400 font-medium text-lg">
                                      Natijangiz: {showQuizResult.total} tadan {showQuizResult.correct} ta to'g'ri.<br />
                                      {showQuizResult.reward > 0 && <span className="text-yellow-600 dark:text-yellow-400 font-bold">+{showQuizResult.reward} H-Coin berildi!</span>}
                                  </p>
                               )}
                           </div>
                       ) : (
                           <div className="space-y-8">
                               {selectedNews.quiz.map((q: any, i: number) => (
                                   <div key={i} className="bg-zinc-50 dark:bg-white/5 p-6 md:p-8 rounded-[32px] border border-black/5 dark:border-white/5 space-y-6">
                                       <h5 className="text-lg font-bold text-zinc-900 dark:text-white">{i + 1}. {q.question[language as keyof any] || q.question.uz}</h5>
                                       <div className="space-y-3">
                                           {q.options.map((opt: any, optIndex: number) => (
                                               <label key={optIndex} className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border ${quizAnswers[i] === optIndex ? 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400' : 'bg-white dark:bg-black/20 border-transparent hover:border-black/5 dark:hover:border-white/10 text-zinc-700 dark:text-zinc-300'}`}>
                                                  <input 
                                                      type="radio" 
                                                      name={`quiz-${i}`} 
                                                      checked={quizAnswers[i] === optIndex}
                                                      onChange={() => setQuizAnswers({...quizAnswers, [i]: optIndex})}
                                                      className="w-5 h-5 accent-blue-500" 
                                                  />
                                                  <span className="font-medium text-[15px]">{opt[language as keyof any] || opt.uz}</span>
                                               </label>
                                           ))}
                                       </div>
                                   </div>
                               ))}
                               <button 
                                   onClick={handleQuizSubmit} 
                                   disabled={Object.keys(quizAnswers).length < selectedNews.quiz.length}
                                   className="w-full py-5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-2xl font-black text-lg shadow-[0_10px_40px_rgba(6,182,212,0.3)] hover:-translate-y-1 hover:shadow-[0_15px_50px_rgba(6,182,212,0.4)] transition-all disabled:opacity-50 disabled:hover:-translate-y-0 disabled:shadow-none"
                               >
                                   Testni Yakunlash
                               </button>
                           </div>
                       )}
                   </div>
                )}
              </div>
            </motion.div>
          </div>
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

              <button 
                onClick={() => setActiveReminder(null)}
                className="w-full py-5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-[24px] font-black uppercase tracking-widest transition-all shadow-[0_8px_24px_rgba(6,182,212,0.3)]"
              >
                Tushunarlik
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
              
              <h3 className="text-xl font-black text-center text-zinc-900 dark:text-white mb-2 uppercase">{selectedHistoryMed.med.customName || selectedHistoryMed.med.nameKey}</h3>
              
              <div className="bg-zinc-50 dark:bg-black/30 rounded-[20px] p-5 border border-zinc-200/50 dark:border-white/5 space-y-4 mb-6 relative">
                 <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-white dark:bg-[#12151C] rotate-45 border-l border-b border-zinc-200/50 dark:border-white/5"></div>
                 <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-zinc-500 uppercase tracking-widest">Sana</span>
                    <span className="text-[15px] font-black text-zinc-900 dark:text-white">
                      {new Date(selectedHistoryMed.timestamp).toLocaleString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                 </div>
                 <div className="w-full h-px bg-zinc-200 dark:bg-white/5"></div>
                 <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-zinc-500 uppercase tracking-widest">Vaqt</span>
                    <span className="text-[15px] font-black text-zinc-900 dark:text-white">
                      {new Date(selectedHistoryMed.timestamp).toLocaleString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                 </div>
              </div>
              
              <button 
                onClick={() => setSelectedHistoryMed(null)}
                className="w-full py-4 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-800 dark:text-white rounded-[20px] font-bold transition-all duration-300"
              >
                Yopish
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isCameraOpen && (
        <CameraCheck 
          onVerify={handleCameraVerify} 
          onClose={() => setIsCameraOpen(false)}
        />
      )}

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-[440px] h-[72px] glass-panel border border-white/60 dark:border-white/20 rounded-[32px] z-50 flex items-center justify-between px-2 shadow-[0_16px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_24px_64px_rgba(0,0,0,0.5)] backdrop-blur-3xl">
        {[
          { id: 'plan', icon: Calendar, label: t('dashboard') },
          { id: 'tasks', icon: MapIcon, label: t('tasks' as any) },
          { id: 'videos', icon: Video, label: t('videoLessons' as any) },
          { id: 'ai', icon: MessageSquare, label: 'AI' },
          { id: 'shop', icon: Trophy, label: t('shop' as any) },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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
              <Icon className="relative z-10 w-5 h-5" />
              <span className="relative z-10 text-[9px] sm:text-[10px] font-bold uppercase tracking-tight w-full text-center truncate">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  );
}

