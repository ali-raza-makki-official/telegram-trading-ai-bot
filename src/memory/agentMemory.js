const { TradeRepo, PredictionRepo, SettingsRepo } = require('../database');
const candleManager = require('../market-data/candleManager');
const marketFeed = require('../market-data/marketFeed');
const { getCurrentSessionInfo } = require('../strategies/ict/killzones');
const { calculateEMA, calculateRSI, calculateATR } = require('../indicators');
const config = require('../config');
const logger = require('../utils/logger');

// In-memory conversation history cache: chatId -> [{ role, content, timestamp }]
const chatHistories = new Map();

class AgentMemory {
  // 1. Record conversation turn
  static addChatMessage(chatId, role, content) {
    if (!chatId) return;
    if (!chatHistories.has(chatId)) {
      chatHistories.set(chatId, []);
    }
    const history = chatHistories.get(chatId);
    history.push({ role, content, timestamp: Date.now() });
    if (history.length > 20) {
      history.shift(); // keep last 20 messages
    }
  }

  // 2. Retrieve recent chat context
  static getChatHistory(chatId, limit = 8) {
    if (!chatId || !chatHistories.has(chatId)) return [];
    return chatHistories.get(chatId).slice(-limit);
  }

  // 3. Build Detailed Multi-Timeframe Technical & SMC Matrix
  static getMultiTimeframeAnalysis(symbol = config.system.primarySymbol) {
    const timeframes = ['5m', '15m', '1h', '4h', '1d', '1w'];
    const matrix = {};

    for (const tf of timeframes) {
      const candles = candleManager.getCandles(symbol, tf);
      if (!candles || candles.length < 10) {
        matrix[tf] = { status: 'Insufficient data', trend: 'NEUTRAL' };
        continue;
      }

      const closes = candles.map(c => c.close);
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);
      const currentCandle = candles[candles.length - 1];
      const prevCandle = candles[candles.length - 2];

      const ema20 = calculateEMA(closes, 20);
      const ema50 = calculateEMA(closes, 50);
      const ema200 = calculateEMA(closes, Math.min(200, closes.length - 1));
      const rsi = calculateRSI(closes, 14);
      const atr = calculateATR(candles, 14);

      // Structure calculation
      const recentHigh = Math.max(...highs.slice(-20));
      const recentLow = Math.min(...lows.slice(-20));
      const equilibrium = (recentHigh + recentLow) / 2;
      const isPremium = currentCandle.close > equilibrium;

      // Trend definition
      let trend = 'NEUTRAL';
      if (currentCandle.close > ema20 && ema20 > ema50) trend = 'BULLISH';
      else if (currentCandle.close < ema20 && ema20 < ema50) trend = 'BEARISH';

      // Detect Candlestick Formations
      const isBullishEngulfing = prevCandle.close < prevCandle.open &&
        currentCandle.close > currentCandle.open &&
        currentCandle.close > prevCandle.open &&
        currentCandle.open < prevCandle.close;

      const isBearishEngulfing = prevCandle.close > prevCandle.open &&
        currentCandle.close < currentCandle.open &&
        currentCandle.close < prevCandle.open &&
        currentCandle.open > prevCandle.close;

      const body = Math.abs(currentCandle.close - currentCandle.open);
      const upperWick = currentCandle.high - Math.max(currentCandle.open, currentCandle.close);
      const lowerWick = Math.min(currentCandle.open, currentCandle.close) - currentCandle.low;
      const isPinbarBull = lowerWick > body * 2 && upperWick < body;
      const isPinbarBear = upperWick > body * 2 && lowerWick < body;

      matrix[tf] = {
        close: currentCandle.close,
        trend,
        zone: isPremium ? 'PREMIUM (Sell Preferred)' : 'DISCOUNT (Buy Preferred)',
        equilibrium: equilibrium.toFixed(2),
        support: recentLow.toFixed(2),
        resistance: recentHigh.toFixed(2),
        ema20: ema20 ? ema20.toFixed(2) : null,
        ema50: ema50 ? ema50.toFixed(2) : null,
        ema200: ema200 ? ema200.toFixed(2) : null,
        rsi: rsi ? rsi.toFixed(1) : null,
        atr: atr ? atr.toFixed(2) : null,
        candlestick: isBullishEngulfing ? 'Bullish Engulfing' : isBearishEngulfing ? 'Bearish Engulfing' : isPinbarBull ? 'Bullish Pinbar (Hammer)' : isPinbarBear ? 'Bearish Pinbar (Shooting Star)' : 'Normal',
      };
    }

    return matrix;
  }

  // 4. Retrieve Comprehensive Trade & Memory History
  static async getTradeAndMemorySummary() {
    const stats = await PredictionRepo.getStats();
    const recentTrades = await TradeRepo.getRecent(10);

    const wins = recentTrades.filter(t => (t.pnl || 0) > 0);
    const losses = recentTrades.filter(t => (t.pnl || 0) < 0);
    const breakEvens = recentTrades.filter(t => (t.pnl || 0) === 0);

    const totalProfit = wins.reduce((acc, t) => acc + (t.pnl || 0), 0);
    const totalLoss = losses.reduce((acc, t) => acc + (t.pnl || 0), 0);

    return {
      totalPredictions: stats.total,
      winRate: stats.winRate,
      winCount: stats.winCount,
      lossCount: stats.lossCount,
      totalPips: stats.totalPips,
      recentTradesCount: recentTrades.length,
      recentWins: wins.length,
      recentLosses: losses.length,
      recentBreakEvens: breakEvens.length,
      recentRealizedPnL: (totalProfit + totalLoss).toFixed(2),
      lastTrades: recentTrades.slice(0, 5).map(t => ({
        ticket: t.ticket || t.id,
        type: t.type,
        lot: t.lot,
        entry: t.entryPrice,
        close: t.closePrice,
        pnl: t.pnl,
        status: t.status,
      })),
    };
  }

  // 5. Build Complete Institutional Knowledge Context for DeepSeek
  static async buildFullContext({ chatId, orchestrator, primarySymbol = 'XAUUSD' }) {
    const summary = await orchestrator.getStatusSummary();
    const exactPrice = Number(marketFeed.getLatestPrice(primarySymbol) || 4518.74);
    const session = getCurrentSessionInfo();
    const technicalMatrix = this.getMultiTimeframeAnalysis(primarySymbol);
    const tradeHistory = await this.getTradeAndMemorySummary();
    const openPositions = await orchestrator.getOpenPositions();
    const recentChat = this.getChatHistory(chatId, 8);
    const macroEngine = require('../market-data/macroEngine');
    const macroSnapshot = macroEngine.getMacroSnapshot();

    // SMT Divergence Check between 15m Gold and Silver
    const gold15m = candleManager.getCandles(primarySymbol, '15m');
    const silver15m = candleManager.getCandles('XAGUSD', '15m');
    const smtDivergence = macroEngine.detectSMTDivergence(gold15m, silver15m);

    return {
      asset: primarySymbol,
      livePrice: exactPrice,
      broker: {
        server: orchestrator.executionMode === 'metaapi' ? 'Exness-MT5Trial16' : 'Paper Engine',
        balance: summary.account.balance,
        equity: summary.account.equity,
        floatingPnl: summary.account.floatingPnl || 0,
        margin: summary.account.margin || 0,
        freeMargin: summary.account.freeMargin || summary.account.balance,
        leverage: '1:2000',
      },
      openPositions: openPositions.map(p => ({
        ticket: p.ticket || p.id,
        type: p.type,
        volume: p.volume || p.lot,
        openPrice: p.openPrice || p.price,
        sl: p.stopLoss,
        tp: p.takeProfit,
        profit: p.profit || 0,
      })),
      marketSession: {
        sessionName: session.marketSession,
        killzone: session.activeKillzone ? session.activeKillzone.name : 'Standard Liquidity Window',
        utcTime: session.utcTime,
        isWeekend: session.isWeekend,
        minutesToFridayClose: session.minutesToFridayClose,
      },
      technicalMatrix,
      macroSnapshot,
      smtDivergence,
      tradeHistory,
      recentChat,
    };
  }
}

module.exports = AgentMemory;

