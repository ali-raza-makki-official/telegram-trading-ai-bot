const dynamicConfig = require('../config/dynamicConfig');
const { PredictionRepo } = require('../database');
const logger = require('../utils/logger');

/**
 * AI Adaptive Learning Engine (Section 7.3 Spec)
 * Analyzes historical prediction accuracy vs outcomes and formulates
 * bounded, human-gated parameter tuning proposals via Telegram.
 */
class AdaptiveLearner {
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
  }

  async runAdaptiveAnalysis() {
    try {
      const stats = await PredictionRepo.getStats();
      if (!stats || (stats.total || 0) < 5) {
        return {
          status: 'INSUFFICIENT_DATA',
          message: 'At least 5 evaluated predictions required before running adaptive learning analysis.',
        };
      }

      const winRate = stats.winRate || 0;
      logger.info({ winRate, total: stats.total }, 'Running Adaptive Learning Optimization Cycle');

      // If win rate is lower than 60%, propose increasing confluence threshold or tuning weights
      const currentThreshold = dynamicConfig.get('confluence.min_threshold', 70.0);
      let proposal = null;

      if (winRate < 55.0 && currentThreshold < 75.0) {
        proposal = dynamicConfig.proposeTuning({
          paramKey: 'confluence.min_threshold',
          proposedValue: Math.min(80.0, currentThreshold + 5.0),
          rationale: `Historical win rate is ${winRate}% across ${stats.total} setups. Raising minimum confluence threshold from ${currentThreshold}% to filter out low-conviction chop.`,
        });
      } else if (winRate >= 75.0 && currentThreshold > 65.0) {
        proposal = dynamicConfig.proposeTuning({
          paramKey: 'confluence.min_threshold',
          proposedValue: Math.max(60.0, currentThreshold - 2.5),
          rationale: `High historical win rate (${winRate}%) indicates strong model precision. Slightly lowering threshold to capture more high-value setups.`,
        });
      }

      if (proposal && this.orchestrator?.telegram) {
        await this.dispatchProposalToTelegram(proposal);
      }

      return { status: 'OPTIMIZED', proposal };
    } catch (err) {
      logger.error({ err: err.message }, 'Adaptive learning cycle failed');
      return { status: 'ERROR', error: err.message };
    }
  }

  async dispatchProposalToTelegram(proposal) {
    if (!this.orchestrator?.telegram?.bot || !this.orchestrator?.telegram?.adminChatId) return;

    const { InlineKeyboard } = require('grammy');
    const kb = new InlineKeyboard()
      .text('✅ Approve Parameter Tuning', `APPROVE_TUNING_${proposal.id}`)
      .text('❌ Reject Proposal', `REJECT_TUNING_${proposal.id}`);

    const msg = `
🧠 *AI Adaptive Parameter Tuning Proposal (Section 7)*

The Adaptive Learning Engine has analyzed recent trade accuracy and formulated a configuration adjustment:

⚙️ *Parameter:* \`${proposal.paramKey}\`
• Current Value: \`${proposal.currentValue}\`
• Proposed Value: \`${proposal.proposedValue}\`
• Bounds: \`[55.0 - 85.0]\`

📝 *Rationale:*
_${proposal.rationale}_

_Tap below to review and apply to strategy config._
`;

    try {
      await this.orchestrator.telegram.bot.api.sendMessage(
        this.orchestrator.telegram.adminChatId,
        msg,
        { parse_mode: 'Markdown', reply_markup: kb }
      );
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed sending adaptive tuning proposal to Telegram');
    }
  }
}

module.exports = AdaptiveLearner;
