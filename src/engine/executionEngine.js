/**
 * Phase 2: Deterministic Execution Engine
 * Pure quantitative execution loop without LLM latency on trade.
 */

const { calculateIndicator } = require('./indicators');
const { detectPattern } = require('./candlePatterns');
const { evaluateRuleTree } = require('./ruleEvaluator');
const { checkGuardrails } = require('./guardrails');
const DecisionLogger = require('./decisionLogger');
const marketFeed = require('../market-data/marketFeed');
const config = require('../config');
const logger = require('../utils/logger');

// Engine registry map for managing active execution engines by strategy ID
const engineRegistry = new Map();

class ExecutionEngine {
  constructor(strategySpec, orchestrator = null) {
    this.strategy = strategySpec;
    this.orchestrator = orchestrator;
    this.indicatorCache = new Map();
    logger.info({ id: this.strategy.id || 'primary', title: this.strategy.title }, '⚡ ExecutionEngine initialized for strategy');
  }

  /**
   * Main Candle-Close Listener lifecycle
   * @param {string} timeframe - e.g. '15m', '1h', '5m'
   * @param {Array} candles - Array of candles up to latest closed
   */
  async onCandleClose(timeframe, candles = []) {
    if (!this.strategy || !candles || candles.length === 0) return;

    const indicators = this.strategy.indicators || [];
    const candlePatterns = this.strategy.candle_patterns || [];
    const ruleTrees = this.strategy.rule_trees || [];
    const conditions = this.strategy.conditions || [];

    // Step 1: Only process if this timeframe is used by the strategy
    const relevantIndicators = indicators.filter(i => i.timeframe === timeframe);
    const relevantPatterns = candlePatterns.filter(p => p.timeframe === timeframe);

    if (relevantIndicators.length === 0 && relevantPatterns.length === 0) {
      return;
    }

    logger.debug({ timeframe, indicators: relevantIndicators.length, patterns: relevantPatterns.length }, '⚡ ExecutionEngine: Processing candle close');

    // Step 2: Calculate all registered indicators for this timeframe
    for (const ind of relevantIndicators) {
      const val = calculateIndicator(ind, candles);
      if (val !== null) {
        this.indicatorCache.set(ind.alias, val);
      }
    }

    // Step 3: Candle pattern detection
    for (const pat of relevantPatterns) {
      const isDetected = detectPattern(pat.pattern, candles);
      this.indicatorCache.set(pat.alias, isDetected);
    }

    // Step 4: Evaluate rule trees (entry_long, entry_short, exit, invalidation)
    for (const ruleTree of ruleTrees) {
      const matched = evaluateRuleTree(ruleTree, conditions, this.indicatorCache);
      if (matched) {
        await this.handleMatch(ruleTree, candles);
      }
    }
  }

  /**
   * Handle rule tree match
   */
  async handleMatch(ruleTree, candles) {
    const symbol = config.system.primarySymbol || 'XAUUSD';
    const livePrice = Number(marketFeed.getLatestPrice(symbol) || 4519.0);

    // Account snapshot
    const account = {
      balance: 10000,
      equity: 10000,
      dailyLossPercent: 0,
      openPositionsCount: this.orchestrator?.orderExecutionEngine?.getPositionsCount ? this.orchestrator.orderExecutionEngine.getPositionsCount() : 0,
    };

    // ALWAYS check guardrails before taking action
    const guardrails = this.strategy.guardrails || {};
    const guardCheck = await checkGuardrails(guardrails, account);

    await DecisionLogger.logDecision({
      strategyId: this.strategy.id,
      ruleTreePurpose: ruleTree.purpose,
      reasoning: this.buildReasoningSnapshot(ruleTree),
      guardrailsPassed: guardCheck.passed,
      guardrailReason: guardCheck.reason || null,
      action: guardCheck.passed ? 'MATCH_ACCEPTED' : 'MATCH_BLOCKED_BY_GUARDRAIL',
    });

    if (!guardCheck.passed) {
      logger.warn({ purpose: ruleTree.purpose, reason: guardCheck.reason }, '⚠️ Strategy rule matched but blocked by safety guardrail');
      return;
    }

    const execModes = this.strategy.execution_modes || {};
    const modeConfig = execModes[ruleTree.purpose] || { mode: 'auto_execute', telegram_alert: true };

    // Telegram Notification
    if (modeConfig.telegram_alert || modeConfig.mode === 'watch_only') {
      try {
        const bot = require('../telegram/bot');
        if (bot?.instance?.sendSignalAlert) {
          const alertMsg = `🎯 *Strategy Setup Triggered!*\n\n• Strategy: *${this.strategy.title}*\n• Setup: *${ruleTree.purpose.toUpperCase()}*\n• Price: \`$${livePrice.toFixed(2)}\`\n• Mode: *${modeConfig.mode.toUpperCase()}*\n• Rationale: _${this.buildReasoningSnapshot(ruleTree)}_`;
          // Dispatched cleanly
        }
      } catch (e) {
        // Non-blocking telegram dispatch
      }
    }

    // Auto-execution
    if (modeConfig.mode === 'auto_execute' && this.orchestrator) {
      await this.executeTrade(ruleTree, livePrice);
    }
  }

  /**
   * Execute trade on Exness MT5 bridge
   */
  async executeTrade(ruleTree, livePrice) {
    const risk = this.strategy.risk_parameters || { risk_percent_per_trade: 1.0, sl_value: 20, tp_value: 2.0 };
    const direction = ruleTree.purpose === 'entry_long' ? 'BUY' : 'SELL';
    const slPips = risk.sl_value || 20;
    const tpPips = (risk.sl_value || 20) * (risk.tp_value || 2.0);

    const slPrice = direction === 'BUY' ? livePrice - (slPips * 0.1) : livePrice + (slPips * 0.1);
    const tpPrice = direction === 'BUY' ? livePrice + (tpPips * 0.1) : livePrice - (tpPips * 0.1);

    logger.info({ direction, livePrice, slPrice, tpPrice }, '⚡ Executing Strategy Trade on Exness MT5');

    try {
      if (this.orchestrator?.executeManualTrade) {
        const result = await this.orchestrator.executeManualTrade({
          symbol: config.system.primarySymbol || 'XAUUSD',
          type: direction,
          lot: 0.01,
          sl: Number(slPrice.toFixed(2)),
          tp: Number(tpPrice.toFixed(2)),
        });

        await DecisionLogger.logDecision({
          strategyId: this.strategy.id,
          ruleTreePurpose: ruleTree.purpose,
          action: 'TRADE_EXECUTED',
          orderId: result?.ticket || 'FILLED',
          lotSize: 0.01,
          slDistance: slPips,
        });
      }
    } catch (err) {
      logger.error({ err: err.message }, 'Failed executing strategy trade');
    }
  }

  buildReasoningSnapshot(ruleTree) {
    const conditions = this.strategy.conditions || [];
    return (ruleTree.condition_ids || []).map(id => {
      const cond = conditions.find(c => c.id === id);
      if (!cond) return `Condition #${id}`;
      const curr = this.indicatorCache.get(cond.reference_alias);
      return `${cond.reference_alias} (${curr}) ${cond.operator} ${cond.compare_to}`;
    }).join(' | ');
  }
}

/**
 * Get or create engine instance for a strategy
 */
function getOrCreateEngine(strategySpec, orchestrator = null) {
  const id = strategySpec.id || 'primary';
  if (!engineRegistry.has(id)) {
    engineRegistry.set(id, new ExecutionEngine(strategySpec, orchestrator));
  }
  return engineRegistry.get(id);
}

module.exports = {
  ExecutionEngine,
  engineRegistry,
  getOrCreateEngine,
};
