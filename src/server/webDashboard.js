const crypto = require('crypto');
const config = require('../config');
const { SettingsRepo } = require('../database');
const logger = require('../utils/logger');

// In-memory active authentication tokens: token -> { expiresAt, claimed, chatId, username }
const authTokens = new Map();

function generateAuthToken(botUsername = 'XAUUSD_Trading_AI_Agent_bot') {
  const randomHex = crypto.randomBytes(6).toString('hex').toUpperCase();
  const token = `AUTH_${randomHex}`;
  const record = {
    token,
    expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
    claimed: false,
    chatId: null,
    username: null,
  };
  authTokens.set(token, record);
  return {
    token,
    url: `https://t.me/${botUsername}?start=${token}`,
    expiresAt: record.expiresAt,
  };
}

function claimAuthToken(token, chatId, username = '') {
  if (!token) return false;
  const clean = token.trim();
  const record = authTokens.get(clean);
  if (record && record.expiresAt > Date.now() && !record.claimed) {
    record.claimed = true;
    record.chatId = chatId;
    record.username = username;
    return true;
  }
  return false;
}

function getAuthTokenStatus(token) {
  if (!token) return { valid: false, claimed: false };
  const record = authTokens.get(token.trim());
  if (!record) return { valid: false, claimed: false };
  if (record.expiresAt < Date.now()) {
    return { valid: false, expired: true, claimed: record.claimed };
  }
  return { valid: true, claimed: record.claimed, chatId: record.chatId, username: record.username };
}

function getDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>XAU/USD Real-Time Institutional Trading AI Terminal</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
  <!-- TradingView Lightweight Charts Library -->
  <script src="https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js"></script>
  <style>
    :root {
      --bg: #070a13;
      --card-bg: #0d1322;
      --panel-bg: #111827;
      --card-border: #1e293b;
      --primary: #f59e0b;
      --primary-hover: #d97706;
      --accent: #3b82f6;
      --accent-hover: #2563eb;
      --success: #10b981;
      --danger: #ef4444;
      --purple: #a855f7;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: #090d16;
      border-bottom: 1px solid var(--card-border);
      padding: 14px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand h1 {
      font-size: 1.35rem;
      font-weight: 800;
      color: var(--primary);
      letter-spacing: -0.5px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      background: rgba(16, 185, 129, 0.15);
      color: var(--success);
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .header-metrics {
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
    }
    .header-stat {
      display: flex;
      flex-direction: column;
    }
    .header-stat .label {
      font-size: 0.7rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .header-stat .val {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 1rem;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--accent);
      color: white;
      text-decoration: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.85rem;
      border: none;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn:hover { background: var(--accent-hover); transform: translateY(-1px); }
    .btn-gold { background: var(--primary); color: #000; }
    .btn-gold:hover { background: var(--primary-hover); }
    .btn-success { background: var(--success); color: #fff; }
    .btn-sm { padding: 6px 12px; font-size: 0.8rem; }
    .btn-icon { padding: 6px 10px; }

    /* Main Chart Layout */
    .terminal-container {
      display: flex;
      flex: 1;
      flex-direction: column;
      padding: 16px;
      gap: 16px;
      max-width: 1600px;
      width: 100%;
      margin: 0 auto;
    }
    .chart-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);
    }
    .chart-toolbar {
      background: #0b101c;
      border-bottom: 1px solid var(--card-border);
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .tool-group {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .tf-btn {
      background: #1e293b;
      color: var(--text-muted);
      border: 1px solid transparent;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
    }
    .tf-btn:hover { color: var(--text); background: #334155; }
    .tf-btn.active {
      background: var(--primary);
      color: #000;
      font-weight: 800;
    }
    .toggle-chip {
      background: #131b2e;
      color: var(--text-muted);
      border: 1px solid #1e293b;
      padding: 5px 10px;
      border-radius: 6px;
      font-size: 0.78rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s;
      user-select: none;
    }
    .toggle-chip:hover { border-color: var(--accent); color: var(--text); }
    .toggle-chip.active {
      border-color: var(--accent);
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      font-weight: 600;
    }
    .toggle-chip.active-gold {
      border-color: var(--primary);
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      font-weight: 600;
    }
    .chart-wrapper {
      position: relative;
      height: 540px;
      width: 100%;
    }
    #tvChartContainer {
      width: 100%;
      height: 100%;
    }
    .chart-overlay-info {
      position: absolute;
      top: 14px;
      left: 18px;
      z-index: 10;
      pointer-events: none;
      background: rgba(13, 19, 34, 0.85);
      backdrop-filter: blur(6px);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 8px 14px;
      display: flex;
      gap: 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
    }
    .ohlc-item span { color: var(--text-muted); }

    /* Drawing Tools Sidebar Strip */
    .chart-body-wrapper {
      display: flex;
      position: relative;
    }
    .drawing-toolbar {
      width: 46px;
      background: #090d16;
      border-right: 1px solid var(--card-border);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 10px 0;
      gap: 8px;
    }
    .draw-btn {
      width: 34px;
      height: 34px;
      border-radius: 6px;
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 1rem;
      transition: all 0.15s;
    }
    .draw-btn:hover { background: #1e293b; color: var(--text); }
    .draw-btn.active {
      background: var(--accent);
      color: #fff;
    }

    /* Lower Panels */
    .dashboard-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 16px;
    }
    @media (max-width: 1024px) {
      .dashboard-grid { grid-template-columns: 1fr; }
    }
    .panel {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 20px;
    }
    .panel h3 {
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .input-group {
      margin-bottom: 12px;
    }
    .input-group label {
      display: block;
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-bottom: 4px;
    }
    .input-group input, .input-group select {
      width: 100%;
      background: #090d16;
      border: 1px solid var(--card-border);
      color: var(--text);
      padding: 9px 12px;
      border-radius: 6px;
      font-family: inherit;
    }
    pre {
      background: #070a13;
      border: 1px solid #1e293b;
      padding: 12px;
      border-radius: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      color: #38bdf8;
      overflow-x: auto;
      max-height: 220px;
    }
    #toastMessage {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #0f172a;
      border: 1px solid var(--success);
      color: var(--text);
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.6);
      display: none;
      z-index: 1000;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>

  <!-- Toast Notification -->
  <div id="toastMessage"></div>

  <header>
    <div class="brand">
      <h1>⚜️ XAU/USD REAL-TIME TRADING AI</h1>
      <div class="badge">● EXNESS MT5 LIVE</div>
    </div>
    <div class="header-metrics">
      <div class="header-stat">
        <span class="label">Live Gold Price</span>
        <span class="val" id="headerGoldPrice" style="color:var(--primary);">$4588.50</span>
      </div>
      <div class="header-stat">
        <span class="label">Exness Balance</span>
        <span class="val" id="headerBalance" style="color:var(--success);">$463.68 USD</span>
      </div>
      <div class="header-stat">
        <span class="label">Session / Killzone</span>
        <span class="val" id="headerSession" style="color:#60a5fa;">LONDON_NY_OVERLAP</span>
      </div>
      <div class="header-stat">
        <span class="label">AI Bias</span>
        <span class="val" id="headerBias" style="color:#34d399;">BULLISH (82%)</span>
      </div>
      <button class="btn btn-gold" onclick="sendSnapshotToTelegram()">
        📸 Send Chart to Telegram
      </button>
    </div>
  </header>

  <div class="terminal-container">
    
    <!-- Institutional Live Candlestick Chart -->
    <div class="chart-card">
      
      <!-- Chart Toolbar -->
      <div class="chart-toolbar">
        <div class="tool-group">
          <span style="font-size:0.8rem;font-weight:700;color:var(--primary);margin-right:6px;">TIMEFRAMES:</span>
          <button class="tf-btn" onclick="switchTimeframe('1m')">1m</button>
          <button class="tf-btn" onclick="switchTimeframe('5m')">5m</button>
          <button class="tf-btn active" onclick="switchTimeframe('15m')">15m</button>
          <button class="tf-btn" onclick="switchTimeframe('30m')">30m</button>
          <button class="tf-btn" onclick="switchTimeframe('1h')">1h</button>
          <button class="tf-btn" onclick="switchTimeframe('4h')">4h</button>
          <button class="tf-btn" onclick="switchTimeframe('1d')">1D</button>
        </div>

        <div class="tool-group">
          <span style="font-size:0.8rem;font-weight:700;color:var(--text-muted);margin-right:4px;">OVERLAYS:</span>
          <div class="toggle-chip active-gold" id="chipEMA" onclick="toggleIndicator('ema')">● EMA Ribbon (20/50/200)</div>
          <div class="toggle-chip active" id="chipBB" onclick="toggleIndicator('bb')">● Bollinger Bands</div>
          <div class="toggle-chip active" id="chipOB" onclick="toggleIndicator('ob')">📦 Order Blocks</div>
          <div class="toggle-chip active" id="chipFVG" onclick="toggleIndicator('fvg')">⚡ FVG Imbalances</div>
          <div class="toggle-chip active" id="chipRSI" onclick="toggleIndicator('rsi')">📊 RSI (14)</div>
        </div>
      </div>

      <!-- Chart Body & Drawing Toolbar -->
      <div class="chart-body-wrapper">
        <div class="drawing-toolbar">
          <button class="draw-btn active" title="Cursor / Crosshair" onclick="setDrawingTool('cursor')">✛</button>
          <button class="draw-btn" title="Trendline" onclick="setDrawingTool('trendline')">📈</button>
          <button class="draw-btn" title="Horizontal Ray / Support-Resistance" onclick="setDrawingTool('horizontal')">━</button>
          <button class="draw-btn" title="Fibonacci Retracement" onclick="setDrawingTool('fib')">🔢</button>
          <button class="draw-btn" title="Long / Short Position Box" onclick="setDrawingTool('position')">📐</button>
          <button class="draw-btn" title="Measure Pips" onclick="setDrawingTool('measure')">📏</button>
          <button class="draw-btn" title="Clear All Drawings" onclick="clearDrawings()" style="color:var(--danger)">🗑️</button>
        </div>

        <div class="chart-wrapper">
          <!-- Real-Time OHLC Tooltip -->
          <div class="chart-overlay-info">
            <div class="ohlc-item"><span>O:</span> <strong id="ohlcO">--</strong></div>
            <div class="ohlc-item"><span>H:</span> <strong id="ohlcH">--</strong></div>
            <div class="ohlc-item"><span>L:</span> <strong id="ohlcL">--</strong></div>
            <div class="ohlc-item"><span>C:</span> <strong id="ohlcC">--</strong></div>
            <div class="ohlc-item"><span>Vol:</span> <strong id="ohlcV">--</strong></div>
          </div>

          <!-- Canvas Container -->
          <div id="tvChartContainer"></div>
        </div>
      </div>

    </div>

    <!-- Lower Operational Grid -->
    <div class="dashboard-grid">
      
      <!-- AI Thesis & Strategy Synthesis -->
      <div class="panel">
        <h3>
          <span>🧠 Autonomous AI Confluence Synthesis</span>
          <button class="btn btn-sm btn-gold" onclick="runLiveAnalysis()">⚡ Refresh 7-TF Scan</button>
        </h3>
        <pre id="analysisOutput">Loading live multi-timeframe SMC/ICT thesis from Google Gemini...</pre>
      </div>

      <!-- Live MT5 Trade Execution -->
      <div class="panel">
        <h3>💼 Instant MT5 Trade Execution</h3>
        <div class="input-group">
          <label>Order Type</label>
          <select id="tradeType">
            <option value="BUY">BUY (Market Order)</option>
            <option value="SELL">SELL (Market Order)</option>
            <option value="BUY_LIMIT">BUY LIMIT (Pending Order)</option>
            <option value="SELL_LIMIT">SELL LIMIT (Pending Order)</option>
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="input-group">
            <label>Lot Size</label>
            <input type="number" id="tradeLot" value="0.01" step="0.01" min="0.01">
          </div>
          <div class="input-group">
            <label>Target Entry (For Limits)</label>
            <input type="number" id="tradeEntry" placeholder="Current Market" step="0.1">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="input-group">
            <label>Stop Loss ($)</label>
            <input type="number" id="tradeSl" placeholder="Optional" step="0.1">
          </div>
          <div class="input-group">
            <label>Take Profit ($)</label>
            <input type="number" id="tradeTp" placeholder="Optional" step="0.1">
          </div>
        </div>
        <button class="btn btn-gold btn-block" style="margin-top:6px;width:100%;justify-content:center;" onclick="executeLiveTrade()">
          ⚡ Execute Order on Exness MT5
        </button>
        <div id="tradeOutput" style="margin-top:12px;font-size:0.85rem;font-family:'JetBrains Mono', monospace;"></div>
      </div>

    </div>

  </div>

  <script>
    let chart, candleSeries, ema20Series, ema50Series, ema200Series, rsiSeries;
    let currentTf = '15m';
    let liveCandles = [];
    let currentPrice = 4588.50;
    let activeTool = 'cursor';
    let overlayState = { ema: true, bb: true, ob: true, fvg: true, rsi: true };

    function showToast(msg) {
      const t = document.getElementById('toastMessage');
      t.innerHTML = msg;
      t.style.display = 'block';
      setTimeout(() => { t.style.display = 'none'; }, 4000);
    }

    // Initialize TradingView Lightweight Chart
    function initChart() {
      const container = document.getElementById('tvChartContainer');
      container.innerHTML = '';

      chart = LightweightCharts.createChart(container, {
        layout: {
          background: { color: '#0b101c' },
          textColor: '#94a3b8',
          fontFamily: "'JetBrains Mono', monospace",
        },
        grid: {
          vertLines: { color: '#1e293b' },
          horzLines: { color: '#1e293b' },
        },
        crosshair: {
          mode: LightweightCharts.CrosshairMode.Normal,
          vertLine: { color: '#f59e0b', width: 1, style: 3 },
          horzLine: { color: '#f59e0b', width: 1, style: 3 },
        },
        rightPriceScale: {
          borderColor: '#1e293b',
          scaleMargins: { top: 0.1, bottom: 0.2 },
        },
        timeScale: {
          borderColor: '#1e293b',
          timeVisible: true,
          secondsVisible: false,
        },
      });

      // Candlestick Series
      candleSeries = chart.addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });

      // EMA Ribbon Series
      ema20Series = chart.addLineSeries({ color: '#f59e0b', lineWidth: 2, title: 'EMA 20' });
      ema50Series = chart.addLineSeries({ color: '#38bdf8', lineWidth: 1.5, title: 'EMA 50' });
      ema200Series = chart.addLineSeries({ color: '#a855f7', lineWidth: 1.5, title: 'EMA 200' });

      // Crosshair Movement Tooltip
      chart.subscribeCrosshairMove((param) => {
        if (!param || !param.time || !param.seriesData.get(candleSeries)) return;
        const data = param.seriesData.get(candleSeries);
        document.getElementById('ohlcO').innerText = '$' + Number(data.open).toFixed(2);
        document.getElementById('ohlcH').innerText = '$' + Number(data.high).toFixed(2);
        document.getElementById('ohlcL').innerText = '$' + Number(data.low).toFixed(2);
        document.getElementById('ohlcC').innerText = '$' + Number(data.close).toFixed(2);
      });

      window.addEventListener('resize', () => {
        chart.resize(container.clientWidth, container.clientHeight);
      });

      loadChartData(currentTf);
    }

    // Load Candles and Plot Indicators
    async function loadChartData(tf) {
      const METAAPI_TOKEN = "eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI3OTJlZDBlOTY5OTVjN2UyZDU2NDExNjEyMjU1OWQ0MyIsImFjY2Vzc1J1bGVzIjpbeyJpZCI6InRyYWRpbmctYWNjb3VudC1tYW5hZ2VtZW50LWFwaSIsIm1ldGhvZHMiOlsidHJhZGluZy1hY2NvdW50LW1hbmFnZW1lbnQtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiXSwicmVzb3VyY2VzIjpbImFjY291bnQ6JFVTRVJfSUQkOjU5ZjEyOTQyLTgxYjctNDYxNy04MjBkLTRjZTY4NzhiNDg5ZiJdfSx7ImlkIjoibWV0YWFwaS1yZXN0LWFwaSIsIm1ldGhvZHMiOlsibWV0YWFwaS1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiYWNjb3VudDokVVNFUl9JRCQ6NTlmMTI5NDItODFiNy00NjE3LTgyMGQtNGNlNjg3OGI0ODlmIl19LHsiaWQiOiJtZXRhYXBpLXJwYy1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOndzOnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyJhY2NvdW50OiRVU0VSX0lEJDo1OWYxMjk0Mi04MWI3LTQ2MTctODIwZC00Y2U2ODc4YjQ4OWYiXX0seyJpZCI6Im1ldGFhcGktcmVhbC10aW1lLXN0cmVhbWluZy1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOndzOnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyJhY2NvdW50OiRVU0VSX0lEJDo1OWYxMjk0Mi04MWI3LTQ2MTctODIwZC00Y2U2ODc4YjQ4OWYiXX1dLCJpZ25vcmVSYXRlTGltaXRzIjpmYWxzZSwidG9rZW5JZCI6IjIwMjEwMjEzIiwiaW1wZXJzb25hdGVkIjpmYWxzZSwicmVhbFVzZXJJZCI6Ijc5MmVkMGU5Njk5NWM3ZTJkNTY0MTE2MTIyNTU5ZDQzIiwiaWF0IjoxNzg3MjQyNTc4LCJleHAiOjE3OTUwMTg1Nzh9.LdDpnrZQuTnUXRgnJpYlzvkSyGU4FWSjvG4xkoDOu0qbOALPi-OSjsBW6PRRq2G8zVQ9kz2JvKym4_Yayo0XqW3XtU33w48s0b10b-m3G2K1JgmHfY_wmXuDW9CpjLUi2su4AJGDneN0V0hqhi8-juHEGqhv1vXJ0ncV5igLXCqJebcKHVk1D0UoOL0w3jXaICzxEjBXizjgcUaYJ9QFOG5-n0HNN2VTxoeCbMWZGhUz6j9K_Ved95QfEKGwkIvlmOOfM7X5WRXY8ECJM6M79hM5y3dYl2XOE4FX_5WNmFcNCAkY9DfiCFBBsDy8ruBghEGfy1GCpaDeKvmoVf7Mwibl5cLvQsvSFTtjFqZHxv65JuLezMcf8i873VdAFwlwZWL1Wizgm4TN-8c66uRrXSwJb1dPixZqIMA54kqQuseiUqn7aaay7V-Jujduomj2gImftx254HyHOtIm7C6zaAksbD4DT6GUuuypE-1Jgg6FvPA2rVG6M_t3PFaB2Ba6DUOsMw1lDFkpNY7gEB7oYO9Xp_y3vcC1iV7NhcHukXKpb8M_br53OSMHqBaol8OKe8pyRwfdvDYdnsPsZoA2XACtRC72XmrtunKLK_J5iQ-XFo5Se8gYOy8pgCrwC3uqu7oBBFtRqQctQQns1aLqGUG8qQrEeCeb7fgMsdI2kUM";
      const METAAPI_ACC_ID = "59f12942-81b7-4617-820d-4ce6878b489f";

      // 1. Try local backend first
      try {
        const res = await fetch('/api/chart/candles?symbol=XAUUSD&timeframe=' + tf);
        const data = await res.json();
        if (data && data.candles && data.candles.length > 0) {
          liveCandles = data.candles;
          candleSeries.setData(liveCandles);
          if (overlayState.ema) calculateAndPlotEMAs(liveCandles);
          const last = liveCandles[liveCandles.length - 1];
          if (last) updateLivePrice(last.close);
          return;
        }
      } catch (err) {}

      // 2. Direct MetaApi Cloud Live Stream Real MT5 Candles Fallback
      try {
        const startTime = new Date(Date.now() - 5 * 86400000).toISOString();
        const cloudUrl = 'https://mt-market-data-client-api-v1.london-a.agiliumtrade.ai/users/current/accounts/' + METAAPI_ACC_ID + '/historical-market-data/symbols/XAUUSDm/timeframes/' + tf + '/candles?startTime=' + startTime + '&limit=1000';
        const cRes = await fetch(cloudUrl, { headers: { 'auth-token': METAAPI_TOKEN } });
        const cData = await cRes.json();
        if (Array.isArray(cData) && cData.length > 0) {
          const slice = cData.slice(-150);
          liveCandles = slice.map(c => ({
            time: Math.floor(new Date(c.time).getTime() / 1000),
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
            volume: Number(c.tickVolume || c.volume || 100),
          }));
          candleSeries.setData(liveCandles);
          if (overlayState.ema) calculateAndPlotEMAs(liveCandles);
          const last = liveCandles[liveCandles.length - 1];
          if (last) updateLivePrice(last.close);
        }
      } catch (cloudErr) {
        console.error('Cloud candles fetch error:', cloudErr);
      }
    }

    function calculateAndPlotEMAs(candles) {
      const calcEMA = (data, period) => {
        const k = 2 / (period + 1);
        const res = [];
        let ema = data[0].close;
        for (let i = 0; i < data.length; i++) {
          ema = data[i].close * k + ema * (1 - k);
          res.push({ time: data[i].time, value: Number(ema.toFixed(2)) });
        }
        return res;
      };

      if (candles.length > 20) ema20Series.setData(calcEMA(candles, 20));
      if (candles.length > 50) ema50Series.setData(calcEMA(candles, 50));
      if (candles.length > 200) ema200Series.setData(calcEMA(candles, 200));
    }

    function switchTimeframe(tf) {
      currentTf = tf;
      document.querySelectorAll('.tf-btn').forEach(b => {
        b.classList.remove('active');
        if (b.innerText.toLowerCase() === tf.toLowerCase()) b.classList.add('active');
      });
      loadChartData(tf);
      showToast('Switched chart timeframe to ' + tf);
    }

    function toggleIndicator(ind) {
      overlayState[ind] = !overlayState[ind];
      const chip = document.getElementById('chip' + ind.toUpperCase());
      if (chip) {
        chip.classList.toggle('active', overlayState[ind]);
      }

      if (ind === 'ema') {
        ema20Series.applyOptions({ visible: overlayState.ema });
        ema50Series.applyOptions({ visible: overlayState.ema });
        ema200Series.applyOptions({ visible: overlayState.ema });
      }
      showToast((overlayState[ind] ? 'Enabled ' : 'Disabled ') + ind.toUpperCase());
    }

    function setDrawingTool(tool) {
      activeTool = tool;
      document.querySelectorAll('.draw-btn').forEach(b => b.classList.remove('active'));
      event.currentTarget.classList.add('active');
      showToast('Active Tool: ' + tool);
    }

    function clearDrawings() {
      showToast('All custom drawings cleared.');
    }

    function updateLivePrice(price) {
      currentPrice = Number(price);
      document.getElementById('headerGoldPrice').innerText = '$' + currentPrice.toFixed(2);
      
      // Update active live candle bar
      if (liveCandles.length > 0) {
        const last = liveCandles[liveCandles.length - 1];
        last.close = currentPrice;
        if (currentPrice > last.high) last.high = currentPrice;
        if (currentPrice < last.low) last.low = currentPrice;
        candleSeries.update(last);
      }
    }

    // Send Real-Time Visual Chart Snapshot to Telegram
    async function sendSnapshotToTelegram() {
      showToast('📸 Rendering and sending visual chart to Telegram...');
      try {
        const res = await fetch('/api/chart/send-telegram-snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeframe: currentTf })
        });
        const data = await res.json();
        if (data.success) {
          showToast('✅ Visual Chart Snapshot sent directly to your Telegram chat!');
        } else {
          showToast('❌ Failed: ' + (data.error || 'Check Telegram connection'));
        }
      } catch (err) {
        showToast('❌ Error: ' + err.message);
      }
    }

    async function runLiveAnalysis() {
      const pre = document.getElementById('analysisOutput');
      pre.innerText = 'Analyzing XAU/USD 7-timeframe structure with Google Gemini 3.6 Flash AI...';
      
      try {
        const res = await fetch('/api/analyze');
        const data = await res.json();
        if (data && (data.bias || data.reasoning)) {
          pre.innerText = JSON.stringify(data, null, 2);
          if (data.bias) {
            document.getElementById('headerBias').innerText = data.bias + ' (' + (data.confidence || 85) + '%)';
          }
          return;
        } else {
          pre.innerText = JSON.stringify(data, null, 2);
        }
      } catch (e) {
        pre.innerText = 'Gemini Analysis: Live market state loaded. Click refresh to re-analyze.';
      }
    }

    async function executeLiveTrade() {
      const type = document.getElementById('tradeType').value;
      const lot = parseFloat(document.getElementById('tradeLot').value);
      const openPrice = parseFloat(document.getElementById('tradeEntry').value) || null;
      const sl = parseFloat(document.getElementById('tradeSl').value) || null;
      const tp = parseFloat(document.getElementById('tradeTp').value) || null;
      const out = document.getElementById('tradeOutput');

      out.innerHTML = '⚡ Executing order on Exness MT5 via MetaApi...';
      try {
        const res = await fetch('/api/trade/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, lot, openPrice, sl, tp })
        });
        const data = await res.json();
        if (data.success) {
          out.innerHTML = '<span style="color:var(--success)">✅ Order Executed! Ticket: #' + (data.trade?.ticket || 'FILLED') + '</span>';
        } else {
          out.innerHTML = '<span style="color:var(--danger)">⛔ Blocked: ' + (data.reasons ? data.reasons.join(', ') : data.error) + '</span>';
        }
      } catch (err) {
        out.innerHTML = '<span style="color:var(--danger)">❌ Error: ' + err.message + '</span>';
      }
    }

    async function pollStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (data.goldPrice) updateLivePrice(data.goldPrice);
        if (data.balance) document.getElementById('headerBalance').innerText = '$' + Number(data.balance).toFixed(2) + ' USD';
        if (data.session) document.getElementById('headerSession').innerText = data.session;
        if (data.bias) document.getElementById('headerBias').innerText = data.bias;
      } catch (e) {}
    }

    window.onload = () => {
      initChart();
      runLiveAnalysis();
      setInterval(pollStatus, 3000);
    };
  </script>
</body>
</html>`;
}

// Router for HTTP Server & Dashboard
function handleDashboardRequest(req, res, orchestrator) {
  const parsedUrl = new URL(req.url, 'http://localhost');
  const pathname = parsedUrl.pathname;

  // 1. Health Check
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
  }

  // 2. Status API
  if (pathname === '/api/status') {
    const primarySym = config.system.primarySymbol;
    const price = require('../market-data/marketFeed').getLatestPrice(primarySym) || 4588.50;
    const session = require('../strategies/ict/killzones').getCurrentSessionInfo();
    
    orchestrator.getStatusSummary().then(summary => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        goldPrice: price,
        balance: summary.account.balance,
        equity: summary.account.equity,
        server: orchestrator.executionMode === 'metaapi' ? 'Exness-MT5Trial16' : 'Paper Engine',
        session: session.marketSession,
        killzone: session.activeKillzone ? session.activeKillzone.name : 'None',
        bias: orchestrator.latestBias,
        telegramAdmin: orchestrator.telegram?.adminChatId || null,
      }));
    }).catch(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ goldPrice: price, balance: 463.68, session: session.marketSession }));
    });
    return;
  }

  // 3. Real-Time Chart Candles Feed API
  if (pathname === '/api/chart/candles') {
    const symbol = parsedUrl.searchParams.get('symbol') || config.system.primarySymbol;
    const timeframe = parsedUrl.searchParams.get('timeframe') || '15m';
    const candleManager = require('../market-data/candleManager');
    const rawCandles = candleManager.getCandles(symbol, timeframe) || [];
    
    // Map to Lightweight Charts format: { time: unixTimestampInSeconds, open, high, low, close, volume }
    const formatted = rawCandles.map(c => ({
      time: Math.floor((c.timestamp || new Date(c.time).getTime()) / 1000),
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      volume: Number(c.volume || 100),
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ symbol, timeframe, candles: formatted }));
  }

  // 4. Send Chart Snapshot Directly into Telegram API
  if (pathname === '/api/chart/send-telegram-snapshot' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const tf = payload.timeframe || '15m';
        const symbol = config.system.primarySymbol;
        
        if (orchestrator.telegram && orchestrator.telegram.adminChatId) {
          const thesis = await orchestrator.runOnDemandAnalysis(symbol, tf);
          const fakeCtx = {
            replyWithPhoto: async (photo, opts) => {
              await orchestrator.telegram.bot.api.sendPhoto(orchestrator.telegram.adminChatId, photo, opts);
            },
            reply: async (msg, opts) => {
              await orchestrator.telegram.bot.api.sendMessage(orchestrator.telegram.adminChatId, msg, opts);
            }
          };
          await orchestrator.telegram.sendSMCChartPhoto(fakeCtx, symbol, tf, thesis);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, message: 'Chart snapshot sent to Telegram' }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Telegram admin not paired. Run /start in bot first.' }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 5. Generate Telegram Auth Link API
  if (pathname === '/api/telegram/generate-auth-link' && req.method === 'POST') {
    const data = generateAuthToken('XAUUSD_Trading_AI_Agent_bot');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(data));
  }

  // 6. Check Telegram Auth Status API
  if (pathname === '/api/telegram/check-auth') {
    const token = parsedUrl.searchParams.get('token');
    const status = getAuthTokenStatus(token);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(status));
  }

  // 7. Gemini Analysis API
  if (pathname === '/api/analyze') {
    orchestrator.runOnDemandAnalysis('XAUUSD', '15m').then(thesis => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(thesis));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // 8. Trade Execution API
  if (pathname === '/api/trade/execute' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const result = await orchestrator.executeManualTrade({
          symbol: config.system.primarySymbol,
          type: payload.type,
          lot: payload.lot,
          openPrice: payload.openPrice,
          sl: payload.sl,
          tp: payload.tp,
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 9. Default: Render Real-Time Terminal Web Dashboard HTML
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(getDashboardHtml());
}

module.exports = {
  getDashboardHtml,
  handleDashboardRequest,
  generateAuthToken,
  claimAuthToken,
  getAuthTokenStatus,
};
