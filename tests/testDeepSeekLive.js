const DeepSeekProvider = require('../src/llm/providers/DeepSeekProvider');
const { formatAnalysisPrompt } = require('../src/llm/prompts');

async function testDeepSeek() {
  console.log('Testing live DeepSeek API call with provided key...');

  const provider = new DeepSeekProvider();
  provider.apiKey = 'sk-76cd0f46045a43d58b21adc370350fb8';

  const mockConfluence = {
    symbol: 'XAUUSD',
    score: 85,
    confidence: 85,
    bias: 'BULLISH',
    triggerTimeframe: '15m',
    htfTimeframe: '1h',
    keyReasons: [
      'Bullish Market Structure (BOS on 15m)',
      'Price tapping Bullish Order Block at $2680.00 - $2684.50',
      'Active London Killzone with Judas Swing sweep of Asian Low',
      'EMA 9 > EMA 21 > EMA 50 Bullish Alignment',
    ],
    breakdown: {
      smc: { bias: 'BULLISH', details: { structure: { trend: 'BULLISH' } } },
      ict: { bias: 'BULLISH' },
      candlesticks: { primaryPattern: { pattern: 'BULLISH_ENGULFING', bias: 'BULLISH' } },
      correlated: { DXY: { change: -0.25, bias: 'BEARISH' } },
    },
  };

  const promptText = formatAnalysisPrompt({
    symbol: 'XAUUSD',
    currentPrice: 2685.50,
    confluenceData: mockConfluence,
    pastMemories: [],
    accuracyStats: { winRate: 75, total: 20 },
    sessionInfo: { marketSession: 'LONDON_NY_OVERLAP', utcTime: new Date().toISOString() },
  });

  const thesis = await provider.generateThesis(promptText);
  console.log('\n--- LIVE DEEPSEEK RESPONSE ---');
  console.log(JSON.stringify(thesis, null, 2));
  console.log('\nDeepSeek API is 100% active and working perfectly!');
}

testDeepSeek().catch(err => {
  console.error('DeepSeek Live Test Error:', err);
});
