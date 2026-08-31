import React from 'react';
import { X, Command, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: '⌘K / Ctrl+K', desc: 'Open Global Command & Search Palette' },
    { key: 'P', desc: 'Toggle Live Telemetry Stream Pause / Resume' },
    { key: '?', desc: 'Open Keyboard Shortcuts Help' },
    { key: 'ESC', desc: 'Close open modal, drawer, or search palette' },
    { key: 'Tab', desc: 'Focus next interactive element' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0d111a] border border-[#1e2330] rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1e2330] bg-[#090d16] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-mono font-bold uppercase text-slate-200">
              Keyboard Shortcuts
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2.5">
          {shortcuts.map(s => (
            <div
              key={s.key}
              className="flex items-center justify-between p-2.5 rounded-lg bg-[#080b11] border border-[#1e2330]"
            >
              <span className="text-xs text-slate-300 font-sans">{s.desc}</span>
              <kbd className="px-2 py-1 rounded bg-[#0d111a] border border-slate-700 text-indigo-300 text-xs font-mono font-semibold">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="px-4 py-2.5 bg-[#090d16] border-t border-[#1e2330] flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

