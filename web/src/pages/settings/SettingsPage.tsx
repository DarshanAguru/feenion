import React, { useState, useEffect } from 'react';
import { ProjectInfo } from '../../types';
import { apiClient } from '../../api/client';
import {
  SUPPORTED_CURRENCIES,
  getActiveCurrency,
  setActiveCurrency,
  fetchLiveExchangeRates,
  formatCost,
  CurrencyConfig,
} from '../../utils/formatters';
import {
  getCustomPricing,
  saveCustomPricing,
  resetPricingToDefaults,
  ModelPricingEntry,
  DEFAULT_MODEL_CATALOG,
  calculateEstimatedCost,
} from '../../utils/pricing';
import {
  Settings,
  Trash2,
  Key,
  Database,
  Check,
  Copy,
  AlertTriangle,
  X,
  Coins,
  DollarSign,
  Calculator,
  Plus,
  RotateCcw,
  Save,
  Sliders,
  RefreshCw,
} from 'lucide-react';

interface SettingsPageProps {
  projects: ProjectInfo[];
  selectedProject: string;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (name: string) => Promise<{ project: ProjectInfo; api_key: string }>;
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

  // Workspace API Keys & Snippets State
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>(() => {
    try {
      const cached = localStorage.getItem('feenion_cached_api_keys');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });
  const [loadingKeyId, setLoadingKeyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [activeSnippetWorkspace, setActiveSnippetWorkspace] = useState<ProjectInfo | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Currency State
  const [currency, setCurrency] = useState<CurrencyConfig>(getActiveCurrency());
  const [customFxRate, setCustomFxRate] = useState<string>(String(getActiveCurrency().rate));
  const [savedCurrencyMsg, setSavedCurrencyMsg] = useState(false);
  const [isFetchingFx, setIsFetchingFx] = useState(false);
  const [fxSource, setFxSource] = useState<string>(
    (typeof window !== 'undefined' && localStorage.getItem('feenion_live_fx_source')) || 'Built-in Catalog'
  );
  const [fxLastUpdated, setFxLastUpdated] = useState<string>(
    (typeof window !== 'undefined' && localStorage.getItem('feenion_live_fx_last_updated')) || 'Default'
  );

  // Model Pricing Catalog State
  const [pricingCatalog, setPricingCatalog] = useState<ModelPricingEntry[]>(getCustomPricing());
  const [savedPricingMsg, setSavedPricingMsg] = useState(false);

  // Active Workspace resolution
  const activeWorkspaceObj = projects.find(p => p.id === selectedProject || p.name === selectedProject) || projects[0];
  const activeWorkspaceName = activeWorkspaceObj?.name || 'Active Workspace';

  // New Model Form State
  const [newModelName, setNewModelName] = useState('');
  const [newModelProvider, setNewModelProvider] = useState('Custom');
  const [newPromptRate, setNewPromptRate] = useState('1.00');
  const [newCompletionRate, setNewCompletionRate] = useState('3.00');

  // Token Simulator State
  const [simModel, setSimModel] = useState('gpt-4o');
  const [simPromptTokens, setSimPromptTokens] = useState<number>(2500);
  const [simCompletionTokens, setSimCompletionTokens] = useState<number>(600);

  // Project Delete Modal State
  const [projectToDelete, setProjectToDelete] = useState<ProjectInfo | null>(null);
  const [projectDeleteConfirmText, setProjectDeleteConfirmText] = useState('');
  const [projectDeleteStatus, setProjectDeleteStatus] = useState<string | null>(null);

  // Purge Modal State
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState('');
  const [purgeStatus, setPurgeStatus] = useState<string | null>(null);

  const handleFetchApiKey = async (projectId: string) => {
    try {
      setLoadingKeyId(projectId);
      const res = await apiClient.getProjectApiKey(projectId);
      if (res.api_key) {
        setRevealedKeys(prev => {
          const next = { ...prev, [projectId]: res.api_key };
          try {
            localStorage.setItem('feenion_cached_api_keys', JSON.stringify(next));
          } catch {}
          return next;
        });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to generate project API key');
    } finally {
      setLoadingKeyId(null);
    }
  };

  useEffect(() => {
    const handleCurrencyUpdate = () => {
      setCurrency(getActiveCurrency());
      setCustomFxRate(String(getActiveCurrency().rate));
      setFxSource(localStorage.getItem('feenion_live_fx_source') || 'Built-in Catalog');
      setFxLastUpdated(localStorage.getItem('feenion_live_fx_last_updated') || 'Default');
    };
    window.addEventListener('feenion_currency_changed', handleCurrencyUpdate);
    return () => window.removeEventListener('feenion_currency_changed', handleCurrencyUpdate);
  }, []);

  const handleSyncLiveFx = async () => {
    setIsFetchingFx(true);
    try {
      const res = await fetchLiveExchangeRates();
      setFxSource(res.source);
      setFxLastUpdated(res.lastUpdated);
      const active = getActiveCurrency();
      setCurrency(active);
      setCustomFxRate(String(active.rate));
      setSavedCurrencyMsg(true);
      setTimeout(() => setSavedCurrencyMsg(false), 2500);
    } finally {
      setIsFetchingFx(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newProjectName.trim();
    if (!name) return;
    try {
      const res = await onCreateProject(name);
      if (res?.api_key) {
        setCreatedApiKey(res.api_key);
        if (res.project?.id) {
          setRevealedKeys(prev => {
            const next = { ...prev, [res.project.id]: res.api_key };
            try {
              localStorage.setItem('feenion_cached_api_keys', JSON.stringify(next));
            } catch {}
            return next;
          });
        }
      }
      setNewProjectName('');
    } catch (err: any) {
      alert(err.message || 'Failed to create workspace');
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

  const handleSelectCurrency = (code: string) => {
    const defaultRate = SUPPORTED_CURRENCIES[code]?.rate || 1.0;
    setCustomFxRate(String(defaultRate));
    setActiveCurrency(code, defaultRate);
    setCurrency(getActiveCurrency());
    setSavedCurrencyMsg(true);
    setTimeout(() => setSavedCurrencyMsg(false), 2500);
  };

  const handleSaveFxRate = () => {
    const r = parseFloat(customFxRate);
    if (!isNaN(r) && r > 0) {
      setActiveCurrency(currency.code, r);
      setCurrency(getActiveCurrency());
      setSavedCurrencyMsg(true);
      setTimeout(() => setSavedCurrencyMsg(false), 2500);
    }
  };

  const handleUpdateModelRate = (index: number, field: 'prompt_per_1m' | 'completion_per_1m', val: string) => {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) return;
    const updated = [...pricingCatalog];
    updated[index] = { ...updated[index], [field]: num, is_custom: true };
    setPricingCatalog(updated);
  };

  const handleSaveCatalog = () => {
    saveCustomPricing(pricingCatalog);
    setSavedPricingMsg(true);
    setTimeout(() => setSavedPricingMsg(false), 2500);
  };

  const handleResetCatalog = () => {
    if (confirm('Reset all model pricing back to factory defaults?')) {
      const def = resetPricingToDefaults();
      setPricingCatalog(def);
      setSavedPricingMsg(true);
      setTimeout(() => setSavedPricingMsg(false), 2500);
    }
  };

  const handleAddNewModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelName.trim()) return;
    const pRate = parseFloat(newPromptRate) || 0;
    const cRate = parseFloat(newCompletionRate) || 0;
    const entry: ModelPricingEntry = {
      model: newModelName.trim().toLowerCase(),
      provider: newModelProvider.trim() || 'Custom',
      prompt_per_1m: pRate,
      completion_per_1m: cRate,
      is_custom: true,
    };
    const updated = [entry, ...pricingCatalog.filter(x => x.model.toLowerCase() !== entry.model)];
    setPricingCatalog(updated);
    saveCustomPricing(updated);
    setNewModelName('');
    setNewPromptRate('1.00');
    setNewCompletionRate('3.00');
    setSavedPricingMsg(true);
    setTimeout(() => setSavedPricingMsg(false), 2500);
  };

  const handleDeleteCustomModel = (modelName: string) => {
    const updated = pricingCatalog.filter(x => x.model !== modelName);
    setPricingCatalog(updated);
    saveCustomPricing(updated);
  };

  const simulatedCostUSD = calculateEstimatedCost(simModel, simPromptTokens, simCompletionTokens, pricingCatalog);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#080b11] w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#1e2330]">
        <div>
          <h2 className="text-base font-mono font-bold text-slate-100 uppercase tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            Settings &amp; Global Preferences
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage currency localization, custom token pricing models, multi-tenant workspaces, API keys, and database maintenance.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="text-[11px] font-mono text-slate-400 bg-[#0d111a] border border-[#1e2330] px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Active Project: <strong className="text-indigo-300 font-semibold">{projects.find(p => p.id === selectedProject)?.name || selectedProject || 'Default'}</strong></span>
          </div>
        </div>
      </div>

      {/* 1. Currency & Localization Settings */}
      <div className="rounded-xl bg-[#0d111a] border border-[#1e2330] p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-200 text-xs font-mono font-bold">
            <Coins className="w-4 h-4 text-amber-400" />
            <span>Currency &amp; FX Display Preferences</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-[10px] font-mono text-slate-400 bg-[#080b11] border border-slate-800 px-2 py-0.5 rounded flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Source: <strong className="text-slate-200">{fxSource}</strong> ({fxLastUpdated})</span>
            </div>

            <button
              type="button"
              onClick={handleSyncLiveFx}
              disabled={isFetchingFx}
              className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-mono text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-sm"
              title="Fetch latest live exchange rates from open-source APIs"
            >
              <RefreshCw className={`w-3 h-3 ${isFetchingFx ? 'animate-spin' : ''}`} />
              <span>{isFetchingFx ? 'Syncing...' : 'Sync Live Rates'}</span>
            </button>

            {savedCurrencyMsg && (
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Saved!
              </span>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Choose your preferred display currency for all token costs, spend aggregates, and analytics across the Feenion dashboard. Live rates are queried from open exchange APIs with instant offline fallback.
        </p>

        {/* Currency Pill Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 pt-1">
          {Object.values(SUPPORTED_CURRENCIES).map((curr) => {
            const isSelected = currency.code === curr.code;
            return (
              <button
                key={curr.code}
                type="button"
                onClick={() => handleSelectCurrency(curr.code)}
                className={`p-3 rounded-xl border text-left font-mono transition-all flex flex-col justify-between gap-1.5 ${
                  isSelected
                    ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-md ring-1 ring-indigo-500/50'
                    : 'bg-[#080b11] border-[#1e2330] text-slate-300 hover:border-slate-700 hover:bg-slate-800/30'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-base">{curr.flag}</span>
                  <span className="text-xs font-bold text-amber-300">{curr.symbol}</span>
                </div>
                <div>
                  <div className="text-xs font-bold">{curr.code}</div>
                  <div className="text-[10px] text-slate-400 truncate">{curr.name}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* FX Exchange Rate Customizer & Preview */}
        <div className="p-3.5 rounded-xl bg-[#080b11] border border-[#1e2330] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-[11px]">Exchange Rate:</span>
            <span className="text-slate-300 font-bold">1 USD ($) =</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.01"
                min="0.001"
                value={customFxRate}
                onChange={(e) => setCustomFxRate(e.target.value)}
                className="w-24 bg-[#0d111a] border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
              <span className="text-amber-300 font-bold">{currency.code}</span>
            </div>
            <button
              type="button"
              onClick={handleSaveFxRate}
              className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition-colors"
            >
              Update Rate
            </button>
          </div>
        </div>
      </div>

      {/* 2. Custom Model Pricing & Token Economics Editor */}
      <div className="rounded-xl bg-[#0d111a] border border-[#1e2330] p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-200 text-xs font-mono font-bold">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>Custom Model Token Pricing Editor ($ / 1M Tokens)</span>
          </div>
          <div className="flex items-center gap-2">
            {savedPricingMsg && (
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Pricing saved!
              </span>
            )}
            <button
              type="button"
              onClick={handleResetCatalog}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] font-mono flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Reset Defaults
            </button>
            <button
              type="button"
              onClick={handleSaveCatalog}
              className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-mono font-semibold flex items-center gap-1 transition-colors"
            >
              <Save className="w-3 h-3" /> Save Rates
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Customize prompt and completion pricing per 1 Million tokens. If prices change or you use custom fine-tuned or self-hosted Ollama models, configure their exact rates here.
        </p>

        {/* Add Custom Model Form */}
        <form onSubmit={handleAddNewModel} className="p-3.5 rounded-xl bg-[#080b11] border border-[#1e2330] flex flex-wrap items-center gap-2.5 text-xs font-mono">
          <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
            <span className="text-slate-500 text-[11px]">Model:</span>
            <input
              type="text"
              placeholder="e.g. qwen2.5:32b, gpt-4o-custom"
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
              className="w-full bg-[#0d111a] border border-slate-700 rounded px-2.5 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 w-36">
            <span className="text-slate-500 text-[11px]">Provider:</span>
            <input
              type="text"
              placeholder="Provider"
              value={newModelProvider}
              onChange={(e) => setNewModelProvider(e.target.value)}
              className="w-full bg-[#0d111a] border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 w-36">
            <span className="text-slate-500 text-[11px]">Input $/1M:</span>
            <input
              type="number"
              step="0.001"
              min="0"
              value={newPromptRate}
              onChange={(e) => setNewPromptRate(e.target.value)}
              className="w-full bg-[#0d111a] border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 w-36">
            <span className="text-slate-500 text-[11px]">Output $/1M:</span>
            <input
              type="number"
              step="0.001"
              min="0"
              value={newCompletionRate}
              onChange={(e) => setNewCompletionRate(e.target.value)}
              className="w-full bg-[#0d111a] border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add Model
          </button>
        </form>

        {/* Pricing Catalog Table */}
        <div className="rounded-xl border border-[#1e2330] overflow-hidden">
          <div className="max-h-72 overflow-y-auto no-scrollbar">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead className="bg-[#080b11] text-slate-400 border-b border-[#1e2330] sticky top-0 z-10 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="p-2.5 pl-4">Model Name</th>
                  <th className="p-2.5">Provider</th>
                  <th className="p-2.5">Prompt Cost ($/1M)</th>
                  <th className="p-2.5">Completion Cost ($/1M)</th>
                  <th className="p-2.5 pr-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2330] bg-[#090d16] text-slate-300">
                {pricingCatalog.map((item, idx) => (
                  <tr key={item.model} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-2.5 pl-4 font-bold text-white flex items-center gap-2">
                      <span>{item.model}</span>
                      {item.is_custom && (
                        <span className="px-1.5 py-0.2 text-[9px] rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                          Custom
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-slate-400">{item.provider}</td>
                    <td className="p-2.5">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500">$</span>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={item.prompt_per_1m}
                          onChange={(e) => handleUpdateModelRate(idx, 'prompt_per_1m', e.target.value)}
                          className="w-20 bg-[#080b11] border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </td>
                    <td className="p-2.5">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500">$</span>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={item.completion_per_1m}
                          onChange={(e) => handleUpdateModelRate(idx, 'completion_per_1m', e.target.value)}
                          className="w-20 bg-[#080b11] border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </td>
                    <td className="p-2.5 pr-4 text-right">
                      {item.is_custom ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomModel(item.model)}
                          className="text-rose-400 hover:text-rose-300 text-[11px] underline"
                        >
                          Remove
                        </button>
                      ) : (
                        <span className="text-slate-500 text-[10px]">Catalog Default</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Token Cost Simulator / Calculator */}
        <div className="p-4 rounded-xl bg-[#080b11] border border-indigo-900/40 space-y-3 font-mono text-xs">
          <div className="flex items-center gap-2 text-indigo-300 font-bold">
            <Calculator className="w-4 h-4 text-indigo-400" />
            <span>Live Token Cost Calculator &bull; Instant Simulation</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Select Model:</span>
              <select
                value={simModel}
                onChange={(e) => setSimModel(e.target.value)}
                className="w-full bg-[#0d111a] border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              >
                {pricingCatalog.map(p => (
                  <option key={p.model} value={p.model}>{p.model} ({p.provider})</option>
                ))}
              </select>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Prompt Tokens:</span>
              <input
                type="number"
                min="0"
                value={simPromptTokens}
                onChange={(e) => setSimPromptTokens(parseInt(e.target.value) || 0)}
                className="w-full bg-[#0d111a] border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Completion Tokens:</span>
              <input
                type="number"
                min="0"
                value={simCompletionTokens}
                onChange={(e) => setSimCompletionTokens(parseInt(e.target.value) || 0)}
                className="w-full bg-[#0d111a] border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-800 text-center">
              <span className="text-[10px] text-slate-400 block">Calculated Cost ({currency.code})</span>
              <span className="text-sm font-bold text-emerald-400 block mt-0.5">
                {formatCost(simulatedCostUSD)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Responsive 2-Column Section for Workspaces + Infrastructure & Maintenance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* 3. Workspaces & API Keys */}
        <div className="rounded-xl bg-[#0d111a] border border-[#1e2330] p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-200 text-xs font-mono font-bold">
              <Key className="w-4 h-4 text-indigo-400" />
              <span>Multi-Tenant Workspaces &amp; Ingestion Routing</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400 bg-[#080b11] border border-slate-800 px-2 py-0.5 rounded">
              {projects.length} {projects.length === 1 ? 'Workspace' : 'Workspaces'}
            </span>
          </div>

          {/* Workspace Routing Guideline Banner */}
          <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-800/60 text-xs font-mono space-y-1">
            <div className="flex items-center gap-1.5 text-indigo-300 font-bold text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5 text-indigo-400" />
              <span>Workspace ID Telemetry Routing</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed font-sans">
              Telemetry is routed strictly using each workspace's unique <code className="text-amber-300 font-mono bg-indigo-950/80 px-1 py-0.5 rounded">Workspace ID</code> (e.g. <code className="text-emerald-300 font-mono">feenion.configure(workspace_id="...")</code> or <code className="text-emerald-300 font-mono">@trace(workspace_id="...")</code>). Workspace names are human-readable labels for your dashboard.
            </p>
          </div>

          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              type="text"
              placeholder="New Workspace Name (e.g. payment-agent-prod)..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="flex-1 bg-[#080b11] border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shrink-0 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Create Workspace
            </button>
          </form>

          {createdApiKey && (
            <div className="p-3.5 rounded-lg bg-indigo-950/40 border border-indigo-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-indigo-300 font-bold flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Workspace Created! Ingestion API Key:
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(createdApiKey);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-mono hover:text-white transition-colors"
                >
                  {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  {copiedKey ? 'Copied' : 'Copy Key'}
                </button>
              </div>
              <code className="text-xs font-mono text-amber-200 break-all select-all block bg-[#080b11] p-2 rounded border border-slate-800">
                {createdApiKey}
              </code>
            </div>
          )}

          {/* Workspaces List with One-Click Copy and Python Snippets */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-mono uppercase text-slate-400 block">Configured Workspaces</span>
              <span className="text-[10px] font-mono text-slate-500">{projects.length} workspace{projects.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1 no-scrollbar">
              {[...projects]
                .sort((a, b) => {
                  const aActive = a.id === selectedProject || a.name === selectedProject;
                  const bActive = b.id === selectedProject || b.name === selectedProject;
                  if (aActive && !bActive) return -1;
                  if (!aActive && bActive) return 1;
                  return 0;
                })
                .map(p => {
                  const isActive = selectedProject === p.id || selectedProject === p.name;
                  const revealedKey = revealedKeys[p.id];
                  const isKeyLoading = loadingKeyId === p.id;

                  return (
                    <div
                      key={p.id}
                      className={`p-3 rounded-xl border text-xs font-mono transition-all space-y-2.5 ${
                        isActive
                          ? 'bg-[#0d1424] border-emerald-500/60 ring-1 ring-emerald-500/30'
                          : 'bg-[#080b11] border-[#1e2330] hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => onSelectProject(p.id)}
                            className={`font-bold truncate text-left transition-colors ${
                              isActive ? 'text-white' : 'text-slate-300 hover:text-white'
                            }`}
                            title="Click to switch active dashboard workspace"
                          >
                            {p.name}
                          </button>
                          {isActive && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/70 text-emerald-300 text-[10px] font-bold shrink-0 shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Active
                            </span>
                          )}
                        </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Quick Python Setup Snippet Button */}
                        <button
                          type="button"
                          onClick={() => setActiveSnippetWorkspace(p)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-indigo-300 text-[10px] font-mono flex items-center gap-1 transition-colors"
                          title={`View Python code snippet to route telemetry to ${p.name}`}
                        >
                          <span>&lt;/&gt; SDK Setup</span>
                        </button>

                        {/* Switch Workspace Button if not active */}
                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => onSelectProject(p.id)}
                            className="px-2 py-1 rounded bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 text-[10px] transition-colors"
                          >
                            Switch
                          </button>
                        )}

                        {/* Delete Workspace Button */}
                        <button
                          type="button"
                          disabled={projects.length <= 1}
                          onClick={() => {
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
                        </button>
                      </div>
                    </div>

                    {/* Metadata Section: Full Workspace ID + Ingestion API Key */}
                    <div className="space-y-2 pt-1 border-t border-[#1e2330]/80">
                      {/* Full Workspace ID */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 font-semibold uppercase tracking-wider">Workspace ID (Required for SDK):</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(p.id);
                              setCopiedId(p.id);
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono text-[10px] bg-indigo-950/40 border border-indigo-800/60 px-1.5 py-0.5 rounded transition-colors"
                            title="Copy Workspace ID to clipboard"
                          >
                            {copiedId === p.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedId === p.id ? 'Copied ID' : 'Copy ID'}</span>
                          </button>
                        </div>
                        <div className="p-2 rounded bg-[#05080f] border border-slate-800 text-[11px] font-mono text-slate-200 select-all break-all tracking-wide">
                          {p.id}
                        </div>
                      </div>

                      {/* Ingestion API Key */}
                      <div className="space-y-1 pt-0.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 font-semibold uppercase tracking-wider">Ingestion API Key:</span>
                          {revealedKey ? (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(revealedKey);
                                setCopiedKeyId(p.id);
                                setTimeout(() => setCopiedKeyId(null), 2000);
                              }}
                              className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-mono text-[10px] bg-amber-950/40 border border-amber-800/60 px-1.5 py-0.5 rounded transition-colors"
                              title="Copy API Key to clipboard"
                            >
                              {copiedKeyId === p.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedKeyId === p.id ? 'Copied Key' : 'Copy Key'}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isKeyLoading}
                              onClick={() => handleFetchApiKey(p.id)}
                              className="text-indigo-400 hover:text-indigo-300 font-semibold text-[10px] underline flex items-center gap-1"
                            >
                              {isKeyLoading ? 'Generating...' : 'Reveal / Generate Key'}
                            </button>
                          )}
                        </div>
                        {revealedKey ? (
                          <div className="p-2 rounded bg-[#05080f] border border-amber-900/60 text-[11px] font-mono text-amber-300 select-all break-all tracking-wide">
                            {revealedKey}
                          </div>
                        ) : (
                          <div className="p-1.5 rounded bg-[#05080f]/60 border border-slate-800/60 text-[10px] text-slate-500 font-mono italic">
                            Key hidden. Click &ldquo;Reveal / Generate Key&rdquo; to retrieve.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Server Health + Danger Zone */}
        <div className="space-y-6">
          {/* 4. Database & Infrastructure Status */}
          <div className="rounded-xl bg-[#0d111a] border border-[#1e2330] p-5 shadow-lg space-y-3">
            <div className="flex items-center gap-2 text-slate-200 text-xs font-mono font-bold">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>Server &amp; Storage Health</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
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

          {/* 5. Danger Zone */}
          <div className="rounded-xl bg-rose-950/20 border border-rose-900/60 p-5 shadow-lg space-y-3">
            <div className="flex items-center gap-2 text-rose-300 text-xs font-mono font-bold">
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Danger Zone — Purge Workspace Telemetry</span>
            </div>

            <p className="text-xs text-rose-300/80">
              Permanently deletes all traces, spans, and execution logs from your database for the active workspace <strong className="text-white font-mono bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-800">({activeWorkspaceName})</strong>. Other workspaces remain unaffected.
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
              Purge Workspace Data
            </button>
          </div>
        </div>
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

            <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg text-xs space-y-2 font-mono">
              <p className="text-rose-200">
                To confirm, type <strong className="text-white font-mono bg-rose-950 px-1.5 py-0.5 rounded border border-rose-800">delete workspace</strong> below:
              </p>
              <input
                type="text"
                value={projectDeleteConfirmText}
                onChange={(e) => setProjectDeleteConfirmText(e.target.value)}
                placeholder="Type 'delete workspace' to confirm"
                className="w-full bg-[#080b11] border border-rose-800/80 rounded px-2.5 py-1 text-xs text-rose-200 placeholder-rose-700/60 focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>

            {projectDeleteStatus && (
              <div className="p-2.5 rounded bg-rose-950/80 border border-rose-800 text-xs font-mono text-rose-200">
                {projectDeleteStatus}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteProject}
                disabled={projectDeleteConfirmText.trim().toLowerCase() !== 'delete workspace'}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all ${
                  projectDeleteConfirmText.trim().toLowerCase() === 'delete workspace'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-lg shadow-rose-950'
                    : 'bg-rose-950 text-rose-500 cursor-not-allowed opacity-50'
                }`}
              >
                Permanently Delete Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purge Workspace Telemetry Modal */}
      {isPurgeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d111a] border border-rose-900/80 rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-rose-300 font-mono font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <span>Purge Workspace Telemetry: {activeWorkspaceName}</span>
              </div>
              <button
                onClick={() => setIsPurgeModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              This action is permanent and cannot be undone. To delete all traces and spans belonging to <strong className="text-white font-mono bg-rose-950 px-1.5 py-0.5 rounded border border-rose-800">{activeWorkspaceName}</strong>, type <strong className="text-white font-mono bg-rose-950 px-1.5 py-0.5 rounded border border-rose-800">delete everything</strong> below:
            </p>

            <div className="space-y-2 font-mono">
              <input
                type="text"
                value={purgeConfirmText}
                onChange={(e) => setPurgeConfirmText(e.target.value)}
                placeholder="Type 'delete everything' to confirm"
                className="w-full bg-[#080b11] border border-rose-800/80 rounded px-2.5 py-1 text-xs text-rose-200 placeholder-rose-700/60 focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>

            {purgeStatus && (
              <div className="p-2.5 rounded bg-rose-950/80 border border-rose-800 text-xs font-mono text-rose-200">
                {purgeStatus}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPurgeModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePurge}
                disabled={purgeConfirmText.trim().toLowerCase() !== 'delete everything'}
                className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all ${
                  purgeConfirmText.trim().toLowerCase() === 'delete everything'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-lg shadow-rose-950'
                    : 'bg-rose-950 text-rose-500 cursor-not-allowed opacity-50'
                }`}
              >
                Purge Workspace Traces
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Python SDK Setup Snippet Modal */}
      {activeSnippetWorkspace && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d111a] border border-indigo-900/80 rounded-xl p-5 w-full max-w-xl shadow-2xl space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-[#1e2330] pb-3">
              <div className="flex items-center gap-2 text-indigo-300 font-mono font-bold text-sm">
                <Key className="w-4 h-4 text-indigo-400" />
                <span>Python SDK Ingestion Config: {activeSnippetWorkspace.name}</span>
              </div>
              <button
                onClick={() => setActiveSnippetWorkspace(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Telemetry is routed strictly by <strong className="text-white font-mono bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-800">workspace_id</strong>. Copy this workspace ID to route telemetry from your Python code:
            </p>

            {/* Method 1: Global Configure */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className="font-semibold text-slate-300">Method 1: Global Application Configuration</span>
                <button
                  type="button"
                  onClick={() => {
                    const code = `import feenion\n\n# Configure Feenion globally with this Workspace ID\nfeenion.configure(\n    server_url="http://localhost:8000",\n    workspace_id="${activeSnippetWorkspace.id}",\n    api_key="${revealedKeys[activeSnippetWorkspace.id] || '<YOUR_API_KEY>'}",  # Optional for local, required for auth\n)`;
                    navigator.clipboard.writeText(code);
                    setCopiedSnippet(true);
                    setTimeout(() => setCopiedSnippet(false), 2000);
                  }}
                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[10px]"
                >
                  {copiedSnippet ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSnippet ? 'Copied Snippet' : 'Copy Code'}</span>
                </button>
              </div>

              <pre className="p-3.5 rounded-lg bg-[#080b11] border border-[#1e2330] text-xs font-mono text-slate-200 overflow-x-auto select-all leading-relaxed">
{`import feenion

# Configure Feenion globally with this Workspace ID
feenion.configure(
    server_url="http://localhost:8000",
    workspace_id="${activeSnippetWorkspace.id}",
    api_key="${revealedKeys[activeSnippetWorkspace.id] || '<YOUR_API_KEY>'}",  # Optional for local, required for auth
)`}
              </pre>
            </div>

            {/* Method 2: Per-Trace Routing */}
            <div className="space-y-2">
              <span className="font-semibold text-slate-300 text-[11px] font-mono block">Method 2: Dynamic Per-Trace / Per-Agent Routing (with Auth)</span>
              <pre className="p-3.5 rounded-lg bg-[#080b11] border border-[#1e2330] text-xs font-mono text-slate-200 overflow-x-auto select-all leading-relaxed">
{`from feenion import trace

# Route this agent's traces to workspace ${activeSnippetWorkspace.name} with authentication
@trace(
    name="my_agent",
    workspace_id="${activeSnippetWorkspace.id}",
    api_key="${revealedKeys[activeSnippetWorkspace.id] || '<YOUR_API_KEY>'}",  # Optional for local, required for auth
)
def run_agent():
    return "completed"`}
              </pre>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setActiveSnippetWorkspace(null)}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
