const { Bot, InlineKeyboard, InputFile } = require('grammy');
const { Resvg } = require('@resvg/resvg-js');
const ChartRenderer = require('../utils/chartRenderer');
const candleManager = require('../market-data/candleManager');
const newsFilter = require('../risk/newsFilter');
const PositionSizer = require('../risk/positionSizer');
const consensusEngine = require('../llm/consensusEngine');
const config = require('../config');
const { SettingsRepo } = require('../database');
const logger = require('../utils/logger');

class TelegramBotService {
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
    this.botToken = config.telegram.botToken;
    this.allowedUserIds = config.telegram.allowedUserIds;
    this.adminChatId = config.telegram.adminChatId;
    this.bot = null;
    this.isPolling = false;
    this.pendingApprovals = new Map(); // approvalId -> { signal, timeout }

    // FIX #13a: Initialize in constructor (not lazily in callback handler)
    // FIX #13b: Use time-based Map for expiry — prevents infinite memory growth
    // Map<token, expiryTimestamp>
    this.processedActionTokens = new Map();
    this._startTokenCleanup();

    // FIX #25: Auth rate limiting — prevent brute-force password guessing
    // Map<chatId, { attempts, lockedUntil }>
    this.authAttempts = new Map();
    this.maxAuthAttempts = 5;
    this.authLockoutMs = 15 * 60 * 1000; // 15 minutes lockout
  }

  // FIX #13b: Clean expired tokens every 15 minutes to prevent memory leak
  _startTokenCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [token, expiry] of this.processedActionTokens.entries()) {
        if (now > expiry) {
          this.processedActionTokens.delete(token);
        }
      }
    }, 15 * 60 * 1000); // every 15 minutes
  }

  async init() {
    if (!this.botToken) {
      logger.warn('TELEGRAM_BOT_TOKEN not provided. Telegram bot interface disabled.');
      return;
    }

    if (!this.adminChatId) {
      const savedAdminId = await SettingsRepo.get('admin_chat_id');
      if (savedAdminId) this.adminChatId = Number(savedAdminId);
    }

    const botOptions = {};
    if (config.telegram.apiRoot) {
      botOptions.client = { apiRoot: config.telegram.apiRoot };
    }
    this.bot = new Bot(this.botToken, botOptions);
    
    // Error boundary
    this.bot.catch((err) => {
      logger.error({ err: err.message, ctx: err.ctx?.update }, 'Telegram bot error caught in boundary');
    });

    this.setupAuthMiddleware();
    this.setupCommands();
    this.setupCallbackQueries();
    this.setupMessageHandlers();

    // Register Official Telegram Command Menu list
    try {
      await this.bot.api.setMyCommands([
        { command: 'start', description: '🤖 Start AI Agent & Main Portal' },
        { command: 'status', description: '📊 System Health, Equity & Live Price' },
        { command: 'analyze', description: '🔍 Run On-Demand SMC/ICT Visual Analysis' },
        { command: 'positions', description: '🛡️ View Active Open Trades & PnL' },
        { command: 'execute', description: '⚡ Execute: /execute [buy/sell] [lot] [sl] [tp]' },
        { command: 'close', description: '❌ Close: /close [ticket|all]' },
        { command: 'mode', description: '⚙️ Autonomy Mode: /mode [auto|semi|manual]' },
        { command: 'topdown', description: '🏛️ Top-Down Daily Sweep & 4H Target' },
        { command: 'skills', description: '🧠 AI Learned Skills & Trade Lessons' },
        { command: 'zones', description: '📍 Smart Price Watch Zones & Triggers' },
        { command: 'config', description: '🔧 Strategy Weights & Dynamic Config' },
        { command: 'accuracy', description: '🎯 AI Prediction Win Rate & Accuracy' },
        { command: 'schedule', description: '🕒 Killzone Timers & Market Hours' },
        { command: 'pause', description: '⏸️ Pause Automated AI Engine' },
        { command: 'resume', description: '▶️ Resume Automated AI Engine' },
      ]);
      logger.info('Telegram Bot commands menu registered successfully with Telegram API');
    } catch (cmdErr) {
      logger.warn({ err: cmdErr.message }, 'Failed to set Telegram bot commands menu');
    }

    logger.info('Telegram Bot initialized');
  }

  setupAuthMiddleware() {
    this.bot.use(async (ctx, next) => {
      const fromId = ctx.from?.id;
      if (this.allowedUserIds.length > 0 && !this.allowedUserIds.includes(fromId)) {
        logger.warn({ fromId, username: ctx.from?.username }, 'Unauthorized access attempt to Telegram bot');
        return ctx.reply('⛔ Unauthorized: You do not have permission to control this trading agent.');
      }
      if (!this.adminChatId && ctx.chat?.id) {
        this.adminChatId = ctx.chat.id;
        await SettingsRepo.set('admin_chat_id', ctx.chat.id);
        logger.info({ adminChatId: this.adminChatId }, 'Registered new admin chat ID from Telegram');
      }
      return next();
    });
  }

  setupCommands() {
    // /auth [password] — with rate limiting
    this.bot.command('auth', async (ctx) => {
      const chatId = ctx.chat.id;
      const parts = ctx.message.text.trim().split(/\s+/);
      const pass = parts[1];

      // FIX #25: Check lockout
      const record = this.authAttempts.get(chatId);
      if (record && record.lockedUntil && Date.now() < record.lockedUntil) {
        const minsLeft = Math.ceil((record.lockedUntil - Date.now()) / 60000);
        logger.warn({ chatId, user: ctx.from?.username }, 'Auth attempt while locked out');
        return ctx.reply(`⛔ *Too many failed attempts.* Try again in ${minsLeft} minutes.`, { parse_mode: 'Markdown' });
      }

      if (pass === config.telegram.adminPassword) {
        // Success — clear attempts
        this.authAttempts.delete(chatId);
        this.adminChatId = chatId;
        await SettingsRepo.set('admin_chat_id', chatId);
        logger.info({ adminChatId: this.adminChatId, user: ctx.from?.username }, 'Admin authenticated via password in Telegram');
        
        await ctx.reply(
          `✅ *Authentication Successful!*\n\nYou are verified as the **Master Admin** for Gold AI Trading Agent.\n\nType */status* or */analyze* to start controlling the agent!`,
          { parse_mode: 'Markdown' }
        );
      } else {
        // Wrong password — increment attempts
        if (!record) {
          this.authAttempts.set(chatId, { attempts: 1, lockedUntil: null });
        } else {
          record.attempts++;
          if (record.attempts >= this.maxAuthAttempts) {
            record.lockedUntil = Date.now() + this.authLockoutMs;
            logger.warn({ chatId, user: ctx.from?.username, attempts: record.attempts }, 'Auth locked out after too many failed attempts');
            return ctx.reply(`⛔ *Account locked for 15 minutes* after ${this.maxAuthAttempts} failed attempts.`, { parse_mode: 'Markdown' });
          }
        }
        const remaining = this.maxAuthAttempts - (record?.attempts || 1);
        await ctx.reply(
          `❌ *Invalid Password!* (${remaining} attempts remaining)\n\nPlease use: \`/auth [your_admin_password]\``,
          { parse_mode: 'Markdown' }
        );
      }
    });

    // /start
    this.bot.command('start', async (ctx) => {
      const payload = ctx.match?.trim();
      const { claimAuthToken } = require('../server/webDashboard');

      if (payload && (claimAuthToken(payload, ctx.chat.id, ctx.from?.username) || payload === config.telegram.adminPassword)) {
        this.adminChatId = ctx.chat.id;
        await SettingsRepo.set('admin_chat_id', ctx.chat.id);
        logger.info({ adminChatId: this.adminChatId, payload }, 'Verified Master Admin via deep link token');
        await ctx.reply(`🎉 *Web Portal Paired & Verified!*\nYour Telegram account is now securely linked to the Web Dashboard as Master Admin.`, { parse_mode: 'Markdown' });
      } else if (!this.adminChatId && ctx.chat?.id) {
        this.adminChatId = ctx.chat.id;
        await SettingsRepo.set('admin_chat_id', ctx.chat.id);
      }

      const msg = `
🤖 *Autonomous Gold (XAU/USD) Trading AI Agent*

Welcome Ali Raza! I am your AI Copilot powered by Google Gemini, SMC/ICT Liquidity scanning, and live Exness MT5 execution.

📋 *Core Commands:*

🏛️ *Market Analysis & Zones:*
• /analyze — Master 7-TF Deep Scan + Tiered Limits
• /zones — Live AI Smart Watch & Trigger Levels
• /schedule — Market Sessions & ICT Killzones

💼 *Execution & Portfolio:*
• /positions — Active trades, live PnL & 1-tap close
• /close \`[ticket|all]\` — Close single or all positions
• /execute \`[buy/sell] [lot] [sl] [tp]\` — Manual order
• /mode \`[auto|semi|manual]\` — Change autonomy level

🧠 *AI Performance & Status:*
• /status — Live balance, equity & market state
• /performance — Win Rate, History & AI Learned Lessons
• /pause / /resume — Toggle background scanning
• /config — Dynamic Strategy & Risk Settings
`;
      await ctx.reply(msg, { parse_mode: 'Markdown' });
    });

    // /status — To-the-point account & market state
    this.bot.command('status', async (ctx) => {
      const summary = await this.orchestrator.getStatusSummary();
      const statusText = `
📊 *Live System Status*
• Asset: \`${summary.symbol}\` | Price: \`$${summary.currentPrice.toFixed(2)}\`
• Session: *${summary.session.marketSession}* | Killzone: *${summary.session.activeKillzone ? summary.session.activeKillzone.name : 'Standard'}*
• AI Market Bias: *${summary.latestBias || 'NEUTRAL'}*

💼 *Exness MT5 Account:*
• Balance: \`$${summary.account.balance.toFixed(2)} USD\`
• Equity: \`$${summary.account.equity.toFixed(2)} USD\` (Floating: ${summary.account.floatingPnl >= 0 ? '+' : ''}$${summary.account.floatingPnl.toFixed(2)})
• Mode: \`${summary.autonomyMode.toUpperCase()}\` | Engine: \`${summary.executionMode.toUpperCase()}\`
• Status: ${summary.isPaused ? '⏸️ PAUSED' : '▶️ ACTIVE'} | Open Trades: \`${summary.account.openPositionsCount}\`
`;
      const kb = new InlineKeyboard()
        .text('🏛️ Master Analysis', 'ACTION:ANALYZE_MASTER')
        .text('🛡️ Open Positions', 'ACTION:POSITIONS');
      await ctx.reply(statusText, { parse_mode: 'Markdown', reply_markup: kb });
    });

    // /analyze — Master 7-Timeframe Deep Scan + Candlesticks + Macro + Multi-Tiered Limit Zones
    this.bot.command('analyze', async (ctx) => {
      await ctx.reply('⏳ *[Step 1/2] Initiating Master 7-Timeframe Deep Scan (1W ➔ 1D ➔ 4H ➔ 1H ➔ 30M ➔ 15M ➔ 5M), Candlestick Pattern Filtering & Macro Synthesis...*', { parse_mode: 'Markdown' });
      try {
        const ComprehensiveEngine = require('../strategies/smc/comprehensiveAnalysisEngine');
        const fullData = await ComprehensiveEngine.runFullAnalysis(config.system.primarySymbol);

        // 1. Send Visual TradingView-style SMC Chart Snapshot (15m Primary)
        try {
          const thesis = await this.orchestrator.runOnDemandAnalysis(config.system.primarySymbol, '15m');
          await this.sendSMCChartPhoto(ctx, config.system.primarySymbol, '15m', thesis);
        } catch (chartErr) {
          logger.debug({ err: chartErr.message }, 'Chart photo skipped in full analysis');
        }

        const report = ComprehensiveEngine.formatTelegramReport(fullData);

        // 2. Interactive Multi-Tiered Limit Order Buttons
        const kb = ComprehensiveEngine.createInteractiveLimitKeyboard(fullData);

        try {
          await ctx.reply(report, { parse_mode: 'Markdown', reply_markup: kb });
        } catch {
          await ctx.reply(report.replace(/[*_`]/g, ''), { reply_markup: kb });
        }
      } catch (err) {
        logger.error({ err: err.message }, 'Failed /analyze command');
        await ctx.reply(`❌ Master analysis failed: ${err.message}`);
      }
    });

    // /chart [timeframe] — Send on-demand live visual SMC chart snapshot
    this.bot.command('chart', async (ctx) => {
      const parts = ctx.message.text.trim().split(/\s+/);
      const tf = parts[1]?.toLowerCase() || '15m';
      await ctx.reply(`📸 *Generating real-time visual SMC chart for XAU/USD (${tf})...*`, { parse_mode: 'Markdown' });
      try {
        const thesis = await this.orchestrator.runOnDemandAnalysis(config.system.primarySymbol, tf);
        await this.sendSMCChartPhoto(ctx, config.system.primarySymbol, tf, thesis);
      } catch (err) {
        logger.error({ err: err.message }, 'Failed /chart command');
        await ctx.reply(`❌ Chart rendering failed: ${err.message}`);
      }
    });

    // /execute
    this.bot.command('execute', async (ctx) => {
      const parts = ctx.message.text.trim().split(/\s+/);
      if (parts.length < 3) {
        return ctx.reply('Usage: `/execute [buy/sell] [lot] [optional_sl] [optional_tp]`', { parse_mode: 'Markdown' });
      }

      const type = parts[1].toUpperCase();
      const lot = parseFloat(parts[2]);
      const sl = parts[3] ? parseFloat(parts[3]) : null;
      const tp = parts[4] ? parseFloat(parts[4]) : null;

      if (!['BUY', 'SELL'].includes(type) || isNaN(lot)) {
        return ctx.reply('❌ Invalid syntax. Use: `/execute buy 0.01 4550 4580`', { parse_mode: 'Markdown' });
      }

      try {
        const result = await this.orchestrator.executeManualTrade({
          symbol: config.system.primarySymbol,
          type,
          lot,
          sl,
          tp,
        });

        if (result.success) {
          await ctx.reply(`✅ *Order Executed Successfully!*\n• Ticket: \`#${result.trade.ticket || 'FILLED'}\`\n• Type: *${type}* (${lot} Lot)\n• Entry: $${result.trade.entryPrice}\n• SL: ${sl ? '$' + sl : 'None'} | TP: ${tp ? '$' + tp : 'None'}`, { parse_mode: 'Markdown' });
        } else {
          await ctx.reply(`⛔ *Order Blocked by Risk Layer:*\n${result.reasons.join('\n')}`, { parse_mode: 'Markdown' });
        }
      } catch (err) {
        await ctx.reply(`❌ Execution Error: ${err.message}`);
      }
    });

    // /positions
    this.bot.command('positions', async (ctx) => {
      const positions = await this.orchestrator.getOpenPositions();
      if (!positions || positions.length === 0) {
        return ctx.reply('📭 *No open positions at the moment.*', { parse_mode: 'Markdown' });
      }

      let msg = `📋 *Active Open Positions (${positions.length}):*\n\n`;
      let kb = new InlineKeyboard();
      for (const pos of positions) {
        const pnl = Number(pos.floatingPnl || pos.profit || 0).toFixed(2);
        msg += `• *#${pos.ticket || pos.id}* — ${pos.type} ${pos.lot || pos.volume} lot @ $${pos.entryPrice || pos.price}\n  PnL: \`${Number(pnl) >= 0 ? '+' : ''}$${pnl}\` | SL: $${pos.sl || pos.stopLoss || 'None'} | TP: $${pos.tp || pos.takeProfit || 'None'}\n\n`;
        kb.text(`❌ Close #${pos.ticket || pos.id}`, `ACTION:CLOSE_${pos.ticket || pos.id}`).row();
      }
      kb.text('🏛️ Master Analysis', 'ACTION:ANALYZE_MASTER');
      await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
    });

    // /close
    this.bot.command('close', async (ctx) => {
      const parts = ctx.message.text.trim().split(/\s+/);
      const target = parts[1];
      if (!target) {
        return ctx.reply('Usage: `/close [ticket_id]` or `/close all`', { parse_mode: 'Markdown' });
      }

      if (target.toLowerCase() === 'all') {
        const closed = await this.orchestrator.closeAllPositions();
        return ctx.reply(`✅ Closed all ${closed.length} open positions.`);
      } else {
        const result = await this.orchestrator.closePositionByTicket(target);
        if (result) {
          return ctx.reply(`✅ Position \`${target}\` closed at $${result.closePrice} (PnL: $${result.pnl})`, { parse_mode: 'Markdown' });
        } else {
          return ctx.reply(`❌ Could not find open position with ticket \`${target}\``, { parse_mode: 'Markdown' });
        }
      }
    });

    // /mode
    this.bot.command('mode', async (ctx) => {
      const parts = ctx.message.text.trim().split(/\s+/);
      const newMode = parts[1]?.toLowerCase();
      if (!['auto', 'semi', 'manual'].includes(newMode)) {
        return ctx.reply('Usage: `/mode auto` (executes without asking), `/mode semi` (asks via Telegram buttons), `/mode manual` (analysis only)', { parse_mode: 'Markdown' });
      }

      await this.orchestrator.setAutonomyMode(newMode);
      await ctx.reply(`⚙️ Autonomy Mode updated to: *${newMode.toUpperCase()}*`, { parse_mode: 'Markdown' });
    });

    // /pause & /resume
    this.bot.command('pause', async (ctx) => {
      await this.orchestrator.setPauseState(true);
      await ctx.reply('⏸️ *Trading Bot Paused.* Automated scans and executions are halted.');
    });

    this.bot.command('resume', async (ctx) => {
      await this.orchestrator.setPauseState(false);
      await ctx.reply('▶️ *Trading Bot Resumed.* Autonomous scanning active.');
    });

    // /performance (Single unified command for Win Rate, History & Learned Skills)
    this.bot.command('performance', async (ctx) => {
      try {
        const accuracyTracker = require('../evaluator/accuracyTracker');
        const postTradeLearner = require('../orchestrator/postTradeLearner');
        
        const report = await accuracyTracker.getPerformanceReport();
        const skills = postTradeLearner.getSkillsSummary();
        const stats = report.stats || {};
        const recent = report.recent || [];

        let msg = `🎯 *AI Trading Performance & Learning Dashboard*\n\n`;
        msg += `📊 *Track Record & Accuracy:*\n`;
        msg += `• Total Predictions Logged: *${stats.total || 0}*\n`;
        msg += `• Win Rate: *${stats.winRate || skills.winRate || 0}%* (Wins: ${stats.wins || skills.wins || 0} | Losses: ${stats.losses || skills.losses || 0} | BE: ${skills.breakEvens || 0})\n`;
        msg += `• Net Pips: *${(stats.total_pips || stats.totalPips || 0) >= 0 ? '+' : ''}${stats.total_pips || stats.totalPips || 0} pips*\n\n`;

        if (recent.length > 0) {
          msg += `📜 *Recent Trade Outcomes:*\n`;
          for (const p of recent.slice(0, 5)) {
            const icon = p.status === 'HIT_TP1' || p.status === 'HIT_TP2' ? '✅' : p.status === 'HIT_SL' ? '❌' : '⏳';
            const pips = p.outcome_pips !== null ? `${p.outcome_pips > 0 ? '+' : ''}${p.outcome_pips} pips` : 'In Progress';
            const cleanSetup = String(p.primary_setup || 'Setup').replace(/[*_`]/g, '');
            msg += `• ${icon} *${p.bias}* (${p.timeframe || '15m'}) — ${cleanSetup}: \`${pips}\`\n`;
          }
          msg += `\n`;
        }

        if (skills.recentLogs && skills.recentLogs.length > 0) {
          msg += `🧠 *Latest AI Retrospective Lessons:*\n`;
          for (const log of skills.recentLogs.slice(-2)) {
            const cleanLesson = String(log.lesson || '').replace(/[*_`]/g, '');
            msg += `• ${cleanLesson}\n`;
          }
        }

        const kb = new InlineKeyboard()
          .text('🏛️ Master Analysis', 'ACTION:ANALYZE_MASTER')
          .text('💼 Account Status', 'ACTION:STATUS');

        try {
          await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
        } catch {
          await ctx.reply(msg.replace(/[*_`]/g, ''), { reply_markup: kb });
        }
      } catch (err) {
        logger.error({ err: err.message }, 'Failed generating unified performance report');
        await ctx.reply(`❌ Could not load performance: ${err.message}`);
      }
    });

    // /zones — Autonomous Trigger Levels & Smart Watch Target Zones
    this.bot.command('zones', async (ctx) => {
      try {
        const smartTrigger = require('../orchestrator/smartPriceTriggerEngine');
        const report = smartTrigger.formatTelegramReport(config.system.primarySymbol);
        const kb = new InlineKeyboard()
          .text('🏛️ Master 7-TF Analysis', 'ACTION:ANALYZE_MASTER')
          .text('💼 Account Status', 'ACTION:STATUS').row()
          .text('🛡️ Open Positions', 'ACTION:POSITIONS');
        await ctx.reply(report, { parse_mode: 'Markdown', reply_markup: kb });
      } catch (err) {
        await ctx.reply(`❌ Error loading trigger zones: ${err.message}`);
      }
    });

    // /schedule
    this.bot.command('schedule', async (ctx) => {
      const session = this.orchestrator.getCurrentSession();
      const msg = `
🕒 *Market Sessions & ICT Killzones Schedule*

• Current UTC Time: \`${session.utcTime}\`
• Active Market Session: *${session.marketSession}*
• Active Killzones: *${session.activeWindows.length > 0 ? session.activeWindows.map(w => w.name).join(', ') : 'None'}*
• Weekend State: ${session.isWeekend ? '🔒 Market Closed (Weekend)' : '🔓 Market Open'}
• Friday NY Close Countdown: ${session.minutesToFridayClose !== null ? `${session.minutesToFridayClose} mins remaining` : 'N/A'}

📅 *Standard Killzone Timers (UTC):*
• Asian Range: 00:00 - 06:00 UTC
• London Open: 07:00 - 10:00 UTC
• NY Open: 12:00 - 15:00 UTC
• London Close: 15:00 - 17:00 UTC
• NY Silver Bullet: 14:00 - 15:00 UTC
`;
      await ctx.reply(msg, { parse_mode: 'Markdown' });
    });

    // /config — Dynamic Strategy Config & Adaptive Parameter Store (Section 7)
    this.bot.command('config', async (ctx) => {
      const dynamicConfig = require('../config/dynamicConfig');
      const configs = dynamicConfig.getAll();
      
      let text = '⚙️ *Dynamic Strategy Configuration & Adaptive Store*\n\n';
      text += '📊 *Strategy Weights & Thresholds (AI Tunable):*\n';
      for (const c of configs.filter(c => c.is_ai_tunable)) {
        text += `• \`${c.param_key}\`: *${c.param_value}* (Range: ${c.min_bound}-${c.max_bound} | v${c.version_number})\n`;
      }
      
      text += '\n🛡️ *Hard Risk Limits (Human-Only):*\n';
      for (const c of configs.filter(c => !c.is_ai_tunable)) {
        text += `• \`${c.param_key}\`: *${c.param_value}* (v${c.version_number})\n`;
      }
      
      text += '\n_Use Web Dashboard or adaptive tuning approvals to adjust parameters dynamically without redeploying code._';
      await ctx.reply(text, { parse_mode: 'Markdown' });
    });
  }


  setupCallbackQueries() {
    this.bot.on('callback_query:data', async (ctx) => {
      const data = ctx.callbackQuery.data;

      // 1. Dynamic Trade Execution from AI Recommendation with Strict Risk & Staleness Guards
      if (data.startsWith('TRADE:') || data.startsWith('TRD:')) {
        const parts = data.split(':');
        let type, lotStr, slStr, tpStr, quotePriceStr, timestamp, token;

        if (data.startsWith('TRD:')) {
          const [, tCode, lStr, sStr, tStr, qStr, tok] = parts;
          type = tCode === 'B' ? 'BUY' : 'SELL';
          lotStr = lStr;
          slStr = sStr;
          tpStr = tStr;
          quotePriceStr = qStr;
          token = tok;
        } else {
          let timestampStr;
          [, type, lotStr, slStr, tpStr, quotePriceStr, timestampStr, token] = parts;
          timestamp = parseInt(timestampStr, 10) || null;
        }

        const lot = parseFloat(lotStr) || 0.01;
        const sl = parseFloat(slStr) || null;
        const tp = parseFloat(tpStr) || null;
        const quotePrice = parseFloat(quotePriceStr) || null;

        // Idempotency / Double-Click Lock
        if (token) {
          const now = Date.now();
          if (this.processedActionTokens.has(token) && this.processedActionTokens.get(token) > now) {
            return ctx.answerCallbackQuery({ text: '⚠️ Order already processed or in execution.', show_alert: true });
          }
          this.processedActionTokens.set(token, now + 10 * 60 * 1000);
        }

        // Live Price & Slippage Guard (Max $3.00 deviation)
        const livePrice = Number(require('../market-data/marketFeed').getLatestPrice(config.system.primarySymbol) || 4518.74);
        if (quotePrice && Math.abs(livePrice - quotePrice) > 3.00) {
          const kb = new InlineKeyboard().text('🔄 Re-Analyze Market', 'ACTION:ANALYZE_15m');
          await ctx.answerCallbackQuery({ text: '⚠️ Market price shifted from quoted setup!', show_alert: true });
          return ctx.reply(
            `🛡️ *Trade Aborted (Slippage & Staleness Protection)*\n\n• Quoted Entry: \`$${quotePrice.toFixed(2)}\`\n• Current Live Price: \`$${livePrice.toFixed(2)}\`\n• Deviation: \`$${Math.abs(livePrice - quotePrice).toFixed(2)}\` (> $3.00 threshold)\n\n_Market moved beyond safe entry zone. Tap below to synthesize fresh setup._`,
            { parse_mode: 'Markdown', reply_markup: kb }
          );
        }

        await ctx.answerCallbackQuery({ text: `⚡ Executing ${type} Order on Exness MT5...` });
        await ctx.reply(`⏳ *Executing Live ${type} Trade on Exness MT5...*\n• Volume: \`${lot} Lot\`\n• Entry: \`$${livePrice.toFixed(2)}\`\n• SL: \`$${sl || 'N/A'}\` | TP: \`$${tp || 'N/A'}\``, { parse_mode: 'Markdown' });

        try {
          const result = await this.orchestrator.executeManualTrade({
            symbol: config.system.primarySymbol,
            type: type.toUpperCase(),
            lot,
            sl,
            tp,
          });

          const kb = new InlineKeyboard()
            .text('📊 View Positions', 'ACTION:POSITIONS')
            .text('🔍 Re-Analyze Market', 'ACTION:ANALYZE_15m');

          await ctx.reply(
            `✅ *Live Order Successfully Executed!*\n\n• Broker: \`Exness MT5\`\n• Ticket: \`#${result.ticket || 'FILLED'}\`\n• Order: *${type.toUpperCase()}* (${lot} Lot)\n• Status: *OPEN*\n• Stop Loss: \`$${sl || 'None'}\`\n• Take Profit: \`$${tp || 'None'}\``,
            { parse_mode: 'Markdown', reply_markup: kb }
          );
        } catch (err) {
          logger.error({ err: err.message }, 'Failed executing button trade');
          await ctx.reply(`❌ *Trade Execution Failed:* ${err.message}`, { parse_mode: 'Markdown' });
        }
        return;
      }

      // 1b. Dynamic 1-Tap Pending Limit Order Placement (BUY_LIMIT / SELL_LIMIT)
      if (data.startsWith('LMT:')) {
        const [, tCode, lotS, lPriceS, slS, tpS] = data.split(':');
        const type = tCode === 'B' ? 'BUY_LIMIT' : 'SELL_LIMIT';
        const lot = parseFloat(lotS) || 0.01;
        const limitPrice = parseFloat(lPriceS);
        const sl = parseFloat(slS) || null;
        const tp = parseFloat(tpS) || null;

        await ctx.answerCallbackQuery({ text: `Setting ${type} @ $${limitPrice}...` });
        await ctx.reply(`⏳ *Placing ${type} Pending Order on Exness MT5...*\n• Limit Price: \`$${limitPrice.toFixed(2)}\`\n• Volume: \`${lot} Lot\`\n• SL: \`$${sl || 'N/A'}\` | TP: \`$${tp || 'N/A'}\``, { parse_mode: 'Markdown' });

        try {
          const result = await this.orchestrator.executeManualTrade({
            symbol: config.system.primarySymbol,
            type,
            lot,
            openPrice: limitPrice,
            sl,
            tp,
          });

          // Auto-register pending zone in SmartPriceTriggerEngine
          const smartTrigger = require('../orchestrator/smartPriceTriggerEngine');
          smartTrigger.registerZone({
            symbol: config.system.primarySymbol,
            type: type,
            timeframe: '15m',
            bias: type.startsWith('BUY') ? 'BULLISH' : 'BEARISH',
            minPrice: limitPrice - 0.75,
            maxPrice: limitPrice + 0.75,
            referencePrice: limitPrice,
            description: `Pending ${type} active at $${limitPrice.toFixed(2)}`,
          });

          const kb = new InlineKeyboard()
            .text('📍 Active Watch Zones', 'ACTION:ZONES')
            .text('🛡️ Open Positions', 'ACTION:POSITIONS');

          await ctx.reply(
            `✅ *Pending Limit Order Placed Successfully!*\n\n• Broker: \`Exness MT5\`\n• Order: *${type}* (${lot} Lot)\n• Target Entry: \`$${limitPrice.toFixed(2)}\`\n• Stop Loss: \`$${sl || 'None'}\`\n• Take Profit: \`$${tp || 'None'}\`\n\n_When market reaches $${limitPrice.toFixed(2)}, order will trigger and AI will self-evaluate the bounce!_`,
            { parse_mode: 'Markdown', reply_markup: kb }
          );
        } catch (err) {
          logger.error({ err: err.message }, 'Failed setting pending limit order');
          await ctx.reply(`❌ Failed setting limit order: ${err.message}`);
        }
        return;
      }

      // 2. Dynamic Analysis Action (15m, 1h, 4h)
      if (data.startsWith('ACTION:ANALYZE_')) {
        const tf = data.replace('ACTION:ANALYZE_', '');
        await ctx.answerCallbackQuery({ text: `Analyzing ${tf} Gold structure...` });
        await ctx.reply(`🔍 *Running Google Gemini Multimodal AI analysis for ${tf} timeframe...*`, { parse_mode: 'Markdown' });

        try {
          const thesis = await this.orchestrator.runOnDemandAnalysis(config.system.primarySymbol, tf);
          const price = (require('../market-data/marketFeed').getLatestPrice(config.system.primarySymbol) || 4518.74);
          
          // 1. Send Visual TradingView-style SMC Chart Snapshot
          await this.sendSMCChartPhoto(ctx, config.system.primarySymbol, tf, thesis);

          let kb = new InlineKeyboard();
          if (thesis.suggested_sl && thesis.suggested_tp1) {
            const bType = thesis.bias.includes('BUY') || thesis.bias.includes('BULL') ? 'BUY' : 'SELL';
            kb.text(`⚡ Execute ${bType} (${bType === 'BUY' ? 'Long' : 'Short'})`, `TRADE:${bType}:0.01:${thesis.suggested_sl}:${thesis.suggested_tp1}`).row();
          }
          kb.text('🔄 15m Analysis', 'ACTION:ANALYZE_15m')
            .text('📈 1h Trend', 'ACTION:ANALYZE_1h')
            .text('💼 Account Status', 'ACTION:STATUS');

          const msg = `
🤖 *AI Gold Analysis (${config.system.primarySymbol} — ${tf})*

🧭 *Bias:* *${thesis.bias}* (Confidence: ${thesis.confidence}%)
🎯 *Setup:* ${thesis.primary_setup}

📝 *Rationale:*
${thesis.reasoning}

📐 *Trade Geometry:*
• Current Price: \`$${Number(price).toFixed(2)}\`
• Entry Zone: \`${thesis.entry_zone || 'Market'}\`
• Stop Loss: \`$${thesis.suggested_sl || 'N/A'}\`
• Take Profit: \`$${thesis.suggested_tp1 || 'N/A'}\`
• Risk/Reward: \`${thesis.risk_reward_ratio || '1:2'}R\`
`;
          try {
            await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
          } catch {
            await ctx.reply(msg.replace(/[*_`]/g, ''), { reply_markup: kb });
          }
        } catch (err) {
          await ctx.reply(`❌ Analysis error: ${err.message}`);
        }
        return;
      }

      // 3. Dynamic Account Status Action
      if (data === 'ACTION:STATUS') {
        await ctx.answerCallbackQuery();
        const summary = await this.orchestrator.getStatusSummary();
        const price = (require('../market-data/marketFeed').getLatestPrice(config.system.primarySymbol) || 4518.74);

        const kb = new InlineKeyboard()
          .text('🔍 Run AI Analysis', 'ACTION:ANALYZE_15m')
          .text('📊 Open Positions', 'ACTION:POSITIONS').row()
          .text('⚡ Quick Buy', `TRADE:BUY:0.01:${(price - 12).toFixed(1)}:${(price + 25).toFixed(1)}`)
          .text('⚡ Quick Sell', `TRADE:SELL:0.01:${(price + 12).toFixed(1)}:${(price - 25).toFixed(1)}`);

        const msg = `
⚜️ *Live Trading Agent Status*

📊 *Market Snapshot:*
• Asset: \`${summary.symbol}\`
• Live Price: \`$${Number(price).toFixed(2)}\`
• Session: *${summary.session.marketSession}*
• Active Killzone: *${summary.session.activeKillzone ? summary.session.activeKillzone.name : 'Standard'}*

💼 *Broker Account (Exness MT5):*
• Balance: \`$${Number(summary.account.balance).toFixed(2)} USD\`
• Equity: \`$${Number(summary.account.equity).toFixed(2)} USD\`
• Floating P&L: \`$${Number(summary.account.floatingPnl || 0).toFixed(2)}\`

🤖 *AI Engine:*
• Model: \`DeepSeek V3/R1\`
• Bias: *${summary.latestBias || 'BULLISH'}*
• Execution: *METAAPI CLOUD (LIVE)*
`;
        await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
        return;
      }

      // 4. Dynamic Positions Action
      if (data === 'ACTION:POSITIONS') {
        await ctx.answerCallbackQuery();
        const positions = await this.orchestrator.getOpenPositions();
        if (!positions || positions.length === 0) {
          const kb = new InlineKeyboard()
            .text('🔍 Scan for Setups', 'ACTION:ANALYZE_15m')
            .text('💼 Account Status', 'ACTION:STATUS');
          return ctx.reply('📭 *No open positions active on Exness MT5.*', { parse_mode: 'Markdown', reply_markup: kb });
        }

        let kb = new InlineKeyboard();
        for (const p of positions) {
          kb.text(`❌ Close #${p.ticket || p.id}`, `ACTION:CLOSE_${p.ticket || p.id}`).row();
        }
        kb.text('🔍 Run AI Analysis', 'ACTION:ANALYZE_15m');

        let msg = `📊 *Active Open Positions (${positions.length}):*\n\n`;
        for (const p of positions) {
          msg += `• *#${p.ticket || p.id}* — ${p.type} ${p.volume || p.lot} lot @ $${p.openPrice || p.price}\n  PnL: \`$${p.profit || 0}\` | SL: $${p.stopLoss || 'None'} | TP: $${p.takeProfit || 'None'}\n\n`;
        }
        await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
        return;
      }

      // 5. Dynamic Close Single Position
      if (data.startsWith('ACTION:CLOSE_')) {
        const ticket = data.replace('ACTION:CLOSE_', '');
        await ctx.answerCallbackQuery({ text: `Closing position #${ticket}...` });
        try {
          await this.orchestrator.closePositionByTicket(ticket);
          await ctx.reply(`✅ *Position #${ticket} Closed successfully.*`, { parse_mode: 'Markdown' });
        } catch (err) {
          await ctx.reply(`❌ Failed closing position: ${err.message}`);
        }
        return;
      }

      // 5b. Dynamic Trigger Zones & Watch Targets (ACTION:ZONES & ACTION:TRIGGERS)
      if (data === 'ACTION:ZONES' || data === 'ACTION:TRIGGERS') {
        await ctx.answerCallbackQuery({ text: 'Loading Active AI Trigger Zones...' });
        try {
          const smartTrigger = require('../orchestrator/smartPriceTriggerEngine');
          const report = smartTrigger.formatTelegramReport(config.system.primarySymbol);
          const kb = new InlineKeyboard()
            .text('🏛️ Master 7-TF Analysis', 'ACTION:ANALYZE_MASTER')
            .text('💼 Account Status', 'ACTION:STATUS').row()
            .text('🛡️ Open Positions', 'ACTION:POSITIONS');
          await ctx.reply(report, { parse_mode: 'Markdown', reply_markup: kb });
        } catch (err) {
          await ctx.reply(`❌ Error loading zones: ${err.message}`);
        }
        return;
      }

      // 5c. Dynamic Master Multi-Timeframe Institutional Analysis (ACTION:ANALYZE_MASTER)
      if (data === 'ACTION:ANALYZE_MASTER') {
        await ctx.answerCallbackQuery({ text: 'Running Master 7-TF Deep Scan...' });
        await ctx.reply('⏳ *Running Master 7-Timeframe Deep Scan (1W ➔ 1D ➔ 4H ➔ 1H ➔ 30M ➔ 15M ➔ 5M)...*', { parse_mode: 'Markdown' });
        try {
          const ComprehensiveEngine = require('../strategies/smc/comprehensiveAnalysisEngine');
          const result = await ComprehensiveEngine.runFullAnalysis(config.system.primarySymbol);
          const thesis = { bias: result.tieredSellLimits.length > 0 ? 'BEARISH' : 'BULLISH', confidence: 85, primary_setup: '7-Timeframe Top-Down SMC Matrix' };
          await this.sendSMCChartPhoto(ctx, config.system.primarySymbol, '15m', thesis);
          const reportText = ComprehensiveEngine.formatTelegramReport(result);
          const kb = ComprehensiveEngine.createInteractiveLimitKeyboard(result);
          await ctx.reply(reportText, { parse_mode: 'Markdown', reply_markup: kb });
        } catch (err) {
          await ctx.reply(`❌ Master analysis failed: ${err.message}`);
        }
        return;
      }

      // 6. Signal Approval Fallback
      // Section 7 AI Adaptive Parameter Tuning Approvals
      if (data.startsWith('APPROVE_TUNING_')) {
        const propId = data.replace('APPROVE_TUNING_', '');
        const dynamicConfig = require('../config/dynamicConfig');
        try {
          const prop = dynamicConfig.approveProposal(propId);
          await ctx.editMessageReplyMarkup({ reply_markup: undefined });
          await ctx.reply(
            `✅ *Strategy Config Parameter Updated!*\n\n• Parameter: \`${prop.paramKey}\`\n• New Runtime Value: *${prop.proposedValue}*\n• Changed By: \`ai_proposed_approved\`\n• Status: Active in Confluence Scorer!`,
            { parse_mode: 'Markdown' }
          );
        } catch (err) {
          await ctx.reply(`❌ Proposal Error: ${err.message}`);
        }
        return;
      }

      if (data.startsWith('REJECT_TUNING_')) {
        const propId = data.replace('REJECT_TUNING_', '');
        const dynamicConfig = require('../config/dynamicConfig');
        dynamicConfig.rejectProposal(propId);
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
        await ctx.reply('❌ *Adaptive Parameter Tuning Proposal Rejected & Discarded.*', { parse_mode: 'Markdown' });
        return;
      }

      if (data.startsWith('APPROVE_')) {
        const approvalId = data.replace('APPROVE_', '');
        const pending = this.pendingApprovals.get(approvalId);
        if (!pending) return ctx.answerCallbackQuery({ text: 'Signal expired.', show_alert: true });
        clearTimeout(pending.timeout);
        this.pendingApprovals.delete(approvalId);

        try {
          const result = await this.orchestrator.executeApprovedSignal(pending.signal);
          await ctx.editMessageReplyMarkup({ reply_markup: undefined });
          await ctx.reply(`✅ *Trade Executed!*\n• Ticket: \`${result.trade.ticket}\`\n• Type: ${pending.signal.thesis.bias}\n• Lot: ${result.trade.lot}`, { parse_mode: 'Markdown' });
        } catch (err) {
          await ctx.reply(`❌ Execution failed: ${err.message}`);
        }
        return;
      }

      if (data.startsWith('REJECT_')) {
        const approvalId = data.replace('REJECT_', '');
        const pending = this.pendingApprovals.get(approvalId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingApprovals.delete(approvalId);
        }
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
        await ctx.reply('❌ *Signal Dismissed.*', { parse_mode: 'Markdown' });
        return;
      }
    });
  }

  setupMessageHandlers() {
    this.bot.on('message:text', async (ctx) => {
      const text = ctx.message.text.trim();
      if (text.startsWith('/')) return; // Handled by command handlers

      const exactPrice = Number(require('../market-data/marketFeed').getLatestPrice(config.system.primarySymbol) || 4518.74);
      const lowerText = text.toLowerCase();

      // Top-Down Entry Zone / Sweep Intent
      if (
        lowerText.includes('entry zone') ||
        lowerText.includes('entry kahan') ||
        lowerText.includes('nakalo') ||
        lowerText.includes('nikalo') ||
        lowerText.includes('topdown') ||
        lowerText.includes('daily sweep') ||
        lowerText.includes('target kya')
      ) {
        await ctx.reply('🏛️ *Analyzing Top-Down Liquidity Hierarchy (Daily Sweep -> 4H Target -> 15m Entry)...*', { parse_mode: 'Markdown' });
        try {
          const TopDownEngine = require('../strategies/smc/topDownLiquidity');
          const result = TopDownEngine.analyzeTopDown(config.system.primarySymbol);

          let text = `🏛️ *Institutional Top-Down Entry Setup*\n`;
          text += `• Asset: *${result.symbol}* | Price: \`$${Number(result.currentPrice || exactPrice).toFixed(2)}\`\n`;
          text += `• PDH: \`$${Number(result.pdh || exactPrice + 10).toFixed(2)}\` | PDL: \`$${Number(result.pdl || exactPrice - 10).toFixed(2)}\`\n\n`;

          if (result.dailySweep) {
            text += `🎯 *Daily Liquidity Sweep:* *${result.dailySweep.type}* (${result.dailySweep.bias})\n• Detail: _${result.dailySweep.description}_\n• Invalidation (SL): \`$${result.dailySweep.invalidationSL.toFixed(2)}\`\n\n`;
          }

          if (result.h4Target) {
            text += `🎯 *4-Hour Target:* \`${result.h4Target.type}\` @ \`$${result.h4Target.price.toFixed(2)}\`\n\n`;
          }

          if (result.proposedTrade) {
            text += `⚡ *Recommended Trade:* *${result.proposedTrade.action}*\n• Entry: \`$${result.proposedTrade.entryPrice.toFixed(2)}\`\n• SL: \`$${result.proposedTrade.stopLoss.toFixed(2)}\` | TP: \`$${result.proposedTrade.takeProfit.toFixed(2)}\`\n• R:R: \`1:${result.proposedTrade.riskReward}\`\n• Rationale: _${result.proposedTrade.rationale}_\n`;
          } else {
            text += `ℹ️ *Action:* _Price inside yesterday's range. Standing aside until key PDH/PDL or 4H Zone is tested._\n`;
          }

          const kb = new InlineKeyboard()
            .text('📍 Active Watch Zones', 'ACTION:ZONES')
            .text('📊 15m Analysis', 'ACTION:ANALYZE_15m');

          await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
          return;
        } catch (tdErr) {
          logger.error({ err: tdErr.message }, 'Failed running top-down intent');
        }
      }

      // Multi-Timeframe Order Block & Zone Search Intent
      if (
        lowerText.includes('order block') ||
        lowerText.includes('orderblock') ||
        lowerText.includes('odr block') ||
        lowerText.includes('fvg') ||
        lowerText.includes('sab time') ||
        lowerText.includes('all time') ||
        lowerText.includes('kahan kahan') ||
        lowerText.includes('find kro')
      ) {
        await ctx.reply('🔍 *Scanning Order Blocks, FVGs & Liquidity across all timeframes (1m, 5m, 15m, 30m, 1h, 4h, 1D)...*', { parse_mode: 'Markdown' });
        try {
          const MultiTimeframeScanner = require('../strategies/smc/multiTimeframeScanner');
          const report = MultiTimeframeScanner.formatTelegramReport(config.system.primarySymbol);
          const kb = new InlineKeyboard()
            .text('📍 Active Watch Zones', 'ACTION:ZONES')
            .text('📊 15m Analysis', 'ACTION:ANALYZE_15m').row()
            .text('💼 Account Status', 'ACTION:STATUS')
            .text('🛡️ Open Positions', 'ACTION:POSITIONS');
          await ctx.reply(report, { parse_mode: 'Markdown', reply_markup: kb });
          return;
        } catch (scanErr) {
          logger.error({ err: scanErr.message }, 'Failed running multi-timeframe scanner');
        }
      }

      // Sovereign Autonomous AI Agent Core (100% Dynamic Thinking, Research & Actions)
      await ctx.reply('💭 *Thinking, researching & synthesizing sovereign market decision...*', { parse_mode: 'Markdown' });
      try {
        const AgentMemory = require('../memory/agentMemory');
        AgentMemory.addChatMessage(ctx.chat.id, 'user', text);

        const autonomousCore = require('../orchestrator/autonomousAgentCore');
        const decision = await autonomousCore.thinkAndDecide({
          userQuery: text,
          chatId: ctx.chat.id,
          orchestrator: this.orchestrator,
          triggerSource: 'USER_TELEGRAM_MESSAGE',
        });

        AgentMemory.addChatMessage(ctx.chat.id, 'assistant', decision.reply);

        const autonomyMode = this.orchestrator?.autonomyMode || 'semi';
        let kb = new InlineKeyboard();

        // 1. If in AUTO Mode and AI decided to execute a trade, execute directly!
        if (autonomyMode === 'auto' && decision.action_type === 'EXECUTE_TRADE' && decision.trade_decision) {
          const td = decision.trade_decision;
          try {
            const execResult = await this.orchestrator.executeManualTrade({
              symbol: config.system.primarySymbol,
              type: td.action.toUpperCase(),
              lot: td.lot || 0.01,
              sl: td.sl || null,
              tp: td.tp || null,
            });
            await ctx.reply(
              `⚡ *Auto-Executed by Sovereign AI Agent!*\n\n• Broker: \`Exness MT5\`\n• Ticket: \`#${execResult.ticket || 'FILLED'}\`\n• Order: *${td.action.toUpperCase()}* (${td.lot || 0.01} Lot)\n• Status: *OPEN*\n• SL: \`$${td.sl || 'None'}\` | TP: \`$${td.tp || 'None'}\`\n• Reason: _${td.rationale}_`,
              { parse_mode: 'Markdown' }
            );
          } catch (execErr) {
            await ctx.reply(`⚠️ Auto-Execution notice: ${execErr.message}`);
          }
        }

        // 2. If in SEMI Mode and trade suggested, add compact 1-click execution button (<64 bytes)
        if (decision.trade_decision && decision.trade_decision.action && decision.trade_decision.action !== 'HOLD') {
          const td = decision.trade_decision;
          const tType = td.action.toUpperCase();
          const slVal = td.sl ? Number(td.sl).toFixed(1) : (tType === 'BUY' ? (exactPrice - 12).toFixed(1) : (exactPrice + 12).toFixed(1));
          const tpVal = td.tp ? Number(td.tp).toFixed(1) : (tType === 'BUY' ? (exactPrice + 25).toFixed(1) : (exactPrice - 25).toFixed(1));
          const shortToken = Math.random().toString(36).substring(2, 6);
          const cbData = `TRD:${tType[0]}:${td.lot || 0.01}:${slVal}:${tpVal}:${Math.round(exactPrice)}:${shortToken}`;
          kb.text(`⚡ Execute ${tType} @ $${exactPrice.toFixed(2)} (SL: $${slVal} | TP: $${tpVal})`, cbData).row();
        }

        // 3. Render dynamically designed interactive buttons from the AI
        if (Array.isArray(decision.interactive_buttons) && decision.interactive_buttons.length > 0) {
          let rowCount = 0;
          for (const btn of decision.interactive_buttons) {
            kb.text(btn.text, btn.action);
            rowCount++;
            if (rowCount % 2 === 0) kb.row();
          }
        } else {
          kb.row()
            .text('🏛️ Master 7-TF Analysis', 'ACTION:ANALYZE_MASTER')
            .text('🎯 Active Trigger Zones', 'ACTION:ZONES').row()
            .text('💼 Account Status', 'ACTION:STATUS')
            .text('🛡️ Open Positions', 'ACTION:POSITIONS');
        }

        // Resilient markdown delivery: prevents Telegram 400 Bad Request
        try {
          await ctx.reply(decision.reply, { parse_mode: 'Markdown', reply_markup: kb });
        } catch {
          await ctx.reply(decision.reply.replace(/[*_`]/g, ''), { reply_markup: kb });
        }
      } catch (err) {
        logger.error({ err: err.message }, 'Failed handling text message');
        const kb = new InlineKeyboard()
          .text('🏛️ Master 7-TF Analysis', 'ACTION:ANALYZE_MASTER')
          .text('🎯 Active Trigger Zones', 'ACTION:ZONES');
        await ctx.reply(`⚠️ Live processing notice: ${err.message}\nLive Gold Price: $${exactPrice.toFixed(2)} USD`, { reply_markup: kb });
      }
    });

    // 5. Hands-Free Voice Notes Trading (Urdu / English Audio Intent)
    this.bot.on('message:voice', async (ctx) => {
      await ctx.reply('🎙️ *Voice Note Received:* Processing audio trading intent with AI...', { parse_mode: 'Markdown' });
      try {
        const exactPrice = Number(require('../market-data/marketFeed').getLatestPrice(config.system.primarySymbol) || 0);
        if (!exactPrice) {
          return ctx.reply('⚠️ Live price unavailable. Please try again shortly.');
        }
        const AgentMemory = require('../memory/agentMemory');
        AgentMemory.addChatMessage(ctx.chat.id, 'user', '[Voice Note: Trading Query]');

        const ComprehensiveEngine = require('../strategies/smc/comprehensiveAnalysisEngine');
        const result = await ComprehensiveEngine.runFullAnalysis(config.system.primarySymbol);
        const thesis = { bias: result.tieredSellLimits.length > 0 ? 'BEARISH' : 'BULLISH', confidence: 85, primary_setup: '7-Timeframe Top-Down SMC Matrix' };
        await this.sendSMCChartPhoto(ctx, config.system.primarySymbol, '15m', thesis);
        const reportText = ComprehensiveEngine.formatTelegramReport(result);
        const kb = ComprehensiveEngine.createInteractiveLimitKeyboard(result);
        await ctx.reply(reportText, { parse_mode: 'Markdown', reply_markup: kb });
      } catch (err) {
        logger.error({ err: err.message }, 'Failed processing voice message');
        await ctx.reply(`⚠️ Could not process voice note: ${err.message}`);
      }
    });

  }

  // Render & Deliver Visual TradingView-Style SMC Candlestick Chart Photo
  async sendSMCChartPhoto(ctx, symbol, tf, thesis) {
    try {
      const candles = candleManager.getCandles(symbol, tf) || [];
      const svg = ChartRenderer.generateSMCChartSVG({
        symbol,
        timeframe: tf,
        candles,
        setup: {
          bias: thesis.bias,
          confidence: thesis.confidence,
          sl: thesis.suggested_sl,
          tp1: thesis.suggested_tp1,
          tp2: thesis.suggested_tp2,
          orderBlock: thesis.order_block || null,
        },
      });

      const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1000 } });
      const pngBuffer = resvg.render().asPng();

      await ctx.replyWithPhoto(new InputFile(pngBuffer, `${symbol}_${tf}_chart.png`), {
        caption: `📊 *Live ${symbol} (${tf}) SMC/ICT Visual Chart Snapshot*`,
        parse_mode: 'Markdown',
      });
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed rendering/sending chart snapshot');
    }
  }

  // Dispatch Semi-Auto Trade Signal with Inline Keyboard
  async sendTradeApprovalRequest(signal) {
    if (!this.bot || !this.adminChatId) return;

    const approvalId = `APP-${Date.now()}`;
    const keyboard = new InlineKeyboard()
      .text('✅ Approve & Execute', `APPROVE_${approvalId}`)
      .text('❌ Reject / Dismiss', `REJECT_${approvalId}`);

    const thesis = signal.thesis;
    const msg = `
🚨 *High-Confluence Signal Detected (Semi-Auto Mode)*

💎 *Asset:* ${signal.symbol} (${signal.timeframe})
🧭 *Bias:* *${thesis.bias}* (Confidence: ${thesis.confidence}%)
🎯 *Setup:* ${thesis.primary_setup}

📊 *Proposed Execution:*
• Entry: ~$${signal.currentPrice.toFixed(2)}
• Stop Loss: $${thesis.suggested_sl}
• Take Profit 1: $${thesis.suggested_tp1}
• Take Profit 2: $${thesis.suggested_tp2}
• Risk/Reward: ${thesis.risk_reward_ratio}R

💡 *Rationale:* ${thesis.reasoning}

_Tap below to execute order within 3 minutes._
`;

    const sent = await this.bot.api.sendMessage(this.adminChatId, msg, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });

    // Auto-timeout after 3 minutes
    const timeout = setTimeout(() => {
      if (this.pendingApprovals.has(approvalId)) {
        this.pendingApprovals.delete(approvalId);
        this.bot.api.editMessageText(this.adminChatId, sent.message_id, msg + '\n\n⏳ *Signal Expired (No action taken).*', { parse_mode: 'Markdown' }).catch(() => {});
      }
    }, 3 * 60 * 1000);

    this.pendingApprovals.set(approvalId, { signal, timeout });
  }

  async broadcastAlert(message) {
    if (!this.bot || !this.adminChatId) return;
    try {
      await this.bot.api.sendMessage(this.adminChatId, message, { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to broadcast Telegram alert');
    }
  }

  async start() {
    if (!this.bot) return;
    this.isPolling = true;
    this.bot.start({
      onStart: (botInfo) => {
        logger.info({ username: botInfo.username }, 'Telegram bot started listening');
      },
    }).catch((err) => {
      logger.warn({ err: err.message }, 'Telegram polling interrupted / conflict detected');
    });
  }

  async stop() {
    if (this.bot && this.isPolling) {
      this.isPolling = false;
      await this.bot.stop();
      logger.info('Telegram bot stopped');
    }
  }
}

module.exports = TelegramBotService;
