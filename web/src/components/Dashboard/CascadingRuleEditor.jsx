'use client';

import React, { useMemo } from 'react';
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
  GitBranch, GitCommit, Split
} from 'lucide-react';

export default function CascadingRuleEditor({
  ruleGroups = [],
  onChange,
  onCompileFromText,
  rawInstructions = '',
}) {
  // Ensure default root group if empty
  const groups = useMemo(() => {
    if (!ruleGroups || ruleGroups.length === 0) {
      return [
        {
          id: 'root-group-1',
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
              action: 'entry_long_and',
              warning: null,
            },
            {
              id: 'r-4',
              category: 'session_time',
              item: 'CurrentSession',
              subField: '',
              operator: 'is_london_open',
              timeframe: '15m',
              valueType: 'none',
              value: null,
              compareField: '',
              action: 'entry_long_and',
              warning: null,
            },
          ],
        },
      ];
    }
    return ruleGroups;
  }, [ruleGroups]);

  const updateGroups = (newGroups) => {
    if (onChange) onChange(newGroups);
  };

  // Helper to change combinator of a group
  const handleCombinatorChange = (groupId, newCombinator) => {
    const next = groups.map((g) =>
      g.id === groupId ? { ...g, combinator: newCombinator } : g
    );
    updateGroups(next);
  };

  // Helper to add condition row to a group
  const handleAddRule = (groupId) => {
    const newRule = {
      id: `r-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      category: 'indicator',
      item: 'RSI',
      subField: '',
      operator: 'less_than',
      timeframe: '15m',
      valueType: 'number',
      value: 38,
      compareField: '',
      action: 'entry_long_and',
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

  // Helper to add a nested sub-group
  const handleAddGroup = () => {
    const newGroup = {
      id: `grp-${Date.now()}`,
      combinator: 'OR',
      rules: [
        {
          id: `r-${Date.now()}`,
          category: 'indicator',
          item: 'EMA',
          subField: '',
          operator: 'price_above_ema',
          timeframe: '1h',
          valueType: 'none',
          value: null,
          compareField: '',
          action: 'entry_long_and',
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
  const handleCategoryChange = (groupId, ruleId, newCategory) => {
    const availableItems = RULE_ITEMS_BY_CATEGORY[newCategory] || [];
    const firstItem = availableItems[0]?.id || '';
    const itemConfig = OPERATOR_REGISTRY[firstItem] || { operators: [] };
    const firstOp = itemConfig.operators[0] || { id: 'default', valueType: 'none' };

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
            warning: null, // clear warning upon manual edit
          };
        }),
      };
    });
    updateGroups(next);
  };

  // LEVEL 2 CASCADE: Change Specific Item
  const handleItemChange = (groupId, ruleId, newItem) => {
    const itemConfig = OPERATOR_REGISTRY[newItem] || { operators: [] };
    const firstOp = itemConfig.operators[0] || { id: 'default', valueType: 'none' };

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
  const handleOperatorChange = (groupId, ruleId, newOpId) => {
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

  const handleSubFieldChange = (groupId, ruleId, newSubField) => {
    const next = groups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        rules: g.rules.map((r) => (r.id === ruleId ? { ...r, subField: newSubField } : r)),
      };
    });
    updateGroups(next);
  };

  // LEVEL 4 CASCADE: Change Value / Compare Field / Timeframe
  const handleFieldChange = (groupId, ruleId, key, val) => {
    const next = groups.map((g) => {
      if (g.id !== groupId) return g;
      return {
        ...g,
        rules: g.rules.map((r) => (r.id === ruleId ? { ...r, [key]: val, warning: null } : r)),
      };
    });
    updateGroups(next);
  };

  // Real-time live English summary generation
  const livePlainEnglishSummary = useMemo(() => {
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
        return `${r.item}${subFieldLabel} ${tf} ${opLabel}${valStr}`;
      });

      return `(${ruleTexts.join(` ${g.combinator} `)})`;
    });

    return groupTexts.join(' AND ');
  }, [groups]);

  return (
    <div className="flex-1 flex flex-col bg-bgBase overflow-y-auto p-4 space-y-4 font-mono text-xs select-none">
      
      {/* LIVE PLAIN-ENGLISH SUMMARY BANNER */}
      <div className="p-3.5 rounded-xl bg-bgPanel border-l-4 border-l-gold space-y-1.5 shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-gold uppercase tracking-wider flex items-center gap-1.5 font-sans">
            <Sparkles className="w-3.5 h-3.5 text-gold" />
            Live Compiled Rule Logic (Source of Truth)
          </span>
          <span className="text-[9px] px-2 py-0.5 rounded bg-gold/15 text-gold font-bold">
            SYNCED TO ENGINE
          </span>
        </div>
        <p className="text-xs font-sans text-textPrimary leading-relaxed font-semibold">
          {livePlainEnglishSummary || 'No rules configured yet.'}
        </p>
      </div>

      {/* NESTED AND/OR RULE BUILDER */}
      <div className="space-y-4">
        {groups.map((group, gIdx) => (
          <div
            key={group.id}
            className="p-4 rounded-xl bg-bgPanel border border-borderHairline space-y-3 shadow-md"
          >
            {/* Group Combinator Header */}
            <div className="flex items-center justify-between border-b border-borderHairline pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-textMuted font-sans">
                  Group #{gIdx + 1} Match:
                </span>
                
                <div className="flex items-center rounded-lg bg-bgElevated p-0.5 border border-borderHairline">
                  <button
                    onClick={() => handleCombinatorChange(group.id, 'AND')}
                    className={`px-3 py-1 rounded text-[10px] font-bold transition ${
                      group.combinator === 'AND'
                        ? 'bg-up text-white shadow-sm'
                        : 'text-textMuted hover:text-textPrimary'
                    }`}
                  >
                    ALL (AND)
                  </button>
                  <button
                    onClick={() => handleCombinatorChange(group.id, 'OR')}
                    className={`px-3 py-1 rounded text-[10px] font-bold transition ${
                      group.combinator === 'OR'
                        ? 'bg-gold text-black shadow-sm'
                        : 'text-textMuted hover:text-textPrimary'
                    }`}
                  >
                    ANY (OR)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAddRule(group.id)}
                  className="px-2.5 py-1 rounded bg-bgElevated hover:bg-bgHover text-gold text-[10px] font-bold flex items-center gap-1 transition"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Condition</span>
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
              {group.rules.map((rule, rIdx) => {
                const availableItems = RULE_ITEMS_BY_CATEGORY[rule.category] || [];
                const itemConfig = OPERATOR_REGISTRY[rule.item] || { subFields: [], operators: [] };
                const hasSubFields = itemConfig.subFields && itemConfig.subFields.length > 0;

                return (
                  <div
                    key={rule.id}
                    className="p-3 rounded-lg bg-bgElevated border border-borderHairline hover:border-gold/30 transition flex flex-col space-y-2"
                  >
                    {/* Uncertainty / Ambiguity Warning Flag */}
                    {rule.warning && (
                      <div className="p-1.5 px-2 rounded bg-warn/15 text-warn text-[10px] flex items-center gap-1.5 font-sans">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span><b>AI Mapping Note:</b> {rule.warning}</span>
                      </div>
                    )}

                    {/* Cascading 5-Level Input Bar */}
                    <div className="grid grid-cols-12 gap-2 items-center">
                      
                      {/* LEVEL 1: CATEGORY (2 cols) */}
                      <div className="col-span-2 space-y-0.5">
                        <label className="text-[8px] font-bold uppercase text-textMuted block font-sans">1. Category</label>
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
                        <label className="text-[8px] font-bold uppercase text-textMuted block font-sans">2. Specific Item</label>
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
                        <label className="text-[8px] font-bold uppercase text-textMuted block font-sans">Timeframe</label>
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

                      {/* LEVEL 3: SUB-FIELD (if applicable) & CUSTOM OPERATOR (4 cols) */}
                      <div className="col-span-4 space-y-0.5">
                        <label className="text-[8px] font-bold uppercase text-textMuted block font-sans">3. Custom Technical Operator</label>
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

                      {/* LEVEL 4: VALUE / COMPARISON (2 cols) */}
                      <div className="col-span-2 space-y-0.5">
                        <label className="text-[8px] font-bold uppercase text-textMuted block font-sans">4. Threshold / Target</label>
                        {rule.valueType === 'number' ? (
                          <input
                            type="number"
                            step="any"
                            value={rule.value ?? ''}
                            onChange={(e) => handleFieldChange(group.id, rule.id, 'value', Number(e.target.value))}
                            className="w-full bg-bgPanel text-up font-bold rounded p-1.5 text-[11px] focus:outline-none border border-borderHairline"
                            placeholder="Value..."
                          />
                        ) : rule.valueType === 'compare_field' ? (
                          <input
                            type="text"
                            value={rule.compareField ?? ''}
                            onChange={(e) => handleFieldChange(group.id, rule.id, 'compareField', e.target.value)}
                            className="w-full bg-bgPanel text-accent rounded p-1.5 text-[10px] focus:outline-none border border-borderHairline"
                            placeholder="e.g. EMA_200"
                          />
                        ) : (
                          <div className="p-1.5 text-[10px] text-textMuted bg-bgPanel/50 rounded text-center border border-borderHairline">
                            Self-contained
                          </div>
                        )}
                      </div>

                      {/* DELETE ROW BUTTON (1 col) */}
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
        ))}
      </div>

      {/* BOTTOM ACTIONS BAR */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handleAddGroup}
          className="px-3 py-1.5 rounded-lg bg-bgPanel hover:bg-bgElevated text-accent text-xs font-bold flex items-center gap-1.5 border border-borderHairline transition shadow-sm"
        >
          <Split className="w-3.5 h-3.5" />
          <span>+ Add Nested Condition Group</span>
        </button>

        <div className="flex items-center gap-2 text-[10px] text-textMuted font-sans">
          <span>Manual edits persist automatically into strategy compiler AST.</span>
        </div>
      </div>
    </div>
  );
}
