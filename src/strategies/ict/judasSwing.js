const { getCurrentSessionInfo } = require('./killzones');

/**
 * ICT Judas Swing Detector
 * An engineered false move during London Open or NY Open that sweeps Asian range highs/lows
 * before reversing into the true directional bias.
 */
function detectJudasSwing(candles, sessionInfo) {
  if (!candles || candles.length < 20) return null;

  const currentSession = sessionInfo || getCurrentSessionInfo();
  const isLondonOrNYOpen =
    currentSession.activeKillzone &&
    (currentSession.activeKillzone.key === 'LONDON_OPEN' || currentSession.activeKillzone.key === 'NY_OPEN');

  if (!isLondonOrNYOpen) return null;

  // Isolate Asian range (approx last 6-8 hours if checking 15m or 1h candles)
  const asianCandles = candles.slice(-24, -4);
  if (asianCandles.length === 0) return null;

  const asianHigh = Math.max(...asianCandles.map(c => c.high));
  const asianLow = Math.min(...asianCandles.map(c => c.low));

  const recentCandles = candles.slice(-4);
  const currentCandle = recentCandles[recentCandles.length - 1];

  // Bearish Judas Swing: Price spikes above Asian High, then quickly closes back below
  for (const c of recentCandles) {
    if (c.high > asianHigh && currentCandle.close < asianHigh) {
      return {
        type: 'BEARISH_JUDAS_SWING',
        killzone: currentSession.activeKillzone.name,
        sweptLevel: asianHigh,
        highReached: c.high,
        currentPrice: currentCandle.close,
        bias: 'BEARISH',
        confidence: 80,
        description: `Judas Swing: Swept Asian High at ${asianHigh.toFixed(2)} during ${currentSession.activeKillzone.name}, looking for short distribution.`,
      };
    }
  }

  // Bullish Judas Swing: Price dips below Asian Low, then quickly closes back above
  for (const c of recentCandles) {
    if (c.low < asianLow && currentCandle.close > asianLow) {
      return {
        type: 'BULLISH_JUDAS_SWING',
        killzone: currentSession.activeKillzone.name,
        sweptLevel: asianLow,
        lowReached: c.low,
        currentPrice: currentCandle.close,
        bias: 'BULLISH',
        confidence: 80,
        description: `Judas Swing: Swept Asian Low at ${asianLow.toFixed(2)} during ${currentSession.activeKillzone.name}, looking for long distribution.`,
      };
    }
  }

  return null;
}

module.exports = {
  detectJudasSwing,
};
