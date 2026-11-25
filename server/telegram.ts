// Telegram reminders sent by the SERVER. Before, reminders were sent from the
// patient's own browser (only while the app was open) using a bot token that
// was stored in the open database — anyone could read and abuse it. Now one
// clinic bot token lives only in server/.env, and patients link their own
// Telegram chat by pressing a button in the app.
import crypto from 'node:crypto';
import { db, json, now } from './db.ts';
import { dayIndexFor, pillsPerDay, takenOn, localDateStr } from '../src/lib/adherence.ts';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
export const telegramConfigured = Boolean(TOKEN);
let botUsername: string | null = null;
export const getBotUsername = () => botUsername;

async function api(method: string, body: any = {}): Promise<any> {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!data.ok) throw new Error(`Telegram ${method} failed: ${data.description || r.status}`);
  return data.result;
}

export async function sendMessage(chatId: string, text: string): Promise<boolean> {
  if (!TOKEN || !chatId) return false;
  try {
    await api('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });
    return true;
  } catch (e) {
    console.error(String(e));
    return false;
  }
}

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function linkCodeFor(patientId: string): string {
  const row = db.prepare('SELECT telegram_link_code FROM patients WHERE id = ?').get(patientId) as any;
  if (row?.telegram_link_code) return row.telegram_link_code;
  const code = crypto.randomBytes(9).toString('base64url');
  db.prepare('UPDATE patients SET telegram_link_code = ? WHERE id = ?').run(code, patientId);
  return code;
}

export function notifyPatient(patientId: string, text: string) {
  const p = db.prepare('SELECT telegram_chat_id FROM patients WHERE id = ?').get(patientId) as any;
  if (p?.telegram_chat_id) sendMessage(p.telegram_chat_id, text);
}

// ---------- incoming updates (/start <code>) ----------
let offset = 0;
async function pollUpdates() {
  try {
    const updates = await api('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] });
    for (const u of updates) {
      offset = u.update_id + 1;
      const msg = u.message;
      if (!msg?.text) continue;
      const chatId = String(msg.chat.id);
      const m = msg.text.match(/^\/start(?:\s+(\S+))?/);
      if (m && m[1]) {
        const p = db.prepare('SELECT * FROM patients WHERE telegram_link_code = ?').get(m[1]) as any;
        if (p) {
          db.prepare('UPDATE patients SET telegram_chat_id = ?, telegram_link_code = NULL, telegram_username = COALESCE(NULLIF(?, \'\'), telegram_username) WHERE id = ?')
            .run(chatId, msg.from?.username || '', p.id);
          await sendMessage(chatId, `✅ <b>BIGUS</b>: ${esc(p.first_name)}, Telegram ulandi! Endi dori ichish vaqtida shu yerga eslatma keladi.`);
        } else {
          await sendMessage(chatId, "Bu havola eskirgan. BIGUS ilovasida «Telegramni ulash» tugmasini qayta bosing.");
        }
      } else if (m) {
        await sendMessage(chatId, "Salom! Eslatmalarni olish uchun BIGUS ilovasidagi «Telegramni ulash» tugmasini bosing.");
      } else if (msg.text === '/stop') {
        db.prepare('UPDATE patients SET telegram_chat_id = NULL WHERE telegram_chat_id = ?').run(chatId);
        await sendMessage(chatId, "Eslatmalar o'chirildi.");
      }
    }
  } catch (e) {
    console.error(String(e));
    await new Promise(r => setTimeout(r, 5000));
  }
  setImmediate(pollUpdates);
}

// ---------- dose reminders ----------
function checkReminders() {
  const d = new Date();
  const day = localDateStr(d);
  const nowMin = d.getHours() * 60 + d.getMinutes();
  const rows = db.prepare(`
    SELECT m.*, p.telegram_chat_id, p.first_name FROM medications m
    JOIN patients p ON p.id = m.patient_id
    WHERE m.status = 'active' AND p.telegram_chat_id IS NOT NULL`).all() as any[];
  for (const r of rows) {
    const med = { startDate: r.start_date, frequencyKey: r.frequency_key, pillsTaken: json(r.pills_taken, []), durationDays: r.duration_days };
    const idx = dayIndexFor(med, d);
    if (idx < 0 || idx >= r.duration_days) continue;
    const times: string[] = json(r.scheduled_times, []);
    const taken = takenOn(med, idx);
    times.forEach((t, i) => {
      const [h, mm] = t.split(':').map(Number);
      const tMin = h * 60 + (mm || 0);
      // Send at the scheduled minute (or up to 10 min late if the server was busy/restarting),
      // only if that dose (the i-th of the day) hasn't been taken yet.
      if (nowMin < tMin || nowMin > tMin + 10 || taken > i || taken >= pillsPerDay(med)) return;
      const res = db.prepare('INSERT OR IGNORE INTO reminders_sent(medication_id, day, time) VALUES (?, ?, ?)').run(r.id, day, t);
      if (res.changes === 0) return;
      sendMessage(r.telegram_chat_id,
        `🔔 <b>Dori ichish vaqti</b>\n\n💊 <b>${esc(r.name)}</b>${r.dosage ? ` — ${esc(r.dosage)}` : ''}\n🕒 ${t}\n${r.instructions ? `📝 ${esc(r.instructions)}\n` : ''}\nIchgandan keyin BIGUS ilovasida belgilashni unutmang.`);
    });
  }
  // keep the table small
  db.prepare('DELETE FROM reminders_sent WHERE day < ?').run(localDateStr(new Date(now() - 3 * 86400_000)));
}

export async function startTelegram() {
  if (!TOKEN) {
    console.log('[telegram] TELEGRAM_BOT_TOKEN not set — Telegram reminders are off.');
    return;
  }
  try {
    const me = await api('getMe');
    botUsername = me.username;
    console.log(`[telegram] bot @${botUsername} connected`);
  } catch (e) {
    console.error('[telegram] could not connect:', String(e));
    return;
  }
  pollUpdates();
  setInterval(checkReminders, 30_000);
  checkReminders();
}
