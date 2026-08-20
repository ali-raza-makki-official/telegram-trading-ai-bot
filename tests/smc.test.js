const { analyzeMarketStructure, findSwingPoints } = require('../src/strategies/smc/marketStructure');
const { findOrderBlocks } = require('../src/strategies/smc/orderBlocks');
const { findFairValueGaps } = require('../src/strategies/smc/fairValueGaps');
const { findLiquidityPools } = require('../src/strategies/smc/liquidity');
const { calculatePremiumDiscountZones } = require('../src/strategies/smc/premiumDiscount');
const { analyzeSMC } = require('../src/strategies/smc');

describe('SMC (Smart Money Concepts) Strategy Suite', () => {
  // Synthetic trend candles (>= 15 candles)
  const bullCandles = [];
  for (let i = 0; i < 20; i++) {
    bullCandles.push({
      timestamp: 1000 + i * 60000,
      open: 2600 + i * 2,
      high: 2605 + i * 2,
      low: 2598 + i * 2,
      close: 2604 + i * 2,
      volume: 100 + i * 10,
    });
  }

  test('analyzeMarketStructure identifies bullish trend and swing points', () => {
    const struct = analyzeMarketStructure(bullCandles, 1, 1);
    expect(struct).toHaveProperty('trend');
    expect(struct.swingHighs.length).toBeGreaterThan(0);
  });

  test('findFairValueGaps detects bullish FVG', () => {
    const fvgCandles = [
      { timestamp: 1000, open: 2600, high: 2605, low: 2598, close: 2604 },
      { timestamp: 2000, open: 2604, high: 2625, low: 2603, close: 2624 },
      { timestamp: 3000, open: 2624, high: 2630, low: 2612, close: 2628 },
    ];

    const result = findFairValueGaps(fvgCandles);
    expect(result.bullishFVGs.length).toBe(1);
    expect(result.bullishFVGs[0].bottom).toBe(2605);
    expect(result.bullishFVGs[0].top).toBe(2612);
  });

  test('calculatePremiumDiscountZones classifies discount and premium', () => {
    const res = calculatePremiumDiscountZones(2620, 2700, 2600, true);
    expect(res.zone).toBe('DISCOUNT');
    expect(res.equilibrium).toBe(2650);
    expect(res.oteZone).toHaveProperty('sweetSpot');
  });

  test('analyzeSMC generates full SMC assessment', () => {
    const smc = analyzeSMC(bullCandles);
    expect(smc).toHaveProperty('bias');
    expect(smc).toHaveProperty('score');
    expect(smc).toHaveProperty('confluenceReasons');
  });
});
