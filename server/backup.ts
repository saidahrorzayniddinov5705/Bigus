// Daily database backup: `npm run backup` (run by cron on the server).
// Writes a consistent copy with VACUUM INTO and keeps the last KEEP copies.
import './env.ts';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = process.env.BIGUS_DATA_DIR || path.join(import.meta.dirname, 'data');
const DB = path.join(DATA_DIR, 'bigus.db');
const OUT = process.env.BIGUS_BACKUP_DIR || path.join(import.meta.dirname, '..', 'backups');
const KEEP = Number(process.env.BIGUS_BACKUP_KEEP || 14);

fs.mkdirSync(OUT, { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const file = path.join(OUT, `bigus-${stamp}.db`);
const db = new DatabaseSync(DB, { readOnly: true });
db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
db.close();

const old = fs.readdirSync(OUT).filter(f => /^bigus-.*\.db$/.test(f)).sort().reverse().slice(KEEP);
for (const f of old) fs.unlinkSync(path.join(OUT, f));
console.log(`zaxira: ${file} (${Math.round(fs.statSync(file).size / 1024)} KB), o'chirildi: ${old.length}`);
