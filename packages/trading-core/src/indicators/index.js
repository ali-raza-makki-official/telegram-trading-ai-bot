/**
 * @fileoverview Pure Technical Indicators Calculation Module
 * Strategy-agnostic mathematical indicators for time-series candle data.
 * Zero external network, DB, or SDK dependencies.
 */

/**
 * @typedef {Object} Candle
 * @property {number} open - Candle open price
 * @property {number} high - Candle high price
 * @property {number} low - Candle low price
 * @property {number} close - Candle close price
 * @property {number} [volume] - Candle volume (optional)
 * @property {number|string} [time] - Candle timestamp (optional)
 */

/**
 * Extracts numeric price and volume series from an array of candles.
 * @param {Candle[]} candles
 * @returns {{ opens: number[], highs: number[], lows: number[], closes: number[], volumes: number[] }}
 */
function getSeries(candles) {
  if (!Array.isArray(candles)) {
    return { opens: [], highs: [], lows: [], closes: [], volumes: [] };
  }
  const opens = candles.map(c => Number(c.open));
  const highs = candles.map(c => Number(c.high));
  const lows = candles.map(c => Number(c.low));
  const closes = candles.map(c => Number(c.close));
  const volumes = candles.map(c => Number(c.volume || 1));
  return { opens, highs, lows, closes, volumes };
}

/**
 * Calculates Simple Moving Average (SMA).
 * @param {number[]} values - Array of price values (e.g. closing prices)
 * @param {number} period - SMA window size (e.g. 14, 20, 50, 200)
 * @returns {(number|null)[]} Array of SMA values aligned with input array
 */
function calculateSMA(values, period) {
  if (!Array.isArray(values) || values.length === 0 || period <= 0) return [];
  const result = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += values[i - j];
    }
    result.push(Number((sum / period).toFixed(4)));
  }
  return result;
}

/**
 * Calculates Exponential Moving Average (EMA).
 * @param {number[]} values - Array of price values
 * @param {number} period - EMA period (e.g. 9, 21, 50, 200)
 * @returns {(number|null)[]} Array of EMA values aligned with input array
 */
function calculateEMA(values, period) {
  if (!Array.isArray(values) || values.length === 0 || period <= 0) return [];
  const result = [];
  const k = 2 / (period + 1);
  let prevEMA = null;

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    if (prevEMA === null) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += values[i - j];
      }
      prevEMA = sum / period;
    } else {
      prevEMA = values[i] * k + prevEMA * (1 - k);
    }
    result.push(Number(prevEMA.toFixed(4)));
  }
  return result;
}

/**
 * Calculates Relative Strength Index (RSI).
 * @param {number[]} closes - Array of closing prices
 * @param {number} [period=14] - RSI calculation lookback
 * @returns {(number|null)[]} Array of RSI values [0..100]
 */
function calculateRSI(closes, period = 14) {
  if (!Array.isArray(closes) || closes.length < period + 1) {
    return new Array(closes ? closes.length : 0).fill(null);
  }

  const result = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = 0; i < period; i++) {
    result.push(null);
  }

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = 100 - 100 / (1 + rs);
  result.push(Number(rsi.toFixed(2)));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = 100 - 100 / (1 + rs);
    result.push(Number(rsi.toFixed(2)));
  }

  return result;
}

/**
 * Calculates Stochastic RSI (%K and %D lines).
 * @param {number[]} closes - Array of closing prices
 * @param {number} [rsiPeriod=14] - RSI lookback
 * @param {number} [stochPeriod=14] - Stochastic lookback over RSI values
 * @param {number} [kSmooth=3] - %K smoothing
 * @param {number} [dSmooth=3] - %D smoothing
 * @returns {{ k: (number|null)[], d: (number|null)[] }}
 */
function calculateStochasticRSI(closes, rsiPeriod = 14, stochPeriod = 14, kSmooth = 3, dSmooth = 3) {
  const rsi = calculateRSI(closes, rsiPeriod);
  const rawStoch = [];

  for (let i = 0; i < rsi.length; i++) {
    if (i < rsiPeriod + stochPeriod - 1 || rsi[i] === null) {
      rawStoch.push(null);
      continue;
    }
    const window = rsi.slice(i - stochPeriod + 1, i + 1).filter(v => v !== null);
    if (window.length < stochPeriod) {
      rawStoch.push(null);
      continue;
    }
    const minRSI = Math.min(...window);
    const maxRSI = Math.max(...window);
    const stoch = maxRSI === minRSI ? 50 : ((rsi[i] - minRSI) / (maxRSI - minRSI)) * 100;
    rawStoch.push(Number(stoch.toFixed(2)));
  }

  const validStoch = rawStoch.map(v => v === null ? 0 : v);
  const kLine = calculateSMA(validStoch, kSmooth);
  const dLine = calculateSMA(kLine.map(v => v === null ? 0 : v), dSmooth);

  return {
    k: kLine.map((val, idx) => rawStoch[idx] === null ? null : val),
    d: dLine.map((val, idx) => rawStoch[idx] === null ? null : val),
  };
}

/**
 * Calculates Average True Range (ATR).
 * @param {Candle[]} candles - Array of candle objects
 * @param {number} [period=14] - ATR period
 * @returns {(number|null)[]} Array of ATR values
 */
function calculateATR(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  const trs = [];

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      trs.push(candles[i].high - candles[i].low);
      continue;
    }
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trs.push(tr);
  }

  const result = [];
  let atr = 0;
  for (let i = 0; i < trs.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += trs[j];
      atr = sum / period;
    } else {
      atr = (atr * (period - 1) + trs[i]) / period;
    }
    result.push(Number(atr.toFixed(4)));
  }
  return result;
}

/**
 * Calculates MACD (Moving Average Convergence Divergence).
 * @param {number[]} closes - Array of closing prices
 * @param {number} [fastPeriod=12]
 * @param {number} [slowPeriod=26]
 * @param {number} [signalPeriod=9]
 * @returns {{ macd: (number|null)[], signal: (number|null)[], histogram: (number|null)[] }}
 */
function calculateMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  const macdLine = [];
  for (let i = 0; i < closes.length; i++) {
    if (fastEMA[i] === null || slowEMA[i] === null) {
      macdLine.push(null);
    } else {
      macdLine.push(fastEMA[i] - slowEMA[i]);
    }
  }

  const validMacd = macdLine.filter(v => v !== null);
  const validSignal = calculateEMA(validMacd, signalPeriod);

  const signalLine = [];
  let sigIdx = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null) {
      signalLine.push(null);
    } else {
      signalLine.push(validSignal[sigIdx] !== undefined ? validSignal[sigIdx] : null);
      sigIdx++;
    }
  }

  const histogram = [];
  for (let i = 0; i < closes.length; i++) {
    if (macdLine[i] === null || signalLine[i] === null) {
      histogram.push(null);
    } else {
      histogram.push(Number((macdLine[i] - signalLine[i]).toFixed(4)));
    }
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

/**
 * Calculates Bollinger Bands (Upper, Middle, Lower).
 * @param {number[]} closes - Array of closing prices
 * @param {number} [period=20]
 * @param {number} [stdDevMultiplier=2]
 * @returns {{ upper: (number|null)[], middle: (number|null)[], lower: (number|null)[] }}
 */
function calculateBollingerBands(closes, period = 20, stdDevMultiplier = 2) {
  const sma = calculateSMA(closes, period);
  const upper = [];
  const lower = [];
  const middle = sma;

  for (let i = 0; i < closes.length; i++) {
    if (sma[i] === null) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    let sumSq = 0;
    for (let j = 0; j < period; j++) {
      sumSq += Math.pow(closes[i - j] - sma[i], 2);
    }
    const stdDev = Math.sqrt(sumSq / period);
    upper.push(Number((sma[i] + stdDev * stdDevMultiplier).toFixed(4)));
    lower.push(Number((sma[i] - stdDev * stdDevMultiplier).toFixed(4)));
  }

  return { upper, middle, lower };
}

/**
 * Calculates Volume Weighted Average Price (VWAP).
 * @param {Candle[]} candles - Array of candle objects
 * @returns {number[]} Array of cumulative VWAP values
 */
function calculateVWAP(candles) {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  const vwap = [];
  let cumTypicalVolume = 0;
  let cumVolume = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const typicalPrice = (c.high + c.low + c.close) / 3;
    const vol = c.volume || 1;

    cumTypicalVolume += typicalPrice * vol;
    cumVolume += vol;

    vwap.push(Number((cumTypicalVolume / cumVolume).toFixed(4)));
  }
  return vwap;
}

/**
 * Calculates Fibonacci Retracement and Extension Levels between two price extremes.
 * @param {number} high - Swing High price
 * @param {number} low - Swing Low price
 * @param {boolean} [isUptrend=true] - Trend direction for projection
 * @returns {Object.<string, number>} Fibonacci key levels mapping
 */
function calculateFibonacciLevels(high, low, isUptrend = true) {
  const diff = high - low;
  if (isUptrend) {
    return {
      0.0: high,
      0.236: Number((high - diff * 0.236).toFixed(4)),
      0.382: Number((high - diff * 0.382).toFixed(4)),
      0.5: Number((high - diff * 0.5).toFixed(4)),
      0.618: Number((high - diff * 0.618).toFixed(4)),
      0.705: Number((high - diff * 0.705).toFixed(4)), // OTE Sweet Spot
      0.786: Number((high - diff * 0.786).toFixed(4)),
      1.0: low,
      1.272: Number((high + diff * 0.272).toFixed(4)),
      1.618: Number((high + diff * 0.618).toFixed(4)),
    };
  } else {
    return {
      0.0: low,
      0.236: Number((low + diff * 0.236).toFixed(4)),
      0.382: Number((low + diff * 0.382).toFixed(4)),
      0.5: Number((low + diff * 0.5).toFixed(4)),
      0.618: Number((low + diff * 0.618).toFixed(4)),
      0.705: Number((low + diff * 0.705).toFixed(4)), // OTE Sweet Spot
      0.786: Number((low + diff * 0.786).toFixed(4)),
      1.0: high,
      1.272: Number((low - diff * 0.272).toFixed(4)),
      1.618: Number((low - diff * 0.618).toFixed(4)),
    };
  }
}

/**
 * Computes all standard indicators in a single pure call for a candle series.
 * @param {Candle[]} candles - Array of candle objects
 * @returns {Object} Comprehensive latest indicator snapshot
 */
function computeAllIndicators(candles) {
  if (!Array.isArray(candles) || candles.length === 0) return {};
  const { closes } = getSeries(candles);
  const lastIdx = candles.length - 1;

  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const rsi14 = calculateRSI(closes, 14);
  const atr14 = calculateATR(candles, 14);
  const macd = calculateMACD(closes, 12, 26, 9);
  const bb = calculateBollingerBands(closes, 20, 2);
  const vwap = calculateVWAP(candles);

  const currentClose = closes[lastIdx];

  // Moving Average Trend Alignment
  let emaBias = 'NEUTRAL';
  if (ema9[lastIdx] && ema21[lastIdx] && ema50[lastIdx]) {
    if (currentClose > ema9[lastIdx] && ema9[lastIdx] > ema21[lastIdx] && ema21[lastIdx] > ema50[lastIdx]) {
      emaBias = 'BULLISH';
    } else if (currentClose < ema9[lastIdx] && ema9[lastIdx] < ema21[lastIdx] && ema21[lastIdx] < ema50[lastIdx]) {
      emaBias = 'BEARISH';
    }
  }

  // RSI Condition
  const currentRSI = rsi14[lastIdx];
  let rsiCondition = 'NEUTRAL';
  if (currentRSI >= 70) rsiCondition = 'OVERBOUGHT';
  else if (currentRSI <= 30) rsiCondition = 'OVERSOLD';

  return {
    ema9: ema9[lastIdx],
    ema21: ema21[lastIdx],
    ema50: ema50[lastIdx],
    ema200: ema200[lastIdx],
    emaBias,
    rsi: currentRSI,
    rsiCondition,
    atr: atr14[lastIdx],
    macd: {
      value: macd.macd[lastIdx],
      signal: macd.signal[lastIdx],
      histogram: macd.histogram[lastIdx],
      bias: (macd.histogram[lastIdx] || 0) > 0 ? 'BULLISH' : 'BEARISH',
    },
    bollingerBands: {
      upper: bb.upper[lastIdx],
      middle: bb.middle[lastIdx],
      lower: bb.lower[lastIdx],
      percentB: bb.upper[lastIdx] && bb.lower[lastIdx]
        ? Number(((currentClose - bb.lower[lastIdx]) / (bb.upper[lastIdx] - bb.lower[lastIdx])).toFixed(2))
        : null,
    },
    vwap: vwap[lastIdx],
    vwapBias: currentClose > vwap[lastIdx] ? 'BULLISH' : 'BEARISH',
  };
}

module.exports = {
  getSeries,
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateStochasticRSI,
  calculateATR,
  calculateMACD,
  calculateBollingerBands,
  calculateVWAP,
  calculateFibonacciLevels,
  computeAllIndicators,
};
