const orchestrator = require('../src/orchestrator/agentOrchestrator');

async function testWebAnalyze() {
  console.log('Testing runOnDemandAnalysis directly...');
  try {
    const thesis = await orchestrator.runOnDemandAnalysis('XAUUSD', '15m');
    console.log('✅ runOnDemandAnalysis succeeded! Result:');
    console.log({
      bias: thesis.bias,
      confidence: thesis.confidence,
      setup: thesis.primary_setup,
      sl: thesis.suggested_sl,
      tp1: thesis.suggested_tp1,
      reasoning: thesis.reasoning?.substring(0, 100) + '...',
    });
  } catch (err) {
    console.error('❌ runOnDemandAnalysis failed:', err);
  }
}

testWebAnalyze().catch(console.error);
