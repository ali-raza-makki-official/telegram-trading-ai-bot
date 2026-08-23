const EventEmitter = require('events');
const candleManager = require('./candleManager');
const { fetchCorrelatedData } = require('./correlatedDataFetcher');
const config = require('../config');
const logger = require('../utils/logger');

class MarketFeed extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
    this.pollTimer = null;
    this.correlatedRefreshTimer = null;
    this.latestPrices = new Map();
    this.correlatedData = {
      DXY: { price: 0, change: 0, changePercent: 0, bias: 'NEUTRAL', source: 'initializing' },
      XAGUSD: { price: 0, change: 0, changePercent: 0, bias: 'NEUTRAL', source: 'initializing' },
      US10Y: { price: 0, change: 0, changePercent: 0, bias: 'NEUTRAL', source: 'initializing' },
      AUDUSD: { price: 0, change: 0, changePercent: 0, bias: 'NEUTRAL', source: 'initializing' },
    };
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('Initializing Market Data Feed...');

    // Seed historical candles for all timeframes
    await this.seedInitialCandles();

    // FIX #1: Only start simulated tick loop in paper mode.
    // In metaapi/mt5 mode, real ticks come from the execution engine directly.
    if (config.system.executionMode === 'paper') {
      this.startLiveFeedLoop();
      logger.info('Paper mode: Simulated tick generator started');
    } else {
      logger.info(`Live mode (${config.system.executionMode}): Simulated tick generator DISABLED — using real broker ticks`);
    }

    // FIX #17: Start periodic correlated data refresh (every 5 minutes) — REAL DATA from Yahoo Finance
    this.startCorrelatedDataRefresh();

    // Fetch real data immediately on startup
    await this._refreshCorrelatedData();

    logger.info('Market Data Feed started successfully');
  }

  async seedInitialCandles() {
    const symbol = config.system.primarySymbol;
    const metaApiClient = require('../execution/MetaApiClient');
    
    for (const tf of config.system.timeframes) {
      // Load previously saved candles from database
      await candleManager.loadFromDatabase(symbol, tf, 200);
      let existing = candleManager.getCandles(symbol, tf);

      // Fetch real historical broker candles if MetaApi is connected and we need more data
      if (existing.length < 50 && metaApiClient.isConnected) {
        try {
          const realCandles = await metaApiClient.getHistoricalCandles(symbol, tf, 100);
          if (realCandles && realCandles.length > 0) {
            candleManager.setCandles(symbol, tf, realCandles);
            logger.info({ symbol, timeframe: tf, count: realCandles.length }, 'Seeded real historical candles from MetaApi Exness MT5');
            existing = candleManager.getCandles(symbol, tf);
          }
        } catch (err) {
          logger.warn({ err: err.message, tf }, 'MetaApi candle fetch failed — no mock fallback');
        }
      }

      // No simulated data fallback — if no real data, analysis will skip this timeframe
      if (existing.length < 15) {
        logger.warn({ symbol, timeframe: tf, count: existing.length }, 'Insufficient real candle data — analysis for this timeframe will be skipped');
      }
    }
  }

  startLiveFeedLoop() {
    const symbol = config.system.primarySymbol;
    // Tick loop every 3 seconds (paper mode only)
    this.pollTimer = setInterval(async () => {
      if (!this.isRunning) return;

      const m15Candles = candleManager.getCandles(symbol, '15m');
      const lastCandle = m15Candles[m15Candles.length - 1];
      const prevClose = this.latestPrices.get(symbol) || (lastCandle ? lastCandle.close : 4515.0);

      // Small tick delta
      const tickDelta = (Math.random() - 0.49) * 0.4;
      const newPrice = Number((prevClose + tickDelta).toFixed(2));
      this.updatePrice(symbol, newPrice);
    }, 3000);
  }

  updatePrice(symbol, price) {
    const p = Number(price);
    this.latestPrices.set(symbol, p);
    this.latestPrices.set('XAUUSD', p);
    this.latestPrices.set('XAUUSDm', p);

    // Smart Price Action Zone & Liquidity Check (0ms local evaluation, 0 tokens)
    try {
      const smartTrigger = require('../orchestrator/smartPriceTriggerEngine');
      const triggeredZones = smartTrigger.evaluatePriceTick({ symbol: 'XAUUSD', currentPrice: p });
      if (triggeredZones.length > 0) {
        this.emit('priceZoneTriggered', { zones: triggeredZones, currentPrice: p });
      }
    } catch (err) {
      logger.error({ err: err.message }, 'Error checking smart price trigger zones');
    }

    // Emit tick
    this.emit('tick', {
      symbol,
      price: p,
      timestamp: Date.now(),
    });
  }

  // FIX #16 + FIX #17: Refresh correlated data periodically using REAL Yahoo Finance API
  startCorrelatedDataRefresh() {
    this.correlatedRefreshTimer = setInterval(async () => {
      if (!this.isRunning) return;
      await this._refreshCorrelatedData();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  async _refreshCorrelatedData() {
    try {
      const realData = await fetchCorrelatedData();

      if (realData) {
        // Merge real data — preserve shape for confluence scorer compatibility
        this.correlatedData = {
          DXY: {
            price: realData.DXY?.price || this.correlatedData.DXY.price,
            change: realData.DXY?.change || 0,
            changePercent: realData.DXY?.changePercent || 0,
            bias: realData.DXY?.bias || 'NEUTRAL',
            source: realData.DXY?.source || 'yahoo_finance',
          },
          XAGUSD: {
            price: realData.XAGUSD?.price || this.correlatedData.XAGUSD.price,
            change: realData.XAGUSD?.change || 0,
            changePercent: realData.XAGUSD?.changePercent || 0,
            bias: realData.XAGUSD?.bias || 'NEUTRAL',
            source: realData.XAGUSD?.source || 'yahoo_finance',
          },
          US10Y: {
            price: realData.US10Y?.price || this.correlatedData.US10Y.price,
            change: realData.US10Y?.change || 0,
            changePercent: realData.US10Y?.changePercent || 0,
            bias: realData.US10Y?.bias || 'NEUTRAL',
            source: realData.US10Y?.source || 'yahoo_finance',
          },
          AUDUSD: {
            price: realData.AUDUSD?.price || this.correlatedData.AUDUSD.price,
            change: realData.AUDUSD?.change || 0,
            changePercent: realData.AUDUSD?.changePercent || 0,
            bias: realData.AUDUSD?.bias || 'NEUTRAL',
            source: realData.AUDUSD?.source || 'yahoo_finance',
          },
        };

        logger.debug({
          DXY: `${this.correlatedData.DXY.price} (${this.correlatedData.DXY.bias})`,
          XAGUSD: `${this.correlatedData.XAGUSD.price} (${this.correlatedData.XAGUSD.bias})`,
          US10Y: `${this.correlatedData.US10Y.price} (${this.correlatedData.US10Y.bias})`,
          AUDUSD: `${this.correlatedData.AUDUSD.price} (${this.correlatedData.AUDUSD.bias})`,
        }, 'Real correlated market data refreshed from Yahoo Finance');
      } else {
        logger.warn('Correlated data fetch returned null — keeping previous cached values');
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed refreshing correlated data — retaining previous values');
    }
  }

  getLatestPrice(symbol = config.system.primarySymbol) {
    if (this.latestPrices.has(symbol)) {
      return this.latestPrices.get(symbol);
    }
    const candles = candleManager.getCandles(symbol, '15m');
    return candles.length > 0 ? candles[candles.length - 1].close : null;
  }

  getCorrelatedData() {
    return { ...this.correlatedData };
  }

  updateCorrelatedData(key, data) {
    this.correlatedData[key] = { ...this.correlatedData[key], ...data };
  }

  stop() {
    this.isRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.correlatedRefreshTimer) {
      clearInterval(this.correlatedRefreshTimer);
      this.correlatedRefreshTimer = null;
    }
    logger.info('Market Data Feed stopped');
  }
}

module.exports = new MarketFeed();
