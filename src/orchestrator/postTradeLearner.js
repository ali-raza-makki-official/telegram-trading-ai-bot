const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const dynamicConfig = require('../config/dynamicConfig');

const SKILLS_FILE = path.resolve(process.cwd(), 'data', 'ai_learned_skills.json');

/**
 * Autonomous Post-Trade Retrospective & Meta-Learning Engine
 * Performs post-mortems on WIN, LOSS, and BREAK-EVEN outcomes,
 * auto-calibrates strategy weights, and builds an evolving institutional skills library.
 */
class PostTradeLearner {
  constructor() {
    this.skills = this.loadSkills();
  }

  loadSkills() {
    try {
      if (fs.existsSync(SKILLS_FILE)) {
        const raw = fs.readFileSync(SKILLS_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed loading ai_learned_skills.json, initializing fresh');
    }

    return {
      version: '1.0.0',
      totalTradesEvaluated: 0,
      wins: 0,
      losses: 0,
      breakEvens: 0,
      learnedPatterns: {},
      retrospectiveLogs: [],
    };
  }

  saveSkills() {
    try {
      const dir = path.dirname(SKILLS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(SKILLS_FILE, JSON.stringify(this.skills, null, 2), 'utf8');
    } catch (err) {
      logger.error({ err: err.message }, 'Failed saving ai_learned_skills.json');
    }
  }

  /**
   * Evaluate a closed trade and extract actionable lessons
   */
  async evaluateClosedTrade({ ticket, symbol = 'XAUUSD', type, entryPrice, closePrice, profit, setupDetails = {}, wasBreakEven = false }) {
    this.skills.totalTradesEvaluated++;
    const pnl = Number(profit || (type === 'BUY' ? closePrice - entryPrice : entryPrice - closePrice));
    
    let outcome = 'LOSS';
    if (wasBreakEven || (Math.abs(pnl) <= 0.50 && profit >= 0)) {
      outcome = 'BREAK_EVEN';
      this.skills.breakEvens++;
    } else if (pnl > 0) {
      outcome = 'WIN';
      this.skills.wins++;
    } else {
      this.skills.losses++;
    }

    const patternKey = setupDetails.pattern || setupDetails.type || 'HTF_LIQUIDITY_ZONE';
    if (!this.skills.learnedPatterns[patternKey]) {
      this.skills.learnedPatterns[patternKey] = {
        name: patternKey,
        winCount: 0,
        lossCount: 0,
        breakEvenCount: 0,
        confidenceScore: 50.0,
        lessons: [],
      };
    }

    const pattern = this.skills.learnedPatterns[patternKey];
    let retrospectiveLesson = '';
    let weightAdjustmentProposal = null;

    // 1. WIN Scenario: Increase strategy confidence and reinforce setup
    if (outcome === 'WIN') {
      pattern.winCount++;
      pattern.confidenceScore = Math.min(95.0, pattern.confidenceScore + 3.5);
      retrospectiveLesson = `✅ Validated ${patternKey}: Entry at $${entryPrice} reached target with +$${pnl.toFixed(2)} profit. Strategy confidence boosted to ${pattern.confidenceScore.toFixed(1)}%.`;

      // Auto-tune SMC / ICT weights positively in dynamicConfig
      if (patternKey.includes('SMC') || patternKey.includes('ORDER_BLOCK')) {
        const currentWeight = dynamicConfig.get('weights.smc') || 30.0;
        dynamicConfig.set('weights.smc', Math.min(50.0, currentWeight + 1.0), 'ai_learner_win_calibration');
      } else if (patternKey.includes('LIQUIDITY') || patternKey.includes('PDH') || patternKey.includes('PDL')) {
        const currentWeight = dynamicConfig.get('weights.ict') || 25.0;
        dynamicConfig.set('weights.ict', Math.min(45.0, currentWeight + 1.0), 'ai_learner_win_calibration');
      }
    }

    // 2. BREAK-EVEN Scenario: Deep post-mortem on break-even utility
    else if (outcome === 'BREAK_EVEN') {
      pattern.breakEvenCount++;
      // Determine if BE was beneficial (saved loss) or premature
      const isBeneficial = closePrice <= entryPrice; // Price tried to reverse against us
      if (isBeneficial) {
        retrospectiveLesson = `🛡️ Beneficial Break-Even on ${patternKey}: Moving SL to BE eliminated downside risk when price stalled. Trade protected capital successfully.`;
      } else {
        retrospectiveLesson = `ℹ️ Neutral Break-Even on ${patternKey}: Closed at entry + buffer. Maintaining steady risk parameters.`;
      }
    }

    // 3. LOSS Scenario: Analyze invalidation and calibrate risk bounds
    else {
      pattern.lossCount++;
      pattern.confidenceScore = Math.max(25.0, pattern.confidenceScore - 4.0);
      retrospectiveLesson = `⚠️ Invalidation on ${patternKey}: Stop loss hit (-$${Math.abs(pnl).toFixed(2)}). Higher timeframe structure shift or volatility expansion required wider buffer. Confidence adjusted to ${pattern.confidenceScore.toFixed(1)}%.`;

      // Slightly increase minimum confluence threshold to demand cleaner confirmations
      const currentThresh = dynamicConfig.get('confluence.min_threshold') || 50.0;
      if (currentThresh < 65.0) {
        dynamicConfig.set('confluence.min_threshold', currentThresh + 0.5, 'ai_learner_loss_risk_guard');
      }
    }

    pattern.lessons.push({
      timestamp: Date.now(),
      ticket,
      outcome,
      pnl,
      lesson: retrospectiveLesson,
    });

    // Keep last 15 lessons per pattern
    if (pattern.lessons.length > 15) pattern.lessons.shift();

    const logEntry = {
      timestamp: Date.now(),
      ticket,
      symbol,
      type,
      outcome,
      pnl: Number(pnl.toFixed(2)),
      pattern: patternKey,
      lesson: retrospectiveLesson,
    };

    this.skills.retrospectiveLogs.push(logEntry);
    if (this.skills.retrospectiveLogs.length > 50) this.skills.retrospectiveLogs.shift();

    this.saveSkills();

    logger.info({ ticket, outcome, pnl, pattern: patternKey }, '🎯 PostTradeLearner recorded trade retrospective');
    return logEntry;
  }

  getSkillsSummary() {
    return {
      totalEvaluated: this.skills.totalTradesEvaluated,
      wins: this.skills.wins,
      losses: this.skills.losses,
      breakEvens: this.skills.breakEvens,
      winRate: this.skills.totalTradesEvaluated > 0
        ? Number(((this.skills.wins / this.skills.totalTradesEvaluated) * 100).toFixed(1))
        : 0,
      learnedPatterns: this.skills.learnedPatterns,
      recentLogs: this.skills.retrospectiveLogs.slice(-5),
    };
  }
}

module.exports = new PostTradeLearner();
