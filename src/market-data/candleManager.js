const { CandleRepo } = require('../database');
const logger = require('../utils/logger');

// Timeframe duration in milliseconds
const TF_MS = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
};

class CandleManager {
  constructor(maxCandlesPerTimeframe = 500) {
    this.maxCandles = maxCandlesPerTimeframe;
    // Map of symbol -> { '1m': [...], '5m': [...], ... }
    this.store = new Map();
  }

  // Ensure storage exists for symbol & timeframe
  initSymbolTimeframe(symbol, timeframe) {
    if (!this.store.has(symbol)) {
      this.store.set(symbol, {});
    }
    const symStore = this.store.get(symbol);
    if (!symStore[timeframe]) {
      symStore[timeframe] = [];
    }
  }

  // Load historical candles from database
  async loadFromDatabase(symbol, timeframe, count = 200) {
    this.initSymbolTimeframe(symbol, timeframe);
    const dbCandles = await CandleRepo.getRecent(symbol, timeframe, count);
    if (dbCandles && dbCandles.length > 0) {
      this.store.get(symbol)[timeframe] = dbCandles;
      logger.debug({ symbol, timeframe, count: dbCandles.length }, 'Loaded candles from database');
    }
  }

  // Add or update candle
  async addCandle(symbol, timeframe, candle) {
    this.initSymbolTimeframe(symbol, timeframe);
    const list = this.store.get(symbol)[timeframe];

    const idx = list.findIndex(c => c.timestamp === candle.timestamp);
    if (idx !== -1) {
      // Update ongoing candle
      list[idx] = { ...list[idx], ...candle };
    } else {
      // New closed candle
      list.push(candle);
      if (list.length > this.maxCandles) {
        list.shift();
      }
      // Save to database
      await CandleRepo.saveMany([{ ...candle, symbol, timeframe }]);
    }
  }

  // Build higher timeframe candle from 1m candles
  aggregateCandles(baseCandles, targetTf) {
    const periodMs = TF_MS[targetTf];
    if (!periodMs || !baseCandles || baseCandles.length === 0) return [];

    const aggregated = [];
    let currentBucket = null;

    for (const c of baseCandles) {
      const bucketTime = Math.floor(c.timestamp / periodMs) * periodMs;

      if (!currentBucket || currentBucket.timestamp !== bucketTime) {
        if (currentBucket) aggregated.push(currentBucket);
        currentBucket = {
          symbol: c.symbol,
          timeframe: targetTf,
          timestamp: bucketTime,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume || 1,
        };
      } else {
        currentBucket.high = Math.max(currentBucket.high, c.high);
        currentBucket.low = Math.min(currentBucket.low, c.low);
        currentBucket.close = c.close;
        currentBucket.volume += c.volume || 1;
      }
    }

    if (currentBucket) aggregated.push(currentBucket);
    return aggregated;
  }

  // Get all candles for a symbol & timeframe
  getCandles(symbol, timeframe) {
    if (!this.store.has(symbol) || !this.store.get(symbol)[timeframe]) {
      return [];
    }
    return [...this.store.get(symbol)[timeframe]];
  }

  // Get full multi-timeframe snapshot
  getMultiTimeframeSnapshot(symbol, timeframes = ['1m', '5m', '15m', '1h', '4h', '1d']) {
    const snapshot = {};
    for (const tf of timeframes) {
      snapshot[tf] = this.getCandles(symbol, tf);
    }
    return snapshot;
  }

  // Set multiple candles at once
  setCandles(symbol, timeframe, candles) {
    this.initSymbolTimeframe(symbol, timeframe);
    this.store.get(symbol)[timeframe] = candles.slice(-this.maxCandles);
  }
}

module.exports = new CandleManager();
