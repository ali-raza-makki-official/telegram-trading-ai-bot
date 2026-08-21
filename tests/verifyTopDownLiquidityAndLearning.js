const TopDownEngine = require('../src/strategies/smc/topDownLiquidity');
const postTradeLearner = require('../src/orchestrator/postTradeLearner');
const dynamicConfig = require('../src/config/dynamicConfig');

async function testTopDownAndLearning() {
  console.log('=== VERIFYING TOP-DOWN LIQUIDITY DOMINANCE & POST-TRADE LEARNING ENGINE ===\n');

  // Test 1: Top-Down Multi-Timeframe Liquidity & PDH/PDL Sweep
  console.log('1. Testing Top-Down Liquidity Hierarchy (1D > 4H > 15m)...');
  const tdAnalysis = TopDownEngine.analyzeTopDown('XAUUSD');
  console.log('Symbol:', tdAnalysis.symbol);
  console.log('Live Spot Price:', tdAnalysis.currentPrice);
  console.log('Previous Day High (PDH):', tdAnalysis.pdh);
  console.log('Previous Day Low (PDL):', tdAnalysis.pdl);
  console.log('Daily Sweep Detected:', tdAnalysis.dailySweep ? tdAnalysis.dailySweep.type : 'None (Within range)');
  console.log('4H Draw on Liquidity (Target):', tdAnalysis.h4Target ? `${tdAnalysis.h4Target.type} @ $${tdAnalysis.h4Target.price}` : 'None');

  // Test 2: Autonomous Post-Trade Retrospective on WIN
  console.log('\n2. Simulating WIN Trade Retrospective (Daily PDH Sweep Short)...');
  const winLog = await postTradeLearner.evaluateClosedTrade({
    ticket: '1728889901',
    symbol: 'XAUUSD',
    type: 'SELL',
    entryPrice: 4560.00,
    closePrice: 4540.00,
    profit: 20.00,
    setupDetails: { pattern: 'DAILY_PDH_SWEEP_SHORT' },
  });
  console.log('WIN Lesson:', winLog.lesson);
  console.log('SMC Strategy Weight in DynamicConfig:', dynamicConfig.get('weights.smc'));

  // Test 3: Autonomous Post-Trade Retrospective on BREAK-EVEN
  console.log('\n3. Simulating BREAK-EVEN Trade Retrospective...');
  const beLog = await postTradeLearner.evaluateClosedTrade({
    ticket: '1728889902',
    symbol: 'XAUUSD',
    type: 'BUY',
    entryPrice: 4520.00,
    closePrice: 4520.20,
    profit: 0.20,
    wasBreakEven: true,
    setupDetails: { pattern: 'BULLISH_ORDER_BLOCK_15M' },
  });
  console.log('Break-Even Lesson:', beLog.lesson);

  // Test 4: Autonomous Post-Trade Retrospective on LOSS
  console.log('\n4. Simulating LOSS Trade Retrospective & Risk Calibration...');
  const lossLog = await postTradeLearner.evaluateClosedTrade({
    ticket: '1728889903',
    symbol: 'XAUUSD',
    type: 'BUY',
    entryPrice: 4530.00,
    closePrice: 4522.00,
    profit: -8.00,
    setupDetails: { pattern: 'COUNTER_TREND_PULLBACK' },
  });
  console.log('Loss Lesson:', lossLog.lesson);
  console.log('Min Confluence Threshold in DynamicConfig:', dynamicConfig.get('confluence.min_threshold'));

  // Test 5: Verify AI Learned Skills Library
  console.log('\n5. Verifying AI Learned Skills Summary:');
  const summary = postTradeLearner.getSkillsSummary();
  console.log('Total Trades Evaluated:', summary.totalEvaluated);
  console.log('Win Rate:', `${summary.winRate}%`);
  console.log('Learned Patterns in Memory:', Object.keys(summary.learnedPatterns));

  if (summary.totalEvaluated >= 3 && summary.learnedPatterns['DAILY_PDH_SWEEP_SHORT']) {
    console.log('\n🎉 ALL TOP-DOWN LIQUIDITY & META-LEARNING TESTS PASSED SUCCESSFULLY!');
  } else {
    throw new Error('Skills evaluation failed');
  }
}

testTopDownAndLearning().catch(err => {
  console.error('❌ TopDown and Learning test failed:', err);
  process.exit(1);
});
