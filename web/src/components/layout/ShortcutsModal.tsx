import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: '⌘K / /', description: 'Open Global Command Palette' },
    { key: 'g o', description: 'Go to Executive Overview' },
    { key: 'g t', description: 'Go to Trace Explorer' },
    { key: 'g e', description: 'Go to Error Intelligence' },
    { key: 'g l', description: 'Go to LLM Analytics' },
    { key: 'g a', description: 'Go to Agent Analytics' },
    { key: 'g r', description: 'Go to Retrieval Analytics' },
    { key: 'g p', description: 'Go to Performance Analytics' },
    { key: 'g c', description: 'Go to Cost Analytics' },
    { key: 'g i', description: 'Go to Incident Mode' },
    { key: 'Esc', description: 'Close active modal / panel' },
    { key: '?', description: 'Open keyboard shortcuts dialog' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0d111a] border border-[#1e2330] rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 bg-[#090d16] border-b border-[#1e2330]">
          <div className="flex items-center gap-2 text-slate-100 font-semibold text-xs">
            <Keyboard className="w-4 h-4 text-indigo-400" />
            <span>Keyboard Shortcuts</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
          {shortcuts.map(s => (
            <div key={s.key} className="flex items-center justify-between py-1 text-xs">
              <span className="text-slate-300">{s.description}</span>
              <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-slate-200">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="px-4 py-2 bg-[#090d16] border-t border-[#1e2330] text-center text-[11px] text-slate-400">
          Press <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">Esc</kbd> to close
        </div>
      </div>
    </div>
  );
};

