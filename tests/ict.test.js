const { getCurrentSessionInfo } = require('../src/strategies/ict/killzones');
const { detectTurtleSoup } = require('../src/strategies/ict/turtleSoup');
const { analyzeICT } = require('../src/strategies/ict');

describe('ICT (Inner Circle Trader) Strategy Suite', () => {
  test('getCurrentSessionInfo returns session and killzone data', () => {
    const testDate = new Date(Date.UTC(2026, 7, 20, 8, 30, 0)).getTime();
    const info = getCurrentSessionInfo(testDate);
    expect(info.marketSession).toBe('LONDON');
    expect(info.isKillzoneActive).toBe(true);
    expect(info.activeKillzone.name).toContain('London');
  });

  test('detectTurtleSoup detects false breakout reversal', () => {
    const candles = [];
    for (let i = 0; i < 25; i++) {
      candles.push({ timestamp: i * 1000, high: 2650, low: 2630, open: 2640, close: 2642 });
    }
    // Candle 26 spikes above 2650 to 2655 but closes back inside at 2648
    candles.push({ timestamp: 26000, high: 2655, low: 2645, open: 2646, close: 2648 });

    const result = detectTurtleSoup(candles);
    expect(result).not.toBeNull();
    expect(result.type).toBe('TURTLE_SOUP_SHORT');
    expect(result.bias).toBe('BEARISH');
  });

  test('analyzeICT returns overall ICT metrics', () => {
    const candles = [];
    for (let i = 0; i < 30; i++) {
      candles.push({ timestamp: i * 1000, high: 2650 + i, low: 2630 + i, open: 2635 + i, close: 2645 + i });
    }
    const result = analyzeICT(candles);
    expect(result).toHaveProperty('bias');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('sessionInfo');
  });
});
