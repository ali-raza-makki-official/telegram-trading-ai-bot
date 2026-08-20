/**
 * Technical Indicators Engine
 * Computes deterministic indicators across candle arrays.
 */

// Helper to extract series arrays
function getSeries(candles) {
  const opens = candles.map(c => c.open);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume || 1);
  return { opens, highs, lows, closes, volumes };
}

// Simple Moving Average
function calculateSMA(values, period) {
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

// Exponential Moving Average
function calculateEMA(values, period) {
  const result = [];
  const k = 2 / (period + 1);
  let prevEMA = null;

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    if (prevEMA === null) {
      // First EMA is SMA
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

// Relative Strength Index (RSI)
function calculateRSI(closes, period = 14) {
  const result = [];
  if (closes.length < period + 1) {
    return new Array(closes.length).fill(null);
  }

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

// Average True Range (ATR)
function calculateATR(candles, period = 14) {
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

// MACD (Moving Average Convergence Divergence)
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

// Bollinger Bands
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

// VWAP (Volume Weighted Average Price)
function calculateVWAP(candles) {
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

// Fibonacci Retracement Levels between high and low
function calculateFibonacciLevels(high, low, isUptrend = true) {
  const diff = high - low;
  if (isUptrend) {
    return {
      0.0: high,
      0.236: high - diff * 0.236,
      0.382: high - diff * 0.382,
      0.5: high - diff * 0.5,
      0.618: high - diff * 0.618,
      0.705: high - diff * 0.705, // ICT OTE Sweet Spot
      0.786: high - diff * 0.786,
      1.0: low,
      1.272: high + diff * 0.272,
      1.618: high + diff * 0.618,
    };
  } else {
    return {
      0.0: low,
      0.236: low + diff * 0.236,
      0.382: low + diff * 0.382,
      0.5: low + diff * 0.5,
      0.618: low + diff * 0.618,
      0.705: low + diff * 0.705, // ICT OTE Sweet Spot
      0.786: low + diff * 0.786,
      1.0: high,
      1.272: low - diff * 0.272,
      1.618: low - diff * 0.618,
    };
  }
}

// Master Indicators Aggregator for a candle series
function computeAllIndicators(candles) {
  if (!candles || candles.length === 0) return {};
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
        ? ((currentClose - bb.lower[lastIdx]) / (bb.upper[lastIdx] - bb.lower[lastIdx])).toFixed(2)
        : null,
    },
    vwap: vwap[lastIdx],
    vwapBias: currentClose > vwap[lastIdx] ? 'BULLISH' : 'BEARISH',
  };
}

module.exports = {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateATR,
  calculateMACD,
  calculateBollingerBands,
  calculateVWAP,
  calculateFibonacciLevels,
  computeAllIndicators,
};
