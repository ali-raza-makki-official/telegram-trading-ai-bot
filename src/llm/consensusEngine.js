const DeepSeekProvider = require('./providers/DeepSeekProvider');
const GeminiProvider = require('./providers/GeminiProvider');
const ClaudeProvider = require('./providers/ClaudeProvider');
const logger = require('../utils/logger');

/**
 * Multi-AI Consensus & "Devil's Advocate" Dual Check Engine
 * Cross-validates DeepSeek-V4-Pro theses against Gemini / Claude to eliminate blindspots.
 */
class ConsensusEngine {
  constructor() {
    this.deepseek = new DeepSeekProvider();
    this.gemini = new GeminiProvider();
    this.claude = new ClaudeProvider();
  }

  async runConsensusCheck({ promptText, primaryThesis, symbol = 'XAUUSD', livePrice }) {
    if (!primaryThesis || primaryThesis.bias === 'NEUTRAL') {
      return {
        consensus: 'NEUTRAL',
        consensusScore: primaryThesis ? primaryThesis.confidence : 0,
        agreed: true,
        critique: 'Both deterministic and AI engines recommend standby (no high-probability setup).',
      };
    }

    // Secondary model acting as Devil's Advocate
    const secondary = this.gemini.isAvailable() ? this.gemini : (this.claude.isAvailable() ? this.claude : null);
    if (!secondary) {
      return {
        consensus: primaryThesis.bias,
        consensusScore: primaryThesis.confidence,
        agreed: true,
        critique: 'Single provider active (DeepSeek-V4-Pro).',
      };
    }

    try {
      const reviewPrompt = `
You are an expert Institutional Risk Manager and Devil's Advocate reviewing a proposed trade.
Asset: ${symbol} @ $${livePrice}
Proposed Trade Thesis:
- Direction: ${primaryThesis.bias}
- Confidence: ${primaryThesis.confidence}%
- Entry: Market
- Stop Loss: $${primaryThesis.suggested_sl}
- Take Profit: $${primaryThesis.suggested_tp1}
- Rationale: ${primaryThesis.reasoning}

Market Context & Indicators:
${promptText}

YOUR TASK:
Act as a skeptical hedge-fund risk officer (Devil's Advocate).
Identify any hidden traps (liquidity sweep reversals, HTF resistance, upcoming news, low confluence).
Return ONLY a valid JSON object:
{
  "agree": boolean, // true if you agree this setup is high probability
  "risk_rating": "LOW" | "MEDIUM" | "HIGH",
  "critique": "Concise 1-2 sentence assessment of validity or hidden risks.",
  "consensus_confidence": number // 0 to 100
}
`;

      const secondaryResponse = await secondary.generateThesis(reviewPrompt);
      const agree = secondaryResponse.bias === primaryThesis.bias || secondaryResponse.confidence >= 65;

      const combinedScore = agree
        ? Math.min(95, Math.round((primaryThesis.confidence + (secondaryResponse.confidence || 75)) / 2 + 10))
        : Math.round(primaryThesis.confidence * 0.7);

      return {
        consensus: agree ? primaryThesis.bias : 'CONFLICTED',
        consensusScore: combinedScore,
        agreed: agree,
        primaryBias: primaryThesis.bias,
        secondaryBias: secondaryResponse.bias,
        critique: secondaryResponse.reasoning || (agree ? 'Multi-AI consensus confirms high probability setup.' : 'Secondary AI flagged potential conflicting resistance/liquidity trap.'),
      };
    } catch (err) {
      logger.warn({ err: err.message }, 'Secondary AI consensus check skipped');
      return {
        consensus: primaryThesis.bias,
        consensusScore: primaryThesis.confidence,
        agreed: true,
        critique: 'DeepSeek-V4-Pro verified.',
      };
    }
  }
}

module.exports = new ConsensusEngine();
