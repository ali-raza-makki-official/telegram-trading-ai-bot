const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load .env if present
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config(); // fallback
}

const config = {
  // Telegram
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    allowedUserIds: (process.env.TELEGRAM_ALLOWED_USER_IDS || '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean)
      .map(id => Number(id) || id),
    adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID ? Number(process.env.TELEGRAM_ADMIN_CHAT_ID) : null,
  },

  // LLM Provider
  llm: {
    primaryProvider: process.env.LLM_PRIMARY_PROVIDER || 'gemini', // 'gemini' | 'claude' | 'hybrid'
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    },
    claude: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    },
  },

  // System & Autonomy
  system: {
    autonomyMode: process.env.AUTONOMY_MODE || 'semi', // 'auto' | 'semi' | 'manual'
    executionMode: process.env.EXECUTION_MODE || 'paper', // 'paper' | 'metaapi' | 'mt5'
    logLevel: process.env.LOG_LEVEL || 'info',
    primarySymbol: process.env.PRIMARY_SYMBOL || 'XAUUSD',
    timeframes: (process.env.TIME_FRAMES || '1m,5m,15m,1h,4h,1d').split(',').map(s => s.trim()),
    isPaused: false,
  },

  // MetaApi Cloud WebSocket Configuration
  metaApi: {
    token: process.env.METAAPI_API_TOKEN || '',
    accountId: process.env.METAAPI_ACCOUNT_ID || '',
  },

  // Database
  database: {
    type: process.env.DB_TYPE || 'sqlite', // 'sqlite' | 'mysql'
    sqlitePath: process.env.SQLITE_DB_PATH || path.resolve(process.cwd(), 'data', 'trading_agent.db'),
    mysql: {
      host: process.env.MYSQL_HOST || 'localhost',
      port: Number(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'gold_trading_bot',
    },
  },

  // MT5 Bridge (fallback TCP)
  mt5: {
    host: process.env.MT5_BRIDGE_HOST || '127.0.0.1',
    port: Number(process.env.MT5_BRIDGE_PORT) || 8222,
    reconnectIntervalMs: 5000,
  },

  // Risk Management
  risk: {
    accountStartingBalance: Number(process.env.ACCOUNT_STARTING_BALANCE) || 10000,
    riskPercentPerTrade: Number(process.env.RISK_PERCENT_PER_TRADE) || 1.0,
    maxLotSize: Number(process.env.MAX_LOT_SIZE) || 1.0,
    minLotSize: 0.01,
    maxDailyLossPercent: Number(process.env.MAX_DAILY_LOSS_PERCENT) || 3.0,
    maxConcurrentPositions: Number(process.env.MAX_CONCURRENT_POSITIONS) || 3,
    mandatoryStopLoss: process.env.MANDATORY_STOP_LOSS !== 'false',
    minRiskRewardRatio: Number(process.env.MIN_RISK_REWARD_RATIO) || 1.5,
    fridayCloseBufferMinutes: Number(process.env.FRIDAY_CLOSE_BUFFER_MINUTES) || 60,
  },

  // Strategy & Confluence Thresholds
  strategy: {
    minConfluenceScore: Number(process.env.MIN_CONFLUENCE_SCORE) || 65,
    highConfidenceThreshold: Number(process.env.HIGH_CONFIDENCE_THRESHOLD) || 80,
    correlatedSymbols: ['DXY', 'XAGUSD', 'AUDUSD', 'US10Y', 'VIX'],
  },
};

module.exports = config;
