import React, { useEffect, useRef } from 'react';

declare const Chart: any;

interface TimeSeriesChartProps {
  data: Array<{
    time: string;
    total: number;
    success: number;
    error: number;
  }>;
  title?: string;
  height?: number;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  data,
  title = 'Traffic & Reliability (Requests over Time)',
  height = 180,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current || typeof Chart === 'undefined') return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const labels = data.map(d => d.time);
    const successData = data.map(d => d.success);
    const errorData = data.map(d => d.error);

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Successful Requests',
            data: successData,
            backgroundColor: 'rgba(99, 102, 241, 0.75)',
            hoverBackgroundColor: 'rgba(99, 102, 241, 0.95)',
            borderRadius: 3,
            stack: 'requests',
          },
          {
            label: 'Failed Requests',
            data: errorData,
            backgroundColor: 'rgba(244, 63, 94, 0.85)',
            hoverBackgroundColor: 'rgba(244, 63, 94, 1.0)',
            borderRadius: 3,
            stack: 'requests',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              color: '#94a3b8',
              font: { family: 'Inter', size: 11 },
            },
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: '#0f172a',
            borderColor: '#334155',
            borderWidth: 1,
            titleFont: { family: 'Inter', size: 12, weight: 'bold' },
            bodyFont: { family: 'JetBrains Mono', size: 11 },
            padding: 8,
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false, color: '#1e2330' },
            ticks: {
              color: '#64748b',
              font: { family: 'JetBrains Mono', size: 10 },
              maxRotation: 0,
            },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            grid: { color: 'rgba(30, 41, 59, 0.4)' },
            ticks: {
              color: '#64748b',
              font: { family: 'JetBrains Mono', size: 10 },
              precision: 0,
            },
          },
        },
      },
    });

    // ResizeObserver for instant container-level responsive redraw
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        if (chartInstanceRef.current) {
          chartInstanceRef.current.resize();
        }
      });
      ro.observe(containerRef.current);
      return () => {
        ro.disconnect();
        if (chartInstanceRef.current) {
          chartInstanceRef.current.destroy();
        }
      };
    }

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [data]);

  return (
    <div ref={containerRef} className="flex flex-col h-full w-full">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">
          {title}
        </h4>
        <span className="text-[11px] text-slate-400 font-mono">Bucket: Dynamic</span>
      </div>
      <div className="relative w-full flex-1" style={{ minHeight: `${height}px` }}>
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  );
};
