import React from 'react';

export const LoadingSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => {
  return (
    <div className="space-y-3 p-4 animate-pulse">
      <div className="h-6 bg-slate-800/60 rounded w-1/3"></div>
      <div className="space-y-2 pt-2">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="h-10 bg-slate-800/40 rounded w-full"></div>
        ))}
      </div>
    </div>
  );
};

