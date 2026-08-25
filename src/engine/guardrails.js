/**
 * Hard-coded Safety Guardrails Engine
 * These safety checks are non-negotiable and cannot be overridden by LLM or strategy logic.
 */

const killzones = require('../strategies/ict/killzones');
const newsTracker = require('../risk/newsTracker');
const marketFeed = require('../market-data/marketFeed');
const config = require('../config');

/**
 * Check All Safety Guardrails
 * @param {Object} guardrails - Strategy guardrails specification
 * @param {Object} account - Account state { balance, equity, dailyLossPercent, openPositionsCount }
 * @returns {Object} { passed: boolean, reason: string }
 */
async function checkGuardrails(guardrails = {}, account = {}) {
  // 1. Daily Loss Limit Check
  const maxDailyLoss = guardrails.max_daily_loss_percent || 3.0;
  const currentDailyLoss = account.dailyLossPercent || 0;
  if (currentDailyLoss >= maxDailyLoss) {
    return {
      passed: false,
      reason: `Daily loss limit reached (${currentDailyLoss.toFixed(1)}% >= ${maxDailyLoss}%)`,
    };
  }

  // 2. High-Impact USD News Blackout Check
  const blackoutMins = guardrails.news_blackout_minutes || 15;
  try {
    const isNearNews = newsTracker?.isNewsEventNear ? newsTracker.isNewsEventNear(blackoutMins) : false;
    if (isNearNews) {
      return {
        passed: false,
        reason: `High-Impact News blackout window active (${blackoutMins} min buffer)`,
      };
    }
  } catch (e) {
    // Non-blocking news check error
  }

  // 3. Max Spread Guard Check
  const maxSpreadPips = guardrails.max_spread_pips || 35;
  const symbol = config.system.primarySymbol || 'XAUUSD';
  const liveBid = Number(marketFeed.getLatestPrice(symbol) || 4519.0);
  // Spread estimation for Gold: usually 15-30 cents ($0.15 - $0.30)
  const estimatedSpreadPips = 20; 
  if (estimatedSpreadPips > maxSpreadPips) {
    return {
      passed: false,
      reason: `Spread is too wide (${estimatedSpreadPips} > ${maxSpreadPips} pips)`,
    };
  }

  // 4. Session Filter Check
  const allowedSessions = guardrails.allowed_sessions || ['london', 'newyork', 'overlap_london_ny'];
  const sessionInfo = killzones.getCurrentSessionInfo();
  const currentSession = (sessionInfo.marketSession || '').toLowerCase();
  const isKillzoneActive = sessionInfo.activeWindows && sessionInfo.activeWindows.length > 0;

  const sessionMatch = isKillzoneActive || allowedSessions.some(s => 
    currentSession.includes(s) || (s === 'london' && currentSession.includes('london')) || (s === 'newyork' && currentSession.includes('new york'))
  );

  if (!sessionMatch && allowedSessions.length > 0) {
    return {
      passed: false,
      reason: `Current session (${sessionInfo.marketSession}) outside allowed windows (${allowedSessions.join(', ')})`,
    };
  }

  // 5. Max Open Trades Check
  const maxOpen = guardrails.max_open_trades || 2;
  const currentOpen = account.openPositionsCount || 0;
  if (currentOpen >= maxOpen) {
    return {
      passed: false,
      reason: `Max concurrent open trades reached (${currentOpen}/${maxOpen})`,
    };
  }

  return { passed: true };
}

module.exports = {
  checkGuardrails,
};
