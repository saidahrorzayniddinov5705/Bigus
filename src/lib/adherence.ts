// Single source of truth for all medication-schedule math (doses per day,
// "which course day is today", adherence %, streaks). This logic used to be
// copy-pasted 8+ times across Dashboard and AdminPanel, and the copies had
// drifted apart — e.g. the admin panel saved four-times-a-day courses as
// "fourDaily" while the patient side only recognised "fourTimesDaily", so a
// 4x/day prescription silently became 1x/day for the patient.

const DAY_MS = 24 * 60 * 60 * 1000;

export function pillsPerDay(med: any): number {
  switch (med?.frequencyKey) {
    case 'twiceDaily': return 2;
    case 'thriceDaily': return 3;
    case 'fourDaily':
    case 'fourTimesDaily': return 4;
    default: return 1;
  }
}

// "YYYY-MM-DD" must be read as a LOCAL calendar date. `new Date("2026-11-10")`
// is UTC midnight, which in Uzbekistan (UTC+5) is 05:00 — so every
// "is it today yet?" check used to flip at 5 AM instead of at midnight.
export function parseLocalDate(value: string | number | undefined | null): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

export function localDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Whole calendar days between two dates (DST-safe thanks to Math.round).
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

// Course day index (0-based) for `date`; may be negative or >= duration.
export function dayIndexFor(med: any, date: Date = new Date()): number {
  const start = parseLocalDate(med?.startDate);
  if (!start) return -1;
  return daysBetween(start, date);
}

export function courseDate(med: any, dayIndex: number): Date | null {
  const start = parseLocalDate(med?.startDate);
  if (!start) return null;
  const d = new Date(start);
  d.setDate(d.getDate() + dayIndex);
  return d;
}

export function takenOn(med: any, dayIndex: number): number {
  const v = med?.pillsTaken?.[dayIndex];
  if (typeof v === 'number') return v;
  return v ? pillsPerDay(med) : 0;
}

export function totalTaken(med: any): number {
  const days = Array.isArray(med?.pillsTaken) ? med.pillsTaken.length : 0;
  let sum = 0;
  for (let i = 0; i < days; i++) sum += takenOn(med, i);
  return sum;
}

// How many of today's doses are already "due": every scheduled time that has
// passed. Doses whose time hasn't come yet don't count against the patient.
function dueSoFarToday(med: any, now: Date): number {
  const ppd = pillsPerDay(med);
  const times: string[] = Array.isArray(med?.scheduledTimes) ? med.scheduledTimes : [];
  if (times.length === 0) return 0;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const passed = times.filter(t => {
    const [h, m] = String(t).split(':').map(Number);
    return !isNaN(h) && h * 60 + (m || 0) <= nowMin;
  }).length;
  return Math.min(ppd, passed);
}

const timeToMin = (t: string) => {
  const [h, m] = String(t).split(':').map(Number);
  return isNaN(h) ? NaN : h * 60 + (m || 0);
};

// Doses scheduled on the first day BEFORE the doctor created the course
// (e.g. prescribed at 13:00 -> that day's 08:00 dose) were never possible to
// take, so they must not count as missed.
export function skippedAtStart(med: any, dayIndex: number): number {
  if (dayIndex !== 0 || !med?.createdAt) return 0;
  const created = new Date(med.createdAt);
  const start = parseLocalDate(med.startDate);
  if (!start || isNaN(created.getTime()) || daysBetween(start, created) !== 0) return 0;
  const cMin = created.getHours() * 60 + created.getMinutes();
  const times: string[] = Array.isArray(med?.scheduledTimes) ? med.scheduledTimes : [];
  return Math.min(pillsPerDay(med), times.filter(t => timeToMin(t) < cMin).length);
}

// Doses that should have been taken on course day `i`, as of `now`.
export function expectedOnDay(med: any, i: number, now: Date = new Date()): number {
  const ppd = pillsPerDay(med);
  const todayIdx = dayIndexFor(med, now);
  if (i < 0 || i > todayIdx || i >= (Number(med?.durationDays) || 0)) return 0;
  const base = i < todayIdx ? ppd : dueSoFarToday(med, now);
  const tk = Math.min(ppd, takenOn(med, i));
  return Math.max(tk, Math.max(0, base - skippedAtStart(med, i)));
}

export interface AdherenceSummary {
  expected: number;
  taken: number;
  rate: number | null; // null = nothing was due yet, so no honest % exists
}

// Adherence over the whole course so far: past days count fully, today
// counts only the doses whose scheduled time has already passed (or that
// were already taken early).
export function computeAdherence(meds: any[], now: Date = new Date()): AdherenceSummary {
  let expected = 0;
  let taken = 0;
  meds.forEach(med => {
    const duration = Number(med?.durationDays) || 0;
    const today = dayIndexFor(med, now);
    if (today < 0) return;
    const ppd = pillsPerDay(med);
    const last = Math.min(today, duration - 1);
    for (let i = 0; i <= last; i++) {
      expected += expectedOnDay(med, i, now);
      taken += Math.min(ppd, takenOn(med, i));
    }
  });
  return { expected, taken, rate: expected === 0 ? null : Math.round((taken / expected) * 100) };
}

// Same, restricted to calendar dates in [from, to] (inclusive).
export function computeAdherenceInRange(meds: any[], from: Date, to: Date, now: Date = new Date()): AdherenceSummary {
  let expected = 0;
  let taken = 0;
  const todayStart = startOfDay(now);
  meds.forEach(med => {
    const duration = Number(med?.durationDays) || 0;
    const ppd = pillsPerDay(med);
    for (let i = 0; i < duration; i++) {
      const d = courseDate(med, i);
      if (!d || d < startOfDay(from) || d > startOfDay(to) || d > todayStart) continue;
      expected += expectedOnDay(med, i, now);
      taken += Math.min(ppd, takenOn(med, i));
    }
  });
  return { expected, taken, rate: expected === 0 ? null : Math.round((taken / expected) * 100) };
}

// Consecutive days with every dose taken, counting back from today (today
// only counts once it's fully done; an unfinished today doesn't break the
// streak). Days with nothing prescribed are skipped, not counted.
export function computeStreak(meds: any[], now: Date = new Date()): number {
  let streak = 0;
  for (let back = 0; back < 400; back++) {
    const day = new Date(now);
    day.setDate(day.getDate() - back);
    let exp = 0;
    let tk = 0;
    let anyStarted = false;
    meds.forEach(med => {
      const idx = dayIndexFor(med, day);
      if (idx >= 0) anyStarted = true;
      if (idx >= 0 && idx < (Number(med?.durationDays) || 0)) {
        exp += pillsPerDay(med) - skippedAtStart(med, idx);
        tk += Math.min(pillsPerDay(med), takenOn(med, idx));
      }
    });
    if (!anyStarted) break; // before every course began
    if (exp === 0) continue;
    if (tk >= exp) streak++;
    else if (back === 0) continue; // today still in progress
    else break;
  }
  return streak;
}

export interface TodaySummary {
  pending: number;
  activeCount: number;
  dosesPerDay: number;
}

export function todaySummary(meds: any[], now: Date = new Date()): TodaySummary {
  let pending = 0, activeCount = 0, dosesPerDay = 0;
  meds.forEach(med => {
    const idx = dayIndexFor(med, now);
    if (idx >= 0 && idx < (Number(med?.durationDays) || 0)) {
      const ppd = pillsPerDay(med);
      activeCount++;
      dosesPerDay += ppd;
      pending += Math.max(0, ppd - takenOn(med, idx));
    }
  });
  return { pending, activeCount, dosesPerDay };
}
