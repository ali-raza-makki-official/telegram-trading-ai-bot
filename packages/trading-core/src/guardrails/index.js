/**
 * @fileoverview Pure Quantitative Guardrails Module
 * Strategy-agnostic boundary and risk validation checks.
 * Zero external network, DB, or SDK dependencies.
 */

/**
 * Checks whether current market spread is within acceptable limits.
 * @param {number} currentSpreadPips - Current spread in pips (e.g. 20)
 * @param {number} maxSpreadPips - Maximum allowed spread in pips (e.g. 35)
 * @returns {{ passed: boolean, reason: string|null }}
 */
function checkSpreadGuard(currentSpreadPips, maxSpreadPips = 35) {
  if (currentSpreadPips > maxSpreadPips) {
    return {
      passed: false,
      reason: `Spread too wide: ${currentSpreadPips} pips > ${maxSpreadPips} max allowed`,
    };
  }
  return { passed: true, reason: null };
}

/**
 * Validates whether the active market session matches allowed session windows.
 * @param {string} currentSession - Current market session name (e.g. "LONDON_OPEN", "NEW_YORK", "ASIAN")
 * @param {string[]} allowedSessions - List of permitted sessions (e.g. ["london", "newyork"])
 * @returns {{ passed: boolean, reason: string|null }}
 */
function checkSessionFilter(currentSession = '', allowedSessions = []) {
  if (!allowedSessions || allowedSessions.length === 0) {
    return { passed: true, reason: null };
  }

  const normCurrent = currentSession.toLowerCase();
  const isMatch = allowedSessions.some(s => {
    const normAllowed = s.toLowerCase();
    return normCurrent.includes(normAllowed) ||
      (normAllowed === 'london' && normCurrent.includes('london')) ||
      (normAllowed === 'newyork' && (normCurrent.includes('new york') || normCurrent.includes('ny')));
  });

  if (!isMatch) {
    return {
      passed: false,
      reason: `Outside allowed trading sessions: ${currentSession} not in [${allowedSessions.join(', ')}]`,
    };
  }
  return { passed: true, reason: null };
}

/**
 * Validates maximum concurrent open trades.
 * @param {number} currentOpenTrades - Number of currently open trades
 * @param {number} maxOpenTrades - Maximum allowed concurrent trades
 * @returns {{ passed: boolean, reason: string|null }}
 */
function checkTradeCountGuard(currentOpenTrades = 0, maxOpenTrades = 2) {
  if (currentOpenTrades >= maxOpenTrades) {
    return {
      passed: false,
      reason: `Maximum concurrent open trades reached (${currentOpenTrades}/${maxOpenTrades})`,
    };
  }
  return { passed: true, reason: null };
}

/**
 * Validates that the proposed stop loss is mathematically sensible.
 * @param {Object} params
 * @param {number} params.entryPrice - Trade entry price
 * @param {number} params.stopLoss - Trade stop loss price
 * @param {string} params.direction - 'BUY' or 'SELL'
 * @param {number} [params.maxDistancePoints=50.0] - Maximum allowed SL distance in price points
 * @returns {{ passed: boolean, reason: string|null }}
 */
function checkStopLossSanity({ entryPrice, stopLoss, direction, maxDistancePoints = 50.0 }) {
  if (!stopLoss || stopLoss <= 0) {
    return { passed: false, reason: 'Mandatory Stop Loss is missing or invalid' };
  }

  const dir = direction.toUpperCase();
  if (dir === 'BUY' && stopLoss >= entryPrice) {
    return { passed: false, reason: `Buy Stop Loss (${stopLoss}) must be strictly below Entry (${entryPrice})` };
  }
  if (dir === 'SELL' && stopLoss <= entryPrice) {
    return { passed: false, reason: `Sell Stop Loss (${stopLoss}) must be strictly above Entry (${entryPrice})` };
  }

  const distance = Math.abs(entryPrice - stopLoss);
  if (distance > maxDistancePoints) {
    return {
      passed: false,
      reason: `Stop Loss distance (${distance.toFixed(1)} points) exceeds max threshold (${maxDistancePoints} points)`,
    };
  }

  return { passed: true, reason: null };
}

/**
 * Evaluates all guardrails in a single composite call.
 * @param {Object} params
 * @param {Object} params.marketState - { currentSpreadPips, currentSession }
 * @param {Object} params.accountState - { currentDailyLossPercent, openTradesCount }
 * @param {Object} params.tradeParams - { entryPrice, stopLoss, direction }
 * @param {Object} params.limits - { maxSpreadPips, maxDailyLossPercent, allowedSessions, maxOpenTrades, maxSLDistance }
 * @returns {{ passed: boolean, failures: string[] }}
 */
function evaluateAllGuardrails({ marketState = {}, accountState = {}, tradeParams = {}, limits = {} }) {
  const failures = [];

  const spreadCheck = checkSpreadGuard(marketState.currentSpreadPips, limits.maxSpreadPips);
  if (!spreadCheck.passed) failures.push(spreadCheck.reason);

  const sessionCheck = checkSessionFilter(marketState.currentSession, limits.allowedSessions);
  if (!sessionCheck.passed) failures.push(sessionCheck.reason);

  const countCheck = checkTradeCountGuard(accountState.openTradesCount, limits.maxOpenTrades);
  if (!countCheck.passed) failures.push(countCheck.reason);

  if (tradeParams.entryPrice && tradeParams.stopLoss && tradeParams.direction) {
    const slCheck = checkStopLossSanity({
      entryPrice: tradeParams.entryPrice,
      stopLoss: tradeParams.stopLoss,
      direction: tradeParams.direction,
      maxDistancePoints: limits.maxSLDistance,
    });
    if (!slCheck.passed) failures.push(slCheck.reason);
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

module.exports = {
  checkSpreadGuard,
  checkSessionFilter,
  checkTradeCountGuard,
  checkStopLossSanity,
  evaluateAllGuardrails,
};
