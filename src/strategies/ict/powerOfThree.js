/**
 * ICT Power of Three (AMD - Accumulation, Manipulation, Distribution)
 */

function analyzePowerOfThree(candles, sessionInfo) {
  if (!candles || candles.length < 24) {
    return { phase: 'UNKNOWN', bias: 'NEUTRAL', score: 0 };
  }

  // Divide session into 3 segments (Accumulation: first third, Manipulation: middle third, Distribution: final third)
  const segmentSize = Math.floor(candles.length / 3);
  const seg1 = candles.slice(0, segmentSize);
  const seg2 = candles.slice(segmentSize, segmentSize * 2);
  const seg3 = candles.slice(segmentSize * 2);

  const seg1High = Math.max(...seg1.map(c => c.high));
  const seg1Low = Math.min(...seg1.map(c => c.low));
  const seg1Range = seg1High - seg1Low;

  const seg2High = Math.max(...seg2.map(c => c.high));
  const seg2Low = Math.min(...seg2.map(c => c.low));

  const currentPrice = candles[candles.length - 1].close;

  // Check if Seg 1 was tight range (Accumulation)
  const isAccumulation = seg1Range > 0;

  // Check Manipulation in Seg 2 (False breakout of Seg 1)
  let bias = 'NEUTRAL';
  let phase = 'ACCUMULATION';
  let score = 0;

  if (seg2Low < seg1Low && currentPrice > seg1Low) {
    // Manipulation swept the lows, now expanding higher (Classic Bullish AMD)
    bias = 'BULLISH';
    phase = 'DISTRIBUTION_UP';
    score = 75;
  } else if (seg2High > seg1High && currentPrice < seg1High) {
    // Manipulation swept the highs, now expanding lower (Classic Bearish AMD)
    bias = 'BEARISH';
    phase = 'DISTRIBUTION_DOWN';
    score = -75;
  } else if (candles.length > 20) {
    phase = 'MANIPULATION_OR_EXPANSION';
  }

  return {
    phase,
    bias,
    score,
    accumulationRange: { high: seg1High, low: seg1Low, range: Number(seg1Range.toFixed(2)) },
  };
}

module.exports = {
  analyzePowerOfThree,
};
