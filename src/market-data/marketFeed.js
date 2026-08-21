const EventEmitter = require('events');
const candleManager = require('./candleManager');
const { generateRealisticGoldCandles } = require('./mockDataGenerator');
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
      DXY: { price: 104.25, change: -0.15, bias: 'BEARISH' },
      XAGUSD: { price: 31.85, change: +0.65, bias: 'BULLISH' },
      US10Y: { price: 4.28, change: -0.04, bias: 'BEARISH' },
      AUDUSD: { price: 0.6580, change: +0.22, bias: 'BULLISH' },
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

    // FIX #16: Start periodic correlated data refresh (every 5 minutes)
    this.startCorrelatedDataRefresh();

    logger.info('Market Data Feed started successfully');
  }

  async seedInitialCandles() {
    const symbol = config.system.primarySymbol;
    for (const tf of config.system.timeframes) {
      await candleManager.loadFromDatabase(symbol, tf, 200);
      const existing = candleManager.getCandles(symbol, tf);
      if (existing.length < 50) {
        const mockHistory = generateRealisticGoldCandles({
          count: 100,
          timeframe: tf,
          basePrice: 4515.0,
          trend: 'BULLISH',
        });
        candleManager.setCandles(symbol, tf, mockHistory);
        logger.debug({ symbol, timeframe: tf, count: mockHistory.length }, 'Seeded initial candles');
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
      this.latestPrices.set(symbol, newPrice);
      this.latestPrices.set('XAUUSD', newPrice);
      this.latestPrices.set('XAUUSDm', newPrice);

      // Emit tick
      this.emit('tick', {
        symbol,
        price: newPrice,
        timestamp: Date.now(),
      });
    }, 3000);
  }

  // FIX #16: Refresh correlated data periodically to simulate market movement
  startCorrelatedDataRefresh() {
    this.correlatedRefreshTimer = setInterval(() => {
      if (!this.isRunning) return;
      this._refreshCorrelatedData();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  _refreshCorrelatedData() {
    // Apply small random drift to simulate price movement
    const drift = () => Number(((Math.random() - 0.5) * 0.1).toFixed(4));

    const dxy = this.correlatedData.DXY;
    const newDxyChange = Number((dxy.change + drift()).toFixed(2));
    this.correlatedData.DXY = {
      price: Number((dxy.price + drift()).toFixed(2)),
      change: newDxyChange,
      bias: newDxyChange < -0.05 ? 'BEARISH' : newDxyChange > 0.05 ? 'BULLISH' : 'NEUTRAL',
    };

    const xag = this.correlatedData.XAGUSD;
    const newXagChange = Number((xag.change + drift()).toFixed(2));
    this.correlatedData.XAGUSD = {
      price: Number((xag.price + drift() * 2).toFixed(2)),
      change: newXagChange,
      bias: newXagChange > 0.05 ? 'BULLISH' : newXagChange < -0.05 ? 'BEARISH' : 'NEUTRAL',
    };

    const us10y = this.correlatedData.US10Y;
    const newUs10yChange = Number((us10y.change + drift() * 0.5).toFixed(3));
    this.correlatedData.US10Y = {
      price: Number((us10y.price + drift() * 0.05).toFixed(3)),
      change: newUs10yChange,
      bias: newUs10yChange < -0.02 ? 'BEARISH' : newUs10yChange > 0.02 ? 'BULLISH' : 'NEUTRAL',
    };

    const audusd = this.correlatedData.AUDUSD;
    const newAudChange = Number((audusd.change + drift() * 0.3).toFixed(3));
    this.correlatedData.AUDUSD = {
      price: Number((audusd.price + drift() * 0.003).toFixed(4)),
      change: newAudChange,
      bias: newAudChange > 0.05 ? 'BULLISH' : newAudChange < -0.05 ? 'BEARISH' : 'NEUTRAL',
    };

    logger.debug({ correlatedData: this.correlatedData }, 'Correlated market data refreshed');
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
