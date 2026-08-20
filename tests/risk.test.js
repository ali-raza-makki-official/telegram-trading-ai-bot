const riskManager = require('../src/risk/riskManager');
const { initDatabase } = require('../src/database');

describe('Risk Management Layer', () => {
  beforeAll(() => {
    initDatabase();
  });

  test('calculateLotSize scales lot size according to risk and SL distance', () => {
    const lot = riskManager.calculateLotSize({
      accountBalance: 10000,
      entryPrice: 2650,
      stopLossPrice: 2645, // 5 points SL
    });

    // Risk 1% of 10,000 = $100. 5 points move on 1 lot = $500. Lot = 100 / 500 = 0.20
    expect(lot).toBe(0.2);
  });

  test('validateTrade blocks order with missing stop loss if mandatory SL is enabled', async () => {
    const validation = await riskManager.validateTrade({
      symbol: 'XAUUSD',
      type: 'BUY',
      lot: 0.1,
      entryPrice: 2650,
      sl: null,
      accountBalance: 10000,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.reasons[0]).toContain('Mandatory Stop Loss');
  });

  test('validateTrade blocks order if lot size exceeds maximum', async () => {
    const validation = await riskManager.validateTrade({
      symbol: 'XAUUSD',
      type: 'BUY',
      lot: 5.0, // Max lot is 1.0
      entryPrice: 2650,
      sl: 2640,
      accountBalance: 10000,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.reasons[0]).toContain('exceeds max allowed');
  });
});
