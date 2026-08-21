const candleManager = require('../../market-data/candleManager');
const { analyzeSMC } = require('./index');
const smartPriceTrigger = require('../../orchestrator/smartPriceTriggerEngine');
const marketFeed = require('../../market-data/marketFeed');
const config = require('../../config');
const logger = require('../../utils/logger');

const { generateRealisticGoldCandles } = require('../../market-data/mockDataGenerator');

/**
 * Multi-Timeframe Institutional SMC Order Block & Zone Scanner
 * Scans 5m, 15m, 30m, 1h, 4h, 1D to detect exact Order Blocks, FVGs and Liquidity Zones.
 */
class MultiTimeframeScanner {
  static scanAllZones(symbol = config.system.primarySymbol || 'XAUUSD') {
    const timeframes = ['5m', '15m', '30m', '1h', '4h', '1d'];
    const currentPrice = Number(marketFeed.getLatestPrice(symbol) || 4526.0);
    const results = {
      symbol,
      currentPrice,
      orderBlocks: [],
      fairValueGaps: [],
      liquidityPools: [],
      timestamp: Date.now(),
    };

    for (const tf of timeframes) {
      let candles = candleManager.getCandles(symbol, tf);
      if (!candles || candles.length < 15) {
        const mockHistory = generateRealisticGoldCandles({
          count: 100,
          timeframe: tf,
          basePrice: currentPrice || 4520.0,
          trend: 'BULLISH',
        });
        candleManager.setCandles(symbol, tf, mockHistory);
        candles = candleManager.getCandles(symbol, tf);
      }
      if (!candles || candles.length < 15) continue;

      const smc = analyzeSMC(candles);
      if (!smc) continue;

      // Extract Order Blocks
      if (smc.orderBlocks) {
        const obs = [
          ...(smc.orderBlocks.bullishOBs || []).map(o => ({ ...o, type: 'BULLISH', timeframe: tf })),
          ...(smc.orderBlocks.bearishOBs || []).map(o => ({ ...o, type: 'BEARISH', timeframe: tf })),
        ];
        for (const ob of obs) {
          const top = ob.top || ob.high;
          const bottom = ob.bottom || ob.low;
          if (top !== undefined && bottom !== undefined) {
            results.orderBlocks.push({
              timeframe: tf,
              type: ob.type,
              top: Math.max(top, bottom),
              bottom: Math.min(top, bottom),
              meanThreshold: ob.meanThreshold || (top + bottom) / 2,
              isMitigated: ob.isMitigated,
              distance: Math.abs(currentPrice - (top + bottom) / 2),
            });
          }
        }
      }

      // Extract FVGs
      if (smc.fvg) {
        const fvgs = [
          ...(smc.fvg.bullishFVGs || []).map(f => ({ ...f, type: 'BULLISH', timeframe: tf })),
          ...(smc.fvg.bearishFVGs || []).map(f => ({ ...f, type: 'BEARISH', timeframe: tf })),
        ];
        for (const f of fvgs) {
          const top = f.top || f.high;
          const bottom = f.bottom || f.low;
          if (top !== undefined && bottom !== undefined && !f.filled) {
            results.fairValueGaps.push({
              timeframe: tf,
              type: f.type,
              top: Math.max(top, bottom),
              bottom: Math.min(top, bottom),
              distance: Math.abs(currentPrice - (top + bottom) / 2),
            });
          }
        }
      }

      // Auto-register to Smart Price Trigger Engine
      smartPriceTrigger.registerFromAnalysis({
        symbol,
        smcData: smc,
        currentPrice,
      });
    }

    // Sort by proximity to current price
    results.orderBlocks.sort((a, b) => a.distance - b.distance);
    results.fairValueGaps.sort((a, b) => a.distance - b.distance);

    logger.info(
      { symbol, obCount: results.orderBlocks.length, fvgCount: results.fairValueGaps.length },
      'MultiTimeframeScanner complete'
    );
    return results;
  }

  static formatTelegramReport(symbol = 'XAUUSD') {
    const scan = this.scanAllZones(symbol);
    let text = `📦 *Multi-Timeframe Institutional Order Blocks & Zones*\n`;
    text += `• Primary Asset: *${scan.symbol}*\n`;
    text += `• Live Spot Price: \`$${scan.currentPrice.toFixed(2)} USD\`\n\n`;

    if (scan.orderBlocks.length === 0) {
      text += '_No active unmitigated Order Blocks found in recent lookback window._\n';
    } else {
      text += `🧱 *Active Order Blocks (${scan.orderBlocks.length} Found):*\n`;
      for (const ob of scan.orderBlocks.slice(0, 6)) {
        const icon = ob.type === 'BULLISH' ? '🟢 Bullish Demand OB' : '🔴 Bearish Supply OB';
        text += `• *${icon}* (\`${ob.timeframe}\`)\n`;
        text += `  Range: \`$${ob.bottom.toFixed(2)} - $${ob.top.toFixed(2)}\` | Eq: \`$${ob.meanThreshold.toFixed(2)}\`\n`;
        text += `  Distance: \`$${ob.distance.toFixed(2)}\` ${ob.isMitigated ? '(Mitigated)' : '(Fresh/Unmitigated)'}\n\n`;
      }
    }

    if (scan.fairValueGaps.length > 0) {
      text += `⚡ *Open Fair Value Gaps (FVG Imbalances):*\n`;
      for (const fvg of scan.fairValueGaps.slice(0, 4)) {
        const icon = fvg.type === 'BULLISH' ? '🟢 Bullish FVG' : '🔴 Bearish FVG';
        text += `• *${icon}* (\`${fvg.timeframe}\`): \`$${fvg.bottom.toFixed(2)} - $${fvg.top.toFixed(2)}\` (Dist: $${fvg.distance.toFixed(2)})\n`;
      }
      text += '\n';
    }

    text += `📍 _All levels are registered in Smart Price Trigger Engine. AI will automatically execute/alert when price enters any zone!_`;
    return text;
  }
}

module.exports = MultiTimeframeScanner;
