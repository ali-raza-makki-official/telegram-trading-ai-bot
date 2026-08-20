/**
 * SMC Fair Value Gaps (FVG) / Imbalances (BISI & SIBI)
 */

function findFairValueGaps(candles, lookback = 100) {
  if (!candles || candles.length < 3) return { bullishFVGs: [], bearishFVGs: [], activeFVGs: [] };

  const startIdx = Math.max(0, candles.length - lookback);
  const bullishFVGs = [];
  const bearishFVGs = [];

  for (let i = startIdx; i < candles.length - 2; i++) {
    const c1 = candles[i];
    const c2 = candles[i + 1];
    const c3 = candles[i + 2];

    // Bullish FVG (BISI): Candle 1 High is less than Candle 3 Low
    if (c3.low > c1.high) {
      const top = c3.low;
      const bottom = c1.high;
      const ce = (top + bottom) / 2; // Consequent Encroachment (50%)
      const gapSize = top - bottom;

      // Track subsequent mitigation / fills
      let isFilled = false;
      let filledPercentage = 0;
      let minLowAfter = top;

      for (let j = i + 3; j < candles.length; j++) {
        if (candles[j].low < minLowAfter) {
          minLowAfter = candles[j].low;
        }
        if (candles[j].low <= bottom) {
          isFilled = true;
          filledPercentage = 100;
          break;
        }
      }

      if (!isFilled) {
        if (minLowAfter < top) {
          filledPercentage = Number((((top - minLowAfter) / gapSize) * 100).toFixed(1));
        }
        bullishFVGs.push({
          type: 'BULLISH_FVG',
          index: i + 1,
          timestamp: c2.timestamp,
          top,
          bottom,
          consequentEncroachment: ce,
          gapSize: Number(gapSize.toFixed(2)),
          filledPercentage,
          isFilled: false,
          ageBars: candles.length - 1 - (i + 1),
        });
      }
    }

    // Bearish FVG (SIBI): Candle 1 Low is greater than Candle 3 High
    if (c1.low > c3.high) {
      const top = c1.low;
      const bottom = c3.high;
      const ce = (top + bottom) / 2;
      const gapSize = top - bottom;

      let isFilled = false;
      let filledPercentage = 0;
      let maxHighAfter = bottom;

      for (let j = i + 3; j < candles.length; j++) {
        if (candles[j].high > maxHighAfter) {
          maxHighAfter = candles[j].high;
        }
        if (candles[j].high >= top) {
          isFilled = true;
          filledPercentage = 100;
          break;
        }
      }

      if (!isFilled) {
        if (maxHighAfter > bottom) {
          filledPercentage = Number((((maxHighAfter - bottom) / gapSize) * 100).toFixed(1));
        }
        bearishFVGs.push({
          type: 'BEARISH_FVG',
          index: i + 1,
          timestamp: c2.timestamp,
          top,
          bottom,
          consequentEncroachment: ce,
          gapSize: Number(gapSize.toFixed(2)),
          filledPercentage,
          isFilled: false,
          ageBars: candles.length - 1 - (i + 1),
        });
      }
    }
  }

  const activeBullish = bullishFVGs.filter(f => f.filledPercentage < 80).slice(-3);
  const activeBearish = bearishFVGs.filter(f => f.filledPercentage < 80).slice(-3);

  return {
    bullishFVGs: bullishFVGs.slice(-6),
    bearishFVGs: bearishFVGs.slice(-6),
    activeBullish,
    activeBearish,
    nearestBullishFVG: activeBullish[activeBullish.length - 1] || null,
    nearestBearishFVG: activeBearish[activeBearish.length - 1] || null,
  };
}

module.exports = {
  findFairValueGaps,
};
