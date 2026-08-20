const config = require('../config');
const logger = require('../utils/logger');

/**
 * Macro Data & Correlation Engine
 * Tracks DXY proxy, US10Y/US2Y yields, Silver (XAGUSD), VIX, and news sentiment.
 */
class MacroEngine {
  constructor() {
    this.cache = {
      DXY: { price: 104.25, change: -0.15, bias: 'BEARISH', lastUpdated: Date.now() },
      XAGUSD: { price: 32.40, change: +0.65, bias: 'BULLISH', lastUpdated: Date.now() },
      US10Y: { yield: 4.28, change: -0.04, bias: 'BULLISH_GOLD', lastUpdated: Date.now() },
      US2Y: { yield: 4.52, change: -0.02, lastUpdated: Date.now() },
      YieldSpread: { spread: -0.24, inverted: true, lastUpdated: Date.now() },
      VIX: { level: 16.4, state: 'NORMAL', lastUpdated: Date.now() },
      newsSentiment: {
        score: +0.45,
        bias: 'BULLISH',
        headlines: [
          'Central bank gold reserves surge amid geopolitical de-dollarization',
          'US Treasury yields soften ahead of key inflation print',
        ],
        lastUpdated: Date.now(),
      },
    };
    this.pollInterval = null;
  }

  // Calculate Synthetic DXY from FX Basket
  // Formula: DXY = 50.14348112 * (EURUSD^-0.576) * (USDJPY^0.136) * (GBPUSD^-0.119) * (USDCAD^0.091) * (USDSEK^0.042) * (USDCHF^0.036)
  calculateSyntheticDXY(fxRates = {}) {
    const {
      EURUSD = 1.0850,
      USDJPY = 153.20,
      GBPUSD = 1.2950,
      USDCAD = 1.3820,
      USDSEK = 10.65,
      USDCHF = 0.8850,
    } = fxRates;

    try {
      const dxy = 50.14348112 *
        Math.pow(EURUSD, -0.576) *
        Math.pow(USDJPY, 0.136) *
        Math.pow(GBPUSD, -0.119) *
        Math.pow(USDCAD, 0.091) *
        Math.pow(USDSEK, 0.042) *
        Math.pow(USDCHF, 0.036);

      const rounded = Number(dxy.toFixed(2));
      const prev = this.cache.DXY.price;
      const change = Number((rounded - prev).toFixed(2));
      const bias = change < 0 ? 'BEARISH' : 'BULLISH';

      this.cache.DXY = { price: rounded, change, bias, lastUpdated: Date.now() };
      return this.cache.DXY;
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed calculating synthetic DXY');
      return this.cache.DXY;
    }
  }

  // Detect Smart Money Technique (SMT) Divergence between Gold and Silver
  detectSMTDivergence(goldCandles = [], silverCandles = []) {
    if (goldCandles.length < 3 || silverCandles.length < 3) return null;

    const count = Math.min(5, Math.min(goldCandles.length, silverCandles.length));
    const gRecent = goldCandles.slice(-count);
    const sRecent = silverCandles.slice(-count);

    const gHigherHigh = gRecent[gRecent.length - 1].high > gRecent[0].high;
    const sHigherHigh = sRecent[sRecent.length - 1].high > sRecent[0].high;

    const gLowerLow = gRecent[gRecent.length - 1].low < gRecent[0].low;
    const sLowerLow = sRecent[sRecent.length - 1].low < sRecent[0].low;

    // Bearish SMT: Gold makes Higher High, but Silver fails to make Higher High (smart money distribution)
    if (gHigherHigh && !sHigherHigh) {
      return {
        type: 'BEARISH_SMT',
        bias: 'BEARISH',
        confidence: 85,
        description: 'Gold made a higher high, but Silver failed to confirm (Smart Money Distribution / Bearish SMT).',
      };
    }

    // Bullish SMT: Gold makes Lower Low, but Silver makes Higher Low (smart money accumulation)
    if (gLowerLow && !sLowerLow) {
      return {
        type: 'BULLISH_SMT',
        bias: 'BULLISH',
        confidence: 85,
        description: 'Gold swept lows, but Silver held higher lows (Smart Money Accumulation / Bullish SMT).',
      };
    }

    return null;
  }

  // Get aggregated macro confluence payload
  getMacroSnapshot() {
    return {
      DXY: { ...this.cache.DXY },
      XAGUSD: { ...this.cache.XAGUSD },
      US10Y: { ...this.cache.US10Y },
      US2Y: { ...this.cache.US2Y },
      YieldSpread: { ...this.cache.YieldSpread },
      VIX: { ...this.cache.VIX },
      newsSentiment: { ...this.cache.newsSentiment },
      timestamp: Date.now(),
    };
  }

  // Update news sentiment
  updateSentiment(score, bias, headlines = []) {
    this.cache.newsSentiment = {
      score: Number(score.toFixed(2)),
      bias,
      headlines,
      lastUpdated: Date.now(),
    };
  }
}

module.exports = new MacroEngine();
