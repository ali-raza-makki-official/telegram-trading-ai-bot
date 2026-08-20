const ClaudeProvider = require('./providers/ClaudeProvider');
const GeminiProvider = require('./providers/GeminiProvider');
const DeepSeekProvider = require('./providers/DeepSeekProvider');
const config = require('../config');
const logger = require('../utils/logger');
const { formatAnalysisPrompt } = require('./prompts');
const vectorStore = require('../memory/vectorStore');
const { PredictionRepo } = require('../database');

class LLMManager {
  constructor() {
    this.claude = new ClaudeProvider();
    this.gemini = new GeminiProvider();
    this.deepseek = new DeepSeekProvider();
    this.primaryProvider = config.llm.primaryProvider;
  }

  // Synthesize deterministic technical data into a trade thesis
  async synthesizeTradeThesis({
    symbol = 'XAUUSD',
    currentPrice,
    confluenceData,
    sessionInfo = {},
  }) {
    // 1. Retrieve similar past setups from Vector Memory
    const queryContext = `SMC ${confluenceData.breakdown?.smc?.bias} ICT ${confluenceData.breakdown?.ict?.bias} setup at ${currentPrice}`;
    let pastMemories = [];
    try {
      pastMemories = await vectorStore.findSimilar(queryContext, { limit: 3 });
    } catch (err) {
      logger.warn({ err: err.message }, 'Vector memory retrieval warning');
    }

    // 2. Retrieve past accuracy stats
    let accuracyStats = {};
    try {
      accuracyStats = await PredictionRepo.getStats();
    } catch (err) {
      logger.warn({ err: err.message }, 'Accuracy stats retrieval warning');
    }

    // 3. Format Prompt
    const promptText = formatAnalysisPrompt({
      symbol,
      currentPrice,
      confluenceData,
      pastMemories,
      accuracyStats,
      sessionInfo,
    });

    // 4. Execute via Configured LLM Provider
    if (this.primaryProvider === 'deepseek' && this.deepseek.isAvailable()) {
      try {
        return await this.deepseek.generateThesis(promptText);
      } catch (err) {
        logger.warn('DeepSeek failed, attempting Gemini fallback');
        if (this.gemini.isAvailable()) return await this.gemini.generateThesis(promptText);
      }
    } else if (this.primaryProvider === 'claude' && this.claude.isAvailable()) {
      try {
        return await this.claude.generateThesis(promptText);
      } catch (err) {
        logger.warn('Claude failed, falling back to DeepSeek or Gemini');
        if (this.deepseek.isAvailable()) return await this.deepseek.generateThesis(promptText);
        if (this.gemini.isAvailable()) return await this.gemini.generateThesis(promptText);
      }
    } else if (this.primaryProvider === 'gemini' && this.gemini.isAvailable()) {
      try {
        return await this.gemini.generateThesis(promptText);
      } catch (err) {
        logger.warn('Gemini failed, falling back to DeepSeek or Claude');
        if (this.deepseek.isAvailable()) return await this.deepseek.generateThesis(promptText);
        if (this.claude.isAvailable()) return await this.claude.generateThesis(promptText);
      }
    } else if (this.deepseek.isAvailable()) {
      // Auto fallback to DeepSeek if configured
      try {
        return await this.deepseek.generateThesis(promptText);
      } catch (err) {
        logger.warn({ err: err.message }, 'DeepSeek auto-provider error');
      }
    } else if (this.primaryProvider === 'hybrid' && this.claude.isAvailable() && this.gemini.isAvailable()) {
      // Dual-model consensus
      try {
        const [claudeThesis, geminiThesis] = await Promise.all([
          this.claude.generateThesis(promptText),
          this.gemini.generateThesis(promptText),
        ]);

        // Check if both agree
        if (claudeThesis.bias === geminiThesis.bias) {
          return {
            ...claudeThesis,
            confidence: Math.round((claudeThesis.confidence + geminiThesis.confidence) / 2),
            reasoning: `[Consensus Claude+Gemini]: ${claudeThesis.reasoning}`,
          };
        } else {
          // Disagreement -> Downgrade confidence
          return {
            bias: 'NEUTRAL',
            confidence: 40,
            primary_setup: `Model Disagreement: Claude (${claudeThesis.bias}) vs Gemini (${geminiThesis.bias})`,
            reasoning: `Models disagreed on market direction. Claude suggested ${claudeThesis.bias} while Gemini suggested ${geminiThesis.bias}. Holding neutral.`,
            invalidation_level: null,
            entry_zone: null,
            suggested_sl: null,
            suggested_tp1: null,
            suggested_tp2: null,
            risk_reward_ratio: null,
            timeframe_alignment_summary: 'Conflicted models',
            caution_flags: ['AI Consensus Conflict: Trade skipped'],
          };
        }
      } catch (err) {
        logger.error({ err: err.message }, 'Hybrid consensus error');
      }
    }

    // 5. Deterministic Algorithmic Fallback (When API keys are not supplied)
    logger.info('Using deterministic synthesis fallback (no external LLM key active)');
    return this.buildDeterministicThesis(confluenceData, currentPrice);
  }

  buildDeterministicThesis(confluenceData, currentPrice) {
    const isBullish = confluenceData.bias === 'BULLISH';
    const isBearish = confluenceData.bias === 'BEARISH';

    if (!isBullish && !isBearish) {
      return {
        bias: 'NEUTRAL',
        confidence: confluenceData.confidence,
        primary_setup: 'Market in Equilibrium / Choppy Consolidation',
        reasoning: 'Technical indicators and SMC market structure are currently in equilibrium without clear directional displacement or liquidity sweep.',
        invalidation_level: null,
        entry_zone: null,
        suggested_sl: null,
        suggested_tp1: null,
        suggested_tp2: null,
        risk_reward_ratio: null,
        timeframe_alignment_summary: 'Neutral multi-timeframe stance',
        caution_flags: ['Waiting for high-probability liquidity run'],
      };
    }

    const reasonsStr = confluenceData.keyReasons.join('. ');
    return {
      bias: confluenceData.bias,
      confidence: confluenceData.confidence,
      primary_setup: `${confluenceData.bias} Confluence Setup (${confluenceData.triggerTimeframe})`,
      reasoning: `High-confluence ${confluenceData.bias.toLowerCase()} alignment: ${reasonsStr}. Confluence score: ${confluenceData.score}/100.`,
      invalidation_level: confluenceData.invalidationLevel,
      entry_zone: {
        min: Number((currentPrice - 0.5).toFixed(2)),
        max: Number((currentPrice + 0.5).toFixed(2)),
      },
      suggested_sl: confluenceData.suggestedSl,
      suggested_tp1: confluenceData.suggestedTp1,
      suggested_tp2: confluenceData.suggestedTp2,
      risk_reward_ratio: confluenceData.riskRewardRatio,
      timeframe_alignment_summary: `Trigger (${confluenceData.triggerTimeframe}) aligned with HTF (${confluenceData.htfTimeframe || 'N/A'})`,
      caution_flags: confluenceData.confidence < 75 ? ['Moderate confidence: use strict risk sizing'] : [],
    };
  }
}

module.exports = new LLMManager();
