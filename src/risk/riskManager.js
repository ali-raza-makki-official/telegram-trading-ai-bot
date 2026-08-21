const config = require('../config');
const { TradeRepo } = require('../database');
const { getCurrentSessionInfo } = require('../strategies/ict/killzones');
const newsFilter = require('./newsFilter'); // FIX #8: Import newsFilter
const logger = require('../utils/logger');

class RiskManager {
  constructor() {
    this.dailyLossLimit = config.risk.maxDailyLossPercent;
    this.maxConcurrentPositions = config.risk.maxConcurrentPositions;
    this.riskPercent = config.risk.riskPercentPerTrade;
    this.maxLotSize = config.risk.maxLotSize;
    this.minLotSize = config.risk.minLotSize;
    this.mandatoryStopLoss = config.risk.mandatoryStopLoss;
  }

  // Calculate lot size based on account balance and SL distance
  calculateLotSize({ accountBalance, entryPrice, stopLossPrice }) {
    if (!stopLossPrice || entryPrice === stopLossPrice) {
      return this.minLotSize;
    }

    const slDistance = Math.abs(entryPrice - stopLossPrice);
    const riskAmount = (accountBalance * this.riskPercent) / 100;

    // For Gold (XAU/USD): 1 standard lot = 100 oz. 1.0 point move = $100 per 1.0 lot.
    // Dollar risk = lot * slDistance * 100 -> lot = riskAmount / (slDistance * 100)
    let calculatedLot = riskAmount / (slDistance * 100);

    // Apply limits
    calculatedLot = Math.max(this.minLotSize, Math.min(this.maxLotSize, calculatedLot));
    return Number(calculatedLot.toFixed(2));
  }

  // Validate whether a trade can be opened
  async validateTrade({
    symbol,
    type,
    lot,
    entryPrice,
    sl,
    tp,
    accountBalance,
    dailyPnl = 0,
  }) {
    const reasons = [];

    // 1. Mandatory Stop Loss Check
    if (this.mandatoryStopLoss && (!sl || sl <= 0)) {
      reasons.push('Trade rejected: Mandatory Stop Loss is enabled but no SL provided.');
    }

    // 2. Check Logical SL Placement
    if (type === 'BUY' && sl && sl >= entryPrice) {
      reasons.push(`Trade rejected: Buy order SL (${sl}) cannot be above entry (${entryPrice}).`);
    }
    if (type === 'SELL' && sl && sl <= entryPrice) {
      reasons.push(`Trade rejected: Sell order SL (${sl}) cannot be below entry (${entryPrice}).`);
    }

    // 3. Max Lot Size Check
    if (lot > this.maxLotSize) {
      reasons.push(`Trade rejected: Requested lot size (${lot}) exceeds max allowed (${this.maxLotSize}).`);
    }

    // 4. Max Concurrent Positions Check
    const openTrades = await TradeRepo.getOpen();
    if (openTrades.length >= this.maxConcurrentPositions) {
      reasons.push(`Trade rejected: Max open positions reached (${openTrades.length}/${this.maxConcurrentPositions}).`);
    }

    // 5. Daily Max Loss Limit Check
    const maxDailyLossDollars = (accountBalance * this.dailyLossLimit) / 100;
    if (dailyPnl <= -maxDailyLossDollars) {
      reasons.push(`Trade rejected: Daily loss limit hit (-$${Math.abs(dailyPnl).toFixed(2)} / -$${maxDailyLossDollars.toFixed(2)}). Trading paused for today.`);
    }

    // 6. Friday Weekend Close Protection Check
    const session = getCurrentSessionInfo();
    if (session.dayOfWeek === 5 && session.minutesToFridayClose !== null && session.minutesToFridayClose <= config.risk.fridayCloseBufferMinutes) {
      reasons.push(`Trade rejected: Approaching Friday market close (${session.minutesToFridayClose} mins remaining). New entries are frozen.`);
    }

    // 7. FIX #8: High-Impact News Blackout Check
    const newsStatus = newsFilter.isNewsBlackoutActive();
    if (newsStatus.isBlackout) {
      reasons.push(`Trade rejected: High-impact news blackout active — ${newsStatus.event} (${newsStatus.state}). Trading paused for safety.`);
    }

    return {
      isValid: reasons.length === 0,
      reasons,
    };
  }
}

module.exports = new RiskManager();

