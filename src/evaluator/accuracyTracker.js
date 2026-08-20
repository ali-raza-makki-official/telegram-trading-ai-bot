const { PredictionRepo } = require('../database');
const candleManager = require('../market-data/candleManager');
const vectorStore = require('../memory/vectorStore');
const logger = require('../utils/logger');

class AccuracyTracker {
  async reconcilePendingPredictions() {
    const pending = await PredictionRepo.getPending();
    if (!pending || pending.length === 0) return;

    logger.debug({ count: pending.length }, 'Reconciling pending predictions');

    for (const pred of pending) {
      const candles = candleManager.getCandles(pred.symbol, pred.timeframe);
      // Find subsequent candles after prediction timestamp
      const subCandles = candles.filter(c => c.timestamp > pred.timestamp);
      if (subCandles.length === 0) continue;

      const isBullish = pred.bias === 'BULLISH' || pred.bias === 'BUY';
      const isBearish = pred.bias === 'BEARISH' || pred.bias === 'SELL';
      const entryPrice = pred.price_at_prediction;
      const sl = pred.suggested_sl;
      const tp1 = pred.suggested_tp1;
      const tp2 = pred.suggested_tp2;

      let resolvedStatus = null;
      let outcomePrice = null;
      let outcomePips = 0;

      for (const c of subCandles) {
        if (isBullish) {
          // Check SL hit
          if (sl && c.low <= sl) {
            resolvedStatus = 'HIT_SL';
            outcomePrice = sl;
            outcomePips = Number(((sl - entryPrice) * 10).toFixed(1)); // 1 pip = 0.1 for Gold
            break;
          }
          // Check TP2 hit
          if (tp2 && c.high >= tp2) {
            resolvedStatus = 'HIT_TP2';
            outcomePrice = tp2;
            outcomePips = Number(((tp2 - entryPrice) * 10).toFixed(1));
            break;
          }
          // Check TP1 hit
          if (tp1 && c.high >= tp1) {
            resolvedStatus = 'HIT_TP1';
            outcomePrice = tp1;
            outcomePips = Number(((tp1 - entryPrice) * 10).toFixed(1));
            break;
          }
        } else if (isBearish) {
          // Check SL hit
          if (sl && c.high >= sl) {
            resolvedStatus = 'HIT_SL';
            outcomePrice = sl;
            outcomePips = Number(((entryPrice - sl) * 10).toFixed(1));
            break;
          }
          // Check TP2 hit
          if (tp2 && c.low <= tp2) {
            resolvedStatus = 'HIT_TP2';
            outcomePrice = tp2;
            outcomePips = Number(((entryPrice - tp2) * 10).toFixed(1));
            break;
          }
          // Check TP1 hit
          if (tp1 && c.low <= tp1) {
            resolvedStatus = 'HIT_TP1';
            outcomePrice = tp1;
            outcomePips = Number(((entryPrice - tp1) * 10).toFixed(1));
            break;
          }
        }
      }

      // Check Expiry (if > 30 bars passed without hitting target or SL)
      if (!resolvedStatus && subCandles.length >= 30) {
        resolvedStatus = 'EXPIRED';
        const lastC = subCandles[subCandles.length - 1];
        outcomePrice = lastC.close;
        outcomePips = isBullish
          ? Number(((outcomePrice - entryPrice) * 10).toFixed(1))
          : Number(((entryPrice - outcomePrice) * 10).toFixed(1));
      }

      if (resolvedStatus) {
        await PredictionRepo.updateOutcome(pred.id, {
          status: resolvedStatus,
          outcomePrice,
          outcomePips,
        });

        // Store into Vector Memory for AI self-learning
        try {
          await vectorStore.storeMemory({
            category: 'prediction_outcome',
            contextText: `Setup: ${pred.primary_setup} on ${pred.symbol} ${pred.timeframe} at ${entryPrice} bias: ${pred.bias}`,
            metadata: {
              status: resolvedStatus,
              outcomePips,
              win: resolvedStatus === 'HIT_TP1' || resolvedStatus === 'HIT_TP2',
              setup: pred.primary_setup,
            },
          });
        } catch (memErr) {
          logger.warn({ err: memErr.message }, 'Failed to save prediction outcome memory');
        }

        logger.info(
          { id: pred.id, status: resolvedStatus, outcomePips },
          'Prediction reconciled with price action'
        );
      }
    }
  }

  async getPerformanceReport() {
    const stats = await PredictionRepo.getStats();
    const recent = await PredictionRepo.getRecent(10);
    return {
      stats,
      recent,
    };
  }
}

module.exports = new AccuracyTracker();
