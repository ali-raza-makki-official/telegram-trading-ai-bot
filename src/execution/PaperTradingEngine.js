const crypto = require('crypto');
const config = require('../config');
const { TradeRepo } = require('../database');
const logger = require('../utils/logger');

class PaperTradingEngine {
  constructor() {
    this.balance = config.risk.accountStartingBalance;
    this.equity = config.risk.accountStartingBalance;
    this.spreadPips = 0.25; // 25 cents spread for Gold
    this.openPositions = new Map(); // id -> trade
    this.dailyPnl = 0;
  }

  async init() {
    // Load open trades from DB
    const existing = await TradeRepo.getOpen();
    for (const t of existing) {
      this.openPositions.set(t.id, t);
    }
    logger.info({ openTradesCount: this.openPositions.size, balance: this.balance }, 'Paper Trading Engine initialized');
  }

  getAccountSummary() {
    let floatingPnl = 0;
    for (const pos of this.openPositions.values()) {
      floatingPnl += pos.floatingPnl || 0;
    }
    this.equity = Number((this.balance + floatingPnl).toFixed(2));
    return {
      balance: this.balance,
      equity: this.equity,
      floatingPnl: Number(floatingPnl.toFixed(2)),
      dailyPnl: Number(this.dailyPnl.toFixed(2)),
      openPositionsCount: this.openPositions.size,
    };
  }

  async openOrder({ symbol = 'XAUUSD', type, lot, sl = null, tp = null, predictionId = null, currentPrice }) {
    const id = crypto.randomUUID();
    const ticket = `PAPER-${Date.now().toString().slice(-6)}`;

    // Apply half spread to entry
    const entryPrice = type === 'BUY'
      ? Number((currentPrice + this.spreadPips / 2).toFixed(2))
      : Number((currentPrice - this.spreadPips / 2).toFixed(2));

    const trade = {
      id,
      ticket,
      symbol,
      type,
      lot,
      entryPrice,
      sl,
      tp,
      predictionId,
      status: 'OPEN',
      openTime: Date.now(),
      floatingPnl: 0,
    };

    await TradeRepo.save(trade);
    this.openPositions.set(id, trade);

    logger.info({ ticket, type, lot, entryPrice, sl, tp }, 'Opened Paper Trade');
    return trade;
  }

  async closeOrder(id, currentPrice, reason = 'MANUAL') {
    const pos = this.openPositions.get(id);
    if (!pos) return null;

    const isBuy = pos.type === 'BUY';
    const closePrice = isBuy
      ? Number((currentPrice - this.spreadPips / 2).toFixed(2))
      : Number((currentPrice + this.spreadPips / 2).toFixed(2));

    // PnL in Dollars for Gold: lot * (diff) * 100
    const pointDiff = isBuy ? closePrice - pos.entryPrice : pos.entryPrice - closePrice;
    const pnl = Number((pos.lot * pointDiff * 100).toFixed(2));

    this.balance = Number((this.balance + pnl).toFixed(2));
    this.dailyPnl = Number((this.dailyPnl + pnl).toFixed(2));

    await TradeRepo.close(id, {
      closePrice,
      pnl,
      closeTime: Date.now(),
    });

    this.openPositions.delete(id);
    this.getAccountSummary();

    logger.info({ ticket: pos.ticket, pnl, reason, balance: this.balance }, 'Closed Paper Trade');
    return { ...pos, closePrice, pnl, reason };
  }

  // Check SL/TP on price tick
  async onTick(symbol, currentPrice) {
    for (const [id, pos] of this.openPositions.entries()) {
      if (pos.symbol !== symbol) continue;

      const isBuy = pos.type === 'BUY';
      const pointDiff = isBuy ? currentPrice - pos.entryPrice : pos.entryPrice - currentPrice;
      pos.floatingPnl = Number((pos.lot * pointDiff * 100).toFixed(2));

      // Check Stop Loss
      if (pos.sl) {
        if (isBuy && currentPrice <= pos.sl) {
          await this.closeOrder(id, pos.sl, 'SL_HIT');
          continue;
        } else if (!isBuy && currentPrice >= pos.sl) {
          await this.closeOrder(id, pos.sl, 'SL_HIT');
          continue;
        }
      }

      // Check Take Profit
      if (pos.tp) {
        if (isBuy && currentPrice >= pos.tp) {
          await this.closeOrder(id, pos.tp, 'TP_HIT');
          continue;
        } else if (!isBuy && currentPrice <= pos.tp) {
          await this.closeOrder(id, pos.tp, 'TP_HIT');
          continue;
        }
      }
    }
  }

  async closeAll(currentPrice) {
    const closed = [];
    for (const id of Array.from(this.openPositions.keys())) {
      const res = await this.closeOrder(id, currentPrice, 'CLOSE_ALL');
      if (res) closed.push(res);
    }
    return closed;
  }
}

module.exports = new PaperTradingEngine();
