const candleManager = require('../../market-data/candleManager');
const { analyzeSMC } = require('./index');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * Top-Down Institutional Liquidity Hierarchy & PDH/PDL Sweep Engine
 * Prioritizes Higher Timeframes (1D > 4H > 1H > 15m > 5m).
 * Detects Daily Liquidity Sweeps, 4H Draw on Liquidity (DOL) targets, and LTF tactical entries.
 */
class TopDownLiquidityEngine {
  static analyzeTopDown(symbol = config.system.primarySymbol || 'XAUUSD') {
    const dailyCandles = candleManager.getCandles(symbol, '1d');
    const h4Candles = candleManager.getCandles(symbol, '4h');
    const m15Candles = candleManager.getCandles(symbol, '15m');
    const m5Candles = candleManager.getCandles(symbol, '5m');

    if (!dailyCandles || dailyCandles.length < 3) {
      return { hasSignal: false, reason: 'Insufficient daily candle data' };
    }

    const currentDaily = dailyCandles[dailyCandles.length - 1];
    const prevDaily = dailyCandles[dailyCandles.length - 2];
    const pdh = prevDaily.high; // Previous Day High
    const pdl = prevDaily.low;  // Previous Day Low
    const currentPrice = currentDaily.close;

    // 1. Daily Liquidity Sweep Detection
    let dailySweep = null;
    if (currentDaily.high > pdh && currentPrice < pdh) {
      dailySweep = {
        type: 'BEARISH_PDH_SWEEP',
        sweptLevel: pdh,
        highReached: currentDaily.high,
        bias: 'SELL',
        confidence: 85,
        invalidationSL: currentDaily.high + 1.5, // Stop loss safely above daily wick
        description: `Daily candle swept Previous Day High ($${pdh.toFixed(2)}) and rejected downward! Major Institutional Sell Setup.`,
      };
    } else if (currentDaily.low < pdl && currentPrice > pdl) {
      dailySweep = {
        type: 'BULLISH_PDL_SWEEP',
        sweptLevel: pdl,
        lowReached: currentDaily.low,
        bias: 'BUY',
        confidence: 85,
        invalidationSL: currentDaily.low - 1.5, // Stop loss safely below daily wick
        description: `Daily candle swept Previous Day Low ($${pdl.toFixed(2)}) and rejected upward! Major Institutional Buy Setup.`,
      };
    }

    // 2. 4-Hour Draw on Liquidity (DOL) & Target Mapping
    let h4Target = null;
    if (h4Candles && h4Candles.length >= 15) {
      const h4SMC = analyzeSMC(h4Candles);
      if (dailySweep && dailySweep.bias === 'SELL') {
        // Find nearest 4H Bullish Demand OB / FVG below price as target (Draw on Liquidity)
        const demandOBs = (h4SMC.orderBlocks?.bullishOBs || []).filter(ob => (ob.top || ob.high) < currentPrice);
        const demandFVGs = (h4SMC.fvg?.bullishFVGs || []).filter(fvg => (fvg.top || fvg.high) < currentPrice);
        
        if (demandOBs.length > 0) {
          const targetOB = demandOBs[demandOBs.length - 1];
          h4Target = {
            type: '4H_DEMAND_ORDER_BLOCK',
            price: targetOB.top || targetOB.high,
            potentialFallPips: Number((currentPrice - (targetOB.top || targetOB.high)).toFixed(1)),
          };
        } else if (demandFVGs.length > 0) {
          const targetFVG = demandFVGs[demandFVGs.length - 1];
          h4Target = {
            type: '4H_BULLISH_FVG',
            price: targetFVG.top || targetFVG.high,
            potentialFallPips: Number((currentPrice - (targetFVG.top || targetFVG.high)).toFixed(1)),
          };
        }
      } else if (dailySweep && dailySweep.bias === 'BUY') {
        // Find nearest 4H Bearish Supply OB / FVG above price as target
        const supplyOBs = (h4SMC.orderBlocks?.bearishOBs || []).filter(ob => (ob.bottom || ob.low) > currentPrice);
        const supplyFVGs = (h4SMC.fvg?.bearishFVGs || []).filter(fvg => (fvg.bottom || fvg.low) > currentPrice);

        if (supplyOBs.length > 0) {
          const targetOB = supplyOBs[supplyOBs.length - 1];
          h4Target = {
            type: '4H_SUPPLY_ORDER_BLOCK',
            price: targetOB.bottom || targetOB.low,
            potentialRisePips: Number(((targetOB.bottom || targetOB.low) - currentPrice).toFixed(1)),
          };
        } else if (supplyFVGs.length > 0) {
          const targetFVG = supplyFVGs[supplyFVGs.length - 1];
          h4Target = {
            type: '4H_BEARISH_FVG',
            price: targetFVG.bottom || targetFVG.low,
            potentialRisePips: Number(((targetFVG.bottom || targetFVG.low) - currentPrice).toFixed(1)),
          };
        }
      }
    }

    // 3. Lower Timeframe (15m/5m) Tactical Entry Confirmation
    let ltfConfirmation = false;
    if (m15Candles && m15Candles.length >= 10) {
      const m15SMC = analyzeSMC(m15Candles);
      if (dailySweep && dailySweep.bias === 'SELL') {
        ltfConfirmation = m15SMC.structure?.trend === 'BEARISH' || m15SMC.structure?.recentCHoCH?.type === 'CHOCH_BEARISH';
      } else if (dailySweep && dailySweep.bias === 'BUY') {
        ltfConfirmation = m15SMC.structure?.trend === 'BULLISH' || m15SMC.structure?.recentCHoCH?.type === 'CHOCH_BULLISH';
      }
    }

    const hasHighProbabilitySetup = Boolean(dailySweep && h4Target);

    logger.info(
      {
        symbol,
        hasDailySweep: Boolean(dailySweep),
        sweepType: dailySweep?.type,
        hasH4Target: Boolean(h4Target),
        ltfConfirmed: ltfConfirmation,
      },
      'TopDownLiquidityEngine analysis completed'
    );

    return {
      symbol,
      currentPrice,
      pdh,
      pdl,
      dailySweep,
      h4Target,
      ltfConfirmation,
      hasHighProbabilitySetup,
      proposedTrade: hasHighProbabilitySetup ? {
        action: dailySweep.bias,
        entryPrice: currentPrice,
        stopLoss: dailySweep.invalidationSL,
        takeProfit: h4Target.price,
        riskReward: Math.abs((h4Target.price - currentPrice) / (currentPrice - dailySweep.invalidationSL)).toFixed(2),
        rationale: `${dailySweep.description} Target: ${h4Target.type} @ $${h4Target.price}.`,
      } : null,
    };
  }
}

module.exports = TopDownLiquidityEngine;
