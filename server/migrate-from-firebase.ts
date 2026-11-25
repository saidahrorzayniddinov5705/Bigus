// One-time copy of the old Firebase (Firestore) data into the new SQLite
// database. READ-ONLY on the Firebase side — nothing there is changed.
//   npm run migrate
// Safe to run again: records that already exist are skipped.
//
// Patients' PINs can't be copied (Firebase never reveals passwords), so
// migrated patients set a new PIN on their first login.
import './env.ts';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'node:fs';
import path from 'node:path';
import { db, now } from './db.ts';
import { identityHash } from './auth.ts';
import { parseLocalDate, localDateStr } from '../src/lib/adherence.ts';

const cfg = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'firebase-applet-config.json'), 'utf8'));
const fdb = getFirestore(initializeApp(cfg), cfg.firestoreDatabaseId);

const ytId = (s: any) => { const m = String(s || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/); return m ? m[1] : null; };
const ppd = (f: string) => f === 'twiceDaily' ? 2 : f === 'thriceDaily' ? 3 : (f === 'fourDaily' || f === 'fourTimesDaily') ? 4 : 1;
const i18n = (v: any) => typeof v === 'string' ? { uz: v, ru: v, en: v, 'uz-cyrl': v } : (v || {});

const stats = { patients: 0, patientsSkipped: 0, meds: 0, news: 0, videos: 0, redemptions: 0 };

const users = await getDocs(collection(fdb, 'users'));
for (const u of users.docs) {
  const d: any = u.data();
  if (d.role !== 'patient' || !d.firstName || !d.lastName || !d.birthDate) { stats.patientsSkipped++; continue; }
  const ih = identityHash(d.firstName, d.lastName, d.fatherName || '', d.birthDate);
  const dup = db.prepare('SELECT id FROM patients WHERE identity_hash = ? AND id <> ?').get(ih, u.id);
  if (dup) { stats.patientsSkipped++; continue; }
  const r = db.prepare(`INSERT OR IGNORE INTO patients(id, last_name, first_name, father_name, birth_date, identity_hash, pin_hash,
      telegram_username, h_coins, xp, streak, completed_quizzes, completed_videos, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`).run(
    u.id, d.lastName.trim(), d.firstName.trim(), (d.fatherName || '').trim(), d.birthDate, ih,
    String(d.telegramUsername || '').replace(/^@/, ''), Math.max(0, Math.floor(d.hCoins || 0)), Math.max(0, Math.floor(d.xp || 0)),
    Math.max(0, Math.floor(d.streak || 0)), JSON.stringify(d.completedQuizzes || []), JSON.stringify(d.completedVideos || []),
    typeof d.createdAt === 'number' ? d.createdAt : now());
  if (r.changes) stats.patients++;

  const meds = await getDocs(collection(fdb, 'users', u.id, 'medications'));
  for (const m of meds.docs) {
    const md: any = m.data();
    const freq = md.frequencyKey === 'fourTimesDaily' ? 'fourDaily' : (md.frequencyKey || 'onceDaily');
    const per = ppd(freq);
    const duration = Math.max(1, Math.min(365, Math.floor(md.durationDays || (md.pillsTaken?.length ?? 1))));
    const pills = Array.from({ length: duration }, (_, i) => {
      const v = md.pillsTaken?.[i];
      return typeof v === 'number' ? Math.min(per, v) : v ? per : 0;
    });
    const start = parseLocalDate(md.startDate);
    const res = db.prepare(`INSERT OR IGNORE INTO medications(id, patient_id, name, dosage, frequency_key, duration_days, start_date,
        pills_taken, total_pills, scheduled_times, history, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      m.id, u.id, String(md.customName || md.nameKey || 'Dori'), String(md.dosage || ''), freq, duration,
      start ? localDateStr(start) : localDateStr(), JSON.stringify(pills), Math.max(1, Math.floor(md.totalPills || duration * per)),
      JSON.stringify(Array.isArray(md.scheduledTimes) ? md.scheduledTimes : []), JSON.stringify(Array.isArray(md.history) ? md.history : []),
      typeof md.createdAt === 'number' ? md.createdAt : now());
    if (res.changes) stats.meds++;
  }

  try {
    const reds = await getDocs(collection(fdb, 'users', u.id, 'redemptions'));
    for (const rd of reds.docs) {
      const x: any = rd.data();
      const res = db.prepare(`INSERT OR IGNORE INTO redemptions(id, patient_id, item_id, item_name_key, price, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`).run(rd.id, u.id, '', String(x.itemNameKey || ''), Math.floor(x.price || 0), x.status || 'pending', x.createdAt || now());
      if (res.changes) stats.redemptions++;
    }
  } catch { /* old Firebase rules don't allow reading these — nothing to copy */ }
}

for (const n of (await getDocs(collection(fdb, 'news'))).docs) {
  const d: any = n.data();
  const r = db.prepare('INSERT OR IGNORE INTO news(id, title, content, image_url, category, quiz, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(n.id, JSON.stringify(i18n(d.title)), JSON.stringify(i18n(d.content)), String(d.imageUrl || ''), d.category || 'general',
      JSON.stringify(Array.isArray(d.quiz) ? d.quiz : []), d.createdAt || now(), d.updatedAt || null);
  if (r.changes) stats.news++;
}

for (const v of (await getDocs(collection(fdb, 'videos'))).docs) {
  const d: any = v.data();
  const vid = d.videoId || ytId(d.videoUrl) || ytId(d.iframeCode);
  if (!vid) continue;
  const r = db.prepare('INSERT OR IGNORE INTO videos(id, title, description, video_url, video_id, quiz, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(v.id, JSON.stringify(i18n(d.title)), JSON.stringify(i18n(d.description)), String(d.videoUrl || `https://youtu.be/${vid}`), vid,
      JSON.stringify(Array.isArray(d.quiz) ? d.quiz : []), d.createdAt || now(), d.updatedAt || null);
  if (r.changes) stats.videos++;
}

console.log("Ko'chirildi:", stats);
process.exit(0);
