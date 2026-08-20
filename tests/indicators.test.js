const {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateATR,
  calculateMACD,
  calculateBollingerBands,
  calculateFibonacciLevels,
  computeAllIndicators,
} = require('../src/indicators');

describe('Technical Indicators Suite', () => {
  const samplePrices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
  const sampleCandles = samplePrices.map((p, i) => ({
    symbol: 'XAUUSD',
    timestamp: 1000 + i * 60000,
    open: p - 0.5,
    high: p + 1.0,
    low: p - 1.0,
    close: p,
    volume: 100,
  }));

  test('calculateSMA computes correct moving average', () => {
    const sma = calculateSMA(samplePrices, 5);
    expect(sma[4]).toBe(12);
    expect(sma[5]).toBe(13);
  });

  test('calculateEMA calculates exponential moving average', () => {
    const ema = calculateEMA(samplePrices, 5);
    expect(ema[4]).toBe(12);
    expect(ema[5]).toBeGreaterThan(12);
  });

  test('calculateRSI returns values within 0-100', () => {
    const rsi = calculateRSI(samplePrices, 14);
    const validRsi = rsi.filter(v => v !== null);
    expect(validRsi.length).toBeGreaterThan(0);
    expect(validRsi[validRsi.length - 1]).toBeGreaterThan(70);
  });

  test('calculateATR computes non-negative true range', () => {
    const atr = calculateATR(sampleCandles, 5);
    const validAtr = atr.filter(v => v !== null);
    expect(validAtr.length).toBeGreaterThan(0);
    expect(validAtr[0]).toBeGreaterThan(0);
  });

  test('calculateMACD returns macd, signal, and histogram', () => {
    const macd = calculateMACD(samplePrices, 5, 10, 3);
    expect(macd).toHaveProperty('macd');
    expect(macd).toHaveProperty('signal');
    expect(macd).toHaveProperty('histogram');
  });

  test('calculateBollingerBands returns upper, middle, and lower bands', () => {
    const bb = calculateBollingerBands(samplePrices, 5, 2);
    expect(bb.upper[4]).toBeGreaterThan(bb.middle[4]);
    expect(bb.lower[4]).toBeLessThan(bb.middle[4]);
  });

  test('calculateFibonacciLevels computes correct retracements', () => {
    const fibs = calculateFibonacciLevels(2700, 2600, true);
    expect(fibs[0.5]).toBe(2650);
    expect(fibs[0.618]).toBeCloseTo(2638.2, 1);
    expect(fibs[0.705]).toBeCloseTo(2629.5, 1);
  });

  test('computeAllIndicators aggregates indicator summary', () => {
    const result = computeAllIndicators(sampleCandles);
    expect(result).toHaveProperty('emaBias');
    expect(result).toHaveProperty('rsi');
    expect(result).toHaveProperty('atr');
    expect(result).toHaveProperty('macd');
  });
});
