import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, Plus } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  dotColor?: string;
}

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  labelPrefix?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  searchable?: boolean;
  actionItem?: {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  };
  align?: 'left' | 'right';
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  disabled?: boolean;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  value,
  onChange,
  options,
  labelPrefix,
  placeholder = 'Select...',
  icon,
  searchable = false,
  actionItem,
  align = 'left',
  className = '',
  triggerClassName = '',
  menuClassName = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(o => o.value === value);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key & focus search when opened
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      if (searchable && searchInputRef.current) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    } else {
      setSearchQuery('');
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, searchable]);

  const filteredOptions = searchable && searchQuery.trim()
    ? options.filter(o =>
        o.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : options;

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0d111a] hover:bg-[#121724] border ${
          isOpen
            ? 'border-indigo-500/80 ring-1 ring-indigo-500/30 bg-[#121724]'
            : 'border-[#1e2330] hover:border-slate-600'
        } text-xs font-mono text-slate-200 transition-all select-none shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${triggerClassName}`}
      >
        {icon && <span className="text-indigo-400 shrink-0">{icon}</span>}
        
        {labelPrefix && (
          <span className="text-[10px] text-slate-400 uppercase font-semibold hidden sm:inline">
            {labelPrefix}
          </span>
        )}

        {selectedOption?.dotColor && (
          <span className={`w-2 h-2 rounded-full ${selectedOption.dotColor} shrink-0`} />
        )}

        <span className="truncate max-w-[130px] sm:max-w-[180px] font-medium text-slate-100">
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ml-0.5 ${
            isOpen ? 'rotate-180 text-indigo-400' : ''
          }`}
        />
      </button>

      {/* Floating Menu Popover */}
      {isOpen && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 w-60 sm:w-64 max-w-[90vw] rounded-xl bg-[#0b0f19] border border-indigo-500/30 shadow-2xl shadow-black/90 backdrop-blur-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-1.5 space-y-1 ${menuClassName}`}
        >
          {/* Optional Search Box */}
          {searchable && (
            <div className="p-1 mb-1 border-b border-[#1e2330]">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search options..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-2 py-1 rounded bg-[#070a10] border border-slate-800 text-[11px] font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Options Scroll Container */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5 no-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all text-left group ${
                      isSelected
                        ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {opt.dotColor && (
                        <span className={`w-2 h-2 rounded-full ${opt.dotColor} shrink-0`} />
                      )}
                      {opt.icon && (
                        <span className={`shrink-0 ${isSelected ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
                          {opt.icon}
                        </span>
                      )}
                      <div className="truncate">
                        <div className="truncate text-slate-200 group-hover:text-white">{opt.label}</div>
                        {opt.sublabel && (
                          <div className="text-[10px] text-slate-400 font-sans truncate">{opt.sublabel}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {opt.badge && (
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono ${opt.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-3 text-center text-xs text-slate-400 font-mono">
                No matches found
              </div>
            )}
          </div>

          {/* Action Item (e.g. + New Workspace) */}
          {actionItem && (
            <div className="pt-1 border-t border-[#1e2330]">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  actionItem.onClick();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40 border border-indigo-900/40 hover:border-indigo-700/60 transition-colors"
              >
                {actionItem.icon || <Plus className="w-3.5 h-3.5" />}
                <span>{actionItem.label}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

