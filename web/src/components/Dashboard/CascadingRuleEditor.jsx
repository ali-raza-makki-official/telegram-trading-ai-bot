'use client';

import React, { useMemo, useState } from 'react';
import {
  RULE_CATEGORIES,
  RULE_ITEMS_BY_CATEGORY,
  OPERATOR_REGISTRY,
  ACTION_TARGETS,
  TIMEFRAMES,
} from './ruleSchemaRegistry';
import {
  Plus, Trash2, Layers, AlertTriangle, HelpCircle, Check,
  CornerDownRight, Copy, Code2, Sparkles, Sliders, ChevronRight,
  GitBranch, GitCommit, Split, ShieldCheck, ShieldAlert, Shield,
  ArrowUpRight, ArrowDownRight, CheckCircle2, XCircle, Clock,
  DollarSign, Target, Percent, Lock, Unlock, Zap, Flame, Radio,
  LogOut, Ban, Activity, ShieldX, TrendingUp, SlidersHorizontal
} from 'lucide-react';

const DIRECTION_OPTIONS = [
  { id: 'LONG', label: '🟢 Long Entry (BUY)', color: 'text-up bg-up/15 border-up/30' },
  { id: 'SHORT', label: '🔴 Short Entry (SELL)', color: 'text-down bg-down/15 border-down/30' },
  { id: 'EXIT', label: '🚪 Exit Condition', color: 'text-accent bg-accent/15 border-accent/30' },
  { id: 'INVALIDATION', label: '🚫 Invalidation Rule', color: 'text-warn bg-warn/15 border-warn/30' },
];

const SL_TYPES = [
  { id: 'swing_wick', label: 'Swing High/Low Wick' },
  { id: 'fixed_pips', label: 'Fixed Pips Buffer' },
  { id: 'atr_multiplier', label: 'ATR Multiplier (1.5x)' },
];

const TP_TYPES = [
  { id: 'rr_ratio', label: 'Risk:Reward Ratio (1:X)' },
  { id: 'fixed_pips', label: 'Fixed Pips Target' },
  { id: 'opposing_zone', label: 'Opposing Key S/R Zone' },
];

export default function CascadingRuleEditor({
  ruleGroups = [],
  exitRules = [],
  executionGates = [],
  groupCombinator = 'AND',
  riskParameters = {},
  onChange,
  onExitChange,
  onRiskChange,
  rawInstructions = '',
}) {
  const [interGroupCombinator, setInterGroupCombinator] = useState(groupCombinator || 'AND');

  // Custom Exit & Invalidation Rules State (Fix 1)
  const [customExitRules, setCustomExitRules] = useState(exitRules || []);

  // Structured Risk Management State (Fix 2)
  const [riskState, setRiskState] = useState({
    risk_percent_per_trade: riskParameters?.risk_percent_per_trade ?? 1.0,
    sl_type: riskParameters?.sl_type ?? 'swing_wick',
    sl_value: riskParameters?.sl_value ?? 20,
    tp_type: riskParameters?.tp_type ?? 'rr_ratio',
    tp_value: riskParameters?.tp_value ?? 2.5,
    max_open_trades: riskParameters?.max_open_trades ?? 2,
    max_daily_loss_percent: riskParameters?.max_daily_loss_percent ?? 3.0,
    move_sl_to_be_r: riskParameters?.move_sl_to_be_r ?? 1.0,
  });

  // Ensure default root group if empty
  const groups = useMemo(() => {
    if (!ruleGroups || ruleGroups.length === 0) {
      return [
        {
          id: 'root-group-1',
          name: 'Primary Signal Criteria',
          combinator: 'AND',
          rules: [
            {
              id: 'r-1',
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
              warning: null,
            },
            {
              id: 'r-2',
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
              warning: null,
            },
            {
              id: 'r-3',
              category: 'indicator',
              item: 'Alligator',
              subField: 'lips',
              operator: 'lips_crosses_above_teeth',
              timeframe: '15m',
              valueType: 'none',
              value: null,
              compareField: '',
              direction: 'LONG',
              action: 'entry_long_and',
              warning: null,
            },
          ],
        },
      ];
    }
    return ruleGroups;
  }, [ruleGroups]);

  // Default execution gates
  const gates = useMemo(() => {
    if (executionGates && executionGates.length > 0) return executionGates;
    return [
      {
        id: 'gate-session',
        label: 'London Open (07:00-10:00 UTC) or NY Open (12:00-15:00 UTC)',
        category: 'Session Filter',
        status: 'MANDATORY_AND_GATE',
      },
      {
        id: 'gate-spread',
        label: 'Live Broker Spread <= 3.0 pips',
        category: 'Spread Guard',
        status: 'MANDATORY_AND_GATE',
      },
      {
        id: 'gate-news',
        label: 'No High-Impact USD News (+/- 30 min)',
        category: 'News Blackout',
        status: 'MANDATORY_AND_GATE',
      },
    ];
  }, [executionGates]);

  const updateGroups = (newGroups) => {
    if (onChange) onChange(newGroups, interGroupCombinator);
  };

  const updateExitRules = (newExits) => {
    setCustomExitRules(newExits);
    if (onExitChange) onExitChange(newExits);
  };

  const handleRiskFieldChange = (key, val) => {
    const updated = { ...riskState, [key]: val };
    setRiskState(updated);
    if (onRiskChange) onRiskChange(updated);
  };

  // Helper to change combinator of a group
  const handleCombinatorChange = (groupId, newCombinator) => {
    const next = groups.map((g) =>
      g.id === groupId ? { ...g, combinator: newCombinator } : g
    );
    updateGroups(next);
  };

  // Helper to add condition row to a group
  const handleAddRule = (groupId, defaultDirection = 'LONG') => {
    const newRule = {
      id: `r-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      category: 'indicator',
      item: 'RSI',
      subField: '',
      operator: defaultDirection === 'SHORT' ? 'greater_than' : 'less_than',
      timeframe: '15m',
      valueType: 'number',
      value: defaultDirection === 'SHORT' ? 62 : 38,
      compareField: '',
      direction: defaultDirection,
      action: defaultDirection === 'SHORT' ? 'entry_short_and' : 'entry_long_and',
      warning: null,
    };

    const next = groups.map((g) => {
      if (g.id === groupId) {
        return { ...g, rules: [...g.rules, newRule] };
      }
      return g;
    });
    updateGroups(next);
  };

  // Helper to add a new condition group (Fix 3)
  const handleAddGroup = (direction = 'LONG') => {
    const newGroupId = `grp-${Date.now()}`;
    const newGroup = {
      id: newGroupId,
      name: `${direction === 'SHORT' ? 'Short Entry' : 'Confluence'} Group #${groups.length + 1}`,
      combinator: 'AND',
      rules: [
        {
          id: `r-${Date.now()}`,
          category: 'indicator',
          item: 'EMA',
          subField: '',
          operator: direction === 'SHORT' ? 'price_below_ema' : 'price_above_ema',
          timeframe: '1h',
          valueType: 'none',
          value: null,
          compareField: '',
          direction: direction,
          action: direction === 'SHORT' ? 'entry_short_and' : 'entry_long_and',
          warning: null,
        },
      ],
    };
    updateGroups([...groups, newGroup]);
  };

  // Helper to delete condition row
  const handleDeleteRule = (groupId, ruleId) => {
    const next = groups.map((g) => {
      if (g.id === groupId) {
        return { ...g, rules: g.rules.filter((r) => r.id !== ruleId) };
      }
      return g;
    }).filter((g) => g.rules.length > 0 || groups.length === 1);
    updateGroups(next);
  };

  // Helper to delete an entire group
  const handleDeleteGroup = (groupId) => {
    if (groups.length <= 1) return;
    updateGroups(groups.filter((g) => g.id !== groupId));
  };

  // LEVEL 1 CASCADE: Change Category
  const handleCategoryChange = (groupId, ruleId, newCategory, isExit = false) => {
    const availableItems = RULE_ITEMS_BY_CATEGORY[newCategory] || [];
    const firstItem = availableItems[0]?.id || '';
    const itemConfig = OPERATOR_REGISTRY[firstItem] || { operators: [] };
    const firstOp = itemConfig.operators[0] || { id: 'default', valueType: 'none' };

    if (isExit) {
      const next = customExitRules.map((r) => {
        if (r.id !== ruleId) return r;
        return {
          ...r,
          category: newCategory,
          item: firstItem,
          subField: itemConfig.subFields?.[0]?.id || '',
          operator: firstOp.id,
          valueType: firstOp.valueType,
          value: firstOp.defaultVal ?? null,
          compareField: firstOp.defaultCompare ?? '',
          warning: null,
        };
      });
      updateExitRules(next);
      return;
    }

    const next = groups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        rules: g.rules.map((r) => {
          if (r.id !== ruleId) return r;
          return {
            ...r,
            category: newCategory,
            item: firstItem,
            subField: itemConfig.subFields?.[0]?.id || '',
            operator: firstOp.id,
            valueType: firstOp.valueType,
            value: firstOp.defaultVal ?? null,
            compareField: firstOp.defaultCompare ?? '',
            warning: null,
          };
        }),
      };
    });
    updateGroups(next);
  };

  // LEVEL 2 CASCADE: Change Specific Item
  const handleItemChange = (groupId, ruleId, newItem, isExit = false) => {
    const itemConfig = OPERATOR_REGISTRY[newItem] || { operators: [] };
    const firstOp = itemConfig.operators[0] || { id: 'default', valueType: 'none' };

    if (isExit) {
      const next = customExitRules.map((r) => {
        if (r.id !== ruleId) return r;
        return {
          ...r,
          item: newItem,
          subField: itemConfig.subFields?.[0]?.id || '',
          operator: firstOp.id,
          valueType: firstOp.valueType,
          value: firstOp.defaultVal ?? null,
          compareField: firstOp.defaultCompare ?? '',
          warning: null,
        };
      });
      updateExitRules(next);
      return;
    }

    const next = groups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        rules: g.rules.map((r) => {
          if (r.id !== ruleId) return r;
          return {
            ...r,
            item: newItem,
            subField: itemConfig.subFields?.[0]?.id || '',
            operator: firstOp.id,
            valueType: firstOp.valueType,
            value: firstOp.defaultVal ?? null,
            compareField: firstOp.defaultCompare ?? '',
            warning: null,
          };
        }),
      };
    });
    updateGroups(next);
  };

  // LEVEL 3 CASCADE: Change Sub-field or Operator
  const handleOperatorChange = (groupId, ruleId, newOpId, isExit = false) => {
    if (isExit) {
      const next = customExitRules.map((r) => {
        if (r.id !== ruleId) return r;
        const itemConfig = OPERATOR_REGISTRY[r.item] || { operators: [] };
        const opObj = itemConfig.operators.find((o) => o.id === newOpId) || {};
        return {
          ...r,
          operator: newOpId,
          valueType: opObj.valueType || 'none',
          value: opObj.defaultVal ?? r.value ?? null,
          compareField: opObj.defaultCompare ?? '',
          warning: null,
        };
      });
      updateExitRules(next);
      return;
    }

    const next = groups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        rules: g.rules.map((r) => {
          if (r.id !== ruleId) return r;
          const itemConfig = OPERATOR_REGISTRY[r.item] || { operators: [] };
          const opObj = itemConfig.operators.find((o) => o.id === newOpId) || {};

          return {
            ...r,
            operator: newOpId,
            valueType: opObj.valueType || 'none',
            value: opObj.defaultVal ?? r.value ?? null,
            compareField: opObj.defaultCompare ?? '',
            warning: null,
          };
        }),
      };
    });
    updateGroups(next);
  };

  const handleSubFieldChange = (groupId, ruleId, newSubField, isExit = false) => {
    if (isExit) {
      const next = customExitRules.map((r) => (r.id === ruleId ? { ...r, subField: newSubField } : r));
      updateExitRules(next);
      return;
    }

    const next = groups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        rules: g.rules.map((r) => (r.id === ruleId ? { ...r, subField: newSubField } : r)),
      };
    });
    updateGroups(next);
  };

  // Change Value / Direction / Timeframe
  const handleFieldChange = (groupId, ruleId, key, val, isExit = false) => {
    if (isExit) {
      const next = customExitRules.map((r) => (r.id === ruleId ? { ...r, [key]: val, warning: null } : r));
      updateExitRules(next);
      return;
    }

    const next = groups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        rules: g.rules.map((r) => (r.id === ruleId ? { ...r, [key]: val, warning: null } : r)),
      };
    });
    updateGroups(next);
  };

  // Add Custom Exit Rule (Fix 1)
  const handleAddExitRule = (type = 'EXIT') => {
    const newExit = {
      id: `exit-${Date.now()}`,
      category: 'indicator',
      item: 'RSI',
      subField: '',
      operator: 'greater_than',
      timeframe: '15m',
      valueType: 'number',
      value: 70,
      compareField: '',
      direction: type,
      action: type === 'EXIT' ? 'exit_long' : 'invalidation_rule',
      warning: null,
    };
    updateExitRules([...customExitRules, newExit]);
  };

  const handleDeleteExitRule = (ruleId) => {
    updateExitRules(customExitRules.filter((r) => r.id !== ruleId));
  };

  // Automatic Validation Pass & Sanity Check
  const validationResult = useMemo(() => {
    const issues = [];

    // Check Stop Loss
    if (!riskState.sl_value || Number(riskState.sl_value) <= 0) {
      issues.push({ type: 'error', text: 'No Stop Loss defined. Trading without SL is blocked for capital protection.' });
    }

    // Check Take Profit
    if (!riskState.tp_value || Number(riskState.tp_value) <= 0) {
      issues.push({ type: 'error', text: 'No Take Profit Target ratio defined (minimum 1:1.5 RR recommended).' });
    }

    // Check Condition Duplication
    const seen = new Set();
    let hasDuplicate = false;
    groups.forEach((g) => {
      g.rules.forEach((r) => {
        const sig = `${r.category}-${r.item}-${r.subField}-${r.operator}-${r.timeframe}-${r.value}-${r.direction}`;
        if (seen.has(sig)) hasDuplicate = true;
        seen.add(sig);
      });
    });
    if (hasDuplicate) {
      issues.push({ type: 'warn', text: 'Duplicate condition detected in rule tree. Merge repeated rows to prevent redundant compute.' });
    }

    // Check if session condition is inside an OR group
    groups.forEach((g, idx) => {
      if (g.combinator === 'OR') {
        const hasSession = g.rules.some((r) => r.category === 'session_time');
        const hasSignal = g.rules.some((r) => r.category === 'indicator' || r.category === 'candle_pattern');
        if (hasSession && hasSignal) {
          issues.push({ type: 'error', text: `Group #${idx + 1} has Session filter in an OR group with Signals. Session must be a mandatory AND gate.` });
        }
      }
    });

    // Check directions
    const allRules = groups.flatMap((g) => g.rules);
    const hasLong = allRules.some((r) => r.direction === 'LONG');
    const hasShort = allRules.some((r) => r.direction === 'SHORT');
    if (!hasLong && !hasShort) {
      issues.push({ type: 'error', text: 'No entry direction specified (all conditions must designate Long or Short).' });
    }

    return {
      isValid: issues.filter((i) => i.type === 'error').length === 0,
      issues,
    };
  }, [groups, riskState]);

  // Real-time live English summary generation
  const livePlainEnglishSummary = useMemo(() => {
    const gateTexts = gates.map((gate) => gate.label || gate.category);
    const gateSummary = `[GATES: ${gateTexts.join(' AND ')}]`;

    const groupTexts = groups.map((g) => {
      const ruleTexts = g.rules.map((r) => {
        const itemConfig = OPERATOR_REGISTRY[r.item] || { operators: [] };
        const opObj = itemConfig.operators.find((o) => o.id === r.operator);
        const opLabel = opObj ? opObj.label : r.operator;
        const tf = r.timeframe ? `[${r.timeframe}]` : '';

        let valStr = '';
        if (r.valueType === 'number' && r.value !== null) valStr = ` ${r.value}`;
        else if (r.valueType === 'compare_field' && r.compareField) valStr = ` ${r.compareField}`;

        const subFieldLabel = r.subField ? `.${r.subField}` : '';
        const dirLabel = r.direction ? `(${r.direction}) ` : '';
        return `${dirLabel}${r.item}${subFieldLabel} ${tf} ${opLabel}${valStr}`;
      });

      return `(${ruleTexts.join(` ${g.combinator} `)})`;
    });

    const signalSummary = groupTexts.join(` ${interGroupCombinator} `);
    const exitSummary = customExitRules.length > 0
      ? ` | EXITS: ${customExitRules.map((e) => `${e.item} ${e.operator} ${e.value || ''}`).join(' OR ')}`
      : '';
    const riskSummary = `[RISK: ${riskState.risk_percent_per_trade}% | SL: ${riskState.sl_value} pips | TP: 1:${riskState.tp_value} RR]`;

    return `${gateSummary} ➔ IF ${signalSummary} ➔ ${riskSummary}${exitSummary}`;
  }, [groups, gates, customExitRules, interGroupCombinator, riskState]);

  return (
    <div className="flex-1 flex flex-col bg-bgBase overflow-y-auto p-4 space-y-4 font-mono text-xs select-none">
      
      {/* 1. LIVE PLAIN-ENGLISH SUMMARY BANNER */}
      <div className="p-3.5 rounded-xl bg-bgPanel border-l-4 border-l-gold space-y-1.5 shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-gold uppercase tracking-wider flex items-center gap-1.5 font-sans">
            <Sparkles className="w-3.5 h-3.5 text-gold" />
            Live Compiled Strategy Mandate (Source of Truth)
          </span>
          <span className="text-[9px] px-2 py-0.5 rounded bg-gold/15 text-gold font-bold">
            DETERMINISTIC ENGINE
          </span>
        </div>
        <p className="text-xs font-sans text-textPrimary leading-relaxed font-semibold">
          {livePlainEnglishSummary}
        </p>
      </div>

      {/* 2. SANITY VALIDATION BANNER */}
      <div className={`p-3 rounded-xl flex items-start gap-2.5 font-sans ${
        validationResult.isValid
          ? 'bg-up/10 text-up border border-up/20'
          : 'bg-warn/15 text-warn border border-warn/30'
      }`}>
        {validationResult.isValid ? (
          <CheckCircle2 className="w-5 h-5 text-up flex-shrink-0 mt-0.5" />
        ) : (
          <ShieldAlert className="w-5 h-5 text-warn flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 text-xs">
          <div className="font-bold flex items-center gap-2">
            <span>{validationResult.isValid ? '✅ All Rule Conditions & Risk Parameters Validated' : '⚠️ Strategy Validation Warnings Identified'}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 font-mono">
              {validationResult.issues.length === 0 ? 'READY FOR LIVE' : `${validationResult.issues.length} Items to Review`}
            </span>
          </div>
          {validationResult.issues.length > 0 && (
            <ul className="mt-1 space-y-1 text-[11px] opacity-90">
              {validationResult.issues.map((iss, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-warn" />
                  <span>{iss.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 3. PINNED EXECUTION GATES SECTION */}
      <div className="p-4 rounded-xl bg-bgPanel border border-borderHairline space-y-2.5 shadow-md">
        <div className="flex items-center justify-between border-b border-borderHairline pb-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-textPrimary text-xs uppercase font-sans">
              1. Execution Gates & Environment Filters (Mandatory AND-Gate)
            </span>
          </div>
          <span className="text-[9px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-bold">
            ALWAYS EVALUATED FIRST
          </span>
        </div>
        <p className="text-[10px] text-textMuted font-sans leading-relaxed">
          These environmental filters must ALL pass simultaneously before any signal logic is checked. Session and news conditions can never be satisfied in isolation.
        </p>

        <div className="grid grid-cols-3 gap-2 pt-1 font-sans">
          {gates.map((gate) => (
            <div key={gate.id} className="p-2.5 rounded-lg bg-bgElevated border border-borderHairline flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0" />
              <div className="truncate">
                <div className="font-bold text-textPrimary text-[11px] truncate">{gate.category}</div>
                <div className="text-[9px] text-textMuted truncate">{gate.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. SIGNAL TRIGGER LOGIC GROUPS WITH DIRECTIONAL SCOPE & INTER-GROUP CONNECTORS (Fix 3 & 5) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-gold" />
            <span className="font-bold text-textPrimary text-xs uppercase font-sans">
              2. Technical Signal Trigger Logic Groups
            </span>
          </div>
          <div className="flex items-center gap-2 font-sans">
            <span className="text-[10px] text-textMuted font-mono">
              {groups.length} Condition Group{groups.length > 1 ? 's' : ''}
            </span>
            <button
              onClick={() => handleAddGroup('LONG')}
              className="px-2.5 py-1 rounded bg-gold/15 hover:bg-gold text-gold hover:text-black text-[10px] font-bold flex items-center gap-1 transition shadow-sm"
            >
              <Plus className="w-3 h-3" />
              <span>Add Condition Group</span>
            </button>
          </div>
        </div>

        {groups.map((group, gIdx) => {
          // Calculate Directional Scope of this group (Fix 5)
          const allLong = group.rules.every((r) => r.direction === 'LONG');
          const allShort = group.rules.every((r) => r.direction === 'SHORT');
          const isMixed = !allLong && !allShort;

          return (
            <React.Fragment key={group.id}>
              
              {/* INTER-GROUP CONNECTOR (Fix 3) */}
              {gIdx > 0 && (
                <div className="flex items-center justify-center my-2">
                  <div className="flex items-center gap-2.5 bg-bgPanel px-4 py-1.5 rounded-full border border-borderHairline shadow-md font-sans">
                    <Split className="w-3.5 h-3.5 text-gold" />
                    <span className="text-[10px] font-bold text-textMuted uppercase">
                      Relationship: Group #{gIdx} ➔ Group #{gIdx + 1}:
                    </span>
                    <div className="flex items-center rounded bg-bgElevated p-0.5 border border-borderHairline">
                      <button
                        onClick={() => setInterGroupCombinator('AND')}
                        className={`px-2.5 py-0.5 rounded text-[9px] font-bold transition ${
                          interGroupCombinator === 'AND' ? 'bg-up text-white' : 'text-textMuted hover:text-textPrimary'
                        }`}
                      >
                        AND (BOTH MUST MATCH)
                      </button>
                      <button
                        onClick={() => setInterGroupCombinator('OR')}
                        className={`px-2.5 py-0.5 rounded text-[9px] font-bold transition ${
                          interGroupCombinator === 'OR' ? 'bg-gold text-black' : 'text-textMuted hover:text-textPrimary'
                        }`}
                      >
                        OR (EITHER CAN MATCH)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* GROUP CARD */}
              <div className="p-4 rounded-xl bg-bgPanel border border-borderHairline space-y-3 shadow-md">
                {/* Group Header */}
                <div className="flex items-center justify-between border-b border-borderHairline pb-2.5">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold uppercase text-textPrimary font-sans">
                      Group #{gIdx + 1}:
                    </span>

                    {/* Directional Scope Indicator Badge (Fix 5) */}
                    <span className={`text-[9px] px-2 py-0.5 rounded font-bold font-sans ${
                      allLong
                        ? 'bg-up/15 text-up border border-up/30'
                        : allShort
                        ? 'bg-down/15 text-down border border-down/30'
                        : 'bg-accent/15 text-accent border border-accent/30'
                    }`}>
                      {allLong && '🟢 LONG-ONLY SIGNAL GROUP (BUY ORDERS)'}
                      {allShort && '🔴 SHORT-ONLY SIGNAL GROUP (SELL ORDERS)'}
                      {isMixed && '🔄 BIDIRECTIONAL CONFLUENCE GROUP (MIXED BUY/SELL)'}
                    </span>
                    
                    {/* Intra-group Combinator */}
                    <div className="flex items-center rounded-lg bg-bgElevated p-0.5 border border-borderHairline">
                      <button
                        onClick={() => handleCombinatorChange(group.id, 'AND')}
                        className={`px-2.5 py-0.5 rounded text-[9px] font-bold transition ${
                          group.combinator === 'AND'
                            ? 'bg-up text-white shadow-sm'
                            : 'text-textMuted hover:text-textPrimary'
                        }`}
                      >
                        ALL CONDITIONS (AND)
                      </button>
                      <button
                        onClick={() => handleCombinatorChange(group.id, 'OR')}
                        className={`px-2.5 py-0.5 rounded text-[9px] font-bold transition ${
                          group.combinator === 'OR'
                            ? 'bg-gold text-black shadow-sm'
                            : 'text-textMuted hover:text-textPrimary'
                        }`}
                      >
                        ANY CONDITION (OR)
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAddRule(group.id, allShort ? 'SHORT' : 'LONG')}
                      className="px-2 py-1 rounded bg-bgElevated hover:bg-bgHover text-gold text-[10px] font-bold flex items-center gap-1 transition"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Signal Condition</span>
                    </button>

                    {groups.length > 1 && (
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="p-1 rounded bg-down/10 hover:bg-down/20 text-down text-[10px] transition"
                        title="Delete Group"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Condition Rows */}
                <div className="space-y-2.5">
                  {group.rules.map((rule) => {
                    const availableItems = RULE_ITEMS_BY_CATEGORY[rule.category] || [];
                    const itemConfig = OPERATOR_REGISTRY[rule.item] || { subFields: [], operators: [] };
                    const hasSubFields = itemConfig.subFields && itemConfig.subFields.length > 0;

                    return (
                      <div
                        key={rule.id}
                        className="p-3 rounded-lg bg-bgElevated border border-borderHairline hover:border-gold/30 transition flex flex-col space-y-2"
                      >
                        {/* Warning Flag */}
                        {rule.warning && (
                          <div className="p-1.5 px-2 rounded bg-warn/15 text-warn text-[10px] flex items-center gap-1.5 font-sans">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span><b>AI Mapping Note:</b> {rule.warning}</span>
                          </div>
                        )}

                        {/* Cascading 6-Level Input Bar */}
                        <div className="grid grid-cols-12 gap-2 items-center">
                          
                          {/* DIRECTION COLUMN (2 cols) */}
                          <div className="col-span-2 space-y-0.5">
                            <label className="text-[8px] font-bold uppercase text-textMuted block font-sans">Direction</label>
                            <select
                              value={rule.direction || 'LONG'}
                              onChange={(e) => handleFieldChange(group.id, rule.id, 'direction', e.target.value)}
                              className="w-full bg-bgPanel text-textPrimary font-bold rounded p-1.5 text-[10px] focus:outline-none border border-borderHairline"
                            >
                              {DIRECTION_OPTIONS.map((opt) => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* LEVEL 1: CATEGORY (2 cols) */}
                          <div className="col-span-2 space-y-0.5">
                            <label className="text-[8px] font-bold uppercase text-textMuted block font-sans">Category</label>
                            <select
                              value={rule.category}
                              onChange={(e) => handleCategoryChange(group.id, rule.id, e.target.value)}
                              className="w-full bg-bgPanel text-textPrimary rounded p-1.5 text-[11px] focus:outline-none border border-borderHairline"
                            >
                              {RULE_CATEGORIES.map((cat) => (
                                <option key={cat.id} value={cat.id}>{cat.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* LEVEL 2: SPECIFIC ITEM (2 cols) */}
                          <div className="col-span-2 space-y-0.5">
                            <label className="text-[8px] font-bold uppercase text-textMuted block font-sans">Item</label>
                            <select
                              value={rule.item}
                              onChange={(e) => handleItemChange(group.id, rule.id, e.target.value)}
                              className="w-full bg-bgPanel text-gold font-bold rounded p-1.5 text-[11px] focus:outline-none border border-borderHairline"
                            >
                              {availableItems.map((item) => (
                                <option key={item.id} value={item.id}>{item.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* TIMEFRAME (1 col) */}
                          <div className="col-span-1 space-y-0.5">
                            <label className="text-[8px] font-bold uppercase text-textMuted block font-sans">TF</label>
                            <select
                              value={rule.timeframe || '15m'}
                              onChange={(e) => handleFieldChange(group.id, rule.id, 'timeframe', e.target.value)}
                              className="w-full bg-bgPanel text-textSecondary rounded p-1.5 text-[11px] focus:outline-none border border-borderHairline"
                            >
                              {TIMEFRAMES.map((tf) => (
                                <option key={tf.id} value={tf.id}>{tf.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* LEVEL 3: OPERATOR & SUB-FIELD (3 cols) */}
                          <div className="col-span-3 space-y-0.5">
                            <label className="text-[8px] font-bold uppercase text-textMuted block font-sans">Operator / Condition</label>
                            <div className="flex items-center gap-1.5">
                              {hasSubFields && (
                                <select
                                  value={rule.subField || itemConfig.subFields[0].id}
                                  onChange={(e) => handleSubFieldChange(group.id, rule.id, e.target.value)}
                                  className="w-1/3 bg-bgPanel text-accent rounded p-1.5 text-[10px] focus:outline-none border border-borderHairline"
                                >
                                  {itemConfig.subFields.map((sf) => (
                                    <option key={sf.id} value={sf.id}>{sf.label}</option>
                                  ))}
                                </select>
                              )}

                              <select
                                value={rule.operator}
                                onChange={(e) => handleOperatorChange(group.id, rule.id, e.target.value)}
                                className="flex-1 bg-bgPanel text-textPrimary rounded p-1.5 text-[11px] focus:outline-none border border-borderHairline"
                              >
                                {itemConfig.operators.map((op) => (
                                  <option key={op.id} value={op.id}>{op.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* LEVEL 4: VALUE (1 col) */}
                          <div className="col-span-1 space-y-0.5">
                            <label className="text-[8px] font-bold uppercase text-textMuted block font-sans">Target</label>
                            {rule.valueType === 'number' ? (
                              <input
                                type="number"
                                step="any"
                                value={rule.value ?? ''}
                                onChange={(e) => handleFieldChange(group.id, rule.id, 'value', Number(e.target.value))}
                                className="w-full bg-bgPanel text-up font-bold rounded p-1.5 text-[11px] focus:outline-none border border-borderHairline"
                                placeholder="38"
                              />
                            ) : (
                              <div className="p-1.5 text-[9px] text-textMuted bg-bgPanel/50 rounded text-center border border-borderHairline">
                                N/A
                              </div>
                            )}
                          </div>

                          {/* DELETE BUTTON (1 col) */}
                          <div className="col-span-1 flex items-center justify-end pt-3">
                            <button
                              onClick={() => handleDeleteRule(group.id, rule.id)}
                              className="p-1.5 text-textMuted hover:text-down rounded hover:bg-down/10 transition"
                              title="Remove condition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* BOTTOM ADD GROUP ACTION BUTTON */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => handleAddGroup('LONG')}
            className="px-3.5 py-2 rounded-lg bg-bgPanel hover:bg-bgElevated text-gold text-xs font-bold flex items-center gap-1.5 border border-borderHairline transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-gold" />
            <span>+ Add Condition Group (Confluence Block)</span>
          </button>
        </div>
      </div>

      {/* 5. EXIT & INVALIDATION CONDITIONS SECTION (Fix 1) */}
      <div className="p-4 rounded-xl bg-bgPanel border border-borderHairline space-y-3 shadow-md">
        <div className="flex items-center justify-between border-b border-borderHairline pb-2">
          <div className="flex items-center gap-2">
            <LogOut className="w-4 h-4 text-accent" />
            <span className="font-bold text-textPrimary text-xs uppercase font-sans">
              3. Exit & Invalidation Conditions (Position Disposals)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAddExitRule('EXIT')}
              className="px-2.5 py-1 rounded bg-accent/15 hover:bg-accent text-accent hover:text-black text-[10px] font-bold flex items-center gap-1 transition"
            >
              <Plus className="w-3 h-3" />
              <span>+ Add Exit Rule</span>
            </button>
            <button
              onClick={() => handleAddExitRule('INVALIDATION')}
              className="px-2.5 py-1 rounded bg-warn/15 hover:bg-warn text-warn hover:text-black text-[10px] font-bold flex items-center gap-1 transition"
            >
              <Ban className="w-3 h-3" />
              <span>+ Add Invalidation Rule</span>
            </button>
          </div>
        </div>

        {customExitRules.length === 0 ? (
          <div className="p-4 rounded-lg bg-bgElevated/40 border border-dashed border-borderHairline text-center space-y-1.5">
            <div className="text-textMuted font-sans text-xs">
              No custom exit rules defined — trade will close exclusively via <b>Stop Loss</b> or <b>Take Profit</b>.
            </div>
            <div className="text-[10px] text-textMuted opacity-75 font-sans">
              (Add an exit rule above if you want the AI to close positions early on indicator divergence or opposite candle triggers).
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {customExitRules.map((rule) => {
              const availableItems = RULE_ITEMS_BY_CATEGORY[rule.category] || [];
              const itemConfig = OPERATOR_REGISTRY[rule.item] || { subFields: [], operators: [] };
              const hasSubFields = itemConfig.subFields && itemConfig.subFields.length > 0;

              return (
                <div
                  key={rule.id}
                  className="p-3 rounded-lg bg-bgElevated border border-borderHairline hover:border-accent/30 transition flex flex-col space-y-2"
                >
                  <div className="grid grid-cols-12 gap-2 items-center">
                    {/* Action Type */}
                    <div className="col-span-2 space-y-0.5">
                      <label className="text-[8px] font-bold uppercase text-textMuted block font-sans">Type</label>
                      <select
                        value={rule.direction}
                        onChange={(e) => handleFieldChange(null, rule.id, 'direction', e.target.value, true)}
                        className="w-full bg-bgPanel text-accent font-bold rounded p-1.5 text-[10px] focus:outline-none border border-borderHairline"
                      >
                        <option value="EXIT">🚪 Early Exit</option>
                        <option value="INVALIDATION">🚫 Invalidate</option>
                      </select>
                    </div>

                    {/* Category */}
                    <div className="col-span-2 space-y-0.5">
                      <label className="text-[8px] font-bold uppercase text-textMuted block font-sans">Category</label>
                      <select
                        value={rule.category}
                        onChange={(e) => handleCategoryChange(null, rule.id, e.target.value, true)}
                        className="w-full bg-bgPanel text-textPrimary rounded p-1.5 text-[11px] focus:outline-none border border-borderHairline"
                      >
                        {RULE_CATEGORIES.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Item */}
                    <div className="col-span-2 space-y-0.5">
                      <label className="text-[8px] font-bold uppercase text-textMuted block font-sans">Item</label>
                      <select
                        value={rule.item}
                        onChange={(e) => handleItemChange(null, rule.id, e.target.value, true)}
                        className="w-full bg-bgPanel text-accent font-bold rounded p-1.5 text-[11px] focus:outline-none border border-borderHairline"
                      >
                        {availableItems.map((item) => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Timeframe */}
                    <div className="col-span-1 space-y-0.5">
                      <label className="text-[8px] font-bold uppercase text-textMuted block font-sans">TF</label>
                      <select
                        value={rule.timeframe || '15m'}
                        onChange={(e) => handleFieldChange(null, rule.id, 'timeframe', e.target.value, true)}
                        className="w-full bg-bgPanel text-textSecondary rounded p-1.5 text-[11px] focus:outline-none border border-borderHairline"
                      >
                        {TIMEFRAMES.map((tf) => (
                          <option key={tf.id} value={tf.id}>{tf.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Operator */}
                    <div className="col-span-3 space-y-0.5">
                      <label className="text-[8px] font-bold uppercase text-textMuted block font-sans">Exit Condition</label>
                      <div className="flex items-center gap-1.5">
                        {hasSubFields && (
                          <select
                            value={rule.subField || itemConfig.subFields[0].id}
                            onChange={(e) => handleSubFieldChange(null, rule.id, e.target.value, true)}
                            className="w-1/3 bg-bgPanel text-accent rounded p-1.5 text-[10px] focus:outline-none border border-borderHairline"
                          >
                            {itemConfig.subFields.map((sf) => (
                              <option key={sf.id} value={sf.id}>{sf.label}</option>
                            ))}
                          </select>
                        )}
                        <select
                          value={rule.operator}
                          onChange={(e) => handleOperatorChange(null, rule.id, e.target.value, true)}
                          className="flex-1 bg-bgPanel text-textPrimary rounded p-1.5 text-[11px] focus:outline-none border border-borderHairline"
                        >
                          {itemConfig.operators.map((op) => (
                            <option key={op.id} value={op.id}>{op.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Value */}
                    <div className="col-span-1 space-y-0.5">
                      <label className="text-[8px] font-bold uppercase text-textMuted block font-sans">Value</label>
                      {rule.valueType === 'number' ? (
                        <input
                          type="number"
                          value={rule.value ?? ''}
                          onChange={(e) => handleFieldChange(null, rule.id, 'value', Number(e.target.value), true)}
                          className="w-full bg-bgPanel text-accent font-bold rounded p-1.5 text-[11px] focus:outline-none border border-borderHairline"
                        />
                      ) : (
                        <div className="p-1.5 text-[9px] text-textMuted bg-bgPanel/50 rounded text-center border border-borderHairline">
                          N/A
                        </div>
                      )}
                    </div>

                    {/* Delete */}
                    <div className="col-span-1 flex items-center justify-end pt-3">
                      <button
                        onClick={() => handleDeleteExitRule(rule.id)}
                        className="p-1.5 text-textMuted hover:text-down rounded hover:bg-down/10 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. STRUCTURED RISK & TRADE MANAGEMENT CARD (Fix 2) */}
      <div className="p-4 rounded-xl bg-bgPanel border border-borderHairline space-y-3 shadow-md font-sans">
        <div className="flex items-center justify-between border-b border-borderHairline pb-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-gold" />
            <span className="font-bold text-textPrimary text-xs uppercase">
              4. Risk & Position Sizing Management
            </span>
          </div>
          <span className="text-[9px] px-2 py-0.5 rounded bg-gold/15 text-gold font-bold">
            INTERACTIVE PARAMETER CONTROLS
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          
          {/* Card 1: Stop Loss */}
          <div className="p-3 rounded-lg bg-bgElevated border border-borderHairline space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-textPrimary">
              <span className="flex items-center gap-1.5 text-down">
                <ShieldX className="w-3.5 h-3.5" />
                Stop Loss Protocol
              </span>
            </div>
            <div className="space-y-1.5">
              <select
                value={riskState.sl_type}
                onChange={(e) => handleRiskFieldChange('sl_type', e.target.value)}
                className="w-full bg-bgPanel text-textPrimary rounded p-1.5 text-[11px] focus:outline-none border border-borderHairline"
              >
                {SL_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="1"
                  min="5"
                  max="150"
                  value={riskState.sl_value}
                  onChange={(e) => handleRiskFieldChange('sl_value', Number(e.target.value))}
                  className="w-full bg-bgPanel text-down font-bold rounded p-1.5 text-xs focus:outline-none border border-borderHairline"
                />
                <span className="text-textMuted font-bold text-xs">pips</span>
              </div>
            </div>
          </div>

          {/* Card 2: Take Profit */}
          <div className="p-3 rounded-lg bg-bgElevated border border-borderHairline space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-textPrimary">
              <span className="flex items-center gap-1.5 text-up">
                <TrendingUp className="w-3.5 h-3.5" />
                Take Profit Target
              </span>
            </div>
            <div className="space-y-1.5">
              <select
                value={riskState.tp_type}
                onChange={(e) => handleRiskFieldChange('tp_type', e.target.value)}
                className="w-full bg-bgPanel text-textPrimary rounded p-1.5 text-[11px] focus:outline-none border border-borderHairline"
              >
                {TP_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <span className="text-textMuted font-bold text-xs">1:</span>
                <input
                  type="number"
                  step="0.1"
                  min="1.0"
                  max="10.0"
                  value={riskState.tp_value}
                  onChange={(e) => handleRiskFieldChange('tp_value', Number(e.target.value))}
                  className="w-full bg-bgPanel text-up font-bold rounded p-1.5 text-xs focus:outline-none border border-borderHairline"
                />
                <span className="text-textMuted font-bold text-xs">RR</span>
              </div>
            </div>
          </div>

          {/* Card 3: Capital Risk Allocation */}
          <div className="p-3 rounded-lg bg-bgElevated border border-borderHairline space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-textPrimary">
              <span className="flex items-center gap-1.5 text-gold">
                <DollarSign className="w-3.5 h-3.5" />
                Risk Per Trade (%)
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="5.0"
                  value={riskState.risk_percent_per_trade}
                  onChange={(e) => handleRiskFieldChange('risk_percent_per_trade', Number(e.target.value))}
                  className="w-full bg-bgPanel text-gold font-bold rounded p-1.5 text-xs focus:outline-none border border-borderHairline"
                />
                <span className="text-textMuted font-bold text-xs">%</span>
              </div>
              <div className="text-[9px] text-textMuted">
                Calculated dynamically via lot sizing formula
              </div>
            </div>
          </div>

          {/* Card 4: Max Concurrent Trades */}
          <div className="p-3 rounded-lg bg-bgElevated border border-borderHairline space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-textPrimary">
              <span className="flex items-center gap-1.5 text-accent">
                <Activity className="w-3.5 h-3.5" />
                Max Open Positions
              </span>
            </div>
            <div className="space-y-1.5">
              <input
                type="number"
                min="1"
                max="5"
                value={riskState.max_open_trades}
                onChange={(e) => handleRiskFieldChange('max_open_trades', Number(e.target.value))}
                className="w-full bg-bgPanel text-textPrimary font-bold rounded p-1.5 text-xs focus:outline-none border border-borderHairline"
              />
              <div className="text-[9px] text-textMuted">
                Simultaneous market exposures allowed
              </div>
            </div>
          </div>

          {/* Card 5: Daily Drawdown Circuit Breaker */}
          <div className="p-3 rounded-lg bg-bgElevated border border-borderHairline space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-textPrimary">
              <span className="flex items-center gap-1.5 text-warn">
                <ShieldAlert className="w-3.5 h-3.5" />
                Daily Loss Limit
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.5"
                  min="1.0"
                  max="10.0"
                  value={riskState.max_daily_loss_percent}
                  onChange={(e) => handleRiskFieldChange('max_daily_loss_percent', Number(e.target.value))}
                  className="w-full bg-bgPanel text-warn font-bold rounded p-1.5 text-xs focus:outline-none border border-borderHairline"
                />
                <span className="text-textMuted font-bold text-xs">%</span>
              </div>
              <div className="text-[9px] text-textMuted">
                Trading halted for day if loss threshold breached
              </div>
            </div>
          </div>

          {/* Card 6: Break-Even Profit Lock */}
          <div className="p-3 rounded-lg bg-bgElevated border border-borderHairline space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-textPrimary">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <Lock className="w-3.5 h-3.5" />
                Break-Even Migration
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <span className="text-textMuted font-bold text-xs">At</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="3.0"
                  value={riskState.move_sl_to_be_r}
                  onChange={(e) => handleRiskFieldChange('move_sl_to_be_r', Number(e.target.value))}
                  className="w-full bg-bgPanel text-cyan-300 font-bold rounded p-1.5 text-xs focus:outline-none border border-borderHairline"
                />
                <span className="text-textMuted font-bold text-xs">R Profit</span>
              </div>
              <div className="text-[9px] text-textMuted">
                Moves SL to entry price once +1.0R is reached
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
