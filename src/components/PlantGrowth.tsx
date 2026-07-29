import React from 'react';
import { motion } from 'motion/react';

interface PlantGrowthProps {
  progress: number; // 0 to 1
  className?: string;
}

export const PlantGrowth: React.FC<PlantGrowthProps> = ({ progress, className }) => {
  // Safe limit
  const p = Math.max(0, Math.min(1, progress || 0));
  
  // Stem path
  // Start at 50,80. Curve left slightly to 35,50 then back right to 50,20
  const stemPath = "M 50 80 Q 35 50 50 20";
  
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 100 120" className="w-full h-full overflow-visible">
        {/* Pot shadow */}
        <ellipse cx="50" cy="102" rx="20" ry="3" fill="rgba(0,0,0,0.2)" className="dark:fill-black/40" />
        
        {/* Pot */}
        <path d="M 35 100 L 65 100 L 70 80 L 30 80 Z" fill="#78350f" className="dark:fill-[#451a03]" stroke="#451a03" strokeWidth="1" />
        {/* Pot brim */}
        <rect x="28" y="76" width="44" height="4" rx="2" fill="#92400e" className="dark:fill-[#78350f]" />
        
        {/* Dirt */}
        <ellipse cx="50" cy="76" rx="20" ry="2" fill="#3f271d" className="dark:fill-[#1c120c]" />

        {/* Stem */}
        {p > 0 && (
          <motion.path
            d={stemPath}
            stroke="#22c55e"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: p }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        )}
        
        {/* Leaf 1 (bottom right) */}
        {p > 0.15 && (
          <motion.path
            d="M 46 70 Q 65 60 70 75 Q 60 80 46 70"
            fill="#16a34a"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: Math.min(1, (p - 0.15) * 2), opacity: 1 }}
            style={{ transformOrigin: '46px 70px' }}
            transition={{ duration: 0.6, ease: "backOut" }}
          />
        )}

        {/* Leaf 2 (middle left) */}
        {p > 0.35 && (
          <motion.path
            d="M 42 55 Q 20 45 15 55 Q 25 65 42 55"
            fill="#22c55e"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: Math.min(1, (p - 0.35) * 2), opacity: 1 }}
            style={{ transformOrigin: '42px 55px' }}
            transition={{ duration: 0.6, ease: "backOut" }}
          />
        )}

        {/* Leaf 3 (top right) */}
        {p > 0.6 && (
          <motion.path
            d="M 46 40 Q 65 25 75 35 Q 60 45 46 40"
            fill="#4ade80"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: Math.min(1, (p - 0.6) * 2), opacity: 1 }}
            style={{ transformOrigin: '46px 40px' }}
            transition={{ duration: 0.6, ease: "backOut" }}
          />
        )}
        
        {/* Flower / Bud */}
        {p > 0.8 && (
          <motion.g
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: Math.min(1, (p - 0.8) * 5), opacity: 1 }}
            className="origin-center"
            style={{ transformOrigin: '50px 20px' }}
            transition={{ duration: 0.6, ease: "backOut" }}
          >
            {/* Flower Petals */}
            <circle cx="50" cy="12" r="6" fill="#f43f5e" /> {/* Top */}
            <circle cx="57" cy="17" r="6" fill="#f43f5e" /> {/* Right */}
            <circle cx="55" cy="25" r="6" fill="#f43f5e" /> {/* Bottom Right */}
            <circle cx="45" cy="25" r="6" fill="#f43f5e" /> {/* Bottom Left */}
            <circle cx="43" cy="17" r="6" fill="#f43f5e" /> {/* Left */}
            <circle cx="50" cy="20" r="5" fill="#fcd34d" /> {/* Center */}
          </motion.g>
        )}
      </svg>
    </div>
  );
};
