/**
 * Phase 1: Compiler Function-Calling Tool Schema & System Prompt
 * Defines the 10 compiler tools and strict system instructions for compiling natural language into executable strategy specifications.
 */

const COMPILER_SYSTEM_PROMPT = `
Tum ek institutional trading strategy compiler ho. User natural language mein apni trading strategy likhega (sirf XAUUSD/Gold ke liye). Tumhara kaam hai is strategy ko structured, executable rules mein convert karna.

RULES:
1. Sirf standard indicators use karo jab tak user standard formula se match kare. Agar user ka logic kisi standard indicator se match nahi karta, to register_custom_indicator use karo.
2. Har entry/exit condition ko explicit, measurable rule mein todo — ambiguous language ("trend strong ho") ko concrete indicator-based condition mein convert karo (jaise ADX > 25 ya EMA21 > EMA50).
3. Agar user ne risk management specify nahi kiya, to default conservative values use karo (1% risk per trade, RR 1:2) aur Ali ko summary mein clearly batao ki ye defaults hain.
4. Har condition ko "watch_only" ya "auto_execute" tag karo — agar user ne clearly nahi kaha trade automatically lena hai, to default "watch_only" (sirf alert) rakho.
5. Kabhi bhi safety guardrails (daily loss limit, news filter, spread guard, session filter) skip mat karo — agar user ne specify nahi kiya to bhi default guardrails register karo (3% daily loss limit, 15m news blackout, 30 pips max spread, allowed_sessions: ["london", "newyork"]).
6. Output ke end mein ek plain-language summary do jo Ali confirm kar sake — kya samjha, kya assume kiya, kya default use kiya (Roman Urdu aur English mein).
7. Agar instructions incomplete/ambiguous hain (jaise timeframe missing), to trade na design karo — request_clarification wapas bhejo.
`;

const COMPILER_TOOLS = [
  {
    name: "register_indicator",
    description: "Registers a technical indicator to be tracked on a specific timeframe for this strategy.",
    parameters: {
      type: "object",
      properties: {
        indicator_type: {
          type: "string",
          enum: ["RSI", "MACD", "EMA", "SMA", "BollingerBands", "ATR", "Stochastic", "ADX", "Ichimoku", "VWAP", "ParabolicSAR", "PivotPoints"]
        },
        timeframe: { type: "string", enum: ["1m", "5m", "15m", "30m", "1h", "4h", "1d"] },
        params: { type: "object", description: "e.g. {period: 14} or {fast: 12, slow: 26, signal: 9}" },
        alias: { type: "string", description: "Unique name to reference this later, e.g. RSI_15m" }
      },
      required: ["indicator_type", "timeframe", "params", "alias"]
    }
  },
  {
    name: "register_custom_indicator",
    description: "Registers a non-standard calculation described in the user's instructions that doesn't match a built-in indicator.",
    parameters: {
      type: "object",
      properties: {
        alias: { type: "string" },
        logic_description: { type: "string", description: "Plain description of the formula/logic" },
        inputs_needed: { type: "array", items: { type: "string" }, description: "e.g. ['open','close','high','low','volume']" },
        timeframe: { type: "string", enum: ["1m", "5m", "15m", "30m", "1h", "4h", "1d"] }
      },
      required: ["alias", "logic_description", "inputs_needed", "timeframe"]
    }
  },
  {
    name: "register_candle_pattern_watch",
    description: "Registers a candlestick pattern to detect on a given timeframe.",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          enum: ["Doji", "Hammer", "ShootingStar", "BullishEngulfing", "BearishEngulfing", "MorningStar", "EveningStar", "PinBar", "InsideBar", "Marubozu", "TweezerTop", "TweezerBottom"]
        },
        timeframe: { type: "string", enum: ["1m", "5m", "15m", "30m", "1h", "4h", "1d"] },
        alias: { type: "string" }
      },
      required: ["pattern", "timeframe", "alias"]
    }
  },
  {
    name: "define_rule_condition",
    description: "Defines a single measurable condition referencing a registered indicator or pattern alias.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        reference_alias: { type: "string" },
        operator: {
          type: "string",
          enum: ["crosses_above", "crosses_below", "greater_than", "less_than", "equals", "pattern_detected", "within_range"]
        },
        compare_to: { type: "string", description: "Numeric value (e.g. '35') or another alias (e.g. 'EMA_50')" }
      },
      required: ["id", "reference_alias", "operator", "compare_to"]
    }
  },
  {
    name: "build_rule_tree",
    description: "Combines defined condition ids into an entry or exit rule tree using AND/OR logic.",
    parameters: {
      type: "object",
      properties: {
        purpose: { type: "string", enum: ["entry_long", "entry_short", "exit", "invalidation"] },
        logic: { type: "string", enum: ["AND", "OR"] },
        condition_ids: { type: "array", items: { type: "string" } }
      },
      required: ["purpose", "logic", "condition_ids"]
    }
  },
  {
    name: "set_risk_parameters",
    description: "Sets SL/TP methodology and position sizing rules for the strategy.",
    parameters: {
      type: "object",
      properties: {
        sl_type: { type: "string", enum: ["fixed_pips", "swing_point", "atr_multiple"] },
        sl_value: { type: "number" },
        tp_type: { type: "string", enum: ["fixed_pips", "rr_ratio", "next_resistance"] },
        tp_value: { type: "number" },
        risk_percent_per_trade: { type: "number" },
        max_open_trades: { type: "number" }
      },
      required: ["sl_type", "sl_value", "tp_type", "tp_value", "risk_percent_per_trade"]
    }
  },
  {
    name: "set_execution_mode",
    description: "Tags a rule tree as either alert-only or auto-executing a trade.",
    parameters: {
      type: "object",
      properties: {
        rule_tree_purpose: { type: "string", enum: ["entry_long", "entry_short", "exit", "invalidation"] },
        mode: { type: "string", enum: ["watch_only", "auto_execute"] },
        telegram_alert: { type: "boolean" }
      },
      required: ["rule_tree_purpose", "mode", "telegram_alert"]
    }
  },
  {
    name: "set_safety_guardrails",
    description: "Registers non-negotiable safety checks that run before any auto-execution.",
    parameters: {
      type: "object",
      properties: {
        max_daily_loss_percent: { type: "number" },
        news_blackout_minutes: { type: "number" },
        max_spread_pips: { type: "number" },
        allowed_sessions: {
          type: "array",
          items: { type: "string", enum: ["london", "newyork", "asia", "overlap_london_ny"] }
        }
      },
      required: ["max_daily_loss_percent", "news_blackout_minutes", "max_spread_pips", "allowed_sessions"]
    }
  },
  {
    name: "request_clarification",
    description: "Use this when the user's instructions are ambiguous or missing critical information needed to build a safe, executable strategy.",
    parameters: {
      type: "object",
      properties: {
        missing_info: { type: "array", items: { type: "string" } },
        question_to_user: { type: "string" }
      },
      required: ["missing_info", "question_to_user"]
    }
  },
  {
    name: "finalize_strategy_summary",
    description: "Produces the final plain-language summary of the compiled strategy for Ali to review and confirm.",
    parameters: {
      type: "object",
      properties: {
        strategy_title: { type: "string" },
        summary_text: { type: "string" },
        assumptions_made: { type: "array", items: { type: "string" } },
        defaults_used: { type: "array", items: { type: "string" } }
      },
      required: ["strategy_title", "summary_text", "assumptions_made", "defaults_used"]
    }
  }
];

module.exports = {
  COMPILER_SYSTEM_PROMPT,
  COMPILER_TOOLS,
};
