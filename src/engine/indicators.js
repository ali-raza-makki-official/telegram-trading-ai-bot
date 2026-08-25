/**
 * Deterministic Indicator Engine with Multi-Candle Historical Caching
 * Calculates technical indicators on candle close and preserves historical series for crossover detection.
 */

const { RSI, EMA, SMA, MACD, BollingerBands, ATR, Stochastic, ADX } = require('technicalindicators');

// Local in-memory historical cache for fast multi-timeframe access
const indicatorHistoryCache = new Map(); // key -> [val1, val2, val3...]

/**
 * Calculate Indicator Value from Candle Series
 * @param {Object} indicatorDef - { indicator_type, timeframe, params, alias }
 * @param {Array} candles - Array of candle objects [{ open, high, low, close, volume }]
 * @returns {number|Object} Calculated current indicator value
 */
function calculateIndicator(indicatorDef, candles = []) {
  if (!candles || candles.length < 5) return null;

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume || 1);

  let currentVal = null;

  switch (indicatorDef.indicator_type?.toUpperCase()) {
    case 'RSI': {
      const period = indicatorDef.params?.period || 14;
      const values = RSI.calculate({ values: closes, period });
      currentVal = values.length > 0 ? Number(values[values.length - 1].toFixed(2)) : null;
      break;
    }

    case 'EMA': {
      const period = indicatorDef.params?.period || 20;
      const values = EMA.calculate({ values: closes, period });
      currentVal = values.length > 0 ? Number(values[values.length - 1].toFixed(2)) : null;
      break;
    }

    case 'SMA': {
      const period = indicatorDef.params?.period || 50;
      const values = SMA.calculate({ values: closes, period });
      currentVal = values.length > 0 ? Number(values[values.length - 1].toFixed(2)) : null;
      break;
    }

    case 'MACD': {
      const fastPeriod = indicatorDef.params?.fast || 12;
      const slowPeriod = indicatorDef.params?.slow || 26;
      const signalPeriod = indicatorDef.params?.signal || 9;
      const values = MACD.calculate({
        values: closes,
        fastPeriod,
        slowPeriod,
        signalPeriod,
        SimpleMAOscillator: false,
        SimpleMASignal: false
      });
      if (values.length > 0) {
        const last = values[values.length - 1];
        currentVal = {
          macd: Number((last.MACD || 0).toFixed(2)),
          signal: Number((last.signal || 0).toFixed(2)),
          histogram: Number((last.histogram || 0).toFixed(2))
        };
      }
      break;
    }

    case 'BOLLINGERBANDS': {
      const period = indicatorDef.params?.period || 20;
      const stdDev = indicatorDef.params?.stdDev || 2;
      const values = BollingerBands.calculate({ values: closes, period, stdDev });
      if (values.length > 0) {
        const last = values[values.length - 1];
        currentVal = {
          upper: Number(last.upper.toFixed(2)),
          middle: Number(last.middle.toFixed(2)),
          lower: Number(last.lower.toFixed(2))
        };
      }
      break;
    }

    case 'ATR': {
      const period = indicatorDef.params?.period || 14;
      const values = ATR.calculate({ high: highs, low: lows, close: closes, period });
      currentVal = values.length > 0 ? Number(values[values.length - 1].toFixed(2)) : null;
      break;
    }

    case 'STOCHASTIC': {
      const period = indicatorDef.params?.period || 14;
      const signalPeriod = indicatorDef.params?.signalPeriod || 3;
      const values = Stochastic.calculate({ high: highs, low: lows, close: closes, period, signalPeriod });
      if (values.length > 0) {
        const last = values[values.length - 1];
        currentVal = {
          k: Number(last.k.toFixed(2)),
          d: Number(last.d.toFixed(2))
        };
      }
      break;
    }

    case 'ADX': {
      const period = indicatorDef.params?.period || 14;
      const values = ADX.calculate({ high: highs, low: lows, close: closes, period });
      currentVal = values.length > 0 ? Number(values[values.length - 1].adx.toFixed(2)) : null;
      break;
    }

    case 'VWAP': {
      let cumulativeTPV = 0;
      let cumulativeVol = 0;
      for (let i = 0; i < candles.length; i++) {
        const typicalPrice = (candles[i].high + candles[i].low + candles[i].close) / 3;
        const vol = candles[i].volume || 1;
        cumulativeTPV += typicalPrice * vol;
        cumulativeVol += vol;
      }
      currentVal = cumulativeVol > 0 ? Number((cumulativeTPV / cumulativeVol).toFixed(2)) : closes[closes.length - 1];
      break;
    }

    default: {
      // Default to closing price
      currentVal = closes[closes.length - 1];
    }
  }

  // Update historical series cache for crossover detection (keep last 10 entries)
  if (currentVal !== null && indicatorDef.alias) {
    const history = indicatorHistoryCache.get(indicatorDef.alias) || [];
    const valToStore = typeof currentVal === 'object' && currentVal.macd !== undefined ? currentVal.macd : (typeof currentVal === 'number' ? currentVal : currentVal);
    history.push(valToStore);
    if (history.length > 10) history.shift();
    indicatorHistoryCache.set(indicatorDef.alias, history);
  }

  return currentVal;
}

/**
 * Get indicator history for crossover checks
 */
function getIndicatorHistory(alias) {
  return indicatorHistoryCache.get(alias) || [];
}

module.exports = {
  calculateIndicator,
  getIndicatorHistory,
};
