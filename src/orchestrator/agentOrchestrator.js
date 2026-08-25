const crypto = require('crypto');
const config = require('../config');
const { initDatabase, PredictionRepo, TradeRepo, SettingsRepo } = require('../database');
const candleManager = require('../market-data/candleManager');
const marketFeed = require('../market-data/marketFeed');
const { scoreConfluence } = require('../strategies/confluence/confluenceScorer');
const { getCurrentSessionInfo } = require('../strategies/ict/killzones');
const llmManager = require('../llm/llmManager');
const accuracyTracker = require('../evaluator/accuracyTracker');
const riskManager = require('../risk/riskManager');
const paperTrading = require('../execution/PaperTradingEngine');
const metaApiClient = require('../execution/MetaApiClient');
const mt5Bridge = require('../execution/MT5BridgeClient');
const marketScheduler = require('../scheduler/marketScheduler');
const TelegramBotService = require('../telegram/bot');
const logger = require('../utils/logger');

class AgentOrchestrator {
  constructor() {
    this.autonomyMode = config.system.autonomyMode;
    this.executionMode = config.system.executionMode;
    this.isPaused = config.system.isPaused;
    this.primarySymbol = config.system.primarySymbol;
    this.latestBias = 'NEUTRAL';
    this.latestThesis = null;
    this.telegram = new TelegramBotService(this);
  }

  async initialize() {
    logger.info('Initializing Autonomous Trading Agent Core...');

    // 1. Initialize Database & Repositories
    // FIX #15: await initDatabase so schema migration completes before first DB operation
    await initDatabase();

    // 2. Load dynamic settings from DB
    const savedMode = await SettingsRepo.get('autonomy_mode');
    if (savedMode) this.autonomyMode = savedMode;

    // FIX #9a: Load isPaused from DB so pause state survives restarts
    const savedPaused = await SettingsRepo.get('is_paused');
    if (savedPaused !== null && savedPaused !== undefined) {
      this.isPaused = Boolean(savedPaused);
      if (this.isPaused) {
        logger.warn('Bot started in PAUSED state (restored from database). Use /resume to activate.');
      }
    }

    // 3. Initialize Execution Layer (Paper / MetaApi Cloud / MT5 TCP)
    if (this.executionMode === 'paper') {
      await paperTrading.init();
    } else if (this.executionMode === 'metaapi') {
      try {
        await metaApiClient.connect();
        const initialPrice = await metaApiClient.getLivePrice();
        if (initialPrice) {
          marketFeed.latestPrices.set(this.primarySymbol, initialPrice.bid);
          marketFeed.latestPrices.set('XAUUSD', initialPrice.bid);
          marketFeed.latestPrices.set('XAUUSDm', initialPrice.bid);
        }
      } catch (connErr) {
        logger.warn({ err: connErr.message }, 'MetaApi initial connection timed out. Background auto-reconnect will continue while terminal is live.');
      }

      metaApiClient.on('tick', ({ symbol, price, bid }) => {
        const live = price || bid;
        marketFeed.latestPrices.set(symbol, live);
        marketFeed.latestPrices.set(this.primarySymbol, live);
        marketFeed.latestPrices.set('XAUUSD', live);
        marketFeed.latestPrices.set('XAUUSDm', live);

        // Update active live bar in candleManager
        for (const tf of config.system.timeframes) {
          candleManager.updateOngoingCandle(this.primarySymbol, tf, live);
        }
      });
    } else if (this.executionMode === 'mt5') {
      mt5Bridge.connect();
    }

    // 4. Initialize Market Feed
    await marketFeed.start();

    // 5. Connect Tick Events
    marketFeed.on('tick', async ({ symbol, price }) => {
      if (this.executionMode === 'paper') {
        await paperTrading.onTick(symbol, price);
      }
    });

    // 6. Connect Scheduler Events
    marketScheduler.on('candleClose', async ({ timeframe }) => {
      if (!this.isPaused) {
        await this.handleCandleClose(timeframe);
      }
    });

    // 6b. Connect Smart Price Zone & Liquidity Triggers (Zero-Token Local Check)
    marketFeed.on('priceZoneTriggered', async ({ zones, currentPrice }) => {
      if (this.isPaused) return;
      for (const zone of zones) {
        logger.info({ zoneId: zone.id, type: zone.type, price: currentPrice }, '🎯 [Orchestrator] Smart Price Zone Activated! Initiating Target Re-Analysis...');
        
        try {
          const autonomousCore = require('./autonomousAgentCore');
          const decision = await autonomousCore.thinkAndDecide({
            userQuery: `Price has reached target ${zone.type} zone [${zone.minPrice} - ${zone.maxPrice}] at $${currentPrice.toFixed(2)}. ${zone.description}. Re-analyze structure and execute or request approval.`,
            chatId: this.telegram?.adminChatId,
            orchestrator: this,
            triggerSource: 'PRICE_ZONE_ACTIVATION',
            isExplicitAnalysis: true,
          });

          if (this.autonomyMode === 'auto' && decision.action_type === 'EXECUTE_TRADE' && decision.trade_decision) {
            const td = decision.trade_decision;
            await this.executeManualTrade({
              symbol: this.primarySymbol,
              type: td.action.toUpperCase(),
              lot: td.lot || 0.01,
              sl: td.sl || null,
              tp: td.tp || null,
            });
            await this.telegram.broadcastAlert(
              `⚡ *Auto-Executed on Price Zone Hit!*\n\n• Target Zone: \`${zone.type} [${zone.minPrice} - ${zone.maxPrice}]\`\n• Trigger Price: \`$${currentPrice.toFixed(2)}\`\n• Order: *${td.action.toUpperCase()}* (${td.lot || 0.01} Lot)\n• Rationale: _${td.rationale}_`
            );
          } else if (this.telegram?.adminChatId) {
            await this.telegram.broadcastAlert(
              `🎯 *Smart Price Level Hit (${zone.type})!*\n\n• Price: \`$${currentPrice.toFixed(2)} USD\`\n• Monitored Zone: \`$${zone.minPrice} - $${zone.maxPrice}\`\n• Setup: _${zone.description}_\n\n🤖 *AI Re-Analysis:* \n${decision.reply}`
            );
          }
        } catch (zoneErr) {
          logger.error({ err: zoneErr.message }, 'Failed processing price zone trigger re-analysis');
        }
      }
    });

    marketScheduler.on('killzoneEnter', async (kz) => {
      logger.info({ kz: kz.name }, 'ICT Killzone Event');
      await this.telegram.broadcastAlert(`🔔 *ICT Killzone Active:* ${kz.name}`);
    });

    marketScheduler.on('fridayCloseWarning', async ({ message }) => {
      await this.telegram.broadcastAlert(message);
    });

    // 7. Start Scheduler
    marketScheduler.start();

    // 8. Start Real-Time Trade Monitor (Auto Break-Even & Trailing Stop)
    const tradeMonitor = require('../risk/tradeMonitor');
    tradeMonitor.start(this);

    // 9. Start Telegram Bot
    await this.telegram.init();
    await this.telegram.start();

    logger.info(`Trading Agent initialized and running successfully with [${this.executionMode.toUpperCase()}] execution engine!`);
  }


  // Master Pipeline triggered on Candle Close
  async handleCandleClose(timeframe) {
    const symbol = this.primarySymbol;
    const sessionInfo = getCurrentSessionInfo();

    // Zero-token Weekend & Market Close Guard
    if (sessionInfo.isWeekend) {
      logger.debug('Weekend detected (market closed). Skipping background AI candle processing.');
      return;
    }

    if (this.isPaused) {
      logger.debug('Trading agent paused. Skipping background AI candle processing.');
      return;
    }

    const currentPrice = marketFeed.getLatestPrice(symbol);
    logger.info({ symbol, timeframe, currentPrice, session: sessionInfo.marketSession }, 'Processing candle close cycle');

    // 1. Reconcile past predictions against recent price action
    try {
      await accuracyTracker.reconcilePendingPredictions();
    } catch (err) {
      logger.error({ err: err.message }, 'Accuracy reconciliation error');
    }

    // 2. Gather multi-timeframe candles snapshot
    const candlesByTimeframe = candleManager.getMultiTimeframeSnapshot(symbol);
    const correlatedData = marketFeed.getCorrelatedData();

    // 3. Run Deterministic Confluence & Technical Analysis Engine
    const confluence = scoreConfluence({
      symbol,
      candlesByTimeframe,
      correlatedData,
    });

    this.latestBias = confluence.bias;

    // Auto-Register SMC/ICT Order Blocks, FVGs & Liquidity zones to Smart Price Trigger Engine
    try {
      const smartTrigger = require('./smartPriceTriggerEngine');
      smartTrigger.registerFromAnalysis({
        symbol,
        smcData: confluence.smc,
        ictData: confluence.ict,
        currentPrice,
      });
    } catch (regErr) {
      logger.debug({ err: regErr.message }, 'Failed registering price trigger zones');
    }

    // 4. Check if confluence threshold is reached for LLM escalation
    if (!confluence.isActionable || confluence.confidence < config.strategy.minConfluenceScore) {
      logger.debug({ score: confluence.score, confidence: confluence.confidence }, 'Confluence below threshold, skipping AI escalation');
      return;
    }

    logger.info({ score: confluence.score, bias: confluence.bias, confidence: confluence.confidence }, 'High confluence detected. Escalating to LLM Reasoning Layer...');

    // 5. Escalate to LLM Reasoning Layer
    const thesis = await llmManager.synthesizeTradeThesis({
      symbol,
      currentPrice,
      confluenceData: confluence,
      sessionInfo,
    });

    this.latestThesis = thesis;

    if (thesis.bias === 'NEUTRAL' || thesis.confidence < config.strategy.minConfluenceScore) {
      logger.info({ bias: thesis.bias, confidence: thesis.confidence }, 'LLM determined Neutral or low confidence');
      return;
    }

    // 6. Log AI Prediction to Database
    const predictionId = crypto.randomUUID();
    await PredictionRepo.save({
      id: predictionId,
      symbol,
      timeframe,
      timestamp: Date.now(),
      bias: thesis.bias,
      confidence: thesis.confidence,
      priceAtPrediction: currentPrice,
      suggestedSl: thesis.suggested_sl,
      suggestedTp1: thesis.suggested_tp1,
      suggestedTp2: thesis.suggested_tp2,
      invalidationLevel: thesis.invalidation_level,
      riskRewardRatio: thesis.risk_reward_ratio,
      primarySetup: thesis.primary_setup,
      reasoning: thesis.reasoning,
      status: 'PENDING',
    });

    // 7. Route according to Autonomy Mode
    const signalPayload = {
      predictionId,
      symbol,
      timeframe,
      currentPrice,
      thesis,
      confluence,
    };

    if (this.autonomyMode === 'auto') {
      logger.info('Auto mode active: executing trade directly');
      await this.executeApprovedSignal(signalPayload);
    } else if (this.autonomyMode === 'semi') {
      logger.info('Semi-auto mode active: requesting approval via Telegram');
      await this.telegram.sendTradeApprovalRequest(signalPayload);
    } else {
      logger.info('Manual / Analysis mode active: broadcasting thesis without execution');
      await this.telegram.broadcastAlert(`📊 *New Analysis Signal (${thesis.bias}):*\n${thesis.primary_setup}\n${thesis.reasoning}`);
    }
  }

  // Execute an approved trade through Risk Layer & Execution Engine
  async executeApprovedSignal(signal) {
    const symbol = signal.symbol;
    const thesis = signal.thesis;
    const type = thesis.bias === 'BULLISH' ? 'BUY' : 'SELL';
    const entryPrice = signal.currentPrice;
    const sl = thesis.suggested_sl;
    const tp = thesis.suggested_tp1;
    // FIX #31: Store TP2 for reference (partial close / trailing management)
    const tp2 = thesis.suggested_tp2;

    const accountSummary = await this.getAccountSummary();

    // 1. Calculate Risk-Adjusted Lot Size
    const lot = riskManager.calculateLotSize({
      accountBalance: accountSummary.balance,
      entryPrice,
      stopLossPrice: sl,
    });

    // 2. Validate Trade against Risk Rules
    const validation = await riskManager.validateTrade({
      symbol,
      type,
      lot,
      entryPrice,
      sl,
      tp,
      accountBalance: accountSummary.balance,
      dailyPnl: accountSummary.dailyPnl || 0,
    });

    if (!validation.isValid) {
      logger.warn({ reasons: validation.reasons }, 'Trade failed risk validation');
      await this.telegram.broadcastAlert(`⚠️ *Trade Blocked by Risk Manager:*\n${validation.reasons.join('\n')}`);
      return { success: false, reasons: validation.reasons };
    }

    // 3. Send Order to Execution Engine (Paper / MetaApi Cloud / MT5)
    let tradeResult = null;
    if (this.executionMode === 'paper') {
      tradeResult = await paperTrading.openOrder({
        symbol,
        type,
        lot,
        sl,
        tp,
        predictionId: signal.predictionId,
        currentPrice: entryPrice,
      });
    } else if (this.executionMode === 'metaapi') {
      tradeResult = await metaApiClient.openOrder({
        symbol,
        type,
        lot,
        sl,
        tp,
      });
    } else {
      tradeResult = await mt5Bridge.openOrder({
        symbol,
        type,
        lot,
        sl,
        tp,
      });
    }

    // FIX #9b: Null guard — prevent crash if execution engine returns null/undefined
    if (!tradeResult) {
      logger.error({ type, lot, sl, tp }, 'Execution engine returned null — trade may not have opened');
      return { success: false, reasons: ['Execution engine returned no result. Check broker connection.'] };
    }

    logger.info({ ticket: tradeResult.ticket || tradeResult.id, type, lot, tp2 }, 'Trade successfully executed');
    return { success: true, trade: tradeResult };
  }


  async executeManualTrade({ symbol, type, lot, openPrice = null, sl, tp }) {
    const currentPrice = marketFeed.getLatestPrice(symbol);
    const accountSummary = await this.getAccountSummary();

    const validation = await riskManager.validateTrade({
      symbol,
      type: type.replace('_LIMIT', ''),
      lot,
      entryPrice: openPrice || currentPrice,
      sl,
      tp,
      accountBalance: accountSummary.balance,
      dailyPnl: accountSummary.dailyPnl || 0,
    });

    if (!validation.isValid) {
      return { success: false, reasons: validation.reasons };
    }

    let trade = null;
    if (this.executionMode === 'paper') {
      trade = await paperTrading.openOrder({
        symbol,
        type,
        lot,
        sl,
        tp,
        currentPrice: openPrice || currentPrice,
      });
    } else if (this.executionMode === 'metaapi') {
      trade = await metaApiClient.openOrder({ symbol, type, lot, openPrice, sl, tp });
    } else {
      trade = await mt5Bridge.openOrder({ symbol, type, lot, openPrice, sl, tp });
    }

    return { success: true, trade };
  }

  async runOnDemandAnalysis(symbol = this.primarySymbol, timeframe = '15m') {
    const candlesByTimeframe = candleManager.getMultiTimeframeSnapshot(symbol);
    const correlatedData = marketFeed.getCorrelatedData();
    const currentPrice = marketFeed.getLatestPrice(symbol);
    const sessionInfo = getCurrentSessionInfo();

    const confluence = scoreConfluence({
      symbol,
      candlesByTimeframe,
      correlatedData,
    });

    return llmManager.synthesizeTradeThesis({
      symbol,
      currentPrice,
      confluenceData: confluence,
      sessionInfo,
    });
  }

  async getAccountSummary() {
    if (this.executionMode === 'paper') {
      return paperTrading.getAccountSummary();
    } else if (this.executionMode === 'metaapi') {
      return metaApiClient.getAccountSummary();
    } else {
      return mt5Bridge.getAccountSummary();
    }
  }

  async getStatusSummary() {
    const account = await this.getAccountSummary();
    return {
      symbol: this.primarySymbol,
      currentPrice: marketFeed.getLatestPrice(this.primarySymbol),
      autonomyMode: this.autonomyMode,
      executionMode: this.executionMode,
      isPaused: this.isPaused,
      latestBias: this.latestBias,
      session: getCurrentSessionInfo(),
      account,
    };
  }

  async getOpenPositions() {
    if (this.executionMode === 'paper') {
      return Array.from(paperTrading.openPositions.values());
    } else if (this.executionMode === 'metaapi') {
      return metaApiClient.getOpenPositions();
    } else {
      return mt5Bridge.getOpenPositions();
    }
  }

  async closePositionByTicket(ticket) {
    const currentPrice = marketFeed.getLatestPrice(this.primarySymbol);
    if (this.executionMode === 'paper') {
      const pos = Array.from(paperTrading.openPositions.values()).find(p => p.ticket === ticket || p.id === ticket);
      if (!pos) return null;
      return paperTrading.closeOrder(pos.id, currentPrice, 'TELEGRAM_COMMAND');
    } else if (this.executionMode === 'metaapi') {
      return metaApiClient.closeOrder(ticket);
    } else {
      return mt5Bridge.closeOrder(ticket);
    }
  }

  async closeAllPositions() {
    const currentPrice = marketFeed.getLatestPrice(this.primarySymbol);
    if (this.executionMode === 'paper') {
      return paperTrading.closeAll(currentPrice);
    } else if (this.executionMode === 'metaapi') {
      return metaApiClient.closeAll();
    } else {
      const open = await mt5Bridge.getOpenPositions();
      const results = [];
      for (const p of open) {
        results.push(await mt5Bridge.closeOrder(p.ticket));
      }
      return results;
    }
  }

  async setAutonomyMode(mode) {
    this.autonomyMode = mode;
    await SettingsRepo.set('autonomy_mode', mode);
  }

  async setPauseState(paused) {
    this.isPaused = paused;
    await SettingsRepo.set('is_paused', paused);
  }

  getCurrentSession() {
    return getCurrentSessionInfo();
  }

  async getAccuracyReport() {
    return accuracyTracker.getPerformanceReport();
  }

  async shutdown() {
    logger.info('Shutting down Autonomous Trading Agent...');
    marketScheduler.stop();
    marketFeed.stop();
    await this.telegram.stop();
    if (this.executionMode === 'metaapi') {
      await metaApiClient.disconnect();
    } else if (this.executionMode === 'mt5') {
      mt5Bridge.disconnect();
    }
    logger.info('Shutdown complete.');
  }
}

module.exports = new AgentOrchestrator();
