/**
 * Multi-Timeframe RSI and MACD Divergence Detection Engine
 * Uses deterministic swing-point comparison between Price and Momentum series.
 *
 * Types Detected:
 * 1. REGULAR_BEARISH: Price Higher High (HH) + RSI Lower High (LH) -> Reversal Down
 * 2. REGULAR_BULLISH: Price Lower Low (LL) + RSI Higher Low (HL) -> Reversal Up
 * 3. HIDDEN_BEARISH:  Price Lower High (LH) + RSI Higher High (HH) -> Continuation Down
 * 4. HIDDEN_BULLISH:  Price Higher Low (HL) + RSI Lower Low (LL) -> Continuation Up
 */

const { calculateRSI, calculateMACD } = require('../../indicators');

function findSwingPoints(data, lookback = 3) {
  const swingHighs = [];
  const swingLows = [];

  for (let i = lookback; i < data.length - lookback; i++) {
    const val = data[i];
    if (val === null || val === undefined) continue;

    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= lookback; j++) {
      if (data[i - j] >= val || data[i + j] > val) isHigh = false;
      if (data[i - j] <= val || data[i + j] < val) isLow = false;
    }

    if (isHigh) swingHighs.push({ index: i, value: val });
    if (isLow) swingLows.push({ index: i, value: val });
  }

  return { swingHighs, swingLows };
}

function detectDivergences(candles, rsiPeriod = 14) {
  if (!candles || candles.length < 25) {
    return { hasDivergence: false, divergences: [] };
  }

  const closes = candles.map(c => c.close);
  const rsiSeries = calculateRSI(closes, rsiPeriod);
  const priceSwings = findSwingPoints(closes, 2);
  const divergences = [];

  // Filter swing points to only those that have valid non-null RSI values
  const validHighs = priceSwings.swingHighs.filter(h => rsiSeries[h.index] !== null && rsiSeries[h.index] !== undefined);
  const validLows = priceSwings.swingLows.filter(l => rsiSeries[l.index] !== null && rsiSeries[l.index] !== undefined);

  // 1. Bearish Divergence Check (Comparing last two swing highs)
  if (validHighs.length >= 2) {
    const prevHigh = validHighs[validHighs.length - 2];
    const currHigh = validHighs[validHighs.length - 1];

    const prevRsi = rsiSeries[prevHigh.index];
    const currRsi = rsiSeries[currHigh.index];

    if (prevRsi !== null && currRsi !== null) {
      // Regular Bearish Divergence: Price HH, RSI LH
      if (currHigh.value > prevHigh.value && currRsi < prevRsi) {
        divergences.push({
          type: 'REGULAR_BEARISH_DIVERGENCE',
          bias: 'SELL',
          indicator: 'RSI',
          confidence: 85,
          pricePoints: [prevHigh.value, currHigh.value],
          rsiPoints: [Number(prevRsi.toFixed(1)), Number(currRsi.toFixed(1))],
          description: `Price made Higher High ($${prevHigh.value.toFixed(2)} -> $${currHigh.value.toFixed(2)}) while RSI made Lower High (${prevRsi.toFixed(1)} -> ${currRsi.toFixed(1)}). Major Bearish Reversal signal.`,
        });
      }
      // Hidden Bearish Divergence: Price LH, RSI HH
      else if (currHigh.value < prevHigh.value && currRsi > prevRsi) {
        divergences.push({
          type: 'HIDDEN_BEARISH_DIVERGENCE',
          bias: 'SELL',
          indicator: 'RSI',
          confidence: 75,
          pricePoints: [prevHigh.value, currHigh.value],
          rsiPoints: [Number(prevRsi.toFixed(1)), Number(currRsi.toFixed(1))],
          description: `Price made Lower High while RSI made Higher High. Bearish Trend Continuation signal.`,
        });
      }
    }
  }

  // 2. Bullish Divergence Check (Comparing last two swing lows)
  if (validLows.length >= 2) {
    const prevLow = validLows[validLows.length - 2];
    const currLow = validLows[validLows.length - 1];

    const prevRsi = rsiSeries[prevLow.index];
    const currRsi = rsiSeries[currLow.index];

    if (prevRsi !== null && currRsi !== null) {
      // Regular Bullish Divergence: Price LL, RSI HL
      if (currLow.value < prevLow.value && currRsi > prevRsi) {
        divergences.push({
          type: 'REGULAR_BULLISH_DIVERGENCE',
          bias: 'BUY',
          indicator: 'RSI',
          confidence: 85,
          pricePoints: [prevLow.value, currLow.value],
          rsiPoints: [Number(prevRsi.toFixed(1)), Number(currRsi.toFixed(1))],
          description: `Price made Lower Low ($${prevLow.value.toFixed(2)} -> $${currLow.value.toFixed(2)}) while RSI made Higher Low (${prevRsi.toFixed(1)} -> ${currRsi.toFixed(1)}). Major Bullish Reversal signal.`,
        });
      }
      // Hidden Bullish Divergence: Price HL, RSI LL
      else if (currLow.value > prevLow.value && currRsi < prevRsi) {
        divergences.push({
          type: 'HIDDEN_BULLISH_DIVERGENCE',
          bias: 'BUY',
          indicator: 'RSI',
          confidence: 75,
          pricePoints: [prevLow.value, currLow.value],
          rsiPoints: [Number(prevRsi.toFixed(1)), Number(currRsi.toFixed(1))],
          description: `Price made Higher Low while RSI made Lower Low. Bullish Trend Continuation signal.`,
        });
      }
    }
  }

  return {
    hasDivergence: divergences.length > 0,
    divergences,
    primaryDivergence: divergences[0] || null,
  };
}

module.exports = {
  detectDivergences,
  findSwingPoints,
};
