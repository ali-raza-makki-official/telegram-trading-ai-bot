const config = require('../config');

/**
 * Dynamic % Risk Position Sizing Engine
 * Automatically calculates exact lot size based on Account Balance, Risk %, and SL distance.
 */
class PositionSizer {
  /**
   * Calculate exact lot size
   * @param {number} balance - Account equity/balance (e.g. 463.91)
   * @param {number} riskPercent - Risk percentage (e.g. 1.5)
   * @param {number} entryPrice - Planned entry price
   * @param {number} stopLoss - Planned stop loss price
   * @returns {object} { lotSize, riskAmountUsd, slPips, slDistance }
   */
  static calculateLotSize({
    balance = 463.91,
    riskPercent = config.risk.riskPercentPerTrade || 1.5,
    entryPrice = 4518.0,
    stopLoss = 4508.0,
    maxLot = config.risk.maxLotSize || 1.0,
    minLot = config.risk.minLotSize || 0.01,
  }) {
    const slDistance = Math.abs(entryPrice - stopLoss) || 5.0;
    const slPips = Number((slDistance * 10).toFixed(1)); // 1 pip = $0.10 on XAUUSD
    const riskAmountUsd = Number(((balance * riskPercent) / 100).toFixed(2));

    // On Gold (1 standard lot = 100 oz):
    // 0.01 lot loses $1.00 per $1.00 price move ($0.10 per pip)
    // 0.10 lot loses $10.00 per $1.00 price move ($1.00 per pip)
    // 1.00 lot loses $100.00 per $1.00 price move ($10.00 per pip)
    const rawLot = riskAmountUsd / (slDistance * 100);
    const roundedLot = Number((Math.floor(rawLot * 100) / 100).toFixed(2));

    const finalLot = Math.max(minLot, Math.min(maxLot, roundedLot));

    return {
      lotSize: finalLot,
      riskPercent,
      riskAmountUsd,
      slDistance: Number(slDistance.toFixed(2)),
      slPips,
      balance,
    };
  }
}

module.exports = PositionSizer;
