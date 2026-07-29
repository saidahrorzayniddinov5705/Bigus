import React from 'react';

export const Logo = ({ className = "w-10 h-10" }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={className}
      fill="none"
    >
      <defs>
        <linearGradient id="leafDark" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#059669" /> {/* emerald-600 */}
          <stop offset="100%" stopColor="#10B981" /> {/* emerald-500 */}
        </linearGradient>
        <linearGradient id="leafLight" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#84CC16" /> {/* lime-500 */}
          <stop offset="100%" stopColor="#A3E635" /> {/* lime-400 */}
        </linearGradient>
        <linearGradient id="pillDark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
      </defs>

      {/* Clock ticks (Blue ring) */}
      <g stroke="#0EA5E9" strokeLinecap="round">
        {/* 12 o'clock */}
        <line x1="50" y1="20" x2="50" y2="28" strokeWidth="3" />
        {/* 3 o'clock */}
        <line x1="72" y1="50" x2="80" y2="50" strokeWidth="3" />
        {/* 9 o'clock */}
        <line x1="20" y1="50" x2="28" y2="50" strokeWidth="3" />
        {/* Other thicker dashes */}
        <line x1="32" y1="32" x2="36" y2="36" strokeWidth="2.5" />
        <line x1="68" y1="32" x2="64" y2="36" strokeWidth="2.5" />
        <line x1="68" y1="68" x2="64" y2="64" strokeWidth="2.5" />
        <line x1="32" y1="68" x2="36" y2="64" strokeWidth="2.5" />
        {/* Minor ticks */}
        <line x1="41" y1="24.5" x2="43" y2="28" strokeWidth="1.5" />
        <line x1="59" y1="24.5" x2="57" y2="28" strokeWidth="1.5" />
        <line x1="75.5" y1="41" x2="72" y2="43" strokeWidth="1.5" />
        <line x1="75.5" y1="59" x2="72" y2="57" strokeWidth="1.5" />
        <line x1="24.5" y1="41" x2="28" y2="43" strokeWidth="1.5" />
        <line x1="24.5" y1="59" x2="28" y2="57" strokeWidth="1.5" />
      </g>

      {/* Pill Left Half (Dark Green) */}
      <path
        d="M 40 46 A 7 7 0 0 0 35 58 L 46 64 A 1 1 0 0 0 48 62 L 40 46 Z"
        fill="url(#pillDark)"
      />
      
      {/* Pill Right Half (Light Green) */}
      <path
        d="M 58 46 L 68 56 A 7 7 0 0 1 54 62 L 48 56 Z"
        fill="url(#leafLight)"
      />

      {/* Spilling small dots */}
      <circle cx="48" cy="65" r="1.5" fill="#10B981" />
      <circle cx="51" cy="68" r="1.2" fill="#10B981" />
      <circle cx="46" cy="67" r="1" fill="#84CC16" />
      <circle cx="53" cy="64" r="1.5" fill="#84CC16" />
      <circle cx="54" cy="67" r="2.5" fill="#A3E635" />

      {/* Leaves growing out of the pill */}
      {/* Back light green leaf */}
      <path
        d="M 46 48 C 42 38 46 38 46 38 C 50 42 46 48 46 48 Z"
        fill="url(#leafLight)"
      />
      {/* Main dark green leaf */}
      <path
        d="M 48 55 C 47 40 50 36 57 33 C 58 43 54 50 48 55 Z"
        fill="url(#leafDark)"
      />

      {/* Outlined Hand Below */}
      <path
        d="M 22 68 C 22 75 35 83 50 83 C 65 83 75 75 75 68 C 75 68 70 73 60 75 C 50 77 40 75 35 72 C 30 69 45 68 55 69 C 62 70 70 65 70 65"
        stroke="#E4E4E7" /* Works in light/dark via outline basically */
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 40 73 C 45 74 52 74 58 72"
        stroke="#E4E4E7" /* additional finger lines */
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
      {/* Ensure dark mode visibility for hands */}
      <style>
        {`
          .hand-path {
            stroke: #a1a1aa; /* text-zinc-400 */
          }
          :root.dark .hand-path {
            stroke: #3f3f46; /* text-zinc-700 */
          }
        `}
      </style>
      <path
        d="M 22 68 C 22 75 35 83 50 83 C 65 83 75 75 75 68 C 75 68 70 73 60 75 C 50 77 40 75 35 72 C 30 69 45 68 55 69 C 62 70 70 65 70 65"
        className="hand-path"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M 40 73 C 45 74 52 74 58 72"
        className="hand-path"
        strokeWidth="1"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
};
