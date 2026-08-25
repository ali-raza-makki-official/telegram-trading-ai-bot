const { SettingsRepo } = require('../database');
const logger = require('../utils/logger');

const DEFAULT_STRATEGY = `# Autonomous Gold (XAU/USD) Master Strategy Directives

## 1. Core Operating Mandate:
- Trade strictly in alignment with the 4H and 1H Institutional Trend.
- Lower Timeframe (15m / 5m) entries are only valid when Higher Timeframe order flow confirms.

## 2. Session & Timing Rules:
- Primary Execution Window: London Open (07:00 - 10:00 UTC) and New York Open (12:00 - 15:00 UTC).
- Stand aside during Asian consolidation unless a clear liquidity sweep occurs.
- Never open new trades within 15 minutes before/after High-Impact USD News (CPI, NFP, FOMC).

## 3. Entry Confirmation Checklist:
1. Liquidity Sweep: Price must sweep a significant Previous Day High/Low (PDH/PDL), Session High/Low, or Equal Highs/Lows.
2. Market Structure Shift: Confirmation of Change of Character (CHoCH) or Break of Structure (BOS) with strong displacement wicks.
3. Fair Value Gap (FVG) / Order Block: Entry must be placed at the 50% equilibrium or 0.618 OTE discount/premium zone of the displacement leg.
4. Confluence Confirmation: Minimum Risk-to-Reward Ratio of 1:2.0 (Targeting next major liquidity pool).

## 4. Risk Management Rules:
- Max risk per trade: 1.0% of account balance.
- Strict Stop Loss placed beyond the invalidation swing wick.
- Move Stop Loss to Break-Even once Price achieves 1.0R in profit.`;

const STRATEGY_PRESETS = [
  {
    id: 'smc_default',
    name: '🏛️ Institutional SMC & ICT Master (Default)',
    description: '4H/1H Top-down trend alignment with 15m/5m FVG and Order Block entries during London & NY killzones.',
    instructions: DEFAULT_STRATEGY,
  },
  {
    id: 'order_block_scalp',
    name: '⚡ Order Block & FVG Scalper (15m / 5m)',
    description: 'High-frequency scalping targeting 15m order block retests and fair value gaps with 1:2.5 RR.',
    instructions: `# 15m / 5m Order Block & FVG Scalping Strategy
- Asset: XAU/USD (Gold)
- Primary Trigger: 15m Order Block retest with 5m CHoCH confirmation.
- Filter: RSI must be < 40 for BUY setups (Oversold discount) or > 60 for SELL setups (Overbought premium).
- Target: 1:2.5 Risk-to-Reward. Take 50% partials at 1.5R and trail stop loss to break-even.
- Invalidation: Hard stop loss beyond the order block wick.`,
  },
  {
    id: 'killzone_breakout',
    name: '🎯 London & NY Killzone Liquidity Sweep',
    description: 'Trades sweeps of Asian Session High/Low or Previous Day High/Low right after London/NY market opens.',
    instructions: `# London & New York Killzone Liquidity Sweep Strategy
- Wait for London Open (07:00 UTC) or NY Open (12:00 UTC).
- Identify Asian Session High/Low or Previous Day High/Low (PDH/PDL).
- Wait for price to take out the liquidity level with a false breakout (Turtle Soup wick).
- Look for rapid displacement back inside the range.
- Enter on 5m market structure shift targeting the opposite session liquidity pool.
- Stop Loss: 15-20 pips above/below the sweep wick.
- Take Profit: 45-60 pips (Opposite liquidity level).`,
  },
  {
    id: 'conservative_swing',
    name: '🛡️ Conservative Multi-Timeframe Swing',
    description: 'Patient swing trading taking 1-2 high probability setups per week with 1:3+ RR.',
    instructions: `# Conservative Multi-Timeframe Swing Strategy
- Daily & 4H Trend must be 100% aligned (Bullish or Bearish).
- Wait for price to pull back into a 4H Unmitigated Order Block or Weekly Fair Value Gap.
- Only trigger when DXY Dollar Index confirms inverse divergence (SMT).
- Stop loss: Maximum 25-30 pips.
- Minimum Target: 1:3.0 Risk-to-Reward.
- Maximum open risk across account: 1.5%.`,
  },
  {
    id: 'silver_bullet',
    name: '🔫 ICT NY Silver Bullet (14:00 - 15:00 UTC)',
    description: 'Pure 1m/5m FVG execution inside the strict 60-minute NY Silver Bullet window.',
    instructions: `# ICT NY Silver Bullet Strategy (14:00 - 15:00 UTC)
- Time Window: Exactly 14:00 to 15:00 UTC (New York morning session).
- Rule 1: Prior liquidity must be swept between 13:30 and 14:15 UTC.
- Rule 2: Enter on first clean 5m Fair Value Gap (FVG) formed after the sweep.
- Rule 3: Fixed 1:2.0 Risk-to-Reward ratio (20-30 pips target).
- Rule 4: Close trade by 15:30 UTC if target not hit.`,
  },
];

class CustomStrategyStore {
  /**
   * Get all strategies, active strategy ID, and presets
   */
  static async getAllStrategies() {
    let list = await SettingsRepo.get('custom_strategies_list', null);
    let activeId = await SettingsRepo.get('active_strategy_id', null);

    if (!list || !Array.isArray(list) || list.length === 0) {
      // Initialize with default institutional templates
      list = STRATEGY_PRESETS.map((p, idx) => ({
        id: p.id,
        title: p.name,
        description: p.description,
        instructions: p.instructions,
        enabled: true,
        compiledPlaybook: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      activeId = list[0].id;
      await SettingsRepo.set('custom_strategies_list', list);
      await SettingsRepo.set('active_strategy_id', activeId);
    }

    if (!activeId || !list.some(s => s.id === activeId)) {
      activeId = list[0].id;
      await SettingsRepo.set('active_strategy_id', activeId);
    }

    return {
      strategies: list,
      activeId,
      presets: STRATEGY_PRESETS,
    };
  }

  /**
   * Get currently active strategy for 24/7 autonomous execution
   */
  static async getActiveStrategy() {
    const { strategies, activeId } = await this.getAllStrategies();
    const active = strategies.find(s => s.id === activeId) || strategies[0];
    return {
      ...active,
      presets: STRATEGY_PRESETS,
    };
  }

  /**
   * Create a new custom strategy
   */
  static async createStrategy({ title, description = '', instructions = '' }) {
    const { strategies } = await this.getAllStrategies();
    const newId = `strat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newStrategy = {
      id: newId,
      title: title || `Custom Strategy ${strategies.length + 1}`,
      description: description || 'User-defined custom trading strategy',
      instructions: instructions.trim() || DEFAULT_STRATEGY,
      enabled: true,
      compiledPlaybook: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    strategies.push(newStrategy);
    await SettingsRepo.set('custom_strategies_list', strategies);
    await SettingsRepo.set('active_strategy_id', newId);

    logger.info({ id: newId, title: newStrategy.title }, '✅ New Strategy created and activated');
    return newStrategy;
  }

  /**
   * Update existing strategy
   */
  static async updateStrategy(id, updates = {}) {
    const { strategies } = await this.getAllStrategies();
    const idx = strategies.findIndex(s => s.id === id);
    if (idx === -1) throw new Error(`Strategy ${id} not found`);

    const strat = strategies[idx];
    if (updates.title) strat.title = updates.title;
    if (updates.description !== undefined) strat.description = updates.description;
    if (updates.instructions !== undefined) strat.instructions = updates.instructions;
    if (updates.enabled !== undefined) strat.enabled = !!updates.enabled;
    if (updates.compiledPlaybook !== undefined) strat.compiledPlaybook = updates.compiledPlaybook;
    strat.updatedAt = new Date().toISOString();

    strategies[idx] = strat;
    await SettingsRepo.set('custom_strategies_list', strategies);
    logger.info({ id, title: strat.title }, '✅ Strategy updated in database');
    return strat;
  }

  /**
   * Delete strategy
   */
  static async deleteStrategy(id) {
    let { strategies, activeId } = await this.getAllStrategies();
    if (strategies.length <= 1) {
      throw new Error('Cannot delete the only remaining strategy');
    }

    strategies = strategies.filter(s => s.id !== id);
    if (activeId === id) {
      activeId = strategies[0].id;
      await SettingsRepo.set('active_strategy_id', activeId);
    }
    await SettingsRepo.set('custom_strategies_list', strategies);
    logger.info({ id, newActiveId: activeId }, '✅ Strategy deleted');
    return { strategies, activeId };
  }

  /**
   * Set active strategy for 24/7 trading
   */
  static async setActiveStrategy(id) {
    const { strategies } = await this.getAllStrategies();
    const found = strategies.find(s => s.id === id);
    if (!found) throw new Error(`Strategy with ID ${id} not found`);

    await SettingsRepo.set('active_strategy_id', id);
    logger.info({ id, title: found.title }, '🟢 Active 24/7 Strategy switched');
    return found;
  }

  /**
   * AI Playbook Compiler ("Load Instructions"):
   * Translates raw English/Urdu/Roman Urdu instructions into a deterministic Operational Playbook
   */
  static async compilePlaybook(id, rawInstructions = null) {
    const { strategies } = await this.getAllStrategies();
    const strat = strategies.find(s => s.id === id);
    if (!strat) throw new Error(`Strategy with ID ${id} not found`);

    const instructionsToCompile = (rawInstructions || strat.instructions || '').trim();
    if (!instructionsToCompile) {
      throw new Error('Cannot compile empty strategy instructions');
    }

    logger.info({ id, title: strat.title, length: instructionsToCompile.length }, '🧠 AI compiling Strategy Operational Playbook...');

    const GeminiProvider = require('../llm/providers/GeminiProvider');
    const gemini = new GeminiProvider();

    const systemInstruction = `
You are an Elite Quantitative Architect and Institutional AI Strategy Compiler.
Your mission is to read user-defined trading strategy instructions (which may be in English, Urdu, or Roman Urdu) and compile them into a strict, structured "AI Operational Playbook" that an autonomous trading agent can execute 24/7.

Output strictly valid JSON with this exact schema:
{
  "strategy_name": "Concise strategy name",
  "core_philosophy": "1-2 sentence core trading thesis",
  "monitored_timeframes": ["1m", "5m", "15m", "1h", "4h", "1d"],
  "monitored_candlesticks": ["Engulfing", "Pinbar", "Tweezer Top", "Morning Star", etc.],
  "monitored_indicators": [
    { "name": "RSI 14", "timeframe": "15m", "condition": "Overbought/Oversold rule or divergence" },
    { "name": "EMA 20/50/200", "timeframe": "1h", "condition": "Trend slope and crossover condition" }
  ],
  "monitored_smc_structures": [
    { "concept": "Order Block (OB) / Fair Value Gap (FVG)", "rule": "Exact mitigation or sweep rule" }
  ],
  "execution_trigger_checklist": [
    "Step 1: Check HTF Trend and Session Time",
    "Step 2: Identify Liquidity Sweep of Asian High/Low or PDH/PDL",
    "Step 3: Confirm 5m/15m CHoCH or Displacement Wick",
    "Step 4: Verify Risk-to-Reward ratio >= 1:2.0"
  ],
  "risk_management_protocol": {
    "max_risk_percent": 1.0,
    "stop_loss_logic": "Exact rule for SL placement (e.g. beyond swing wick)",
    "take_profit_logic": "Exact rule for TP1/TP2 placement",
    "break_even_rule": "When to move SL to BE (e.g. at 1.0R)",
    "partial_profit_rule": "When to take partials (e.g. 50% at 1.5R)"
  },
  "session_and_news_filters": {
    "allowed_sessions": ["London Open", "NY Open"],
    "news_blackout_minutes": 15
  },
  "ai_learning_summary": "Detailed institutional synthesis in natural Roman Urdu explaining exactly how the AI will monitor each indicator, candle, and structure 24/7 according to the user's rules."
}`;

    const promptText = `
USER'S RAW STRATEGY INSTRUCTIONS:
"""
${instructionsToCompile}
"""

Compile the above instructions into the structured AI Operational Playbook JSON:`;

    let compiledPlaybook = null;
    try {
      const responseText = await gemini.chatCompletion(promptText, {
        mode: 'DEEP_THINKING',
        jsonMode: true,
        responseFormat: 'json_object',
        systemInstruction,
      });

      const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();
      compiledPlaybook = JSON.parse(cleanJson);
      compiledPlaybook.compiledAt = new Date().toISOString();
    } catch (err) {
      logger.error({ err: err.message }, 'Failed AI compilation of strategy playbook, using resilient fallback');
      compiledPlaybook = {
        strategy_name: strat.title,
        core_philosophy: 'Institutional SMC Top-Down execution following user directives',
        monitored_timeframes: ['15m', '1h', '4h'],
        monitored_candlesticks: ['Engulfing', 'Pinbar', 'Tweezer Top/Bottom'],
        monitored_indicators: [
          { name: 'RSI 14', timeframe: '15m', condition: 'Oversold < 35 for BUY, Overbought > 65 for SELL' },
          { name: 'EMA 20/50', timeframe: '1h', condition: 'Slope aligns with trend' }
        ],
        monitored_smc_structures: [
          { concept: 'Liquidity Sweep', rule: 'Previous Day / Session high/low sweep' },
          { concept: 'Fair Value Gap (FVG)', rule: 'Enter at 50% equilibrium discount/premium' }
        ],
        execution_trigger_checklist: [
          'Rule 1: 4H/1H Institutional Trend alignment',
          'Rule 2: Liquidity sweep before market structure shift',
          'Rule 3: Clean Fair Value Gap or Order Block mitigation',
          'Rule 4: Minimum 1:2.0 Risk-to-Reward ratio'
        ],
        risk_management_protocol: {
          max_risk_percent: 1.0,
          stop_loss_logic: 'Beyond invalidation swing wick',
          take_profit_logic: 'Target opposite liquidity pool',
          break_even_rule: 'Move SL to BE at 1.0R profit',
          partial_profit_rule: 'Take 50% partials at 1.5R'
        },
        session_and_news_filters: {
          allowed_sessions: ['London Open', 'NY Open'],
          news_blackout_minutes: 15
        },
        ai_learning_summary: 'AI ne aapki strategy ko compile kar liya hai. Main 24/7 Exness market par aapke bataye gaye timeframes, candlestick patterns, aur SMC levels ko monitor karunga.',
        compiledAt: new Date().toISOString(),
      };
    }

    // Save compiled playbook in strategy
    strat.instructions = instructionsToCompile;
    strat.compiledPlaybook = compiledPlaybook;
    strat.updatedAt = new Date().toISOString();

    await this.updateStrategy(id, {
      instructions: instructionsToCompile,
      compiledPlaybook,
    });

    logger.info({ id, title: strat.title }, '✅ AI Operational Playbook compiled and saved successfully');
    return {
      strategy: strat,
      compiledPlaybook,
    };
  }

  // Legacy compatibility helpers
  static async getStrategy() {
    const active = await this.getActiveStrategy();
    return {
      instructions: active.instructions,
      enabled: active.enabled !== false,
      updatedAt: active.updatedAt,
      compiledPlaybook: active.compiledPlaybook,
      presets: STRATEGY_PRESETS,
    };
  }

  static async setStrategy(instructions, enabled = true) {
    const active = await this.getActiveStrategy();
    const updated = await this.updateStrategy(active.id, { instructions, enabled });
    return this.getStrategy();
  }

  static async toggleStrategy(enabled) {
    const active = await this.getActiveStrategy();
    await this.updateStrategy(active.id, { enabled: !!enabled });
    return this.getStrategy();
  }

  static getPresets() {
    return STRATEGY_PRESETS;
  }
}

module.exports = CustomStrategyStore;
