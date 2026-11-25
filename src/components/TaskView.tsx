/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { CheckCircle2, Navigation, XCircle, Map as MapIcon, Gift as GiftIcon, Circle, ChevronRight, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, Circle as MapCircle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Gift } from '../types';
import { REWARD_LIMITS } from '../lib/shop';
import { localDateStr } from '../lib/adherence';

// Daily walk rules. Gifts appear one at a time 25–45 m away and are picked up
// automatically when the patient walks within COLLECT_RADIUS_M of them. GPS
// jitter while standing still is not counted as distance.
const TARGET_DISTANCE_M = 100;
const MAX_GIFTS_PER_DAY = REWARD_LIMITS.walkGiftsPerDay;
const COLLECT_RADIUS_M = 15;
const MAX_ACCURACY_M = 35;   // ignore fixes less precise than this
const MIN_STEP_M = 3;        // ignore movements smaller than GPS noise
const MAX_STEP_M = 80;       // ignore sudden "teleports" between fixes
const NO_FIX_TIMEOUT_MS = 25000;

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371e3;
  const φ1 = a[0] * Math.PI / 180;
  const φ2 = b[0] * Math.PI / 180;
  const Δφ = (b[0] - a[0]) * Math.PI / 180;
  const Δλ = (b[1] - a[1]) * Math.PI / 180;
  const h = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function bearing(a: [number, number], b: [number, number]): number {
  const φ1 = a[0] * Math.PI / 180;
  const φ2 = b[0] * Math.PI / 180;
  const Δλ = (b[1] - a[1]) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function randomPointNear(from: [number, number], minM: number, maxM: number): [number, number] {
  const dist = minM + Math.random() * (maxM - minM);
  const angle = Math.random() * 2 * Math.PI;
  const dLat = (dist * Math.cos(angle)) / 111320;
  const dLng = (dist * Math.sin(angle)) / (111320 * Math.cos(from[0] * Math.PI / 180));
  return [from[0] + dLat, from[1] + dLng];
}

// Today's walk progress survives switching tabs or reloading the page.
const progressKey = () => `bigus_walk_${localDateStr(new Date())}`;
function loadProgress(): { distance: number, started: boolean } {
  try {
    const v = JSON.parse(localStorage.getItem(progressKey()) || 'null');
    if (v && typeof v.distance === 'number') return { distance: Math.max(0, v.distance), started: !!v.started };
  } catch { /* ignore */ }
  return { distance: 0, started: false };
}
function saveProgress(distance: number, started: boolean) {
  try { localStorage.setItem(progressKey(), JSON.stringify({ distance, started })); } catch { /* ignore */ }
}

const MapFollower = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center[0], center[1], map]);
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 400);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

export type ChecklistItem = { key: string, label: string, value: string, done: boolean, onGo?: () => void };

type GeoError = 'denied' | 'unavailable' | 'unsupported' | null;

export default function TaskView({ t, rewardsToday, onGift, onComplete, checklist = [] }: {
  t: any,
  rewardsToday?: { walkGifts: number, walkDone: boolean },
  onGift: (amount: number) => Promise<number>,
  onComplete: () => Promise<number>,
  checklist?: ChecklistItem[],
}) {
  const walkDone = !!rewardsToday?.walkDone;
  const giftsCollected = rewardsToday?.walkGifts ?? 0;
  const giftsLeft = Math.max(0, MAX_GIFTS_PER_DAY - giftsCollected);

  const initial = useMemo(loadProgress, []);
  const [distanceTraveled, setDistanceTraveled] = useState(initial.distance);
  // Resume automatically if a walk was already started today and isn't finished.
  const [isTaskStarted, setIsTaskStarted] = useState(initial.started && 'geolocation' in navigator);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [heading, setHeading] = useState(0);
  const [gift, setGift] = useState<Gift | null>(null);
  const [geoError, setGeoError] = useState<GeoError>(null);
  const [attempt, setAttempt] = useState(0);
  const [toast, setToast] = useState<{ id: number, text: string, kind: 'ok' | 'info' | 'err' } | null>(null);
  const lastCountedPos = useRef<[number, number] | null>(null);
  const completing = useRef(false);
  const collecting = useRef(false);

  const showToast = useCallback((text: string, kind: 'ok' | 'info' | 'err' = 'ok') => {
    const id = Date.now();
    setToast({ id, text, kind });
    setTimeout(() => setToast(cur => (cur && cur.id === id ? null : cur)), 3500);
  }, []);

  useEffect(() => { saveProgress(distanceTraveled, isTaskStarted); }, [distanceTraveled, isTaskStarted]);

  const userIcon = useMemo(() => L.divIcon({
    className: 'custom-nav-icon',
    html: `<div style="transform: rotate(${heading}deg); transition: transform 0.3s ease-out; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 5L32 32L20 26L8 32L20 5Z" fill="#3b82f6" stroke="white" stroke-width="3" stroke-linejoin="round"/>
            </svg>
          </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  }), [heading]);

  const giftIcon = useMemo(() => L.divIcon({
    className: 'gift-div-icon',
    html: `<div style="background-color: #f59e0b; width: 36px; height: 36px; border-radius: 12px; border: 3px solid white; box-shadow: 0 0 25px rgba(245, 158, 11, 0.7); display: flex; align-items: center; justify-content: center; animation: bounce 2s infinite;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>
          </div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21]
  }), []);

  const startTask = () => {
    if (!('geolocation' in navigator)) { setGeoError('unsupported'); return; }
    setGeoError(null);
    lastCountedPos.current = null;
    setAttempt(a => a + 1);
    setIsTaskStarted(true);
  };

  const stopTask = () => {
    setIsTaskStarted(false);
    setUserPos(null);
    setGift(null);
    lastCountedPos.current = null;
  };

  // Watch position while the task runs.
  useEffect(() => {
    if (!isTaskStarted) return;
    let gotFix = false;
    const noFixTimer = setTimeout(() => { if (!gotFix) setGeoError('unavailable'); }, NO_FIX_TIMEOUT_MS);
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        gotFix = true;
        setGeoError(null);
        const p: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(p);
        setAccuracy(pos.coords.accuracy);
        if (pos.coords.heading !== null && !isNaN(pos.coords.heading)) setHeading(pos.coords.heading);

        if (pos.coords.accuracy > MAX_ACCURACY_M) return;
        const last = lastCountedPos.current;
        if (!last) { lastCountedPos.current = p; return; }
        const d = haversine(last, p);
        if (d < MIN_STEP_M) return;
        lastCountedPos.current = p;
        if (d > MAX_STEP_M) return;
        if (pos.coords.heading === null || isNaN(pos.coords.heading)) setHeading(bearing(last, p));
        setDistanceTraveled(prev => prev + d);
      },
      (err) => {
        console.warn('Geolocation error', err.code, err.message);
        if (err.code === 1) setGeoError('denied');
        else if (!gotFix) setGeoError('unavailable');
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }
    );
    return () => { clearTimeout(noFixTimer); navigator.geolocation.clearWatch(watchId); };
  }, [isTaskStarted, attempt]);

  // Walk completion — rewarded once per day by the server.
  useEffect(() => {
    if (walkDone || completing.current || distanceTraveled < TARGET_DISTANCE_M) return;
    completing.current = true;
    onComplete().then(granted => {
      if (granted > 0) showToast(t('walkCompleteReward').replace('{amount}', String(granted)));
    }).catch(() => { completing.current = false; showToast(t('errorOccurred'), 'err'); });
  }, [distanceTraveled, walkDone]);

  // Place the next gift (one at a time) 25–45 m away from the patient.
  const gpsWeak = accuracy !== null && accuracy > MAX_ACCURACY_M;
  useEffect(() => {
    if (!isTaskStarted || !userPos || giftsLeft === 0 || gift || gpsWeak) return;
    const timer = setTimeout(() => {
      setGift(cur => {
        if (cur) return cur;
        const [lat, lng] = randomPointNear(userPos, 25, 45);
        return { id: `gift-${Date.now()}`, lat, lng, collected: false, reward: 15 + Math.floor(Math.random() * 11) };
      });
    }, 2500);
    return () => clearTimeout(timer);
  }, [isTaskStarted, userPos !== null, giftsLeft, gift === null, gpsWeak]);

  const giftDistance = gift && userPos ? haversine(userPos, [gift.lat, gift.lng]) : null;
  const giftBearing = gift && userPos ? bearing(userPos, [gift.lat, gift.lng]) : 0;

  const collectGift = useCallback(() => {
    if (!gift || collecting.current) return;
    if (giftDistance === null || giftDistance > COLLECT_RADIUS_M) {
      if (giftDistance !== null) showToast(t('giftTooFar').replace('{distance}', String(Math.round(giftDistance - COLLECT_RADIUS_M))), 'info');
      return;
    }
    collecting.current = true;
    const g = gift;
    onGift(g.reward).then(granted => {
      setGift(null);
      showToast(granted > 0 ? `${t('giftFound')} +${granted} H-Coin` : t('noGiftsLeft'), granted > 0 ? 'ok' : 'info');
    }).catch(() => showToast(t('errorOccurred'), 'err'))
      .finally(() => { collecting.current = false; });
  }, [gift, giftDistance, onGift, showToast, t]);

  // Pick the gift up automatically once the patient is close enough.
  useEffect(() => {
    if (gift && giftDistance !== null && giftDistance <= COLLECT_RADIUS_M && !gpsWeak) collectGift();
  }, [giftDistance !== null && giftDistance <= COLLECT_RADIUS_M, gift?.id]);

  // Drop a gift the patient left far behind and offer a new one nearby.
  useEffect(() => {
    if (gift && giftDistance !== null && giftDistance > 120) setGift(null);
  }, [giftDistance !== null && giftDistance > 120]);

  const remaining = Math.max(0, Math.round(TARGET_DISTANCE_M - distanceTraveled));
  const pct = Math.min(100, Math.round((distanceTraveled / TARGET_DISTANCE_M) * 100));
  const allDone = walkDone && giftsLeft === 0;

  let statusText: string;
  if (gpsWeak) statusText = t('gpsWeak') + (accuracy ? ` (±${Math.round(accuracy)} m)` : '');
  else if (gift && giftDistance !== null) statusText = t('giftDistance').replace('{distance}', String(Math.max(0, Math.round(giftDistance))));
  else if (giftsLeft === 0 && walkDone) statusText = t('walkDoneToday');
  else if (giftsLeft > 0) statusText = t('giftSearching');
  else statusText = t('walkTaskDesc').replace('{distance}', String(TARGET_DISTANCE_M));

  const geoErrorText = geoError === 'denied' ? t('enableLocationPermission')
    : geoError === 'unsupported' ? t('locationUnsupported') : t('locationUnavailable');

  return (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="glass-panel rounded-[32px] p-5 md:p-6">
        <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">{t('dailyTasks')}</h3>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mb-4">{t('tasksDesc')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {checklist.map(item => (
            <button
              key={item.key}
              type="button"
              onClick={item.onGo}
              disabled={!item.onGo}
              className="flex items-center gap-3 p-3 rounded-2xl bg-white/60 dark:bg-white/5 border border-white/60 dark:border-white/10 text-left enabled:hover:bg-white dark:enabled:hover:bg-white/10 transition-colors"
            >
              {item.done
                ? <CheckCircle2 className="w-6 h-6 shrink-0 text-green-500" />
                : <Circle className="w-6 h-6 shrink-0 text-zinc-300 dark:text-zinc-600" />}
              <span className="flex-1 min-w-0">
                <span className={`block text-sm font-bold ${item.done ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-900 dark:text-white'}`}>{item.label}</span>
                <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">{item.value}</span>
              </span>
              {item.onGo && <ChevronRight className="w-4 h-4 shrink-0 text-zinc-400" />}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel rounded-[32px] p-5 md:p-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h4 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight">{t('walkTask')}</h4>
            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
              {walkDone ? t('walkDoneToday') : `${Math.min(TARGET_DISTANCE_M, Math.round(distanceTraveled))} / ${TARGET_DISTANCE_M} ${t('meters')}`}
            </p>
          </div>
          <div className="shrink-0 px-3 py-1.5 bg-yellow-500/10 rounded-xl border border-yellow-500/20 text-[11px] font-black text-yellow-700 dark:text-yellow-400 uppercase tracking-widest">
            <GiftIcon className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />{giftsCollected}/{MAX_GIFTS_PER_DAY}
          </div>
        </div>
        <div className="h-3 rounded-full bg-zinc-200 dark:bg-white/10 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${walkDone ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${walkDone ? 100 : pct}%` }} />
        </div>
      </div>

      <div className="rounded-[32px] md:rounded-[40px] overflow-hidden border-2 border-white/80 dark:border-white/10 shadow-2xl relative h-[460px] md:h-[520px] bg-zinc-100 dark:bg-zinc-950">
        {!isTaskStarted ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-zinc-900 dark:to-zinc-950 z-20">
             <div className="w-20 h-20 bg-blue-600/10 rounded-[28px] flex items-center justify-center mb-6 rotate-12">
               {allDone ? <CheckCircle2 className="w-10 h-10 text-green-600" strokeWidth={2.5} /> : <MapIcon className="w-10 h-10 text-blue-600" strokeWidth={2.5} />}
             </div>
             <h4 className="text-2xl font-black text-zinc-900 dark:text-white mb-3 uppercase tracking-tighter">{t('walkTask')}</h4>
             <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-8 max-w-sm mx-auto text-sm">
               {allDone ? t('walkDoneToday') : walkDone ? t('walkGiftsStillLeft') : t('walkTaskSubDesc')}
             </p>
             {geoError === 'unsupported' && <p className="text-red-600 text-sm font-bold mb-4">{geoErrorText}</p>}
             {!allDone && (
               <button
                 onClick={startTask}
                 className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-[22px] font-black text-base uppercase tracking-widest shadow-2xl shadow-blue-600/30 transition-all hover:scale-105 active:scale-95"
               >
                 {distanceTraveled > 0 ? t('continueWalk') : t('start')}
               </button>
             )}
          </div>
        ) : geoError ? (
          <div className="absolute inset-0 bg-red-50 dark:bg-red-900/20 flex flex-col items-center justify-center p-8 text-center z-20">
            <XCircle className="w-14 h-14 text-red-500 mb-5" />
            <h4 className="text-xl font-black text-zinc-900 dark:text-white mb-3 uppercase tracking-tighter">{t('locationNotDetected')}</h4>
            <p className="text-zinc-600 dark:text-zinc-300 font-medium mb-6 text-sm max-w-sm">{geoErrorText}</p>
            <div className="flex gap-3">
              <button onClick={startTask} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm flex items-center gap-2"><RotateCcw className="w-4 h-4" />{t('retry')}</button>
              <button onClick={stopTask} className="px-6 py-3 bg-zinc-900 dark:bg-white/10 text-white rounded-2xl font-black uppercase tracking-widest text-sm">{t('cancel')}</button>
            </div>
          </div>
        ) : !userPos ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center z-20 bg-zinc-50 dark:bg-zinc-900">
            <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center animate-pulse">
               <Navigation className="w-10 h-10 text-blue-500" />
            </div>
            <h4 className="text-xl font-black text-zinc-900 dark:text-white mt-8 uppercase tracking-widest">{t('loading')}...</h4>
            <p className="text-xs text-zinc-400 mt-2 font-bold uppercase tracking-widest">{t('gpsSignalSending')}</p>
          </div>
        ) : (
          <MapContainer center={userPos} zoom={18} style={{ height: '100%', width: '100%', zIndex: 1 }} zoomControl={false}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapFollower center={userPos} />
            {accuracy !== null && <MapCircle center={userPos} radius={accuracy} pathOptions={{ color: '#3b82f6', weight: 1, fillOpacity: 0.08 }} />}
            <Marker position={userPos} icon={userIcon} />
            {gift && (
              <>
                <MapCircle center={[gift.lat, gift.lng]} radius={COLLECT_RADIUS_M} pathOptions={{ color: '#f59e0b', weight: 1, dashArray: '4 4', fillOpacity: 0.08 }} />
                <Marker position={[gift.lat, gift.lng]} icon={giftIcon}>
                  <Popup minWidth={160}>
                    <div className="text-center p-2">
                      <p className="font-black text-zinc-900 uppercase text-xs mb-1 tracking-tighter">{t('giftNearby')}</p>
                      <p className="text-zinc-500 text-[11px] mb-3">{giftDistance !== null ? Math.round(giftDistance) : '?'} m</p>
                      <button
                        onClick={collectGift}
                        className="w-full py-2.5 bg-yellow-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-yellow-600"
                      >
                        {t('collectGift')}
                      </button>
                    </div>
                  </Popup>
                </Marker>
              </>
            )}
          </MapContainer>
        )}

        {isTaskStarted && userPos && !geoError && (
          <>
            <button
              onClick={stopTask}
              className="absolute top-3 right-3 z-[1000] px-4 py-2 bg-white/95 dark:bg-zinc-900/95 rounded-full text-xs font-black uppercase tracking-widest text-zinc-800 dark:text-white shadow-lg"
            >
              {t('finishWalk')}
            </button>
            <div className="absolute bottom-3 left-3 right-3 sm:bottom-5 sm:left-5 sm:right-auto sm:max-w-sm z-[1000]">
              <div className="p-3.5 bg-white/95 dark:bg-zinc-900/95 rounded-[24px] shadow-[0_12px_48px_rgba(0,0,0,0.2)] flex items-center gap-3">
                <div className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center text-white ${gift ? 'bg-yellow-500' : 'bg-blue-600'}`}>
                  {gift
                    ? <Navigation className="w-6 h-6 transition-transform" style={{ transform: `rotate(${giftBearing - 45}deg)` }} />
                    : <Navigation className="w-6 h-6" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.15em] mb-0.5">
                    {walkDone ? t('walkDoneShort') : `${t('distanceLeft')}: ${remaining} ${t('meters')}`}
                  </p>
                  <p className="text-sm font-black text-zinc-900 dark:text-white leading-tight">{statusText}</p>
                </div>
              </div>
            </div>
          </>
        )}

        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="absolute top-16 inset-x-0 z-[1100] flex justify-center px-4 pointer-events-none"
            >
              <div className={`px-5 py-3 rounded-2xl shadow-xl text-sm font-black text-white text-center ${toast.kind === 'ok' ? 'bg-green-600' : toast.kind === 'err' ? 'bg-red-600' : 'bg-zinc-800'}`}>
                {toast.text}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
