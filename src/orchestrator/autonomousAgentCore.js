const DeepSeekProvider = require('../llm/providers/DeepSeekProvider');
const GeminiProvider = require('../llm/providers/GeminiProvider');
const ClaudeProvider = require('../llm/providers/ClaudeProvider');
const SmartDualRouter = require('../llm/smartRouter');
const marketFeed = require('../market-data/marketFeed');
const candleManager = require('../market-data/candleManager');
const AgentMemory = require('../memory/agentMemory');
const dynamicConfig = require('../config/dynamicConfig');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Autonomous General Intelligence Trading Agent Core
 * Integrates Dynamic Smart Dual-Mode Routing (FAST_CHAT vs DEEP_THINKING)
 * to minimize API token consumption by 85-95% while keeping deep reasoning for heavy analysis.
 */
class AutonomousAgentCore {
  constructor() {
    this.deepseek = new DeepSeekProvider();
    this.gemini = new GeminiProvider();
    this.claude = new ClaudeProvider();
  }

  /**
   * Main Autonomous Reasoning Cycle with Dynamic Smart Dual-Mode Routing
   */
  async thinkAndDecide({
    userQuery = null,
    chatId = null,
    orchestrator,
    triggerSource = 'USER_OR_CYCLE',
    confluence = null,
    isExplicitAnalysis = false,
  }) {
    const symbol = config.system.primarySymbol || 'XAUUSD';
    const livePrice = Number(marketFeed.getLatestPrice(symbol) || 4519.0);

    // 1. Dynamic Task Complexity Classification
    const taskClassification = SmartDualRouter.classifyTask({
      userQuery,
      triggerSource,
      confluence,
      isExplicitAnalysis,
    });

    const isDeepThinking = taskClassification.mode === 'DEEP_THINKING';
    logger.info(
      { mode: taskClassification.mode, reason: taskClassification.reason },
      'SmartDualRouter assigned execution mode'
    );

    // 2. Build Context (Optimized for Fast vs Deep)
    const situationContext = await AgentMemory.buildFullContext({
      chatId,
      orchestrator,
      primarySymbol: symbol,
    });

    const autonomyMode = orchestrator?.autonomyMode || 'semi';

    // 2b. Retrieve Active Master Strategy Directives (User-Defined Mandate)
    const CustomStrategyStore = require('../strategies/customStrategyStore');
    const strategyData = await CustomStrategyStore.getStrategy();
    const activeInstructions = strategyData.enabled ? strategyData.instructions : 'No custom rules active — follow standard institutional SMC.';

    // 3. Construct Tailored System & User Prompt based on Mode
    let systemPrompt = '';
    let userPromptText = '';

    const historyText = situationContext.conversationHistory && situationContext.conversationHistory.length > 0
      ? situationContext.conversationHistory.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n')
      : 'No previous history recorded yet.';

    if (isDeepThinking) {
      // Deep Institutional Strategic Reasoning with User Strategy Directives
      systemPrompt = `
You are an Autonomous Gold (XAU/USD) Trading AI Agent & Fund Manager for Ali Raza in Telegram.
MODE: DEEP INSTITUTIONAL THINKING & SETUP SYNTHESIS.

### 🎯 USER-DEFINED MASTER STRATEGY DIRECTIVES (TOP PRIORITY MANDATE):
${activeInstructions}

LONG-TERM CONVERSATION HISTORY (From Day 1):
${historyText}

LIVE MARKET & BROKER SNAPSHOT:
- Gold Price: $${livePrice.toFixed(2)} USD (Exness MT5)
- Balance: $${Number(situationContext.broker.balance).toFixed(2)} USD | Equity: $${Number(situationContext.broker.equity).toFixed(2)} USD
- Open Positions: ${JSON.stringify(situationContext.openPositions)}
- Multi-Timeframe Technical Matrix: ${JSON.stringify(situationContext.technicalMatrix)}
- Macro State (DXY, Silver SMT, Yields): ${JSON.stringify(situationContext.macroSnapshot)}
- Autonomy Mode: "${autonomyMode.toUpperCase()}"

MANDATE & STRICT COMPLIANCE RULES:
1. STRICT STRATEGY COMPLIANCE: The Master Strategy Directives defined above are your absolute law. Every trade setup MUST satisfy the rules, session windows, and confirmation checklist in the strategy.
2. If the current market does NOT satisfy all criteria of the user's strategy, you MUST set "action": "HOLD" and clearly explain which specific rule was not met.
3. Perform deep multi-timeframe reasoning, identify Order Blocks, FVGs, Liquidity Sweeps, and SMT Divergences.
4. Formulate a clear trade bias (BUY/SELL/HOLD) with exact Entry, SL, TP, and R:R.
5. If Autonomy Mode is "AUTO", you can set "action_type": "EXECUTE_TRADE".
6. If Autonomy Mode is "SEMI", set "action_type": "REQUEST_APPROVAL".
7. Reply in natural, senior institutional Roman Urdu / Urdu explaining the strategy alignment.
8. ALWAYS generate 2-4 DYNAMIC interactive buttons ("interactive_buttons") tailored specifically to your reply (e.g. ACTION:ZONES, ACTION:ANALYZE_15m, ACTION:STATUS, ACTION:POSITIONS).

Output format strictly JSON:
{
  "thought_process": "Deep institutional reasoning checking each rule of the Master Strategy Directives",
  "reply": "Your clear, actionable analysis and response to Ali Raza in Roman Urdu",
  "action_type": "NONE" | "EXECUTE_TRADE" | "CLOSE_TRADE" | "REQUEST_APPROVAL",
  "strategy_compliance": {
    "status": "PASS" | "FAIL" | "WAITING",
    "rules_checked": ["Rule 1: ...", "Rule 2: ..."],
    "unmet_rules": []
  },
  "trade_decision": {
    "action": "BUY" | "SELL" | "HOLD",
    "lot": number,
    "entry": number,
    "sl": number,
    "tp": number,
    "risk_reward": string,
    "rationale": string
  },
  "interactive_buttons": [
    { "text": "🎯 Contextual Button Label", "action": "ACTION:ZONES" }
  ]
}`;
      userPromptText = userQuery || `Trigger: ${triggerSource}. Synthesize market thesis against Master Strategy Directives.`;
    } else {
      // Lightweight Fast Chat (Low Tokens, Instant Response)
      systemPrompt = `
You are an intelligent Gold Trading AI Assistant chatting with Ali Raza on Telegram.
MODE: FAST CONVERSATION & MEMORY SYNTHESIS.

LONG-TERM CONVERSATION HISTORY (From Day 1):
${historyText}

QUICK SNAPSHOT:
- Gold Price: $${livePrice.toFixed(2)} USD
- Balance: $${Number(situationContext.broker.balance).toFixed(2)} USD | Equity: $${Number(situationContext.broker.equity).toFixed(2)} USD
- Open Positions: ${situationContext.openPositions.length} active
- Session: ${situationContext.marketSession?.sessionName || 'Active'}

MANDATE & INSTRUCTIONS:
- You have PERMANENT MEMORY of all past discussions with Ali Raza. Understand conversational context and follow his orders naturally.
- Give a concise, friendly, and smart response in Roman Urdu / Urdu.
- Always include 2-4 customized dynamic interactive buttons ("interactive_buttons") relevant to what you just recommended.

Output format strictly JSON:
{
  "thought_process": "Quick conversational check with past memory",
  "reply": "Your natural, concise response",
  "action_type": "NONE",
  "trade_decision": { "action": "HOLD" },
  "interactive_buttons": [
    { "text": "📊 15m Analysis", "action": "ACTION:ANALYZE_15m" },
    { "text": "💼 Account Status", "action": "ACTION:STATUS" }
  ]
}`;
      userPromptText = userQuery || 'Hello';
    }

    // 4. Route to Primary Provider based on config.llm.primaryProvider
    const primary = (config.llm.primaryProvider || 'gemini').toLowerCase();

    // Strategy A: Gemini as Primary (100% Free Tier, Multimodal, High Speed)
    if (primary === 'gemini' && this.gemini.isAvailable()) {
      try {
        const geminiRes = await this.gemini.chatCompletion(
          `${systemPrompt}\n\nUser: ${userPromptText}`,
          {
            mode: taskClassification.mode,
            maxTokens: isDeepThinking ? 1500 : 600,
            responseFormat: 'json_object',
          }
        );

        if (geminiRes?.content) {
          const jsonMatch = geminiRes.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              return JSON.parse(jsonMatch[0]);
            } catch {
              // fallback to raw text if JSON malformed
            }
          }
          return {
            thought_process: 'Gemini Multimodal Live Analysis',
            reply: geminiRes.content.replace(/^```json|^```|```$/gm, '').trim(),
            action_type: 'NONE',
            trade_decision: { action: 'HOLD' },
            interactive_buttons: [
              { text: '📊 7-TF Deep Analysis', action: 'ACTION:ANALYZE_15m' },
              { text: '💼 Account Status', action: 'ACTION:STATUS' },
            ],
          };
        }
      } catch (gemErr) {
        logger.warn({ err: gemErr.message }, '[SmartDualRouter] Gemini failed, falling back to DeepSeek...');
      }
    }

    // Strategy B: DeepSeek Provider (Primary or Fallback)
    if (this.deepseek.isAvailable()) {
      try {
        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPromptText },
        ];

        const dsRes = await this.deepseek.chatCompletion(messages, {
          mode: taskClassification.mode,
          maxTokens: isDeepThinking ? 1500 : 450,
          responseFormat: 'json_object',
        });

        if (dsRes?.content) {
          const jsonMatch = dsRes.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              if (dsRes.reasoningContent && !parsed.thought_process) {
                parsed.thought_process = dsRes.reasoningContent;
              }
              return parsed;
            } catch {}
          }
          return {
            thought_process: dsRes.reasoningContent || 'DeepSeek Live Synthesis',
            reply: dsRes.content.replace(/^```json|^```|```$/gm, '').trim(),
            action_type: 'NONE',
            trade_decision: { action: 'HOLD' },
          };
        }
      } catch (dsErr) {
        logger.warn({ err: dsErr.message }, '[SmartDualRouter] DeepSeek execution failed');
      }
    }

    // Real Deterministic Market Analysis Fallback (NEVER send placeholder templates)
    try {
      const ComprehensiveEngine = require('../strategies/smc/comprehensiveAnalysisEngine');
      const analysis = await ComprehensiveEngine.runFullAnalysis(config.system.primarySymbol);
      const report = ComprehensiveEngine.formatTelegramReport(analysis);

      return {
        thought_process: 'Multi-Timeframe SMC/ICT Deterministic Synthesis',
        reply: report,
        action_type: 'NONE',
        trade_decision: { action: 'HOLD' },
        interactive_buttons: [
          { text: '📍 Active Watch Zones', action: 'ACTION:ZONES' },
          { text: '💼 Account Status', action: 'ACTION:STATUS' },
        ],
      };
    } catch (fallbackErr) {
      logger.error({ err: fallbackErr.message }, 'Failed generating real deterministic analysis');
      return {
        thought_process: 'Real-Time Price & Structure Query',
        reply: `Gold (XAUUSD) is currently trading at $${livePrice.toFixed(2)} USD. Analyzing multi-timeframe liquidity and structure...`,
        action_type: 'NONE',
        trade_decision: { action: 'HOLD' },
      };
    }
  }
}

module.exports = new AutonomousAgentCore();
