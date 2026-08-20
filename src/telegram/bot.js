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

    this.bot = new Bot(this.botToken);
    
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

      if (data.startsWith('APPROVE_')) {
        const approvalId = data.replace('APPROVE_', '');
        const pending = this.pendingApprovals.get(approvalId);

        if (!pending) {
          return ctx.answerCallbackQuery({ text: '⚠️ Signal expired or already processed.', show_alert: true });
        }

        clearTimeout(pending.timeout);
        this.pendingApprovals.delete(approvalId);

        try {
          const result = await this.orchestrator.executeApprovedSignal(pending.signal);
          await ctx.editMessageReplyMarkup({ reply_markup: undefined });
          await ctx.reply(`✅ *Trade Signal Approved and Executed!*\n• Ticket: \`${result.trade.ticket}\`\n• Type: ${pending.signal.thesis.bias}\n• Lot: ${result.trade.lot}\n• Price: $${result.trade.entryPrice}`, { parse_mode: 'Markdown' });
          await ctx.answerCallbackQuery({ text: 'Trade executed successfully!' });
        } catch (err) {
          await ctx.reply(`❌ Execution failed: ${err.message}`);
          await ctx.answerCallbackQuery({ text: 'Execution failed', show_alert: true });
        }
      } else if (data.startsWith('REJECT_')) {
        const approvalId = data.replace('REJECT_', '');
        const pending = this.pendingApprovals.get(approvalId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingApprovals.delete(approvalId);
        }
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
        await ctx.reply('❌ *Trade Signal Dismissed.*', { parse_mode: 'Markdown' });
        await ctx.answerCallbackQuery({ text: 'Signal dismissed' });
      }
    });
  }

  setupMessageHandlers() {
    this.bot.on('message:text', async (ctx) => {
      const text = ctx.message.text.trim();
      if (text.startsWith('/')) return; // handled by command handlers

      const lower = text.toLowerCase();
      if (['hi', 'hello', 'hey', 'start', 'salam', 'assalam o alaikum'].includes(lower)) {
        return ctx.reply(
          `👋 *Hello Ali Raza!*\n\nI am your **AI Gold (XAU/USD) Trading Agent** connected to Exness MT5.\n\n📋 *Quick Commands:*\n• /status — Account Balance ($463.91), Equity & Market state\n• /analyze — DeepSeek AI Gold Technical Analysis\n• /positions — View active open trades\n• /help — Full command manual\n\n_Or simply ask me any trading question!_`,
          { parse_mode: 'Markdown' }
        );
      }

      // Answer conversational trading questions using DeepSeek AI
      await ctx.reply('💭 *Thinking with DeepSeek AI...*', { parse_mode: 'Markdown' });
      try {
        const summary = await this.orchestrator.getStatusSummary();
        const DeepSeekProvider = require('../llm/providers/DeepSeekProvider');
        const ds = new DeepSeekProvider();

        if (!ds.isAvailable()) {
          return ctx.reply(`Current Gold Price: $${summary.currentPrice.toFixed(2)}\nMarket Session: ${summary.session.marketSession}\nType /analyze for full SMC/ICT thesis!`);
        }

        const response = await fetch(`${ds.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ds.apiKey}`,
          },
          body: JSON.stringify({
            model: ds.model,
            messages: [
              {
                role: 'system',
                content: `You are an expert Autonomous Gold (XAU/USD) Trading AI assistant connected to Exness MT5. Current Gold price is $${summary.currentPrice.toFixed(2)}, Market Session: ${summary.session.marketSession}. Be concise, professional, and provide clear SMC/ICT trading insights.`,
              },
              { role: 'user', content: text },
            ],
            temperature: 0.3,
            max_tokens: 800,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const aiReply = data.choices?.[0]?.message?.content || 'I could not generate a response.';
          await ctx.reply(`🤖 *AI Assistant:*\n\n${aiReply}`, { parse_mode: 'Markdown' });
        } else {
          await ctx.reply(`Current Gold Price: $${summary.currentPrice.toFixed(2)}\nMarket Session: ${summary.session.marketSession}\nType /analyze for full SMC/ICT thesis!`);
        }
      } catch (err) {
        logger.error({ err: err.message }, 'Failed handling text message');
        await ctx.reply(`Current Gold Price: $${(this.orchestrator.primarySymbol || 'XAUUSD')}\nType /analyze for full SMC/ICT thesis!`);
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
