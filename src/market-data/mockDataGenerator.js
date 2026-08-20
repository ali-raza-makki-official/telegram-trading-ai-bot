/**
 * Mock Market Data Generator
 * Generates realistic XAU/USD price action with trends, pullbacks, SMC sweeps, and FVGs.
 */

function generateRealisticGoldCandles({
  basePrice = 2650.0,
  count = 100,
  timeframe = '15m',
  trend = 'BULLISH', // 'BULLISH' | 'BEARISH' | 'RANGING'
  volatility = 2.5,
  startTime = Date.now() - 100 * 15 * 60 * 1000,
} = {}) {
  const tfMinutes = { '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60, '4h': 240, '1d': 1440 }[timeframe] || 15;
  const intervalMs = tfMinutes * 60 * 1000;

  const candles = [];
  let currentClose = basePrice;
  let timestamp = startTime;

  for (let i = 0; i < count; i++) {
    const open = currentClose;
    let drift = 0;

    if (trend === 'BULLISH') {
      drift = (Math.random() - 0.38) * volatility;
    } else if (trend === 'BEARISH') {
      drift = (Math.random() - 0.62) * volatility;
    } else {
      drift = (Math.random() - 0.5) * volatility;
    }

    // Occasional displacement candle (creates FVG/OB)
    if (i % 15 === 0) {
      drift *= 3.0;
    }

    const close = Number((open + drift).toFixed(2));
    const highWick = Math.random() * volatility * 0.8;
    const lowWick = Math.random() * volatility * 0.8;

    const high = Number((Math.max(open, close) + highWick).toFixed(2));
    const low = Number((Math.min(open, close) - lowWick).toFixed(2));
    const volume = Math.floor(500 + Math.random() * 2500);

    candles.push({
      symbol: 'XAUUSD',
      timeframe,
      timestamp,
      open,
      high,
      low,
      close,
      volume,
    });

    currentClose = close;
    timestamp += intervalMs;
  }

  return candles;
}

module.exports = {
  generateRealisticGoldCandles,
};
