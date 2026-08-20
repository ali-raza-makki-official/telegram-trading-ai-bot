# Autonomous Gold (XAU/USD) Trading AI Agent — Telegram-Controlled

An institutional-grade, fully automated AI-powered trading bot for **Gold (XAU/USD)**, controlled entirely through Telegram. It combines deterministic Smart Money Concepts (SMC), Inner Circle Trader (ICT) killzone models, 20+ Japanese candlestick patterns, multi-provider LLM reasoning (Claude 3.5 & Gemini 2.5), persistent vector memory, automated prediction accuracy tracking, and cloud execution via **MetaApi Cloud WebSocket** (and internal Paper Trading simulation).

---

## 🌟 Key Features

- **Telegram Bot Remote Control (`grammY`):**
  - `/status` — Live account balance, equity, floating PnL, session status, and market bias.
  - `/analyze [pair] [tf]` — On-demand multi-timeframe SMC/ICT technical analysis & AI trade thesis.
  - `/execute [buy/sell] [lot] [sl] [tp]` — Manual trade execution with risk protection.
  - `/positions` — View active positions with live floating PnL.
  - `/close [ticket|all]` — Close open positions instantly.
  - `/mode [auto|semi|manual]` — Switch autonomy level on the fly.
  - `/setlimit [risk|lot|loss] [value]` — Adjust risk limits dynamically.
  - `/pause` / `/resume` — Pause/resume autonomous scanning and order placement.
  - `/history` — View recent trade and prediction records.
  - `/accuracy` — Display real-time AI win rate %, profit factor, and net outcome pips.
  - `/schedule` — Current market session, active ICT killzones, and Friday close countdown.
  - **Inline Approval Buttons:** In Semi-Auto mode, high-confidence setups send one-tap `[✅ Approve & Execute]` or `[❌ Reject]` buttons with automatic timeout.

- **MetaApi Cloud WebSocket Connectivity (`https://metaapi.cloud`):**
  - Direct cloud WebSocket RPC & Streaming Synchronizer for MT4 and MT5 accounts without requiring local MT5 bridge setup.
  - Real-time tick streaming and instant order routing.

- **Deterministic Strategy & Technical Engine:**
  - **SMC:** Market Structure (HH, HL, LH, LL, BOS, CHoCH), Order Blocks (Bull/Bear with mitigation check), Fair Value Gaps (FVG / BISI / SIBI), Liquidity Sweeps (EQH, EQL, BSL, SSL), Premium vs. Discount Zones, and OTE (62–79% Fib).
  - **ICT:** Killzones (Asian 00:00–06:00, London Open 07:00–10:00, NY Open 12:00–15:00, London Close 15:00–17:00 UTC), Silver Bullet (NY 10-11 AM, London 3-4 AM), Judas Swings, Power of Three (AMD), and Turtle Soup.
  - **Japanese Candlestick Library:** 20+ single, double, triple, and continuation candlestick patterns (Hammer, Shooting Star, Marubozu, Engulfing, Morning/Evening Star, 3 White Soldiers, 3 Black Crows, Harami, Tweezers).
  - **Classical Indicators:** EMA (9, 21, 50, 200), SMA, RSI (14), Stochastic RSI, MACD, Bollinger Bands, ATR (14), VWAP, Fibonacci retracements.
  - **Confluence Scorer:** Weighted multi-timeframe scoring matrix gating setups before AI reasoning.

- **Multi-Provider LLM Reasoning Layer:**
  - Pluggable for **Claude 3.5 Sonnet** and **Gemini 2.5 Flash / Pro** (with dual-model consensus validation).
  - Strict JSON schema validation with invalidation levels, entry zones, SL/TP, and R:R ratios.

- **Self-Calibrating Accuracy & Vector Memory:**
  - Predictions are stored in database and automatically evaluated against subsequent market highs and lows.
  - Tracks Win Rate, Profit Factor, and saves setup-to-outcome vectors for semantic recall in future analysis.

- **Institutional Risk Layer:**
  - Automatic lot sizing based on account equity % risk and ATR stop distance.
  - Daily max loss circuit breaker and max open positions cap.
  - Mandatory Stop Loss enforcement.
  - Friday NY Close auto-freeze (prevents holding through weekend gap risk).

---

## 📁 Project Architecture

```
telegram-trading-ai-bot/
├── src/
│   ├── config/             # Configuration & environment loader
│   ├── database/           # SQLite / MySQL schema, migrations, repositories
│   ├── memory/             # Semantic vector memory store
│   ├── market-data/        # Candle aggregator & mock/live market feeds
│   ├── indicators/         # EMA, RSI, MACD, ATR, Bollinger, VWAP, Fibs
│   ├── strategies/
│   │   ├── smc/            # BOS, CHoCH, Order Blocks, FVGs, Liquidity, OTE
│   │   ├── ict/            # Killzones, Judas Swing, AMD, Silver Bullet, Turtle Soup
│   │   ├── candlesticks/   # 20+ Japanese candlestick pattern detectors
│   │   └── confluence/     # Multi-timeframe weighted confluence engine
│   ├── llm/
│   │   ├── providers/      # ClaudeProvider, GeminiProvider
│   │   ├── prompts.js      # System prompt & Zod schema
│   │   └── llmManager.js   # LLM dispatcher & consensus validator
│   ├── evaluator/          # Prediction accuracy reconciler & statistics
│   ├── risk/               # Sizing math, risk validation, Friday close buffer
│   ├── execution/          # MetaApiClient (WebSocket), PaperTradingEngine, MT5BridgeClient
│   ├── scheduler/          # Candle close cron jobs & killzone timers
│   ├── telegram/           # grammY bot commands, inline keyboards & alerts
│   ├── orchestrator/       # Master pipeline orchestrator
│   ├── utils/              # Pino logger & utilities
│   └── index.js            # CLI entry point
├── tests/                  # Unit & integration test suites
├── .env.example            # Environment variables template
└── package.json
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18 or higher (v22 recommended)
- **Telegram Bot Token**: Get one from [@BotFather](https://t.me/BotFather) on Telegram.
- **MetaApi Cloud Token & Account ID** (optional for live trading): Sign up at [MetaApi.cloud](https://app.metaapi.cloud) and add your MT4/MT5 broker account.
- **LLM API Key** (optional): Google Gemini API Key or Anthropic Claude API Key.

### 2. Installation

```bash
# Clone or navigate to the directory
cd "Telegram Trading Ai Bot"

# Install dependencies
npm install
```

### 3. Configuration

Copy `.env.example` to `.env` and fill in your details:

```bash
cp .env.example .env
```

Edit `.env`:
```env
# Telegram
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ
TELEGRAM_ALLOWED_USER_IDS=your_telegram_user_id
TELEGRAM_ADMIN_CHAT_ID=your_telegram_user_id

# MetaApi Cloud WebSocket (Live Trading)
METAAPI_API_TOKEN=your_metaapi_token_here
METAAPI_ACCOUNT_ID=your_metaapi_account_id_here

# Execution Mode ("paper" | "metaapi" | "mt5")
EXECUTION_MODE=metaapi

# Autonomy Mode ("semi" | "auto" | "manual")
AUTONOMY_MODE=semi

# LLM Provider ("gemini" | "claude" | "hybrid")
LLM_PRIMARY_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key
```

### 4. Running the Bot

```bash
# Start in production mode
npm start

# Or development mode with auto-reload
npm run dev
```

### 5. Running the Automated Tests

```bash
node tests/runAll.js
```

---

## 🤖 Telegram Bot Control Manual

| Command | Description | Example |
|---|---|---|
| `/status` | View account balance, open trades, market bias, and active session | `/status` |
| `/analyze [pair] [tf]` | Run on-demand technical analysis + AI reasoning | `/analyze XAUUSD 15m` |
| `/execute [type] [lot] [sl] [tp]` | Manually execute order with risk checks | `/execute buy 0.1 2640 2665` |
| `/positions` | List active positions with tickets and floating PnL | `/positions` |
| `/close [ticket\|all]` | Close specific position or all open trades | `/close all` |
| `/mode [auto\|semi\|manual]` | Change autonomy level | `/mode semi` |
| `/pause` / `/resume` | Halt or resume automated scanning & execution | `/pause` |
| `/accuracy` | View AI prediction statistics and historical win rate | `/accuracy` |
| `/schedule` | View killzone schedule and Friday market close countdown | `/schedule` |

---

## 🛡️ Risk Management Guidelines

- **Mandatory Stop Loss:** Every executed trade must have a defined SL.
- **Dynamic Lot Sizing:** Calculated automatically from account equity % risk and ATR stop distance.
- **Daily Max Loss Halt:** If daily losses hit `MAX_DAILY_LOSS_PERCENT` (default 3%), new orders are automatically halted for the day.
- **Weekend Gap Protection:** New trade entries are automatically frozen 60 minutes before Friday NY market close.
