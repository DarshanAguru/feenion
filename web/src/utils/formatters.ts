export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '0';
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toLocaleString();
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || isNaN(ms)) return '0ms';
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = ((ms % 60000) / 1000).toFixed(1);
  return `${mins}m ${secs}s`;
}

export function formatCost(cost: number | null | undefined): string {
  if (cost === null || cost === undefined || isNaN(cost)) return '$0.00';
  if (cost === 0) return '$0.00';
  const isNeg = cost < 0;
  const abs = Math.abs(cost);
  const sign = isNeg ? '-' : '';

  if (abs < 0.0001) return `${sign}<$0.0001`;
  if (abs < 0.01) return `${sign}$${abs.toFixed(4)}`;
  if (abs < 1) return `${sign}$${abs.toFixed(3)}`;
  return `${sign}$${abs.toFixed(2)}`;
}

export function parseDate(isoStr: string | number | null | undefined): Date | null {
  if (!isoStr) return null;
  if (typeof isoStr === 'number') return new Date(isoStr);
  let str = String(isoStr).trim();
  if (!str) return null;
  // If it's an ISO string without Z and without timezone offset (+/-), treat as UTC by appending Z
  if (str.includes('T') && !str.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(str)) {
    str += 'Z';
  } else if (!str.includes('T') && str.includes(' ') && !str.endsWith('Z')) {
    str = str.replace(' ', 'T') + 'Z';
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function formatTimestamp(isoStr: string | null | undefined): string {
  const d = parseDate(isoStr);
  if (!d) return '--:--:--';
  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

export function formatRelativeTime(isoStr: string | null | undefined): string {
  const d = parseDate(isoStr);
  if (!d) return 'unknown';
  const now = Date.now();
  const diffSec = Math.floor((now - d.getTime()) / 1000);

  // If clock skew or future timestamp
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const days = Math.floor(diffSec / 86400);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function truncateText(text: string | null | undefined, maxLen = 60): string {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}
