import React from 'react';
import { NavigationTab } from '../../types';
import {
  LayoutDashboard,
  Layers,
  AlertOctagon,
  Sparkles,
  Bot,
  Search,
  Wrench,
  Gauge,
  Coins,
  ShieldAlert,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { FeenionIcon, FeenionLogo } from '../common/FeenionLogo';
import { X } from 'lucide-react';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  errorCount?: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  errorCount = 0,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const navItems: Array<{
    id: NavigationTab;
    label: string;
    icon: React.ReactNode;
    badge?: string | number;
    badgeColor?: string;
  }> = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'traces',
      label: 'Traces',
      icon: <Layers className="w-4 h-4" />,
    },
    {
      id: 'errors',
      label: 'Errors',
      icon: <AlertOctagon className="w-4 h-4" />,
      badge: errorCount > 0 ? errorCount : undefined,
      badgeColor: 'bg-rose-950 text-rose-300 border border-rose-800',
    },
    {
      id: 'llm',
      label: 'LLM Analytics',
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      id: 'agents',
      label: 'Agents',
      icon: <Bot className="w-4 h-4" />,
    },
    {
      id: 'retrieval',
      label: 'Retrieval',
      icon: <Search className="w-4 h-4" />,
    },
    {
      id: 'tools',
      label: 'Tools',
      icon: <Wrench className="w-4 h-4" />,
    },
    {
      id: 'performance',
      label: 'Performance',
      icon: <Gauge className="w-4 h-4" />,
    },
    {
      id: 'costs',
      label: 'Costs',
      icon: <Coins className="w-4 h-4" />,
    },
  ];

  const bottomNavItems: Array<{
    id: NavigationTab;
    label: string;
    icon: React.ReactNode;
    badge?: string;
    badgeColor?: string;
  }> = [
    {
      id: 'incident',
      label: 'Incident Mode',
      icon: <ShieldAlert className="w-4 h-4 text-amber-400" />,
      badge: 'LIVE',
      badgeColor: 'bg-amber-950 text-amber-300 border border-amber-800',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  return (
    <>
      {/* 1. Mobile Drawer Backdrop & Sliding Sheet */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
          onClick={onCloseMobile}
        >
          <aside
            className="fixed left-0 top-0 bottom-0 z-50 w-64 bg-[#090d16] border-r border-[#1e2330] flex flex-col shadow-2xl animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Header */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-[#1e2330]">
              <FeenionLogo iconSize={26} />
              <button
                onClick={onCloseMobile}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Nav Links */}
            <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
              {navItems.map(item => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectTab(item.id);
                      onCloseMobile?.();
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/40 font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <div className={isActive ? 'text-indigo-400' : 'text-slate-400'}>
                      {item.icon}
                    </div>
                    <div className="flex-1 flex items-center justify-between text-left">
                      <span>{item.label}</span>
                      {item.badge !== undefined && (
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${item.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* Mobile Bottom Items */}
            <div className="p-3 border-t border-[#1e2330] space-y-1">
              {bottomNavItems.map(item => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectTab(item.id);
                      onCloseMobile?.();
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/40 font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <div className={isActive ? 'text-indigo-400' : 'text-slate-400'}>
                      {item.icon}
                    </div>
                    <div className="flex-1 flex items-center justify-between text-left">
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${item.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Mobile Footer */}
            <div className="px-3 py-2.5 border-t border-slate-800/40 text-[10px] text-slate-500 font-mono text-center">
              <div>copyright &copy; {new Date().getFullYear()} feenion</div>
              <div className="mt-0.5">
                made with <span className="inline-block text-rose-500">❤️</span> by A.Darshan
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* 2. Desktop Responsive Rail */}
      <aside
        className={`hidden md:flex flex-col h-full bg-[#090d16] border-r border-[#1e2330] transition-all duration-200 select-none z-20 shrink-0 ${
          isCollapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-3.5 h-14 border-b border-[#1e2330]">
          {!isCollapsed ? (
            <FeenionLogo iconSize={28} />
          ) : (
            <div className="mx-auto">
              <FeenionIcon size={28} />
            </div>
          )}

          <button
            onClick={onToggleCollapse}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors ml-1"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Main Navigation Items */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
                title={isCollapsed ? item.label : undefined}
              >
                <div className={`${isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
                  {item.icon}
                </div>

                {!isCollapsed && (
                  <div className="flex-1 flex items-center justify-between">
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${item.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-2 border-t border-[#1e2330] space-y-1">
          {bottomNavItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
                title={isCollapsed ? item.label : undefined}
              >
                <div className={`${isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
                  {item.icon}
                </div>

                {!isCollapsed && (
                  <div className="flex-1 flex items-center justify-between">
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${item.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer Attribution */}
        {!isCollapsed && (
          <div className="px-3 py-2 border-t border-slate-800/40 text-[10px] text-slate-500 font-mono text-center">
            <div>copyright &copy; {new Date().getFullYear()} feenion</div>
            <div className="mt-0.5">
              made with <span className="inline-block text-rose-500 animate-pulse">❤️</span> by{' '}
              <a
                href="https://thisdarshiii.in"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-2 transition-colors"
              >
                A.Darshan
              </a>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

