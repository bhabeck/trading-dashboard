import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, ComposedChart,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Activity, Eye, Bell, Plus, X, Search,
  ChevronLeft, Zap, Clock, Target, Shield, ArrowUpRight, ArrowDownRight,
  Loader, Wifi, WifiOff, RefreshCw, Trash2,
} from 'lucide-react';
import { createChart } from 'lightweight-charts';
import * as api from './api';
import { POLL_INTERVAL, DASHBOARD_PASSWORD } from './config';

// ═══════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════
const signalColor = (s) => {
  if (!s) return '#787b86';
  if (s.includes('STRONG_BUY')) return '#00e676';
  if (s.includes('BUY') || s.includes('LEAN_BUY')) return '#26a69a';
  if (s.includes('STRONG_SELL')) return '#ff1744';
  if (s.includes('SELL') || s.includes('LEAN_SELL')) return '#ef5350';
  return '#787b86';
};

const signalBg = (s) => {
  if (!s) return 'rgba(120,123,134,0.08)';
  if (s.includes('STRONG_BUY')) return 'rgba(0,230,118,0.12)';
  if (s.includes('BUY')) return 'rgba(38,166,154,0.12)';
  if (s.includes('STRONG_SELL')) return 'rgba(255,23,68,0.12)';
  if (s.includes('SELL')) return 'rgba(239,83,80,0.12)';
  return 'rgba(120,123,134,0.08)';
};

const formatPrice = (p, sym) => {
  if (p == null) return '—';
  if (sym?.includes('BTC')) return `$${Number(p).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${Number(p).toFixed(2)}`;
};

const formatTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString();
};

// ═══════════════════════════════════════════════
//  SMALL COMPONENTS
// ═══════════════════════════════════════════════
function SignalBadge({ signal }) {
  return (
    <span
      className="signal-badge"
      style={{ color: signalColor(signal), background: signalBg(signal) }}
    >
      {signal?.replace(/_/g, ' ') || 'N/A'}
    </span>
  );
}

function IndicatorDot({ value }) {
  const c = signalColor(value);
  return (
    <div
      title={value}
      style={{
        width: 8, height: 8, borderRadius: '50%',
        background: c, boxShadow: `0 0 6px ${c}40`,
      }}
    />
  );
}

function ScoreRing({ score = 50, size = 52 }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 65 ? '#26a69a' : score >= 40 ? '#787b86' : '#ef5350';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e222d" strokeWidth={3} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
        strokeWidth={3} strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s ease', filter: `drop-shadow(0 0 4px ${color}60)` }}
      />
      <text
        x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={14} fontWeight={700} fontFamily="var(--font-mono)"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
      >
        {score}
      </text>
    </svg>
  );
}

function LoadingCard() {
  return <div className="loading-shimmer" style={{ height: 180 }} />;
}

function StatCard({ label, value, color }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 14 }}>
      <div style={{ color: '#787b86', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
      <div className="mono" style={{ color: color || '#d1d4dc', fontSize: 22, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function IndicatorCard({ name, value, signal, desc }) {
  return (
    <div className="card" style={{ padding: 14, borderColor: `${signalColor(signal)}15` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ color: '#787b86', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 }}>{name}</span>
        <SignalBadge signal={signal} />
      </div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
      <div style={{ color: '#787b86', fontSize: 11, marginTop: 4 }}>{desc}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  CANDLESTICK CHART (TradingView Lightweight Charts)
// ═══════════════════════════════════════════════
function CandlestickChart({ candles = [], height = 320 }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#131722' },
        textColor: '#787b86',
        fontFamily: 'Inter, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1e222d' },
        horzLines: { color: '#1e222d' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: '#787b8640', labelBackgroundColor: '#2962ff' },
        horzLine: { color: '#787b8640', labelBackgroundColor: '#2962ff' },
      },
      rightPriceScale: {
        borderColor: '#1e222d',
      },
      timeScale: {
        borderColor: '#1e222d',
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height,
    });

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a80',
      wickDownColor: '#ef535080',
    });

    // Convert time strings to Unix timestamps
    const formattedData = candles.map((c) => ({
      time: Math.floor(new Date(c.time).getTime() / 1000),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    })).filter((c) => !isNaN(c.time)).sort((a, b) => a.time - b.time);

    if (formattedData.length > 0) {
      candleSeries.setData(formattedData);
    }

    // Volume histogram
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    const volumeData = candles.map((c) => ({
      time: Math.floor(new Date(c.time).getTime() / 1000),
      value: c.volume,
      color: c.close >= c.open ? '#26a69a30' : '#ef535030',
    })).filter((c) => !isNaN(c.time)).sort((a, b) => a.time - b.time);

    if (volumeData.length > 0) {
      volumeSeries.setData(volumeData);
    }

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, height]);

  return <div ref={containerRef} style={{ borderRadius: 8, overflow: 'hidden' }} />;
}

// ═══════════════════════════════════════════════
//  SPARKLINE (for watchlist cards)
// ═══════════════════════════════════════════════
function SparkLine({ candles = [], color = '#26a69a' }) {
  const data = candles.slice(-24).map((c, i) => ({ t: i, p: c.close }));
  if (data.length < 2) return <div style={{ height: 48 }} />;
  return (
    <div style={{ height: 48 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <YAxis domain={['dataMin', 'dataMax']} hide={true} />
          <defs>
            <linearGradient id={`sp-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone" dataKey="p"
            stroke={color} fill={`url(#sp-${color.replace('#', '')})`}
            strokeWidth={1.5} dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  PAGE: WATCHLIST
// ═══════════════════════════════════════════════
function WatchlistPage({ signals, candles, onSelect, onAdd, onRemove, loading }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [newType, setNewType] = useState('stock');

  const handleAdd = async () => {
    if (!newSymbol.trim()) return;
    await onAdd(newSymbol.trim().toUpperCase(), newType);
    setNewSymbol('');
    setShowAdd(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Watchlist</h1>
          <p style={{ color: '#787b86', fontSize: 13, marginTop: 4 }}>
            6 indicators per asset — click to drill in
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? <X size={14} /> : <Plus size={14} />}
          {showAdd ? 'Cancel' : 'Add Ticker'}
        </button>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Search size={16} color="#787b86" />
          <input
            className="input-search" value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Enter ticker (e.g. AAPL, ETH/USD)..."
            autoFocus
          />
          <select className="select" value={newType} onChange={(e) => setNewType(e.target.value)}>
            <option value="stock">Stock</option>
            <option value="crypto">Crypto</option>
          </select>
          <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={handleAdd}>
            Add
          </button>
        </div>
      )}

      {loading && signals.length === 0 ? (
        <div className="watchlist-grid">
          {[1, 2, 3, 4, 5].map((i) => <LoadingCard key={i} />)}
        </div>
      ) : (
        <div className="watchlist-grid">
          {signals.map((asset) => {
            const sparkCandles = candles[`${asset.symbol}:1H`] || [];
            const sparkColor = (asset.change_pct ?? 0) >= 0 ? '#26a69a' : '#ef5350';
            return (
              <div
                key={asset.symbol}
                className="card card-clickable"
                onClick={() => onSelect(asset.symbol)}
              >
                <div className="card-glow" style={{ background: `linear-gradient(90deg, ${signalColor(asset.signal)}40, transparent)` }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{asset.symbol}</span>
                      <span style={{ color: '#787b86', fontSize: 11, background: '#1e222d', padding: '2px 6px', borderRadius: 3 }}>
                        {asset.details?.trend || '—'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ScoreRing score={asset.score ?? 50} />
                    <button
                      className="btn-ghost"
                      onClick={(e) => { e.stopPropagation(); onRemove(asset.symbol); }}
                      title="Remove from watchlist"
                      style={{ color: '#787b8640', padding: 4 }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                  <span className="mono" style={{ fontSize: 22, fontWeight: 700 }}>
                    {formatPrice(asset.price, asset.symbol)}
                  </span>
                  <span style={{ color: (asset.change_pct ?? 0) >= 0 ? '#26a69a' : '#ef5350', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}>
                    {(asset.change_pct ?? 0) >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                    {Math.abs(asset.change_pct ?? 0).toFixed(2)}%
                  </span>
                </div>

                <SparkLine candles={sparkCandles} color={sparkColor} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <SignalBadge signal={asset.signal} />
                  <div style={{ display: 'flex', gap: 5 }}>
                    {asset.indicators && Object.values(asset.indicators).map((v, i) => (
                      <IndicatorDot key={i} value={v} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
//  PAGE: ASSET DETAIL
// ═══════════════════════════════════════════════
function AssetDetailPage({ symbol, signals, onBack }) {
  const [timeframe, setTimeframe] = useState('1H');
  const [candles, setCandles] = useState([]);
  const [loadingCandles, setLoadingCandles] = useState(true);

  const asset = signals.find((a) => a.symbol === symbol);
  const d = asset?.details || {};
  const ind = asset?.indicators || {};

  useEffect(() => {
    let cancelled = false;
    setLoadingCandles(true);
    api.fetchCandles(symbol, timeframe)
      .then((res) => { if (!cancelled) setCandles(res.candles || []); })
      .catch((err) => console.error('Candle fetch error:', err))
      .finally(() => { if (!cancelled) setLoadingCandles(false); });
    return () => { cancelled = true; };
  }, [symbol, timeframe]);

  // Compute RSI data from candles for sub-chart
  const rsiData = useMemo(() => {
    if (candles.length < 15) return [];
    const closes = candles.map((c) => c.close);
    const gains = [], losses = [];
    for (let i = 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      gains.push(diff > 0 ? diff : 0);
      losses.push(diff < 0 ? -diff : 0);
    }
    const period = 14;
    const rsi = [];
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push({ t: i, rsi: +(100 - 100 / (1 + rs)).toFixed(1) });
    }
    return rsi;
  }, [candles]);

  if (!asset) {
    return (
      <div>
        <button className="btn-ghost" onClick={onBack}><ChevronLeft size={16} /> Back</button>
        <p style={{ marginTop: 20, color: '#787b86' }}>No data available for {symbol}. Signal engine may still be loading.</p>
      </div>
    );
  }

  return (
    <div>
      <button className="btn-ghost" onClick={onBack} style={{ marginBottom: 16 }}>
        <ChevronLeft size={16} /> Back to Watchlist
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{asset.symbol}</h1>
            <SignalBadge signal={asset.signal} />
          </div>
          <p style={{ color: '#787b86', fontSize: 13, marginTop: 4 }}>
            {d.trend || 'Loading trend...'} — Updated {formatTime(asset.updated_at)}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="mono" style={{ fontSize: 28, fontWeight: 700 }}>
            {formatPrice(asset.price, asset.symbol)}
          </div>
          <span style={{ color: (asset.change_pct ?? 0) >= 0 ? '#26a69a' : '#ef5350', fontSize: 14, fontWeight: 600 }}>
            {(asset.change_pct ?? 0) >= 0 ? '+' : ''}{(asset.change_pct ?? 0).toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Timeframe Selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {['1H', '4H', '1D', '1W'].map((tf) => (
          <button key={tf} className={`btn-tf ${tf === timeframe ? 'active' : ''}`} onClick={() => setTimeframe(tf)}>
            {tf}
          </button>
        ))}
      </div>

      {/* Candlestick Chart */}
      <div className="chart-box" style={{ marginBottom: 12 }}>
        <div className="chart-label">Price — {timeframe}</div>
        {loadingCandles ? (
          <div className="loading-shimmer" style={{ height: 320 }} />
        ) : (
          <CandlestickChart candles={candles} height={320} />
        )}
      </div>

      {/* RSI + Volume Sub-Charts */}
      <div className="chart-sub-grid" style={{ marginBottom: 20 }}>
        <div className="chart-box">
          <div className="chart-label">RSI (14) — {d.rsi ?? '—'}</div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={rsiData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e222d" />
              <YAxis domain={[0, 100]} tick={{ fill: '#787b86', fontSize: 9 }} tickLine={false} axisLine={false} ticks={[30, 50, 70]} />
              <ReferenceLine y={70} stroke="#ef535040" strokeDasharray="3 3" />
              <ReferenceLine y={30} stroke="#26a69a40" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="rsi" stroke="#e040fb" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-box">
          <div className="chart-label">Volume</div>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={candles.slice(-40).map((c, i) => ({ t: i, v: c.volume, color: c.close >= c.open ? '#26a69a40' : '#ef535040' }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e222d" />
              <Bar dataKey="v" fill="#2962ff40" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Support / Resistance / Confluence */}
      <div className="sr-grid" style={{ marginBottom: 20 }}>
        <div className="card" style={{ padding: 14, borderLeft: '3px solid #26a69a' }}>
          <div style={{ color: '#787b86', fontSize: 11, textTransform: 'uppercase' }}>Support</div>
          <div className="mono" style={{ color: '#26a69a', fontSize: 20, fontWeight: 700 }}>
            {formatPrice(d.support, asset.symbol)}
          </div>
        </div>
        <div className="card" style={{ padding: 14, borderLeft: '3px solid #ef5350' }}>
          <div style={{ color: '#787b86', fontSize: 11, textTransform: 'uppercase' }}>Resistance</div>
          <div className="mono" style={{ color: '#ef5350', fontSize: 20, fontWeight: 700 }}>
            {formatPrice(d.resistance, asset.symbol)}
          </div>
        </div>
        <div className="card" style={{ padding: 14, borderLeft: '3px solid #2962ff' }}>
          <div style={{ color: '#787b86', fontSize: 11, textTransform: 'uppercase' }}>Confluence</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ScoreRing score={asset.score ?? 50} size={40} />
            <span style={{ fontSize: 13 }}>
              {(asset.score ?? 50) >= 65 ? 'Bullish' : (asset.score ?? 50) <= 35 ? 'Bearish' : 'Mixed'}
            </span>
          </div>
        </div>
      </div>

      {/* Indicator Breakdown */}
      <h3 style={{ color: '#787b86', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
        Indicator Breakdown
      </h3>
      <div className="indicator-grid">
        <IndicatorCard
          name="RSI (14)" value={d.rsi ?? '—'} signal={ind.rsi}
          desc={d.rsi < 30 ? 'Oversold — momentum exhausted' : d.rsi > 70 ? 'Overbought — pullback likely' : 'Neutral range'}
        />
        <IndicatorCard
          name="MACD" value={d.macd != null ? d.macd.toFixed(2) : '—'} signal={ind.macd}
          desc={d.macd > d.macd_signal ? 'MACD above signal — bullish momentum' : 'MACD below signal — bearish pressure'}
        />
        <IndicatorCard
          name="Bollinger Bands"
          value={d.bb_lower != null ? `${formatPrice(d.bb_lower, symbol)} – ${formatPrice(d.bb_upper, symbol)}` : '—'}
          signal={ind.bollinger}
          desc={asset.price < d.bb_lower ? 'Below lower band — oversold' : asset.price > d.bb_upper ? 'Above upper band — overbought' : 'Within bands'}
        />
        <IndicatorCard
          name="EMA Cross (9/21)"
          value={d.ema9 != null ? `${formatPrice(d.ema9, symbol)} / ${formatPrice(d.ema21, symbol)}` : '—'}
          signal={ind.ema_cross}
          desc={d.ema9 > d.ema21 ? '9 EMA above 21 — short-term bullish' : '9 EMA below 21 — short-term bearish'}
        />
        <IndicatorCard
          name="Volume" value={d.volume_ratio != null ? `${d.volume_ratio}x avg` : '—'} signal={ind.volume}
          desc={d.volume_ratio > 1.5 ? 'Volume spike — confirms move' : 'Normal volume — no conviction'}
        />
        <IndicatorCard
          name="Stochastic RSI"
          value={d.stoch_k != null ? `K: ${d.stoch_k} / D: ${d.stoch_d}` : '—'}
          signal={ind.stoch_rsi}
          desc={d.stoch_k < 20 ? 'Deep oversold — reversal zone' : d.stoch_k > 80 ? 'Overbought — caution' : 'Mid range'}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
//  PAGE: BACKTESTER
// ═══════════════════════════════════════════════
function BacktestPage({ watchlist }) {
  const symbols = watchlist.map((a) => a.symbol);
  const [params, setParams] = useState({
    symbol: symbols[0] || 'BTC/USD',
    start_date: '2026-06-01',
    end_date: '2026-07-01',
    dip_pct: 3.0,
    rsi_threshold: 40,
    tp_pct: 4.0,
    sl_pct: 4.0,
  });
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await api.runBacktest(params);
      if (res.error) {
        setError(res.error);
      } else {
        setResults(res);
      }
    } catch (err) {
      setError(err.message);
    }
    setRunning(false);
  };

  const set = (key, val) => setParams((p) => ({ ...p, [key]: val }));

  const fields = [
    { label: 'Asset', key: 'symbol', type: 'select', options: symbols },
    { label: 'Start Date', key: 'start_date', type: 'date' },
    { label: 'End Date', key: 'end_date', type: 'date' },
    { label: 'Dip %', key: 'dip_pct', type: 'number', step: 0.5 },
    { label: 'RSI Threshold', key: 'rsi_threshold', type: 'number', step: 5 },
    { label: 'Take Profit %', key: 'tp_pct', type: 'number', step: 0.5 },
    { label: 'Stop Loss %', key: 'sl_pct', type: 'number', step: 0.5 },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Backtester</h1>
      <p style={{ color: '#787b86', fontSize: 13, margin: '0 0 24px' }}>
        Test parameter combinations against real historical data from Alpaca
      </p>

      {/* Parameter Form */}
      <div className="card" style={{ marginBottom: 24, padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14, marginBottom: 16 }}>
          {fields.map((f) => (
            <div key={f.key}>
              <label style={{ color: '#787b86', fontSize: 11, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {f.label}
              </label>
              {f.type === 'select' ? (
                <select className="input" style={{ fontFamily: 'var(--font-sans)' }} value={params[f.key]} onChange={(e) => set(f.key, e.target.value)}>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === 'date' ? (
                <input type="date" className="input" value={params[f.key]} onChange={(e) => set(f.key, e.target.value)} />
              ) : (
                <input type="number" className="input" value={params[f.key]} step={f.step} onChange={(e) => set(f.key, +e.target.value)} />
              )}
            </div>
          ))}
        </div>
        <button className="btn-primary" onClick={handleRun} disabled={running} style={{ padding: '10px 28px', fontSize: 14 }}>
          {running ? <><Loader size={14} className="spinner" /> Running...</> : <><Zap size={14} /> Run Backtest</>}
        </button>
        {error && <p style={{ color: '#ef5350', fontSize: 13, marginTop: 10 }}>{error}</p>}
      </div>

      {/* Results */}
      {results && (
        <>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <StatCard label="Trades" value={results.total_trades} />
            <StatCard label="Win Rate" value={`${results.win_rate}%`} color={results.win_rate >= 50 ? '#26a69a' : '#ef5350'} />
            <StatCard label="Net P&L" value={`$${results.net_pnl?.toLocaleString()}`} color={results.net_pnl >= 0 ? '#26a69a' : '#ef5350'} />
            <StatCard label="Avg Win" value={`$${results.avg_win}`} color="#26a69a" />
            <StatCard label="Avg Loss" value={`$${results.avg_loss}`} color="#ef5350" />
            <StatCard label="Max DD" value={`$${results.max_drawdown}`} color="#ef5350" />
          </div>

          {/* Equity Curve */}
          {results.equity_curve && (
            <div className="chart-box" style={{ marginBottom: 20 }}>
              <div className="chart-label">Equity Curve</div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={results.equity_curve}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={results.net_pnl >= 0 ? '#26a69a' : '#ef5350'} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={results.net_pnl >= 0 ? '#26a69a' : '#ef5350'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e222d" />
                  <XAxis dataKey="time" tick={false} axisLine={{ stroke: '#1e222d' }} />
                  <YAxis tick={{ fill: '#787b86', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <ReferenceLine y={0} stroke="#787b86" strokeDasharray="3 3" />
                  <Tooltip
                    contentStyle={{ background: '#1e222d', border: '1px solid #2a2e39', borderRadius: 6, color: '#d1d4dc', fontSize: 12 }}
                    formatter={(v) => [`$${v.toFixed(2)}`, 'Equity']}
                  />
                  <Area type="monotone" dataKey="equity" stroke={results.net_pnl >= 0 ? '#26a69a' : '#ef5350'} fill="url(#eqGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Trade Log */}
          {results.trades && results.trades.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="chart-label" style={{ padding: '12px 16px 8px' }}>Trade Log</div>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                <table className="trade-table">
                  <thead>
                    <tr>
                      {['#', 'Result', 'Entry', 'Exit', 'Change', 'P&L'].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.trades.map((t, i) => (
                      <tr key={i}>
                        <td className="mono" style={{ color: '#787b86' }}>{i + 1}</td>
                        <td><span style={{ color: t.result === 'WIN' ? '#26a69a' : '#ef5350', fontWeight: 600 }}>{t.result}</span></td>
                        <td className="mono">${t.entry_price}</td>
                        <td className="mono">${t.exit_price}</td>
                        <td className="mono" style={{ color: t.pct >= 0 ? '#26a69a' : '#ef5350' }}>{t.pct >= 0 ? '+' : ''}{t.pct}%</td>
                        <td className="mono" style={{ color: t.pnl >= 0 ? '#26a69a' : '#ef5350', fontWeight: 600 }}>{t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
//  PAGE: ALERT HISTORY
// ═══════════════════════════════════════════════
function AlertsPage({ watchlist }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    api.fetchAlerts(100)
      .then(setAlerts)
      .catch((err) => console.error('Alert fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'ALL' ? alerts : alerts.filter((a) => a.symbol === filter);
  const symbols = ['ALL', ...new Set(alerts.map((a) => a.symbol))];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Alert History</h1>
      <p style={{ color: '#787b86', fontSize: 13, margin: '0 0 20px' }}>
        Signals the engine has flagged — review accuracy over time
      </p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {symbols.map((f) => (
          <button
            key={f}
            className={`btn-tf ${f === filter ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4].map((i) => <div key={i} className="loading-shimmer" style={{ height: 64 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: '#787b86' }}>
          <Bell size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p>No alerts yet. The engine will fire alerts when 4+ indicators align.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((alert, i) => {
            const emoji = alert.signal?.includes('BUY') ? '🟢' : '🔴';
            return (
              <div
                key={i}
                className="card"
                style={{
                  padding: 14, display: 'flex', alignItems: 'center', gap: 14,
                  borderLeft: `3px solid ${signalColor(alert.signal)}`,
                }}
              >
                <div style={{ fontSize: 20 }}>{emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{alert.symbol}</span>
                    <SignalBadge signal={alert.signal} />
                  </div>
                  <div style={{ color: '#787b86', fontSize: 12, marginTop: 2 }}>
                    Score: {alert.score}/100 — Price: {formatPrice(alert.price, alert.symbol)}
                  </div>
                </div>
                <div style={{ color: '#787b86', fontSize: 11, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div>{formatDate(alert.timestamp)}</div>
                  <div>{formatTime(alert.timestamp)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════
const NAV_ITEMS = [
  { id: 'watchlist', icon: Eye, label: 'Watchlist' },
  { id: 'alerts', icon: Bell, label: 'Alerts' },
  { id: 'backtest', icon: Target, label: 'Backtest' },
];

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => {
    return sessionStorage.getItem('trading_auth') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [page, setPage] = useState('watchlist');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [signals, setSignals] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [candles, setCandles] = useState({});
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleLogin = () => {
    if (passwordInput === DASHBOARD_PASSWORD) {
      sessionStorage.setItem('trading_auth', 'true');
      setAuthenticated(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  // ── Fetch signals + watchlist ──
  const refresh = useCallback(async () => {
    try {
      const [sigs, wl] = await Promise.all([
        api.fetchSignals(),
        api.fetchWatchlist(),
      ]);
      setSignals(sigs);
      setWatchlist(wl);
      setConnected(true);

      // Fetch sparkline candles for each asset
      const candlePromises = sigs.map(async (s) => {
        try {
          const res = await api.fetchCandles(s.symbol, '1H');
          return [`${s.symbol}:1H`, res.candles || []];
        } catch {
          return [`${s.symbol}:1H`, []];
        }
      });
      const candleResults = await Promise.all(candlePromises);
      const candleMap = {};
      candleResults.forEach(([key, data]) => { candleMap[key] = data; });
      setCandles(candleMap);
    } catch (err) {
      console.error('Refresh error:', err);
      setConnected(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [refresh]);

  // ── Watchlist actions ──
  const handleAdd = async (symbol, type) => {
    // Check locally first before hitting the API
    if (watchlist.some((a) => a.symbol === symbol.toUpperCase())) {
      alert(`${symbol} is already in your watchlist`);
      return;
    }
    try {
      await api.addToWatchlist(symbol, type);
      await refresh();
    } catch (err) {
      if (err.message.includes('409')) {
        alert(`${symbol} is already in your watchlist`);
      } else if (err.message.includes('400')) {
        alert(`Invalid ticker symbol — check the format (e.g. AAPL, BTC/USD)`);
      } else {
        alert(`Failed to add ${symbol} — please try again`);
      }
    }
  };

  const handleRemove = async (symbol) => {
    if (!confirm(`Remove ${symbol} from watchlist?`)) return;
    try {
      await api.removeFromWatchlist(symbol);
      await refresh();
    } catch (err) {
      alert(`Failed to remove ${symbol} — please try again`);
    }
  };

  const handleSelect = (symbol) => {
    setSelectedAsset(symbol);
    setPage('detail');
  };

  // ── Password Gate ──
  if (DASHBOARD_PASSWORD && !authenticated) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0b0e17', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)',
      }}>
        <div style={{
          background: '#131722', borderRadius: 12, padding: 40, width: 360,
          border: '1px solid #2a2e39', textAlign: 'center',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 10,
            background: 'linear-gradient(135deg, #2962ff, #26a69a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', fontSize: 22, fontWeight: 900, color: '#fff',
          }}>H</div>
          <h1 style={{ color: '#d1d4dc', fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>
            Trading Dashboard
          </h1>
          <p style={{ color: '#787b86', fontSize: 13, margin: '0 0 24px' }}>
            Enter password to continue
          </p>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Password"
            autoFocus
            style={{
              width: '100%', boxSizing: 'border-box', background: '#1e222d',
              color: '#d1d4dc', border: `1px solid ${passwordError ? '#ef5350' : '#2a2e39'}`,
              borderRadius: 6, padding: '12px 14px', fontSize: 14,
              outline: 'none', marginBottom: 12, fontFamily: 'var(--font-sans)',
            }}
          />
          {passwordError && (
            <p style={{ color: '#ef5350', fontSize: 12, margin: '0 0 12px' }}>
              Incorrect password
            </p>
          )}
          <button
            onClick={handleLogin}
            style={{
              width: '100%', background: '#2962ff', color: '#fff', border: 'none',
              borderRadius: 6, padding: '12px', fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="nav-logo">H</div>

        {NAV_ITEMS.map((n) => {
          const active = page === n.id || (n.id === 'watchlist' && page === 'detail');
          return (
            <button
              key={n.id}
              className={`nav-btn ${active ? 'active' : ''}`}
              onClick={() => { setPage(n.id); setSelectedAsset(null); }}
              title={n.label}
            >
              <n.icon size={20} />
            </button>
          );
        })}

        <div style={{ flex: 1 }} />

        <button className="nav-btn" onClick={refresh} title="Refresh data">
          <RefreshCw size={16} />
        </button>

        <div
          className={`status-dot ${connected ? 'connected' : 'disconnected'}`}
          title={connected ? 'Engine connected' : 'Engine offline'}
        />
        <div style={{ color: '#787b86', fontSize: 9, marginBottom: 16, writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          {connected ? 'LIVE' : 'OFFLINE'}
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {page === 'watchlist' && (
          <WatchlistPage
            signals={signals}
            candles={candles}
            onSelect={handleSelect}
            onAdd={handleAdd}
            onRemove={handleRemove}
            loading={loading}
          />
        )}
        {page === 'detail' && selectedAsset && (
          <AssetDetailPage
            symbol={selectedAsset}
            signals={signals}
            onBack={() => setPage('watchlist')}
          />
        )}
        {page === 'backtest' && <BacktestPage watchlist={watchlist} />}
        {page === 'alerts' && <AlertsPage watchlist={watchlist} />}
      </div>
    </div>
  );
}
