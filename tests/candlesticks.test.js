const {
  scanCandlestickPatterns,
  checkHammer,
  checkInvertedHammer,
  checkMarubozu,
  checkEngulfing,
  checkPiercingAndDarkCloud,
  checkMorningEveningStar,
  checkThreeSoldiersCrows,
} = require('../src/strategies/candlesticks');

describe('Japanese Candlestick Pattern Engine', () => {
  test('checkHammer identifies bullish hammer', () => {
    const candle = { open: 2648, close: 2650, high: 2650.5, low: 2635 }; // 2 body, 13 lower wick
    const res = checkHammer(candle, true);
    expect(res).not.toBeNull();
    expect(res.pattern).toBe('HAMMER');
    expect(res.bias).toBe('BULLISH');
  });

  test('checkInvertedHammer / Shooting Star identifies shooting star', () => {
    const candle = { open: 2640, close: 2638, high: 2655, low: 2637.5 }; // 2 body, 15 upper wick
    const res = checkInvertedHammer(candle, false);
    expect(res).not.toBeNull();
    expect(res.pattern).toBe('SHOOTING_STAR');
    expect(res.bias).toBe('BEARISH');
  });

  test('checkMarubozu identifies bullish marubozu', () => {
    const candle = { open: 2630, close: 2650, high: 2650.2, low: 2629.8 };
    const res = checkMarubozu(candle);
    expect(res).not.toBeNull();
    expect(res.pattern).toBe('BULLISH_MARUBOZU');
    expect(res.bias).toBe('BULLISH');
  });

  test('checkEngulfing identifies bullish engulfing', () => {
    const c1 = { open: 2645, close: 2640, high: 2646, low: 2639 };
    const c2 = { open: 2639, close: 2650, high: 2651, low: 2638 };
    const res = checkEngulfing(c1, c2);
    expect(res).not.toBeNull();
    expect(res.pattern).toBe('BULLISH_ENGULFING');
    expect(res.bias).toBe('BULLISH');
  });

  test('checkMorningEveningStar identifies Morning Star', () => {
    const c1 = { open: 2650, close: 2635, high: 2652, low: 2634 };
    const c2 = { open: 2630, close: 2631, high: 2633, low: 2629 };
    const c3 = { open: 2632, close: 2648, high: 2649, low: 2631 };
    const res = checkMorningEveningStar(c1, c2, c3);
    expect(res).not.toBeNull();
    expect(res.pattern).toBe('MORNING_STAR');
    expect(res.bias).toBe('BULLISH');
  });

  test('checkThreeSoldiersCrows identifies Three White Soldiers', () => {
    const c1 = { open: 2620, close: 2630, high: 2631, low: 2619 };
    const c2 = { open: 2630, close: 2640, high: 2641, low: 2629 };
    const c3 = { open: 2640, close: 2650, high: 2651, low: 2639 };
    const res = checkThreeSoldiersCrows(c1, c2, c3);
    expect(res).not.toBeNull();
    expect(res.pattern).toBe('THREE_WHITE_SOLDIERS');
    expect(res.bias).toBe('BULLISH');
  });

  test('scanCandlestickPatterns aggregates detected patterns', () => {
    const series = [
      { timestamp: 1000, open: 2650, close: 2635, high: 2652, low: 2634 },
      { timestamp: 2000, open: 2630, close: 2631, high: 2633, low: 2629 },
      { timestamp: 3000, open: 2632, close: 2648, high: 2649, low: 2631 },
    ];
    const res = scanCandlestickPatterns(series);
    expect(res.patterns.length).toBeGreaterThan(0);
    expect(res.bias).toBe('BULLISH');
  });
});
