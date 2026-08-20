const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS candles (
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL NOT NULL,
  PRIMARY KEY (symbol, timeframe, timestamp)
);

CREATE TABLE IF NOT EXISTS predictions (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  bias TEXT NOT NULL,
  confidence REAL NOT NULL,
  price_at_prediction REAL NOT NULL,
  suggested_sl REAL,
  suggested_tp1 REAL,
  suggested_tp2 REAL,
  invalidation_level REAL,
  risk_reward_ratio REAL,
  primary_setup TEXT,
  reasoning TEXT,
  status TEXT DEFAULT 'PENDING', -- 'PENDING', 'HIT_TP1', 'HIT_TP2', 'HIT_SL', 'INVALIDATED', 'EXPIRED'
  outcome_price REAL,
  outcome_pips REAL,
  evaluated_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  ticket TEXT,
  symbol TEXT NOT NULL,
  type TEXT NOT NULL, -- 'BUY' | 'SELL'
  lot REAL NOT NULL,
  entry_price REAL NOT NULL,
  sl REAL,
  tp REAL,
  close_price REAL,
  pnl REAL DEFAULT 0,
  status TEXT DEFAULT 'OPEN', -- 'OPEN', 'CLOSED', 'CANCELLED'
  prediction_id TEXT,
  open_time INTEGER NOT NULL,
  close_time INTEGER,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  confluence_score REAL NOT NULL,
  bias TEXT NOT NULL,
  smc_data TEXT,
  ict_data TEXT,
  candlestick_data TEXT,
  indicator_data TEXT,
  llm_response TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS vector_memories (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  context_text TEXT NOT NULL,
  embedding TEXT NOT NULL, -- JSON array of floats
  metadata TEXT,
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_candles_ts ON candles (symbol, timeframe, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_status ON predictions (status);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades (status);
`;

const MYSQL_SCHEMA = `
CREATE TABLE IF NOT EXISTS candles (
  symbol VARCHAR(20) NOT NULL,
  timeframe VARCHAR(10) NOT NULL,
  timestamp BIGINT NOT NULL,
  open DOUBLE NOT NULL,
  high DOUBLE NOT NULL,
  low DOUBLE NOT NULL,
  close DOUBLE NOT NULL,
  volume DOUBLE NOT NULL,
  PRIMARY KEY (symbol, timeframe, timestamp)
);

CREATE TABLE IF NOT EXISTS predictions (
  id VARCHAR(64) PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  timeframe VARCHAR(10) NOT NULL,
  timestamp BIGINT NOT NULL,
  bias VARCHAR(20) NOT NULL,
  confidence DOUBLE NOT NULL,
  price_at_prediction DOUBLE NOT NULL,
  suggested_sl DOUBLE,
  suggested_tp1 DOUBLE,
  suggested_tp2 DOUBLE,
  invalidation_level DOUBLE,
  risk_reward_ratio DOUBLE,
  primary_setup VARCHAR(255),
  reasoning TEXT,
  status VARCHAR(30) DEFAULT 'PENDING',
  outcome_price DOUBLE,
  outcome_pips DOUBLE,
  evaluated_at BIGINT,
  created_at BIGINT NOT NULL,
  INDEX idx_predictions_status (status)
);

CREATE TABLE IF NOT EXISTS trades (
  id VARCHAR(64) PRIMARY KEY,
  ticket VARCHAR(64),
  symbol VARCHAR(20) NOT NULL,
  type VARCHAR(10) NOT NULL,
  lot DOUBLE NOT NULL,
  entry_price DOUBLE NOT NULL,
  sl DOUBLE,
  tp DOUBLE,
  close_price DOUBLE,
  pnl DOUBLE DEFAULT 0,
  status VARCHAR(20) DEFAULT 'OPEN',
  prediction_id VARCHAR(64),
  open_time BIGINT NOT NULL,
  close_time BIGINT,
  notes TEXT,
  INDEX idx_trades_status (status)
);

CREATE TABLE IF NOT EXISTS signals (
  id VARCHAR(64) PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  timeframe VARCHAR(10) NOT NULL,
  timestamp BIGINT NOT NULL,
  confluence_score DOUBLE NOT NULL,
  bias VARCHAR(20) NOT NULL,
  smc_data LONGTEXT,
  ict_data LONGTEXT,
  candlestick_data LONGTEXT,
  indicator_data LONGTEXT,
  llm_response LONGTEXT,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  \`key\` VARCHAR(100) PRIMARY KEY,
  \`value\` TEXT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS vector_memories (
  id VARCHAR(64) PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  context_text TEXT NOT NULL,
  embedding LONGTEXT NOT NULL,
  metadata LONGTEXT,
  timestamp BIGINT NOT NULL
);
`;

module.exports = {
  SQLITE_SCHEMA,
  MYSQL_SCHEMA,
};
