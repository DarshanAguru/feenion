import React, { useEffect, useRef } from 'react';
import { SpanPayload } from '../../types';
import { formatDuration } from '../../utils/formatters';

declare const d3: any;

interface TraceMindMapProps {
  spans: SpanPayload[];
  selectedSpanId: string | null;
  onSelectSpan: (span: SpanPayload) => void;
}

export const TraceMindMap: React.FC<TraceMindMapProps> = ({
  spans,
  selectedSpanId,
  onSelectSpan,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const renderMindMap = () => {
    if (!containerRef.current || !spans || spans.length === 0 || typeof d3 === 'undefined') return;

    const width = containerRef.current.clientWidth || 900;
    const height = containerRef.current.clientHeight || 520;

    // Clear previous elements
    d3.select(svgRef.current).selectAll('*').remove();

    const spanMap = new Map<string, any>();
    spans.forEach(s => spanMap.set(s.span_id, { ...s, children: [] }));

    let rootNode: any = null;
    spanMap.forEach(node => {
      if (node.parent_span_id && spanMap.has(node.parent_span_id)) {
        spanMap.get(node.parent_span_id).children.push(node);
      } else if (!rootNode) {
        rootNode = node;
      }
    });

    if (!rootNode && spans.length > 0) {
      rootNode = spanMap.get(spans[0].span_id);
    }
    if (!rootNode) return;

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height]);

    const g = svg.append('g');

    const zoom = d3
      .zoom()
      .scaleExtent([0.2, 4])
      .on('zoom', (event: any) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    const treeLayout = d3.tree().nodeSize([54, 240]);
    const hierarchyRoot = d3.hierarchy(rootNode);
    treeLayout(hierarchyRoot);

    // Compute bounding box to center graph precisely in viewport
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    hierarchyRoot.each((d: any) => {
      if (d.x < minX) minX = d.x;
      if (d.x > maxX) maxX = d.x;
      if (d.y < minY) minY = d.y;
      if (d.y > maxY) maxY = d.y;
    });

    // In horizontal layout, d.y is horizontal (width) and d.x is vertical (height)
    const treeWidth = (maxY - minY) || 100;
    const treeHeight = (maxX - minX) || 100;
    const centerX = (minY + maxY) / 2;
    const centerY = (minX + maxX) / 2;

    const scale = Math.min(1.0, Math.max(0.4, Math.min((width - 160) / treeWidth, (height - 120) / treeHeight)));
    const translateX = (width / 2) - (centerX * scale);
    const translateY = (height / 2) - (centerY * scale);

    // Links
    g.selectAll('.link')
      .data(hierarchyRoot.links())
      .enter()
      .append('path')
      .attr('class', 'flow-link')
      .attr('fill', 'none')
      .attr('stroke', (d: any) => (d.target.data.status === 'error' ? '#f43f5e' : '#6366f1'))
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5')
      .attr(
        'd',
        d3
          .linkHorizontal()
          .x((d: any) => d.y)
          .y((d: any) => d.x)
      );

    // Nodes
    const node = g
      .selectAll('.node')
      .data(hierarchyRoot.descendants())
      .enter()
      .append('g')
      .attr(
        'class',
        (d: any) =>
          `node cursor-pointer transition-all ${
            d.data.status === 'error'
              ? 'node-error'
              : d.data.span_type === 'llm'
              ? 'node-llm'
              : d.data.span_type === 'retrieval'
              ? 'node-retrieval'
              : d.data.span_type === 'tool'
              ? 'node-tool'
              : ''
          }`
      )
      .attr('transform', (d: any) => `translate(${d.y},${d.x})`)
      .on('click', (_: any, d: any) => {
        onSelectSpan(d.data);
      });

    // Node Circles
    node
      .append('circle')
      .attr('r', (d: any) => (d.data.span_id === selectedSpanId ? 11 : 8))
      .attr('stroke-width', (d: any) => (d.data.span_id === selectedSpanId ? 3.5 : 2))
      .attr('stroke', (d: any) =>
        d.data.span_id === selectedSpanId ? '#38bdf8' : d.data.status === 'error' ? '#f43f5e' : '#818cf8'
      );

    // Node Labels
    node
      .append('text')
      .attr('dy', '0.31em')
      .attr('x', (d: any) => (d.children ? -14 : 14))
      .attr('text-anchor', (d: any) => (d.children ? 'end' : 'start'))
      .text((d: any) => {
        const dur = d.data.duration_ms ? ` (${formatDuration(d.data.duration_ms)})` : '';
        return `${d.data.name}${dur}`;
      })
      .attr('fill', (d: any) => (d.data.span_id === selectedSpanId ? '#38bdf8' : '#e2e8f0'))
      .attr('font-weight', (d: any) => (d.data.span_id === selectedSpanId ? 'bold' : 'normal'))
      .style('font-family', 'JetBrains Mono, monospace')
      .style('font-size', '11px');

    // Apply Center Transform
    svg.call(zoom.transform, d3.zoomIdentity.translate(translateX, translateY).scale(scale));
  };

  useEffect(() => {
    renderMindMap();

    // Auto-resize on container resize
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        renderMindMap();
      });
      ro.observe(containerRef.current);
      return () => ro.disconnect();
    }
  }, [spans, selectedSpanId]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[460px] bg-[#080b11] border border-[#1e2330] rounded-lg overflow-hidden flex flex-col"
    >
      <div className="absolute top-3 left-3 z-10 bg-[#0d111a]/80 backdrop-blur border border-[#1e2330] rounded px-2.5 py-1 text-[11px] font-mono text-slate-300 pointer-events-none">
        DAG Execution Mind Map &bull; Auto-Centered &bull; Drag to pan, scroll to zoom
      </div>

      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-3 bg-[#0d111a]/90 backdrop-blur border border-[#1e2330] rounded px-3 py-1.5 text-[10px] font-mono text-slate-300">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          <span>LLM</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>Retrieval</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cyan-500" />
          <span>Tool</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span>Error</span>
        </div>
      </div>

      <svg ref={svgRef} className="w-full h-full mindmap-svg flex-1"></svg>
    </div>
  );
};
