const GeminiProvider = require('../src/llm/providers/GeminiProvider');
const DeepSeekProvider = require('../src/llm/providers/DeepSeekProvider');
const autonomousCore = require('../src/orchestrator/autonomousAgentCore');
const orchestrator = require('../src/orchestrator/agentOrchestrator');

async function testGeminiIntegration() {
  console.log('=== VERIFYING GOOGLE GEMINI 2.5 FLASH INTEGRATION (DEEPSEEK CLOSED) ===\n');

  // Test 1: Verify DeepSeek is Closed
  const ds = new DeepSeekProvider();
  console.log('DeepSeek Provider Available:', ds.isAvailable());
  if (!ds.isAvailable()) {
    console.log('✅ PASS: DeepSeek is 100% disabled / closed as requested.\n');
  } else {
    throw new Error('DeepSeek should be disabled');
  }

  // Test 2: Verify Gemini Provider Availability
  const gemini = new GeminiProvider();
  console.log('Gemini Provider Available:', gemini.isAvailable());
  console.log('Gemini Model:', gemini.modelName);

  if (!gemini.isAvailable()) {
    throw new Error('Gemini API key is not active in config');
  }

  // Test 3: Live Gemini Text Completion (Fast Chat)
  console.log('\nTesting Gemini Fast Chat ("Assalam o Alaikum bhai, market ka kia scene hai?")...');
  const chatRes = await gemini.chatCompletion('Assalam o Alaikum bhai, market ka kia scene hai?', {
    mode: 'FAST_CHAT',
    maxTokens: 300,
  });
  console.log('Gemini Response:\n', chatRes.content);

  // Test 4: Live Gemini Sovereign Autonomous Agent Core
  console.log('\nTesting Autonomous Agent Core via Gemini 2.5 Flash...');
  const decision = await autonomousCore.thinkAndDecide({
    userQuery: 'Gold 15m SMC setup analyze karo aur batao buy karna hai ya sell',
    chatId: 6813687432,
    orchestrator,
    triggerSource: 'TEST_GEMINI_INTEGRATION',
    isExplicitAnalysis: true,
  });

  console.log('\n--- AUTONOMOUS GEMINI DECISION ---');
  console.log('Thought Process:', decision.thought_process);
  console.log('Reply:', decision.reply);
  console.log('Action Type:', decision.action_type);
  console.log('Trade Decision:', decision.trade_decision);

  if (decision.reply && decision.action_type) {
    console.log('\n🎉 GOOGLE GEMINI 2.5 FLASH INTEGRATION IS 100% SUCCESSFUL & FUNCTIONAL!');
  } else {
    throw new Error('Gemini decision failed');
  }
}

testGeminiIntegration().catch(err => {
  console.error('❌ Gemini integration error:', err);
  process.exit(1);
});
