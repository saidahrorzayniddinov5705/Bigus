import React from 'react';

export function LoadingSpinner({ fullScreen = true }: { fullScreen?: boolean }) {
  const containerClasses = fullScreen 
    ? "flex items-center justify-center min-h-screen bg-[#F2F2F7] dark:bg-[#020617]" 
    : "flex items-center justify-center w-full h-full p-8";

  return (
    <div className={containerClasses}>
      <div className="relative">
        <div className="w-16 h-16 border-4 border-blue-500/20 rounded-full"></div>
        <div className="w-16 h-16 border-4 border-transparent border-t-blue-500 border-r-cyan-500 rounded-full animate-spin absolute inset-0"></div>
      </div>
    </div>
  );
}
