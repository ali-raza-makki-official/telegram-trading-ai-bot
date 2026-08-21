const metaApiClient = require('../execution/MetaApiClient');
const paperTrading = require('../execution/PaperTradingEngine');
const marketFeed = require('../market-data/marketFeed');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Real-Time Auto Trailing Stop Loss & Break-Even Engine
 * Automatically moves Stop Loss to Break-Even at 1:1 R:R (+15 pips)
 * and manages partial profit booking.
 *
 * FIX #3a: Break-even only marked as applied AFTER successful SL modification.
 * FIX #3b: No hardcoded fallback price — skip cycle if live price is unavailable.
 */
class TradeMonitor {
  constructor() {
    this.pollInterval = null;
    this.isRunning = false;
    this.orchestrator = null;
    this.breakEvenApplied = new Set();
  }

  start(orchestrator) {
    this.orchestrator = orchestrator;
    if (this.isRunning) return;
    this.isRunning = true;

    // Monitor open positions every 5 seconds
    this.pollInterval = setInterval(async () => {
      await this.checkOpenPositions();
    }, 5000);

    logger.info('Auto Trailing Stop Loss & Break-Even Engine started');
  }

  async checkOpenPositions() {
    if (!this.orchestrator) return;
    try {
      const positions = await this.orchestrator.getOpenPositions();
      if (!positions || positions.length === 0) return;

      // FIX #3b: Skip cycle if live price is unavailable — never use hardcoded fallback
      const rawPrice = marketFeed.getLatestPrice(config.system.primarySymbol);
      if (!rawPrice) {
        logger.warn('TradeMonitor: live price unavailable, skipping break-even cycle to avoid stale data');
        return;
      }
      const livePrice = Number(rawPrice);

      for (const pos of positions) {
        const ticket = pos.ticket || pos.id;
        const entry = Number(pos.openPrice || pos.price || pos.entryPrice);
        const sl = pos.stopLoss ? Number(pos.stopLoss) : (pos.sl ? Number(pos.sl) : null);
        const tp = pos.takeProfit ? Number(pos.takeProfit) : (pos.tp ? Number(pos.tp) : null);
        const type = (pos.type || '').toUpperCase();

        if (!entry || !type) continue;

        // 1. AUTO BREAK-EVEN CHECK (+15 pips / $1.50 profit)
        if (type === 'BUY' || type.includes('BUY')) {
          const profitDistance = livePrice - entry;
          if (profitDistance >= 1.50 && (!sl || sl < entry)) {
            if (!this.breakEvenApplied.has(ticket)) {
              const newSl = Number((entry + 0.10).toFixed(2)); // Entry + small spread buffer

              logger.info({ ticket, entry, livePrice, newSl }, 'Triggering Auto Break-Even for BUY position');

              // FIX #3a: Only mark as applied AFTER confirmed success
              const success = await this.modifyStopLoss(ticket, newSl, tp);
              if (success) {
                this.breakEvenApplied.add(ticket);
                if (this.orchestrator.telegram) {
                  this.orchestrator.telegram.broadcastAlert(
                    `🛡️ *Auto Break-Even Triggered (Risk-Free Trade!)*\n\n• Position: \`#${ticket}\` (BUY)\n• Entry: \`$${entry.toFixed(2)}\`\n• Live Price: \`$${livePrice.toFixed(2)}\` (+${(profitDistance * 10).toFixed(0)} pips)\n• Stop Loss Moved to: \`$${newSl.toFixed(2)}\` (Break-Even)\n\n_Trade is now 100% risk-free!_`
                  );
                }
              } else {
                logger.warn({ ticket }, 'Break-even modify failed — will retry next cycle');
              }
            }
          }
        } else if (type === 'SELL' || type.includes('SELL')) {
          const profitDistance = entry - livePrice;
          if (profitDistance >= 1.50 && (!sl || sl > entry)) {
            if (!this.breakEvenApplied.has(ticket)) {
              const newSl = Number((entry - 0.10).toFixed(2));

              logger.info({ ticket, entry, livePrice, newSl }, 'Triggering Auto Break-Even for SELL position');

              // FIX #3a: Only mark as applied AFTER confirmed success
              const success = await this.modifyStopLoss(ticket, newSl, tp);
              if (success) {
                this.breakEvenApplied.add(ticket);
                if (this.orchestrator.telegram) {
                  this.orchestrator.telegram.broadcastAlert(
                    `🛡️ *Auto Break-Even Triggered (Risk-Free Trade!)*\n\n• Position: \`#${ticket}\` (SELL)\n• Entry: \`$${entry.toFixed(2)}\`\n• Live Price: \`$${livePrice.toFixed(2)}\` (+${(profitDistance * 10).toFixed(0)} pips)\n• Stop Loss Moved to: \`$${newSl.toFixed(2)}\` (Break-Even)\n\n_Trade is now 100% risk-free!_`
                  );
                }
              } else {
                logger.warn({ ticket }, 'Break-even modify failed — will retry next cycle');
              }
            }
          }
        }
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Error in TradeMonitor cycle');
    }
  }

  async modifyStopLoss(ticket, newSl, tp) {
    if (this.orchestrator.executionMode === 'paper') {
      // Paper mode: directly update position in memory
      const pos = paperTrading.openPositions.get(ticket);
      if (pos) {
        pos.sl = newSl;
        if (tp) pos.tp = tp;
        return true;
      }
      return false;
    }

    if (this.orchestrator.executionMode === 'metaapi') {
      try {
        if (metaApiClient.rpcConnection) {
          await metaApiClient.rpcConnection.modifyPosition(ticket, newSl, tp || undefined);
          return true;
        }
      } catch (err) {
        logger.warn({ err: err.message, ticket }, 'Failed modifying MT5 position SL');
      }
    }
    return false;
  }

  // Remove a ticket from breakEvenApplied when position closes (prevents stale entries)
  onPositionClosed(ticket) {
    this.breakEvenApplied.delete(ticket);
  }

  stop() {
    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

module.exports = new TradeMonitor();

