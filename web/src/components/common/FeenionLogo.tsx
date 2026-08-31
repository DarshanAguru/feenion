import React from 'react';

interface FeenionIconProps {
  size?: number;
  className?: string;
}

export const FeenionIcon: React.FC<FeenionIconProps> = ({ size = 28, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      <rect width="32" height="32" rx="7" fill="#090D16" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="6.5" stroke="#1E2330" />
      <path
        d="M8 7C8 6.44772 8.44772 6 9 6H12C12.5523 6 13 6.44772 13 7V25C13 25.5523 12.5523 26 12 26H9C8.44772 26 8 25.5523 8 25V7Z"
        fill="url(#feenion-comp-grad)"
      />
      <path
        d="M12 6.5H22C22.8284 6.5 23.5 7.17157 23.5 8C23.5 8.82843 22.8284 9.5 22 9.5H12V6.5Z"
        fill="url(#feenion-comp-grad)"
      />
      <path
        d="M12 14.5H18C18.8284 14.5 19.5 15.1716 19.5 16C19.5 16.8284 18.8284 17.5 18 17.5H12V14.5Z"
        fill="url(#feenion-comp-grad)"
      />
      <circle cx="23.5" cy="8" r="2" fill="#C7D2FE" />
      <circle cx="19.5" cy="16" r="1.8" fill="#A5B4FC" />
      <circle cx="10.5" cy="24" r="1.5" fill="#818CF8" />
      <defs>
        <linearGradient id="feenion-comp-grad" x1="8" y1="6" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop stop-color="#818CF8" />
          <stop offset="1" stop-color="#4F46E5" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export const FeenionLogo: React.FC<{ iconSize?: number; className?: string }> = ({
  iconSize = 28,
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <FeenionIcon size={iconSize} />
      <div className="flex flex-col">
        <span className="font-bold text-sm tracking-tight text-white font-mono leading-none">Feenion</span>
        <span className="text-[10px] text-slate-400 font-mono leading-none mt-1">AI Observability</span>
      </div>
    </div>
  );
};

