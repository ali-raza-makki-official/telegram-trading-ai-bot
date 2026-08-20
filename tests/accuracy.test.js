const { initDatabase, PredictionRepo } = require('../src/database');
const accuracyTracker = require('../src/evaluator/accuracyTracker');
const candleManager = require('../src/market-data/candleManager');

describe('Accuracy Evaluation & Prediction Reconciliation', () => {
  beforeAll(() => {
    initDatabase();
  });

  test('reconciles bullish prediction hitting TP1', async () => {
    const predId = `TEST-PRED-${Date.now()}`;
    const baseTime = Date.now() - 50000;

    // Save test prediction
    await PredictionRepo.save({
      id: predId,
      symbol: 'XAUUSD',
      timeframe: '15m',
      timestamp: baseTime,
      bias: 'BULLISH',
      confidence: 85,
      priceAtPrediction: 2650,
      suggestedSl: 2640,
      suggestedTp1: 2660,
      suggestedTp2: 2675,
      primarySetup: 'Test Bullish OB',
      reasoning: 'Test reconciliation',
      status: 'PENDING',
    });

    // Provide subsequent candle that exceeds TP1
    candleManager.setCandles('XAUUSD', '15m', [
      { timestamp: baseTime + 10000, open: 2650, high: 2662, low: 2648, close: 2661 },
    ]);

    await accuracyTracker.reconcilePendingPredictions();

    const stats = await PredictionRepo.getStats();
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.winCount).toBeGreaterThan(0);
  });
});
