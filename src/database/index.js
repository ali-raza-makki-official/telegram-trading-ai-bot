const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');
const { SQLITE_SCHEMA, MYSQL_SCHEMA } = require('./schema');

let db = null;
let isMysql = false;

function initDatabase() {
  if (config.database.type === 'mysql') {
    try {
      const mysql = require('mysql2/promise');
      isMysql = true;
      const pool = mysql.createPool({
        host: config.database.mysql.host,
        port: config.database.mysql.port,
        user: config.database.mysql.user,
        password: config.database.mysql.password,
        database: config.database.mysql.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });

      db = pool;
      logger.info('MySQL Database pool initialized');

      // Run schema migrations
      runMysqlMigrations(pool);
      return;
    } catch (err) {
      logger.warn({ err }, 'Failed to initialize MySQL, falling back to SQLite');
    }
  }

  // SQLite Default
  const Database = require('better-sqlite3');
  const dbDir = path.dirname(config.database.sqlitePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(config.database.sqlitePath);
  db.pragma('journal_mode = WAL');
  db.exec(SQLITE_SCHEMA);
  logger.info({ path: config.database.sqlitePath }, 'SQLite Database initialized');
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

// Unified Query Helpers
async function query(sql, params = []) {
  if (!db) initDatabase();
  if (isMysql) {
    const [rows] = await db.execute(sql, params);
    return rows;
  } else {
    const stmt = db.prepare(sql);
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return stmt.all(...params);
    } else {
      return stmt.run(...params);
    }
  }
}

async function getOne(sql, params = []) {
  if (!db) initDatabase();
  if (isMysql) {
    const [rows] = await db.execute(sql, params);
    return rows[0] || null;
  } else {
    const stmt = db.prepare(sql);
    return stmt.get(...params) || null;
  }
}

async function execute(sql, params = []) {
  if (!db) initDatabase();
  if (isMysql) {
    const [result] = await db.execute(sql, params);
    return result;
  } else {
    const stmt = db.prepare(sql);
    return stmt.run(...params);
  }
}

// Prediction Repository
const PredictionRepo = {
  async save(pred) {
    const sql = `
      INSERT OR REPLACE INTO predictions 
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
      pred.priceAtPrediction,
      pred.suggestedSl || null,
      pred.suggestedTp1 || null,
      pred.suggestedTp2 || null,
      pred.invalidationLevel || null,
      pred.riskRewardRatio || null,
      pred.primarySetup || null,
      pred.reasoning || '',
      pred.status || 'PENDING',
      Date.now(),
    ];
    return execute(isMysql ? sql.replace('INSERT OR REPLACE', 'REPLACE') : sql, params);
  },

  async getPending() {
    return query(`SELECT * FROM predictions WHERE status = 'PENDING' ORDER BY timestamp ASC`);
  },

  async updateOutcome(id, { status, outcomePrice, outcomePips }) {
    const sql = `
      UPDATE predictions 
      SET status = ?, outcome_price = ?, outcome_pips = ?, evaluated_at = ?
      WHERE id = ?
    `;
    return execute(sql, [status, outcomePrice, outcomePips, Date.now(), id]);
  },

  async getRecent(limit = 20) {
    return query(`SELECT * FROM predictions ORDER BY timestamp DESC LIMIT ?`, [limit]);
  },

  async getStats() {
    const all = await query(`SELECT * FROM predictions WHERE status != 'PENDING'`);
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
    const sql = `
      INSERT OR REPLACE INTO trades
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
    return execute(isMysql ? sql.replace('INSERT OR REPLACE', 'REPLACE') : sql, params);
  },

  async getOpen() {
    return query(`SELECT * FROM trades WHERE status = 'OPEN' ORDER BY open_time DESC`);
  },

  async getRecent(limit = 20) {
    return query(`SELECT * FROM trades ORDER BY open_time DESC LIMIT ?`, [limit]);
  },

  async close(id, { closePrice, pnl, closeTime }) {
    const sql = `
      UPDATE trades 
      SET status = 'CLOSED', close_price = ?, pnl = ?, close_time = ?
      WHERE id = ?
    `;
    return execute(sql, [closePrice, pnl, closeTime || Date.now(), id]);
  },
};

// Candle Repository
const CandleRepo = {
  async saveMany(candles) {
    if (!candles || candles.length === 0) return;
    for (const c of candles) {
      const sql = isMysql
        ? `REPLACE INTO candles (symbol, timeframe, timestamp, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        : `INSERT OR REPLACE INTO candles (symbol, timeframe, timestamp, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      await execute(sql, [c.symbol, c.timeframe, c.timestamp, c.open, c.high, c.low, c.close, c.volume]);
    }
  },

  async getRecent(symbol, timeframe, limit = 200) {
    const rows = await query(
      `SELECT * FROM candles WHERE symbol = ? AND timeframe = ? ORDER BY timestamp DESC LIMIT ?`,
      [symbol, timeframe, limit]
    );
    return rows.reverse(); // Return in chronological order
  },
};

// Settings Repository
const SettingsRepo = {
  async get(key, defaultValue = null) {
    const row = await getOne(`SELECT value FROM settings WHERE key = ?`, [key]);
    if (!row) return defaultValue;
    try {
      return JSON.parse(row.value);
    } catch {
      return row.value;
    }
  },

  async set(key, value) {
    const valStr = typeof value === 'string' ? value : JSON.stringify(value);
    const sql = isMysql
      ? `REPLACE INTO settings (\`key\`, \`value\`, updated_at) VALUES (?, ?, ?)`
      : `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`;
    return execute(sql, [key, valStr, Date.now()]);
  },
};

module.exports = {
  initDatabase,
  query,
  getOne,
  execute,
  PredictionRepo,
  TradeRepo,
  CandleRepo,
  SettingsRepo,
};
