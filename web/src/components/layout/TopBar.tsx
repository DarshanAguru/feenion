import React, { useState } from 'react';
import { ProjectInfo } from '../../types';
import {
  Search,
  Activity,
  Play,
  Pause,
  RefreshCw,
  HelpCircle,
  FolderPlus,
  Radio,
  ChevronDown,
  Layers,
  Menu,
} from 'lucide-react';

import { CustomDropdown, DropdownOption } from '../common/CustomDropdown';

interface TopBarProps {
  projects: ProjectInfo[];
  selectedProject: string;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (name: string) => void;
  environment: string;
  onSelectEnvironment: (env: string) => void;
  timeRange: string;
  onSelectTimeRange: (range: string) => void;
  isFeedPaused: boolean;
  onToggleFeedPause: () => void;
  bufferedCount: number;
  onManualRefresh: () => void;
  wsConnected: boolean;
  onOpenCommandPalette: () => void;
  onOpenShortcuts: () => void;
  onToggleMobileMenu?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  projects,
  selectedProject,
  onSelectProject,
  onCreateProject,
  environment,
  onSelectEnvironment,
  timeRange,
  onSelectTimeRange,
  isFeedPaused,
  onToggleFeedPause,
  bufferedCount,
  onManualRefresh,
  wsConnected,
  onOpenCommandPalette,
  onOpenShortcuts,
  onToggleMobileMenu,
}) => {
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim());
      setNewProjectName('');
      setIsCreatingProject(false);
    }
  };

  const activeProjectValue = projects.find(p => p.id === selectedProject || p.name === selectedProject)?.id || selectedProject;

  const projectOptions: DropdownOption[] = projects.map(p => ({
    value: p.id,
    label: p.name,
    sublabel: p.id.length > 20 ? `${p.id.slice(0, 8)}...` : undefined,
    icon: <Layers className="w-3.5 h-3.5" />,
    badge: (p.id === activeProjectValue || p.name === activeProjectValue) ? 'Active' : undefined,
    badgeColor: 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80',
  }));

  const environmentOptions: DropdownOption[] = [
    { value: 'production', label: 'Production', dotColor: 'bg-emerald-400' },
    { value: 'staging', label: 'Staging', dotColor: 'bg-amber-400' },
    { value: 'development', label: 'Development', dotColor: 'bg-cyan-400' },
    { value: 'all', label: 'All Environments', dotColor: 'bg-slate-400' },
  ];

  const timeRangeOptions: DropdownOption[] = [
    { value: '15m', label: 'Last 15m', sublabel: 'Past 15 minutes' },
    { value: '1h', label: 'Last 1h', sublabel: 'Past 1 hour' },
    { value: '6h', label: 'Last 6h', sublabel: 'Past 6 hours' },
    { value: '24h', label: 'Last 24h', sublabel: 'Past 24 hours' },
    { value: '7d', label: 'Last 7d', sublabel: 'Past 7 days' },
    { value: '30d', label: 'Last 30d', sublabel: 'Past 30 days' },
    { value: 'all', label: 'All Time', sublabel: 'Full history' },
  ];

  return (
    <header className="min-h-14 bg-[#090d16] border-b border-[#1e2330] px-3 sm:px-4 py-2 sm:py-0 flex items-center justify-between gap-2 select-none z-20">
      {/* Left Area: Mobile Hamburger + Custom Pickers */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
        {/* Mobile Hamburger Drawer Trigger */}
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 md:hidden shrink-0 border border-slate-800"
          aria-label="Open navigation menu"
          title="Open Navigation Menu"
        >
          <Menu className="w-4 h-4 text-indigo-400" />
        </button>

        {/* Workspace Custom Dropdown */}
        <CustomDropdown
          value={activeProjectValue}
          onChange={onSelectProject}
          options={projectOptions}
          labelPrefix="Workspace:"
          icon={<Layers className="w-3.5 h-3.5" />}
          searchable={projects.length > 2}
          actionItem={{
            label: '+ Create New Workspace',
            onClick: () => setIsCreatingProject(true),
          }}
        />

        {/* Environment Custom Dropdown */}
        <CustomDropdown
          value={environment}
          onChange={onSelectEnvironment}
          options={environmentOptions}
          labelPrefix="Env:"
        />

        {/* Time Range Custom Dropdown */}
        <CustomDropdown
          value={timeRange}
          onChange={onSelectTimeRange}
          options={timeRangeOptions}
        />
      </div>

      {/* Center Search Bar Launcher (Desktop) */}
      <div className="flex-1 max-w-md hidden md:block">
        <button
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#0d111a] border border-[#1e2330] hover:border-slate-600 text-slate-400 text-xs transition-colors group cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200" />
            <span className="truncate">Search traces, errors, models, tools...</span>
          </div>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-300">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Controls: Search icon on mobile, Live Stream Status, Refresh */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Mobile Search Button */}
        <button
          onClick={onOpenCommandPalette}
          className="p-1.5 rounded-lg bg-[#0d111a] border border-[#1e2330] text-slate-300 hover:text-white md:hidden shrink-0"
          title="Search"
          aria-label="Search command palette"
        >
          <Search className="w-3.5 h-3.5 text-indigo-400" />
        </button>

        {/* Live Stream Status Pill */}
        <div className="flex items-center gap-1 bg-[#0d111a] border border-[#1e2330] rounded-lg p-0.5">
          <button
            onClick={onToggleFeedPause}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono font-medium transition-colors ${
              isFeedPaused
                ? 'bg-amber-950/60 text-amber-300 border border-amber-800'
                : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
            }`}
            title={isFeedPaused ? 'Click to resume live updates' : 'Click to pause stream'}
          >
            {isFeedPaused ? (
              <>
                <Pause className="w-2.5 h-2.5 text-amber-400" />
                <span className="hidden xs:inline">Paused</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="hidden xs:inline">Live</span>
              </>
            )}
          </button>

          <button
            onClick={onManualRefresh}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Refresh dashboard data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Shortcuts Help (Hidden on very small mobile) */}
        <button
          onClick={onOpenShortcuts}
          className="p-1.5 rounded-lg bg-[#0d111a] border border-[#1e2330] text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors hidden sm:block"
          title="Keyboard shortcuts (?)"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* New Project Modal */}
      {isCreatingProject && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSubmit}
            className="bg-[#0d111a] border border-[#1e2330] rounded-xl p-5 w-full max-w-sm shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
              <FolderPlus className="w-4 h-4 text-indigo-400" />
              <span>Create New Project</span>
            </div>

            <div>
              <label className="text-[11px] font-mono uppercase text-slate-400 block mb-1">
                Project Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. support-rag-agent"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="w-full bg-[#080b11] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreatingProject(false)}
                className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
              >
                Create Project
              </button>
            </div>
          </form>
        </div>
      )}
    </header>
  );
};

