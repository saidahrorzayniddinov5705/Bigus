/**
 * Dose confirmation by camera: the patient shows an "OK" hand sign 👌 and a
 * hand-tracking model (MediaPipe Hand Landmarker) running in the browser
 * recognises it. Nothing is uploaded — video never leaves the phone.
 *
 * The old version loaded its model from tfhub.dev, which Google shut down, so
 * it always failed. The model and its runtime are now served by our own site
 * (public/mediapipe), so they don't depend on any outside service.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ScanFace, Loader2, X, RotateCcw, CameraOff, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import type { HandLandmarker as HandLandmarkerT } from '@mediapipe/tasks-vision';

interface CameraCheckProps {
  onVerify: (success: boolean) => void;
  onClose: () => void;
  reward?: number;
}

type Status = 'starting' | 'loading' | 'analyzing' | 'success' | 'failed';
type FailReason = 'denied' | 'nocamera' | 'insecure' | 'model' | 'other';

const BASE = (import.meta as any).env?.BASE_URL || '/';
const HOLD_FRAMES = 12;           // ~1 s of a steady OK sign
const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

// The model is ~8 MB; keep one instance for the whole session.
let landmarkerPromise: Promise<HandLandmarkerT> | null = null;
function getLandmarker(): Promise<HandLandmarkerT> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(`${BASE}mediapipe/wasm`);
      const make = (delegate: 'GPU' | 'CPU') => HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: `${BASE}mediapipe/hand_landmarker.task`, delegate },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      try { return await make('GPU'); } catch { return await make('CPU'); }
    })();
    landmarkerPromise.catch(() => { landmarkerPromise = null; }); // allow a retry
  }
  return landmarkerPromise;
}

type P = { x: number, y: number };
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);

// OK sign: thumb and index tips touch, the other three fingers are straight.
function isOkSign(lm: P[]): { ok: boolean, circle: boolean } {
  const palm = dist(lm[0], lm[9]); // wrist → middle-finger base
  if (palm < 1) return { ok: false, circle: false };
  const circle = dist(lm[4], lm[8]) < palm * 0.35;
  const straight = (tip: number, pip: number) => dist(lm[tip], lm[0]) > dist(lm[pip], lm[0]) * 1.12;
  const others = straight(12, 10) && straight(16, 14) && straight(20, 18);
  return { ok: circle && others, circle };
}

export default function CameraCheck({ onVerify, onClose, reward = 50 }: CameraCheckProps) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const holdRef = useRef(0);
  const doneRef = useRef(false);
  const onVerifyRef = useRef(onVerify);
  onVerifyRef.current = onVerify;

  const [status, setStatus] = useState<Status>('starting');
  const [reason, setReason] = useState<FailReason>('other');
  const [progress, setProgress] = useState(0);
  const [handSeen, setHandSeen] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setStatus('success');
    setTimeout(() => onVerifyRef.current(true), 1300);
  }, []);

  useEffect(() => {
    let cancelled = false;
    holdRef.current = 0;
    setProgress(0);
    setHandSeen(false);

    const fail = (r: FailReason) => { if (!cancelled) { setReason(r); setStatus('failed'); } };

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { fail('insecure'); return; }
      setStatus('starting');
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      } catch (e: any) {
        const n = e?.name || '';
        fail(n === 'NotAllowedError' || n === 'SecurityError' ? 'denied' : n === 'NotFoundError' || n === 'OverconstrainedError' ? 'nocamera' : 'other');
        return;
      }
      if (cancelled) { stream.getTracks().forEach(tr => tr.stop()); return; }
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      try { await video.play(); } catch { /* autoplay with muted+playsInline should work */ }

      setStatus('loading');
      let landmarker: HandLandmarkerT;
      try { landmarker = await getLandmarker(); } catch (e) { console.error('Hand model failed to load', e); fail('model'); return; }
      if (cancelled) return;
      setStatus('analyzing');

      let lastTime = -1;
      const loop = () => {
        if (cancelled || doneRef.current) return;
        if (video.readyState >= 2 && video.currentTime !== lastTime) {
          lastTime = video.currentTime;
          let res;
          try { res = landmarker.detectForVideo(video, performance.now()); } catch { res = null; }
          const w = video.videoWidth, h = video.videoHeight;
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (canvas && ctx && w && h) {
            if (canvas.width !== w) { canvas.width = w; canvas.height = h; }
            ctx.clearRect(0, 0, w, h);
          }
          const hand = res?.landmarks?.[0];
          if (hand) {
            const pts = hand.map(p => ({ x: p.x * w, y: p.y * h }));
            const { ok, circle } = isOkSign(pts);
            setHandSeen(true);
            if (ctx) {
              ctx.lineWidth = Math.max(2, w / 160);
              ctx.strokeStyle = ok ? 'rgba(52,211,153,0.95)' : 'rgba(255,255,255,0.75)';
              ctx.beginPath();
              for (const [a, b] of CONNECTIONS) { ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); }
              ctx.stroke();
              for (let i = 0; i < pts.length; i++) {
                ctx.fillStyle = (i === 4 || i === 8) ? (circle ? '#34d399' : '#f59e0b') : (ok ? '#34d399' : '#38bdf8');
                ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, Math.max(3, w / 110), 0, Math.PI * 2); ctx.fill();
              }
            }
            holdRef.current = ok ? holdRef.current + 1 : Math.max(0, holdRef.current - 1);
          } else {
            setHandSeen(false);
            holdRef.current = Math.max(0, holdRef.current - 1);
          }
          setProgress(Math.min(100, (holdRef.current / HOLD_FRAMES) * 100));
          if (holdRef.current >= HOLD_FRAMES) { finish(); return; }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(tr => tr.stop());
      streamRef.current = null;
    };
  }, [attempt, finish]);

  // Stop the camera as soon as we're done.
  useEffect(() => {
    if (status === 'success' || status === 'failed') {
      streamRef.current?.getTracks().forEach(tr => tr.stop());
    }
  }, [status]);

  const failText = reason === 'denied' ? t('cameraDenied')
    : reason === 'nocamera' ? t('cameraNotFound')
    : reason === 'insecure' ? t('cameraInsecure')
    : reason === 'model' ? t('cameraModelFailed')
    : t('cameraStartFailed');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[#1C1C1E] rounded-3xl overflow-hidden border border-white/10 relative shadow-2xl flex flex-col max-h-[94vh]" onClick={e => e.stopPropagation()}>
        <div className="p-4 flex justify-between items-center border-b border-white/10 shrink-0">
          <h3 className="text-white font-bold text-lg flex items-center gap-2"><ScanFace className="w-5 h-5 text-cyan-400" /> {t('cameraTaskTitle')}</h3>
          <button onClick={onClose} aria-label={t('close' as any) || 'X'} className="p-2 bg-white/10 rounded-full text-white/70 hover:text-white transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="relative w-full aspect-[3/4] max-h-[55vh] bg-black shrink-0 overflow-hidden">
          {/* mirrored like a selfie camera; the overlay is mirrored the same way */}
          <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover -scale-x-100" />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover -scale-x-100 pointer-events-none" />

          {(status === 'starting' || status === 'loading') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm text-center px-6">
              <Loader2 className="w-11 h-11 text-cyan-400 animate-spin mb-4" />
              <p className="text-cyan-300 font-semibold">{status === 'starting' ? t('cameraStarting') : t('cameraLoadingModel')}</p>
            </div>
          )}

          {status === 'analyzing' && (
            <>
              <div className="absolute top-3 inset-x-0 flex justify-center z-10">
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur px-4 py-2 rounded-full border border-white/10">
                  <span className={`w-2 h-2 rounded-full ${handSeen ? 'bg-emerald-400' : 'bg-red-500 animate-pulse'}`} />
                  <p className="text-white/90 font-semibold text-sm">{handSeen ? t('cameraHandFound') : t('cameraShowHand')}</p>
                </div>
              </div>
              {!handSeen && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-[96px] opacity-40 select-none">👌</span>
                </div>
              )}
              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-black/60 backdrop-blur rounded-2xl p-3.5 border border-white/10">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-white/80 uppercase tracking-widest">{t('cameraHoldOk')}</span>
                    <span className="text-xs font-mono font-bold text-cyan-400">{Math.round(progress)}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-100" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
            </>
          )}

          {status === 'failed' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6 text-center">
              <CameraOff className="w-12 h-12 text-amber-400 mb-4" />
              <p className="text-white font-semibold leading-relaxed mb-5">{failText}</p>
              {reason !== 'insecure' && (
                <button onClick={() => setAttempt(a => a + 1)} className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />{t('retry' as any)}
                </button>
              )}
            </div>
          )}

          {status === 'success' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-600/30 backdrop-blur-md">
              <CheckCircle2 className="w-16 h-16 text-emerald-300 mb-4" />
              <p className="text-white font-black text-xl">{t('cameraVerified')}</p>
              <p className="text-emerald-200 font-bold">{t('cameraCoins').replace('{amount}', String(reward))}</p>
            </div>
          )}
        </div>

        {status !== 'success' && (
          <div className="p-5 overflow-y-auto">
            <p className="text-white/45 text-xs text-center mb-5 flex items-center justify-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />{t('cameraPrivacy')}</p>
            <button
              onClick={finish}
              className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-white/85 font-bold rounded-2xl border border-white/10 active:scale-95 transition-all text-sm"
            >
              {t('cameraManualVerify')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
