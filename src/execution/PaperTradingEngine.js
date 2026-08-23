const crypto = require('crypto');
const config = require('../config');
const { TradeRepo, SettingsRepo } = require('../database');
const logger = require('../utils/logger');

class PaperTradingEngine {
  constructor() {
    this.balance = config.risk.accountStartingBalance;
    this.equity = config.risk.accountStartingBalance;
    this.spreadPips = 0.25; // 25 cents spread for Gold
    // FIX #21: Slippage simulation — random slippage in points for realistic fills
    // Gold typically has 0.5-2.0 points slippage during normal conditions, 5-15 during news
    this.slippagePoints = 0.10; // Average slippage per fill (in price points)
    this.openPositions = new Map(); // id -> trade
    this.dailyPnl = 0;
  }

  // FIX #21: Simulate realistic slippage on order fills
  _applySlippage(price, type, isEntry = true) {
    // Slippage direction: BUY entries get worse (higher), SELL entries get worse (lower)
    // BUY exits get better (lower), SELL exits get better (higher)
    const baseSlippage = this.slippagePoints;
    // Add random component: 0.5x to 2.0x of base slippage
    const randomFactor = 0.5 + Math.random() * 1.5;
    const slippage = Number((baseSlippage * randomFactor).toFixed(2));

    if (type === 'BUY') {
      return isEntry
        ? Number((price + slippage).toFixed(2))  // BUY entry: price goes up (worse)
        : Number((price - slippage).toFixed(2));  // BUY exit: price goes down (better)
    } else {
      return isEntry
        ? Number((price - slippage).toFixed(2))  // SELL entry: price goes down (worse)
        : Number((price + slippage).toFixed(2));  // SELL exit: price goes up (better)
    }
  }

  async init() {
    // FIX #5: Load persisted balance from database so restarts don't reset it
    const savedBalance = await SettingsRepo.get('paper_balance');
    if (savedBalance !== null && !isNaN(Number(savedBalance))) {
      this.balance = Number(savedBalance);
      logger.info({ balance: this.balance }, 'Paper Trading Engine: Restored balance from database');
    } else {
      // First-time: persist starting balance
      await SettingsRepo.set('paper_balance', this.balance);
      logger.info({ balance: this.balance }, 'Paper Trading Engine: Using starting balance from config');
    }

    // FIX #5: Load persisted dailyPnl (reset if it's a new day)
    const savedDailyPnlDate = await SettingsRepo.get('paper_daily_pnl_date');
    const todayStr = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
    if (savedDailyPnlDate === todayStr) {
      const savedDailyPnl = await SettingsRepo.get('paper_daily_pnl');
      if (savedDailyPnl !== null) {
        this.dailyPnl = Number(savedDailyPnl);
      }
    } else {
      // New day — reset dailyPnl and record today's date
      this.dailyPnl = 0;
      await SettingsRepo.set('paper_daily_pnl', 0);
      await SettingsRepo.set('paper_daily_pnl_date', todayStr);
    }

    this.equity = this.balance;

    // Load open trades from DB
    const existing = await TradeRepo.getOpen();
    for (const t of existing) {
      this.openPositions.set(t.id, t);
    }
    logger.info({ openTradesCount: this.openPositions.size, balance: this.balance, dailyPnl: this.dailyPnl }, 'Paper Trading Engine initialized');
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

    // FIX #21: Apply spread + slippage to entry for realistic fill
    const spreadAdjusted = type === 'BUY'
      ? Number((currentPrice + this.spreadPips / 2).toFixed(2))
      : Number((currentPrice - this.spreadPips / 2).toFixed(2));
    const entryPrice = this._applySlippage(spreadAdjusted, type, true);

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
    // FIX #21: Apply spread + slippage to close for realistic fill
    const spreadAdjustedClose = isBuy
      ? Number((currentPrice - this.spreadPips / 2).toFixed(2))
      : Number((currentPrice + this.spreadPips / 2).toFixed(2));
    const closePrice = this._applySlippage(spreadAdjustedClose, pos.type, false);

    // PnL in Dollars for Gold: lot * (diff) * 100
    const pointDiff = isBuy ? closePrice - pos.entryPrice : pos.entryPrice - closePrice;
    const pnl = Number((pos.lot * pointDiff * 100).toFixed(2));

    this.balance = Number((this.balance + pnl).toFixed(2));
    this.dailyPnl = Number((this.dailyPnl + pnl).toFixed(2));

    // FIX #5: Persist updated balance and dailyPnl to database
    await SettingsRepo.set('paper_balance', this.balance);
    await SettingsRepo.set('paper_daily_pnl', this.dailyPnl);

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
