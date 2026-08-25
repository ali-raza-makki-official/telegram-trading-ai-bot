/**
 * @fileoverview Pure Candlestick Pattern Recognition Module
 * 20+ Japanese Candlestick pattern detectors with deterministic geometric classification.
 * Zero external network, DB, or SDK dependencies.
 */

/**
 * Calculates geometric proportions and wick/body metrics of a single candle.
 * @param {Object} c - Candle object { open, high, low, close }
 * @returns {Object} Metric breakdown
 */
function getCandleMetrics(c) {
  const open = Number(c.open);
  const high = Number(c.high);
  const low = Number(c.low);
  const close = Number(c.close);

  const isUp = close > open;
  const isDown = close < open;
  const body = Math.abs(close - open);
  const totalRange = high - low;
  const upperWick = isUp ? high - close : high - open;
  const lowerWick = isUp ? open - low : close - low;
  const bodyRatio = totalRange > 0 ? body / totalRange : 0;
  const upperWickRatio = totalRange > 0 ? upperWick / totalRange : 0;
  const lowerWickRatio = totalRange > 0 ? lowerWick / totalRange : 0;

  return {
    isUp,
    isDown,
    body,
    totalRange,
    upperWick,
    lowerWick,
    bodyRatio,
    upperWickRatio,
    lowerWickRatio,
  };
}

// -------------------------------------------------------------
// SINGLE CANDLE PATTERNS
// -------------------------------------------------------------

function checkDoji(c) {
  const m = getCandleMetrics(c);
  if (m.totalRange === 0) return null;

  if (m.bodyRatio <= 0.1) {
    if (m.lowerWickRatio >= 0.65 && m.upperWickRatio <= 0.1) {
      return { pattern: 'DRAGONFLY_DOJI', bias: 'BULLISH', confidence: 75, category: 'SINGLE' };
    }
    if (m.upperWickRatio >= 0.65 && m.lowerWickRatio <= 0.1) {
      return { pattern: 'GRAVESTONE_DOJI', bias: 'BEARISH', confidence: 75, category: 'SINGLE' };
    }
    if (m.upperWickRatio >= 0.35 && m.lowerWickRatio >= 0.35) {
      return { pattern: 'LONG_LEGGED_DOJI', bias: 'NEUTRAL', confidence: 65, category: 'SINGLE' };
    }
    return { pattern: 'STANDARD_DOJI', bias: 'NEUTRAL', confidence: 60, category: 'SINGLE' };
  }
  return null;
}

function checkHammer(c, isDowntrend = true) {
  const m = getCandleMetrics(c);
  if (m.lowerWick >= m.body * 2 && m.upperWickRatio <= 0.15 && m.bodyRatio >= 0.1) {
    if (isDowntrend) {
      return { pattern: 'HAMMER', bias: 'BULLISH', confidence: 80, category: 'SINGLE' };
    } else {
      return { pattern: 'HANGING_MAN', bias: 'BEARISH', confidence: 70, category: 'SINGLE' };
    }
  }
  return null;
}

function checkInvertedHammer(c, isDowntrend = true) {
  const m = getCandleMetrics(c);
  if (m.upperWick >= m.body * 2 && m.lowerWickRatio <= 0.15 && m.bodyRatio >= 0.1) {
    if (isDowntrend) {
      return { pattern: 'INVERTED_HAMMER', bias: 'BULLISH', confidence: 75, category: 'SINGLE' };
    } else {
      return { pattern: 'SHOOTING_STAR', bias: 'BEARISH', confidence: 80, category: 'SINGLE' };
    }
  }
  return null;
}

function checkMarubozu(c) {
  const m = getCandleMetrics(c);
  if (m.bodyRatio >= 0.85) {
    return {
      pattern: m.isUp ? 'BULLISH_MARUBOZU' : 'BEARISH_MARUBOZU',
      bias: m.isUp ? 'BULLISH' : 'BEARISH',
      confidence: 75,
      category: 'SINGLE',
    };
  }
  return null;
}

function checkSpinningTop(c) {
  const m = getCandleMetrics(c);
  if (m.bodyRatio > 0.1 && m.bodyRatio <= 0.35 && m.upperWickRatio >= 0.25 && m.lowerWickRatio >= 0.25) {
    return { pattern: 'SPINNING_TOP', bias: 'NEUTRAL', confidence: 55, category: 'SINGLE' };
  }
  return null;
}

// -------------------------------------------------------------
// DOUBLE CANDLE PATTERNS
// -------------------------------------------------------------

function checkEngulfing(prev, curr) {
  const m1 = getCandleMetrics(prev);
  const m2 = getCandleMetrics(curr);

  // Bullish Engulfing: prev bearish, curr bullish, curr body fully wraps prev body
  if (m1.isDown && m2.isUp && curr.open <= prev.close && curr.close >= prev.open && m2.body > m1.body * 1.05) {
    return { pattern: 'BULLISH_ENGULFING', bias: 'BULLISH', confidence: 85, category: 'DOUBLE' };
  }

  // Bearish Engulfing: prev bullish, curr bearish, curr body fully wraps prev body
  if (m1.isUp && m2.isDown && curr.open >= prev.close && curr.close <= prev.open && m2.body > m1.body * 1.05) {
    return { pattern: 'BEARISH_ENGULFING', bias: 'BEARISH', confidence: 85, category: 'DOUBLE' };
  }

  return null;
}

function checkPiercingAndDarkCloud(prev, curr) {
  const m1 = getCandleMetrics(prev);
  const m2 = getCandleMetrics(curr);
  const prevMid = (prev.open + prev.close) / 2;

  // Piercing Line: Prev big red, curr opens below prev low, closes above midpoint of prev body
  if (m1.isDown && m2.isUp && curr.open < prev.low && curr.close > prevMid && curr.close < prev.open) {
    return { pattern: 'PIERCING_LINE', bias: 'BULLISH', confidence: 75, category: 'DOUBLE' };
  }

  // Dark Cloud Cover: Prev big green, curr opens above prev high, closes below midpoint of prev body
  if (m1.isUp && m2.isDown && curr.open > prev.high && curr.close < prevMid && curr.close > prev.open) {
    return { pattern: 'DARK_CLOUD_COVER', bias: 'BEARISH', confidence: 75, category: 'DOUBLE' };
  }

  return null;
}

function checkTweezer(prev, curr) {
  const m1 = getCandleMetrics(prev);
  const m2 = getCandleMetrics(curr);
  const maxRange = Math.max(m1.totalRange, m2.totalRange);
  if (maxRange === 0) return null;

  const lowDiff = Math.abs(prev.low - curr.low);
  if (lowDiff / maxRange <= 0.05 && m1.isDown && m2.isUp && m1.lowerWickRatio >= 0.3 && m2.lowerWickRatio >= 0.3) {
    return { pattern: 'TWEEZER_BOTTOM', bias: 'BULLISH', confidence: 75, category: 'DOUBLE' };
  }

  const highDiff = Math.abs(prev.high - curr.high);
  if (highDiff / maxRange <= 0.05 && m1.isUp && m2.isDown && m1.upperWickRatio >= 0.3 && m2.upperWickRatio >= 0.3) {
    return { pattern: 'TWEEZER_TOP', bias: 'BEARISH', confidence: 75, category: 'DOUBLE' };
  }

  return null;
}

function checkHarami(prev, curr) {
  const m1 = getCandleMetrics(prev);
  const m2 = getCandleMetrics(curr);

  // Bullish Harami: Prev big red, curr small green inside prev body
  if (m1.isDown && m2.isUp && curr.open > prev.close && curr.close < prev.open && m2.body < m1.body * 0.6) {
    return { pattern: 'BULLISH_HARAMI', bias: 'BULLISH', confidence: 70, category: 'DOUBLE' };
  }

  // Bearish Harami: Prev big green, curr small red inside prev body
  if (m1.isUp && m2.isDown && curr.open < prev.close && curr.close > prev.open && m2.body < m1.body * 0.6) {
    return { pattern: 'BEARISH_HARAMI', bias: 'BEARISH', confidence: 70, category: 'DOUBLE' };
  }

  return null;
}

// -------------------------------------------------------------
// TRIPLE CANDLE PATTERNS
// -------------------------------------------------------------

function checkMorningEveningStar(c1, c2, c3) {
  const m1 = getCandleMetrics(c1);
  const m2 = getCandleMetrics(c2);
  const m3 = getCandleMetrics(c3);
  const c1Mid = (c1.open + c1.close) / 2;

  // Morning Star: 1. Big red, 2. Small body star gapping down, 3. Big green closing above c1 midpoint
  if (m1.isDown && m1.bodyRatio >= 0.5 && m2.bodyRatio <= 0.3 && m3.isUp && m3.bodyRatio >= 0.5 && c3.close > c1Mid) {
    return { pattern: 'MORNING_STAR', bias: 'BULLISH', confidence: 85, category: 'TRIPLE' };
  }

  // Evening Star: 1. Big green, 2. Small body star gapping up, 3. Big red closing below c1 midpoint
  if (m1.isUp && m1.bodyRatio >= 0.5 && m2.bodyRatio <= 0.3 && m3.isDown && m3.bodyRatio >= 0.5 && c3.close < c1Mid) {
    return { pattern: 'EVENING_STAR', bias: 'BEARISH', confidence: 85, category: 'TRIPLE' };
  }

  return null;
}

function checkThreeSoldiersCrows(c1, c2, c3) {
  const m1 = getCandleMetrics(c1);
  const m2 = getCandleMetrics(c2);
  const m3 = getCandleMetrics(c3);

  // Three White Soldiers: 3 consecutive big green candles, higher closes, small upper wicks
  if (m1.isUp && m2.isUp && m3.isUp &&
      c2.close > c1.close && c3.close > c2.close &&
      c2.open > c1.open && c3.open > c2.open &&
      m1.bodyRatio >= 0.6 && m2.bodyRatio >= 0.6 && m3.bodyRatio >= 0.6) {
    return { pattern: 'THREE_WHITE_SOLDIERS', bias: 'BULLISH', confidence: 90, category: 'TRIPLE' };
  }

  // Three Black Crows: 3 consecutive big red candles, lower closes, small lower wicks
  if (m1.isDown && m2.isDown && m3.isDown &&
      c2.close < c1.close && c3.close < c2.close &&
      c2.open < c1.open && c3.open < c2.open &&
      m1.bodyRatio >= 0.6 && m2.bodyRatio >= 0.6 && m3.bodyRatio >= 0.6) {
    return { pattern: 'THREE_BLACK_CROWS', bias: 'BEARISH', confidence: 90, category: 'TRIPLE' };
  }

  return null;
}

// -------------------------------------------------------------
// PATTERN SCANNER & AGGREGATOR
// -------------------------------------------------------------

/**
 * Scans a candle array for all active candlestick patterns on latest closed bars.
 * @param {Object[]} candles - Array of candle objects
 * @returns {Object} Aggregated pattern score and primary pattern
 */
function scanCandlestickPatterns(candles) {
  if (!Array.isArray(candles) || candles.length < 3) {
    return { patterns: [], primaryPattern: null, bias: 'NEUTRAL', score: 0 };
  }

  const len = candles.length;
  const c1 = candles[len - 3];
  const c2 = candles[len - 2];
  const c3 = candles[len - 1];

  const detected = [];

  // 1. Triple Patterns on (c1, c2, c3)
  const star = checkMorningEveningStar(c1, c2, c3);
  if (star) detected.push({ ...star, candleIndices: [len - 3, len - 2, len - 1] });

  const soldiersCrows = checkThreeSoldiersCrows(c1, c2, c3);
  if (soldiersCrows) detected.push({ ...soldiersCrows, candleIndices: [len - 3, len - 2, len - 1] });

  // 2. Double Patterns on (c2, c3)
  const engulfing = checkEngulfing(c2, c3);
  if (engulfing) detected.push({ ...engulfing, candleIndices: [len - 2, len - 1] });

  const piercing = checkPiercingAndDarkCloud(c2, c3);
  if (piercing) detected.push({ ...piercing, candleIndices: [len - 2, len - 1] });

  const tweezer = checkTweezer(c2, c3);
  if (tweezer) detected.push({ ...tweezer, candleIndices: [len - 2, len - 1] });

  const harami = checkHarami(c2, c3);
  if (harami) detected.push({ ...harami, candleIndices: [len - 2, len - 1] });

  // 3. Single Patterns on c3
  const isDowntrend = c2.close < candles[Math.max(0, len - 6)].close;
  const hammer = checkHammer(c3, isDowntrend);
  if (hammer) detected.push({ ...hammer, candleIndices: [len - 1] });

  const invHammer = checkInvertedHammer(c3, isDowntrend);
  if (invHammer) detected.push({ ...invHammer, candleIndices: [len - 1] });

  const marubozu = checkMarubozu(c3);
  if (marubozu) detected.push({ ...marubozu, candleIndices: [len - 1] });

  const doji = checkDoji(c3);
  if (doji) detected.push({ ...doji, candleIndices: [len - 1] });

  const spinning = checkSpinningTop(c3);
  if (spinning) detected.push({ ...spinning, candleIndices: [len - 1] });

  // Score aggregation
  let totalScore = 0;
  for (const p of detected) {
    const weight = p.confidence / 100;
    if (p.bias === 'BULLISH') totalScore += 30 * weight;
    else if (p.bias === 'BEARISH') totalScore -= 30 * weight;
  }
  totalScore = Math.max(-100, Math.min(100, totalScore));

  const primaryPattern = detected.sort((a, b) => b.confidence - a.confidence)[0] || null;

  let bias = 'NEUTRAL';
  if (totalScore >= 20) bias = 'BULLISH';
  else if (totalScore <= -20) bias = 'BEARISH';

  return {
    patterns: detected,
    primaryPattern,
    bias,
    score: Number(totalScore.toFixed(1)),
  };
}

module.exports = {
  getCandleMetrics,
  checkDoji,
  checkHammer,
  checkInvertedHammer,
  checkMarubozu,
  checkSpinningTop,
  checkEngulfing,
  checkPiercingAndDarkCloud,
  checkTweezer,
  checkHarami,
  checkMorningEveningStar,
  checkThreeSoldiersCrows,
  scanCandlestickPatterns,
  analyzeCandlesticks: scanCandlestickPatterns,
};
