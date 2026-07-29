import * as fs from 'fs';
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

code = code.replace(/text-slate-900/g, 'text-black');
code = code.replace(/text-slate-([0-9]+)/g, 'text-zinc-$1');
code = code.replace(/bg-slate-50\b/g, 'bg-[#F2F2F7]');
code = code.replace(/bg-slate-100\b/g, 'bg-white');
code = code.replace(/bg-slate-200\b/g, 'bg-zinc-100');
code = code.replace(/bg-slate-([0-9]+)/g, 'bg-zinc-$1');
code = code.replace(/border-slate-200\b/g, 'border-black/5');
code = code.replace(/border-slate-([0-9]+)/g, 'border-zinc-$1');

// Ensure crisp tracking for iOS style
code = code.replace(/text-3xl /g, 'text-3xl tracking-tight ');
code = code.replace(/text-4xl /g, 'text-4xl tracking-tight ');
code = code.replace(/text-2xl /g, 'text-2xl tracking-tight ');

fs.writeFileSync('src/components/Dashboard.tsx', code);
console.log('Fixed iOS colors and typography');
