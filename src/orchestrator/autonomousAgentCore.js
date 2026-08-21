const DeepSeekProvider = require('../llm/providers/DeepSeekProvider');
const GeminiProvider = require('../llm/providers/GeminiProvider');
const ClaudeProvider = require('../llm/providers/ClaudeProvider');
const marketFeed = require('../market-data/marketFeed');
const candleManager = require('../market-data/candleManager');
const AgentMemory = require('../memory/agentMemory');
const dynamicConfig = require('../config/dynamicConfig');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Autonomous General Intelligence Trading Agent Core
 * Freely analyzes the market, decides its own actions, synthesizes custom thinking,
 * dynamically designs interactive UI buttons, and autonomously executes or requests approval.
 */
class AutonomousAgentCore {
  constructor() {
    this.deepseek = new DeepSeekProvider();
    this.gemini = new GeminiProvider();
    this.claude = new ClaudeProvider();
  }

  /**
   * Main Autonomous Reasoning Cycle:
   * Called on candle closes, market triggers, user chat messages, or timer events.
   */
  async thinkAndDecide({
    userQuery = null,
    chatId = null,
    orchestrator,
    triggerSource = 'USER_OR_CYCLE',
  }) {
    const symbol = config.system.primarySymbol || 'XAUUSD';
    const livePrice = Number(marketFeed.getLatestPrice(symbol) || 4519.0);

    // Build comprehensive real-time situational memory
    const situationContext = await AgentMemory.buildFullContext({
      chatId,
      orchestrator,
      primarySymbol: symbol,
    });

    const autonomyMode = orchestrator?.autonomyMode || 'semi'; // 'auto' | 'semi' | 'manual'

    const autonomousSystemPrompt = `
You are an Autonomous, Sovereign General Intelligence (AGI) Gold Trading AI Agent & Fund Manager.
You are chatting with and trading for your partner Ali Raza via Telegram.

CORE MANDATE & AUTONOMY:
1. You have total creative, analytical, and executive freedom to think, research, analyze, and decide your own actions.
2. You are NOT bound to rigid hardcoded templates, scripted rules, or robotic checklist constraints.
3. You dynamically observe:
   - Live Price: $${livePrice.toFixed(2)} USD (Exness MT5)
   - Account Balance: $${Number(situationContext.broker.balance).toFixed(2)} USD | Equity: $${Number(situationContext.broker.equity).toFixed(2)} USD
   - Open Positions: ${JSON.stringify(situationContext.openPositions)}
   - Multi-timeframe structure & indicators across 1W, 1D, 4h, 1h, 15m, 5m: ${JSON.stringify(situationContext.technicalMatrix)}
   - Macro state (DXY, Silver SMT, Sessions): ${JSON.stringify(situationContext.macroSnapshot)}
   - Recent Chat Context: ${JSON.stringify(situationContext.recentChat)}
   - Current System Autonomy Mode: "${autonomyMode.toUpperCase()}"

4. YOUR AUTONOMY LEVEL EXECUTION RULES:
   - If Autonomy Mode is "AUTO": You have full sovereign power. If you spot a strong opportunity, you can decide to execute immediately without asking for permission!
   - If Autonomy Mode is "SEMI": You formulate your exact trade setup (Direction, Lot, SL, TP, Target, Logic) and present it with actionable interactive approval buttons so Ali Raza can confirm with 1 tap.
   - If Autonomy Mode is "MANUAL": You provide advisory, reasoning, and technical charts without executing trades.

5. CONVERSATION & THINKING STYLE:
   - Think deeply, intelligently, and organically.
   - Speak naturally in Roman Urdu / Urdu (or English if queried in English) with a sharp, senior institutional partner demeanor.
   - Design your own interactive Telegram buttons dynamically to make conversation and actions effortless for Ali Raza.
   - Never use canned, robotic pre-templates. Speak dynamically based on exact live market conditions.

Return your decision strictly in JSON matching this schema:
{
  "thought_process": "Your internal unfiltered strategic reasoning and situational synthesis",
  "reply": "Your natural, direct, intelligent response to Ali Raza in Telegram",
  "action_type": "NONE" | "EXECUTE_TRADE" | "CLOSE_TRADE" | "REQUEST_APPROVAL" | "MODIFY_POSITION",
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
    { "text": "Button Label", "action": "ACTION_STRING" }
  ]
}
`;

    const userPrompt = userQuery
      ? `User Message / Query: "${userQuery}"`
      : `Trigger: ${triggerSource}. Review current live market and open positions, formulate your next move, and decide whether to trade, manage risk, or wait.`;

    const dsPayload = {
      model: config.llm.deepseek.model || 'deepseek-chat', // FIX #12: Use config value (now 'deepseek-chat')
      messages: [
        { role: 'system', content: autonomousSystemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      stream: false,
    };

    if (config.llm.deepseek.thinkingMode) {
      dsPayload.thinking = { type: 'enabled' };
      dsPayload.reasoning_effort = config.llm.deepseek.reasoningEffort || 'high';
    } else {
      dsPayload.temperature = 0.3;
    }

    try {
      const url = `${config.llm.deepseek.baseUrl.replace(/\/+$/, '')}/chat/completions`;
      let response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.llm.deepseek.apiKey}`,
        },
        body: JSON.stringify(dsPayload),
      });

      if (!response.ok && (response.status === 400 || response.status === 404)) {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.llm.deepseek.apiKey}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: autonomousSystemPrompt },
              { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
          }),
        });
      }

      if (!response.ok) {
        throw new Error(`DeepSeek API returned HTTP ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      return parsed;
    } catch (err) {
      logger.error({ err: err.message }, 'Autonomous Agent reasoning cycle error, trying Gemini fallback');
      if (this.gemini.isAvailable()) {
        const geminiRes = await this.gemini.generateThesis(userPrompt);
        return {
          thought_process: 'Gemini Autonomous Fallback',
          reply: geminiRes.reasoning || 'Market analyzed.',
          action_type: geminiRes.bias !== 'NEUTRAL' ? 'REQUEST_APPROVAL' : 'NONE',
          trade_decision: {
            action: geminiRes.bias,
            lot: 0.01,
            entry: livePrice,
            sl: geminiRes.suggested_sl,
            tp: geminiRes.suggested_tp1,
            risk_reward: geminiRes.risk_reward_ratio || '1:2',
            rationale: geminiRes.reasoning,
          },
          interactive_buttons: [
            { text: '📊 15m Analysis', action: 'ACTION:ANALYZE_15m' },
            { text: '💼 Account Status', action: 'ACTION:STATUS' },
          ],
        };
      }
      throw err;
    }
  }
}

module.exports = new AutonomousAgentCore();
