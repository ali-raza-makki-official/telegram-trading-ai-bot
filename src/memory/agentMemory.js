const fs = require('fs');
const path = require('path');
const { TradeRepo, PredictionRepo, SettingsRepo } = require('../database');
const candleManager = require('../market-data/candleManager');
const marketFeed = require('../market-data/marketFeed');
const { getCurrentSessionInfo } = require('../strategies/ict/killzones');
const { calculateEMA, calculateRSI, calculateATR } = require('../indicators');
const config = require('../config');
const logger = require('../utils/logger');

const HISTORY_FILE = path.resolve(process.cwd(), 'data', 'conversation_history.json');

// Persistent Chat History Store
let persistentHistories = {};

function loadHistories() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
      persistentHistories = JSON.parse(raw);
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed loading conversation_history.json, starting fresh');
    persistentHistories = {};
  }
}

function saveHistories() {
  try {
    const dir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(persistentHistories, null, 2), 'utf8');
  } catch (err) {
    logger.error({ err: err.message }, 'Failed saving conversation_history.json');
  }
}

// Initial load
loadHistories();

class AgentMemory {
  // 1. Record conversation turn (Persistent Long-Term Memory)
  static addChatMessage(chatId, role, content) {
    if (!chatId || !content) return;
    const key = String(chatId);
    if (!persistentHistories[key]) {
      persistentHistories[key] = [];
    }
    persistentHistories[key].push({
      role,
      content,
      timestamp: Date.now(),
      isoTime: new Date().toISOString(),
    });

    // Retain up to 200 messages per user for deep context
    if (persistentHistories[key].length > 200) {
      persistentHistories[key].shift();
    }

    saveHistories();
  }

  // 2. Retrieve recent & long-term chat context
  static getChatHistory(chatId, limit = 20) {
    if (!chatId) return [];
    const key = String(chatId);
    if (!persistentHistories[key]) return [];
    return persistentHistories[key].slice(-limit);
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

      const rawEma20 = calculateEMA(closes, 20);
      const rawEma50 = calculateEMA(closes, 50);
      const rawEma200 = calculateEMA(closes, Math.min(200, closes.length - 1));
      const rawRsi = calculateRSI(closes, 14);
      const rawAtr = calculateATR(candles, 14);

      const ema20Val = Array.isArray(rawEma20) ? rawEma20[rawEma20.length - 1] : rawEma20;
      const ema50Val = Array.isArray(rawEma50) ? rawEma50[rawEma50.length - 1] : rawEma50;
      const ema200Val = Array.isArray(rawEma200) ? rawEma200[rawEma200.length - 1] : rawEma200;
      const rsiVal = Array.isArray(rawRsi) ? rawRsi[rawRsi.length - 1] : rawRsi;
      const atrVal = Array.isArray(rawAtr) ? rawAtr[rawAtr.length - 1] : rawAtr;

      const isBullishStructure = closes[closes.length - 1] > closes[0];
      const isHigherHigh = currentCandle.high > prevCandle.high;
      const isHigherLow = currentCandle.low > prevCandle.low;

      matrix[tf] = {
        lastClose: currentCandle.close,
        trend: isBullishStructure ? 'BULLISH' : 'BEARISH',
        structure: isHigherHigh && isHigherLow ? 'BULLISH_EXPANSION' : 'CONSOLIDATION',
        ema20: ema20Val ? Number(ema20Val.toFixed(2)) : null,
        ema50: ema50Val ? Number(ema50Val.toFixed(2)) : null,
        ema200: ema200Val ? Number(ema200Val.toFixed(2)) : null,
        rsi: rsiVal ? Number(rsiVal.toFixed(2)) : null,
        atr: atrVal ? Number(atrVal.toFixed(2)) : null,
      };
    }

    return matrix;
  }

  // 4. Retrieve Comprehensive Context for LLM Reasoning
  static async getComprehensiveContext({ symbol = config.system.primarySymbol, chatId = null }) {
    const livePrice = Number(marketFeed.getLatestPrice(symbol) || 4580.0);
    const sessionInfo = getCurrentSessionInfo();
    const correlatedData = marketFeed.getCorrelatedData();
    const multiTf = this.getMultiTimeframeAnalysis(symbol);

    let recentTrades = [];
    let recentPredictions = [];
    let learnedSkills = {};

    try {
      recentTrades = await TradeRepo.getRecent(5);
      recentPredictions = await PredictionRepo.getRecent(5);
    } catch {}

    try {
      const postTradeLearner = require('../orchestrator/postTradeLearner');
      learnedSkills = postTradeLearner.getSkillsSummary();
    } catch {}

    const chatHistory = chatId ? this.getChatHistory(chatId, 25) : [];

    return {
      asset: symbol,
      livePrice,
      session: sessionInfo,
      macroCorrelation: correlatedData,
      timeframeMatrix: multiTf,
      recentTrades,
      recentPredictions,
      learnedSkills,
      conversationHistory: chatHistory,
    };
  }

  // 5. Build Full Context (Chat Memory + Broker State + Technicals)
  static async buildFullContext({ chatId = null, orchestrator = null, primarySymbol = config.system.primarySymbol }) {
    const base = await this.getComprehensiveContext({ symbol: primarySymbol, chatId });
    let broker = { balance: 463.68, equity: 463.68, openPositionsCount: 0 };
    let openPositions = [];

    if (orchestrator) {
      try {
        broker = await orchestrator.getAccountSummary();
        openPositions = await orchestrator.getOpenPositions();
      } catch {}
    }

    return {
      broker,
      openPositions,
      technicalMatrix: base.timeframeMatrix,
      macroSnapshot: base.macroCorrelation,
      marketSession: base.session,
      conversationHistory: base.conversationHistory,
      recentTrades: base.recentTrades,
      learnedSkills: base.learnedSkills,
    };
  }
}

module.exports = AgentMemory;
