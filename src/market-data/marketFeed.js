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

    // Start tick simulation/polling loop
    this.startLiveFeedLoop();
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
    // Tick loop every 3 seconds
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

  getLatestPrice(symbol = config.system.primarySymbol) {
    if (this.latestPrices.has(symbol)) {
      return this.latestPrices.get(symbol);
    }
    const candles = candleManager.getCandles(symbol, '15m');
    return candles.length > 0 ? candles[candles.length - 1].close : 4518.50;
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
    logger.info('Market Data Feed stopped');
  }
}

module.exports = new MarketFeed();
