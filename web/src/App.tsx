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
  const [activeTab, setActiveTab] = useState<NavigationTab>('overview');
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Global Context State (Workspace / Environment / Timeline)
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('default');
  const [environment, setEnvironment] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('24h');

  // Filters State for Traces Explorer
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [spanTypeFilter, setSpanTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');

  // Live Stream Feed State
  const [isFeedPaused, setIsFeedPaused] = useState(false);
  const [bufferedCount, setBufferedCount] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);
  const bufferedEventsRef = useRef<any[]>([]);

  // Modals
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [comparisonModalTraces, setComparisonModalTraces] = useState<{ a: string; b?: string } | null>(null);

  // Data Store State
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [errors, setErrors] = useState<ErrorGroup[]>([]);
  const [analyticsOverview, setAnalyticsOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [currencyVersion, setCurrencyVersion] = useState(0);

  // Global Currency Change Listener
  useEffect(() => {
    const handleCurrencyChange = () => setCurrencyVersion(v => v + 1);
    window.addEventListener('feenion_currency_changed', handleCurrencyChange);
    return () => window.removeEventListener('feenion_currency_changed', handleCurrencyChange);
  }, []);

  // Fetch Projects List
  const fetchProjects = useCallback(async () => {
    try {
      const projs = await apiClient.getProjects();
      setProjects(projs);
      if (projs.length > 0 && (!selectedProject || !projs.find(p => p.id === selectedProject || p.name === selectedProject))) {
        setSelectedProject(projs[0].id);
        apiClient.setProject(projs[0].id);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  }, [selectedProject]);

  // Handle Workspace switching
  const handleSelectProject = (projectId: string) => {
    setSelectedProject(projectId);
    apiClient.setProject(projectId);
  };

  // Handle Creating a new Workspace
  const handleCreateProject = async (name: string) => {
    try {
      const res = await apiClient.createProject(name);
      await fetchProjects();
      setSelectedProject(res.project.id);
      apiClient.setProject(res.project.id);
    } catch (err: any) {
      console.error('Project creation failed:', err);
      alert(err.message || 'Failed to create project workspace');
    }
  };

  // Handle Deleting a Workspace
  const handleDeleteProject = async (projectId: string) => {
    try {
      await apiClient.deleteProject(projectId);
      const remaining = projects.filter(p => p.id !== projectId);
      setProjects(remaining);
      if (selectedProject === projectId && remaining.length > 0) {
        setSelectedProject(remaining[0].id);
        apiClient.setProject(remaining[0].id);
      }
      fetchData();
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
      {/* Collapsible Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setSelectedTraceId(null);
        }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        errorCount={errors.reduce((acc, e) => acc + e.count, 0)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
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
        />

        {/* Dynamic Page Views */}
        <main className="flex-1 flex flex-col overflow-hidden">
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

          {activeTab === 'llm' && <LLMPage />}

          {activeTab === 'agents' && (
            <AgentsPage onSelectTrace={handleSelectTrace} />
          )}

          {activeTab === 'retrieval' && (
            <RetrievalPage onSelectTrace={handleSelectTrace} />
          )}

          {activeTab === 'tools' && <ToolsPage />}

          {activeTab === 'performance' && (
            <PerformancePage onSelectTrace={handleSelectTrace} />
          )}

          {activeTab === 'costs' && <CostsPage />}

          {activeTab === 'incident' && (
            <IncidentModePage onSelectTrace={handleSelectTrace} />
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
