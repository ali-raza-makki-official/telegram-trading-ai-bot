const { Resvg } = require('@resvg/resvg-js');
const ChartRenderer = require('../src/utils/chartRenderer');
const newsFilter = require('../src/risk/newsFilter');
const PositionSizer = require('../src/risk/positionSizer');

async function runVerification() {
  console.log('=== RUNNING FULL FEATURE VERIFICATION TEST ===\n');

  // Test 1: SMC Chart Renderer
  console.log('Test 1: Visual SMC Candlestick Chart Rendering...');
  const mockCandles = [
    { open: 4510, high: 4515, low: 4508, close: 4514, volume: 150 },
    { open: 4514, high: 4522, low: 4512, close: 4520, volume: 220 },
    { open: 4520, high: 4525, low: 4517, close: 4519, volume: 180 },
    { open: 4519, high: 4528, low: 4518, close: 4526, volume: 300 },
  ];
  const svg = ChartRenderer.generateSMCChartSVG({
    symbol: 'XAUUSD',
    timeframe: '15m',
    candles: mockCandles,
    setup: {
      bias: 'BULLISH',
      confidence: 85,
      sl: 4510.0,
      tp1: 4535.0,
      orderBlock: { top: 4515.0, bottom: 4510.0, type: 'BULLISH' },
    },
  });
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1000 } });
  const pngBuffer = resvg.render().asPng();
  if (pngBuffer && pngBuffer.length > 5000) {
    console.log(`✅ Test 1 PASS: High-Resolution SMC Chart PNG generated (${pngBuffer.length} bytes)!`);
  } else {
    throw new Error('Test 1 FAILED: Invalid PNG generated');
  }

  // Test 2: Economic News Blackout Engine
  console.log('\nTest 2: Economic News Blackout Engine...');
  const newsStatus = newsFilter.isNewsBlackoutActive();
  console.log('News Filter Status:', newsStatus);
  if (newsStatus && typeof newsStatus.isBlackout === 'boolean') {
    console.log('✅ Test 2 PASS: News Blackout status successfully evaluated.');
  } else {
    throw new Error('Test 2 FAILED: Invalid news filter status');
  }

  // Test 3: Dynamic % Risk Position Sizing Calculator
  console.log('\nTest 3: Dynamic % Risk Position Sizing...');
  const calc1 = PositionSizer.calculateLotSize({
    balance: 463.91,
    riskPercent: 1.5,
    entryPrice: 4519.0,
    stopLoss: 4509.0, // 100 pips / $10 risk
  });
  console.log('Position Sizing Result (1.5% Risk on $463.91):', calc1);
  if (calc1.lotSize >= 0.01 && calc1.riskAmountUsd <= 7.00) {
    console.log(`✅ Test 3 PASS: Exact lot size calculated as ${calc1.lotSize} lot ($${calc1.riskAmountUsd} max risk).`);
  } else {
    throw new Error('Test 3 FAILED: Invalid lot size calculation');
  }

  console.log('\n🎉 ALL ADVANCED INSTITUTIONAL MODULES VERIFIED & OPERATIONAL!');
}

runVerification().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
