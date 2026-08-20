const chalk = require('chalk');

async function runTests() {
  console.log(chalk.yellow.bold('\n--- RUNNING AUTONOMOUS TRADING AGENT TEST SUITE ---\n'));
  let totalPassed = 0;
  let totalFailed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(chalk.green(`  ✓ ${name}`));
      totalPassed++;
    } else {
      console.log(chalk.red(`  ✗ FAIL: ${name}`));
      totalFailed++;
    }
  }

  // 1. Indicators Tests
  console.log(chalk.cyan('1. Testing Indicators:'));
  const { calculateSMA, calculateEMA, calculateRSI, calculateATR, calculateFibonacciLevels, computeAllIndicators } = require('../src/indicators');
  const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const candles = prices.map((p, i) => ({ timestamp: 1000 + i * 60000, open: p - 0.5, high: p + 1.0, low: p - 1.0, close: p, volume: 100 }));
  const sma = calculateSMA(prices, 5);
  assert(sma[4] === 12, 'calculateSMA computes correct 5-period SMA');
  const ema = calculateEMA(prices, 5);
  assert(ema[4] === 12 && ema[5] > 12, 'calculateEMA computes correct 5-period EMA');
  const fibs = calculateFibonacciLevels(2700, 2600, true);
  assert(fibs[0.5] === 2650 && fibs[0.705] > 2620, 'calculateFibonacciLevels computes OTE 70.5% sweet spot');
  const allInds = computeAllIndicators(candles);
  assert(allInds.rsi !== undefined && allInds.atr !== undefined, 'computeAllIndicators returns valid indicator set');

  // 2. SMC Tests
  console.log(chalk.cyan('\n2. Testing SMC Strategy Suite:'));
  const { analyzeMarketStructure } = require('../src/strategies/smc/marketStructure');
  const { findFairValueGaps } = require('../src/strategies/smc/fairValueGaps');
  const { calculatePremiumDiscountZones } = require('../src/strategies/smc/premiumDiscount');
  const { analyzeSMC } = require('../src/strategies/smc');
  const bullCandles = [
    { timestamp: 1000, open: 2600, high: 2605, low: 2598, close: 2604 },
    { timestamp: 2000, open: 2604, high: 2625, low: 2603, close: 2624 },
    { timestamp: 3000, open: 2624, high: 2630, low: 2612, close: 2628 },
    { timestamp: 4000, open: 2628, high: 2635, low: 2622, close: 2633 },
    { timestamp: 5000, open: 2633, high: 2645, low: 2630, close: 2642 },
  ];
  const fvg = findFairValueGaps(bullCandles);
  assert(fvg.bullishFVGs.length === 1 && fvg.bullishFVGs[0].bottom === 2605, 'findFairValueGaps detects BISI (Bullish FVG)');
  const pd = calculatePremiumDiscountZones(2620, 2700, 2600, true);
  assert(pd.zone === 'DISCOUNT' && pd.oteZone.sweetSpot === 2629.5, 'calculatePremiumDiscountZones detects discount zone & OTE');
  const smcRes = analyzeSMC(bullCandles);
  assert(smcRes.bias !== undefined && smcRes.score !== undefined, 'analyzeSMC returns score and bias');

  // 3. ICT Tests
  console.log(chalk.cyan('\n3. Testing ICT Strategy Suite:'));
  const { getCurrentSessionInfo } = require('../src/strategies/ict/killzones');
  const { detectTurtleSoup } = require('../src/strategies/ict/turtleSoup');
  const testDate = new Date(Date.UTC(2026, 7, 20, 8, 30, 0)).getTime();
  const session = getCurrentSessionInfo(testDate);
  assert(session.marketSession === 'LONDON' && session.isKillzoneActive === true, 'getCurrentSessionInfo identifies London Killzone');
  const turtleCandles = [];
  for (let i = 0; i < 25; i++) turtleCandles.push({ timestamp: i * 1000, high: 2650, low: 2630, open: 2640, close: 2642 });
  turtleCandles.push({ timestamp: 26000, high: 2655, low: 2645, open: 2646, close: 2648 });
  const turtle = detectTurtleSoup(turtleCandles);
  assert(turtle && turtle.type === 'TURTLE_SOUP_SHORT', 'detectTurtleSoup detects false breakout sweep');

  // 4. Candlestick Patterns
  console.log(chalk.cyan('\n4. Testing Candlestick Pattern Engine:'));
  const { checkHammer, checkEngulfing, checkMorningEveningStar, scanCandlestickPatterns } = require('../src/strategies/candlesticks');
  const hammer = checkHammer({ open: 2648, close: 2650, high: 2650.5, low: 2635 }, true);
  assert(hammer && hammer.pattern === 'HAMMER' && hammer.bias === 'BULLISH', 'checkHammer recognizes Hammer pattern');
  const engulf = checkEngulfing({ open: 2645, close: 2640, high: 2646, low: 2639 }, { open: 2639, close: 2650, high: 2651, low: 2638 });
  assert(engulf && engulf.pattern === 'BULLISH_ENGULFING', 'checkEngulfing recognizes Bullish Engulfing');
  const scan = scanCandlestickPatterns(bullCandles);
  assert(scan && Array.isArray(scan.patterns), 'scanCandlestickPatterns aggregates multi-pattern signals');

  // 5. Confluence Scorer
  console.log(chalk.cyan('\n5. Testing Confluence Scorer:'));
  const { scoreConfluence } = require('../src/strategies/confluence/confluenceScorer');
  const conf = scoreConfluence({ symbol: 'XAUUSD', candlesByTimeframe: { '15m': bullCandles } });
  assert(conf.bias !== undefined && conf.score !== undefined && conf.suggestedSl !== undefined, 'scoreConfluence produces bias, score, and SL/TP levels');

  // 6. Risk Manager
  console.log(chalk.cyan('\n6. Testing Risk Manager:'));
  const { initDatabase } = require('../src/database');
  initDatabase();
  const riskManager = require('../src/risk/riskManager');
  const lot = riskManager.calculateLotSize({ accountBalance: 10000, entryPrice: 2650, stopLossPrice: 2645 });
  assert(lot === 0.2, `calculateLotSize calculates exact 1% equity risk (got ${lot})`);
  const val = await riskManager.validateTrade({ symbol: 'XAUUSD', type: 'BUY', lot: 0.1, entryPrice: 2650, sl: null, accountBalance: 10000 });
  assert(val.isValid === false, 'validateTrade enforces mandatory Stop Loss');

  // 7. MetaApi Client Module Test
  console.log(chalk.cyan('\n7. Testing MetaApi Cloud Client Module:'));
  const metaApiClient = require('../src/execution/MetaApiClient');
  assert(typeof metaApiClient.connect === 'function' && typeof metaApiClient.openOrder === 'function', 'MetaApiClient exports WebSocket RPC methods');

  // 8. DeepSeek LLM Provider Test
  console.log(chalk.cyan('\n8. Testing DeepSeek LLM Provider Module:'));
  const DeepSeekProvider = require('../src/llm/providers/DeepSeekProvider');
  const ds = new DeepSeekProvider();
  assert(typeof ds.generateThesis === 'function' && ds.baseUrl.includes('deepseek'), 'DeepSeekProvider exports OpenAI-compatible reasoning methods');

  console.log(chalk.yellow.bold(`\n=================================================`));
  console.log(chalk.green.bold(`  ALL TESTS COMPLETED: ${totalPassed} Passed, ${totalFailed} Failed`));
  console.log(chalk.yellow.bold(`=================================================\n`));

  if (totalFailed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
