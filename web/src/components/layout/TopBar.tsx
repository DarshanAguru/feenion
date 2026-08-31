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
} from 'lucide-react';

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

  return (
    <header className="h-14 bg-[#090d16] border-b border-[#1e2330] px-4 flex items-center justify-between gap-3 select-none z-10">
      {/* Left Area: Project & Environment Pickers */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Project Selector */}
        <div className="flex items-center gap-1.5 bg-[#0d111a] border border-[#1e2330] rounded-lg px-2.5 py-1 text-xs">
          <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="text-[10px] text-slate-400 font-mono uppercase">Workspace:</span>
          <select
            value={selectedProject}
            onChange={(e) => {
              if (e.target.value === '__new__') {
                setIsCreatingProject(true);
              } else {
                onSelectProject(e.target.value);
              }
            }}
            className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id} className="bg-[#0d111a] text-slate-200">
                {p.name}
              </option>
            ))}
            <option value="__new__" className="bg-[#0d111a] text-indigo-400 font-bold">
              + New Project
            </option>
          </select>
        </div>

        {/* Environment Selector */}
        <div className="flex items-center gap-1.5 bg-[#0d111a] border border-[#1e2330] rounded-lg px-2.5 py-1 text-xs">
          <span className="text-[10px] text-slate-400 font-mono uppercase">Env:</span>
          <select
            value={environment}
            onChange={(e) => onSelectEnvironment(e.target.value)}
            className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer"
          >
            <option value="production" className="bg-[#0d111a]">production</option>
            <option value="staging" className="bg-[#0d111a]">staging</option>
            <option value="development" className="bg-[#0d111a]">development</option>
            <option value="all" className="bg-[#0d111a]">all environments</option>
          </select>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-1.5 bg-[#0d111a] border border-[#1e2330] rounded-lg px-2.5 py-1 text-xs">
          <select
            value={timeRange}
            onChange={(e) => onSelectTimeRange(e.target.value)}
            className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer"
          >
            <option value="15m" className="bg-[#0d111a]">Last 15 minutes</option>
            <option value="1h" className="bg-[#0d111a]">Last 1 hour</option>
            <option value="6h" className="bg-[#0d111a]">Last 6 hours</option>
            <option value="24h" className="bg-[#0d111a]">Last 24 hours</option>
            <option value="7d" className="bg-[#0d111a]">Last 7 days</option>
            <option value="30d" className="bg-[#0d111a]">Last 30 days</option>
            <option value="all" className="bg-[#0d111a]">All time</option>
          </select>
        </div>
      </div>

      {/* Center Search Bar Launcher */}
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

      {/* Right Controls: Live Stream Status, Refresh, Shortcuts */}
      <div className="flex items-center gap-2">
        {/* Live Stream Status Pill */}
        <div className="flex items-center gap-1.5 bg-[#0d111a] border border-[#1e2330] rounded-lg p-0.5">
          <button
            onClick={onToggleFeedPause}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
              isFeedPaused
                ? 'bg-amber-950/60 text-amber-300 border border-amber-800'
                : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
            }`}
            title={isFeedPaused ? 'Click to resume live updates' : 'Click to pause stream'}
          >
            {isFeedPaused ? (
              <>
                <Pause className="w-3 h-3 text-amber-400" />
                <span>Paused {bufferedCount > 0 ? `(${bufferedCount})` : ''}</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Live</span>
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

        {/* Shortcuts Help */}
        <button
          onClick={onOpenShortcuts}
          className="p-1.5 rounded-lg bg-[#0d111a] border border-[#1e2330] text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
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

