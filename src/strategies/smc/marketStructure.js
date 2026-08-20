/**
 * SMC Market Structure:
 * - Swing Highs / Swing Lows (Fractals)
 * - Break of Structure (BOS) -> Continuation
 * - Change of Character (CHoCH) -> Reversal
 * - Market Trend State (Higher Highs / Higher Lows vs Lower Highs / Lower Lows)
 */

function findSwingPoints(candles, leftBars = 3, rightBars = 3) {
  const swingHighs = [];
  const swingLows = [];

  for (let i = leftBars; i < candles.length - rightBars; i++) {
    const currentHigh = candles[i].high;
    const currentLow = candles[i].low;

    // Check Swing High
    let isSwingHigh = true;
    for (let l = 1; l <= leftBars; l++) {
      if (candles[i - l].high >= currentHigh) {
        isSwingHigh = false;
        break;
      }
    }
    if (isSwingHigh) {
      for (let r = 1; r <= rightBars; r++) {
        if (candles[i + r].high >= currentHigh) {
          isSwingHigh = false;
          break;
        }
      }
    }
    if (isSwingHigh) {
      swingHighs.push({
        index: i,
        timestamp: candles[i].timestamp,
        price: currentHigh,
        candle: candles[i],
      });
    }

    // Check Swing Low
    let isSwingLow = true;
    for (let l = 1; l <= leftBars; l++) {
      if (candles[i - l].low <= currentLow) {
        isSwingLow = false;
        break;
      }
    }
    if (isSwingLow) {
      for (let r = 1; r <= rightBars; r++) {
        if (candles[i + r].low <= currentLow) {
          isSwingLow = false;
          break;
        }
      }
    }
    if (isSwingLow) {
      swingLows.push({
        index: i,
        timestamp: candles[i].timestamp,
        price: currentLow,
        candle: candles[i],
      });
    }
  }

  return { swingHighs, swingLows };
}

function analyzeMarketStructure(candles, leftBars = 3, rightBars = 3) {
  if (!candles || candles.length < leftBars + rightBars + 5) {
    return {
      trend: 'NEUTRAL',
      events: [],
      recentBOS: null,
      recentCHoCH: null,
      swingHighs: [],
      swingLows: [],
      lastSwingHigh: null,
      lastSwingLow: null,
    };
  }

  const { swingHighs, swingLows } = findSwingPoints(candles, leftBars, rightBars);
  const events = [];
  let currentTrend = 'NEUTRAL';

  // Combine swing points chronologically
  const allSwings = [
    ...swingHighs.map(h => ({ ...h, type: 'HIGH' })),
    ...swingLows.map(l => ({ ...l, type: 'LOW' })),
  ].sort((a, b) => a.index - b.index);

  // Classify HH, HL, LH, LL
  for (let i = 1; i < allSwings.length; i++) {
    const curr = allSwings[i];
    const prevSame = allSwings
      .slice(0, i)
      .reverse()
      .find(s => s.type === curr.type);

    if (prevSame) {
      if (curr.type === 'HIGH') {
        curr.classification = curr.price > prevSame.price ? 'HH' : 'LH';
      } else {
        curr.classification = curr.price > prevSame.price ? 'HL' : 'LL';
      }
    }
  }

  // Detect BOS and CHoCH on subsequent candle breaks
  let lastBullishHigh = null;
  let lastBearishLow = null;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];

    // Find latest confirmed swing high & low before this candle
    const priorHighs = swingHighs.filter(h => h.index + rightBars <= i);
    const priorLows = swingLows.filter(l => l.index + rightBars <= i);

    const activeHigh = priorHighs[priorHighs.length - 1];
    const activeLow = priorLows[priorLows.length - 1];

    if (activeHigh && c.close > activeHigh.price && (!lastBullishHigh || activeHigh.index > lastBullishHigh.index)) {
      // Break above recent swing high
      const isReversal = currentTrend === 'BEARISH';
      const eventType = isReversal ? 'CHOCH_BULLISH' : 'BOS_BULLISH';
      events.push({
        type: eventType,
        index: i,
        timestamp: c.timestamp,
        brokenLevel: activeHigh.price,
        brokenSwingIndex: activeHigh.index,
        candleClose: c.close,
      });
      currentTrend = 'BULLISH';
      lastBullishHigh = activeHigh;
    }

    if (activeLow && c.close < activeLow.price && (!lastBearishLow || activeLow.index > lastBearishLow.index)) {
      // Break below recent swing low
      const isReversal = currentTrend === 'BULLISH';
      const eventType = isReversal ? 'CHOCH_BEARISH' : 'BOS_BEARISH';
      events.push({
        type: eventType,
        index: i,
        timestamp: c.timestamp,
        brokenLevel: activeLow.price,
        brokenSwingIndex: activeLow.index,
        candleClose: c.close,
      });
      currentTrend = 'BEARISH';
      lastBearishLow = activeLow;
    }
  }

  const recentEvents = events.slice(-5);
  const recentBOS = events.filter(e => e.type.startsWith('BOS')).pop() || null;
  const recentCHoCH = events.filter(e => e.type.startsWith('CHOCH')).pop() || null;

  return {
    trend: currentTrend,
    events: recentEvents,
    recentBOS,
    recentCHoCH,
    swingHighs: swingHighs.slice(-6),
    swingLows: swingLows.slice(-6),
    lastSwingHigh: swingHighs[swingHighs.length - 1] || null,
    lastSwingLow: swingLows[swingLows.length - 1] || null,
  };
}

module.exports = {
  findSwingPoints,
  analyzeMarketStructure,
};
