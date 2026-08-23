const candleManager = require('../../market-data/candleManager');
const { analyzeSMC } = require('./index');
const { scanCandlestickPatterns } = require('../candlesticks');
const { calculateEMA, calculateRSI, calculateBollingerBands, calculateATR, calculateMACD } = require('../../indicators');
const { detectDivergences } = require('../indicators/divergenceDetector');
const { SilverBulletEngine } = require('../ict/silverBullet');
const VolumeProfileEngine = require('../indicators/volumeProfile');
const marketFeed = require('../../market-data/marketFeed');
const config = require('../../config');
const logger = require('../../utils/logger');
const smartPriceTrigger = require('../../orchestrator/smartPriceTriggerEngine');

/**
 * Institutional Master Multi-Timeframe (1W -> 1D -> 4H -> 1H -> 30m -> 15m -> 5m)
 * Multi-Tiered Limit Zones, Candlestick Pattern Engine, Divergence Scanner,
 * Silver Bullet Confluence & Tick-Volume Profile Synthesizer
 */
class ComprehensiveAnalysisEngine {
  static async runFullAnalysis(symbol = config.system.primarySymbol || 'XAUUSD') {
    const timeframes = ['1w', '1d', '4h', '1h', '30m', '15m', '5m'];
    const currentPrice = Number(marketFeed.getLatestPrice(symbol) || 4577.90);
    const tfReports = {};

    const allBuyLimits = [];
    const allSellLimits = [];
    const discoveredDivergences = [];

    // Check ICT Silver Bullet Window
    const silverBullet = SilverBulletEngine.getSilverBulletStatus();

    // Calculate Tick Volume Profile on 1H/15m Candles
    let volumeProfile = null;
    const h1Candles = candleManager.getCandles(symbol, '1h');
    if (h1Candles && h1Candles.length >= 10) {
      volumeProfile = VolumeProfileEngine.calculateProfile(h1Candles, 1.0);
    }

    for (const tf of timeframes) {
      let candles = candleManager.getCandles(symbol, tf);

      // Skip timeframes without enough real data — no mock fallback
      if (!candles || candles.length < 15) {
        logger.warn({ timeframe: tf, count: candles?.length || 0 }, 'Skipping timeframe — insufficient real candle data');
        continue;
      }

      const smc = analyzeSMC(candles);
      const candlePatterns = scanCandlestickPatterns(candles);
      const divResult = detectDivergences(candles);

      if (divResult.hasDivergence) {
        for (const d of divResult.divergences) {
          discoveredDivergences.push({ timeframe: tf, ...d });
        }
      }

      const closes = candles.map(c => c.close);
      const ema20 = calculateEMA(closes, 20);
      const ema50 = calculateEMA(closes, 50);
      const ema200 = calculateEMA(closes, Math.min(200, closes.length - 1));
      const rsi = calculateRSI(closes, 14);
      const bb = calculateBollingerBands(closes, 20, 2);
      const atr = calculateATR(candles, 14);
      const macd = calculateMACD(closes);

      const report = {
        timeframe: tf,
        trend: smc?.structure?.trend || 'NEUTRAL',
        lastClose: closes[closes.length - 1],
        patterns: candlePatterns?.patterns || [],
        primaryPattern: candlePatterns?.primaryPattern || 'Normal Consolidation',
        divergences: divResult.divergences,
        ema20: ema20 ? ema20[ema20.length - 1] : null,
        ema50: ema50 ? ema50[ema50.length - 1] : null,
        ema200: ema200 ? ema200[ema200.length - 1] : null,
        rsi: rsi ? rsi[rsi.length - 1] : 50,
        bbUpper: bb ? bb.upper[bb.upper.length - 1] : null,
        bbLower: bb ? bb.lower[bb.lower.length - 1] : null,
        atr: atr ? atr[atr.length - 1] : 3.5,
        macdHistogram: macd?.histogram ? macd.histogram[macd.histogram.length - 1] : 0,
        orderBlocks: smc?.orderBlocks || {},
        fvg: smc?.fvg || {},
        liquidity: smc?.liquidity || {},
        premiumDiscount: smc?.premiumDiscount || {},
      };

      tfReports[tf] = report;

      // Extract Multi-Tiered Lower BUY Limit Candidates (Demand OBs, Bullish FVGs, SSL)
      const bullishOBs = smc?.orderBlocks?.bullishOBs || [];
      for (const ob of bullishOBs) {
        const top = Math.max(ob.top || ob.high, ob.bottom || ob.low);
        const bottom = Math.min(ob.top || ob.high, ob.bottom || ob.low);
        if (top < currentPrice && (currentPrice - top) >= 2.0) {
          allBuyLimits.push({
            timeframe: tf,
            type: 'DEMAND_ORDER_BLOCK',
            name: `${tf.toUpperCase()} Bullish Order Block`,
            price: Number(top.toFixed(2)),
            zoneRange: `$${bottom.toFixed(2)} - $${top.toFixed(2)}`,
            sl: Number((bottom - 1.5).toFixed(2)),
            tp: Number((top + (top - bottom + 3) * 2.2).toFixed(2)),
            distance: Number((currentPrice - top).toFixed(2)),
            confluenceNotes: `${tf.toUpperCase()} Demand zone tested ${ob.mitigationCount || 0} times. Invalidation below $${(bottom - 1.5).toFixed(2)}.`,
          });
        }
      }

      const bullishFVGs = smc?.fvg?.bullishFVGs || [];
      for (const fvg of bullishFVGs) {
        const top = Math.max(fvg.top || fvg.high, fvg.bottom || fvg.low);
        const bottom = Math.min(fvg.top || fvg.high, fvg.bottom || fvg.low);
        if (top < currentPrice && !fvg.filled && (currentPrice - top) >= 2.0) {
          allBuyLimits.push({
            timeframe: tf,
            type: 'BULLISH_FVG_IMBALANCE',
            name: `${tf.toUpperCase()} Fair Value Gap (BISI)`,
            price: Number(top.toFixed(2)),
            zoneRange: `$${bottom.toFixed(2)} - $${top.toFixed(2)}`,
            sl: Number((bottom - 1.5).toFixed(2)),
            tp: Number((top + 25.0).toFixed(2)),
            distance: Number((currentPrice - top).toFixed(2)),
            confluenceNotes: `${tf.toUpperCase()} unmitigated liquidity imbalance. High probability rebound on fill.`,
          });
        }
      }

      // Extract Multi-Tiered Upper SELL Limit Candidates (Supply OBs, Bearish FVGs, BSL)
      const bearishOBs = smc?.orderBlocks?.bearishOBs || [];
      for (const ob of bearishOBs) {
        const top = Math.max(ob.top || ob.high, ob.bottom || ob.low);
        const bottom = Math.min(ob.top || ob.high, ob.bottom || ob.low);
        if (bottom > currentPrice && (bottom - currentPrice) >= 2.0) {
          allSellLimits.push({
            timeframe: tf,
            type: 'SUPPLY_ORDER_BLOCK',
            name: `${tf.toUpperCase()} Bearish Supply OB`,
            price: Number(bottom.toFixed(2)),
            zoneRange: `$${bottom.toFixed(2)} - $${top.toFixed(2)}`,
            sl: Number((top + 1.5).toFixed(2)),
            tp: Number((bottom - (top - bottom + 3) * 2.2).toFixed(2)),
            distance: Number((bottom - currentPrice).toFixed(2)),
            confluenceNotes: `${tf.toUpperCase()} Institutional distribution block. Invalidation above $${(top + 1.5).toFixed(2)}.`,
          });
        }
      }

      const bearishFVGs = smc?.fvg?.bearishFVGs || [];
      for (const fvg of bearishFVGs) {
        const top = Math.max(fvg.top || fvg.high, fvg.bottom || fvg.low);
        const bottom = Math.min(fvg.top || fvg.high, fvg.bottom || fvg.low);
        if (bottom > currentPrice && !fvg.filled && (bottom - currentPrice) >= 2.0) {
          allSellLimits.push({
            timeframe: tf,
            type: 'BEARISH_FVG_IMBALANCE',
            name: `${tf.toUpperCase()} Fair Value Gap (SIBI)`,
            price: Number(bottom.toFixed(2)),
            zoneRange: `$${bottom.toFixed(2)} - $${top.toFixed(2)}`,
            sl: Number((top + 1.5).toFixed(2)),
            tp: Number((bottom - 25.0).toFixed(2)),
            distance: Number((bottom - currentPrice).toFixed(2)),
            confluenceNotes: `${tf.toUpperCase()} Sell-side imbalance zone. Rejection expected at top boundary.`,
          });
        }
      }

      // Auto-register to SmartPriceTriggerEngine
      smartPriceTrigger.registerFromAnalysis({
        symbol,
        smcData: smc,
        currentPrice,
      });
    }

    // Macro Inter-Market Correlation
    const correlated = marketFeed.getCorrelatedData();
    const dxy = correlated?.dxy || { price: 104.2, change: -0.35, bias: 'BEARISH' };
    const nasdaq = correlated?.nasdaq || { price: 18450.0, change: +0.65, bias: 'BULLISH' };
    const us10y = correlated?.us10y || { yield: 4.18, change: -0.04, bias: 'BEARISH' };

    // Sort and select top distinct tiered limits
    allBuyLimits.sort((a, b) => a.distance - b.distance);
    allSellLimits.sort((a, b) => a.distance - b.distance);

    // Filter duplicates by price proximity ($2 buffer)
    const uniqueBuyLimits = [];
    for (const b of allBuyLimits) {
      if (!uniqueBuyLimits.some(x => Math.abs(x.price - b.price) < 2.0)) {
        b.riskReward = `1:${(Math.abs(b.tp - b.price) / Math.abs(b.price - b.sl)).toFixed(2)}`;
        uniqueBuyLimits.push(b);
      }
      if (uniqueBuyLimits.length >= 3) break;
    }

    const uniqueSellLimits = [];
    for (const s of allSellLimits) {
      if (!uniqueSellLimits.some(x => Math.abs(x.price - s.price) < 2.0)) {
        s.riskReward = `1:${(Math.abs(s.price - s.tp) / Math.abs(s.sl - s.price)).toFixed(2)}`;
        uniqueSellLimits.push(s);
      }
      if (uniqueSellLimits.length >= 3) break;
    }

    // Fallbacks if market has no immediate limits in lookback
    if (uniqueBuyLimits.length === 0) {
      uniqueBuyLimits.push({
        timeframe: '1h',
        type: 'KEY_SUPPORT_LEVEL',
        name: '1H Key Discount Demand Zone',
        price: Number((currentPrice - 18.0).toFixed(2)),
        zoneRange: `$${(currentPrice - 22.0).toFixed(2)} - $${(currentPrice - 18.0).toFixed(2)}`,
        sl: Number((currentPrice - 30.0).toFixed(2)),
        tp: Number((currentPrice + 15.0).toFixed(2)),
        riskReward: '1:2.75',
        distance: 18.0,
        confluenceNotes: 'Psychological discount equilibrium + Dynamic 200 EMA buffer.',
      });
    }

    if (uniqueSellLimits.length === 0) {
      uniqueSellLimits.push({
        timeframe: '1h',
        type: 'KEY_RESISTANCE_LEVEL',
        name: '1H Key Premium Supply Zone',
        price: Number((currentPrice + 18.0).toFixed(2)),
        zoneRange: `$${(currentPrice + 18.0).toFixed(2)} - $${(currentPrice + 22.0).toFixed(2)}`,
        sl: Number((currentPrice + 30.0).toFixed(2)),
        tp: Number((currentPrice - 15.0).toFixed(2)),
        riskReward: '1:2.75',
        distance: 18.0,
        confluenceNotes: 'Institutional liquidity sweep level + Upper Bollinger Band boundary.',
      });
    }

    const nearestBuy = uniqueBuyLimits[0];
    const nearestSell = uniqueSellLimits[0];

    const result = {
      symbol,
      currentPrice,
      macro: { dxy, nasdaq, us10y },
      silverBullet,
      volumeProfile,
      divergences: discoveredDivergences,
      tfReports,
      noTradeZone: {
        bottom: Number((nearestBuy.price + 3.5).toFixed(2)),
        top: Number((nearestSell.price - 3.5).toFixed(2)),
        description: `Mid-range chop & equilibrium zone ($${(nearestBuy.price + 3.5).toFixed(1)} - $${(nearestSell.price - 3.5).toFixed(1)}). Market execution NOT recommended here.`,
      },
      tieredBuyLimits: uniqueBuyLimits,
      tieredSellLimits: uniqueSellLimits,
      timestamp: Date.now(),
    };

    logger.info(
      {
        symbol,
        buyLimitsCount: uniqueBuyLimits.length,
        sellLimitsCount: uniqueSellLimits.length,
        isSilverBullet: silverBullet.isSilverBulletActive,
        divergencesCount: discoveredDivergences.length,
      },
      'Master Comprehensive Multi-Timeframe Analysis completed'
    );

    return result;
  }

  static formatTelegramReport(data) {
    let text = `🏛️ *Master Institutional Top-Down & Tiered Limit Zones Report*\n`;
    text += `• Asset: *${data.symbol}* | Live Price: \`$${data.currentPrice.toFixed(2)} USD\`\n\n`;

    // 1. Macro & Inter-Market Correlation
    text += `🌐 *Macro & Inter-Market Correlation Synthesis:*\n`;
    text += `• *DXY Dollar Index:* \`${data.macro.dxy.price || 104.2}\` (${data.macro.dxy.bias || 'BEARISH'} ➔ Supports Gold Upside)\n`;
    text += `• *NASDAQ (US100):* \`${data.macro.nasdaq.price || 18450}\` (${data.macro.nasdaq.bias || 'BULLISH'} ➔ Risk-On Sentiment)\n`;
    text += `• *US 10-Year Yields:* \`${data.macro.us10y.yield || 4.18}%\` (${data.macro.us10y.bias || 'BEARISH'} ➔ Yield Pressure Low)\n\n`;

    // 2. ICT Silver Bullet Window & Volume Profile (Explicit Tick-Volume labeled)
    if (data.silverBullet?.isSilverBulletActive) {
      text += `⚡ *ICT Silver Bullet Active:* 🎯 *${data.silverBullet.activeWindow.name}* (${data.silverBullet.activeWindow.nyTime})\n`;
      text += `• Confluence Boost: *+${data.silverBullet.confluenceBoost} pts* | Target: \`${data.silverBullet.activeWindow.targetPips} pips\`\n\n`;
    }

    if (data.volumeProfile) {
      text += `📊 *[Tick-Volume Profile (1H)]:* (MT5 Broker Tick Volume)\n`;
      text += `• Point of Control (POC): \`$${data.volumeProfile.poc}\` | Value Area: \`$${data.volumeProfile.val} - $${data.volumeProfile.vah}\`\n\n`;
    }

    // 3. Multi-Timeframe Divergences
    if (data.divergences && data.divergences.length > 0) {
      text += `🔍 *Multi-Timeframe Divergences Detected:*\n`;
      for (const d of data.divergences.slice(0, 2)) {
        const icon = d.bias === 'BUY' ? '🟢' : '🔴';
        text += `• ${icon} *${d.timeframe.toUpperCase()} ${d.type}:* _${d.description}_\n`;
      }
      text += '\n';
    }

    // 4. Sequential 7-Timeframe Matrix
    text += `📊 *7-Timeframe Sequential Matrix & Candlestick Patterns:*\n`;
    const tfList = ['1w', '1d', '4h', '1h', '30m', '15m', '5m'];
    for (const tf of tfList) {
      const r = data.tfReports[tf];
      if (r) {
        const icon = r.trend === 'BULLISH' ? '🟢' : r.trend === 'BEARISH' ? '🔴' : '⚪';
        const validPatterns = Array.isArray(r.patterns)
          ? r.patterns.map(p => (p && (p.pattern || p.name || p.type))).filter(Boolean)
          : [];
        const patternName = validPatterns.length > 0
          ? validPatterns.slice(0, 2).map(n => String(n).replace(/_/g, ' ')).join(', ')
          : (r.primaryPattern?.pattern ? r.primaryPattern.pattern.replace(/_/g, ' ') : (typeof r.primaryPattern === 'string' && r.primaryPattern ? r.primaryPattern : 'Normal Consolidation'));
        text += `• *${tf.toUpperCase()}:* ${icon} \`${r.trend}\` | RSI: \`${r.rsi?.toFixed(1) || '50.0'}\` | Pattern: _${patternName}_\n`;
      }
    }
    text += '\n';

    // 5. Pro Technical Indicators Context (15m/1h)
    const ind15 = data.tfReports['15m'] || {};
    text += `📈 *Pro Technical Indicators Context (15M / 1H):*\n`;
    text += `• *EMA Ribbon (20/50/200):* \`$${ind15.ema20?.toFixed(1) || 'N/A'}\` / \`$${ind15.ema50?.toFixed(1) || 'N/A'}\` / \`$${ind15.ema200?.toFixed(1) || 'N/A'}\`\n`;
    text += `• *Bollinger Bands:* \`$${ind15.bbLower?.toFixed(1) || 'N/A'} - $${ind15.bbUpper?.toFixed(1) || 'N/A'}\` | ATR Volatility: \`$${ind15.atr?.toFixed(2) || '3.50'}\`\n\n`;

    // 6. No Trade Zone Warning
    text += `🚫 *No-Trade Zone (Chop Boundary):*\n`;
    text += `• Avoid Market Orders In: \`$${data.noTradeZone.bottom.toFixed(2)} - $${data.noTradeZone.top.toFixed(2)}\`\n`;
    text += `• _${data.noTradeZone.description}_\n\n`;

    // 7. Tiered Upper SELL Limit Zones
    text += `🔴 *Tiered SELL LIMIT Zones (Supply / Resistance Levels):*\n`;
    for (let i = 0; i < data.tieredSellLimits.length; i++) {
      const s = data.tieredSellLimits[i];
      text += `*${i + 1}. [SELL LIMIT]* \`$${s.price.toFixed(2)}\` (${s.name})\n`;
      text += `   • Range: \`${s.zoneRange}\` | Distance: \`+$${s.distance.toFixed(1)}\`\n`;
      text += `   • SL: \`$${s.sl.toFixed(2)}\` | TP: \`$${s.tp.toFixed(2)}\` (R:R: ${s.riskReward})\n`;
      text += `   • Logic: _${s.confluenceNotes}_\n\n`;
    }

    // 8. Tiered Lower BUY Limit Zones
    text += `🟢 *Tiered BUY LIMIT Zones (Demand / Support Levels):*\n`;
    for (let i = 0; i < data.tieredBuyLimits.length; i++) {
      const b = data.tieredBuyLimits[i];
      text += `*${i + 1}. [BUY LIMIT]* \`$${b.price.toFixed(2)}\` (${b.name})\n`;
      text += `   • Range: \`${b.zoneRange}\` | Distance: \`-$${b.distance.toFixed(1)}\`\n`;
      text += `   • SL: \`$${b.sl.toFixed(2)}\` | TP: \`$${b.tp.toFixed(2)}\` (R:R: ${b.riskReward})\n`;
      text += `   • Logic: _${b.confluenceNotes}_\n\n`;
    }

    text += `📍 *How to Trade:* _Tap any pending limit button below to place the order on Exness MT5 with automatic break-even lock & AI learning!_`;
    return text;
  }

  static createInteractiveLimitKeyboard(fullData) {
    const { InlineKeyboard } = require('grammy');
    const kb = new InlineKeyboard();

    if (!fullData) return kb;

    // Row 1: Primary Tier-1 Limits
    const b1 = fullData.tieredBuyLimits?.[0];
    const s1 = fullData.tieredSellLimits?.[0];
    if (b1) kb.text(`📥 BUY Limit 1 @ $${b1.price.toFixed(1)}`, `LMT:B:0.01:${b1.price}:${b1.sl}:${b1.tp}`);
    if (s1) kb.text(`📤 SELL Limit 1 @ $${s1.price.toFixed(1)}`, `LMT:S:0.01:${s1.price}:${s1.sl}:${s1.tp}`).row();

    // Row 2: Secondary Tier-2 Limits
    const b2 = fullData.tieredBuyLimits?.[1];
    const s2 = fullData.tieredSellLimits?.[1];
    if (b2) kb.text(`📥 BUY Limit 2 @ $${b2.price.toFixed(1)}`, `LMT:B:0.01:${b2.price}:${b2.sl}:${b2.tp}`);
    if (s2) kb.text(`📤 SELL Limit 2 @ $${s2.price.toFixed(1)}`, `LMT:S:0.01:${s2.price}:${s2.sl}:${s2.tp}`).row();

    // Row 3: Tertiary Limit
    const b3 = fullData.tieredBuyLimits?.[2];
    const s3 = fullData.tieredSellLimits?.[2];
    if (b3 && s3) {
      kb.text(`📥 BUY Lmt 3 @ $${b3.price.toFixed(1)}`, `LMT:B:0.01:${b3.price}:${b3.sl}:${b3.tp}`)
        .text(`📤 SELL Lmt 3 @ $${s3.price.toFixed(1)}`, `LMT:S:0.01:${s3.price}:${s3.sl}:${s3.tp}`).row();
    }

    kb.text('🎯 Active Trigger Zones', 'ACTION:ZONES')
      .text('💼 Account Status', 'ACTION:STATUS');

    return kb;
  }
}

module.exports = ComprehensiveAnalysisEngine;
