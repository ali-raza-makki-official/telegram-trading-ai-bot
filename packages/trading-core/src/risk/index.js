/**
 * @fileoverview Pure Risk Management & Position Sizing Math Module
 * Strategy-agnostic mathematical calculations for position sizing, daily loss thresholds, and session buffers.
 * Zero platform or execution dependencies.
 */

/**
 * Calculates exact lot size based on equity % risk and stop loss distance.
 * Default calibration: Gold (XAU/USD) where 1 standard lot (100 oz) = $1.00 move is $100.00.
 *
 * @param {Object} params
 * @param {number} params.balance - Account balance / equity in USD
 * @param {number} [params.riskPercent=1.0] - Percentage of equity to risk (e.g. 1.0 = 1%)
 * @param {number} params.entryPrice - Intended trade entry price
 * @param {number} params.stopLoss - Intended stop loss price
 * @param {number} [params.contractSize=100] - Contract size (100 for Gold, 100000 for standard FX)
 * @param {number} [params.minLot=0.01] - Minimum permitted lot size
 * @param {number} [params.maxLot=1.0] - Maximum permitted lot size
 * @returns {{ lotSize: number, riskAmountUsd: number, slDistance: number, slPips: number, balance: number }}
 */
function calculateLotSize({
  balance = 1000,
  riskPercent = 1.0,
  entryPrice = 4500,
  stopLoss = 4490,
  contractSize = 100,
  minLot = 0.01,
  maxLot = 1.0,
}) {
  const numBalance = Number(balance) || 1000;
  const numRiskPercent = Number(riskPercent) || 1.0;
  const numEntry = Number(entryPrice);
  const numSL = Number(stopLoss);

  const slDistance = Math.abs(numEntry - numSL) || 1.0;
  const slPips = Number((slDistance * 10).toFixed(1));
  const riskAmountUsd = Number(((numBalance * numRiskPercent) / 100).toFixed(2));

  // Lot formula: Risk / (SL Distance * Contract Size)
  const rawLot = riskAmountUsd / (slDistance * contractSize);
  const roundedLot = Number((Math.floor(rawLot * 100) / 100).toFixed(2));
  const finalLot = Math.max(minLot, Math.min(maxLot, roundedLot));

  return {
    lotSize: finalLot,
    riskAmountUsd,
    slDistance: Number(slDistance.toFixed(2)),
    slPips,
    balance: numBalance,
  };
}

/**
 * Validates whether current daily PnL has breached the maximum daily loss limit.
 *
 * @param {Object} params
 * @param {number} params.balance - Account balance
 * @param {number} params.maxLossPercent - Max loss % allowed per day (e.g. 3.0)
 * @param {number} params.currentDailyPnl - Today's closed + floating PnL (negative for loss)
 * @returns {{ isBreached: boolean, maxLossDollars: number, currentLossDollars: number, remainingBufferDollars: number }}
 */
function checkDailyLossLimit({ balance = 1000, maxLossPercent = 3.0, currentDailyPnl = 0 }) {
  const maxLossDollars = Number(((balance * maxLossPercent) / 100).toFixed(2));
  const currentLossDollars = currentDailyPnl < 0 ? Math.abs(currentDailyPnl) : 0;
  const isBreached = currentLossDollars >= maxLossDollars;
  const remainingBufferDollars = Number(Math.max(0, maxLossDollars - currentLossDollars).toFixed(2));

  return {
    isBreached,
    maxLossDollars,
    currentLossDollars,
    remainingBufferDollars,
  };
}

/**
 * Checks whether the current time is within the Friday market close buffer (weekend gap protection).
 *
 * @param {Object} params
 * @param {number} params.dayOfWeek - 0=Sunday, 5=Friday, 6=Saturday
 * @param {number|null} params.minutesToFridayClose - Minutes remaining until Friday close
 * @param {number} [params.bufferMinutes=120] - Buffer window in minutes
 * @returns {{ isBufferActive: boolean, reason: string|null }}
 */
function checkFridayWeekendBuffer({ dayOfWeek, minutesToFridayClose, bufferMinutes = 120 }) {
  if (dayOfWeek === 5 && minutesToFridayClose !== null && minutesToFridayClose <= bufferMinutes) {
    return {
      isBufferActive: true,
      reason: `Friday market close approaching (${minutesToFridayClose}m remaining <= ${bufferMinutes}m buffer)`,
    };
  }
  return {
    isBufferActive: false,
    reason: null,
  };
}

/**
 * Calculates Risk-to-Reward ratio for planned trade.
 *
 * @param {Object} params
 * @param {number} params.entryPrice
 * @param {number} params.stopLoss
 * @param {number} params.takeProfit
 * @param {boolean} [params.isLong=true]
 * @returns {{ rrRatio: number, riskDistance: number, rewardDistance: number, isValid: boolean }}
 */
function calculateRiskRewardRatio({ entryPrice, stopLoss, takeProfit, isLong = true }) {
  const riskDist = Math.abs(entryPrice - stopLoss);
  const rewardDist = Math.abs(takeProfit - entryPrice);

  const isValidDirection = isLong
    ? (stopLoss < entryPrice && takeProfit > entryPrice)
    : (stopLoss > entryPrice && takeProfit < entryPrice);

  const rrRatio = riskDist > 0 ? Number((rewardDist / riskDist).toFixed(2)) : 0;

  return {
    rrRatio,
    riskDistance: Number(riskDist.toFixed(2)),
    rewardDistance: Number(rewardDist.toFixed(2)),
    isValid: isValidDirection && rrRatio > 0,
  };
}

module.exports = {
  calculateLotSize,
  checkDailyLossLimit,
  checkFridayWeekendBuffer,
  calculateRiskRewardRatio,
};
