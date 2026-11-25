// Starts BIGUS on the separate DEMO database (server/data-demo), port 4100.
// Create / reset the demo data first with:  npm run demo:seed
import path from 'node:path';
import fs from 'node:fs';

const DEMO_DIR = path.join(import.meta.dirname, 'data-demo');
if (!fs.existsSync(path.join(DEMO_DIR, 'bigus.db'))) {
  console.error('Demo baza topilmadi. Avval: npm run demo:seed');
  process.exit(1);
}
process.env.BIGUS_DATA_DIR = DEMO_DIR;
process.env.PORT = process.env.DEMO_PORT || '4100';
// The demo must not share the clinic's Telegram bot with the real server.
process.env.TELEGRAM_BOT_TOKEN = '';
await import('./index.ts');
