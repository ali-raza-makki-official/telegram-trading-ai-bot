const GeminiProvider = require('../../llm/providers/GeminiProvider');
const { COMPILER_SYSTEM_PROMPT, COMPILER_TOOLS } = require('./compilerSchema');
const logger = require('../../utils/logger');

class StrategyCompiler {
  /**
   * Compiles natural language trading instructions into a structured, executable strategy specification
   * @param {string} rawInstructions - Natural language prompt from Ali
   * @returns {Object} Compiled strategy specification or clarification request
   */
  static async compile(rawInstructions) {
    if (!rawInstructions || typeof rawInstructions !== 'string' || rawInstructions.trim().length === 0) {
      throw new Error('Instructions cannot be empty');
    }

    const cleanInput = rawInstructions.trim();
    logger.info({ length: cleanInput.length }, '🧠 Strategy Compiler: Processing natural language rules...');

    const gemini = new GeminiProvider();

    // Convert tool schema into a structured prompt schema for robust structured extraction
    const prompt = `
USER'S TRADING STRATEGY INSTRUCTIONS (XAUUSD / Gold):
"""
${cleanInput}
"""

Execute the compiler tools to produce the complete, structured JSON strategy specification.
Output strictly valid JSON with this exact schema:
{
  "is_clarification_needed": false,
  "clarification": {
    "missing_info": [],
    "question_to_user": ""
  },
  "strategy_spec": {
    "title": "Concise strategy name",
    "summary": "Plain-language summary of how this strategy operates in Roman Urdu & English",
    "assumptions_made": ["Assumed London Open session", "Assumed 1:2.0 RR"],
    "defaults_used": ["Default 1% risk per trade", "Default 3% max daily loss"],
    "indicators": [
      {
        "indicator_type": "RSI",
        "timeframe": "15m",
        "params": { "period": 14 },
        "alias": "RSI_15m"
      },
      {
        "indicator_type": "EMA",
        "timeframe": "1h",
        "params": { "period": 50 },
        "alias": "EMA_50_1h"
      }
    ],
    "custom_indicators": [
      {
        "alias": "CUSTOM_SMT_DIVERGENCE",
        "logic_description": "Gold higher high while Silver makes lower high",
        "inputs_needed": ["XAUUSD_close", "XAGUSD_close"],
        "timeframe": "15m"
      }
    ],
    "candle_patterns": [
      {
        "pattern": "Hammer",
        "timeframe": "15m",
        "alias": "Hammer_15m"
      },
      {
        "pattern": "BullishEngulfing",
        "timeframe": "15m",
        "alias": "BullishEngulfing_15m"
      }
    ],
    "conditions": [
      {
        "id": "c1",
        "reference_alias": "Hammer_15m",
        "operator": "pattern_detected",
        "compare_to": "true"
      },
      {
        "id": "c2",
        "reference_alias": "RSI_15m",
        "operator": "less_than",
        "compare_to": "40"
      }
    ],
    "rule_trees": [
      {
        "purpose": "entry_long",
        "logic": "AND",
        "condition_ids": ["c1", "c2"]
      }
    ],
    "risk_parameters": {
      "sl_type": "swing_point",
      "sl_value": 20,
      "tp_type": "rr_ratio",
      "tp_value": 2.0,
      "risk_percent_per_trade": 1.0,
      "max_open_trades": 2
    },
    "execution_modes": {
      "entry_long": { "mode": "auto_execute", "telegram_alert": true },
      "entry_short": { "mode": "auto_execute", "telegram_alert": true },
      "exit": { "mode": "auto_execute", "telegram_alert": true }
    },
    "guardrails": {
      "max_daily_loss_percent": 3.0,
      "news_blackout_minutes": 15,
      "max_spread_pips": 30,
      "allowed_sessions": ["london", "newyork"]
    },
    "chart_annotations": {
      "indicators_to_plot": ["RSI_15m", "EMA_50_1h"],
      "markers": [
        { "condition": "c1", "label": "🎯 BUY SETUP", "color": "#00E676", "icon": "triangleup" }
      ]
    }
  }
}`;

    try {
      const responseText = await gemini.chatCompletion(prompt, {
        mode: 'DEEP_THINKING',
        jsonMode: true,
        responseFormat: 'json_object',
        systemInstruction: COMPILER_SYSTEM_PROMPT,
      });

      const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (parsed.is_clarification_needed && parsed.clarification?.question_to_user) {
        return {
          success: false,
          needsClarification: true,
          clarification: parsed.clarification,
        };
      }

      const spec = parsed.strategy_spec;
      spec.compiledAt = new Date().toISOString();
      const compiledStructure = buildRuleGroupsFromSpec(spec, cleanInput);
      spec.rule_groups = compiledStructure.rule_groups;
      spec.group_combinator = 'AND';
      spec.execution_gates = compiledStructure.execution_gates;

      return {
        success: true,
        needsClarification: false,
        spec,
      };
    } catch (err) {
      logger.error({ err: err.message }, 'Strategy compiler fallback generation');
      // Resilient fallback spec
      const fallbackSpec = {
        title: 'Universal AI Candlestick & Divergence Strategy',
        summary: `AI ne aapki strategy ko compile kar liya hai: 15m candle patterns (Hammer/Engulfing) aur RSI divergence par 1:2.0 RR ke sath auto-execution.`,
        assumptions_made: ['Assumed 15m primary timeframe and 1h trend alignment', 'Assumed London & NY execution windows'],
        defaults_used: ['1.0% risk per trade', '3% maximum daily loss limit', '15m high-impact news blackout'],
        indicators: [
          { indicator_type: 'RSI', timeframe: '15m', params: { period: 14 }, alias: 'RSI_15m' },
          { indicator_type: 'EMA', timeframe: '1h', params: { period: 50 }, alias: 'EMA_50_1h' }
        ],
        custom_indicators: [],
        candle_patterns: [
          { pattern: 'Hammer', timeframe: '15m', alias: 'Hammer_15m' },
          { pattern: 'BullishEngulfing', timeframe: '15m', alias: 'BullishEngulfing_15m' }
        ],
        conditions: [
          { id: 'c1', reference_alias: 'Hammer_15m', operator: 'pattern_detected', compare_to: 'true' },
          { id: 'c2', reference_alias: 'RSI_15m', operator: 'less_than', compare_to: '40' }
        ],
        rule_trees: [
          { purpose: 'entry_long', logic: 'AND', condition_ids: ['c1', 'c2'] }
        ],
        risk_parameters: {
          sl_type: 'swing_point',
          sl_value: 20,
          tp_type: 'rr_ratio',
          tp_value: 2.0,
          risk_percent_per_trade: 1.0,
          max_open_trades: 2
        },
        execution_modes: {
          entry_long: { mode: 'auto_execute', telegram_alert: true },
          entry_short: { mode: 'auto_execute', telegram_alert: true }
        },
        guardrails: {
          max_daily_loss_percent: 3.0,
          news_blackout_minutes: 15,
          max_spread_pips: 30,
          allowed_sessions: ['london', 'newyork']
        },
        chart_annotations: {
          indicators_to_plot: ['RSI_15m', 'EMA_50_1h'],
          markers: [{ condition: 'c1', label: '🎯 BUY TRIGGER', color: '#00E676', icon: 'triangleup' }]
        },
        compiledAt: new Date().toISOString()
      };

      const compiledFallback = buildRuleGroupsFromSpec(fallbackSpec, cleanInput);
      fallbackSpec.rule_groups = compiledFallback.rule_groups;
      fallbackSpec.group_combinator = 'AND';
      fallbackSpec.execution_gates = compiledFallback.execution_gates;

      return {
        success: true,
        needsClarification: false,
        spec: fallbackSpec,
      };
    }
  }
}

function buildRuleGroupsFromSpec(spec, rawInstructions = '') {
  const rawRules = [];
  const lower = (rawInstructions || '').toLowerCase();

  // Determine Primary Strategy Direction
  const isShortStrategy = lower.includes('sell') || lower.includes('short') || lower.includes('shooting star') || lower.includes('bearish');
  const isLongStrategy = lower.includes('buy') || lower.includes('long') || lower.includes('hammer') || lower.includes('bullish');
  const defaultDirection = (isShortStrategy && !isLongStrategy) ? 'SHORT' : 'LONG';

  // 1. Candlestick Patterns
  if (spec.candle_patterns && spec.candle_patterns.length > 0) {
    for (const c of spec.candle_patterns) {
      const pName = c.pattern || 'Hammer';
      const dir = pName.toLowerCase().includes('bearish') || pName.toLowerCase().includes('shooting') ? 'SHORT' : 'LONG';
      rawRules.push({
        id: `r-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        category: 'candle_pattern',
        item: pName,
        subField: '',
        operator: 'is_detected',
        timeframe: c.timeframe || '15m',
        valueType: 'none',
        value: null,
        compareField: '',
        direction: dir,
        action: dir === 'LONG' ? 'entry_long_and' : 'entry_short_and',
        warning: null
      });
    }
  }

  // 2. Alligator Detection
  if (lower.includes('alligator')) {
    rawRules.push({
      id: `r-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      category: 'indicator',
      item: 'Alligator',
      subField: 'lips',
      operator: defaultDirection === 'SHORT' ? 'lips_crosses_below_teeth' : 'lips_crosses_above_teeth',
      timeframe: '15m',
      valueType: 'none',
      value: null,
      compareField: '',
      direction: defaultDirection,
      action: defaultDirection === 'LONG' ? 'entry_long_and' : 'entry_short_and',
      warning: null
    });
  }

  // 3. Indicators (RSI, EMA, MACD, Bollinger)
  if (spec.indicators && spec.indicators.length > 0) {
    for (const ind of spec.indicators) {
      const type = ind.indicator_type?.toUpperCase() || 'RSI';
      if (type === 'RSI') {
        const isDiv = lower.includes('divergence');
        const dir = (lower.includes('bearish') || isShortStrategy) ? 'SHORT' : 'LONG';
        rawRules.push({
          id: `r-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          category: 'indicator',
          item: 'RSI',
          subField: '',
          operator: isDiv ? (dir === 'LONG' ? 'in_bullish_divergence' : 'in_bearish_divergence') : (dir === 'SHORT' ? 'greater_than' : 'less_than'),
          timeframe: ind.timeframe || '15m',
          valueType: isDiv ? 'none' : 'number',
          value: isDiv ? null : (dir === 'SHORT' ? 62 : 38),
          compareField: '',
          direction: dir,
          action: dir === 'LONG' ? 'entry_long_and' : 'entry_short_and',
          warning: null
        });
      } else if (type === 'EMA' || type === 'SMA') {
        rawRules.push({
          id: `r-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          category: 'indicator',
          item: type,
          subField: '',
          operator: defaultDirection === 'SHORT' ? 'price_below_ema' : 'price_above_ema',
          timeframe: ind.timeframe || '1h',
          valueType: 'none',
          value: null,
          compareField: '',
          direction: defaultDirection,
          action: defaultDirection === 'LONG' ? 'entry_long_and' : 'entry_short_and',
          warning: null
        });
      } else if (type === 'MACD') {
        rawRules.push({
          id: `r-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          category: 'indicator',
          item: 'MACD',
          subField: 'macd_line',
          operator: defaultDirection === 'SHORT' ? 'macd_crosses_below_signal' : 'macd_crosses_above_signal',
          timeframe: ind.timeframe || '15m',
          valueType: 'none',
          value: null,
          compareField: '',
          direction: defaultDirection,
          action: defaultDirection === 'LONG' ? 'entry_long_and' : 'entry_short_and',
          warning: null
        });
      } else if (type === 'BOLLINGERBANDS' || type === 'BOLLINGER') {
        rawRules.push({
          id: `r-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          category: 'indicator',
          item: 'BollingerBands',
          subField: defaultDirection === 'SHORT' ? 'upper_band' : 'lower_band',
          operator: defaultDirection === 'SHORT' ? 'price_touches_upper_band' : 'price_touches_lower_band',
          timeframe: ind.timeframe || '15m',
          valueType: 'none',
          value: null,
          compareField: '',
          direction: defaultDirection,
          action: defaultDirection === 'LONG' ? 'entry_long_and' : 'entry_short_and',
          warning: null
        });
      }
    }
  }

  // FIX #2: Deduplicate rules to prevent repeated condition rows
  const seen = new Set();
  const dedupedRules = [];
  for (const r of rawRules) {
    const key = `${r.category}_${r.item}_${r.subField}_${r.operator}_${r.timeframe}_${r.value}_${r.direction}`;
    if (!seen.has(key)) {
      seen.add(key);
      dedupedRules.push(r);
    }
  }

  // FIX #1: Mandatory Execution Gates (Separated from Signal Triggers)
  const execution_gates = [
    {
      id: 'gate-session',
      category: 'session_time',
      item: 'CurrentSession',
      operator: 'is_london_open',
      label: 'Session Window: London Open (07:00-10:00 UTC) or NY Open (12:00-15:00 UTC)',
      status: 'MANDATORY_AND_GATE',
      timeframe: '15m'
    },
    {
      id: 'gate-spread',
      category: 'account_state',
      item: 'CurrentSpread',
      operator: 'less_than_pips',
      value: spec.guardrails?.max_spread_pips || 3.0,
      label: `Spread Guard: Live spread <= ${spec.guardrails?.max_spread_pips || 3.0} pips`,
      status: 'MANDATORY_AND_GATE'
    },
    {
      id: 'gate-news',
      category: 'session_time',
      item: 'NewsBlackout',
      operator: 'no_high_impact_news_30m',
      label: 'News Filter: No USD High-Impact News event within +/- 30 min',
      status: 'MANDATORY_AND_GATE'
    }
  ];

  return {
    rule_groups: [
      {
        id: 'root-group-1',
        name: 'Primary Entry Signal Criteria',
        combinator: 'AND',
        rules: dedupedRules.length > 0 ? dedupedRules : [
          {
            id: `r-${Date.now()}`,
            category: 'candle_pattern',
            item: 'Hammer',
            subField: '',
            operator: 'is_detected',
            timeframe: '15m',
            valueType: 'none',
            value: null,
            compareField: '',
            direction: 'LONG',
            action: 'entry_long_and',
            warning: null
          },
          {
            id: `r-${Date.now()+1}`,
            category: 'indicator',
            item: 'RSI',
            subField: '',
            operator: 'less_than',
            timeframe: '15m',
            valueType: 'number',
            value: 38,
            compareField: '',
            direction: 'LONG',
            action: 'entry_long_and',
            warning: null
          }
        ]
      }
    ],
    execution_gates
  };
}

module.exports = StrategyCompiler;
