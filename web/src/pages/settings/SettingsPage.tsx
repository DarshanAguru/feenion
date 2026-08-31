import React, { useState } from 'react';
import { ProjectInfo } from '../../types';
import { apiClient } from '../../api/client';
import { Settings, Shield, Trash2, Key, Database, RefreshCw, Check, Copy, AlertTriangle, X } from 'lucide-react';

interface SettingsPageProps {
  projects: ProjectInfo[];
  selectedProject: string;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (name: string) => void;
  onDeleteProject: (projectId: string) => Promise<void>;
  onRefreshData: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  projects,
  selectedProject,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onRefreshData,
}) => {
  const [newProjectName, setNewProjectName] = useState('');
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Project Delete Modal State
  const [projectToDelete, setProjectToDelete] = useState<ProjectInfo | null>(null);
  const [projectDeleteConfirmText, setProjectDeleteConfirmText] = useState('');
  const [projectDeleteStatus, setProjectDeleteStatus] = useState<string | null>(null);

  // Purge Modal State
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState('');
  const [purgeStatus, setPurgeStatus] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      const res = await apiClient.createProject(newProjectName.trim());
      onCreateProject(newProjectName.trim());
      setCreatedApiKey(res.api_key);
      setNewProjectName('');
    } catch (err: any) {
      alert(err.message || 'Failed to create project');
    }
  };

  const handleConfirmDeleteProject = async () => {
    if (!projectToDelete) return;
    if (projectDeleteConfirmText.trim().toLowerCase() !== 'delete workspace') return;
    try {
      setProjectDeleteStatus(`Deleting workspace '${projectToDelete.name}' and all its traces...`);
      await onDeleteProject(projectToDelete.id);
      setProjectDeleteStatus('Workspace deleted.');
      setTimeout(() => {
        setProjectToDelete(null);
        setProjectDeleteConfirmText('');
        setProjectDeleteStatus(null);
      }, 500);
    } catch (err: any) {
      setProjectDeleteStatus(`Error: ${err.message || 'Failed to delete workspace'}`);
    }
  };

  const handlePurge = async () => {
    if (purgeConfirmText.trim().toLowerCase() !== 'delete everything') return;
    try {
      setPurgeStatus('Purging all telemetry data...');
      await apiClient.clearTelemetry(purgeConfirmText.trim());
      setPurgeStatus('All telemetry successfully purged.');
      setTimeout(() => {
        setIsPurgeModalOpen(false);
        setPurgeStatus(null);
        setPurgeConfirmText('');
        onRefreshData();
      }, 1000);
    } catch (err: any) {
      setPurgeStatus(`Error: ${err.message}`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-[#080b11] max-w-4xl">
      <div>
        <h2 className="text-base font-mono font-bold text-slate-100 uppercase tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-400" />
          Settings & Project Administration
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Manage workspaces, generate API ingestion keys, delete projects, review server status, and configure telemetry retention.
        </p>
      </div>

      {/* Projects & API Keys */}
      <div className="rounded-xl bg-[#0d111a] border border-[#1e2330] p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2 text-slate-200 text-xs font-mono font-bold">
          <Key className="w-4 h-4 text-indigo-400" />
          <span>Workspaces & API Keys</span>
        </div>

        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            placeholder="New Workspace Name..."
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            className="flex-1 bg-[#080b11] border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
          >
            Create Workspace
          </button>
        </form>

        {createdApiKey && (
          <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-indigo-300 font-bold">Workspace Created! Ingestion API Key:</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(createdApiKey);
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 2000);
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-mono hover:text-white"
              >
                {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                {copiedKey ? 'Copied' : 'Copy'}
              </button>
            </div>
            <code className="text-xs font-mono text-slate-200 break-all select-all block bg-[#080b11] p-2 rounded border border-slate-800">
              {createdApiKey}
            </code>
          </div>
        )}

        <div className="space-y-1.5 pt-2">
          <span className="text-[11px] font-mono uppercase text-slate-400 block mb-1">Existing Workspaces</span>
          {projects.map(p => (
            <div
              key={p.id}
              onClick={() => onSelectProject(p.id)}
              className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-mono cursor-pointer transition-colors ${
                selectedProject === p.id
                  ? 'bg-indigo-950/40 border-indigo-500/80 text-white'
                  : 'bg-[#080b11] border-[#1e2330] text-slate-300 hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-bold truncate">{p.name}</span>
                {selectedProject === p.id && (
                  <span className="px-1.5 py-0.2 rounded bg-indigo-600 text-white text-[9px] font-bold">
                    Active
                  </span>
                )}
                <span className="text-[10px] text-slate-500">ID: {p.id.slice(0, 8)}...</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={projects.length <= 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    setProjectToDelete(p);
                    setProjectDeleteConfirmText('');
                    setProjectDeleteStatus(null);
                  }}
                  className={`p-1.5 rounded-md text-xs transition-colors flex items-center gap-1 ${
                    projects.length <= 1
                      ? 'opacity-30 text-slate-600 cursor-not-allowed'
                      : 'text-rose-400 hover:text-rose-200 hover:bg-rose-950/60 border border-transparent hover:border-rose-800/60'
                  }`}
                  title={projects.length <= 1 ? "Cannot delete the only remaining workspace" : `Delete workspace '${p.name}'`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="text-[10px] hidden sm:inline">Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Database & Infrastructure Status */}
      <div className="rounded-xl bg-[#0d111a] border border-[#1e2330] p-5 shadow-lg space-y-3">
        <div className="flex items-center gap-2 text-slate-200 text-xs font-mono font-bold">
          <Database className="w-4 h-4 text-emerald-400" />
          <span>Server & Storage Health</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="p-3 rounded-lg bg-[#080b11] border border-[#1e2330]">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">Database Backend</span>
            <span className="text-xs font-mono text-emerald-400 font-bold mt-1 block">SQLite WAL</span>
          </div>

          <div className="p-3 rounded-lg bg-[#080b11] border border-[#1e2330]">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">Retention Policy</span>
            <span className="text-xs font-mono text-slate-200 font-bold mt-1 block">30 Days</span>
          </div>

          <div className="p-3 rounded-lg bg-[#080b11] border border-[#1e2330]">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">Ingestion Engine</span>
            <span className="text-xs font-mono text-indigo-400 font-bold mt-1 block">Async Queue Worker</span>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl bg-rose-950/20 border border-rose-900/60 p-5 shadow-lg space-y-3">
        <div className="flex items-center gap-2 text-rose-300 text-xs font-mono font-bold">
          <Trash2 className="w-4 h-4 text-rose-400" />
          <span>Danger Zone — Purge Telemetry</span>
        </div>

        <p className="text-xs text-rose-300/80">
          Permanently deletes all traces, spans, and execution logs from your database across all workspaces.
        </p>

        <button
          type="button"
          onClick={() => {
            setIsPurgeModalOpen(true);
            setPurgeConfirmText('');
            setPurgeStatus(null);
          }}
          className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Purge All Data
        </button>
      </div>

      {/* Project / Workspace Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d111a] border border-rose-900/80 rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-rose-300 font-mono font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <span>Delete Workspace: {projectToDelete.name}</span>
              </div>
              <button
                onClick={() => setProjectToDelete(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete workspace <strong className="text-white font-bold">{projectToDelete.name}</strong>?
              This will permanently delete all associated <strong className="text-rose-300">API keys, traces, spans, and metrics</strong> for this workspace.
            </p>

            <p className="text-xs text-slate-400">
              To confirm, type <strong className="text-white font-mono bg-rose-950 px-1.5 py-0.5 rounded border border-rose-800">delete workspace</strong> below:
            </p>

            <input
              type="text"
              placeholder="Type 'delete workspace' to confirm"
              value={projectDeleteConfirmText}
              onChange={(e) => setProjectDeleteConfirmText(e.target.value)}
              className="w-full bg-[#080b11] border border-rose-900 focus:border-rose-500 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none placeholder-slate-500"
              autoFocus
            />

            {projectDeleteStatus && (
              <p className="text-xs font-mono text-rose-400">{projectDeleteStatus}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={projectDeleteConfirmText.trim().toLowerCase() !== 'delete workspace'}
                onClick={handleConfirmDeleteProject}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs transition-colors"
              >
                Delete Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purge All Telemetry Modal */}
      {isPurgeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d111a] border border-rose-900/80 rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5 text-rose-300 font-mono font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <span>Confirm Purge All Telemetry</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This action is permanent and cannot be undone. To delete all traces and spans across all workspaces, type <strong className="text-white font-mono bg-rose-950 px-1.5 py-0.5 rounded border border-rose-800">delete everything</strong> below:
            </p>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Type 'delete everything' to confirm"
                value={purgeConfirmText}
                onChange={(e) => setPurgeConfirmText(e.target.value)}
                className="w-full bg-[#080b11] border border-rose-900 focus:border-rose-500 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none placeholder-slate-500"
                autoFocus
              />
            </div>

            {purgeStatus && (
              <p className="text-xs font-mono text-rose-400">{purgeStatus}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPurgeModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={purgeConfirmText.trim().toLowerCase() !== 'delete everything'}
                onClick={handlePurge}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs transition-colors"
              >
                Purge Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
