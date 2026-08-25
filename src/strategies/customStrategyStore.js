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
  static async getStrategy() {
    const raw = await SettingsRepo.get('custom_strategy_instructions', null);
    const enabled = await SettingsRepo.get('custom_strategy_enabled', true);
    const updatedAt = await SettingsRepo.get('custom_strategy_updated_at', null);

    return {
      instructions: raw && typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : DEFAULT_STRATEGY,
      enabled: enabled !== false,
      updatedAt: updatedAt || new Date().toISOString(),
      presets: STRATEGY_PRESETS,
    };
  }

  static async setStrategy(instructions, enabled = true) {
    if (!instructions || typeof instructions !== 'string' || instructions.trim().length === 0) {
      throw new Error('Strategy instructions cannot be empty');
    }
    const cleanText = instructions.trim();
    const now = new Date().toISOString();

    await SettingsRepo.set('custom_strategy_instructions', cleanText);
    await SettingsRepo.set('custom_strategy_enabled', enabled);
    await SettingsRepo.set('custom_strategy_updated_at', now);

    logger.info({ length: cleanText.length, enabled, updatedAt: now }, '✅ Custom Strategy Directives updated in database');
    return {
      instructions: cleanText,
      enabled,
      updatedAt: now,
      presets: STRATEGY_PRESETS,
    };
  }

  static async toggleStrategy(enabled) {
    await SettingsRepo.set('custom_strategy_enabled', !!enabled);
    return this.getStrategy();
  }

  static getPresets() {
    return STRATEGY_PRESETS;
  }
}

module.exports = CustomStrategyStore;
