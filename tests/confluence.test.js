const { scoreConfluence } = require('../src/strategies/confluence/confluenceScorer');

describe('Confluence Scorer Suite', () => {
  const mock15mCandles = [];
  for (let i = 0; i < 50; i++) {
    mock15mCandles.push({
      timestamp: 1000 + i * 15 * 60 * 1000,
      open: 2600 + i * 1.0,
      high: 2602 + i * 1.0,
      low: 2599 + i * 1.0,
      close: 2601 + i * 1.0,
      volume: 1000,
    });
  }

  test('scoreConfluence outputs unified bias and risk geometry', () => {
    const result = scoreConfluence({
      symbol: 'XAUUSD',
      candlesByTimeframe: { '15m': mock15mCandles },
      correlatedData: { DXY: { change: -0.25, bias: 'BEARISH' } },
    });

    expect(result).toHaveProperty('bias');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('keyReasons');
    expect(result).toHaveProperty('breakdown');
    expect(result.suggestedSl).toBeDefined();
    expect(result.suggestedTp1).toBeDefined();
  });
});
