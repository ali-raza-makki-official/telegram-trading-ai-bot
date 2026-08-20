const autonomousCore = require('../src/orchestrator/autonomousAgentCore');

async function testAutonomousThinking() {
  console.log('=== VERIFYING SOVEREIGN AUTONOMOUS AGENT CORE ===\n');

  const orchestrator = require('../src/orchestrator/agentOrchestrator');
  console.log('Sending dynamic query: "Bhai abhi market ka kia scene hai, kia buy banta hai ya sell?"...');
  const decision = await autonomousCore.thinkAndDecide({
    userQuery: 'Bhai abhi market ka kia scene hai, kia buy banta hai ya sell?',
    chatId: 6813687432,
    orchestrator,
    triggerSource: 'TEST_VERIFICATION',
  });

  console.log('\n--- SOVEREIGN AI SYNTHESIZED DECISION ---');
  console.log('Thought Process:', decision.thought_process);
  console.log('Reply:', decision.reply);
  console.log('Action Type:', decision.action_type);
  console.log('Trade Decision:', decision.trade_decision);
  console.log('Interactive Buttons:', decision.interactive_buttons);

  if (decision.reply && decision.action_type) {
    console.log('\n✅ Sovereign Autonomous AI Thinking & Dynamic Action Generation verified!');
  } else {
    throw new Error('Autonomous decision structure invalid');
  }
}

testAutonomousThinking().catch(err => {
  console.error('❌ Autonomous core test error:', err);
  process.exit(1);
});
