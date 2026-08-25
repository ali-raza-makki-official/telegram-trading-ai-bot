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

    // NO simulated tick loop — ALL ticks come from real MetaApi broker connection
    logger.info('Simulated tick generator DISABLED — using ONLY real Exness MT5 broker ticks via MetaApi');

    // FIX #17: Start periodic correlated data refresh (every 5 minutes) — REAL DATA from Yahoo Finance
    this.startCorrelatedDataRefresh();

    // Fetch real data immediately on startup
    await this._refreshCorrelatedData();

    logger.info('Market Data Feed started successfully');
  }

  async seedInitialCandles() {
    const symbol = config.system.primarySymbol;
    const metaApiClient = require('../execution/MetaApiClient');

    if (!metaApiClient.isConfigured()) {
      logger.error('MetaApi NOT configured! Set METAAPI_API_TOKEN and METAAPI_ACCOUNT_ID in .env — NO candles will be loaded');
      return;
    }

    if (!metaApiClient.isConnected) {
      logger.error('MetaApi NOT connected! Waiting for connection before seeding candles...');
      // Wait up to 60 seconds for MetaApi to connect
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 1000));
        if (metaApiClient.isConnected) break;
      }
      if (!metaApiClient.isConnected) {
        logger.error('MetaApi failed to connect after 60s — chart will have NO candles until connected');
        return;
      }
    }

    // Fetch ALL candles from MetaApi Exness MT5 — NO database fallback, NO demo data
    for (const tf of config.system.timeframes) {
      try {
        const realCandles = await metaApiClient.getHistoricalCandles(symbol, tf, 200);
        if (realCandles && realCandles.length > 0) {
          candleManager.setCandles(symbol, tf, realCandles);
          const newestTs = realCandles[realCandles.length - 1].timestamp;
          const ageMinutes = Math.round((Date.now() - newestTs) / 60000);
          logger.info({ symbol, timeframe: tf, count: realCandles.length, newestAge: ageMinutes + 'min' }, '✅ Seeded REAL Exness MT5 candles from MetaApi');
        } else {
          logger.error({ symbol, timeframe: tf }, '❌ MetaApi returned ZERO candles — check broker symbol and connection');
        }
      } catch (err) {
        logger.error({ err: err.message, symbol, timeframe: tf }, '❌ MetaApi candle fetch FAILED — NO fallback to database');
      }
    }
  }

  // REMOVED: Simulated tick generator — ALL ticks now come from real MetaApi Exness MT5 broker

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
