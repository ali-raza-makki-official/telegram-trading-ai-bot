const SmartDualRouter = require('../src/llm/smartRouter');
const autonomousCore = require('../src/orchestrator/autonomousAgentCore');
const orchestrator = require('../src/orchestrator/agentOrchestrator');

async function testSmartDualRouting() {
  console.log('=== VERIFYING DYNAMIC SMART DUAL-MODE ROUTING (DEEPSEEK & GEMINI) ===\n');

  // Test 1: Task Classification Logic
  console.log('Test 1: Testing Smart Task Classifier...');
  const lightQuery1 = SmartDualRouter.classifyTask({ userQuery: 'Assalam o Alaikum bhai kaise ho?' });
  const lightQuery2 = SmartDualRouter.classifyTask({ userQuery: 'Account balance kitna hai?' });
  const heavyQuery1 = SmartDualRouter.classifyTask({ userQuery: 'Gold ka 15m trend aur order block analyze karo' });
  const heavyQuery2 = SmartDualRouter.classifyTask({ userQuery: 'kia buy karein ya sell?' });
  const explicitAnalysis = SmartDualRouter.classifyTask({ isExplicitAnalysis: true });

  console.log('Light 1:', lightQuery1);
  console.log('Light 2:', lightQuery2);
  console.log('Heavy 1:', heavyQuery1);
  console.log('Heavy 2:', heavyQuery2);
  console.log('Explicit:', explicitAnalysis);

  if (
    lightQuery1.mode === 'FAST_CHAT' &&
    lightQuery2.mode === 'FAST_CHAT' &&
    heavyQuery1.mode === 'DEEP_THINKING' &&
    heavyQuery2.mode === 'DEEP_THINKING' &&
    explicitAnalysis.mode === 'DEEP_THINKING'
  ) {
    console.log('✅ Test 1 PASS: Smart Dual Router accurately classified light vs heavy tasks!\n');
  } else {
    throw new Error('Test 1 FAILED: Classification mismatch');
  }

  // Test 2: Dynamic Execution of FAST_CHAT (Low Token / Instant)
  console.log('Test 2: Testing FAST_CHAT Execution on "Assalam o Alaikum bhai"...');
  const lightDecision = await autonomousCore.thinkAndDecide({
    userQuery: 'Assalam o Alaikum bhai',
    chatId: 6813687432,
    orchestrator,
    triggerSource: 'USER_CHAT',
  });

  console.log('\n--- FAST_CHAT RESULT ---');
  console.log('Thought:', lightDecision.thought_process);
  console.log('Reply:', lightDecision.reply);
  console.log('Action:', lightDecision.action_type);

  if (lightDecision.reply) {
    console.log('✅ Test 2 PASS: FAST_CHAT returned lightweight conversational response successfully!\n');
  } else {
    throw new Error('Test 2 FAILED: FAST_CHAT failed to return reply');
  }

  // Test 3: Dynamic Execution of DEEP_THINKING (Institutional Analysis)
  console.log('Test 3: Testing DEEP_THINKING Execution on "Gold 15m SMC Order Block Analysis"...');
  const deepDecision = await autonomousCore.thinkAndDecide({
    userQuery: 'Gold 15m SMC Order Block Analysis',
    chatId: 6813687432,
    orchestrator,
    triggerSource: 'ON_DEMAND_ANALYSIS',
    isExplicitAnalysis: true,
  });

  console.log('\n--- DEEP_THINKING RESULT ---');
  console.log('Thought:', deepDecision.thought_process);
  console.log('Reply:', deepDecision.reply);
  console.log('Trade Decision:', deepDecision.trade_decision);
  console.log('Action Type:', deepDecision.action_type);

  if (deepDecision.reply && deepDecision.trade_decision) {
    console.log('✅ Test 3 PASS: DEEP_THINKING returned deep institutional trade thesis & setup!\n');
  } else {
    throw new Error('Test 3 FAILED: DEEP_THINKING failed to return structured decision');
  }

  console.log('🎉 ALL SMART DUAL-MODE ROUTING TESTS (DEEPSEEK & GEMINI) PASSED WITH FLYING COLORS!');
}

testSmartDualRouting().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
