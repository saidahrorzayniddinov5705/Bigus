import './env.ts';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, newId, now, json, tx, patientToApi, medToApi, newsToApi, videoToApi, DB_PATH, isRehearsal } from './db.ts';
import {
  hashSecret, verifySecret, identityHash, createSession, destroySession, destroySessionsFor,
  requirePatient, requireStaff, requireAdmin, MAX_ATTEMPTS, LOCK_MINUTES, cleanupSessions, audit,
} from './auth.ts';
import { aiConfigured, chat, healthTip } from './ai.ts';
import { startTelegram, telegramConfigured, getBotUsername, linkCodeFor, notifyPatient } from './telegram.ts';
import { pillsPerDay, dayIndexFor, takenOn, computeAdherence, computeAdherenceInRange, computeStreak, todaySummary, localDateStr } from '../src/lib/adherence.ts';
import { SHOP_ITEMS, REWARD_LIMITS } from '../src/lib/shop.ts';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ---------- small helpers ----------
class HttpError extends Error { constructor(public status: number, public code: string) { super(code); } }
const bad = (code: string) => new HttpError(400, code);
const wrap = (fn: (req: express.Request, res: express.Response) => any) =>
  (req: express.Request, res: express.Response) => {
    Promise.resolve().then(() => fn(req, res)).then(
      (data) => { if (!res.headersSent) res.json(data ?? { ok: true }); },
      (e) => {
        if (e instanceof HttpError) return res.status(e.status).json({ error: e.code });
        console.error(e);
        res.status(500).json({ error: 'server-error' });
      });
  };

const str = (v: any, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v).getTime());
const isTime = (v: any) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const FREQS = ['onceDaily', 'twiceDaily', 'thriceDaily', 'fourDaily'];
const LANGS = ['uz', 'ru', 'en', 'uz-cyrl'];

function i18nObj(v: any, max: number) {
  const o: Record<string, string> = {};
  for (const l of LANGS) o[l] = str(v?.[l], max);
  return o;
}
const hasText = (o: any) => !!(o && (o.uz || o.ru || o.en || o['uz-cyrl']));

// A quiz question is kept only if it has text, >=2 filled options and a filled correct answer.
function cleanQuiz(quiz: any): any[] {
  if (!Array.isArray(quiz)) return [];
  return quiz.slice(0, 30).map((q: any) => ({
    question: i18nObj(q?.question, 500),
    options: (Array.isArray(q?.options) ? q.options : []).slice(0, 6).map((o: any) => i18nObj(o, 300)),
    correctOptionIndex: Number.isInteger(q?.correctOptionIndex) ? q.correctOptionIndex : 0,
  })).filter(q => hasText(q.question) && q.options.filter(hasText).length >= 2 && hasText(q.options[q.correctOptionIndex]));
}

function youtubeId(input: string): string | null {
  const m = String(input || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

const patientMeds = (patientId: string) =>
  (db.prepare('SELECT * FROM medications WHERE patient_id = ? ORDER BY created_at').all(patientId) as any[]).map(medToApi);

function addReward(patientId: string, kind: string, amount: number, cap: { amount?: number; count?: number }) {
  const day = localDateStr();
  const row = db.prepare('SELECT * FROM daily_rewards WHERE patient_id = ? AND day = ? AND kind = ?').get(patientId, day, kind) as any;
  const usedAmount = row?.amount || 0, usedCount = row?.count || 0;
  if (cap.count !== undefined && usedCount >= cap.count) return 0;
  const granted = cap.amount !== undefined ? Math.max(0, Math.min(amount, cap.amount - usedAmount)) : amount;
  if (granted <= 0) return 0;
  db.prepare(`INSERT INTO daily_rewards(patient_id, day, kind, amount, count) VALUES (?, ?, ?, ?, 1)
              ON CONFLICT(patient_id, day, kind) DO UPDATE SET amount = amount + excluded.amount, count = count + 1`)
    .run(patientId, day, kind, granted);
  db.prepare('UPDATE patients SET h_coins = h_coins + ?, xp = xp + ? WHERE id = ?').run(granted, Math.floor(granted / 5), patientId);
  return granted;
}

function rewardsToday(patientId: string) {
  const rows = db.prepare('SELECT kind, amount, count FROM daily_rewards WHERE patient_id = ? AND day = ?').all(patientId, localDateStr()) as any[];
  const get = (k: string) => rows.find(r => r.kind === k) || { amount: 0, count: 0 };
  return { games: get('game').amount, walkGifts: get('walk-gift').count, walkDone: get('walk-complete').count > 0 };
}

const getPatient = (id: string) => db.prepare('SELECT * FROM patients WHERE id = ?').get(id) as any;

// =====================================================================
// Public
// =====================================================================
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/news', wrap(() =>
  (db.prepare('SELECT * FROM news ORDER BY created_at DESC').all() as any[]).map(newsToApi)));

app.get('/api/videos', wrap(() =>
  (db.prepare('SELECT * FROM videos ORDER BY created_at DESC').all() as any[]).map(videoToApi)));

// =====================================================================
// Patient auth
// =====================================================================
app.post('/api/auth/patient', wrap((req) => {
  const lastName = str(req.body.lastName, 80), firstName = str(req.body.firstName, 80), fatherName = str(req.body.fatherName, 80);
  const birthDate = str(req.body.birthDate, 10), pin = str(req.body.pin, 6), telegramUsername = str(req.body.telegramUsername, 64).replace(/^@/, '');
  if (!lastName || !firstName || !fatherName || !isDate(birthDate)) throw bad('invalid-profile');
  if (!/^\d{6}$/.test(pin)) throw bad('invalid-pin');
  if (new Date(birthDate) > new Date()) throw bad('invalid-profile');

  const ih = identityHash(firstName, lastName, fatherName, birthDate);
  let p = db.prepare('SELECT * FROM patients WHERE identity_hash = ?').get(ih) as any;

  if (!p) {
    const id = newId();
    db.prepare(`INSERT INTO patients(id, last_name, first_name, father_name, birth_date, identity_hash, pin_hash, telegram_username, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, lastName, firstName, fatherName, birthDate, ih, hashSecret(pin), telegramUsername, now());
    p = getPatient(id);
  } else {
    if (p.locked_until > now()) throw new HttpError(429, 'locked');
    if (!p.pin_hash) {
      // Migrated from Firebase, or the doctor reset the PIN: the first login sets it.
      db.prepare('UPDATE patients SET pin_hash = ? WHERE id = ?').run(hashSecret(pin), p.id);
    } else if (!verifySecret(pin, p.pin_hash)) {
      const fails = p.failed_pin_count + 1;
      db.prepare('UPDATE patients SET failed_pin_count = ?, locked_until = ? WHERE id = ?')
        .run(fails >= MAX_ATTEMPTS ? 0 : fails, fails >= MAX_ATTEMPTS ? now() + LOCK_MINUTES * 60_000 : 0, p.id);
      throw new HttpError(401, fails >= MAX_ATTEMPTS ? 'locked' : 'wrong-pin');
    }
    db.prepare('UPDATE patients SET failed_pin_count = 0, locked_until = 0, telegram_username = CASE WHEN ? <> \'\' THEN ? ELSE telegram_username END WHERE id = ?')
      .run(telegramUsername, telegramUsername, p.id);
    p = getPatient(p.id);
  }
  return { token: createSession('patient', p.id), user: patientToApi(p) };
}));

app.post('/api/auth/logout', wrap((req) => {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) destroySession(h.slice(7));
  return { ok: true };
}));

// =====================================================================
// Patient
// =====================================================================
app.get('/api/me', requirePatient, wrap((req) => {
  const p = req.patient;
  return {
    user: patientToApi(p),
    meds: patientMeds(p.id),
    redemptions: db.prepare('SELECT id, item_id AS itemId, item_name_key AS itemNameKey, price, status, created_at AS createdAt FROM redemptions WHERE patient_id = ? ORDER BY created_at DESC').all(p.id),
    reports: db.prepare('SELECT id, medication_id AS medicationId, text, severity, status, doctor_reply AS doctorReply, created_at AS createdAt, reviewed_at AS reviewedAt FROM reports WHERE patient_id = ? ORDER BY created_at DESC LIMIT 50').all(p.id),
    rewardsToday: rewardsToday(p.id),
    features: { ai: aiConfigured, telegram: telegramConfigured && !!getBotUsername() },
  };
}));

app.patch('/api/me', requirePatient, wrap((req) => {
  const tg = str(req.body.telegramUsername, 64).replace(/^@/, '');
  db.prepare('UPDATE patients SET telegram_username = ? WHERE id = ?').run(tg, req.patient.id);
  return { user: patientToApi(getPatient(req.patient.id)) };
}));

app.post('/api/me/telegram-link', requirePatient, wrap((req) => {
  if (!telegramConfigured || !getBotUsername()) throw bad('telegram-off');
  return { url: `https://t.me/${getBotUsername()}?start=${linkCodeFor(req.patient.id)}` };
}));

app.post('/api/me/telegram-unlink', requirePatient, wrap((req) => {
  db.prepare('UPDATE patients SET telegram_chat_id = NULL WHERE id = ?').run(req.patient.id);
  return { user: patientToApi(getPatient(req.patient.id)) };
}));

// Marking a dose: the server checks it's TODAY's dose of an active course and
// awards the coins itself, so none of this can be faked from the browser.
app.post('/api/doses', requirePatient, wrap((req) => {
  const medId = str(req.body.medId, 64);
  return tx(() => {
    const row = db.prepare('SELECT * FROM medications WHERE id = ? AND patient_id = ?').get(medId, req.patient.id) as any;
    if (!row) throw new HttpError(404, 'not-found');
    if (row.status !== 'active') throw bad('course-stopped');
    const med = medToApi(row);
    let idx = dayIndexFor(med);
    const asked = Number(req.body.dayIndex);
    if (isRehearsal(req.patient.id) && Number.isInteger(asked)) idx = asked;
    if (idx < 0 || idx >= med.durationDays) throw bad('not-today');
    const ppd = pillsPerDay(med);
    const current = takenOn(med, idx);
    if (current >= ppd) throw bad('already-taken');
    const pills = [...med.pillsTaken];
    while (pills.length < med.durationDays) pills.push(0);
    pills[idx] = current + 1;
    const history = [...med.history, { dayIndex: idx, timestamp: now(), action: 'taken' }];
    db.prepare('UPDATE medications SET pills_taken = ?, history = ? WHERE id = ?').run(JSON.stringify(pills), JSON.stringify(history), medId);

    const reward = Math.round(50 / ppd);
    const streak = computeStreak(patientMeds(req.patient.id).filter(m => m.status !== 'stopped'));
    db.prepare('UPDATE patients SET h_coins = h_coins + ?, xp = xp + ?, streak = ? WHERE id = ?').run(reward, reward, streak, req.patient.id);
    return { reward, user: patientToApi(getPatient(req.patient.id)), meds: patientMeds(req.patient.id) };
  });
}));

app.post('/api/rewards/game', requirePatient, wrap((req) => {
  const amount = Math.min(50, Math.max(0, Math.floor(Number(req.body.amount) || 0)));
  const granted = tx(() => addReward(req.patient.id, 'game', amount, { amount: REWARD_LIMITS.gamesPerDay }));
  return { granted, rewardsToday: rewardsToday(req.patient.id), user: patientToApi(getPatient(req.patient.id)) };
}));

app.post('/api/rewards/walk-gift', requirePatient, wrap((req) => {
  const amount = Math.min(REWARD_LIMITS.walkGiftMax, Math.max(0, Math.floor(Number(req.body.amount) || 0)));
  const granted = tx(() => addReward(req.patient.id, 'walk-gift', amount, { count: REWARD_LIMITS.walkGiftsPerDay }));
  return { granted, rewardsToday: rewardsToday(req.patient.id), user: patientToApi(getPatient(req.patient.id)) };
}));

app.post('/api/rewards/walk-complete', requirePatient, wrap((req) => {
  const granted = tx(() => addReward(req.patient.id, 'walk-complete', REWARD_LIMITS.walkComplete, { count: 1 }));
  return { granted, rewardsToday: rewardsToday(req.patient.id), user: patientToApi(getPatient(req.patient.id)) };
}));

app.post('/api/news/:id/quiz', requirePatient, wrap((req) => {
  return tx(() => {
    const n = db.prepare('SELECT * FROM news WHERE id = ?').get(req.params.id) as any;
    if (!n) throw new HttpError(404, 'not-found');
    const p = getPatient(req.patient.id);
    const done: string[] = json(p.completed_quizzes, []);
    if (done.includes(n.id)) throw bad('already-done');
    const quiz = cleanQuiz(json(n.quiz, []));
    if (!quiz.length) throw bad('no-quiz');
    const answers: any[] = Array.isArray(req.body.answers) ? req.body.answers : [];
    const correct = quiz.filter((q, i) => answers[i] === q.correctOptionIndex).length;
    const reward = correct * REWARD_LIMITS.newsQuizPerCorrect;
    db.prepare('UPDATE patients SET completed_quizzes = ?, h_coins = h_coins + ?, xp = xp + ? WHERE id = ?')
      .run(JSON.stringify([...done, n.id]), reward, correct * 10, p.id);
    return { correct, total: quiz.length, reward, user: patientToApi(getPatient(p.id)) };
  });
}));

app.post('/api/videos/:id/quiz', requirePatient, wrap((req) => {
  return tx(() => {
    const v = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id) as any;
    if (!v) throw new HttpError(404, 'not-found');
    const p = getPatient(req.patient.id);
    const done: string[] = json(p.completed_videos, []);
    const quiz = cleanQuiz(json(v.quiz, []));
    if (!quiz.length) throw bad('no-quiz');
    const answers: any[] = Array.isArray(req.body.answers) ? req.body.answers : [];
    const passed = quiz.every((q, i) => answers[i] === q.correctOptionIndex);
    let reward = 0;
    if (passed && !done.includes(v.id)) {
      reward = REWARD_LIMITS.videoQuiz;
      db.prepare('UPDATE patients SET completed_videos = ?, h_coins = h_coins + ?, xp = xp + ? WHERE id = ?')
        .run(JSON.stringify([...done, v.id]), reward, Math.floor(reward / 5), p.id);
    }
    return { passed, reward, user: patientToApi(getPatient(p.id)) };
  });
}));

app.post('/api/shop/redeem', requirePatient, wrap((req) => {
  const item = SHOP_ITEMS.find(i => i.id === str(req.body.itemId, 20));
  if (!item) throw bad('unknown-item');
  return tx(() => {
    const p = getPatient(req.patient.id);
    if (p.h_coins < item.price) throw bad('not-enough-coins');
    db.prepare('UPDATE patients SET h_coins = h_coins - ? WHERE id = ?').run(item.price, p.id);
    db.prepare('INSERT INTO redemptions(id, patient_id, item_id, item_name_key, price, status, created_at) VALUES (?, ?, ?, ?, ?, \'pending\', ?)')
      .run(newId(), p.id, item.id, item.nameKey, item.price, now());
    return { user: patientToApi(getPatient(p.id)) };
  });
}));

// Patient tells the doctor about a side effect / problem (new feature).
app.post('/api/reports', requirePatient, wrap((req) => {
  const text = str(req.body.text, 2000);
  if (text.length < 3) throw bad('empty');
  const severity = ['mild', 'moderate', 'severe'].includes(req.body.severity) ? req.body.severity : 'mild';
  const medId = str(req.body.medicationId, 64);
  const med = medId ? db.prepare('SELECT id FROM medications WHERE id = ? AND patient_id = ?').get(medId, req.patient.id) : null;
  db.prepare('INSERT INTO reports(id, patient_id, medication_id, text, severity, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(newId(), req.patient.id, med ? medId : null, text, severity, now());
  return { ok: true };
}));

// ---- AI (key stays on the server) with a simple per-patient rate limit ----
const aiCalls = new Map<string, number[]>();
function aiRateLimit(id: string) {
  const t = now();
  const list = (aiCalls.get(id) || []).filter(x => t - x < 3600_000);
  if (list.length >= 40) throw new HttpError(429, 'rate-limited');
  list.push(t);
  aiCalls.set(id, list);
}
const medNamesOf = (id: string) => patientMeds(id).filter(m => m.status === 'active').map(m => m.customName);

app.post('/api/ai/chat', requirePatient, wrap(async (req) => {
  const message = str(req.body.message, 4000);
  if (!message) throw bad('empty');
  if (!aiConfigured) return { ok: false, reason: 'not-configured' };
  aiRateLimit(req.patient.id);
  const history = (Array.isArray(req.body.history) ? req.body.history : [])
    .filter((h: any) => h && (h.role === 'user' || h.role === 'model') && typeof h.text === 'string');
  return chat(history, message, LANGS.includes(req.body.language) ? req.body.language : 'uz', medNamesOf(req.patient.id));
}));

app.post('/api/ai/tip', requirePatient, wrap(async (req) => {
  if (!aiConfigured) return { tip: null };
  aiRateLimit(req.patient.id);
  return { tip: await healthTip(medNamesOf(req.patient.id), LANGS.includes(req.body.language) ? req.body.language : 'uz') };
}));

// =====================================================================
// Staff (doctor / admin)
// =====================================================================
const staffToApi = (s: any) => ({ id: s.id, email: s.email, name: s.name, role: s.role, createdAt: s.created_at });

app.post('/api/auth/staff', wrap((req) => {
  const email = str(req.body.email, 200).toLowerCase(), password = typeof req.body.password === 'string' ? req.body.password : '';
  const s = db.prepare('SELECT * FROM staff WHERE email = ?').get(email) as any;
  if (!s) { hashSecret('timing-equaliser'); throw new HttpError(401, 'wrong-credentials'); }
  if (s.locked_until > now()) throw new HttpError(429, 'locked');
  if (!verifySecret(password, s.password_hash)) {
    const fails = s.failed_count + 1;
    db.prepare('UPDATE staff SET failed_count = ?, locked_until = ? WHERE id = ?')
      .run(fails >= MAX_ATTEMPTS ? 0 : fails, fails >= MAX_ATTEMPTS ? now() + LOCK_MINUTES * 60_000 : 0, s.id);
    throw new HttpError(401, fails >= MAX_ATTEMPTS ? 'locked' : 'wrong-credentials');
  }
  db.prepare('UPDATE staff SET failed_count = 0, locked_until = 0 WHERE id = ?').run(s.id);
  audit(s, 'login');
  return { token: createSession('staff', s.id), staff: staffToApi(s) };
}));

const A = express.Router();
A.use(requireStaff);

A.get('/me', wrap((req) => ({ staff: staffToApi(req.staff) })));

A.post('/password', wrap((req) => {
  const cur = String(req.body.currentPassword || ''), next = String(req.body.newPassword || '');
  if (!verifySecret(cur, req.staff.password_hash)) throw new HttpError(401, 'wrong-credentials');
  if (next.length < 8) throw bad('weak-password');
  db.prepare('UPDATE staff SET password_hash = ? WHERE id = ?').run(hashSecret(next), req.staff.id);
  audit(req.staff, 'password-changed');
  return { ok: true };
}));

function patientSummary(p: any) {
  const meds = patientMeds(p.id);
  const active = meds.filter(m => m.status === 'active');
  const adh = computeAdherence(active.length ? active : meds);
  const today = todaySummary(active);
  const newReports = (db.prepare('SELECT COUNT(*) c FROM reports WHERE patient_id = ? AND status = \'new\'').get(p.id) as any).c;
  const pendingRedemptions = (db.prepare('SELECT COUNT(*) c FROM redemptions WHERE patient_id = ? AND status = \'pending\'').get(p.id) as any).c;
  return {
    ...patientToApi(p, { includePrivate: true }),
    telegramLinked: !!p.telegram_chat_id,
    adherenceRate: adh.rate,
    activeMeds: today.activeCount,
    medsTotal: meds.length,
    todayPending: today.pending,
    newReports, pendingRedemptions,
  };
}

A.get('/patients', wrap(() =>
  (db.prepare('SELECT * FROM patients ORDER BY created_at DESC').all() as any[]).map(patientSummary)));

A.get('/overview', wrap(() => {
  const patients = (db.prepare('SELECT * FROM patients').all() as any[]).map(patientSummary);
  const withData = patients.filter(p => p.adherenceRate !== null);
  return {
    totalPatients: patients.length,
    activeTreatments: patients.filter(p => p.activeMeds > 0).length,
    avgAdherence: withData.length ? Math.round(withData.reduce((s, p) => s + (p.adherenceRate || 0), 0) / withData.length) : null,
    telegramLinked: patients.filter(p => p.telegramLinked).length,
    newReports: (db.prepare('SELECT COUNT(*) c FROM reports WHERE status = \'new\'').get() as any).c,
    pendingRedemptions: (db.prepare('SELECT COUNT(*) c FROM redemptions WHERE status = \'pending\'').get() as any).c,
    totalNews: (db.prepare('SELECT COUNT(*) c FROM news').get() as any).c,
    totalVideos: (db.prepare('SELECT COUNT(*) c FROM videos').get() as any).c,
    atRisk: withData.filter(p => p.activeMeds > 0 && (p.adherenceRate as number) < 70)
      .sort((a, b) => (a.adherenceRate as number) - (b.adherenceRate as number)).slice(0, 10),
    recentReports: db.prepare(`SELECT r.id, r.text, r.severity, r.created_at AS createdAt, r.patient_id AS patientId,
        p.last_name || ' ' || p.first_name AS patientName FROM reports r JOIN patients p ON p.id = r.patient_id
        WHERE r.status = 'new' ORDER BY CASE r.severity WHEN 'severe' THEN 0 WHEN 'moderate' THEN 1 ELSE 2 END, r.created_at DESC LIMIT 10`).all(),
    recentPatients: patients.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5),
    trend: adherenceTrend(14),
  };
}));

// Clinic-wide adherence for each of the last `days` days (doses taken /
// doses due across all active courses). Days with nothing due are null.
function adherenceTrend(days: number) {
  const meds = (db.prepare("SELECT * FROM medications WHERE status != 'stopped'").all() as any[]).map(medToApi);
  const out: { date: string, rate: number | null, expected: number, taken: number }[] = [];
  for (let back = days - 1; back >= 0; back--) {
    const d = new Date(); d.setDate(d.getDate() - back);
    const r = computeAdherenceInRange(meds, d, d);
    out.push({ date: localDateStr(d), rate: r.rate, expected: r.expected, taken: r.taken });
  }
  return out;
}

A.get('/patients/:id', wrap((req) => {
  const p = getPatient(req.params.id);
  if (!p) throw new HttpError(404, 'not-found');
  return {
    patient: patientSummary(p),
    meds: patientMeds(p.id),
    redemptions: db.prepare('SELECT id, item_id AS itemId, item_name_key AS itemNameKey, price, status, created_at AS createdAt, fulfilled_at AS fulfilledAt FROM redemptions WHERE patient_id = ? ORDER BY created_at DESC').all(p.id),
    reports: db.prepare('SELECT id, medication_id AS medicationId, text, severity, status, doctor_reply AS doctorReply, created_at AS createdAt, reviewed_at AS reviewedAt FROM reports WHERE patient_id = ? ORDER BY created_at DESC').all(p.id),
  };
}));

A.patch('/patients/:id', wrap((req) => {
  const p = getPatient(req.params.id);
  if (!p) throw new HttpError(404, 'not-found');
  db.prepare('UPDATE patients SET doctor_note = ? WHERE id = ?').run(str(req.body.doctorNote, 3000), p.id);
  audit(req.staff, 'patient-note', p.id);
  return { ok: true };
}));

A.post('/patients/:id/reset-pin', wrap((req) => {
  const p = getPatient(req.params.id);
  if (!p) throw new HttpError(404, 'not-found');
  db.prepare('UPDATE patients SET pin_hash = NULL, failed_pin_count = 0, locked_until = 0 WHERE id = ?').run(p.id);
  destroySessionsFor('patient', p.id);
  audit(req.staff, 'reset-pin', `${p.last_name} ${p.first_name}`);
  return { ok: true };
}));

A.delete('/patients/:id', wrap((req) => {
  const p = getPatient(req.params.id);
  if (!p) throw new HttpError(404, 'not-found');
  tx(() => {
    destroySessionsFor('patient', p.id);
    db.prepare('DELETE FROM patients WHERE id = ?').run(p.id); // meds/redemptions/reports cascade
  });
  audit(req.staff, 'delete-patient', `${p.last_name} ${p.first_name} ${p.father_name}`);
  return { ok: true };
}));

function readMedInput(body: any, partial = false) {
  const out: any = {};
  if (!partial || body.name !== undefined) { out.name = str(body.name, 120); if (!out.name) throw bad('name-required'); }
  if (!partial || body.dosage !== undefined) out.dosage = str(body.dosage, 80);
  if (!partial || body.frequencyKey !== undefined) {
    out.frequencyKey = body.frequencyKey === 'fourTimesDaily' ? 'fourDaily' : body.frequencyKey;
    if (!FREQS.includes(out.frequencyKey)) throw bad('bad-frequency');
  }
  if (!partial || body.durationDays !== undefined) {
    out.durationDays = Math.floor(Number(body.durationDays));
    if (!(out.durationDays >= 1 && out.durationDays <= 365)) throw bad('bad-duration');
  }
  if (!partial || body.scheduledTimes !== undefined) {
    const times = Array.isArray(body.scheduledTimes) ? body.scheduledTimes.filter(isTime) : [];
    out.scheduledTimes = [...new Set(times as string[])].sort();
  }
  if (!partial || body.instructions !== undefined) out.instructions = str(body.instructions, 500);
  if (body.startDate !== undefined) { out.startDate = str(body.startDate, 10); if (!isDate(out.startDate)) throw bad('bad-date'); }
  if (body.totalPills !== undefined) out.totalPills = Math.max(1, Math.floor(Number(body.totalPills) || 0));
  return out;
}

A.post('/patients/:id/medications', wrap((req) => {
  const p = getPatient(req.params.id);
  if (!p) throw new HttpError(404, 'not-found');
  const m = readMedInput(req.body);
  const ppd = pillsPerDay({ frequencyKey: m.frequencyKey });
  if (m.scheduledTimes.length !== ppd) throw bad('times-mismatch');
  const id = newId();
  db.prepare(`INSERT INTO medications(id, patient_id, name, dosage, frequency_key, duration_days, start_date, pills_taken, total_pills, scheduled_times, instructions, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, p.id, m.name, m.dosage, m.frequencyKey, m.durationDays, m.startDate || localDateStr(),
      JSON.stringify(new Array(m.durationDays).fill(0)), m.totalPills || m.durationDays * ppd, JSON.stringify(m.scheduledTimes), m.instructions, now());
  audit(req.staff, 'assign-med', `${p.last_name} ${p.first_name}: ${m.name}`);
  notifyPatient(p.id, `💊 <b>Yangi dori tayinlandi</b>: ${m.name}${m.dosage ? ` (${m.dosage})` : ''}\n🕒 ${m.scheduledTimes.join(', ')} — ${m.durationDays} kun`);
  return { med: medToApi(db.prepare('SELECT * FROM medications WHERE id = ?').get(id)) };
}));

A.patch('/medications/:id', wrap((req) => {
  const row = db.prepare('SELECT * FROM medications WHERE id = ?').get(req.params.id) as any;
  if (!row) throw new HttpError(404, 'not-found');
  const m = readMedInput(req.body, true);
  const freq = m.frequencyKey ?? row.frequency_key;
  const times = m.scheduledTimes ?? json(row.scheduled_times, []);
  if (times.length !== pillsPerDay({ frequencyKey: freq })) throw bad('times-mismatch');
  const duration = m.durationDays ?? row.duration_days;
  const pills: number[] = json(row.pills_taken, []);
  const resized = pills.slice(0, duration).map(v => Math.min(Number(v) || 0, pillsPerDay({ frequencyKey: freq })));
  while (resized.length < duration) resized.push(0);
  const status = req.body.status === 'stopped' || req.body.status === 'active' ? req.body.status : row.status;
  db.prepare(`UPDATE medications SET name = ?, dosage = ?, frequency_key = ?, duration_days = ?, pills_taken = ?, total_pills = ?,
              scheduled_times = ?, instructions = ?, status = ? WHERE id = ?`)
    .run(m.name ?? row.name, m.dosage ?? row.dosage, freq, duration, JSON.stringify(resized),
      m.totalPills ?? (m.durationDays || m.frequencyKey ? duration * pillsPerDay({ frequencyKey: freq }) : row.total_pills),
      JSON.stringify(times), m.instructions ?? row.instructions, status, row.id);
  audit(req.staff, 'edit-med', `${row.name} (${row.id})`);
  return { med: medToApi(db.prepare('SELECT * FROM medications WHERE id = ?').get(row.id)) };
}));

A.delete('/medications/:id', wrap((req) => {
  const row = db.prepare('SELECT * FROM medications WHERE id = ?').get(req.params.id) as any;
  if (!row) throw new HttpError(404, 'not-found');
  db.prepare('DELETE FROM medications WHERE id = ?').run(row.id);
  audit(req.staff, 'delete-med', row.name);
  return { ok: true };
}));

A.post('/redemptions/:id/fulfill', wrap((req) => {
  const r = db.prepare('SELECT * FROM redemptions WHERE id = ?').get(req.params.id) as any;
  if (!r) throw new HttpError(404, 'not-found');
  if (r.status !== 'pending') throw bad('not-pending');
  db.prepare('UPDATE redemptions SET status = \'fulfilled\', fulfilled_at = ? WHERE id = ?').run(now(), r.id);
  const fp = getPatient(r.patient_id);
  audit(req.staff, 'fulfill-redemption', `${fp ? `${fp.last_name} ${fp.first_name}: ` : ''}${r.item_name_key}`);
  return { ok: true };
}));

A.post('/redemptions/:id/cancel', wrap((req) => {
  const r = db.prepare('SELECT * FROM redemptions WHERE id = ?').get(req.params.id) as any;
  if (!r) throw new HttpError(404, 'not-found');
  if (r.status !== 'pending') throw bad('not-pending');
  tx(() => {
    db.prepare('UPDATE redemptions SET status = \'cancelled\', fulfilled_at = ? WHERE id = ?').run(now(), r.id);
    db.prepare('UPDATE patients SET h_coins = h_coins + ? WHERE id = ?').run(r.price, r.patient_id); // refund
  });
  audit(req.staff, 'cancel-redemption', r.id);
  return { ok: true };
}));

A.get('/reports', wrap((req) => {
  const status = req.query.status === 'reviewed' ? 'reviewed' : req.query.status === 'all' ? null : 'new';
  return db.prepare(`SELECT r.id, r.patient_id AS patientId, r.medication_id AS medicationId, r.text, r.severity, r.status,
      r.doctor_reply AS doctorReply, r.created_at AS createdAt, r.reviewed_at AS reviewedAt,
      p.last_name || ' ' || p.first_name || ' ' || p.father_name AS patientName, m.name AS medicationName
    FROM reports r JOIN patients p ON p.id = r.patient_id LEFT JOIN medications m ON m.id = r.medication_id
    ${status ? 'WHERE r.status = ?' : ''}
    ORDER BY CASE r.severity WHEN 'severe' THEN 0 WHEN 'moderate' THEN 1 ELSE 2 END, r.created_at DESC LIMIT 300`)
    .all(...(status ? [status] : []));
}));

A.get('/redemptions', wrap((req) => {
  const status = req.query.status === 'all' ? null : 'pending';
  return db.prepare(`SELECT r.id, r.patient_id AS patientId, r.item_name_key AS itemNameKey, r.price, r.status,
      r.created_at AS createdAt, r.fulfilled_at AS fulfilledAt,
      p.last_name || ' ' || p.first_name || ' ' || p.father_name AS patientName, p.telegram_username AS telegramUsername
    FROM redemptions r JOIN patients p ON p.id = r.patient_id
    ${status ? 'WHERE r.status = ?' : ''} ORDER BY r.created_at DESC LIMIT 300`).all(...(status ? [status] : []));
}));

A.post('/reports/:id/review', wrap((req) => {
  const r = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id) as any;
  if (!r) throw new HttpError(404, 'not-found');
  const reply = str(req.body.reply, 2000);
  db.prepare('UPDATE reports SET status = \'reviewed\', doctor_reply = ?, reviewed_at = ? WHERE id = ?').run(reply, now(), r.id);
  const rp = getPatient(r.patient_id);
  audit(req.staff, 'review-report', rp ? `${rp.last_name} ${rp.first_name}${reply ? ' (javob yozildi)' : ''}` : r.id);
  if (reply) notifyPatient(r.patient_id, `👨‍⚕️ <b>Shifokor javobi</b>:\n${reply.replace(/</g, '&lt;')}`);
  return { ok: true };
}));

// ---- news / videos ----
function readNews(body: any) {
  const title = i18nObj(body.title, 300), content = i18nObj(body.content, 20000);
  if (!title.uz || !content.uz) throw bad('uz-required');
  for (const l of LANGS) { title[l] ||= title.uz; content[l] ||= content.uz; }
  const imageUrl = str(body.imageUrl, 1000);
  if (imageUrl && !/^https:\/\//i.test(imageUrl)) throw bad('bad-image-url');
  const category = ['general', 'article', 'announcement'].includes(body.category) ? body.category : 'general';
  return { title, content, imageUrl, category, quiz: cleanQuiz(body.quiz) };
}
A.post('/news', wrap((req) => {
  const n = readNews(req.body); const id = newId();
  db.prepare('INSERT INTO news(id, title, content, image_url, category, quiz, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, JSON.stringify(n.title), JSON.stringify(n.content), n.imageUrl, n.category, JSON.stringify(n.quiz), now(), now());
  audit(req.staff, 'add-news', n.title.uz);
  return { news: newsToApi(db.prepare('SELECT * FROM news WHERE id = ?').get(id)) };
}));
A.put('/news/:id', wrap((req) => {
  const n = readNews(req.body);
  const r = db.prepare('UPDATE news SET title = ?, content = ?, image_url = ?, category = ?, quiz = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(n.title), JSON.stringify(n.content), n.imageUrl, n.category, JSON.stringify(n.quiz), now(), req.params.id);
  if (!r.changes) throw new HttpError(404, 'not-found');
  audit(req.staff, 'edit-news', n.title.uz);
  return { ok: true };
}));
A.delete('/news/:id', wrap((req) => { db.prepare('DELETE FROM news WHERE id = ?').run(req.params.id); audit(req.staff, 'delete-news', req.params.id); return { ok: true }; }));

function readVideo(body: any) {
  const title = i18nObj(body.title, 300), description = i18nObj(body.description, 3000);
  if (!title.uz) throw bad('uz-required');
  for (const l of LANGS) { title[l] ||= title.uz; description[l] ||= description.uz; }
  const videoUrl = str(body.videoUrl, 500);
  const videoId = youtubeId(videoUrl);
  if (!videoId) throw bad('bad-video-url');
  return { title, description, videoUrl, videoId, quiz: cleanQuiz(body.quiz) };
}
A.post('/videos', wrap((req) => {
  const v = readVideo(req.body); const id = newId();
  db.prepare('INSERT INTO videos(id, title, description, video_url, video_id, quiz, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, JSON.stringify(v.title), JSON.stringify(v.description), v.videoUrl, v.videoId, JSON.stringify(v.quiz), now(), now());
  audit(req.staff, 'add-video', v.title.uz);
  return { ok: true };
}));
A.put('/videos/:id', wrap((req) => {
  const v = readVideo(req.body);
  const r = db.prepare('UPDATE videos SET title = ?, description = ?, video_url = ?, video_id = ?, quiz = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(v.title), JSON.stringify(v.description), v.videoUrl, v.videoId, JSON.stringify(v.quiz), now(), req.params.id);
  if (!r.changes) throw new HttpError(404, 'not-found');
  audit(req.staff, 'edit-video', v.title.uz);
  return { ok: true };
}));
A.delete('/videos/:id', wrap((req) => { db.prepare('DELETE FROM videos WHERE id = ?').run(req.params.id); audit(req.staff, 'delete-video', req.params.id); return { ok: true }; }));

// ---- export (Excel-friendly CSV) ----
A.get('/export/patients.csv', (req, res) => {
  const rows = (db.prepare('SELECT * FROM patients ORDER BY last_name').all() as any[]).map(patientSummary);
  const cell = (v: any) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // stop Excel formula injection
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = ['Familiya', 'Ism', 'Otasining ismi', "Tug'ilgan sana", 'Telegram', 'Telegram ulangan', 'Faol dorilar', 'Aniqlik %', 'Bugun qolgan doza', 'Seriya (kun)', 'H-Coin', "Ro'yxatdan o'tgan", 'Oxirgi faollik'];
  const lines = rows.map(p => [p.lastName, p.firstName, p.fatherName, p.birthDate, p.telegramUsername ? '@' + p.telegramUsername : '',
    p.telegramLinked ? 'ha' : "yo'q", p.activeMeds, p.adherenceRate ?? '', p.todayPending, p.streak, p.hCoins,
    new Date(p.createdAt).toLocaleDateString('uz-UZ'), p.lastSeenAt ? new Date(p.lastSeenAt).toLocaleString('uz-UZ') : ''].map(cell).join(';'));
  audit(req.staff, 'export-patients');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="bigus-bemorlar-${localDateStr()}.csv"`);
  res.send('﻿' + [header.map(cell).join(';'), ...lines].join('\r\n'));
});

// ---- staff accounts (admin only) ----
A.get('/staff', requireAdmin, wrap(() => (db.prepare('SELECT * FROM staff ORDER BY created_at').all() as any[]).map(staffToApi)));
A.post('/staff', requireAdmin, wrap((req) => {
  const email = str(req.body.email, 200).toLowerCase(), name = str(req.body.name, 120);
  const password = String(req.body.password || '');
  const role = req.body.role === 'admin' ? 'admin' : 'doctor';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) throw bad('invalid');
  if (password.length < 8) throw bad('weak-password');
  if (db.prepare('SELECT 1 FROM staff WHERE email = ?').get(email)) throw bad('email-taken');
  db.prepare('INSERT INTO staff(id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(newId(), email, name, hashSecret(password), role, now());
  audit(req.staff, 'add-staff', `${name} <${email}> (${role})`);
  return { ok: true };
}));
A.delete('/staff/:id', requireAdmin, wrap((req) => {
  if (req.params.id === req.staff.id) throw bad('cannot-delete-self');
  const s = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id) as any;
  if (!s) throw new HttpError(404, 'not-found');
  destroySessionsFor('staff', s.id);
  db.prepare('DELETE FROM staff WHERE id = ?').run(s.id);
  audit(req.staff, 'delete-staff', s.email);
  return { ok: true };
}));
A.get('/audit', requireAdmin, wrap(() =>
  db.prepare('SELECT id, staff_name AS staffName, action, details, created_at AS createdAt FROM audit_log ORDER BY id DESC LIMIT 200').all()));

A.get('/system', wrap(() => ({
  ai: aiConfigured,
  telegram: telegramConfigured,
  telegramBot: getBotUsername(),
  dbSizeKb: Math.round(fs.statSync(DB_PATH).size / 1024),
})));

app.use('/api/admin', A);
app.use('/api', (_req, res) => res.status(404).json({ error: 'not-found' }));

// ---------- serve the built React app (npm run build) ----------
const DIST = path.join(import.meta.dirname, '..', 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { index: 'index.html', maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

// ---------- first start: create the first admin account ----------
if (!(db.prepare('SELECT COUNT(*) c FROM staff').get() as any).c) {
  const email = (process.env.ADMIN_EMAIL || 'admin@bigus.uz').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  db.prepare('INSERT INTO staff(id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, \'admin\', ?)')
    .run(newId(), email, 'Bosh administrator', hashSecret(password), now());
  const note = path.join(path.dirname(DB_PATH), 'BIRINCHI_ADMIN.txt');
  fs.writeFileSync(note, `BIGUS birinchi admin hisobi\nEmail: ${email}\nParol: ${password}\n\nKirgandan keyin Sozlamalar bo'limida parolni almashtiring va bu faylni o'chiring.\n`);
  console.log(`\n[setup] Birinchi admin yaratildi: ${email} — parol: ${note} faylida\n`);
}

setInterval(cleanupSessions, 3600_000);
const PORT = Number(process.env.PORT || 4000);
// On a public server set HOST=127.0.0.1 so only nginx (HTTPS) can reach the app.
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`BIGUS server: http://localhost:${PORT}  (baza: ${DB_PATH})`);
  startTelegram();
});
