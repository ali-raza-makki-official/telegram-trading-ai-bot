/**
 * ICT / Classical Turtle Soup Pattern
 * False breakout of a 20-period swing high or low with sharp rejection back into the range.
 */

function detectTurtleSoup(candles, lookback = 20) {
  if (!candles || candles.length < lookback + 2) return null;

  const priorCandles = candles.slice(-lookback - 1, -1);
  const currentCandle = candles[candles.length - 1];

  const highestHigh = Math.max(...priorCandles.map(c => c.high));
  const lowestLow = Math.min(...priorCandles.map(c => c.low));

  // 1. Turtle Soup Short (Bull trap): Current candle or previous candle breached 20-period High, but closed back below
  if (currentCandle.high > highestHigh && currentCandle.close < highestHigh) {
    const wickAbove = currentCandle.high - highestHigh;
    return {
      type: 'TURTLE_SOUP_SHORT',
      bias: 'BEARISH',
      sweptHigh: highestHigh,
      rejectionHigh: currentCandle.high,
      wickExcess: Number(wickAbove.toFixed(2)),
      suggestedSl: currentCandle.high + 1.0,
      suggestedTp: Number(((highestHigh + lowestLow) / 2).toFixed(2)),
      confidence: 75,
      description: `Turtle Soup Short: False breakout above 20-period High (${highestHigh.toFixed(2)}) rejected back into range.`,
    };
  }

  // 2. Turtle Soup Long (Bear trap): Current candle breached 20-period Low, but closed back above
  if (currentCandle.low < lowestLow && currentCandle.close > lowestLow) {
    const wickBelow = lowestLow - currentCandle.low;
    return {
      type: 'TURTLE_SOUP_LONG',
      bias: 'BULLISH',
      sweptLow: lowestLow,
      rejectionLow: currentCandle.low,
      wickExcess: Number(wickBelow.toFixed(2)),
      suggestedSl: currentCandle.low - 1.0,
      suggestedTp: Number(((highestHigh + lowestLow) / 2).toFixed(2)),
      confidence: 75,
      description: `Turtle Soup Long: False breakdown below 20-period Low (${lowestLow.toFixed(2)}) rejected back into range.`,
    };
  }

  return null;
}

module.exports = {
  detectTurtleSoup,
};
