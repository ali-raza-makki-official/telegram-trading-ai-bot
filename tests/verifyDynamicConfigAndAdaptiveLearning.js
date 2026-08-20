const dynamicConfig = require('../src/config/dynamicConfig');
const AdaptiveLearner = require('../src/orchestrator/adaptiveLearner');
const { scoreConfluence } = require('../src/strategies/confluence/confluenceScorer');

async function testDynamicConfigAndLearning() {
  console.log('=== VERIFYING DYNAMIC CONFIGURATION & ADAPTIVE LEARNING LAYER ===\n');

  // Reset baseline for testing
  dynamicConfig.set('confluence.min_threshold', 70.0, 'human_dashboard', 'Reset baseline');

  // Test 1: Seeded values and initial getters
  console.log('Test 1: Reading seeded dynamic parameters...');
  const minThreshold = dynamicConfig.get('confluence.min_threshold');
  const smcWeight = dynamicConfig.get('weights.smc');
  const maxRisk = dynamicConfig.get('risk.max_percent_per_trade');
  console.log({ minThreshold, smcWeight, maxRisk });

  if (minThreshold === 70.0 && smcWeight === 30.0 && maxRisk === 1.5) {
    console.log('✅ Test 1 PASS: Default strategy_config loaded correctly.');
  } else {
    throw new Error('Test 1 FAILED: Unexpected default parameters');
  }

  // Test 2: AI Tunable Security Enforcement
  console.log('\nTest 2: Testing AI Permission Gate (is_ai_tunable)...');
  try {
    // Attempt to modify a HARD RISK LIMIT using AI actor
    dynamicConfig.set('risk.max_percent_per_trade', 5.0, 'ai_proposed_approved');
    throw new Error('Test 2 FAILED: AI should NOT be able to modify hard risk limits!');
  } catch (err) {
    if (err.message.includes('SECURITY ALERT') || err.message.includes('HARD RISK LIMIT')) {
      console.log('✅ Test 2 PASS: AI modification of hard risk limit strictly blocked by security layer!');
    } else {
      throw err;
    }
  }

  // Test 3: Min/Max Bounds Enforcement
  console.log('\nTest 3: Testing Min/Max Bounds...');
  try {
    dynamicConfig.set('confluence.min_threshold', 95.0, 'human_dashboard'); // Exceeds max_bound 85.0
    throw new Error('Test 3 FAILED: Should have rejected value > max_bound');
  } catch (err) {
    if (err.message.includes('violates maximum safe bound')) {
      console.log('✅ Test 3 PASS: Parameter modification bounded by safe limits.');
    } else {
      throw err;
    }
  }

  // Test 4: AI Adaptive Proposal and Approval Workflow
  console.log('\nTest 4: Testing AI Proposal & Approval Workflow...');
  const proposal = dynamicConfig.proposeTuning({
    paramKey: 'confluence.min_threshold',
    proposedValue: 75.0,
    rationale: 'Asian session false positive reduction test',
  });
  console.log('Created Proposal:', proposal);

  const approved = dynamicConfig.approveProposal(proposal.id);
  const updatedValue = dynamicConfig.get('confluence.min_threshold');
  console.log('Approved Proposal:', { updatedValue, version: dynamicConfig.getConfigItem('confluence.min_threshold').version_number });

  if (updatedValue === 75.0) {
    console.log('✅ Test 4 PASS: Adaptive tuning proposal successfully applied and versioned.');
  } else {
    throw new Error('Test 4 FAILED: Config did not update to proposed value');
  }

  // Test 5: Confluence Scorer uses runtime dynamic values
  console.log('\nTest 5: Confluence Scorer runtime dynamic evaluation...');
  const mockCandles = [
    { open: 4510, high: 4515, low: 4508, close: 4514, volume: 150 },
    { open: 4514, high: 4522, low: 4512, close: 4520, volume: 220 },
  ];
  const result = scoreConfluence({
    symbol: 'XAUUSD',
    candlesByTimeframe: { '15m': mockCandles },
  });
  console.log('Confluence Score result:', { minThreshold: result.minThreshold, score: result.score });

  if (result.minThreshold === 75.0) {
    console.log('✅ Test 5 PASS: Confluence scorer dynamically fetched updated threshold (75.0)!');
  } else {
    throw new Error(`Test 5 FAILED: Expected minThreshold 75.0, got ${result.minThreshold}`);
  }

  // Restore default
  dynamicConfig.set('confluence.min_threshold', 70.0, 'human_dashboard', 'Reset to 70.0 baseline');

  console.log('\n🎉 ALL SECTION 7 DYNAMIC CONFIGURATION & ADAPTIVE LEARNING TESTS PASSED!');
}

testDynamicConfigAndLearning().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
