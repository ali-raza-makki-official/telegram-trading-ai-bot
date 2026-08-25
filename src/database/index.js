const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');
const { MYSQL_SCHEMA } = require('./schema');

// In-Memory Database with Atomic Disk Persistence (Pure JavaScript, Zero Native C++ Bindings)
class PureJsStorage {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = {
      predictions: {},
      trades: {},
      candles: {}, // `${symbol}_${timeframe}` -> [candles]
      settings: {},
      vector_memories: {},
    };
    this.isDirty = false;
    this.saveTimer = null;
  }

  init() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.data = { ...this.data, ...JSON.parse(raw) };
        logger.info({ path: this.filePath }, 'Pure JS Database loaded from disk');
      } catch (err) {
        logger.warn({ err: err.message }, 'Failed to read database file, initializing fresh');
      }
    } else {
      this.persistSync();
      logger.info({ path: this.filePath }, 'Pure JS Database initialized');
    }
  }

  schedulePersist() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.persistSync();
    }, 500);
  }

  persistSync() {
    try {
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tempPath, this.filePath);
      this.isDirty = false;
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to persist database to disk');
    }
  }
}

let storage = null;
let mysqlPool = null;
let isMysql = false;
let dbInitialized = false;

// FIX #15: initDatabase is now async and awaits MySQL migrations
// Caller should await this before making any DB operations
async function initDatabase() {
  if (dbInitialized) return; // idempotent

  if (config.database.type === 'mysql') {
    try {
      const mysql = require('mysql2/promise');
      isMysql = true;
      mysqlPool = mysql.createPool({
        host: config.database.mysql.host,
        port: config.database.mysql.port,
        user: config.database.mysql.user,
        password: config.database.mysql.password,
        database: config.database.mysql.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });

      logger.info('MySQL Database pool initialized');
      // FIX #15: AWAIT the migration so schema is ready before first query
      await runMysqlMigrations(mysqlPool);
      dbInitialized = true;
      return;
    } catch (err) {
      logger.warn({ err }, 'Failed to initialize MySQL, falling back to pure JS local storage');
    }
  }

  // Pure JavaScript Local File Storage Default (Hostinger & Linux compatible)
  const dbPath = config.database.sqlitePath.replace(/\.db$/, '.json');
  storage = new PureJsStorage(dbPath);
  storage.init();
  dbInitialized = true;
}

async function runMysqlMigrations(pool) {
  try {
    const statements = MYSQL_SCHEMA.split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    for (const stmt of statements) {
      await pool.query(stmt);
    }
    logger.info('MySQL schema migration completed');
  } catch (err) {
    logger.error({ err }, 'MySQL schema migration error');
  }
}

// Prediction Repository
const PredictionRepo = {
  async save(pred) {
    if (isMysql && mysqlPool) {
      const sql = `
        REPLACE INTO predictions 
        (id, symbol, timeframe, timestamp, bias, confidence, price_at_prediction, suggested_sl, suggested_tp1, suggested_tp2, invalidation_level, risk_reward_ratio, primary_setup, reasoning, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [
        pred.id,
        pred.symbol,
        pred.timeframe,
        pred.timestamp,
        pred.bias,
        pred.confidence,
        pred.priceAtPrediction || pred.price_at_prediction,
        pred.suggestedSl || pred.suggested_sl || null,
        pred.suggestedTp1 || pred.suggested_tp1 || null,
        pred.suggestedTp2 || pred.suggested_tp2 || null,
        pred.invalidationLevel || pred.invalidation_level || null,
        pred.riskRewardRatio || pred.risk_reward_ratio || null,
        pred.primarySetup || pred.primary_setup || null,
        pred.reasoning || '',
        pred.status || 'PENDING',
        Date.now(),
      ];
      return mysqlPool.execute(sql, params);
    }

    if (!storage) initDatabase();
    storage.data.predictions[pred.id] = {
      id: pred.id,
      symbol: pred.symbol,
      timeframe: pred.timeframe,
      timestamp: pred.timestamp,
      bias: pred.bias,
      confidence: pred.confidence,
      price_at_prediction: pred.priceAtPrediction || pred.price_at_prediction,
      suggested_sl: pred.suggestedSl || pred.suggested_sl || null,
      suggested_tp1: pred.suggestedTp1 || pred.suggested_tp1 || null,
      suggested_tp2: pred.suggestedTp2 || pred.suggested_tp2 || null,
      invalidation_level: pred.invalidationLevel || pred.invalidation_level || null,
      risk_reward_ratio: pred.riskRewardRatio || pred.risk_reward_ratio || null,
      primary_setup: pred.primarySetup || pred.primary_setup || null,
      reasoning: pred.reasoning || '',
      status: pred.status || 'PENDING',
      outcome_price: pred.outcome_price || null,
      outcome_pips: pred.outcome_pips || null,
      evaluated_at: pred.evaluated_at || null,
      created_at: Date.now(),
    };
    storage.schedulePersist();
    return true;
  },

  async getPending() {
    if (isMysql && mysqlPool) {
      const [rows] = await mysqlPool.execute(`SELECT * FROM predictions WHERE status = 'PENDING' ORDER BY timestamp ASC`);
      return rows;
    }
    if (!storage) initDatabase();
    return Object.values(storage.data.predictions)
      .filter(p => p.status === 'PENDING')
      .sort((a, b) => a.timestamp - b.timestamp);
  },

  async updateOutcome(id, { status, outcomePrice, outcomePips }) {
    if (isMysql && mysqlPool) {
      const sql = `UPDATE predictions SET status = ?, outcome_price = ?, outcome_pips = ?, evaluated_at = ? WHERE id = ?`;
      return mysqlPool.execute(sql, [status, outcomePrice, outcomePips, Date.now(), id]);
    }
    if (!storage) initDatabase();
    if (storage.data.predictions[id]) {
      storage.data.predictions[id].status = status;
      storage.data.predictions[id].outcome_price = outcomePrice;
      storage.data.predictions[id].outcome_pips = outcomePips;
      storage.data.predictions[id].evaluated_at = Date.now();
      storage.schedulePersist();
    }
    return true;
  },

  async getRecent(limit = 20) {
    if (isMysql && mysqlPool) {
      const [rows] = await mysqlPool.execute(`SELECT * FROM predictions ORDER BY timestamp DESC LIMIT ?`, [limit]);
      return rows;
    }
    if (!storage) initDatabase();
    return Object.values(storage.data.predictions)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  },

  async getStats() {
    let all = [];
    if (isMysql && mysqlPool) {
      const [rows] = await mysqlPool.execute(`SELECT * FROM predictions WHERE status != 'PENDING'`);
      all = rows;
    } else {
      if (!storage) initDatabase();
      all = Object.values(storage.data.predictions).filter(p => p.status !== 'PENDING');
    }

    if (!all || all.length === 0) {
      return { total: 0, winCount: 0, lossCount: 0, winRate: 0, totalPips: 0 };
    }
    const winCount = all.filter(p => p.status === 'HIT_TP1' || p.status === 'HIT_TP2').length;
    const lossCount = all.filter(p => p.status === 'HIT_SL').length;
    const totalPips = all.reduce((sum, p) => sum + (p.outcome_pips || 0), 0);
    const resolved = winCount + lossCount;
    const winRate = resolved > 0 ? (winCount / resolved) * 100 : 0;
    return {
      total: all.length,
      resolved,
      winCount,
      lossCount,
      winRate: Number(winRate.toFixed(2)),
      totalPips: Number(totalPips.toFixed(1)),
    };
  },
};

// Trade Repository
const TradeRepo = {
  async save(trade) {
    if (isMysql && mysqlPool) {
      const sql = `
        REPLACE INTO trades
        (id, ticket, symbol, type, lot, entry_price, sl, tp, close_price, pnl, status, prediction_id, open_time, close_time, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [
        trade.id,
        trade.ticket || null,
        trade.symbol,
        trade.type,
        trade.lot,
        trade.entryPrice,
        trade.sl || null,
        trade.tp || null,
        trade.closePrice || null,
        trade.pnl || 0,
        trade.status || 'OPEN',
        trade.predictionId || null,
        trade.openTime || Date.now(),
        trade.closeTime || null,
        trade.notes || '',
      ];
      return mysqlPool.execute(sql, params);
    }

    if (!storage) initDatabase();
    storage.data.trades[trade.id] = {
      id: trade.id,
      ticket: trade.ticket || trade.id,
      symbol: trade.symbol,
      type: trade.type,
      lot: trade.lot,
      entryPrice: trade.entryPrice,
      sl: trade.sl || null,
      tp: trade.tp || null,
      closePrice: trade.closePrice || null,
      pnl: trade.pnl || 0,
      status: trade.status || 'OPEN',
      predictionId: trade.predictionId || null,
      openTime: trade.openTime || Date.now(),
      closeTime: trade.closeTime || null,
      notes: trade.notes || '',
    };
    storage.schedulePersist();
    return true;
  },

  async getOpen() {
    if (isMysql && mysqlPool) {
      const [rows] = await mysqlPool.execute(`SELECT * FROM trades WHERE status = 'OPEN' ORDER BY open_time DESC`);
      return rows;
    }
    if (!storage) initDatabase();
    return Object.values(storage.data.trades)
      .filter(t => t.status === 'OPEN')
      .sort((a, b) => b.openTime - a.openTime);
  },

  async getRecent(limit = 20) {
    if (isMysql && mysqlPool) {
      const [rows] = await mysqlPool.execute(`SELECT * FROM trades ORDER BY open_time DESC LIMIT ?`, [limit]);
      return rows;
    }
    if (!storage) initDatabase();
    return Object.values(storage.data.trades)
      .sort((a, b) => b.openTime - a.openTime)
      .slice(0, limit);
  },

  async close(id, { closePrice, pnl, closeTime }) {
    if (isMysql && mysqlPool) {
      const sql = `UPDATE trades SET status = 'CLOSED', close_price = ?, pnl = ?, close_time = ? WHERE id = ?`;
      return mysqlPool.execute(sql, [closePrice, pnl, closeTime || Date.now(), id]);
    }
    if (!storage) initDatabase();
    if (storage.data.trades[id]) {
      storage.data.trades[id].status = 'CLOSED';
      storage.data.trades[id].closePrice = closePrice;
      storage.data.trades[id].pnl = pnl;
      storage.data.trades[id].closeTime = closeTime || Date.now();
      storage.schedulePersist();
    }
    return true;
  },
};

// Candle Repository
const CandleRepo = {
  async saveMany(candles) {
    if (!candles || candles.length === 0) return;
    if (isMysql && mysqlPool) {
      for (const c of candles) {
        const sql = `REPLACE INTO candles (symbol, timeframe, timestamp, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        await mysqlPool.execute(sql, [c.symbol, c.timeframe, c.timestamp, c.open, c.high, c.low, c.close, c.volume]);
      }
      return;
    }

    if (!storage) initDatabase();
    for (const c of candles) {
      const key = `${c.symbol}_${c.timeframe}`;
      if (!storage.data.candles[key]) storage.data.candles[key] = [];
      const list = storage.data.candles[key];
      const idx = list.findIndex(item => item.timestamp === c.timestamp);
      if (idx !== -1) {
        list[idx] = c;
      } else {
        list.push(c);
        if (list.length > 500) list.shift();
      }
    }
    storage.schedulePersist();
  },

  async getRecent(symbol, timeframe, limit = 200) {
    if (isMysql && mysqlPool) {
      const [rows] = await mysqlPool.execute(
        `SELECT * FROM candles WHERE symbol = ? AND timeframe = ? ORDER BY timestamp DESC LIMIT ?`,
        [symbol, timeframe, limit]
      );
      return rows.reverse();
    }

    if (!storage) initDatabase();
    const key = `${symbol}_${timeframe}`;
    const list = storage.data.candles[key] || [];
    return list.slice(-limit);
  },

  // FIX: Clear stale candles older than cutoffMs for a given symbol/timeframe
  async clearStale(symbol, timeframe, cutoffMs) {
    if (isMysql && mysqlPool) {
      await mysqlPool.execute(
        `DELETE FROM candles WHERE symbol = ? AND timeframe = ? AND timestamp < ?`,
        [symbol, timeframe, cutoffMs]
      );
      return;
    }

    if (!storage) initDatabase();
    const key = `${symbol}_${timeframe}`;
    const list = storage.data.candles[key];
    if (list) {
      storage.data.candles[key] = list.filter(c => c.timestamp >= cutoffMs);
      storage.schedulePersist();
    }
  },
};

// Settings Repository
const SettingsRepo = {
  async get(key, defaultValue = null) {
    if (isMysql && mysqlPool) {
      const [rows] = await mysqlPool.execute(`SELECT value FROM settings WHERE \`key\` = ?`, [key]);
      if (!rows[0]) return defaultValue;
      try {
        return JSON.parse(rows[0].value);
      } catch {
        return rows[0].value;
      }
    }

    if (!storage) initDatabase();
    const val = storage.data.settings[key];
    if (val === undefined) return defaultValue;
    return val;
  },

  async set(key, value) {
    if (isMysql && mysqlPool) {
      const valStr = typeof value === 'string' ? value : JSON.stringify(value);
      const sql = `REPLACE INTO settings (\`key\`, \`value\`, updated_at) VALUES (?, ?, ?)`;
      return mysqlPool.execute(sql, [key, valStr, Date.now()]);
    }

    if (!storage) initDatabase();
    storage.data.settings[key] = value;
    storage.schedulePersist();
    return true;
  },
};

// Vector Memory Query Helper
async function queryVectorMemories(category) {
  if (isMysql && mysqlPool) {
    const sql = category 
      ? `SELECT * FROM vector_memories WHERE category = ? ORDER BY timestamp DESC LIMIT 100`
      : `SELECT * FROM vector_memories ORDER BY timestamp DESC LIMIT 100`;
    const [rows] = await mysqlPool.execute(sql, category ? [category] : []);
    return rows;
  }

  if (!storage) initDatabase();
  const list = Object.values(storage.data.vector_memories);
  return category ? list.filter(m => m.category === category) : list;
}

async function saveVectorMemory({ id, category, contextText, embedding, metadata, timestamp }) {
  if (isMysql && mysqlPool) {
    const sql = `REPLACE INTO vector_memories (id, category, context_text, embedding, metadata, timestamp) VALUES (?, ?, ?, ?, ?, ?)`;
    return mysqlPool.execute(sql, [id, category, contextText, JSON.stringify(embedding), JSON.stringify(metadata), timestamp]);
  }

  if (!storage) initDatabase();
  storage.data.vector_memories[id] = {
    id,
    category,
    context_text: contextText,
    embedding: JSON.stringify(embedding),
    metadata: JSON.stringify(metadata),
    timestamp,
  };
  storage.schedulePersist();
  return true;
}

module.exports = {
  initDatabase,
  PredictionRepo,
  TradeRepo,
  CandleRepo,
  SettingsRepo,
  queryVectorMemories,
  saveVectorMemory,
};
