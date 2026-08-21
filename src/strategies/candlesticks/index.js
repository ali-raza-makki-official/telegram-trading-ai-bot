/**
 * Comprehensive Japanese Candlestick Pattern Detection Engine
 * Detects Single, Double, Triple, and Continuation candlestick patterns.
 */

// Helper functions for candle metrics
function getCandleMetrics(c) {
  const isUp = c.close > c.open;
  const isDown = c.close < c.open;
  const body = Math.abs(c.close - c.open);
  const totalRange = c.high - c.low;
  const upperWick = isUp ? c.high - c.close : c.high - c.open;
  const lowerWick = isUp ? c.open - c.low : c.close - c.low;
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

  // Body is less than 10% of total range
  if (m.bodyRatio <= 0.1) {
    // Dragonfly Doji: long lower wick, virtually no upper wick
    if (m.lowerWickRatio >= 0.65 && m.upperWickRatio <= 0.1) {
      return { pattern: 'DRAGONFLY_DOJI', bias: 'BULLISH', confidence: 75, category: 'SINGLE' };
    }
    // Gravestone Doji: long upper wick, virtually no lower wick
    if (m.upperWickRatio >= 0.65 && m.lowerWickRatio <= 0.1) {
      return { pattern: 'GRAVESTONE_DOJI', bias: 'BEARISH', confidence: 75, category: 'SINGLE' };
    }
    // Long-Legged Doji: roughly equal long wicks on both sides
    if (m.upperWickRatio >= 0.35 && m.lowerWickRatio >= 0.35) {
      return { pattern: 'LONG_LEGGED_DOJI', bias: 'NEUTRAL', confidence: 65, category: 'SINGLE' };
    }
    return { pattern: 'STANDARD_DOJI', bias: 'NEUTRAL', confidence: 60, category: 'SINGLE' };
  }
  return null;
}

function checkHammer(c, isDowntrend = true) {
  const m = getCandleMetrics(c);
  // Lower wick >= 2x body, upper wick <= 10% total range, body in top 1/3
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
  // Upper wick >= 2x body, lower wick <= 10% total range, body in bottom 1/3
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
  // Body takes up >= 90% of total range
  if (m.bodyRatio >= 0.88 && m.totalRange > 0) {
    if (m.isUp) {
      return { pattern: 'BULLISH_MARUBOZU', bias: 'BULLISH', confidence: 85, category: 'SINGLE' };
    } else {
      return { pattern: 'BEARISH_MARUBOZU', bias: 'BEARISH', confidence: 85, category: 'SINGLE' };
    }
  }
  return null;
}

function checkSpinningTop(c) {
  const m = getCandleMetrics(c);
  // Small body (15-35%), significant wicks on both sides
  if (m.bodyRatio >= 0.12 && m.bodyRatio <= 0.35 && m.upperWickRatio >= 0.25 && m.lowerWickRatio >= 0.25) {
    return { pattern: 'SPINNING_TOP', bias: 'NEUTRAL', confidence: 55, category: 'SINGLE' };
  }
  return null;
}

// -------------------------------------------------------------
// TWO CANDLE PATTERNS
// -------------------------------------------------------------

function checkEngulfing(c1, c2) {
  const m1 = getCandleMetrics(c1);
  const m2 = getCandleMetrics(c2);

  // Bullish Engulfing: c1 is down, c2 is up, c2 body completely engulfs c1 body
  if (m1.isDown && m2.isUp && c2.open <= c1.close && c2.close >= c1.open && m2.body > m1.body) {
    return { pattern: 'BULLISH_ENGULFING', bias: 'BULLISH', confidence: 85, category: 'DOUBLE' };
  }

  // Bearish Engulfing: c1 is up, c2 is down, c2 body completely engulfs c1 body
  if (m1.isUp && m2.isDown && c2.open >= c1.close && c2.close <= c1.open && m2.body > m1.body) {
    return { pattern: 'BEARISH_ENGULFING', bias: 'BEARISH', confidence: 85, category: 'DOUBLE' };
  }

  return null;
}

function checkPiercingAndDarkCloud(c1, c2) {
  const m1 = getCandleMetrics(c1);
  const m2 = getCandleMetrics(c2);
  const mid1 = (c1.open + c1.close) / 2;

  // Piercing Line: c1 down, c2 up opens below c1 low and closes above mid1
  if (m1.isDown && m2.isUp && c2.open < c1.low && c2.close > mid1 && c2.close < c1.open) {
    return { pattern: 'PIERCING_LINE', bias: 'BULLISH', confidence: 80, category: 'DOUBLE' };
  }

  // Dark Cloud Cover: c1 up, c2 down opens above c1 high and closes below mid1
  if (m1.isUp && m2.isDown && c2.open > c1.high && c2.close < mid1 && c2.close > c1.open) {
    return { pattern: 'DARK_CLOUD_COVER', bias: 'BEARISH', confidence: 80, category: 'DOUBLE' };
  }

  return null;
}

function checkTweezer(c1, c2, tolerancePips = 0.5) {
  // Tweezer Top: high of both candles match closely
  if (Math.abs(c1.high - c2.high) <= tolerancePips) {
    if (c1.close > c1.open && c2.close < c2.open) {
      return { pattern: 'TWEEZER_TOP', bias: 'BEARISH', confidence: 75, category: 'DOUBLE' };
    }
  }

  // Tweezer Bottom: low of both candles match closely
  if (Math.abs(c1.low - c2.low) <= tolerancePips) {
    if (c1.close < c1.open && c2.close > c2.open) {
      return { pattern: 'TWEEZER_BOTTOM', bias: 'BULLISH', confidence: 75, category: 'DOUBLE' };
    }
  }

  return null;
}

function checkHarami(c1, c2) {
  const m1 = getCandleMetrics(c1);
  const m2 = getCandleMetrics(c2);

  // Bullish Harami: c1 large down candle, c2 small body completely contained within c1 body
  if (m1.isDown && m1.bodyRatio > 0.5 && c2.open > c1.close && c2.close < c1.open) {
    if (m2.bodyRatio < 0.1) {
      return { pattern: 'BULLISH_HARAMI_CROSS', bias: 'BULLISH', confidence: 80, category: 'DOUBLE' };
    }
    return { pattern: 'BULLISH_HARAMI', bias: 'BULLISH', confidence: 70, category: 'DOUBLE' };
  }

  // Bearish Harami: c1 large up candle, c2 small body completely contained within c1 body
  if (m1.isUp && m1.bodyRatio > 0.5 && c2.open < c1.close && c2.close > c1.open) {
    if (m2.bodyRatio < 0.1) {
      return { pattern: 'BEARISH_HARAMI_CROSS', bias: 'BEARISH', confidence: 80, category: 'DOUBLE' };
    }
    return { pattern: 'BEARISH_HARAMI', bias: 'BEARISH', confidence: 70, category: 'DOUBLE' };
  }

  return null;
}

// -------------------------------------------------------------
// THREE CANDLE PATTERNS
// -------------------------------------------------------------

function checkMorningEveningStar(c1, c2, c3) {
  const m1 = getCandleMetrics(c1);
  const m2 = getCandleMetrics(c2);
  const m3 = getCandleMetrics(c3);

  // Morning Star: c1 long down, c2 small body star gapping down, c3 long up closing > c1 midpoint
  if (m1.isDown && m1.bodyRatio > 0.4 && m2.bodyRatio < 0.3 && m3.isUp && m3.bodyRatio > 0.4) {
    const c1Mid = (c1.open + c1.close) / 2;
    if (c3.close > c1Mid) {
      return { pattern: 'MORNING_STAR', bias: 'BULLISH', confidence: 90, category: 'TRIPLE' };
    }
  }

  // Evening Star: c1 long up, c2 small body star gapping up, c3 long down closing < c1 midpoint
  if (m1.isUp && m1.bodyRatio > 0.4 && m2.bodyRatio < 0.3 && m3.isDown && m3.bodyRatio > 0.4) {
    const c1Mid = (c1.open + c1.close) / 2;
    if (c3.close < c1Mid) {
      return { pattern: 'EVENING_STAR', bias: 'BEARISH', confidence: 90, category: 'TRIPLE' };
    }
  }

  return null;
}

function checkThreeSoldiersCrows(c1, c2, c3) {
  const m1 = getCandleMetrics(c1);
  const m2 = getCandleMetrics(c2);
  const m3 = getCandleMetrics(c3);

  // Three White Soldiers: 3 consecutive long bullish candles making new highs with small wicks
  if (m1.isUp && m2.isUp && m3.isUp && c2.close > c1.close && c3.close > c2.close && m1.bodyRatio > 0.5 && m2.bodyRatio > 0.5 && m3.bodyRatio > 0.5) {
    return { pattern: 'THREE_WHITE_SOLDIERS', bias: 'BULLISH', confidence: 90, category: 'TRIPLE' };
  }

  // Three Black Crows: 3 consecutive long bearish candles making new lows with small wicks
  if (m1.isDown && m2.isDown && m3.isDown && c2.close < c1.close && c3.close < c2.close && m1.bodyRatio > 0.5 && m2.bodyRatio > 0.5 && m3.bodyRatio > 0.5) {
    return { pattern: 'THREE_BLACK_CROWS', bias: 'BEARISH', confidence: 90, category: 'TRIPLE' };
  }

  return null;
}

function checkThreeInsideOutside(c1, c2, c3) {
  // Three Inside Up: Harami (c1 down, c2 inside up) followed by c3 up candle closing above c1 high
  if (c1.close < c1.open && c2.open > c1.close && c2.close < c1.open && c3.close > c1.open && c3.close > c3.open) {
    return { pattern: 'THREE_INSIDE_UP', bias: 'BULLISH', confidence: 85, category: 'TRIPLE' };
  }

  // Three Inside Down: Harami (c1 up, c2 inside down) followed by c3 down candle closing below c1 low
  if (c1.close > c1.open && c2.open < c1.close && c2.close > c1.open && c3.close < c1.open && c3.close < c3.open) {
    return { pattern: 'THREE_INSIDE_DOWN', bias: 'BEARISH', confidence: 85, category: 'TRIPLE' };
  }

  // Three Outside Up: Bullish Engulfing (c1, c2) followed by c3 closing higher
  if (c1.close < c1.open && c2.close > c2.open && c2.close > c1.open && c2.open < c1.close && c3.close > c2.close) {
    return { pattern: 'THREE_OUTSIDE_UP', bias: 'BULLISH', confidence: 85, category: 'TRIPLE' };
  }

  // Three Outside Down: Bearish Engulfing (c1, c2) followed by c3 closing lower
  if (c1.close > c1.open && c2.close < c2.open && c2.close < c1.open && c2.open > c1.close && c3.close < c2.close) {
    return { pattern: 'THREE_OUTSIDE_DOWN', bias: 'BEARISH', confidence: 85, category: 'TRIPLE' };
  }

  return null;
}

// -------------------------------------------------------------
// MASTER CANDLESTICK PATTERN RECOGNIZER
// -------------------------------------------------------------

function scanCandlestickPatterns(candles) {
  if (!candles || candles.length < 3) return { patterns: [], primaryPattern: null, bias: 'NEUTRAL', score: 0 };

  const len = candles.length;
  const c3 = candles[len - 1]; // Current candle
  const c2 = candles[len - 2]; // 1 candle back
  const c1 = candles[len - 3]; // 2 candles back

  const detected = [];

  // 1. Check Triple Patterns
  const star = checkMorningEveningStar(c1, c2, c3);
  if (star) detected.push({ ...star, candleIndices: [len - 3, len - 2, len - 1] });

  const soldiers = checkThreeSoldiersCrows(c1, c2, c3);
  if (soldiers) detected.push({ ...soldiers, candleIndices: [len - 3, len - 2, len - 1] });

  const insideOutside = checkThreeInsideOutside(c1, c2, c3);
  if (insideOutside) detected.push({ ...insideOutside, candleIndices: [len - 3, len - 2, len - 1] });

  // 2. Check Double Patterns on (c2, c3)
  const engulfing = checkEngulfing(c2, c3);
  if (engulfing) detected.push({ ...engulfing, candleIndices: [len - 2, len - 1] });

  const piercing = checkPiercingAndDarkCloud(c2, c3);
  if (piercing) detected.push({ ...piercing, candleIndices: [len - 2, len - 1] });

  const tweezer = checkTweezer(c2, c3);
  if (tweezer) detected.push({ ...tweezer, candleIndices: [len - 2, len - 1] });

  const harami = checkHarami(c2, c3);
  if (harami) detected.push({ ...harami, candleIndices: [len - 2, len - 1] });

  // 3. Check Single Patterns on current candle c3
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
  scanCandlestickPatterns,
  analyzeCandlesticks: scanCandlestickPatterns,
  checkDoji,
  checkHammer,
  checkInvertedHammer,
  checkMarubozu,
  checkEngulfing,
  checkPiercingAndDarkCloud,
  checkTweezer,
  checkHarami,
  checkMorningEveningStar,
  checkThreeSoldiersCrows,
};
