/**
 * Deterministic Candlestick Pattern Detector Engine
 * Matches Japanese Candlestick Patterns on confirmed candle closes.
 */

function detectPattern(patternType, candles = []) {
  if (!candles || candles.length < 3) return false;

  const c0 = candles[candles.length - 1]; // Latest closed candle
  const c1 = candles[candles.length - 2]; // Previous candle
  const c2 = candles[candles.length - 3]; // 2 candles ago

  const isUp = c0.close > c0.open;
  const isDown = c0.close < c0.open;
  const body = Math.abs(c0.close - c0.open);
  const totalRange = c0.high - c0.low;
  const upperWick = isUp ? c0.high - c0.close : c0.high - c0.open;
  const lowerWick = isUp ? c0.open - c0.low : c0.close - c0.low;

  if (totalRange === 0) return false;

  const target = patternType?.toUpperCase();

  switch (target) {
    case 'HAMMER':
    case 'PINBAR': {
      // Long lower shadow (>= 2x body), very small upper shadow
      return lowerWick >= body * 2 && upperWick <= totalRange * 0.15 && body >= totalRange * 0.1;
    }

    case 'SHOOTINGSTAR': {
      // Long upper shadow (>= 2x body), very small lower shadow
      return upperWick >= body * 2 && lowerWick <= totalRange * 0.15 && body >= totalRange * 0.1;
    }

    case 'BULLISHENGULFING': {
      // Previous candle was bearish, current candle is bullish and completely engulfs previous body
      const prevDown = c1.close < c1.open;
      return prevDown && isUp && c0.open <= c1.close && c0.close >= c1.open;
    }

    case 'BEARISHENGULFING': {
      // Previous candle was bullish, current candle is bearish and engulfs previous body
      const prevUp = c1.close > c1.open;
      return prevUp && isDown && c0.open >= c1.close && c0.close <= c1.open;
    }

    case 'DOJI': {
      // Body is very thin (less than 10% of total range)
      return body / totalRange <= 0.1;
    }

    case 'MORNINGSTAR': {
      // 3-candle pattern: Bearish, Small body star, Strong Bullish close above 50% of first candle
      const firstBear = c2.close < c2.open;
      const secondStar = Math.abs(c1.close - c1.open) < (c2.high - c2.low) * 0.3;
      const thirdBull = isUp && c0.close > (c2.open + c2.close) / 2;
      return firstBear && secondStar && thirdBull;
    }

    case 'EVENINGSTAR': {
      // 3-candle pattern: Bullish, Small body star, Strong Bearish close below 50% of first candle
      const firstBull = c2.close > c2.open;
      const secondStar = Math.abs(c1.close - c1.open) < (c2.high - c2.low) * 0.3;
      const thirdBear = isDown && c0.close < (c2.open + c2.close) / 2;
      return firstBull && secondStar && thirdBear;
    }

    case 'INSIDEBAR': {
      // Current candle high and low are completely inside previous candle range
      return c0.high <= c1.high && c0.low >= c1.low;
    }

    case 'MARUBOZU': {
      // Very long body with virtually zero wicks (> 85% body)
      return body / totalRange >= 0.85;
    }

    case 'TWEEZERBOTTOM': {
      // Matching lows with reversal confirmation
      return Math.abs(c0.low - c1.low) <= 0.3 && isUp && c1.close < c1.open;
    }

    case 'TWEEZERTOP': {
      // Matching highs with reversal confirmation
      return Math.abs(c0.high - c1.high) <= 0.3 && isDown && c1.close > c1.open;
    }

    default:
      return false;
  }
}

module.exports = {
  detectPattern,
};
