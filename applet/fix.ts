import * as fs from 'fs';
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

// Fix the corrupted transition- duration-...
code = code.replace(/transition- duration-500 ease-\[cubic-bezier\(0\.22,1,0\.36,1\)\]/g, 'transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]');

fs.writeFileSync('src/components/Dashboard.tsx', code);
console.log('Fixed corrupted transitions');
