import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  NavigationTab,
  TraceSummary,
  ErrorGroup,
  AnalyticsOverview,
  ProjectInfo,
} from './types';
import { apiClient } from './api/client';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { CommandPalette } from './components/layout/CommandPalette';
import { ShortcutsModal } from './components/common/ShortcutsModal';
import { TraceComparisonModal } from './components/trace/TraceComparisonModal';
import { Layers } from 'lucide-react';

// Dynamic Page Views
import { OverviewPage } from './pages/overview/OverviewPage';
import { TracesPage } from './pages/traces/TracesPage';
import { TraceDetailPage } from './pages/traces/TraceDetailPage';
import { ErrorsPage } from './pages/errors/ErrorsPage';
import { LLMPage } from './pages/llm/LLMPage';
import { AgentsPage } from './pages/agents/AgentsPage';
import { RetrievalPage } from './pages/retrieval/RetrievalPage';
import { ToolsPage } from './pages/tools/ToolsPage';
import { PerformancePage } from './pages/performance/PerformancePage';
import { CostsPage } from './pages/costs/CostsPage';
import { IncidentModePage } from './pages/incident/IncidentModePage';
import { SettingsPage } from './pages/settings/SettingsPage';

export const App: React.FC = () => {
  // Navigation & View State
  const [activeTab, setActiveTab] = useState<NavigationTab>(() => {
    return (localStorage.getItem('feenion_active_tab') as NavigationTab) || 'overview';
  });
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('feenion_sidebar_collapsed') === 'true';
  });

  // Global Context State (Workspace / Environment / Timeline)
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>(() => {
    return localStorage.getItem('feenion_selected_project_id') || '';
  });
  const [environment, setEnvironment] = useState<string>(() => {
    return localStorage.getItem('feenion_environment') || 'all';
  });
  const [timeRange, setTimeRange] = useState<string>(() => {
    return localStorage.getItem('feenion_time_range') || '24h';
  });

  // Filters State for Traces Explorer
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    return localStorage.getItem('feenion_status_filter') || 'all';
  });
  const [spanTypeFilter, setSpanTypeFilter] = useState<string>(() => {
    return localStorage.getItem('feenion_span_type_filter') || 'all';
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>(() => {
    return localStorage.getItem('feenion_sort_by') || 'newest';
  });

  // Live Stream Feed State
  const [isFeedPaused, setIsFeedPaused] = useState(false);
  const [bufferedCount, setBufferedCount] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);
  const bufferedEventsRef = useRef<any[]>([]);

  // Modals & Mobile Navigation
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [comparisonModalTraces, setComparisonModalTraces] = useState<{ a: string; b?: string } | null>(null);

  // Data Store State
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [errors, setErrors] = useState<ErrorGroup[]>([]);
  const [analyticsOverview, setAnalyticsOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [currencyVersion, setCurrencyVersion] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // In-House Workspace Transitioning State
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);
  const [switchingTargetName, setSwitchingTargetName] = useState<string>('');

  // Sync Global Settings to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('feenion_active_tab', activeTab);
    } catch {}
  }, [activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem('feenion_sidebar_collapsed', String(isSidebarCollapsed));
    } catch {}
  }, [isSidebarCollapsed]);

  useEffect(() => {
    try {
      localStorage.setItem('feenion_environment', environment);
    } catch {}
  }, [environment]);

  useEffect(() => {
    try {
      localStorage.setItem('feenion_time_range', timeRange);
    } catch {}
  }, [timeRange]);

  useEffect(() => {
    try {
      localStorage.setItem('feenion_status_filter', statusFilter);
    } catch {}
  }, [statusFilter]);

  useEffect(() => {
    try {
      localStorage.setItem('feenion_span_type_filter', spanTypeFilter);
    } catch {}
  }, [spanTypeFilter]);

  useEffect(() => {
    try {
      localStorage.setItem('feenion_sort_by', sortBy);
    } catch {}
  }, [sortBy]);

  // Global Currency Change Listener
  useEffect(() => {
    const handleCurrencyChange = () => setCurrencyVersion(v => v + 1);
    window.addEventListener('feenion_currency_changed', handleCurrencyChange);
    return () => window.removeEventListener('feenion_currency_changed', handleCurrencyChange);
  }, []);

  // Fetch Projects List & Synchronize Active Workspace
  const fetchProjects = useCallback(async () => {
    try {
      const projs = await apiClient.getProjects();
      setProjects(projs);
      if (projs.length > 0) {
        const savedId = localStorage.getItem('feenion_selected_project_id');
        const matched =
          projs.find(p => p.id === savedId || p.name === savedId) ||
          projs.find(p => p.id === selectedProject || p.name === selectedProject);

        const targetId = matched ? matched.id : projs[0].id;
        setSelectedProject(targetId);
        apiClient.setProject(targetId);
        localStorage.setItem('feenion_selected_project_id', targetId);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  }, [selectedProject]);

  // Handle Workspace switching with full clean page reload
  const handleSelectProject = (projectId: string) => {
    const matched = projects.find(p => p.id === projectId || p.name === projectId);
    const resolvedId = matched ? matched.id : projectId;
    apiClient.setProject(resolvedId);
    try {
      localStorage.setItem('feenion_selected_project_id', resolvedId);
    } catch {}
    window.location.reload();
  };

  // Handle Creating a new Workspace
  const handleCreateProject = async (name: string) => {
    try {
      const res = await apiClient.createProject(name);
      apiClient.setProject(res.project.id);
      try {
        localStorage.setItem('feenion_selected_project_id', res.project.id);
      } catch {}
      window.location.reload();
      return res;
    } catch (err: any) {
      console.error('Project creation failed:', err);
      throw err;
    }
  };

  // Handle Deleting a Workspace
  const handleDeleteProject = async (projectId: string) => {
    try {
      await apiClient.deleteProject(projectId);
      const remaining = projects.filter(p => p.id !== projectId);
      if (selectedProject === projectId && remaining.length > 0) {
        const nextId = remaining[0].id;
        apiClient.setProject(nextId);
        try {
          localStorage.setItem('feenion_selected_project_id', nextId);
        } catch {}
      }
      window.location.reload();
    } catch (err: any) {
      console.error('Project deletion failed:', err);
      alert(err.message || 'Failed to delete workspace');
    }
  };


  // Fetch Telemetry Data
  const fetchData = useCallback(async () => {
    try {
      if (selectedProject) {
        apiClient.setProject(selectedProject);
      }
      const [tracesData, errorsData, overviewData] = await Promise.all([
        apiClient.getTraces({
          status: statusFilter,
          environment,
          time_window: timeRange,
          span_type: spanTypeFilter,
          search: searchQuery,
          sort_by: sortBy,
          limit: 100,
        }),
        apiClient.getErrors(50),
        apiClient.getAnalyticsOverview(timeRange, environment),
      ]);

      setTraces(tracesData.traces || []);
      setErrors(errorsData.errors || []);
      setAnalyticsOverview(overviewData);
    } catch (err) {
      console.error('Failed to load telemetry:', err);
    }
  }, [selectedProject, statusFilter, environment, spanTypeFilter, searchQuery, sortBy, timeRange]);

  // Initial Load & Project Change trigger
  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // WebSocket Live Updates Connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/ws/telemetry`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setWsConnected(true);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'data_cleared' || msg.type === 'traces_batch_deleted' || msg.type === 'trace_deleted') {
          fetchData();
          return;
        }
      } catch {}

      if (isFeedPaused) {
        bufferedEventsRef.current.push(event.data);
        setBufferedCount(bufferedEventsRef.current.length);
      } else {
        fetchData();
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      setTimeout(fetchData, 4000);
    };

    return () => ws.close();
  }, [isFeedPaused, fetchData]);

  const handleToggleFeedPause = () => {
    if (isFeedPaused) {
      setIsFeedPaused(false);
      bufferedEventsRef.current = [];
      setBufferedCount(0);
      fetchData();
    } else {
      setIsFeedPaused(true);
    }
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K or Ctrl+K -> Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
      // ? -> Shortcuts Modal
      if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setIsShortcutsOpen(true);
      }
      // P -> Toggle pause live feed
      if (e.key === 'p' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        handleToggleFeedPause();
      }
      // Escape -> close open subviews or modals
      if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setIsShortcutsOpen(false);
        setComparisonModalTraces(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFeedPaused]);

  // Deep Link Navigator
  const handleNavigate = (tab: NavigationTab, filterParams?: Record<string, string>) => {
    setActiveTab(tab);
    setSelectedTraceId(null);
    if (filterParams) {
      if (filterParams.status) setStatusFilter(filterParams.status);
      if (filterParams.span_type) setSpanTypeFilter(filterParams.span_type);
      if (filterParams.sort_by) setSortBy(filterParams.sort_by);
      if (filterParams.search) setSearchQuery(filterParams.search);
      if (filterParams.environment) setEnvironment(filterParams.environment);
    }
  };

  // Trace Selector
  const handleSelectTrace = (traceId: string) => {
    setSelectedTraceId(traceId);
    setActiveTab('traces');
  };

  return (
    <div className="flex h-screen w-screen bg-[#080b11] text-slate-100 font-sans overflow-hidden select-none">
      {/* Collapsible Sidebar (Desktop Rail & Mobile Drawer) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setSelectedTraceId(null);
          setIsMobileNavOpen(false);
        }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        errorCount={errors.reduce((acc, e) => acc + e.count, 0)}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Global Top Bar */}
        <TopBar
          projects={projects}
          selectedProject={selectedProject}
          onSelectProject={handleSelectProject}
          onCreateProject={handleCreateProject}
          environment={environment}
          onSelectEnvironment={setEnvironment}
          timeRange={timeRange}
          onSelectTimeRange={setTimeRange}
          isFeedPaused={isFeedPaused}
          onToggleFeedPause={handleToggleFeedPause}
          bufferedCount={bufferedCount}
          onManualRefresh={fetchData}
          wsConnected={wsConnected}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onToggleMobileMenu={() => setIsMobileNavOpen(prev => !prev)}
        />

        {/* Dynamic Page Views */}
        <main key={selectedProject} className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'overview' && (
            <OverviewPage
              analytics={analyticsOverview}
              onNavigate={handleNavigate}
              onSelectTrace={handleSelectTrace}
            />
          )}

          {activeTab === 'traces' && (
            selectedTraceId ? (
              <TraceDetailPage
                traceId={selectedTraceId}
                onBack={() => setSelectedTraceId(null)}
                onOpenCompare={(traceAId) => setComparisonModalTraces({ a: traceAId })}
              />
            ) : (
              <TracesPage
                traces={traces}
                selectedTraceId={selectedTraceId}
                onSelectTrace={handleSelectTrace}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                spanTypeFilter={spanTypeFilter}
                onSpanTypeFilterChange={setSpanTypeFilter}
                onOpenCompare={(a, b) => setComparisonModalTraces({ a, b })}
              />
            )
          )}

          {activeTab === 'errors' && (
            <ErrorsPage
              errors={errors}
              onSelectTrace={handleSelectTrace}
            />
          )}

          {activeTab === 'llm' && (
            <LLMPage
              selectedProject={selectedProject}
              timeRange={timeRange}
              environment={environment}
              refreshKey={refreshKey}
            />
          )}

          {activeTab === 'agents' && (
            <AgentsPage
              onSelectTrace={handleSelectTrace}
              selectedProject={selectedProject}
              timeRange={timeRange}
              environment={environment}
              refreshKey={refreshKey}
            />
          )}

          {activeTab === 'retrieval' && (
            <RetrievalPage
              onSelectTrace={handleSelectTrace}
              selectedProject={selectedProject}
              timeRange={timeRange}
              environment={environment}
              refreshKey={refreshKey}
            />
          )}

          {activeTab === 'tools' && (
            <ToolsPage
              selectedProject={selectedProject}
              timeRange={timeRange}
              environment={environment}
              refreshKey={refreshKey}
            />
          )}

          {activeTab === 'performance' && (
            <PerformancePage
              onSelectTrace={handleSelectTrace}
              selectedProject={selectedProject}
              timeRange={timeRange}
              environment={environment}
              refreshKey={refreshKey}
            />
          )}

          {activeTab === 'costs' && (
            <CostsPage
              selectedProject={selectedProject}
              timeRange={timeRange}
              environment={environment}
              refreshKey={refreshKey}
            />
          )}

          {activeTab === 'incident' && (
            <IncidentModePage
              onSelectTrace={handleSelectTrace}
              selectedProject={selectedProject}
              timeRange={timeRange}
              environment={environment}
              refreshKey={refreshKey}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPage
              projects={projects}
              selectedProject={selectedProject}
              onSelectProject={handleSelectProject}
              onCreateProject={handleCreateProject}
              onDeleteProject={handleDeleteProject}
              onRefreshData={fetchData}
            />
          )}
        </main>
      </div>

      {/* In-House Workspace Transition Animated Overlay */}
      {isSwitchingWorkspace && (
        <div className="fixed inset-0 z-50 bg-[#06080e]/80 backdrop-blur-md flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-200">
          <div className="relative flex flex-col items-center max-w-sm w-full text-center space-y-5 p-8 rounded-2xl bg-[#0d121f]/95 border border-indigo-500/40 shadow-2xl shadow-indigo-950/80 ring-1 ring-indigo-500/20">
            {/* Animated Orbital Spinner with Pulsing Layers Icon */}
            <div className="relative flex items-center justify-center w-20 h-20">
              <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30 animate-ping opacity-30" />
              <div className="absolute inset-0 rounded-full border-2 border-t-indigo-400 border-r-cyan-400 border-b-transparent border-l-transparent animate-spin" />
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-950 via-slate-900 to-indigo-900 border border-indigo-500/60 flex items-center justify-center shadow-inner">
                <Layers className="w-7 h-7 text-indigo-400 animate-pulse" />
              </div>
            </div>

            {/* Target Workspace Badge & Name */}
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-500/50 text-[10px] font-mono font-bold text-indigo-300 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Switching Workspace
              </div>
              <h3 className="text-lg font-mono font-bold text-white tracking-tight break-all">
                {switchingTargetName || 'Workspace'}
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                Calibrating trace indices, error groups, and telemetry data...
              </p>
            </div>

            {/* High-Tech Loading Shimmer Bar */}
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-500 rounded-full animate-pulse w-full" />
            </div>
          </div>
        </div>
      )}

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={handleNavigate}
        onSelectTrace={handleSelectTrace}
        traces={traces}
        errors={errors}
      />

      {/* Keyboard Shortcuts Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Trace Comparison Modal */}
      {comparisonModalTraces && (
        <TraceComparisonModal
          traceAId={comparisonModalTraces.a}
          traceBId={comparisonModalTraces.b}
          onClose={() => setComparisonModalTraces(null)}
        />
      )}
    </div>
  );
};
