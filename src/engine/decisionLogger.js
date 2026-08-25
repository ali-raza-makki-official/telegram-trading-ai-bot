/**
 * Decision Audit Trail Logger
 * Records every strategy evaluation, guardrail check, and trade outcome for performance analysis and backtesting.
 */

const { SettingsRepo } = require('../database');
const logger = require('../utils/logger');

class DecisionLogger {
  static async logDecision(entry) {
    const record = {
      id: `dec_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      strategyId: entry.strategyId,
      ruleTreePurpose: entry.ruleTreePurpose,
      reasoning: entry.reasoning,
      guardrailsPassed: entry.guardrailsPassed !== false,
      guardrailReason: entry.guardrailReason || null,
      action: entry.action || 'EVALUATION',
      orderId: entry.orderId || null,
      lotSize: entry.lotSize || null,
      slDistance: entry.slDistance || null,
    };

    logger.info({
      strategyId: record.strategyId,
      purpose: record.ruleTreePurpose,
      action: record.action,
      passed: record.guardrailsPassed,
    }, '📝 Strategy Decision Logged');

    try {
      let logs = await SettingsRepo.get('strategy_decision_audit_logs', []);
      logs.unshift(record);
      if (logs.length > 200) logs = logs.slice(0, 200); // Keep last 200 decisions
      await SettingsRepo.set('strategy_decision_audit_logs', logs);
    } catch (e) {
      logger.error({ err: e.message }, 'Failed persisting decision log');
    }

    return record;
  }

  static async getRecentLogs(limit = 50) {
    const logs = await SettingsRepo.get('strategy_decision_audit_logs', []);
    return logs.slice(0, limit);
  }
}

module.exports = DecisionLogger;
