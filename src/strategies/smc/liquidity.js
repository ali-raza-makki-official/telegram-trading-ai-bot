/**
 * SMC Liquidity Pools & Sweeps
 * Identifies Equal Highs (EQH), Equal Lows (EQL), BSL (Buy-Side Liquidity), SSL (Sell-Side Liquidity), and Liquidity Sweeps.
 */

function findLiquidityPools(candles, swingPoints, tolerancePips = 0.5) {
  if (!candles || candles.length < 10) return { eqh: [], eql: [], sweeps: [] };

  const { swingHighs = [], swingLows = [] } = swingPoints || {};
  const eqh = [];
  const eql = [];
  const sweeps = [];

  // 1. Equal Highs Detection (BSL pool)
  for (let i = 0; i < swingHighs.length; i++) {
    for (let j = i + 1; j < swingHighs.length; j++) {
      const h1 = swingHighs[i];
      const h2 = swingHighs[j];
      if (Math.abs(h1.price - h2.price) <= tolerancePips) {
        eqh.push({
          type: 'EQH',
          level: Number(((h1.price + h2.price) / 2).toFixed(2)),
          points: [h1, h2],
          timestamp: h2.timestamp,
        });
      }
    }
  }

  // 2. Equal Lows Detection (SSL pool)
  for (let i = 0; i < swingLows.length; i++) {
    for (let j = i + 1; j < swingLows.length; j++) {
      const l1 = swingLows[i];
      const l2 = swingLows[j];
      if (Math.abs(l1.price - l2.price) <= tolerancePips) {
        eql.push({
          type: 'EQL',
          level: Number(((l1.price + l2.price) / 2).toFixed(2)),
          points: [l1, l2],
          timestamp: l2.timestamp,
        });
      }
    }
  }

  // 3. Liquidity Sweeps on Recent Candles (Wick exceeds level, body closes within)
  const recentCandles = candles.slice(-15);
  for (let i = 0; i < recentCandles.length; i++) {
    const c = recentCandles[i];

    // Bullish Sweep: Price sweeps below a swing low / EQL, but closes back above
    for (const low of swingLows.slice(-5)) {
      if (c.low < low.price && c.close > low.price && c.timestamp > low.timestamp) {
        sweeps.push({
          type: 'BULLISH_SWEEP', // Swept Sell-side liquidity, potential reversal up
          candleTimestamp: c.timestamp,
          sweptLevel: low.price,
          lowReached: c.low,
          closePrice: c.close,
          wickDistance: Number((low.price - c.low).toFixed(2)),
        });
      }
    }

    // Bearish Sweep: Price sweeps above a swing high / EQH, but closes back below
    for (const high of swingHighs.slice(-5)) {
      if (c.high > high.price && c.close < high.price && c.timestamp > high.timestamp) {
        sweeps.push({
          type: 'BEARISH_SWEEP', // Swept Buy-side liquidity, potential reversal down
          candleTimestamp: c.timestamp,
          sweptLevel: high.price,
          highReached: c.high,
          closePrice: c.close,
          wickDistance: Number((c.high - high.price).toFixed(2)),
        });
      }
    }
  }

  return {
    eqh: eqh.slice(-3),
    eql: eql.slice(-3),
    sweeps: sweeps.slice(-3),
    latestSweep: sweeps[sweeps.length - 1] || null,
  };
}

module.exports = {
  findLiquidityPools,
};
