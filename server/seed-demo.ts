/**
 * Builds a separate DEMO database (server/data-demo/bigus.db) for showing
 * BIGUS at presentations: demo patients with ~3 weeks of dose history,
 * messages to the doctor, shop orders, news and video lessons.
 *
 * The real database (server/data/bigus.db) is never touched.
 *
 *   npm run demo:seed     (re)creates the demo database
 *   npm run demo          starts the demo on http://localhost:4100
 */
import path from 'node:path';
import fs from 'node:fs';

const DEMO_DIR = path.join(import.meta.dirname, 'data-demo');
try {
  fs.rmSync(DEMO_DIR, { recursive: true, force: true });
} catch {
  console.error('Demo baza band — demo server allaqachon ishlayapti. Uning oynasini yoping va qayta urinib ko‘ring.');
  process.exit(1);
}
fs.mkdirSync(DEMO_DIR, { recursive: true });
process.env.BIGUS_DATA_DIR = DEMO_DIR;
process.env.TZ = process.env.BIGUS_TZ || 'Asia/Tashkent';

const { db, newId } = await import('./db.ts');
const { hashSecret, identityHash } = await import('./auth.ts');
const { localDateStr, pillsPerDay } = await import('../src/lib/adherence.ts');

// Deterministic randomness so every demo looks the same.
let seed = 20261110;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const DAY = 86400000;
const nowMs = Date.now();
const daysAgo = (n: number) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const at = (day: Date, hhmm: string, jitterMin = 0) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(day); d.setHours(h, m, 0, 0);
  return d.getTime() + Math.round(jitterMin * 60000);
};
const L = (uz: string, ru: string, en: string, cyrl?: string) => ({ uz, ru, en, 'uz-cyrl': cyrl || uz });

// ---------------- staff ----------------
const ADMIN = { email: 'demo@bigus.uz', password: 'Demo2026' };
const DOCTOR = { email: 'shifokor@bigus.uz', password: 'Shifokor2026' };
db.prepare("INSERT INTO staff(id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'admin', ?)")
  .run(newId(), ADMIN.email, 'Demo administrator', hashSecret(ADMIN.password), nowMs - 30 * DAY);
const doctorId = newId();
db.prepare("INSERT INTO staff(id, email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'doctor', ?)")
  .run(doctorId, DOCTOR.email, 'Dr. Nodira Rahimova', hashSecret(DOCTOR.password), nowMs - 30 * DAY);

// ---------------- content ----------------
const quiz = (q: string, opts: string[], correct: number) => ({ question: L(q, q, q), options: opts.map(o => L(o, o, o)), correctOptionIndex: correct });

const news = [
  {
    category: 'article',
    img: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=1200',
    title: L("Dorini ichishni unutdingizmi? Nima qilish kerak", "Забыли принять лекарство? Что делать", "Missed a dose? Here's what to do"),
    content: L(
`Dorini vaqtida ichishni unutib qo'yish — eng ko'p uchraydigan holat. Muhimi, vahimaga tushmaslik va to'g'ri harakat qilish.

1. Esingizga tushishi bilan dori qo'llanmasini (instruksiyani) yoki shifokoringiz ko'rsatmasini tekshiring. Ko'p dorilar uchun keyingi doza vaqti uzoq bo'lsa, o'tkazib yuborilgan dozani hozir ichish mumkin.

2. Agar keyingi doza vaqti yaqin bo'lsa, o'tkazib yuborilganini tashlab, odatdagi jadvalni davom ettiring.

3. Hech qachon ikki dozani birdaniga ichmang — bu nojo'ya ta'sirlar xavfini oshiradi.

4. Tez-tez unutayotgan bo'lsangiz, shifokoringizga ayting: ichish vaqtini kundalik odatingizga (nonushta, uyqu) moslashtirish mumkin.

BIGUS eslatmalari va Telegram xabarlari dozani o'tkazib yubormaslikka yordam beradi.`,
`Пропуск приёма — частая ситуация. Главное — не паниковать и действовать правильно.

1. Как только вспомнили, проверьте инструкцию к препарату или указания врача. Для многих лекарств, если до следующего приёма далеко, пропущенную дозу можно принять сейчас.

2. Если следующий приём скоро, пропустите забытую дозу и продолжайте по обычному графику.

3. Никогда не принимайте двойную дозу — это повышает риск побочных эффектов.

4. Если забываете часто, скажите врачу: время приёма можно привязать к ежедневной привычке.`,
`Missing a dose happens to everyone. The key is not to panic and to act correctly.

1. As soon as you remember, check the medicine leaflet or your doctor's instructions. For many medicines, if the next dose isn't due soon, you can take the missed one now.

2. If your next dose is close, skip the missed one and continue your usual schedule.

3. Never take a double dose — it raises the risk of side effects.

4. If you forget often, tell your doctor: the timing can be tied to a daily habit.`),
    quiz: [
      quiz("Keyingi doza vaqti yaqin bo'lsa, o'tkazib yuborilgan dozani nima qilish kerak?", ["Ikki dozani birdan ichish", "O'tkazib yuborib, jadvalni davom ettirish", "Dorini butunlay to'xtatish"], 1),
      quiz("Ikki dozani birdaniga ichish mumkinmi?", ["Ha, xavfsiz", "Yo'q, nojo'ya ta'sir xavfi oshadi", "Faqat kechqurun"], 1),
    ],
  },
  {
    category: 'news',
    img: 'https://images.unsplash.com/photo-1615486511484-92e172cc4fe0?auto=format&fit=crop&q=80&w=1200',
    title: L("Qon bosimini uyda to'g'ri o'lchash: 6 qoida", "Как правильно измерять давление дома: 6 правил", "Measuring blood pressure at home: 6 rules"),
    content: L(
`Uyda o'lchangan qon bosimi shifokorga davolash samarasini baholashda katta yordam beradi — lekin faqat to'g'ri o'lchansa.

1. O'lchashdan 30 daqiqa oldin choy, qahva ichmang, chekmang va jismoniy mashq qilmang.
2. O'lchashdan oldin 5 daqiqa tinch o'tiring.
3. Orqangiz suyanchiqqa tiralgan, oyoqlaringiz polda bo'lsin, oyoqlarni chalishtirmang.
4. Qo'l stolda, manjeta yurak balandligida va yalang'och qo'lga taqilgan bo'lsin.
5. O'lchash vaqtida gapirmang.
6. 1–2 daqiqa oraliq bilan 2–3 marta o'lchab, natijalarni yozib boring.

Natijalaringizni shifokor qabuliga olib boring yoki BIGUS orqali shifokoringizga yozing.`,
`Домашние измерения давления помогают врачу оценить лечение — но только если они сделаны правильно.

1. За 30 минут не пейте чай и кофе, не курите и не занимайтесь спортом.
2. Перед измерением 5 минут посидите спокойно.
3. Спина опирается на спинку стула, ноги на полу, не скрещены.
4. Рука на столе, манжета на уровне сердца на голой руке.
5. Не разговаривайте во время измерения.
6. Измерьте 2–3 раза с перерывом 1–2 минуты и записывайте результаты.`,
`Home readings help your doctor judge your treatment — but only when they're taken correctly.

1. No tea, coffee, smoking or exercise for 30 minutes before.
2. Sit quietly for 5 minutes first.
3. Back supported, feet flat on the floor, legs uncrossed.
4. Arm resting on a table, cuff on bare skin at heart level.
5. Don't talk during the measurement.
6. Take 2–3 readings 1–2 minutes apart and write them down.`),
    quiz: [
      quiz("O'lchashdan oldin necha daqiqa tinch o'tirish kerak?", ["1 daqiqa", "5 daqiqa", "Shart emas"], 1),
      quiz("Manjeta qayerda bo'lishi kerak?", ["Yurak balandligida", "Bilakda pastda", "Kiyim ustida"], 0),
    ],
  },
  {
    category: 'announcement',
    img: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=1200',
    title: L("BIGUS'da yangi: kamera orqali doza tasdig'i", "Новое в BIGUS: подтверждение приёма камерой", "New in BIGUS: camera dose confirmation"),
    content: L(
`Endi dorini ichganingizni kamera orqali tasdiqlashingiz mumkin. Doza tugmasini bosing — kamera ochiladi.

Tahlil telefoningizning o'zida bajariladi — video hech qayerga yuborilmaydi. Har bir tasdiqlangan doza uchun H-Coin beriladi, shifokoringiz esa qat'iyatingizni real vaqtda ko'radi.`,
`Теперь приём лекарства можно подтвердить камерой: нажмите на дозу — откроется камера.

Анализ выполняется на вашем телефоне — видео никуда не отправляется. За каждую подтверждённую дозу начисляются H-Coin.`,
`You can now confirm a dose with your camera: tap the dose and the camera opens.

The analysis runs on your phone — the video is never uploaded. Every confirmed dose earns H-Coins.`),
    quiz: [],
  },
];
news.forEach((n, i) => {
  db.prepare('INSERT INTO news(id, title, content, image_url, category, quiz, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(newId(), JSON.stringify(n.title), JSON.stringify(n.content), n.img, n.category, JSON.stringify(n.quiz), nowMs - (i * 3 + 1) * DAY);
});

// Real, publicly available YouTube videos (checked to exist).
const videos = [
  {
    videoId: '3PmVJQUCm4E', author: 'World Health Organization (WHO)',
    title: L("Qo'lni to'g'ri yuvish (JSST)", "Как правильно мыть руки (ВОЗ)", "How to handwash (WHO)"),
    description: L("Jahon sog'liqni saqlash tashkilotining qo'lni sovun bilan to'g'ri yuvish bo'yicha qisqa videosi.", "Короткое видео ВОЗ о правильном мытье рук с мылом.", "A short WHO video on washing hands properly with soap and water."),
    quiz: [
      quiz("Qo'lni yuvish kamida qancha davom etishi kerak?", ["5 soniya", "20–30 soniya", "5 daqiqa"], 1),
      quiz("Qo'l yuvishda nimaga ko'proq e'tibor beriladi?", ["Faqat kaftga", "Barmoqlar orasi va tirnoqlarga ham", "Faqat suvga"], 1),
    ],
  },
  {
    videoId: 'egBmUw0Y0IE', author: 'World Hypertension League',
    title: L("Qon bosimini to'g'ri o'lchash", "Как правильно измерять давление", "How to best measure blood pressure"),
    description: L("Butunjahon gipertenziya ligasi: qon bosimini aniq o'lchash qoidalari.", "Всемирная лига гипертензии: правила точного измерения давления.", "World Hypertension League: how to measure blood pressure accurately."),
    quiz: [
      quiz("O'lchash vaqtida gapirish mumkinmi?", ["Ha", "Yo'q", "Faqat shivirlab"], 1),
      quiz("Oyoqlar qanday turishi kerak?", ["Chalishtirilgan", "Polda, chalishtirilmagan", "Stul ustida"], 1),
    ],
  },
];
videos.forEach((v, i) => {
  db.prepare('INSERT INTO videos(id, title, description, video_url, video_id, quiz, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(`demo-video-${i + 1}`, JSON.stringify(v.title), JSON.stringify(v.description), `https://www.youtube.com/watch?v=${v.videoId}`, v.videoId, JSON.stringify(v.quiz), nowMs - (10 - i) * DAY);
});

// ---------------- patients ----------------
type MedSpec = { name: string, dosage: string, freq: string, times: string[], days: number, startedAgo: number, instructions?: string };
type PSpec = { last: string, first: string, father: string, birth: string, adherence: number, meds: MedSpec[], note?: string, coins?: number, videos?: number, perfectLast?: number };

const COMMON = {
  metformin: { name: 'Metformin', dosage: '500 mg', freq: 'twiceDaily', times: ['08:00', '20:00'], instructions: 'Ovqat bilan birga iching' },
  lizinopril: { name: 'Lizinopril', dosage: '10 mg', freq: 'onceDaily', times: ['09:00'], instructions: 'Har kuni bir vaqtda' },
  amoks: { name: 'Amoksitsillin', dosage: '500 mg', freq: 'thriceDaily', times: ['08:00', '14:00', '20:00'], instructions: "Kursni oxirigacha iching, o'zboshimchalik bilan to'xtatmang" },
  atorva: { name: 'Atorvastatin', dosage: '20 mg', freq: 'onceDaily', times: ['21:00'], instructions: 'Kechqurun' },
  omepraz: { name: 'Omeprazol', dosage: '20 mg', freq: 'onceDaily', times: ['07:30'], instructions: 'Nonushtadan 30 daqiqa oldin' },
  amlo: { name: 'Amlodipin', dosage: '5 mg', freq: 'onceDaily', times: ['08:30'] },
};
const med = (k: keyof typeof COMMON, days: number, startedAgo: number): MedSpec => ({ ...COMMON[k], days, startedAgo });

const patients: PSpec[] = [
  // The patient used for the live demo (log in with these details, PIN 123456).
  { last: 'Karimov', first: 'Aziz', father: 'Botirovich', birth: '1980-01-15', adherence: 0.9, perfectLast: 7, meds: [med('metformin', 30, 20), med('lizinopril', 30, 20)], note: "2-tur qandli diabet, gipertenziya. Allergiya yo'q.", coins: 2650, videos: 1 },
  { last: 'Yusupova', first: 'Dilnoza', father: 'Akmalovna', birth: '1992-06-03', adherence: 0.97, meds: [med('omepraz', 28, 14)] },
  { last: 'Toshmatov', first: 'Bekzod', father: 'Rustamovich', birth: '1975-11-21', adherence: 0.55, meds: [med('amlo', 60, 18), med('atorva', 60, 18)], note: 'Tez-tez dozani unutadi — Telegram eslatmasini yoqish tavsiya etildi.' },
  { last: 'Abdullayeva', first: 'Malika', father: 'Shavkatovna', birth: '1988-02-14', adherence: 0.88, meds: [med('amoks', 10, 6)] },
  { last: 'Rahimov', first: 'Jasur', father: "Olimjonovich", birth: '1969-09-09', adherence: 0.62, meds: [med('metformin', 90, 21), med('atorva', 90, 21)] },
  { last: 'Ergasheva', first: 'Nilufar', father: 'Baxtiyorovna', birth: '1995-04-30', adherence: 0.91, meds: [med('lizinopril', 30, 12)] },
  { last: "Qodirov", first: 'Sardor', father: 'Ilhomovich', birth: '1983-12-01', adherence: 0.79, meds: [med('omepraz', 14, 9), med('amoks', 7, 3)] },
  { last: 'Nazarova', first: 'Gulnora', father: 'Erkinovna', birth: '1958-07-19', adherence: 0.84, meds: [med('amlo', 90, 19), med('metformin', 90, 19)] },
  { last: 'Islomov', first: 'Otabek', father: 'Farhodovich', birth: '1990-03-08', adherence: 0.48, meds: [med('atorva', 30, 15)], note: "Nojo'ya ta'sirdan shikoyat qilgan — dozani qayta ko'rib chiqish kerak." },
  { last: 'Mirzayeva', first: 'Kamola', father: 'Davronovna', birth: '1979-10-25', adherence: 0.99, meds: [med('lizinopril', 60, 20)] },
  { last: 'Saidov', first: 'Ulugbek', father: 'Anvarovich', birth: '1986-05-17', adherence: 0.73, meds: [med('metformin', 30, 10)] },
  { last: 'Xolmatova', first: 'Sevara', father: 'Nodirovna', birth: '2001-08-11', adherence: 0.0, meds: [] },
];

const ids: Record<string, string> = {};
const medIds: Record<string, string[]> = {};

for (const ps of patients) {
  const pid = newId();
  ids[ps.last] = pid;
  medIds[ps.last] = [];
  let coins = 0, takenTotal = 0, streakBroken = false, streak = 0;
  const created = daysAgo(Math.max(...ps.meds.map(m => m.startedAgo), 2) + 1).getTime() + 10 * 3600000;

  db.prepare(`INSERT INTO patients(id, last_name, first_name, father_name, birth_date, identity_hash, pin_hash, doctor_note, last_seen_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(pid, ps.last, ps.first, ps.father, ps.birth, identityHash(ps.first, ps.last, ps.father, ps.birth), hashSecret('123456'),
      ps.note || '', ps.meds.length ? nowMs - Math.round(rnd() * 20) * 3600000 : null, created);

  for (const m of ps.meds) {
    const ppd = pillsPerDay({ frequencyKey: m.freq });
    const start = daysAgo(m.startedAgo);
    const pills = new Array(m.days).fill(0);
    const history: any[] = [];
    for (let i = 0; i <= m.startedAgo && i < m.days; i++) {
      const day = new Date(start); day.setDate(day.getDate() + i);
      const isToday = i === m.startedAgo;
      m.times.forEach(time => {
        const due = at(day, time);
        if (isToday && due > nowMs) return;        // not due yet today
        const forced = ps.perfectLast !== undefined && i >= m.startedAgo - ps.perfectLast;
        if (forced || rnd() < ps.adherence) {
          const ts = Math.min(nowMs - 60000, due + (rnd() * 40 - 10) * 60000);
          pills[i] += 1;
          history.push({ dayIndex: i, timestamp: ts, action: 'taken' });
          coins += Math.round(50 / ppd);
          takenTotal++;
        }
      });
    }
    const mid = newId();
    medIds[ps.last].push(mid);
    db.prepare(`INSERT INTO medications(id, patient_id, name, dosage, frequency_key, duration_days, start_date, pills_taken, total_pills, scheduled_times, history, instructions, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`)
      .run(mid, pid, m.name, m.dosage, m.freq, m.days, localDateStr(start), JSON.stringify(pills), m.days * ppd,
        JSON.stringify(m.times), JSON.stringify(history), m.instructions || '', start.getTime() + 7 * 3600000);
  }

  // Streak: consecutive fully-taken days counting back from yesterday.
  for (let back = 1; back < 60 && !streakBroken; back++) {
    let exp = 0, got = 0;
    for (const [k, m] of ps.meds.entries()) {
      const idx = m.startedAgo - back;
      if (idx < 0 || idx >= m.days) continue;
      const row = db.prepare('SELECT pills_taken FROM medications WHERE id = ?').get(medIds[ps.last][k]) as any;
      exp += m.times.length; got += JSON.parse(row.pills_taken)[idx];
    }
    if (exp === 0) break;
    if (got >= exp) streak++; else streakBroken = true;
  }

  const completedVideos = (ps.videos ? videos.slice(0, ps.videos).map((_, i) => `demo-video-${i + 1}`) : []);
  const balance = ps.coins ?? Math.round(coins * 0.6);
  db.prepare('UPDATE patients SET h_coins = ?, xp = ?, streak = ?, completed_videos = ? WHERE id = ?')
    .run(balance, takenTotal * 10 + completedVideos.length * 10, streak, JSON.stringify(completedVideos), pid);
}

// ---------------- messages to the doctor ----------------
const report = (last: string, medIdx: number | null, text: string, severity: string, hoursAgo: number, reply?: string) =>
  db.prepare(`INSERT INTO reports(id, patient_id, medication_id, text, severity, status, doctor_reply, created_at, reviewed_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(newId(), ids[last], medIdx === null ? null : medIds[last][medIdx], text, severity, reply ? 'reviewed' : 'new', reply || '',
      nowMs - hoursAgo * 3600000, reply ? nowMs - (hoursAgo - 2) * 3600000 : null);

report('Islomov', 0, "Atorvastatin ichgandan keyin 3 kundan beri oyoq mushaklarim og'riyapti, zinadan chiqish qiyin.", 'severe', 3);
report('Toshmatov', 0, "Ertalab bosh aylanishi bo'lyapti, ayniqsa o'rnimdan turganda.", 'moderate', 9);
report('Qodirov', 1, "Antibiotikdan keyin oshqozonim biroz bezovta.", 'mild', 20);
report('Karimov', 0, "Metformindan keyin ko'ngil aynishi bo'ldi.", 'mild', 72, "Metforminni ovqat paytida iching — bu ko'ngil aynishini kamaytiradi. 1 haftada o'tmasa, qabulga keling.");

// ---------------- shop orders ----------------
const order = (last: string, itemId: string, nameKey: string, price: number, status: string, daysBack: number) =>
  db.prepare('INSERT INTO redemptions(id, patient_id, item_id, item_name_key, price, status, created_at, fulfilled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(newId(), ids[last], itemId, nameKey, price, status, nowMs - daysBack * DAY, status === 'pending' ? null : nowMs - (daysBack - 1) * DAY);
order('Mirzayeva', '2', 'notebook', 2500, 'pending', 1);
order('Yusupova', '2', 'notebook', 2500, 'fulfilled', 5);
order('Nazarova', '3', 'cap', 5000, 'pending', 2);

db.prepare("INSERT INTO audit_log(staff_id, staff_name, action, details, created_at) VALUES (?, 'Dr. Nodira Rahimova', 'review-report', 'Karimov Aziz: javob yuborildi', ?)")
  .run(doctorId, nowMs - 70 * 3600000);

console.log(`
Demo baza tayyor: ${path.join(DEMO_DIR, 'bigus.db')}
  Admin:     ${ADMIN.email} / ${ADMIN.password}
  Shifokor:  ${DOCTOR.email} / ${DOCTOR.password}
  Bemor:     Karimov Aziz Botirovich, 15.01.1980, PIN 123456
  (barcha demo bemorlar PIN'i: 123456)
`);
