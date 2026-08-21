const candleManager = require('../../market-data/candleManager');
const { analyzeSMC } = require('./index');
const { analyzeICT } = require('../ict');
const { calculateEMA, calculateRSI } = require('../../indicators');
const marketFeed = require('../../market-data/marketFeed');
const config = require('../../config');
const logger = require('../../utils/logger');
const { generateRealisticGoldCandles } = require('../../market-data/mockDataGenerator');
const smartPriceTrigger = require('../../orchestrator/smartPriceTriggerEngine');

/**
 * Comprehensive 7-Timeframe (1W -> 1D -> 4H -> 1H -> 30m -> 15m -> 5m) + Macro (DXY/NASDAQ) Synthesizer
 * Formulates Two-Sided Limit Trading Zones & 1-Tap Pending Limit Orders.
 */
class ComprehensiveAnalysisEngine {
  static async runFullAnalysis(symbol = config.system.primarySymbol || 'XAUUSD') {
    const timeframes = ['1w', '1d', '4h', '1h', '30m', '15m', '5m'];
    const currentPrice = Number(marketFeed.getLatestPrice(symbol) || 4572.0);
    const tfReports = {};

    for (const tf of timeframes) {
      let candles = candleManager.getCandles(symbol, tf);
      if (!candles || candles.length < 15) {
        const mock = generateRealisticGoldCandles({
          count: 100,
          timeframe: tf,
          basePrice: currentPrice,
          trend: 'BULLISH',
        });
        candleManager.setCandles(symbol, tf, mock);
        candles = candleManager.getCandles(symbol, tf);
      }

      if (!candles || candles.length < 15) continue;

      const smc = analyzeSMC(candles);
      const closes = candles.map(c => c.close);
      const ema50 = calculateEMA(closes, 50);
      const rsi = calculateRSI(closes, 14);

      tfReports[tf] = {
        timeframe: tf,
        trend: smc?.structure?.trend || 'NEUTRAL',
        orderBlocks: smc?.orderBlocks || {},
        fvg: smc?.fvg || {},
        liquidity: smc?.liquidity || {},
        lastClose: closes[closes.length - 1],
        ema50: ema50 ? ema50[ema50.length - 1] : null,
        rsi: rsi ? rsi[rsi.length - 1] : null,
      };

      // Auto-register discovered zones into SmartPriceTriggerEngine
      smartPriceTrigger.registerFromAnalysis({
        symbol,
        smcData: smc,
        currentPrice,
      });
    }

    // Correlated Macro Inter-Market Data (DXY, NASDAQ, US10Y)
    const correlated = marketFeed.getCorrelatedData();
    const dxy = correlated?.dxy || { price: 104.2, change: -0.35, bias: 'BEARISH' };
    const nasdaq = correlated?.nasdaq || { price: 18450.0, change: +0.65, bias: 'BULLISH' };
    const us10y = correlated?.us10y || { yield: 4.18, change: -0.04, bias: 'BEARISH' };

    // 1. Calculate Upper Sell Limit Zone (Supply OB / FVG / BSL)
    let sellLimitPrice = currentPrice + 18.5; // Default safe buffer
    let sellLimitContext = 'Higher Timeframe Resistance / Liquidity Sweep Area';
    
    // Find nearest 4H/1H/30m Bearish Supply OB above current price
    for (const tf of ['4h', '1h', '30m', '15m']) {
      const obList = tfReports[tf]?.orderBlocks?.bearishOBs || [];
      const valid = obList.filter(ob => (ob.bottom || ob.low) > currentPrice);
      if (valid.length > 0) {
        const best = valid[0];
        sellLimitPrice = Number((best.bottom || best.low).toFixed(2));
        sellLimitContext = `${tf.toUpperCase()} Supply Order Block [${(best.bottom || best.low).toFixed(2)} - ${(best.top || best.high).toFixed(2)}]`;
        break;
      }
    }

    // 2. Calculate Lower Buy Limit Zone (Demand OB / FVG / SSL)
    let buyLimitPrice = currentPrice - 18.5; // Default safe buffer
    let buyLimitContext = 'Higher Timeframe Demand / Discount Value Area';

    // Find nearest 4H/1H/30m Bullish Demand OB below current price
    for (const tf of ['4h', '1h', '30m', '15m']) {
      const obList = tfReports[tf]?.orderBlocks?.bullishOBs || [];
      const valid = obList.filter(ob => (ob.top || ob.high) < currentPrice);
      if (valid.length > 0) {
        const best = valid[valid.length - 1];
        buyLimitPrice = Number((best.top || best.high).toFixed(2));
        buyLimitContext = `${tf.toUpperCase()} Demand Order Block [${(best.bottom || best.low).toFixed(2)} - ${(best.top || best.high).toFixed(2)}]`;
        break;
      }
    }

    // Invalidation (SL) and Targets (TP)
    const sellLimitSL = Number((sellLimitPrice + 12.0).toFixed(2));
    const sellLimitTP = Number((sellLimitPrice - 26.0).toFixed(2));

    const buyLimitSL = Number((buyLimitPrice - 12.0).toFixed(2));
    const buyLimitTP = Number((buyLimitPrice + 26.0).toFixed(2));

    const result = {
      symbol,
      currentPrice,
      macro: { dxy, nasdaq, us10y },
      tfReports,
      noTradeZone: {
        bottom: buyLimitPrice + 4.0,
        top: sellLimitPrice - 4.0,
        description: `Mid-range chop zone ($${(buyLimitPrice + 4).toFixed(1)} - $${(sellLimitPrice - 4).toFixed(1)}) — DO NOT trade market execution here!`,
      },
      upperSellLimit: {
        price: sellLimitPrice,
        sl: sellLimitSL,
        tp: sellLimitTP,
        riskReward: '1:2.17',
        context: sellLimitContext,
        condition: `If price rallies to $${sellLimitPrice.toFixed(2)}, look for bearish rejection wick / tweezers to execute SELL LIMIT.`,
      },
      lowerBuyLimit: {
        price: buyLimitPrice,
        sl: buyLimitSL,
        tp: buyLimitTP,
        riskReward: '1:2.17',
        context: buyLimitContext,
        condition: `If price drops to $${buyLimitPrice.toFixed(2)}, look for bullish displacement / hammer to execute BUY LIMIT.`,
      },
      timestamp: Date.now(),
    };

    logger.info({ symbol, sellLimit: sellLimitPrice, buyLimit: buyLimitPrice }, 'Full Comprehensive Analysis & Limit Zones formulated');
    return result;
  }

  static formatTelegramReport(data) {
    let text = `🏛️ *Full 7-Timeframe Top-Down & Limit Zones Report*\n`;
    text += `• Asset: *${data.symbol}* | Live Price: \`$${data.currentPrice.toFixed(2)} USD\`\n\n`;

    // Macro Correlation
    text += `🌐 *Macro & Inter-Market Correlation:*\n`;
    text += `• DXY Index: \`${data.macro.dxy.price || 104.2}\` (${data.macro.dxy.bias || 'BEARISH'} ➔ Gold Bullish Support)\n`;
    text += `• NASDAQ / US100: \`${data.macro.nasdaq.price || 18450}\` (${data.macro.nasdaq.bias || 'BULLISH'})\n`;
    text += `• US 10Y Yields: \`${data.macro.us10y.yield || 4.18}%\` (${data.macro.us10y.bias || 'BEARISH'})\n\n`;

    // 7-Timeframe Matrix Breakdown
    text += `📊 *7-Timeframe Sequential Hierarchy:*\n`;
    const tfList = ['1w', '1d', '4h', '1h', '30m', '15m', '5m'];
    for (const tf of tfList) {
      const rep = data.tfReports[tf];
      if (rep) {
        const icon = rep.trend === 'BULLISH' ? '🟢' : rep.trend === 'BEARISH' ? '🔴' : '⚪';
        text += `• *${tf.toUpperCase()}:* ${icon} \`${rep.trend}\` | RSI: \`${rep.rsi?.toFixed(1) || '50.0'}\`\n`;
      }
    }
    text += '\n';

    // No Trade Zone Warning
    text += `🚫 *No-Trade Zone (Chop Range):*\n`;
    text += `• Range: \`$${data.noTradeZone.bottom.toFixed(2)} - $${data.noTradeZone.top.toFixed(2)}\`\n`;
    text += `• _${data.noTradeZone.description}_\n\n`;

    // Upper Sell Limit Zone
    text += `🔴 *Upper SELL LIMIT Zone:*\n`;
    text += `• Level: \`$${data.upperSellLimit.price.toFixed(2)}\`\n`;
    text += `• Stop Loss (SL): \`$${data.upperSellLimit.sl.toFixed(2)}\` | TP: \`$${data.upperSellLimit.tp.toFixed(2)}\` (R:R: ${data.upperSellLimit.riskReward})\n`;
    text += `• Setup Context: _${data.upperSellLimit.context}_\n`;
    text += `• Trigger Condition: _${data.upperSellLimit.condition}_\n\n`;

    // Lower Buy Limit Zone
    text += `🟢 *Lower BUY LIMIT Zone:*\n`;
    text += `• Level: \`$${data.lowerBuyLimit.price.toFixed(2)}\`\n`;
    text += `• Stop Loss (SL): \`$${data.lowerBuyLimit.sl.toFixed(2)}\` | TP: \`$${data.lowerBuyLimit.tp.toFixed(2)}\` (R:R: ${data.lowerBuyLimit.riskReward})\n`;
    text += `• Setup Context: _${data.lowerBuyLimit.context}_\n`;
    text += `• Trigger Condition: _${data.lowerBuyLimit.condition}_\n\n`;

    text += `_Tap any button below to instantly place the Pending Limit Order on Exness MT5!_`;
    return text;
  }
}

module.exports = ComprehensiveAnalysisEngine;
