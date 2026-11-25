/**
 * Mini-games. Coins are granted through `onEarn`, which applies the daily
 * game limit and returns how many coins were actually given (0 once the
 * limit is reached). The server enforces the same limit.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type GameProps = {
  onBack: () => void;
  onEarn: (coins: number) => number;
  earnedToday: number;
  limit: number;
  t: any;
};

const bestKey = 'bigus_capsule_best';
const readBest = () => { try { return Number(localStorage.getItem(bestKey)) || 0; } catch { return 0; } };
const saveBest = (v: number) => { try { localStorage.setItem(bestKey, String(v)); } catch { /* private mode */ } };

const LimitBar = ({ earnedToday, limit, t, dark }: { earnedToday: number, limit: number, t: any, dark?: boolean }) => {
  const pct = Math.min(100, Math.round((earnedToday / limit) * 100));
  const done = earnedToday >= limit;
  return (
    <div className={`w-full rounded-2xl px-4 py-3 ${dark ? 'bg-white/10' : 'bg-white/70'} backdrop-blur`}>
      <div className={`flex justify-between text-[11px] font-black uppercase tracking-widest mb-2 ${dark ? 'text-white/80' : 'text-zinc-700'}`}>
        <span>{t('todayFromGames')}</span>
        <span>{earnedToday} / {limit}</span>
      </div>
      <div className={`h-2 rounded-full overflow-hidden ${dark ? 'bg-white/15' : 'bg-zinc-200'}`}>
        <div className={`h-full rounded-full transition-all ${done ? 'bg-amber-400' : 'bg-yellow-400'}`} style={{ width: `${pct}%` }} />
      </div>
      {done && <p className={`text-[11px] font-bold mt-2 ${dark ? 'text-amber-300' : 'text-amber-700'}`}>{t('gameLimitNoCoins')}</p>}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Flying capsule: tap to fly up, pass through the gaps. Physics are time-based
// (pixels per second), so the game runs at the same speed on 60 Hz and 120 Hz
// screens. Drawn on a canvas sized to the container, so it fits any phone.
// ---------------------------------------------------------------------------
const H = 460;            // play-field height (logical px)
const GROUND = 40;        // ground strip height
const GRAVITY = 1500;     // px/s²
const FLAP = -440;        // px/s
const PIPE_W = 58;
const GAP = 158;
const SPACING = 230;      // horizontal distance between pipes
const R = 15;             // capsule collision radius
const COINS_PER_PIPE = 2;

type Pipe = { x: number; top: number; passed: boolean };

export const FlyingCapsuleGame = ({ onBack, onEarn, earnedToday, limit, t }: GameProps) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready');
  const [score, setScore] = useState(0);
  const [earned, setEarned] = useState(0);
  const [best, setBest] = useState(readBest);
  const [newBest, setNewBest] = useState(false);

  const s = useRef({
    w: 340, birdX: 90, y: H / 2, vy: 0, pipes: [] as Pipe[], score: 0,
    phase: 'ready' as 'ready' | 'playing' | 'over', overAt: 0, time: 0,
  });
  const onEarnRef = useRef(onEarn);
  onEarnRef.current = onEarn;

  const randomTop = () => 60 + Math.random() * (H - GROUND - GAP - 120);

  const reset = () => {
    const st = s.current;
    st.y = H / 2; st.vy = 0; st.score = 0;
    st.pipes = [0, 1, 2].map(i => ({ x: st.w + 80 + i * SPACING, top: randomTop(), passed: false }));
    setScore(0); setEarned(0); setNewBest(false);
  };

  const flap = () => {
    const st = s.current;
    if (st.phase === 'over') {
      if (performance.now() - st.overAt < 700) return; // avoid instant restart by a late tap
      reset();
      st.phase = 'ready'; setPhase('ready');
      return;
    }
    if (st.phase === 'ready') { reset(); st.phase = 'playing'; setPhase('playing'); }
    st.vy = FLAP;
  };
  const flapRef = useRef(flap);
  flapRef.current = flap;

  // Bring the play field into view when the game opens (it can be below the fold).
  useEffect(() => {
    wrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // Keyboard: Space / ArrowUp
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); flapRef.current(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Size the canvas to its container (and to the screen's pixel density).
  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const resize = () => {
      const w = Math.max(260, Math.floor(wrap.clientWidth));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr; canvas.height = H * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${H}px`;
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
      const st = s.current;
      st.w = w; st.birdX = Math.round(Math.min(110, w * 0.26));
      if (st.phase !== 'playing') reset();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // Game loop
  useEffect(() => {
    let raf = 0, last = performance.now();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const endGame = () => {
      const st = s.current;
      st.phase = 'over'; st.overAt = performance.now();
      setPhase('over');
      if (st.score > readBest()) { saveBest(st.score); setBest(st.score); setNewBest(true); }
    };

    const step = (dt: number) => {
      const st = s.current;
      st.time += dt;
      if (st.phase === 'ready') { st.y = H / 2 + Math.sin(st.time * 3) * 8; return; }
      if (st.phase === 'over') {
        // let the capsule fall to the ground
        if (st.y < H - GROUND - R) { st.vy += GRAVITY * dt; st.y = Math.min(H - GROUND - R, st.y + st.vy * dt); }
        return;
      }
      const speed = Math.min(240, 165 + st.score * 3);
      st.vy = Math.min(st.vy + GRAVITY * dt, 700);
      st.y += st.vy * dt;
      for (const p of st.pipes) {
        p.x -= speed * dt;
        if (!p.passed && p.x + PIPE_W < st.birdX - R) {
          p.passed = true;
          st.score += 1;
          setScore(st.score);
          const g = onEarnRef.current(COINS_PER_PIPE);
          if (g > 0) setEarned(e => e + g);
        }
      }
      if (st.pipes[0].x + PIPE_W < -10) {
        const lastX = st.pipes[st.pipes.length - 1].x;
        st.pipes = [...st.pipes.slice(1), { x: lastX + SPACING, top: randomTop(), passed: false }];
      }
      // collisions: ceiling is soft (clamped), ground ends the game
      if (st.y < R) { st.y = R; st.vy = 0; }
      if (st.y > H - GROUND - R) { st.y = H - GROUND - R; endGame(); return; }
      for (const p of st.pipes) {
        const cx = Math.max(p.x, Math.min(st.birdX, p.x + PIPE_W));
        if (Math.abs(cx - st.birdX) >= R) continue;
        const hitTop = circleRect(st.birdX, st.y, R, p.x, -100, PIPE_W, p.top + 100);
        const hitBottom = circleRect(st.birdX, st.y, R, p.x, p.top + GAP, PIPE_W, H);
        if (hitTop || hitBottom) { endGame(); return; }
      }
    };

    const draw = () => {
      const st = s.current, w = st.w;
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#60a5fa'); sky.addColorStop(1, '#bfdbfe');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, H);
      // clouds (slow parallax)
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 4; i++) {
        const cx = ((i * 170 - st.time * 18) % (w + 160) + w + 160) % (w + 160) - 80;
        const cy = 50 + i * 37 % 120;
        ctx.beginPath(); ctx.ellipse(cx, cy, 38, 14, 0, 0, Math.PI * 2); ctx.ellipse(cx + 24, cy - 8, 24, 13, 0, 0, Math.PI * 2); ctx.fill();
      }
      // pipes
      for (const p of st.pipes) {
        ctx.fillStyle = '#22c55e'; ctx.strokeStyle = '#14532d'; ctx.lineWidth = 2;
        ctx.fillRect(p.x, 0, PIPE_W, p.top); ctx.strokeRect(p.x, -2, PIPE_W, p.top + 2);
        ctx.fillRect(p.x - 4, p.top - 18, PIPE_W + 8, 18); ctx.strokeRect(p.x - 4, p.top - 18, PIPE_W + 8, 18);
        const by = p.top + GAP;
        ctx.fillRect(p.x, by, PIPE_W, H - GROUND - by); ctx.strokeRect(p.x, by, PIPE_W, H - GROUND - by);
        ctx.fillRect(p.x - 4, by, PIPE_W + 8, 18); ctx.strokeRect(p.x - 4, by, PIPE_W + 8, 18);
      }
      // ground
      ctx.fillStyle = '#a3e635'; ctx.fillRect(0, H - GROUND, w, 8);
      ctx.fillStyle = '#d6b37a'; ctx.fillRect(0, H - GROUND + 8, w, GROUND - 8);
      // capsule (two-colour pill), tilted by vertical speed
      const angle = st.phase === 'ready' ? 0 : Math.max(-0.5, Math.min(1.2, st.vy / 600));
      ctx.save(); ctx.translate(st.birdX, st.y); ctx.rotate(angle);
      const L = 22, rr = 13;
      ctx.beginPath(); ctx.moveTo(0, -rr); ctx.lineTo(-L + rr, -rr); ctx.arc(-L + rr, 0, rr, -Math.PI / 2, Math.PI / 2, true); ctx.lineTo(0, rr); ctx.closePath();
      ctx.fillStyle = '#ef4444'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -rr); ctx.lineTo(L - rr, -rr); ctx.arc(L - rr, 0, rr, -Math.PI / 2, Math.PI / 2); ctx.lineTo(0, rr); ctx.closePath();
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-L + rr, -rr); ctx.lineTo(L - rr, -rr); ctx.arc(L - rr, 0, rr, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-L + rr, rr); ctx.arc(-L + rr, 0, rr, Math.PI / 2, -Math.PI / 2);
      ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(-L + rr - 2, -rr + 4, 14, 3);
      ctx.restore();
    };

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000); // clamp: no huge jumps after the tab was hidden
      last = now;
      step(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="flex-1 flex flex-col gap-3">
      <LimitBar earnedToday={earnedToday} limit={limit} t={t} />
      <div
        ref={wrapRef}
        className="relative w-full rounded-3xl overflow-hidden select-none touch-none cursor-pointer shadow-xl"
        style={{ height: H }}
        onPointerDown={(e) => { if ((e.target as HTMLElement).closest('button')) return; e.preventDefault(); flap(); }}
      >
        <canvas ref={canvasRef} className="block" />

        <button
          onClick={onBack}
          aria-label={t('back')}
          className="absolute top-3 left-3 z-20 p-2 bg-black/25 hover:bg-black/40 text-white rounded-full transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="absolute top-3 right-4 z-10 text-right text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.35)] pointer-events-none">
          <div className="text-3xl font-black leading-none">{score}</div>
          <div className="text-xs font-black text-yellow-300 mt-1">+{earned} H-Coin</div>
        </div>

        <AnimatePresence>
          {phase === 'ready' && (
            <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-x-0 bottom-16 z-10 flex flex-col items-center text-center pointer-events-none px-6">
              <h3 className="text-3xl font-black text-white drop-shadow mb-2">{t('flappyBird')}</h3>
              <p className="text-white font-bold text-sm uppercase tracking-widest drop-shadow">{t('tapToStart')}</p>
              <p className="text-white/90 text-xs font-semibold mt-2 drop-shadow">{t('capsuleHowTo')}</p>
              {best > 0 && <p className="text-yellow-200 text-xs font-black mt-3 uppercase tracking-widest drop-shadow">{t('bestScore')}: {best}</p>}
            </motion.div>
          )}
          {phase === 'over' && (
            <motion.div key="over" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex items-center justify-center p-6 bg-black/25">
              <div className="w-full max-w-[280px] bg-white/95 dark:bg-zinc-900/95 rounded-[28px] p-6 text-center shadow-2xl">
                <h3 className="text-2xl font-black text-zinc-900 dark:text-white mb-1">{t('gameOver')}</h3>
                <div className="text-5xl font-black text-blue-600 dark:text-blue-400 my-3">{score}</div>
                {newBest
                  ? <p className="text-xs font-black text-green-600 uppercase tracking-widest mb-2">{t('newBestScore')}</p>
                  : <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">{t('bestScore')}: {best}</p>}
                <p className="text-sm font-bold text-amber-600 mb-5">{t('earnedCoins')}: +{earned} H-Coin</p>
                <button
                  onClick={() => { s.current.overAt = 0; flap(); }}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest"
                >
                  {t('restart')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

function circleRect(cx: number, cy: number, r: number, x: number, y: number, w: number, h: number) {
  const nx = Math.max(x, Math.min(cx, x + w));
  const ny = Math.max(y, Math.min(cy, y + h));
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

// ---------------------------------------------------------------------------
// Coin tapper: 1 H-Coin per tap until the daily game limit.
// ---------------------------------------------------------------------------
export const CoinTapGame = ({ onBack, onEarn, earnedToday, limit, t }: GameProps) => {
  const areaRef = useRef<HTMLDivElement>(null);
  useEffect(() => { areaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, []);
  const [earned, setEarned] = useState(0);
  const [pressed, setPressed] = useState(false);
  const [effects, setEffects] = useState<{ id: number, x: number, y: number, text: string }[]>([]);
  const effectId = useRef(0);
  const limitReached = earnedToday >= limit;

  const tap = (e: React.PointerEvent) => {
    e.preventDefault();
    const granted = onEarn(1);
    const rect = areaRef.current?.getBoundingClientRect();
    const id = ++effectId.current;
    const x = rect ? e.clientX - rect.left : 0, y = rect ? e.clientY - rect.top : 0;
    setEffects(prev => [...prev.slice(-15), { id, x, y, text: granted > 0 ? `+${granted}` : '0' }]);
    setTimeout(() => setEffects(prev => prev.filter(f => f.id !== id)), 900);
    if (granted > 0) setEarned(v => v + granted);
    setPressed(true);
    setTimeout(() => setPressed(false), 90);
  };

  return (
    <div ref={areaRef} className="flex-1 flex flex-col items-center relative overflow-hidden bg-gradient-to-b from-zinc-900 to-indigo-950 rounded-3xl p-5 pt-16 sm:p-10 sm:pt-16 select-none min-h-[520px]">
      <button
        onClick={onBack}
        aria-label={t('back')}
        className="absolute top-4 left-4 z-20 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <div className="absolute top-5 right-5 z-20 text-yellow-400 font-black text-xl">+{earned} H-Coin</div>

      <div className="w-full max-w-sm mb-6"><LimitBar earnedToday={earnedToday} limit={limit} t={t} dark /></div>

      <div className="text-center mb-6">
        <h3 className="text-2xl sm:text-3xl font-black text-white mb-2 uppercase tracking-tighter">{t('hCoinClicker')}</h3>
        <p className="text-blue-200/60 font-medium tracking-widest text-xs uppercase">{limitReached ? t('dailyGameLimitReached') : t('clickToEarn')}</p>
      </div>

      <button
        onPointerDown={tap}
        aria-label={t('clickToEarn')}
        className="relative p-4 touch-manipulation outline-none"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <div className="absolute inset-0 bg-yellow-500/20 blur-[60px] rounded-full pointer-events-none" />
        <div
          className={`relative w-56 h-56 sm:w-72 sm:h-72 rounded-full flex items-center justify-center border-8 border-white/20 transition-transform duration-75 ${pressed ? 'scale-90' : 'scale-100'} ${limitReached ? 'bg-zinc-600 grayscale' : 'bg-gradient-to-br from-yellow-300 via-yellow-500 to-amber-600 shadow-[0_0_80px_rgba(234,179,8,0.4)]'}`}
        >
          <Trophy className="w-32 h-32 sm:w-44 sm:h-44 text-white drop-shadow-[0_10px_10px_rgba(0,0,0,0.3)]" fill="currentColor" strokeWidth={0} />
        </div>
      </button>

      {effects.map(f => (
        <motion.div
          key={f.id}
          initial={{ opacity: 1, y: 0, scale: 1 }}
          animate={{ opacity: 0, y: -110, scale: 1.4 }}
          transition={{ duration: 0.85, ease: 'easeOut' }}
          className="absolute pointer-events-none z-30 text-3xl font-black text-yellow-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]"
          style={{ left: f.x - 18, top: f.y - 40 }}
        >
          {f.text}
        </motion.div>
      ))}
    </div>
  );
};

