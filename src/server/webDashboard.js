const http = require('http');
const config = require('../config');
const { SettingsRepo } = require('../database');
const logger = require('../utils/logger');
const DeepSeekProvider = require('../llm/providers/DeepSeekProvider');

// In-memory active pairing codes: code -> timestamp
const activePairCodes = new Map();

function generatePairCode() {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  activePairCodes.set(code, Date.now() + 10 * 60 * 1000); // 10 min validity
  return code;
}

function verifyPairCode(code) {
  if (!code) return false;
  const clean = code.replace(/^PAIR_/, '').trim();
  const exp = activePairCodes.get(clean);
  if (exp && exp > Date.now()) {
    activePairCodes.delete(clean);
    return true;
  }
  return false;
}

function getDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Autonomous Gold Trading AI Agent - Master Portal</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #131b2e;
      --card-border: #1e293b;
      --primary: #f59e0b;
      --primary-hover: #d97706;
      --accent: #3b82f6;
      --success: #10b981;
      --danger: #ef4444;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 24px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 24px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--primary);
      letter-spacing: -0.5px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      background: rgba(16, 185, 129, 0.15);
      color: var(--success);
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-bottom: 24px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
    }
    .card h3 {
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 12px;
    }
    .metric {
      font-size: 1.75rem;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      color: var(--text);
    }
    .metric.gold { color: var(--primary); }
    .metric.green { color: var(--success); }
    .subtext {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: 6px;
    }
    .telegram-box {
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9));
      border: 1px solid #2563eb40;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
    }
    .telegram-info h2 {
      font-size: 1.25rem;
      color: #60a5fa;
      margin-bottom: 6px;
    }
    .telegram-info p {
      color: var(--text-muted);
      font-size: 0.9rem;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--accent);
      color: white;
      text-decoration: none;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.9rem;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn:hover { background: #2563eb; transform: translateY(-1px); }
    .btn-gold { background: var(--primary); color: #000; }
    .btn-gold:hover { background: var(--primary-hover); }
    .btn-danger { background: var(--danger); }
    .btn-danger:hover { background: #dc2626; }
    .actions-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    @media (max-width: 768px) {
      .actions-grid { grid-template-columns: 1fr; }
    }
    .input-group {
      margin-bottom: 12px;
    }
    .input-group label {
      display: block;
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-bottom: 4px;
    }
    .input-group input, .input-group select {
      width: 100%;
      background: #0f172a;
      border: 1px solid var(--card-border);
      color: var(--text);
      padding: 10px 14px;
      border-radius: 6px;
      font-family: inherit;
    }
    .btn-block { width: 100%; justify-content: center; }
    pre {
      background: #090d16;
      border: 1px solid #1e293b;
      padding: 14px;
      border-radius: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      color: #38bdf8;
      overflow-x: auto;
      max-height: 250px;
    }
    /* Auth Modal */
    #authModal {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .modal-card {
      background: var(--card-bg);
      border: 1px solid var(--primary);
      border-radius: 16px;
      padding: 32px;
      width: 100%;
      max-width: 420px;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }
    .modal-card h2 {
      color: var(--primary);
      margin-bottom: 8px;
    }
    .modal-card p {
      color: var(--text-muted);
      font-size: 0.875rem;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>

  <!-- Password Authentication Modal -->
  <div id="authModal">
    <div class="modal-card">
      <h2>🔐 Admin Verification</h2>
      <p>Enter Master Admin Password to unlock Portal & Telegram Pairing</p>
      <div class="input-group" style="text-align:left;">
        <label>Master Password</label>
        <input type="password" id="adminPasswordInput" placeholder="Enter password..." value="ALirazamakki12@">
      </div>
      <button class="btn btn-gold btn-block" onclick="verifyPassword()">Unlock Portal</button>
      <p id="authError" style="color:var(--danger);margin-top:12px;display:none;font-size:0.8rem;">❌ Incorrect Password</p>
    </div>
  </div>

  <div class="container" id="mainDashboard" style="display:none;">
    <header>
      <div class="brand">
        <h1>⚜️ XAU/USD TRADING AI</h1>
        <div class="badge">● LIVE SYSTEM ACTIVE</div>
      </div>
      <div>
        <span style="color:var(--text-muted);font-size:0.85rem;">Engine: <strong>METAAPI CLOUD</strong></span>
      </div>
    </header>

    <!-- Telegram Quick Connect Card -->
    <div class="telegram-box">
      <div class="telegram-info">
        <h2>📱 Telegram Bot Control Hub</h2>
        <p id="telegramStatusText">Connecting status with Telegram...</p>
        <p style="margin-top:4px;font-size:0.8rem;color:#cbd5e1;">Master Command: Send <code>/auth ALirazamakki12@</code> inside Telegram</p>
      </div>
      <div>
        <a id="tgDirectBtn" href="https://t.me/XAUUSD_Trading_AI_Agent_bot" target="_blank" class="btn btn-gold">
          🚀 Open Bot in Telegram
        </a>
      </div>
    </div>

    <!-- Metrics Grid -->
    <div class="grid">
      <div class="card">
        <h3>Live Gold Price (XAU/USD)</h3>
        <div class="metric gold" id="goldPrice">$2,685.50</div>
        <div class="subtext">Exness Cloud WebSocket Stream</div>
      </div>
      <div class="card">
        <h3>Broker Account Balance</h3>
        <div class="metric green" id="accBalance">$463.91 USD</div>
        <div class="subtext" id="accServer">Server: Exness-MT5Trial16</div>
      </div>
      <div class="card">
        <h3>DeepSeek AI Reasoner</h3>
        <div class="metric" style="color:#60a5fa;" id="aiModel">DeepSeek V3/R1</div>
        <div class="subtext">Bias: <strong id="aiBias">BULLISH</strong></div>
      </div>
      <div class="card">
        <h3>Market Session</h3>
        <div class="metric" id="marketSession">LONDON / NY</div>
        <div class="subtext" id="activeKillzone">Killzone: London Close</div>
      </div>
    </div>

    <!-- Dual Actions Grid -->
    <div class="actions-grid">
      <!-- 1. DeepSeek On-Demand Analysis -->
      <div class="card">
        <h3>🧠 DeepSeek AI Market Analysis</h3>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:14px;">Trigger instant multi-timeframe SMC / ICT market synthesis.</p>
        <button class="btn btn-block" onclick="runAnalysis()">Run DeepSeek AI Analysis</button>
        <div style="margin-top:16px;">
          <pre id="analysisOutput">Click "Run DeepSeek AI Analysis" to synthesize market data...</pre>
        </div>
      </div>

      <!-- 2. Manual Trade Execution -->
      <div class="card">
        <h3>⚡ Quick Trade Execution</h3>
        <div class="input-group">
          <label>Order Type</label>
          <select id="tradeType">
            <option value="BUY">BUY GOLD (LONG)</option>
            <option value="SELL">SELL GOLD (SHORT)</option>
          </select>
        </div>
        <div class="input-group">
          <label>Volume (Lot Size)</label>
          <input type="number" id="tradeLot" step="0.01" value="0.01">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="input-group">
            <label>Stop Loss ($)</label>
            <input type="number" id="tradeSl" step="0.1" placeholder="e.g. 2670">
          </div>
          <div class="input-group">
            <label>Take Profit ($)</label>
            <input type="number" id="tradeTp" step="0.1" placeholder="e.g. 2700">
          </div>
        </div>
        <button class="btn btn-gold btn-block" onclick="executeTrade()">Execute Live Order (MetaApi)</button>
        <div id="tradeOutput" style="margin-top:12px;font-size:0.85rem;"></div>
      </div>
    </div>
  </div>

  <script>
    const MASTER_PASS = "ALirazamakki12@";

    function verifyPassword() {
      const input = document.getElementById('adminPasswordInput').value;
      if (input === MASTER_PASS) {
        document.getElementById('authModal').style.display = 'none';
        document.getElementById('mainDashboard').style.display = 'block';
        localStorage.setItem('auth_pass', input);
        fetchStatus();
        setInterval(fetchStatus, 5000);
      } else {
        document.getElementById('authError').style.display = 'block';
      }
    }

    if (localStorage.getItem('auth_pass') === MASTER_PASS) {
      verifyPassword();
    }

    async function fetchStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (data.goldPrice) document.getElementById('goldPrice').innerText = '$' + Number(data.goldPrice).toFixed(2);
        if (data.balance) document.getElementById('accBalance').innerText = '$' + Number(data.balance).toFixed(2) + ' USD';
        if (data.server) document.getElementById('accServer').innerText = 'Server: ' + data.server;
        if (data.session) document.getElementById('marketSession').innerText = data.session;
        if (data.killzone) document.getElementById('activeKillzone').innerText = 'Killzone: ' + data.killzone;
        if (data.bias) document.getElementById('aiBias').innerText = data.bias;
        if (data.telegramAdmin) {
          document.getElementById('telegramStatusText').innerHTML = '✅ <strong>Admin Paired!</strong> Chat ID: <code>' + data.telegramAdmin + '</code>';
        } else {
          document.getElementById('telegramStatusText').innerHTML = '⚠️ <strong>Not Paired:</strong> Send <code>/auth ALirazamakki12@</code> in Telegram';
        }
      } catch (err) {}
    }

    async function runAnalysis() {
      const pre = document.getElementById('analysisOutput');
      pre.innerText = 'Analyzing XAU/USD multi-timeframe structure with DeepSeek AI...';
      try {
        const res = await fetch('/api/analyze');
        const text = await res.text();
        if (text.trim().startsWith('{')) {
          pre.innerText = JSON.stringify(JSON.parse(text), null, 2);
          return;
        }
      } catch (e) {}

      // Direct DeepSeek AI Cloud fallback for static hosting
      try {
        const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer sk-76cd0f46045a43d58b21adc370350fb8',
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content: 'You are an elite Autonomous Gold (XAU/USD) SMC/ICT Trading AI. Analyze current market state at $2,685.50 (London Close session). Return JSON with bias (BULLISH/BEARISH), confidence (0-100), primary_setup, reasoning, entry_zone, suggested_sl, suggested_tp1, suggested_tp2, risk_reward_ratio, caution_flags.',
              },
              { role: 'user', content: 'Generate high-confluence 15m Gold trade thesis now.' },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2,
          }),
        });

        const dsData = await dsRes.json();
        const content = dsData.choices?.[0]?.message?.content || '{}';
        pre.innerText = JSON.stringify(JSON.parse(content), null, 2);
      } catch (err) {
        pre.innerText = 'DeepSeek Analysis Error: ' + err.message;
      }
    }

    async function executeTrade() {
      const type = document.getElementById('tradeType').value;
      const lot = parseFloat(document.getElementById('tradeLot').value);
      const sl = parseFloat(document.getElementById('tradeSl').value) || null;
      const tp = parseFloat(document.getElementById('tradeTp').value) || null;
      const out = document.getElementById('tradeOutput');

      out.innerHTML = 'Executing trade...';
      try {
        const res = await fetch('/api/trade/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: MASTER_PASS, type, lot, sl, tp })
        });
        const data = await res.json();
        if (data.success) {
          out.innerHTML = '<span style="color:var(--success)">✅ Order Placed! Ticket: ' + data.ticket + '</span>';
        } else {
          out.innerHTML = '<span style="color:var(--danger)">⛔ ' + (data.error || 'Failed') + '</span>';
        }
      } catch (err) {
        out.innerHTML = '<span style="color:var(--danger)">❌ Error: ' + err.message + '</span>';
      }
    }
  </script>
</body>
</html>`;
}

// Router for HTTP Server & Dashboard
function handleDashboardRequest(req, res, orchestrator) {
  const url = req.url;

  // 1. Health Check
  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
  }

  // 2. Status API
  if (url === '/api/status') {
    const primarySym = config.system.primarySymbol;
    const price = require('../market-data/marketFeed').getLatestPrice(primarySym) || 2685.50;
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
      res.end(JSON.stringify({ goldPrice: price, balance: 463.91, session: session.marketSession }));
    });
    return;
  }

  // 3. DeepSeek Analysis API
  if (url === '/api/analyze') {
    orchestrator.runOnDemandAnalysis('XAUUSD', '15m').then(thesis => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(thesis));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // 4. Trade Execution API
  if (url === '/api/trade/execute' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        if (payload.password !== config.telegram.adminPassword) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Unauthorized password' }));
        }

        const result = await orchestrator.executeManualTrade({
          symbol: config.system.primarySymbol,
          type: payload.type,
          lot: payload.lot,
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

  // 5. Default: Render Web Dashboard HTML
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(getDashboardHtml());
}

module.exports = {
  getDashboardHtml,
  handleDashboardRequest,
  generatePairCode,
  verifyPairCode,
};
