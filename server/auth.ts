import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { db, now } from './db.ts';

// ---------- password / PIN hashing (scrypt, built into Node) ----------
export function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(secret, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifySecret(secret: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [algo, saltHex, hashHex] = stored.split('$');
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(secret, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

// Same identity rule the old app used (name + father's name + birth date),
// so migrated patients are recognised when they log in.
export function identityHash(firstName: string, lastName: string, fatherName: string, birthDate: string) {
  const norm = [firstName, lastName, fatherName, birthDate].map(s => (s || '').trim().toLowerCase()).join('|');
  return crypto.createHash('sha256').update(norm).digest('hex');
}

// ---------- sessions (random opaque tokens; only their hash is stored) ----------
const SESSION_DAYS = { patient: 90, staff: 1 } as const;
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export function createSession(kind: 'patient' | 'staff', subjectId: string): string {
  const token = crypto.randomBytes(32).toString('base64url');
  const created = now();
  db.prepare('INSERT INTO sessions(token_hash, kind, subject_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(sha(token), kind, subjectId, created, created + SESSION_DAYS[kind] * 86400_000);
  return token;
}

export function destroySession(token: string) {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token));
}

export function destroySessionsFor(kind: 'patient' | 'staff', subjectId: string) {
  db.prepare('DELETE FROM sessions WHERE kind = ? AND subject_id = ?').run(kind, subjectId);
}

function readToken(req: Request): string | null {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

function lookup(req: Request, kind: 'patient' | 'staff') {
  const token = readToken(req);
  if (!token) return null;
  const s = db.prepare('SELECT * FROM sessions WHERE token_hash = ? AND kind = ?').get(sha(token), kind) as any;
  if (!s) return null;
  if (s.expires_at < now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(s.token_hash);
    return null;
  }
  return s;
}

declare global {
  namespace Express {
    interface Request { patient?: any; staff?: any; }
  }
}

export function requirePatient(req: Request, res: Response, next: NextFunction) {
  const s = lookup(req, 'patient');
  const p = s && db.prepare('SELECT * FROM patients WHERE id = ?').get(s.subject_id);
  if (!p) return res.status(401).json({ error: 'unauthorized' });
  req.patient = p;
  db.prepare('UPDATE patients SET last_seen_at = ? WHERE id = ?').run(now(), (p as any).id);
  next();
}

export function requireStaff(req: Request, res: Response, next: NextFunction) {
  const s = lookup(req, 'staff');
  const st = s && db.prepare('SELECT * FROM staff WHERE id = ?').get(s.subject_id);
  if (!st) return res.status(401).json({ error: 'unauthorized' });
  req.staff = st;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireStaff(req, res, () => {
    if (req.staff.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    next();
  });
}

// ---------- brute-force protection ----------
export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export function cleanupSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now());
}

export function audit(staff: any, action: string, details = '') {
  db.prepare('INSERT INTO audit_log(staff_id, staff_name, action, details, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(staff?.id || null, staff?.name || null, action, details, now());
}
