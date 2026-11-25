# BIGUS — dori kursini kuzatish ilovasi

Firebase'siz, o'zimizning backend bilan ishlaydi: **Node.js + Express + SQLite** (baza bitta fayl: `server/data/bigus.db`).

## Ishga tushirish

**Eng oson:** Desktop'dagi `BIGUS.bat` faylini ikki marta bosing. Sayt `http://localhost:4000` da ochiladi.

- Bemorlar sahifasi: `http://localhost:4000`
- Shifokor/admin paneli: `http://localhost:4000/#/admin`

Buyruqlar (dasturchi uchun):

| Buyruq | Nima qiladi |
|---|---|
| `npm start` | Saytni yig'adi va serverni ishga tushiradi (port 4000) |
| `npm run server` + `npm run dev` | Ishlab chiqish rejimi: backend 4000, sayt 3000 (o'zgarishlar darhol ko'rinadi) |
| `npm run migrate` | Eski Firebase ma'lumotlarini yangi bazaga ko'chiradi (Firebase'ga hech narsa yozmaydi) |
| `npm run lint` | TypeScript tekshiruvi |

## Birinchi admin

Server birinchi marta ishga tushganda admin hisobini yaratadi va parolni
`server/data/BIRINCHI_ADMIN.txt` fayliga yozadi. Kirgandan keyin **Sozlamalar → Parolni o'zgartirish**
qiling va bu faylni o'chiring. Boshqa shifokorlarni Sozlamalar → Xodimlar bo'limidan qo'shasiz.

## Sozlamalar (`server/.env`)

`server/.env.example` faylini `server/.env` nomi bilan nusxalang:

- `GEMINI_API_KEY` — AI yordamchi va maslahatlar uchun (bo'sh bo'lsa AI o'chiq).
- `TELEGRAM_BOT_TOKEN` — @BotFather'dan olingan bot tokeni. Bemorlar ilovadagi
  «Telegram eslatmalarini yoqish» tugmasi bilan ulanadi va dori vaqtida eslatma oladi (ilova yopiq bo'lsa ham).

## Zaxira nusxa

Barcha ma'lumotlar `server/data/` papkasida. Shu papkani muntazam nusxalab qo'ying.
Ko'chirilgan bemorlar birinchi kirishda yangi 6 xonali PIN o'ylab topadi (eski PIN'larni Firebase bermaydi).

## Demo (hackathon / taqdimot uchun)

Desktop'dagi **`BIGUS-DEMO.bat`** — alohida demo bazada ishga tushadi (`server/data-demo/`), haqiqiy bazaga tegmaydi.
Har ishga tushganda demo ma'lumotlar bugungi sanaga moslab qayta yaratiladi (12 bemor, 3 haftalik tarix, xabarlar, buyurtmalar).

- Sayt: `http://localhost:4100`, admin: `http://localhost:4100/#/admin`
- Admin: `demo@bigus.uz` / `Demo2026` · Shifokor: `shifokor@bigus.uz` / `Shifokor2026`
- Demo bemor: **Karimov Aziz Botirovich**, 15.01.1980, PIN `123456` (barcha demo bemorlar PIN'i 123456)

Buyruqlar: `npm run demo:seed` (demo bazani qayta yaratish), `npm run demo` (port 4100).

