import { API_URL, API_TOKEN } from './config';

const headers = {
  'Content-Type': 'application/json',
  'X-API-Token': API_TOKEN,
};

async function request(path, options = {}) {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, { headers, ...options });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Signals ──────────────────────────────────
export async function fetchSignals() {
  return request('/api/signals');
}

export async function fetchSignal(symbol) {
  return request(`/api/signals/${symbol.replace('/', '-')}`);
}

// ── Watchlist ────────────────────────────────
export async function fetchWatchlist() {
  return request('/api/watchlist');
}

export async function addToWatchlist(symbol, type = 'stock', name = '') {
  return request('/api/watchlist', {
    method: 'POST',
    body: JSON.stringify({ symbol, type, name: name || symbol }),
  });
}

export async function removeFromWatchlist(symbol) {
  return request(`/api/watchlist/${symbol.replace('/', '-')}`, {
    method: 'DELETE',
  });
}

// ── Candles ──────────────────────────────────
export async function fetchCandles(symbol, timeframe = '1H') {
  return request(`/api/candles/${symbol.replace('/', '-')}?timeframe=${timeframe}`);
}

// ── Backtest ─────────────────────────────────
export async function runBacktest(params) {
  return request('/api/backtest', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ── Alerts ───────────────────────────────────
export async function fetchAlerts(limit = 50, symbol = null) {
  let path = `/api/alerts?limit=${limit}`;
  if (symbol) path += `&symbol=${symbol.replace('/', '-')}`;
  return request(path);
}

// ── Health ───────────────────────────────────
export async function fetchHealth() {
  return request('/api/health');
}
