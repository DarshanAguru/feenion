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

export interface CurrencyConfig {
  code: string;
  name: string;
  symbol: string;
  rate: number; // 1 USD = X Currency
  flag: string;
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', rate: 1.0, flag: '🇺🇸' },
  INR: { code: 'INR', name: 'Indian Rupee', symbol: '₹', rate: 87.2, flag: '🇮🇳' },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', rate: 0.92, flag: '🇪🇺' },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', rate: 0.78, flag: '🇬🇧' },
  CNY: { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', rate: 7.24, flag: '🇨🇳' },
  JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '¥', rate: 153.5, flag: '🇯🇵' },
};

export function getActiveCurrency(): CurrencyConfig {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('feenion_currency');
      if (saved && SUPPORTED_CURRENCIES[saved]) {
        const cfg = { ...SUPPORTED_CURRENCIES[saved] };
        
        // 1. Check user custom manual override
        const customRate = localStorage.getItem(`feenion_fx_${saved}`);
        if (customRate && !isNaN(Number(customRate)) && Number(customRate) > 0) {
          cfg.rate = Number(customRate);
          return cfg;
        }

        // 2. Check cached live open-source FX rate
        const liveRatesStr = localStorage.getItem('feenion_live_fx_rates');
        if (liveRatesStr) {
          const liveRates = JSON.parse(liveRatesStr);
          if (liveRates && liveRates[saved] && typeof liveRates[saved] === 'number') {
            cfg.rate = liveRates[saved];
            return cfg;
          }
        }

        return cfg;
      }
    }
  } catch (e) {}
  return SUPPORTED_CURRENCIES.USD;
}

export function setActiveCurrency(code: string, customRate?: number): void {
  if (typeof window !== 'undefined' && window.localStorage && SUPPORTED_CURRENCIES[code]) {
    localStorage.setItem('feenion_currency', code);
    if (customRate !== undefined && customRate > 0) {
      localStorage.setItem(`feenion_fx_${code}`, String(customRate));
    }
    window.dispatchEvent(new Event('feenion_currency_changed'));
  }
}

export async function fetchLiveExchangeRates(): Promise<{
  success: boolean;
  source: string;
  rates: Record<string, number>;
  lastUpdated: string;
}> {
  const sources = [
    {
      name: 'Open ER-API (open.er-api.com)',
      url: 'https://open.er-api.com/v6/latest/USD',
      extract: (data: any) => data.rates,
    },
    {
      name: 'ExchangeRate-API (api.exchangerate-api.com)',
      url: 'https://api.exchangerate-api.com/v4/latest/USD',
      extract: (data: any) => data.rates,
    },
    {
      name: 'FawazAhmed Currency CDN',
      url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
      extract: (data: any) => {
        const u = data.usd || {};
        return {
          INR: u.inr,
          EUR: u.eur,
          GBP: u.gbp,
          CNY: u.cny,
          JPY: u.jpy,
          USD: 1.0,
        };
      },
    },
  ];

  for (const src of sources) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(src.url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        const rawRates = src.extract(json);
        if (rawRates && typeof rawRates === 'object') {
          const extracted: Record<string, number> = { USD: 1.0 };
          
          Object.keys(SUPPORTED_CURRENCIES).forEach((code) => {
            const val = rawRates[code] || rawRates[code.toLowerCase()];
            if (typeof val === 'number' && val > 0) {
              extracted[code] = Math.round(val * 1000) / 1000;
              SUPPORTED_CURRENCIES[code].rate = extracted[code];
            }
          });

          const timestamp = new Date().toLocaleTimeString();
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem('feenion_live_fx_rates', JSON.stringify(extracted));
            localStorage.setItem('feenion_live_fx_source', src.name);
            localStorage.setItem('feenion_live_fx_last_updated', timestamp);
          }
          window.dispatchEvent(new Event('feenion_currency_changed'));
          return { success: true, source: src.name, rates: extracted, lastUpdated: timestamp };
        }
      }
    } catch (err) {
      // Try next fallback endpoint
      continue;
    }
  }

  // If all live APIs fail, fallback to latest hardcoded defaults
  const fallbackRates: Record<string, number> = {};
  Object.keys(SUPPORTED_CURRENCIES).forEach((code) => {
    fallbackRates[code] = SUPPORTED_CURRENCIES[code].rate;
  });

  return {
    success: false,
    source: 'Built-in Fallback Catalog',
    rates: fallbackRates,
    lastUpdated: 'Offline / Built-in',
  };
}

export function formatCost(cost: number | null | undefined): string {
  const curr = getActiveCurrency();
  if (cost === null || cost === undefined || isNaN(cost)) return `${curr.symbol}0.00`;
  
  const converted = cost * curr.rate;
  if (converted === 0) return `${curr.symbol}0.00`;
  
  const isNeg = converted < 0;
  const abs = Math.abs(converted);
  const sign = isNeg ? '-' : '';

  if (abs < 0.0001) return `${sign}<${curr.symbol}0.0001`;
  if (abs < 0.01) return `${sign}${curr.symbol}${abs.toFixed(4)}`;
  if (abs < 1) return `${sign}${curr.symbol}${abs.toFixed(3)}`;
  return `${sign}${curr.symbol}${abs.toFixed(2)}`;
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
