// SQLite storage (Node's built-in node:sqlite — no native modules to compile).
// The whole database is a single file: server/data/bigus.db
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.BIGUS_DATA_DIR || path.join(import.meta.dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
export const DB_PATH = path.join(DATA_DIR, 'bigus.db');

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  father_name TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  identity_hash TEXT NOT NULL UNIQUE,
  pin_hash TEXT,                       -- NULL = PIN not set yet (migrated / reset by doctor)
  telegram_username TEXT DEFAULT '',
  telegram_chat_id TEXT,
  telegram_link_code TEXT,
  h_coins INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  completed_quizzes TEXT NOT NULL DEFAULT '[]',
  completed_videos TEXT NOT NULL DEFAULT '[]',
  doctor_note TEXT DEFAULT '',
  failed_pin_count INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  last_seen_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS medications (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT DEFAULT '',
  frequency_key TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  pills_taken TEXT NOT NULL,           -- JSON array, doses taken per course day
  total_pills INTEGER NOT NULL,
  scheduled_times TEXT NOT NULL DEFAULT '[]',
  history TEXT NOT NULL DEFAULT '[]',
  instructions TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active', -- active | stopped
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_meds_patient ON medications(patient_id);

CREATE TABLE IF NOT EXISTS redemptions (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_name_key TEXT NOT NULL,
  price INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  fulfilled_at INTEGER
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  medication_id TEXT,
  text TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'mild', -- mild | moderate | severe
  status TEXT NOT NULL DEFAULT 'new',    -- new | reviewed
  doctor_reply TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER
);

CREATE TABLE IF NOT EXISTS news (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL, content TEXT NOT NULL,
  image_url TEXT DEFAULT '', category TEXT DEFAULT 'general',
  quiz TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL, updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '{}',
  video_url TEXT DEFAULT '', video_id TEXT NOT NULL,
  quiz TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL, updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'doctor', -- admin | doctor
  failed_count INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL,          -- patient | staff
  subject_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_rewards (
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (patient_id, day, kind)
);

CREATE TABLE IF NOT EXISTS reminders_sent (
  medication_id TEXT NOT NULL,
  day TEXT NOT NULL,
  time TEXT NOT NULL,
  PRIMARY KEY (medication_id, day, time)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id TEXT, staff_name TEXT,
  action TEXT NOT NULL, details TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
`);

export const newId = () => crypto.randomUUID();
export const now = () => Date.now();

export const json = <T = any>(v: unknown, fallback: T): T => {
  if (typeof v !== 'string') return fallback;
  try { return JSON.parse(v) as T; } catch { return fallback; }
};

export function tx<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
  return row ? row.value : null;
}
export function setSetting(key: string, value: string) {
  db.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

// ---------- row -> API shapes (kept identical to what the React app used with Firestore) ----------

// Rehearsal accounts (server/.env REHEARSAL_PATIENTS=id1,id2): may mark any day
// of a course, not only today, so a demo can be practised. Real patients never are.
export function isRehearsal(patientId: string): boolean {
  return (process.env.REHEARSAL_PATIENTS || '').split(',').map(s => s.trim()).filter(Boolean).includes(patientId);
}

export function patientToApi(r: any, opts: { includePrivate?: boolean } = {}) {
  return {
    uid: r.id,
    id: r.id,
    role: 'patient',
    isProfileComplete: true,
    lastName: r.last_name,
    firstName: r.first_name,
    fatherName: r.father_name,
    fullName: `${r.last_name} ${r.first_name} ${r.father_name}`,
    birthDate: r.birth_date,
    telegramUsername: r.telegram_username || '',
    telegramLinked: !!r.telegram_chat_id,
    hCoins: r.h_coins,
    xp: r.xp,
    streak: r.streak,
    completedQuizzes: json<string[]>(r.completed_quizzes, []),
    completedVideos: json<string[]>(r.completed_videos, []),
    createdAt: r.created_at,
    lastSeenAt: r.last_seen_at || null,
    rehearsal: isRehearsal(r.id),
    ...(opts.includePrivate ? { doctorNote: r.doctor_note || '', pinSet: !!r.pin_hash } : {}),
  };
}

export function medToApi(r: any) {
  const pillsTaken = json<number[]>(r.pills_taken, []);
  const taken = pillsTaken.reduce((s, v) => s + (Number(v) || 0), 0);
  return {
    id: r.id,
    nameKey: r.name,
    customName: r.name,
    dosage: r.dosage,
    frequencyKey: r.frequency_key,
    durationDays: r.duration_days,
    startDate: r.start_date,
    pillsTaken,
    totalPills: r.total_pills,
    remainingPills: Math.max(0, r.total_pills - taken),
    scheduledTimes: json<string[]>(r.scheduled_times, []),
    history: json<any[]>(r.history, []),
    instructions: r.instructions || '',
    status: r.status,
    typeKey: 'general',
    createdAt: r.created_at,
  };
}

export function newsToApi(r: any) {
  return {
    id: r.id,
    title: json(r.title, {}),
    content: json(r.content, {}),
    imageUrl: r.image_url || '',
    category: r.category || 'general',
    quiz: json(r.quiz, []),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function videoToApi(r: any) {
  return {
    id: r.id,
    title: json(r.title, {}),
    description: json(r.description, {}),
    videoUrl: r.video_url || '',
    videoId: r.video_id,
    quiz: json(r.quiz, []),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
