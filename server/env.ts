// Loaded first by server/index.ts: reads server/.env and fixes the timezone,
// so "today" on the server is the same calendar day as for patients in Uzbekistan.
import fs from 'node:fs';
import path from 'node:path';

const envFile = path.join(import.meta.dirname, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
process.env.TZ = process.env.BIGUS_TZ || 'Asia/Tashkent';
