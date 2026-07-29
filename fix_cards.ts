import * as fs from 'fs';
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

// Replace card bg and shadow
// Card type 1: p-5 bg-white/40 ... rounded-[24px]
code = code.replace(/p-5 bg-white\/40 dark:bg-white\/5 backdrop-blur-sm rounded-\[24px\] border border-white\/60 dark:border-white\/10 hover:bg-white\/70 dark:hover:bg-white\/10 transition-all duration-500 ease-\[cubic-bezier\(0\.22,1,0\.36,1\)\] cursor-default shadow-sm hover:shadow-md/g,
  "p-5 bg-white dark:bg-[#1C1C1E] rounded-[24px] border border-black/5 dark:border-white/5 hover:scale-[1.01] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-default shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)]");

// Card type 2 (Chart): h-[400px] w-full bg-white/50 ... rounded-[24px]
code = code.replace(/h-\[400px\] w-full bg-white\/50 dark:bg-white\/5 rounded-\[24px\] p-6 shadow-inner border border-white\/60 dark:border-white\/10 backdrop-blur-sm/g,
  "h-[400px] w-full bg-white dark:bg-[#1C1C1E] rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-black/5 dark:border-white/5");

// Card type 3 (List Item / Add Button container): p-4 bg-white/40 dark:bg-white/5 rounded-[20px]
code = code.replace(/p-4 bg-white\/40 dark:bg-white\/5 rounded-\[20px\] w-fit mb-5 shadow-sm border border-white\/60 dark:border-white\/10 backdrop-blur-md/g,
  "p-4 bg-white dark:bg-[#1C1C1E] rounded-[20px] w-fit mb-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-black/5 dark:border-white/5");

code = code.replace(/p-4 bg-white\/50 dark:bg-white\/10 backdrop-blur-md rounded-\[20px\] border border-white\/60 dark:border-white\/10 shadow-inner/g,
  "p-4 bg-white dark:bg-[#1C1C1E] rounded-[20px] border border-black/5 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)]");

// Card type 4 (Health Tips horizontal card): w-full md:w-auto flex flex-col sm:flex-row items-center gap-3 md:gap-4 bg-white/40 dark:bg-white/5 p-3 md:p-4 rounded-[20px] md:rounded-[24px] border border-white/60 dark:border-white/10 shadow-inner backdrop-blur-md
code = code.replace(/w-full md:w-auto flex flex-col sm:flex-row items-center gap-3 md:gap-4 bg-white\/40 dark:bg-white\/5 p-3 md:p-4 rounded-\[20px\] md:rounded-\[24px\] border border-white\/60 dark:border-white\/10 shadow-inner backdrop-blur-md/g,
  "w-full md:w-auto flex flex-col sm:flex-row items-center gap-3 md:gap-4 bg-white dark:bg-[#1C1C1E] p-3 md:p-4 rounded-[20px] md:rounded-[24px] border border-black/5 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)]");

// Modal cards
code = code.replace(/bg-white\/70 dark:bg-\[#060b19\]\/60 backdrop-blur-3xl p-10 rounded-\[48px\] border border-white\/60 dark:border-white\/10 shadow-\[0_24px_64px_rgba\(0,0,0,0\.1\)\] dark:shadow-\[0_24px_64px_rgba\(0,0,0,0\.6\)\]/g,
  "bg-white dark:bg-[#1C1C1E] p-10 rounded-[48px] border border-black/5 dark:border-white/5 shadow-[0_24px_64px_rgba(0,0,0,0.1)] dark:shadow-[0_32px_80px_rgba(0,0,0,0.8)]");

// Fix dropdown menus
code = code.replace(/bg-white\/90 dark:bg-\[#060b19\]\/90 backdrop-blur-3xl border border-black\/5 dark:border-white\/10 rounded-2xl shadow-\[0_16px_40px_rgba\(0,0,0,0\.15\)\]/g,
  "bg-white/90 dark:bg-[#2C2C2E]/90 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.15)]");


// Input fields in settings etc:
code = code.replace(/bg-white dark:bg-white\/5 border border-black\/5 dark:border-white\/10 rounded-\[20px\] outline-none focus:bg-white\/80 dark:focus:bg-white\/10 focus:ring-4 focus:ring-cyan-500\/20 focus:border-cyan-500\/50/g,
  "bg-zinc-100 dark:bg-[#2C2C2E] border border-transparent dark:border-transparent rounded-[20px] outline-none focus:bg-white dark:focus:bg-[#3A3A3C] focus:ring-4 focus:ring-cyan-500/20 focus:border-cyan-500/50");

fs.writeFileSync('src/components/Dashboard.tsx', code);
console.log('Cards updated with iOS solid colors and drop shadows');
