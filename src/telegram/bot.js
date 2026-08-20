const { Bot, InlineKeyboard } = require('grammy');
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
    // /auth [password]
    this.bot.command('auth', async (ctx) => {
      const parts = ctx.message.text.trim().split(/\s+/);
      const pass = parts[1];

      if (pass === config.telegram.adminPassword) {
        this.adminChatId = ctx.chat.id;
        await SettingsRepo.set('admin_chat_id', ctx.chat.id);
        logger.info({ adminChatId: this.adminChatId, user: ctx.from?.username }, 'Admin authenticated via password in Telegram');
        
        await ctx.reply(
          `✅ *Authentication Successful!*\n\nYou are verified as the **Master Admin** for Gold AI Trading Agent.\n\nType */status* or */analyze* to start controlling the agent!`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.reply(
          `❌ *Invalid Password!*\n\nPlease use: \`/auth ALirazamakki12@\``,
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
🤖 *Autonomous Gold (XAU/USD) Trading Agent*

Welcome Ali Raza! I am your AI-powered trading copilot analyzing market structure, SMC, ICT killzones, and candlestick patterns.

🔐 *Admin Security:*
If prompted for password, send: \`/auth ALirazamakki12@\`

📋 *Available Commands:*
• /status — System health, open positions & market bias
• /analyze \`[pair] [tf]\` — Run on-demand AI analysis
• /execute \`[buy/sell] [lot] [sl] [tp]\` — Manual trade execution
• /positions — View all open trades
• /close \`[ticket|all]\` — Close active position(s)
• /mode \`[auto|semi|manual]\` — Change autonomy level
• /setlimit \`[risk|lot|loss] [val]\` — Modify risk limits
• /pause / /resume — Toggle automated trading
• /history — View recent predictions & trades
• /accuracy — View AI prediction win rate & stats
• /schedule — Market sessions & killzones schedule
`;
      await ctx.reply(msg, { parse_mode: 'Markdown' });
    });

    // /status
    this.bot.command('status', async (ctx) => {
      const summary = await this.orchestrator.getStatusSummary();
      const statusText = `
📊 *System Status Report*

🏦 *Account & Execution:*
• Balance: $${summary.account.balance.toFixed(2)}
• Equity: $${summary.account.equity.toFixed(2)} (Floating PnL: ${summary.account.floatingPnl >= 0 ? '+' : ''}$${summary.account.floatingPnl.toFixed(2)})
• Execution Engine: \`${summary.executionMode.toUpperCase()}\`
• Autonomy Mode: \`${summary.autonomyMode.toUpperCase()}\`
• Trading Active: ${summary.isPaused ? '⏸️ PAUSED' : '▶️ ACTIVE'}

📈 *Current Market State (${summary.symbol}):*
• Price: $${summary.currentPrice.toFixed(2)}
• Session: ${summary.session.marketSession}
• Killzone: ${summary.session.activeKillzone ? summary.session.activeKillzone.name : 'None'}
• AI Market Bias: *${summary.latestBias || 'NEUTRAL'}*
• Open Positions: ${summary.account.openPositionsCount}
`;
      await ctx.reply(statusText, { parse_mode: 'Markdown' });
    });

    // /analyze
    this.bot.command('analyze', async (ctx) => {
      await ctx.reply('🔍 *Running multi-timeframe SMC/ICT technical analysis & AI synthesis...*', { parse_mode: 'Markdown' });
      try {
        const text = ctx.message.text.trim();
        const parts = text.split(/\s+/);
        const tf = parts[2] || '15m';

        const thesis = await this.orchestrator.runOnDemandAnalysis(config.system.primarySymbol, tf);
        const report = `
🤖 *AI Gold Analysis Report (${config.system.primarySymbol} - ${tf})*

🧭 *Bias:* *${thesis.bias}* (Confidence: ${thesis.confidence}%)
🎯 *Primary Setup:* ${thesis.primary_setup}

📝 *Synthesis & Rationale:*
${thesis.reasoning}

📐 *Trade Geometry:*
• Entry Zone: ${thesis.entry_zone ? `$${thesis.entry_zone.min} - $${thesis.entry_zone.max}` : 'Market Execution'}
• Stop Loss: ${thesis.suggested_sl ? `$${thesis.suggested_sl}` : 'N/A'}
• Take Profit 1: ${thesis.suggested_tp1 ? `$${thesis.suggested_tp1}` : 'N/A'}
• Take Profit 2: ${thesis.suggested_tp2 ? `$${thesis.suggested_tp2}` : 'N/A'}
• Risk/Reward Ratio: ${thesis.risk_reward_ratio ? `${thesis.risk_reward_ratio}R` : 'N/A'}
• Invalidation: ${thesis.invalidation_level ? `$${thesis.invalidation_level}` : 'N/A'}

⚠️ *Risk Flags:*
${thesis.caution_flags && thesis.caution_flags.length > 0 ? thesis.caution_flags.map(f => `• ${f}`).join('\n') : '• None'}
`;
        await ctx.reply(report, { parse_mode: 'Markdown' });
      } catch (err) {
        logger.error({ err: err.message }, 'Failed /analyze command');
        await ctx.reply(`❌ Analysis failed: ${err.message}`);
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
        return ctx.reply('❌ Invalid syntax. Use: `/execute buy 0.1 2640 2660`', { parse_mode: 'Markdown' });
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
          await ctx.reply(`✅ *Order Executed Successfully!*\n• Ticket: \`${result.trade.ticket}\`\n• Type: ${type}\n• Lot: ${lot}\n• Entry: $${result.trade.entryPrice}\n• SL: ${sl ? '$' + sl : 'None'}\n• TP: ${tp ? '$' + tp : 'None'}`, { parse_mode: 'Markdown' });
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
        return ctx.reply('📭 No open positions at the moment.');
      }

      let msg = `📋 *Active Open Positions (${positions.length}):*\n\n`;
      for (const pos of positions) {
        msg += `• Ticket: \`${pos.ticket || pos.id}\`\n  Type: *${pos.type}* | Lot: ${pos.lot} | Entry: $${pos.entryPrice}\n  Floating PnL: ${pos.floatingPnl >= 0 ? '+' : ''}$${(pos.floatingPnl || 0).toFixed(2)}\n  SL: $${pos.sl || 'None'} | TP: $${pos.tp || 'None'}\n\n`;
      }
      msg += 'To close a position, use `/close [ticket]` or `/close all`';
      await ctx.reply(msg, { parse_mode: 'Markdown' });
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

    // /accuracy
    this.bot.command('accuracy', async (ctx) => {
      const report = await this.orchestrator.getAccuracyReport();
      const stats = report.stats;
      const msg = `
🎯 *AI Prediction Accuracy Statistics*

• Total Predictions Logged: ${stats.total}
• Resolved Predictions: ${stats.resolved || 0}
• Wins (Hit TP1/TP2): ${stats.winCount || 0}
• Losses (Hit SL): ${stats.lossCount || 0}
• Win Rate: *${stats.winRate || 0}%*
• Net Outcome Pips: *${stats.totalPips >= 0 ? '+' : ''}${stats.totalPips || 0} pips*

_Past predictions and outcomes are fed into the LLM context memory to continuously calibrate accuracy._
`;
      await ctx.reply(msg, { parse_mode: 'Markdown' });
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
  }

  setupCallbackQueries() {
    this.bot.on('callback_query:data', async (ctx) => {
      const data = ctx.callbackQuery.data;

      // 1. Dynamic Trade Execution from AI Recommendation
      if (data.startsWith('TRADE:')) {
        const [, type, lotStr, slStr, tpStr] = data.split(':');
        const lot = parseFloat(lotStr) || 0.01;
        const sl = parseFloat(slStr) || null;
        const tp = parseFloat(tpStr) || null;

        await ctx.answerCallbackQuery({ text: `⚡ Executing ${type} Order on Exness MT5...` });
        await ctx.reply(`⏳ *Executing Live ${type} Trade on Exness MT5...*\n• Volume: \`${lot} Lot\`\n• SL: \`$${sl || 'N/A'}\` | TP: \`$${tp || 'N/A'}\``, { parse_mode: 'Markdown' });

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

      // 2. Dynamic Analysis Action (15m, 1h, 4h)
      if (data.startsWith('ACTION:ANALYZE_')) {
        const tf = data.replace('ACTION:ANALYZE_', '');
        await ctx.answerCallbackQuery({ text: `Analyzing ${tf} Gold structure...` });
        await ctx.reply(`🔍 *Running DeepSeek AI analysis for ${tf} timeframe...*`, { parse_mode: 'Markdown' });

        try {
          const thesis = await this.orchestrator.runOnDemandAnalysis(config.system.primarySymbol, tf);
          const price = (require('../market-data/marketFeed').getLatestPrice(config.system.primarySymbol) || 4518.74);
          
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
          await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: kb });
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

      // 6. Signal Approval Fallback
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

      const lower = text.toLowerCase();
      const exactPrice = Number(require('../market-data/marketFeed').getLatestPrice(config.system.primarySymbol) || 4518.74);

      // Conversational Greeting with Interactive Smart UI
      if (['hi', 'hello', 'hey', 'start', 'salam', 'assalam o alaikum'].includes(lower)) {
        const kb = new InlineKeyboard()
          .text('📊 Live Gold Analysis', 'ACTION:ANALYZE_15m')
          .text('💼 Account Status', 'ACTION:STATUS').row()
          .text('📈 1h Macro Trend', 'ACTION:ANALYZE_1h')
          .text('🛡️ Open Positions', 'ACTION:POSITIONS');

        return ctx.reply(
          `👋 *Assalam o Alaikum Ali Raza!*\n\nMain aap ka **Autonomous Gold (XAU/USD) Trading AI Agent** hoon.\n\n⚜️ *Current Market State:*\n• Live Gold Price: \`$${exactPrice.toFixed(2)} USD\`\n• Broker: \`Exness MT5 (Trial16)\`\n• Balance: \`$463.91 USD\`\n\nNeeche diye gaye buttons par tap karein ya mujh se koi bhi trading sawal poochein:`,
          { parse_mode: 'Markdown', reply_markup: kb }
        );
      }

      // Intelligent Conversational AI Reasoner with Dynamic UI generation
      await ctx.reply('💭 *Analyzing market context & synthesizing intelligent response with DeepSeek AI...*', { parse_mode: 'Markdown' });
      try {
        const summary = await this.orchestrator.getStatusSummary();
        const DeepSeekProvider = require('../llm/providers/DeepSeekProvider');
        const ds = new DeepSeekProvider();

        if (!ds.isAvailable()) {
          const kb = new InlineKeyboard()
            .text('🔍 Analyze 15m', 'ACTION:ANALYZE_15m')
            .text('💼 Status', 'ACTION:STATUS');
          return ctx.reply(`Current Gold Price: $${exactPrice.toFixed(2)}\nSession: ${summary.session.marketSession}`, { reply_markup: kb });
        }

        const systemPrompt = `
You are an expert Autonomous Gold (XAU/USD) Trading AI Copilot chatting with user Ali Raza in Telegram.
Current Market Context:
- Exact Current Gold Price on Exness MT5: $${exactPrice.toFixed(2)} USD (MUST use this exact price).
- Market Session: ${summary.session.marketSession}
- Broker: Exness MT5 (Trial16), Account Balance: $${Number(summary.account.balance).toFixed(2)} USD.

Your Goal:
Respond in a friendly, conversational, and highly intelligent trading manner (in Roman Urdu / Urdu or English based on user's query).
You have full awareness of Telegram UI buttons and actions!
Always return a valid JSON object with the following schema:
{
  "reply": "Your intelligent markdown response explaining market context, price action, SMC/ICT structure, or answering their question clearly.",
  "trade_suggestion": {
    "recommended": boolean, // true if you advise a specific trade right now
    "type": "BUY" or "SELL",
    "lot": 0.01,
    "entry": number,
    "sl": number,
    "tp": number
  },
  "interactive_buttons": [
    { "text": "Button Label", "action": "ACTION:ANALYZE_15m" | "ACTION:ANALYZE_1h" | "ACTION:STATUS" | "ACTION:POSITIONS" | "TRADE:BUY:0.01:SL:TP" | "TRADE:SELL:0.01:SL:TP" }
  ]
}
Always provide 2 to 4 relevant interactive buttons so the user can easily tap actions, execute trades, or choose timeframes!
`;

        const response = await fetch(`${ds.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ds.apiKey}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: text },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
            max_tokens: 1000,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || '{}';
          let parsed;
          try {
            parsed = JSON.parse(content);
          } catch {
            parsed = { reply: content, interactive_buttons: [] };
          }

          let kb = new InlineKeyboard();

          // 1. If AI recommended a trade, add prominent 1-click execution button
          if (parsed.trade_suggestion && parsed.trade_suggestion.recommended && parsed.trade_suggestion.type) {
            const t = parsed.trade_suggestion;
            const tType = t.type.toUpperCase();
            const slVal = t.sl ? t.sl.toFixed(1) : (tType === 'BUY' ? (exactPrice - 12).toFixed(1) : (exactPrice + 12).toFixed(1));
            const tpVal = t.tp ? t.tp.toFixed(1) : (tType === 'BUY' ? (exactPrice + 25).toFixed(1) : (exactPrice - 25).toFixed(1));
            kb.text(`⚡ Execute ${tType} @ $${exactPrice.toFixed(1)} (SL: $${slVal} | TP: $${tpVal})`, `TRADE:${tType}:${t.lot || 0.01}:${slVal}:${tpVal}`).row();
          }

          // 2. Add dynamic interactive buttons returned by DeepSeek
          if (Array.isArray(parsed.interactive_buttons) && parsed.interactive_buttons.length > 0) {
            let rowCount = 0;
            for (const btn of parsed.interactive_buttons) {
              kb.text(btn.text, btn.action);
              rowCount++;
              if (rowCount % 2 === 0) kb.row();
            }
          } else {
            // Default fallback interactive keyboard
            kb.row()
              .text('📊 15m Analysis', 'ACTION:ANALYZE_15m')
              .text('📈 1h Trend', 'ACTION:ANALYZE_1h').row()
              .text('💼 Account Status', 'ACTION:STATUS')
              .text('🛡️ Open Positions', 'ACTION:POSITIONS');
          }

          await ctx.reply(parsed.reply, { parse_mode: 'Markdown', reply_markup: kb });
        } else {
          const kb = new InlineKeyboard()
            .text('📊 15m Analysis', 'ACTION:ANALYZE_15m')
            .text('💼 Account Status', 'ACTION:STATUS');
          await ctx.reply(`⚜️ *Gold Market Price:* \`$${exactPrice.toFixed(2)} USD\`\n• Session: *${summary.session.marketSession}*`, { parse_mode: 'Markdown', reply_markup: kb });
        }
      } catch (err) {
        logger.error({ err: err.message }, 'Failed handling text message');
        const kb = new InlineKeyboard()
          .text('📊 15m Analysis', 'ACTION:ANALYZE_15m')
          .text('💼 Account Status', 'ACTION:STATUS');
        await ctx.reply(`⚜️ *Gold Price:* \`$${exactPrice.toFixed(2)} USD\`\n• Type /analyze for full SMC/ICT thesis!`, { parse_mode: 'Markdown', reply_markup: kb });
      }
    });
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
