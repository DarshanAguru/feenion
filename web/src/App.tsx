import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TraceSummary, SpanPayload, ErrorGroup } from './types';

declare const d3: any;
declare const Chart: any;

function formatNumber(num: number): string {
  if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return (num || 0).toLocaleString();
}

function formatTimestamp(isoStr: string): string {
  const d = new Date(isoStr);
  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'traces' | 'metrics' | 'errors'>('traces');
  const [detailView, setDetailView] = useState<'glimpse' | 'waterfall' | 'mindmap'>('glimpse');
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [selectedSpans, setSelectedSpans] = useState<SpanPayload[]>([]);
  const [inspectedSpan, setInspectedSpan] = useState<SpanPayload | null>(null);
  const [errors, setErrors] = useState<ErrorGroup[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  // Live feed stream pause / buffer state
  const [isFeedPaused, setIsFeedPaused] = useState<boolean>(false);
  const bufferedEvents = useRef<any[]>([]);
  const [bufferedCount, setBufferedCount] = useState<number>(0);

  // Batch Selection state
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());

  // Resizable panel widths/heights
  const [sidebarWidth, setSidebarWidth] = useState<number>(330);
  const [inspectorHeight, setInspectorHeight] = useState<number>(250);
  const isResizingSidebar = useRef<boolean>(false);
  const isResizingInspector = useRef<boolean>(false);

  const d3ZoomRef = useRef<any>(null);
  const chartsRef = useRef<{ lat?: any; tp?: any; tok?: any; cost?: any }>({});

  // Admin Modal State (Empty credentials by default)
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [adminUsername, setAdminUsername] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');

  const fetchTraces = async (updateSelection = true) => {
    try {
      const url = statusFilter ? `/api/v1/traces?status=${statusFilter}&limit=100` : '/api/v1/traces?limit=100';
      const res = await fetch(url);
      const data = await res.json();
      const traceList = data.traces || [];
      setTraces(traceList);

      if (updateSelection && traceList.length > 0 && !selectedTraceId) {
        setSelectedTraceId(traceList[0].trace_id);
      }
    } catch (err) {
      console.error('Failed to fetch traces:', err);
    }
  };

  const fetchErrors = async () => {
    try {
      const res = await fetch('/api/v1/errors');
      const data = await res.json();
      setErrors(data.errors || []);
    } catch (err) {
      console.error('Failed to fetch errors:', err);
    }
  };

  // WebSocket Live Updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/ws/telemetry`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setWsConnected(true);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'data_cleared') {
          handleDataCleared();
          return;
        }
      } catch (e) {}

      if (isFeedPaused) {
        bufferedEvents.current.push(event.data);
        setBufferedCount(bufferedEvents.current.length);
      } else {
        fetchTraces(false);
      }
    };
    ws.onclose = () => {
      setWsConnected(false);
      setTimeout(fetchTraces, 3000);
    };

    fetchTraces(true);
    return () => ws.close();
  }, [statusFilter, isFeedPaused]);

  const toggleFeedPause = () => {
    if (isFeedPaused) {
      setIsFeedPaused(false);
      bufferedEvents.current = [];
      setBufferedCount(0);
      fetchTraces();
    } else {
      setIsFeedPaused(true);
    }
  };

  // Fetch spans for selected trace
  useEffect(() => {
    if (!selectedTraceId) {
      setSelectedSpans([]);
      setInspectedSpan(null);
      return;
    }

    const fetchSpans = async () => {
      try {
        const res = await fetch(`/api/v1/traces/${selectedTraceId}/spans`);
        const spansData = await res.json();
        setSelectedSpans(spansData || []);
        if (spansData && spansData.length > 0) {
          setInspectedSpan(spansData[0]);
        }
      } catch (err) {
        console.error('Failed to fetch spans:', err);
      }
    };
    fetchSpans();
  }, [selectedTraceId]);

  // Derived Metrics
  const totalTraces = traces.length;
  const durations = traces.map(t => t.duration_ms || 0).sort((a, b) => a - b);
  const p50 = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)].toFixed(0) : '0';
  const p90 = durations.length > 0 ? durations[Math.floor(durations.length * 0.9)].toFixed(0) : '0';
  const p95 = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)].toFixed(0) : '0';
  const p99 = durations.length > 0 ? durations[Math.floor(durations.length * 0.99)].toFixed(0) : '0';

  const totalTokens = traces.reduce((acc, t) => acc + (t.tokens?.total || 0), 0);
  const totalCost = traces.reduce((acc, t) => acc + (t.estimated_cost || 0), 0);
  const errorCount = traces.filter(t => t.status === 'error').length;
  const errRate = totalTraces > 0 ? ((errorCount / totalTraces) * 100).toFixed(1) : '0.0';
  const successRatio = (100 - parseFloat(errRate)).toFixed(1);
  const avgCost1k = totalTokens > 0 ? ((totalCost / totalTokens) * 1000).toFixed(4) : '0.0000';

  // Batch Select Handlers
  const toggleBatchSelect = (traceId: string) => {
    const updated = new Set(selectedBatchIds);
    if (updated.has(traceId)) updated.delete(traceId);
    else updated.add(traceId);
    setSelectedBatchIds(updated);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedBatchIds(new Set(traces.map(t => t.trace_id)));
    } else {
      setSelectedBatchIds(new Set());
    }
  };

  // D3 Mindmap Render
  useEffect(() => {
    if (detailView === 'mindmap' && selectedSpans.length > 0) {
      const container = document.getElementById('mindmapSvgContainerReact');
      if (!container) return;
      container.innerHTML = '';

      const width = container.clientWidth || 900;
      const height = container.clientHeight || 500;

      const spanMap = new Map();
      selectedSpans.forEach(s => spanMap.set(s.span_id, { ...s, children: [] }));

      let root: any = null;
      spanMap.forEach(node => {
        if (node.parent_span_id && spanMap.has(node.parent_span_id)) {
          spanMap.get(node.parent_span_id).children.push(node);
        } else {
          root = node;
        }
      });

      if (!root && selectedSpans.length > 0) root = spanMap.get(selectedSpans[0].span_id);
      if (!root) return;

      const hierarchyRoot = d3.hierarchy(root);
      const treeLayout = d3.tree().nodeSize([48, 1]);
      treeLayout(hierarchyRoot);

      const totalTraceDuration = selectedTrace?.duration_ms ? Math.max(1, selectedTrace.duration_ms) : 100;
      const avgDuration = Math.max(10, totalTraceDuration / Math.max(1, selectedSpans.length));

      hierarchyRoot.each((d: any) => {
        if (!d.parent) {
          d.y = 0;
        } else {
          const spanDur = d.data.duration_ms ? d.data.duration_ms : avgDuration;
          const ratio = Math.max(0.6, Math.min(2.5, spanDur / avgDuration));
          d.y = d.parent.y + (180 * ratio);
        }
      });

      // Calculate Bounding Box to Center Tree Perfectly
      let minY = Infinity, maxY = -Infinity;
      let minX = Infinity, maxX = -Infinity;
      hierarchyRoot.each((d: any) => {
        if (d.y < minY) minY = d.y;
        if (d.y > maxY) maxY = d.y;
        if (d.x < minX) minX = d.x;
        if (d.x > maxX) maxX = d.x;
      });

      const treeWidth = (maxY - minY) + 220; // margin for text
      const treeHeight = (maxX - minX) + 80;

      const scaleX = (width - 120) / Math.max(1, treeWidth);
      const scaleY = (height - 100) / Math.max(1, treeHeight);
      const initialScale = Math.max(0.6, Math.min(1.0, Math.min(scaleX, scaleY)));

      const midY = (minY + maxY) / 2;
      const midX = (minX + maxX) / 2;

      const initialTranslateX = (width / 2) - (midY * initialScale);
      const initialTranslateY = (height / 2) - (midX * initialScale);

      const svg = d3.select(container).append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('class', 'w-full h-full mindmap-svg');

      const svgGroup = svg.append('g');

      const zoom = d3.zoom().scaleExtent([0.2, 3.0]).on('zoom', (event: any) => {
        svgGroup.attr('transform', event.transform);
      });
      svg.call(zoom);

      // Centered Initial Transform
      const defaultTransform = d3.zoomIdentity.translate(initialTranslateX, initialTranslateY).scale(initialScale);
      svg.call(zoom.transform, defaultTransform);

      d3ZoomRef.current = { zoom, svg, svgGroup, defaultTransform };

      // Flow Links
      const linkSelection = svgGroup.selectAll('.flow-link')
        .data(hierarchyRoot.links())
        .enter()
        .append('path')
        .attr('class', 'flow-link')
        .attr('stroke', (d: any) => {
          const target = d.target.data;
          if (target.status === 'error') return '#f43f5e';
          if (target.span_type === 'llm') return '#c084fc';
          if (target.span_type === 'retrieval') return '#fbbf24';
          if (target.span_type === 'tool') return '#22d3ee';
          return '#818cf8';
        })
        .attr('d', d3.linkHorizontal().x((d: any) => d.y).y((d: any) => d.x));

      // Draggable Node Behavior with Correct Horizontal Coordinate Subject
      let dragStartX = 0;
      let dragStartY = 0;
      let hasMoved = false;

      const drag = d3.drag()
        .subject(function(event: any, d: any) {
          // Horizontal tree layout: x in SVG is d.y, y in SVG is d.x
          return { x: d.y, y: d.x };
        })
        .on('start', function(this: any, event: any, d: any) {
          event.sourceEvent.stopPropagation();
          hasMoved = false;
          dragStartX = event.x;
          dragStartY = event.y;
          d3.select(this).raise();
        })
        .on('drag', function(this: any, event: any, d: any) {
          const dx = Math.abs(event.x - dragStartX);
          const dy = Math.abs(event.y - dragStartY);
          if (dx > 3 || dy > 3) {
            hasMoved = true;
          }
          if (hasMoved) {
            d.y = event.x;
            d.x = event.y;
            d3.select(this).attr('transform', `translate(${d.y}, ${d.x})`);
            linkSelection.attr('d', d3.linkHorizontal().x((l: any) => l.y).y((l: any) => l.x));
          }
        })
        .on('end', function(this: any, event: any, d: any) {
          // Completed drag
        });

      // Nodes with Dragging & Click Selection
      const nodeGroup = svgGroup.selectAll('.node')
        .data(hierarchyRoot.descendants())
        .enter()
        .append('g')
        .attr('class', (d: any) => `node node-${d.data.span_type} ${d.data.status === 'error' ? 'node-error' : ''} cursor-grab active:cursor-grabbing select-none`)
        .attr('transform', (d: any) => `translate(${d.y}, ${d.x})`)
        .call(drag)
        .on('click', (event: any, d: any) => {
          if (!hasMoved) {
            setInspectedSpan(d.data);
          }
        });

      nodeGroup.append('circle')
        .attr('r', 9)
        .attr('class', 'transition-all');

      nodeGroup.append('text')
        .attr('dy', '.35em')
        .attr('x', (d: any) => d.children ? -14 : 14)
        .attr('text-anchor', (d: any) => d.children ? 'end' : 'start')
        .attr('class', 'fill-slate-200 font-mono text-[11px] select-none pointer-events-none drop-shadow')
        .text((d: any) => `${d.data.name} (${d.data.duration_ms ? d.data.duration_ms.toFixed(1) + 'ms' : ''})`);
    }
  }, [detailView, selectedSpans]);

  // Model Breakdown Intelligence Computation
  const modelList = useMemo(() => {
    const stats: Record<string, {
      name: string;
      calls: number;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      totalCost: number;
      totalDuration: number;
    }> = {};

    traces.forEach(t => {
      const models = (t.models && t.models.length > 0) ? t.models : [(t.name.includes('claude') ? 'claude-3-5-sonnet' : (t.name.includes('gpt') ? 'gpt-4o' : (t.name.includes('langchain') ? 'langchain-agent' : 'standard-agent')))];
      const promptTok = t.tokens?.prompt || 0;
      const compTok = t.tokens?.completion || 0;
      const totalTok = t.tokens?.total || (promptTok + compTok);
      const cost = t.estimated_cost || 0;
      const dur = t.duration_ms || 0;

      models.forEach(m => {
        const modelKey = m.toLowerCase();
        if (!stats[modelKey]) {
          stats[modelKey] = {
            name: m,
            calls: 0,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            totalCost: 0,
            totalDuration: 0,
          };
        }
        stats[modelKey].calls += 1;
        stats[modelKey].promptTokens += promptTok;
        stats[modelKey].completionTokens += compTok;
        stats[modelKey].totalTokens += totalTok;
        stats[modelKey].totalCost += cost;
        stats[modelKey].totalDuration += dur;
      });
    });

    return Object.values(stats);
  }, [traces]);

  // Metrics Charts Renderer
  const renderMetricsCharts = () => {
    if (typeof Chart === 'undefined' || traces.length === 0) return;

    setTimeout(() => {
      const recentTraces = traces.slice(0, 15).reverse();
      const labels = recentTraces.map((t, idx) => {
        const seq = (t as any).seq_num ? `#${(t as any).seq_num}` : `#${idx + 1}`;
        const model = (t.models && t.models[0])
          ? t.models[0].replace('claude-3-5-sonnet', 'Claude').replace('gpt-4o', 'GPT-4o').replace('gemini-1.5-pro', 'Gemini')
          : '';
        
        let cleanName = (t.name || 'Trace')
          .replace('auto_instrumented_chat_turn', 'AI Agent Turn')
          .replace('auto_instrumented_turn', 'AI Agent Turn')
          .replace('auto_instrumented_chat', 'AI Chat')
          .replace('openai_customer_support_agent', 'Support Agent')
          .replace('claude_technical_analyst_agent', 'Claude Analyst')
          .replace('langchain_conversational_rag_agent', 'LangChain RAG')
          .replace('langchain_react_agent', 'LangChain ReAct')
          .replace('langchain_agent', 'LangChain Agent')
          .replace('payment_gateway_checkout_agent', 'Payment Checkout')
          .replace(/_/g, ' ');

        cleanName = cleanName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        if (model) {
          return `${seq} · ${cleanName} (${model})`;
        }
        return `${seq} · ${cleanName}`;
      });

      const durations = recentTraces.map(t => t.duration_ms || 0);
      const bgColors = recentTraces.map(t => t.status === 'error' ? '#f43f5e' : '#6366f1');

      // Latency Chart
      const latCanvas = document.getElementById('chartLatencyCanvas') as HTMLCanvasElement;
      if (latCanvas) {
        if (chartsRef.current.lat) chartsRef.current.lat.destroy();
        chartsRef.current.lat = new Chart(latCanvas, {
          type: 'bar',
          data: {
            labels,
            datasets: [{ label: 'Duration (ms)', data: durations, backgroundColor: bgColors, borderRadius: 4 }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  title: (items: any) => {
                    const idx = items[0].dataIndex;
                    const t = recentTraces[idx];
                    const seq = (t as any)?.seq_num ? `#${(t as any).seq_num}` : `#${idx + 1}`;
                    return t ? `${t.name} (Trace ${seq})` : '';
                  },
                  label: (ctx: any) => {
                    const idx = ctx.dataIndex;
                    const t = recentTraces[idx];
                    const timeStr = t?.start_time ? new Date(t.start_time).toLocaleTimeString() : '';
                    const dur = Number(ctx.raw).toFixed(1);
                    const cost = t?.estimated_cost ? `$${t.estimated_cost.toFixed(5)}` : '$0';
                    const toks = t?.tokens?.total ? `${formatNumber(t.tokens.total)} toks` : '';
                    return [
                      ` Duration: ${dur} ms`,
                      ` Time: ${timeStr}`,
                      ` Model: ${t?.models?.join(', ') || 'N/A'}`,
                      ` Tokens: ${toks} (${cost})`
                    ];
                  }
                }
              }
            },
            scales: {
              y: { grid: { color: '#1e2330' }, ticks: { color: '#94a3b8', callback: (v: any) => `${v}ms` } },
              x: { ticks: { color: '#94a3b8', maxRotation: 25, minRotation: 15, font: { size: 10 } } }
            }
          }
        });
      }

      // Throughput & Span Count Chart
      const tpCanvas = document.getElementById('chartThroughputCanvas') as HTMLCanvasElement;
      if (tpCanvas) {
        if (chartsRef.current.tp) chartsRef.current.tp.destroy();
        chartsRef.current.tp = new Chart(tpCanvas, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'Spans per Trace',
              data: recentTraces.map(t => t.span_count),
              borderColor: '#38bdf8',
              backgroundColor: 'rgba(56,189,248,0.12)',
              fill: true,
              tension: 0.3,
              pointBackgroundColor: '#38bdf8',
              pointRadius: 4,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  title: (items: any) => {
                    const idx = items[0].dataIndex;
                    const t = recentTraces[idx];
                    const seq = (t as any)?.seq_num ? `#${(t as any).seq_num}` : `#${idx + 1}`;
                    return t ? `${t.name} (Trace ${seq})` : '';
                  },
                  label: (ctx: any) => {
                    const idx = ctx.dataIndex;
                    const t = recentTraces[idx];
                    return [
                      ` Spans: ${ctx.raw} nested spans`,
                      ` Status: ${t?.status === 'error' ? '❌ Failed' : '✅ Success'}`,
                      ` Tokens: ${formatNumber(t?.tokens?.total || 0)}`
                    ];
                  }
                }
              }
            },
            scales: {
              y: { grid: { color: '#1e2330' }, ticks: { color: '#94a3b8', precision: 0 } },
              x: { ticks: { color: '#94a3b8', maxRotation: 25, minRotation: 15, font: { size: 10 } } }
            }
          }
        });
      }

      // Model Tokens Doughnut Chart
      const tokCanvas = document.getElementById('chartTokensCanvas') as HTMLCanvasElement;
      if (tokCanvas) {
        if (chartsRef.current.tok) chartsRef.current.tok.destroy();
        const modelNames = modelList.map((m: any) => m.name);
        const modelTokens = modelList.map((m: any) => m.totalTokens);
        const colors = ['#818cf8', '#c084fc', '#fbbf24', '#34d399', '#f43f5e', '#38bdf8'];
        chartsRef.current.tok = new Chart(tokCanvas, {
          type: 'doughnut',
          data: {
            labels: modelNames,
            datasets: [{
              data: modelTokens,
              backgroundColor: colors.slice(0, modelNames.length),
              borderColor: '#0f172a',
              borderWidth: 2,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } },
              tooltip: {
                callbacks: {
                  label: (ctx: any) => ` ${ctx.label}: ${formatNumber(Number(ctx.raw))} tokens`
                }
              }
            }
          }
        });
      }

      // Model Cost Bar Chart
      const costCanvas = document.getElementById('chartCostCanvas') as HTMLCanvasElement;
      if (costCanvas) {
        if (chartsRef.current.cost) chartsRef.current.cost.destroy();
        const modelNames = modelList.map((m: any) => m.name);
        const modelCosts = modelList.map((m: any) => m.totalCost);
        chartsRef.current.cost = new Chart(costCanvas, {
          type: 'bar',
          data: {
            labels: modelNames,
            datasets: [{
              label: 'Spend ($)',
              data: modelCosts,
              backgroundColor: '#10b981',
              borderRadius: 4,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx: any) => ` Cost: $${Number(ctx.raw).toFixed(5)}`
                }
              }
            },
            scales: {
              x: { ticks: { color: '#94a3b8' } },
              y: { grid: { color: '#1e2330' }, ticks: { color: '#94a3b8', callback: (v: any) => `$${v}` } }
            }
          }
        });
      }
    }, 50);
  };

  const copyTraceId = () => {
    if (!selectedTraceId) return;
    navigator.clipboard.writeText(selectedTraceId);
    alert('Trace ID copied to clipboard: ' + selectedTraceId);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('JSON copied to clipboard!');
  };

  const filteredTraces = traces.filter(t => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (t.trace_id && t.trace_id.toLowerCase().includes(q)) ||
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.models && t.models.some(m => m && m.toLowerCase().includes(q))) ||
      (t.preview_prompt && t.preview_prompt.toLowerCase().includes(q)) ||
      (t.search_text && t.search_text.toLowerCase().includes(q)) ||
      JSON.stringify(t.metadata || {}).toLowerCase().includes(q)
    );
  });

  const selectedTrace = traces.find(t => t.trace_id === selectedTraceId);
  const traceStart = selectedTrace ? new Date(selectedTrace.start_time).getTime() : 0;
  const traceEnd = selectedTrace?.end_time ? new Date(selectedTrace.end_time).getTime() : Date.now();
  const totalDuration = Math.max(1, (traceEnd - traceStart) || (selectedTrace?.duration_ms || 1));

  const handleDataCleared = () => {
    setTraces([]);
    setSelectedTraceId(null);
    setSelectedSpans([]);
    setInspectedSpan(null);
    setSelectedBatchIds(new Set());
  };

  const adminClearAll = async () => {
    const u = adminUsername.trim() || 'admin';
    const p = adminPassword.trim() || 'admin';
    if (!confirm("⚠️ Are you sure you want to permanently purge ALL traces, spans, and telemetry data?")) return;

    try {
      const token = btoa(`${u}:${p}`);
      const res = await fetch('/api/v1/admin/traces', {
        method: 'DELETE',
        headers: { Authorization: `Basic ${token}` },
      });
      if (res.status === 401) {
        alert("❌ Unauthorized: Invalid credentials. Default is admin:admin");
        return;
      }
      const data = await res.json();
      alert("✅ " + data.message);
      setIsAdminModalOpen(false);
      handleDataCleared();
    } catch (err: any) {
      alert("❌ Error purging data: " + err.message);
    }
  };

  const adminBatchDeleteSelected = async () => {
    const ids = Array.from(selectedBatchIds);
    if (ids.length === 0) {
      alert("No traces selected. Use the checkboxes in the trace list to select traces.");
      return;
    }

    const u = adminUsername.trim() || 'admin';
    const p = adminPassword.trim() || 'admin';
    if (!confirm(`Permanently delete ${ids.length} selected trace${ids.length > 1 ? 's' : ''}?`)) return;

    try {
      const token = btoa(`${u}:${p}`);
      const res = await fetch('/api/v1/admin/traces/batch-delete', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trace_ids: ids }),
      });
      if (res.status === 401) {
        alert("❌ Unauthorized: Invalid credentials (default admin:admin)");
        return;
      }
      const data = await res.json();
      alert("✅ " + data.message);
      setIsAdminModalOpen(false);

      // Immediately filter out from local state
      const remaining = traces.filter(t => !selectedBatchIds.has(t.trace_id));
      setTraces(remaining);
      setSelectedBatchIds(new Set());
      if (selectedTraceId && ids.includes(selectedTraceId)) {
        setSelectedTraceId(remaining.length > 0 ? remaining[0].trace_id : null);
      }
    } catch (err: any) {
      alert("❌ Error deleting traces: " + err.message);
    }
  };

  // Resizer Event Handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar.current) {
        setSidebarWidth(Math.max(220, Math.min(600, e.clientX)));
      }
      if (isResizingInspector.current) {
        setInspectorHeight(Math.max(120, Math.min(600, window.innerHeight - e.clientY)));
      }
    };
    const handleMouseUp = () => {
      isResizingSidebar.current = false;
      isResizingInspector.current = false;
      document.body.style.cursor = 'default';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden select-none bg-[#080b11] text-[#e2e8f0]">
      {/* Liquid Glass Header Navbar */}
      <header className="bg-slate-950/70 backdrop-blur-xl border-b border-slate-800/60 px-6 py-2.5 flex items-center justify-between sticky top-0 z-50 shadow-2xl">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-indigo-500/20">F</div>
            <span className="text-xl font-bold tracking-tight text-white">Feenion</span>
            <span className="text-[10px] bg-slate-900/90 text-indigo-400 border border-indigo-900/50 px-2 py-0.5 rounded-full font-mono">Dashboard</span>
          </div>

          <nav className="flex space-x-1.5 text-xs">
            <button
              onClick={() => setActiveTab('traces')}
              className={`py-1.5 px-3 rounded-lg transition flex items-center space-x-1.5 ${activeTab === 'traces' ? 'text-indigo-300 font-semibold bg-indigo-600/20 border border-indigo-500/30 backdrop-blur-md shadow-inner' : 'text-slate-400 hover:text-white hover:bg-slate-900/60 border border-transparent'}`}
            >
              <span>⚡ Traces & Mindmap</span>
            </button>
            <button
              onClick={() => { setActiveTab('metrics'); renderMetricsCharts(); }}
              className={`py-1.5 px-3 rounded-lg transition flex items-center space-x-1.5 ${activeTab === 'metrics' ? 'text-indigo-300 font-semibold bg-indigo-600/20 border border-indigo-500/30 backdrop-blur-md shadow-inner' : 'text-slate-400 hover:text-white hover:bg-slate-900/60 border border-transparent'}`}
            >
              <span>📊 Metrics & Analytics</span>
            </button>
            <button
              onClick={() => { setActiveTab('errors'); fetchErrors(); }}
              className={`py-1.5 px-3 rounded-lg transition flex items-center space-x-1.5 ${activeTab === 'errors' ? 'text-indigo-300 font-semibold bg-indigo-600/20 border border-indigo-500/30 backdrop-blur-md shadow-inner' : 'text-slate-400 hover:text-white hover:bg-slate-900/60 border border-transparent'}`}
            >
              <span>⚠️ Error Debugger</span>
            </button>
          </nav>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => { setAdminUsername(''); setAdminPassword(''); setIsAdminModalOpen(true); }}
            className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 text-xs font-semibold rounded-lg transition flex items-center space-x-1.5 shadow-sm"
          >
            <span>🛡️ Admin / Clear Data</span>
          </button>
          <button
            onClick={toggleFeedPause}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition flex items-center space-x-1 ${isFeedPaused ? 'bg-amber-950/80 border-amber-700 text-amber-300 shadow-inner' : 'bg-slate-900/80 hover:bg-slate-800/90 border-slate-800/80 text-slate-200 shadow-sm'}`}
          >
            <span>{isFeedPaused ? `▶️ Resume (+${bufferedCount} new)` : '⏸️ Pause Feed'}</span>
          </button>
          <button
            onClick={() => fetchTraces()}
            className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800/90 text-xs font-medium rounded-lg border border-slate-800/80 text-slate-200 transition flex items-center space-x-1 shadow-sm"
          >
            <span>🔄 Refresh</span>
          </button>
          <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-800/60">
            <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></div>
            <span className="font-mono text-[11px]">{wsConnected ? 'Live' : 'Connecting...'}</span>
          </div>
        </div>
      </header>

      {/* Summary Metrics Top Bar */}
      <div className="bg-slate-950/90 border-b border-[#1e2330] px-6 py-2.5 grid grid-cols-5 gap-4">
        <div onClick={() => setStatusFilter('')} className="bg-[#0d111a] hover:bg-slate-900/80 p-3 rounded-xl border border-[#1e2330] cursor-pointer transition flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Traces</span>
          <div className="text-lg font-extrabold text-white mt-0.5">{totalTraces}</div>
        </div>
        <div className="bg-[#0d111a] p-3 rounded-xl border border-[#1e2330] flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">P50 / P90 Latency</span>
          <div className="text-lg font-extrabold text-indigo-400 mt-0.5">{p50} / {p90} ms</div>
        </div>
        <div className="bg-[#0d111a] p-3 rounded-xl border border-[#1e2330] flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Tokens</span>
          <div className="text-lg font-extrabold text-purple-400 mt-0.5">{formatNumber(totalTokens)}</div>
        </div>
        <div className="bg-[#0d111a] p-3 rounded-xl border border-[#1e2330] flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Est. LLM Cost</span>
          <div className="text-lg font-extrabold text-emerald-400 mt-0.5">${totalCost.toFixed(4)}</div>
        </div>
        <div onClick={() => setStatusFilter('error')} className="bg-[#0d111a] hover:bg-slate-900/80 p-3 rounded-xl border border-[#1e2330] cursor-pointer transition flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Error Rate</span>
          <div className="text-lg font-extrabold text-rose-400 mt-0.5">{errRate}%</div>
        </div>
      </div>

      {/* TAB 1: TRACES & WATERFALL */}
      {activeTab === 'traces' && (
        <div className="flex-1 flex overflow-hidden">
          {/* Resizable Sidebar */}
          <div style={{ width: `${sidebarWidth}px` }} className="border-r border-[#1e2330] flex flex-col bg-slate-950/60">
            <div className="p-3 border-b border-[#1e2330] space-y-2">
              <input
                type="text"
                placeholder="Filter by prompt, model, or trace ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <div className="flex items-center justify-between">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-[11px] text-slate-300 rounded px-2 py-1 focus:outline-none"
                >
                  <option value="">All Statuses</option>
                  <option value="ok">Status: OK</option>
                  <option value="error">Status: Error</option>
                </select>
                <div className="flex items-center space-x-2">
                  <label className="flex items-center space-x-1 text-[11px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={traces.length > 0 && selectedBatchIds.size === traces.length}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Select</span>
                  </label>
                  <span className="text-[11px] text-slate-400">{filteredTraces.length} traces</span>
                </div>
              </div>

              {/* Batch Action Bar */}
              {selectedBatchIds.size > 0 && (
                <div className="p-2 bg-rose-950/40 border border-rose-900/60 rounded-lg flex items-center justify-between">
                  <span className="text-xs text-rose-300 font-mono">{selectedBatchIds.size} selected</span>
                  <button
                    onClick={() => { setAdminUsername(''); setAdminPassword(''); setIsAdminModalOpen(true); }}
                    className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-semibold transition"
                  >
                    🗑️ Delete Selected
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
              {filteredTraces.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">No traces match filter.</div>
              ) : (
                filteredTraces.map((t, idx) => {
                  const isSelected = t.trace_id === selectedTraceId;
                  const isChecked = selectedBatchIds.has(t.trace_id);
                  const timeStr = formatTimestamp(t.start_time);

                  return (
                    <div
                      key={t.trace_id}
                      onClick={() => setSelectedTraceId(t.trace_id)}
                      className={`p-3 cursor-pointer transition ${isSelected ? 'bg-slate-800/90 border-l-4 border-l-indigo-500' : 'hover:bg-slate-900/80'}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2 truncate">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleBatchSelect(t.trace_id)}
                            className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                          />
                          <span className="text-[10px] text-slate-500 font-mono">#{traces.length - idx}</span>
                          <span className="font-medium text-xs text-slate-200 truncate max-w-[140px]">{t.name}</span>
                        </div>
                        {t.status === 'error' ? (
                          <span className="px-2 py-0.5 bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-semibold rounded">FAIL</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-semibold rounded">OK</span>
                        )}
                      </div>
                      {t.preview_prompt && (
                        <div className="text-[10px] text-slate-300 font-mono truncate mb-1 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800/60">
                          💬 {t.preview_prompt}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <div className="flex items-center space-x-1.5 truncate">
                          {t.models && t.models.length > 0 && (
                            <span className="px-1.5 py-0.5 bg-purple-950 text-purple-300 border border-purple-800 text-[9px] font-mono rounded truncate max-w-[80px]">
                              {t.models[0]}
                            </span>
                          )}
                          <span>{t.span_count} spans {t.tokens?.total ? `• ${formatNumber(t.tokens.total)} toks` : ''}</span>
                        </div>
                        <div className="flex items-center space-x-1 font-mono">
                          <span className="text-slate-500">{timeStr}</span>
                          <span className="text-indigo-300">{t.duration_ms ? `${t.duration_ms.toFixed(1)} ms` : 'running'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Vertical Resizer Handle */}
          <div
            onMouseDown={() => {
              isResizingSidebar.current = true;
              document.body.style.cursor = 'col-resize';
            }}
            className="w-1 hover:bg-indigo-500 bg-[#1e2330] cursor-col-resize transition-colors"
          ></div>

          {/* Main Visual Panel */}
          <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden relative">
            {selectedTrace ? (
              <>
                <div className="p-3 border-b border-[#1e2330] bg-[#0d111a] flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-sm font-bold text-white">{selectedTrace.name}</h2>
                      <button
                        onClick={copyTraceId}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] text-indigo-300 rounded border border-slate-700 transition"
                      >
                        📋 Copy ID
                      </button>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 space-x-3">
                      <span>ID: <code className="text-slate-300 font-mono">{selectedTrace.trace_id}</code></span>
                      <span>Started: {formatTimestamp(selectedTrace.start_time)}</span>
                      <span>Duration: <strong className="text-indigo-400 font-mono">{selectedTrace.duration_ms ? selectedTrace.duration_ms.toFixed(1) + ' ms' : 'N/A'}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                      <button
                        onClick={() => setDetailView('glimpse')}
                        className={`px-2.5 py-1 text-xs rounded-md ${detailView === 'glimpse' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
                      >
                        📋 Glimpse & Overview
                      </button>
                      <button
                        onClick={() => setDetailView('waterfall')}
                        className={`px-2.5 py-1 text-xs rounded-md ${detailView === 'waterfall' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
                      >
                        ⏱️ Timeline
                      </button>
                      <button
                        onClick={() => setDetailView('mindmap')}
                        className={`px-2.5 py-1 text-xs rounded-md ${detailView === 'mindmap' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
                      >
                        🌳 Tree Flow
                      </button>
                    </div>
                  </div>
                </div>

                {/* VIEW 1: TRACE GLIMPSE & OVERVIEW */}
                {detailView === 'glimpse' && (
                  <div className="flex-1 p-6 overflow-y-auto bg-slate-950 space-y-5">
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-[#0d111a] p-3 rounded-xl border border-[#1e2330]">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Execution Time</span>
                        <div className="text-base font-extrabold text-indigo-400 mt-1 font-mono">
                          {selectedTrace.duration_ms ? selectedTrace.duration_ms.toFixed(1) + ' ms' : 'Running'}
                        </div>
                      </div>
                      <div className="bg-[#0d111a] p-3 rounded-xl border border-[#1e2330]">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Token Breakdown</span>
                        <div className="text-base font-extrabold text-purple-400 mt-1 font-mono">
                          {selectedTrace.tokens ? `${formatNumber(selectedTrace.tokens.total)} (${formatNumber(selectedTrace.tokens.prompt)} in / ${formatNumber(selectedTrace.tokens.completion)} out)` : '0 toks'}
                        </div>
                      </div>
                      <div className="bg-[#0d111a] p-3 rounded-xl border border-[#1e2330]">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Estimated Spend</span>
                        <div className="text-base font-extrabold text-emerald-400 mt-1 font-mono">
                          ${(selectedTrace.estimated_cost || 0).toFixed(5)}
                        </div>
                      </div>
                      <div className="bg-[#0d111a] p-3 rounded-xl border border-[#1e2330]">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Spans & Hierarchy</span>
                        <div className="text-base font-extrabold text-slate-200 mt-1 font-mono">
                          {selectedSpans.length} total ({selectedSpans.filter(s => s.span_type === 'llm').length} LLM, {selectedSpans.filter(s => s.span_type === 'tool').length} Tool)
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#0d111a] p-4 rounded-xl border border-[#1e2330] flex flex-col">
                        <div className="flex items-center justify-between pb-2 border-b border-[#1e2330] mb-2">
                          <span className="text-xs font-bold text-indigo-300">💬 Prompt / User Query Input</span>
                          <span className="text-[10px] font-mono text-slate-500">{new Date(selectedTrace.start_time).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-xs text-slate-200 font-mono whitespace-pre-wrap bg-slate-950 p-3 rounded-lg border border-slate-800/80 max-h-48 overflow-y-auto leading-relaxed">
                          {selectedTrace.preview_prompt || "No prompt text found."}
                        </div>
                      </div>

                      <div className="bg-[#0d111a] p-4 rounded-xl border border-[#1e2330] flex flex-col">
                        <div className="flex items-center justify-between pb-2 border-b border-[#1e2330] mb-2">
                          <span className="text-xs font-bold text-emerald-300">⚡ Agent Response / Final Output</span>
                          <span className="text-[10px] font-mono text-slate-500">{selectedTrace.status === 'error' ? '❌ FAILED' : '✅ SUCCESS'}</span>
                        </div>
                        <div className="text-xs text-slate-200 font-mono whitespace-pre-wrap bg-slate-950 p-3 rounded-lg border border-slate-800/80 max-h-48 overflow-y-auto leading-relaxed">
                          {selectedSpans.find(s => s.output)?.output?.content || selectedSpans.find(s => s.output)?.output?.result || selectedSpans.find(s => s.output)?.output?.generations?.[0] || 'Execution finished successfully.'}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-indigo-950/40 border border-indigo-900/60 rounded-xl flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-indigo-200">Deep Execution Graph & Latency Distribution</h4>
                        <p className="text-[11px] text-indigo-400/80 mt-0.5">Explore millisecond waterfalls or animated latency-proportional mindmap links.</p>
                      </div>
                      <div className="flex space-x-2">
                        <button onClick={() => setDetailView('waterfall')} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition">
                          ⏱️ Open Timeline Waterfall
                        </button>
                        <button onClick={() => setDetailView('mindmap')} className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-indigo-800 rounded-lg text-xs font-semibold transition">
                          🌳 Open Tree Flow
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* VIEW 2: WATERFALL */}
                {detailView === 'waterfall' && (
                  <div className="flex-1 p-6 overflow-y-auto bg-slate-950">
                    <div className="flex items-center justify-between mb-3 text-xs text-slate-400 font-mono">
                      <span>0 ms</span>
                      <span>{(totalDuration / 2).toFixed(0)} ms</span>
                      <span>{totalDuration.toFixed(0)} ms</span>
                    </div>

                    <div className="relative w-full border-t border-slate-800 pt-3 space-y-2.5">
                      {selectedSpans.map((s) => {
                        const sStart = new Date(s.start_time).getTime();
                        const sEnd = s.end_time ? new Date(s.end_time).getTime() : sStart + (s.duration_ms || 0);
                        const leftPercent = Math.max(0, Math.min(100, ((sStart - traceStart) / totalDuration) * 100));
                        const widthPercent = Math.max(1.5, Math.min(100 - leftPercent, (((sEnd - sStart) || 1) / totalDuration) * 100));

                        const colorClass = s.status === 'error' ? 'bg-rose-600' : s.span_type === 'llm' ? 'bg-purple-600' : s.span_type === 'retrieval' ? 'bg-amber-600' : s.span_type === 'tool' ? 'bg-cyan-600' : 'bg-indigo-600';

                        return (
                          <div
                            key={s.span_id}
                            onClick={() => setInspectedSpan(s)}
                            className="group flex items-center cursor-pointer"
                          >
                            <div className="w-64 flex items-center space-x-2 pr-3 truncate">
                              <span className="text-xs font-medium text-slate-200 group-hover:text-indigo-400 transition truncate">{s.name}</span>
                              <span className="text-[10px] px-1.5 py-0.2 bg-slate-900 text-slate-400 rounded font-mono border border-slate-800">{s.span_type}</span>
                            </div>

                            <div className="flex-1 bg-slate-900/60 rounded h-6 relative flex items-center px-2 overflow-hidden border border-slate-800/40">
                              <div
                                className={`${colorClass} absolute top-0 bottom-0 flex items-center px-2 text-[10px] font-bold text-white font-mono rounded shadow`}
                                style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                              >
                                {widthPercent > 10 ? (s.duration_ms ? s.duration_ms.toFixed(1) + ' ms' : '') : ''}
                              </div>
                            </div>

                            <div className="w-20 text-right text-xs font-mono text-slate-400 pl-3">
                              {s.duration_ms ? `${s.duration_ms.toFixed(1)}ms` : 'running'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* VIEW 3: MINDMAP TREE */}
                {detailView === 'mindmap' && (
                  <div className="w-full flex-1 relative overflow-hidden bg-slate-950 flex flex-col">
                    <div className="absolute top-3 right-4 z-10 flex items-center space-x-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 shadow-xl">
                      <span className="text-[11px] text-slate-400 font-medium flex items-center space-x-1.5 pr-2 border-r border-slate-800">
                        <span>✋</span>
                        <span>Drag nodes to rearrange</span>
                      </span>
                      <button
                        onClick={() => {
                          if (d3ZoomRef.current) {
                            const { svg, zoom } = d3ZoomRef.current;
                            svg.transition().duration(250).call(zoom.scaleBy, 1.25);
                          }
                        }}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition"
                        title="Zoom In"
                      >
                        ➕
                      </button>
                      <button
                        onClick={() => {
                          if (d3ZoomRef.current) {
                            const { svg, zoom } = d3ZoomRef.current;
                            svg.transition().duration(250).call(zoom.scaleBy, 0.8);
                          }
                        }}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition"
                        title="Zoom Out"
                      >
                        ➖
                      </button>
                      <button
                        onClick={() => {
                          if (d3ZoomRef.current && d3ZoomRef.current.defaultTransform) {
                            const { svg, zoom, defaultTransform } = d3ZoomRef.current;
                            svg.transition().duration(350).call(zoom.transform, defaultTransform);
                          }
                        }}
                        className="px-2 py-1 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 rounded text-xs transition font-mono"
                        title="Reset to Center"
                      >
                        🎯 Reset
                      </button>
                    </div>
                    <div id="mindmapSvgContainerReact" className="w-full flex-1 relative overflow-hidden bg-slate-950"></div>
                  </div>
                )}

                {/* Horizontal Resizer */}
                <div
                  onMouseDown={() => {
                    isResizingInspector.current = true;
                    document.body.style.cursor = 'row-resize';
                  }}
                  className="h-1 hover:bg-indigo-500 bg-[#1e2330] cursor-row-resize transition-colors"
                ></div>

                {/* Span Inspector Drawer */}
                {inspectedSpan && (
                  <div style={{ height: `${inspectorHeight}px` }} className="border-t border-[#1e2330] bg-[#0d111a] p-4 flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between pb-2 border-b border-[#1e2330] mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`w-3 h-3 rounded-full ${inspectedSpan.status === 'error' ? 'bg-rose-500' : 'bg-indigo-500'}`}></span>
                        <span className="font-bold text-xs text-white">{inspectedSpan.name}</span>
                        <span className="px-2 py-0.2 bg-slate-900 text-slate-400 border border-slate-800 text-[10px] rounded font-mono">{inspectedSpan.span_type}</span>
                        <span className="text-xs font-mono text-indigo-400">{inspectedSpan.duration_ms ? inspectedSpan.duration_ms.toFixed(2) + ' ms' : 'running'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button onClick={() => copyToClipboard(JSON.stringify(inspectedSpan.input, null, 2))} className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded text-[11px] border border-slate-800">Copy Input</button>
                        <button onClick={() => copyToClipboard(JSON.stringify(inspectedSpan.output, null, 2))} className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded text-[11px] border border-slate-800">Copy Output</button>
                      </div>
                    </div>

                    {inspectedSpan.error && (
                      <div className="mt-1 mb-2 p-2 bg-rose-950/60 border border-rose-800 rounded text-rose-300 text-xs font-mono">
                        <div className="font-bold">❌ {inspectedSpan.error.error_type || 'Error'}: {inspectedSpan.error.message}</div>
                        {inspectedSpan.error.stack_trace && <pre className="text-[10px] text-rose-400 mt-1 whitespace-pre-wrap">{inspectedSpan.error.stack_trace}</pre>}
                      </div>
                    )}

                    <div className="flex-1 grid grid-cols-3 gap-3 overflow-hidden mt-1">
                      <div className="flex flex-col h-full overflow-hidden">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Input Payload</span>
                        <pre className="flex-1 bg-slate-950 p-2 rounded-lg border border-slate-800/80 text-[10px] text-slate-300 overflow-auto font-mono">
                          {JSON.stringify(inspectedSpan.input, null, 2)}
                        </pre>
                      </div>
                      <div className="flex flex-col h-full overflow-hidden">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Output Payload</span>
                        <pre className="flex-1 bg-slate-950 p-2 rounded-lg border border-slate-800/80 text-[10px] text-slate-300 overflow-auto font-mono">
                          {JSON.stringify(inspectedSpan.output, null, 2)}
                        </pre>
                      </div>
                      <div className="flex flex-col h-full overflow-hidden">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">LLM Token Metrics & Metadata</span>
                        <pre className="flex-1 bg-slate-950 p-2 rounded-lg border border-slate-800/80 text-[10px] text-emerald-300 overflow-auto font-mono">
                          {JSON.stringify(inspectedSpan.metrics, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 p-6 flex flex-col items-center justify-center text-slate-500">
                <div className="text-5xl mb-3">⚡</div>
                <p className="text-sm">Select a trace from the left sidebar to inspect.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: METRICS VIEW */}
      {activeTab === 'metrics' && (
        <div className="flex-1 p-6 overflow-y-auto bg-slate-950">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Enterprise AI Observability & Telemetry Analytics</h2>
                <p className="text-xs text-slate-400 mt-1">Real-time percentile distributions, model breakdown, token volume, and cost velocity.</p>
              </div>
              <button onClick={renderMetricsCharts} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow transition">Update Analytics</button>
            </div>

            {/* Metric Highlights Grid */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-[#0d111a] p-4 rounded-xl border border-[#1e2330]">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Latency SLA (P95 / P99)</span>
                <div className="text-lg font-bold text-indigo-400 mt-1">{p95} / {p99} ms</div>
                <span className="text-[10px] text-slate-500">Industry standard target: &lt; 500ms</span>
              </div>
              <div className="bg-[#0d111a] p-4 rounded-xl border border-[#1e2330]">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total LLM Tokens Processed</span>
                <div className="text-lg font-bold text-purple-400 mt-1">{formatNumber(totalTokens)}</div>
                <span className="text-[10px] text-slate-500">Prompt & completion throughput</span>
              </div>
              <div className="bg-[#0d111a] p-4 rounded-xl border border-[#1e2330]">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Average Cost per 1K Tokens</span>
                <div className="text-lg font-bold text-emerald-400 mt-1">${avgCost1k}</div>
                <span className="text-[10px] text-slate-500">Blended model efficiency rate</span>
              </div>
              <div className="bg-[#0d111a] p-4 rounded-xl border border-[#1e2330]">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Success vs Error Ratio</span>
                <div className="text-lg font-bold text-slate-200 mt-1">{successRatio}%</div>
                <span className="text-[10px] text-slate-500">System reliability score</span>
              </div>
            </div>

            {/* Model & Framework Breakdown Table */}
            <div className="bg-[#0d111a] rounded-xl border border-[#1e2330] overflow-hidden">
              <div className="p-4 border-b border-[#1e2330] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">🤖 LLM Model & Framework Intelligence Breakdown</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Granular token consumption, cost distribution, and latency by model/framework.</p>
                </div>
                <span className="px-2.5 py-1 bg-indigo-950 text-indigo-300 border border-indigo-800 text-xs font-mono rounded-lg">
                  {modelList.length} Models & Frameworks
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 border-b border-[#1e2330] uppercase text-[10px] font-bold text-slate-400 tracking-wider">
                    <tr>
                      <th className="p-3">Model / Provider</th>
                      <th className="p-3">Total Calls</th>
                      <th className="p-3">Prompt Tokens</th>
                      <th className="p-3">Completion Tokens</th>
                      <th className="p-3">Total Volume</th>
                      <th className="p-3">Total Spend ($)</th>
                      <th className="p-3">Avg Latency</th>
                      <th className="p-3 text-right">Cost / 1K Tokens</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                    {modelList.length === 0 ? (
                      <tr><td colSpan={8} className="p-4 text-center text-slate-500">No model telemetry available yet.</td></tr>
                    ) : (
                      modelList.map((m: any, idx: number) => {
                        const avgLat = m.calls > 0 ? (m.totalDuration / m.calls).toFixed(1) : '0.0';
                        const cost1k = m.totalTokens > 0 ? ((m.totalCost / m.totalTokens) * 1000).toFixed(4) : '0.0000';
                        return (
                          <tr key={idx} className="hover:bg-slate-900/60 transition">
                            <td className="p-3">
                              <div className="flex items-center space-x-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                                <span className="font-bold text-slate-200">{m.name}</span>
                              </div>
                            </td>
                            <td className="p-3 text-slate-300">{m.calls}</td>
                            <td className="p-3 text-purple-300">{formatNumber(m.promptTokens)}</td>
                            <td className="p-3 text-pink-300">{formatNumber(m.completionTokens)}</td>
                            <td className="p-3 font-semibold text-slate-100">{formatNumber(m.totalTokens)}</td>
                            <td className="p-3 text-emerald-400 font-semibold">${m.totalCost.toFixed(4)}</td>
                            <td className="p-3 text-indigo-300">{avgLat} ms</td>
                            <td className="p-3 text-right text-emerald-300 font-semibold">${cost1k}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4 Core Analytics Charts */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-[#0d111a] p-4 rounded-xl border border-[#1e2330] flex flex-col">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">🍩 Token Volume Distribution by Model</h3>
                <div className="flex-1 min-h-[220px]"><canvas id="chartTokensCanvas"></canvas></div>
              </div>
              <div className="bg-[#0d111a] p-4 rounded-xl border border-[#1e2330] flex flex-col">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">💵 Estimated Spend Distribution by Model ($)</h3>
                <div className="flex-1 min-h-[220px]"><canvas id="chartCostCanvas"></canvas></div>
              </div>
              <div className="bg-[#0d111a] p-4 rounded-xl border border-[#1e2330] flex flex-col">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">⚡ Execution Latency Timeline by Trace (ms)</h3>
                <div className="flex-1 min-h-[220px]"><canvas id="chartLatencyCanvas"></canvas></div>
              </div>
              <div className="bg-[#0d111a] p-4 rounded-xl border border-[#1e2330] flex flex-col">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">📈 Span Depth & Execution Throughput</h3>
                <div className="flex-1 min-h-[220px]"><canvas id="chartThroughputCanvas"></canvas></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ERRORS VIEW */}
      {activeTab === 'errors' && (
        <div className="flex-1 p-6 overflow-y-auto bg-slate-950">
          <div className="max-w-6xl mx-auto space-y-6">
            <h2 className="text-xl font-bold text-white">Error Debugger & Exception Fingerprints</h2>
            <div className="bg-[#0d111a] rounded-xl border border-[#1e2330] overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 border-b border-[#1e2330] uppercase text-[10px] font-bold text-slate-400 tracking-wider">
                  <tr>
                    <th className="p-3">Error Type</th>
                    <th className="p-3">Message</th>
                    <th className="p-3">Occurrences</th>
                    <th className="p-3">Latest Event</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {errors.length === 0 ? (
                    <tr><td colSpan={5} className="p-6 text-center text-slate-500">No errors detected. System operating normally.</td></tr>
                  ) : (
                    errors.map((e, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/50">
                        <td className="p-3 font-semibold text-rose-400 font-mono">{e.error_type}</td>
                        <td className="p-3 text-slate-200">{e.message}</td>
                        <td className="p-3"><span className="px-2 py-0.5 bg-rose-950 text-rose-300 border border-rose-800 rounded font-mono">{e.count}</span></td>
                        <td className="p-3 text-slate-400">{new Date(e.latest_occurrence).toLocaleTimeString()}</td>
                        <td className="p-3 text-right">
                          <button onClick={() => { setSelectedTraceId(e.sample_trace_id); setActiveTab('traces'); }} className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-slate-800 rounded text-[11px]">Inspect Trace</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Admin Modal */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d111a] border border-rose-900/60 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#1e2330] pb-3">
              <div className="flex items-center space-x-2">
                <span className="text-xl">🛡️</span>
                <h3 className="text-base font-bold text-white">Admin Telemetry Management</h3>
              </div>
              <button onClick={() => setIsAdminModalOpen(false)} className="text-slate-400 hover:text-white text-lg font-mono">&times;</button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-400">Authenticate with administrator credentials (default <code className="text-slate-200">admin:admin</code>) to purge or delete traces.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Username</label>
                  <input
                    type="text"
                    placeholder="admin"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Password</label>
                  <input
                    type="password"
                    placeholder="admin"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#1e2330]">
              <button
                onClick={adminBatchDeleteSelected}
                className="w-full py-2.5 bg-rose-700 hover:bg-rose-600 text-white font-semibold rounded-xl text-xs transition shadow-lg flex items-center justify-center space-x-2"
              >
                <span>🗑️ Delete Selected Traces ({selectedBatchIds.size})</span>
              </button>
              <button
                onClick={adminClearAll}
                className="w-full py-2.5 bg-slate-900 hover:bg-rose-950 text-rose-300 border border-rose-800/80 rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-2"
              >
                <span>🧹 Purge ALL Traces & Data</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
