'use client';

import React, { useState } from 'react';
import {
  Terminal, Play, RefreshCw, CheckCircle, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, Copy, Shield, Sparkles, Sliders,
  Database, LineChart, Code2, Bell, Cpu, Zap, Radio, Search,
  Check, Lock, Unlock, Eye, Clock, Layers, ArrowRight
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const ACTION_REGISTRY = [
  // 1. Market & Chart Data
  {
    category: 'Market & Chart Data',
    actions: [
      {
        id: 'get_ohlcv',
        name: 'get_ohlcv(timeframe, count)',
        desc: 'Fetches historical candlestick array for specified timeframe & bar count.',
        params: [
          { name: 'timeframe', type: 'select', options: ['1m', '5m', '15m', '1h', '4h', '1d'], default: '15m' },
          { name: 'count', type: 'number', default: 20 },
        ],
        isStateChanging: false,
      },
      {
        id: 'get_current_price',
        name: 'get_current_price()',
        desc: 'Fetches real-time live bid, ask, and spread pips directly from MT5 feeds.',
        params: [
          { name: 'symbol', type: 'text', default: 'XAUUSD' }
        ],
        isStateChanging: false,
      },
      {
        id: 'get_multi_timeframe_snapshot',
        name: 'get_multi_timeframe_snapshot()',
        desc: 'Captures multi-timeframe price and trend alignment across 5m, 15m, 1h, and 4h.',
        params: [],
        isStateChanging: false,
      },
      {
        id: 'get_symbol_info',
        name: 'get_symbol_info()',
        desc: 'Retrieves pip value, contract size, digits, and active session status.',
        params: [
          { name: 'symbol', type: 'text', default: 'XAUUSD' }
        ],
        isStateChanging: false,
      },
    ],
  },

  // 2. Indicators
  {
    category: 'Indicators & Oscillators',
    actions: [
      {
        id: 'calculate_indicator',
        name: 'calculate_indicator(type, params)',
        desc: 'Calculates RSI, MACD, EMA, SMA, Bollinger, ATR, Stochastic, ADX, VWAP on OHLCV.',
        params: [
          { name: 'indicator_type', type: 'select', options: ['RSI', 'EMA', 'MACD', 'BOLLINGER', 'ATR'], default: 'RSI' },
          { name: 'timeframe', type: 'select', options: ['15m', '1h', '4h', '5m'], default: '15m' },
          { name: 'period', type: 'number', default: 14 },
        ],
        isStateChanging: false,
      },
      {
        id: 'get_indicator_history',
        name: 'get_indicator_history(type, lookback)',
        desc: 'Returns series of past indicator values to detect historical divergences and crossovers.',
        params: [
          { name: 'indicator_type', type: 'select', options: ['RSI', 'EMA', 'MACD'], default: 'RSI' },
          { name: 'timeframe', type: 'select', options: ['15m', '1h', '4h'], default: '15m' },
          { name: 'count', type: 'number', default: 10 },
        ],
        isStateChanging: false,
      },
    ],
  },

  // 3. Candle & Price Action
  {
    category: 'Candlestick & Price Action',
    actions: [
      {
        id: 'detect_candle_pattern',
        name: 'detect_candle_pattern(timeframe)',
        desc: 'Identifies Hammer, Bullish/Bearish Engulfing, Morning Star, and Pin Bar formations.',
        params: [
          { name: 'timeframe', type: 'select', options: ['15m', '1h', '4h', '5m'], default: '15m' },
        ],
        isStateChanging: false,
      },
      {
        id: 'get_swing_points',
        name: 'get_swing_points(timeframe)',
        desc: 'Calculates recent swing high and swing low structure levels.',
        params: [
          { name: 'timeframe', type: 'select', options: ['15m', '1h', '4h'], default: '15m' },
        ],
        isStateChanging: false,
      },
      {
        id: 'get_support_resistance_zones',
        name: 'get_support_resistance_zones()',
        desc: 'Detects key high-volume liquidity zones and historical price pivots.',
        params: [
          { name: 'timeframe', type: 'select', options: ['15m', '1h', '4h'], default: '15m' },
        ],
        isStateChanging: false,
      },
    ],
  },

  // 4. Safety Guardrails
  {
    category: 'Safety Guardrails & Risk Filters',
    actions: [
      {
        id: 'check_spread_guard',
        name: 'check_spread_guard(maxSpread)',
        desc: 'Verifies current broker spread is below the safety threshold before entering.',
        params: [
          { name: 'maxSpread', type: 'number', default: 3.5 },
        ],
        isStateChanging: false,
      },
      {
        id: 'check_news_filter',
        name: 'check_news_filter()',
        desc: 'Checks upcoming USD high-impact economic news events (CPI, FOMC, NFP).',
        params: [],
        isStateChanging: false,
      },
      {
        id: 'check_session_filter',
        name: 'check_session_filter()',
        desc: 'Checks active trading window against London and New York Killzone schedules.',
        params: [],
        isStateChanging: false,
      },
      {
        id: 'calculate_position_size',
        name: 'calculate_position_size(balance, risk%, sl)',
        desc: 'Calculates exact lot size based on account balance and stop loss distance.',
        params: [
          { name: 'balance', type: 'number', default: 462.14 },
          { name: 'riskPercent', type: 'number', default: 1.0 },
          { name: 'slPips', type: 'number', default: 20 },
        ],
        isStateChanging: false,
      },
    ],
  },

  // 5. Trade Execution
  {
    category: 'Trade Execution & Alerts',
    actions: [
      {
        id: 'place_order',
        name: 'place_order(symbol, action, lot, sl, tp)',
        desc: 'Places a market or limit order with automatic SL and TP parameters.',
        params: [
          { name: 'action', type: 'select', options: ['BUY', 'SELL'], default: 'BUY' },
          { name: 'lotSize', type: 'number', default: 0.02 },
          { name: 'slPips', type: 'number', default: 20 },
          { name: 'tpPips', type: 'number', default: 45 },
        ],
        isStateChanging: true,
      },
      {
        id: 'send_telegram_alert',
        name: 'send_telegram_alert(message)',
        desc: 'Dispatches instant signal alert with technical confluence to Telegram channel.',
        params: [
          { name: 'message', type: 'text', default: '🚨 [GOLD//AI Alert] 15m Hammer Reversal Confirmed at 2735.50' },
        ],
        isStateChanging: true,
      },
    ],
  },
];

export default function ActionsToolsPanel({ currentStrategy }) {
  // Manual Console State
  const [selectedActionId, setSelectedActionId] = useState('calculate_indicator');
  const [paramValues, setParamValues] = useState({
    indicator_type: 'RSI',
    timeframe: '15m',
    period: 14,
    count: 20,
    maxSpread: 3.5,
    balance: 462.14,
    riskPercent: 1.0,
    slPips: 20,
    tpPips: 45,
    lotSize: 0.02,
    message: '🚨 [GOLD//AI Alert] 15m Hammer Reversal Confirmed',
    symbol: 'XAUUSD',
  });

  const [dryRun, setDryRun] = useState(true);
  const [running, setRunning] = useState(false);
  const [testOutput, setTestOutput] = useState(null);
  const [sessionLogs, setSessionLogs] = useState([]);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [showLiveConfirmModal, setShowLiveConfirmModal] = useState(false);

  // Determine tools used by current strategy
  const playbook = currentStrategy?.compiledPlaybook;
  const usedToolIds = new Set(['get_current_price', 'get_ohlcv']);
  if (playbook?.candle_patterns?.length) usedToolIds.add('detect_candle_pattern');
  if (playbook?.indicators?.length) usedToolIds.add('calculate_indicator');
  if (playbook?.guardrails?.max_spread_pips) usedToolIds.add('check_spread_guard');
  if (playbook?.guardrails?.news_blackout_minutes) usedToolIds.add('check_news_filter');
  if (playbook?.guardrails?.allowed_sessions?.length) usedToolIds.add('check_session_filter');
  if (playbook?.risk_parameters) usedToolIds.add('calculate_position_size');
  if (currentStrategy?.executionMode === 'auto_execute') usedToolIds.add('place_order');
  else usedToolIds.add('send_telegram_alert');

  const allActionsFlat = ACTION_REGISTRY.flatMap(c => c.actions);
  const totalActionsCount = allActionsFlat.length;
  const usedActionsCount = Array.from(usedToolIds).filter(id => allActionsFlat.some(a => a.id === id)).length;

  const currentAction = allActionsFlat.find(a => a.id === selectedActionId) || allActionsFlat[0];

  const handleParamChange = (name, value) => {
    setParamValues(prev => ({ ...prev, [name]: value }));
  };

  const executeAction = async (forceReal = false) => {
    if (currentAction.isStateChanging && !dryRun && !forceReal) {
      setShowLiveConfirmModal(true);
      return;
    }

    setRunning(true);
    try {
      const res = await fetch(`${API_BASE}/api/strategy/execute-tool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: currentAction.id,
          params: paramValues,
          dryRun: forceReal ? false : dryRun,
        }),
      });

      const data = await res.json();
      setTestOutput(data);

      // Add to session log history
      const logEntry = {
        id: Date.now(),
        action: currentAction.name,
        actionId: currentAction.id,
        timestamp: new Date().toLocaleTimeString(),
        durationMs: data.executionDurationMs || 12,
        dryRun: data.dryRun,
        status: data.success ? 'SUCCESS' : 'ERROR',
        output: data.output,
      };
      setSessionLogs(prev => [logEntry, ...prev.slice(0, 15)]);
    } catch (e) {
      setTestOutput({ success: false, error: e.message });
    } finally {
      setRunning(false);
      setShowLiveConfirmModal(false);
    }
  };

  const handleCopyOutput = () => {
    if (!testOutput) return;
    navigator.clipboard.writeText(JSON.stringify(testOutput, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleCategory = (catName) => {
    setCollapsedCategories(prev => ({ ...prev, [catName]: !prev[catName] }));
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-bgBase font-sans text-xs select-none">

      {/* LEFT COLUMN: FULL ACTION REGISTRY (Width: 440px) */}
      <div className="w-[440px] flex-shrink-0 border-r border-borderHairline flex flex-col bg-bgPanel overflow-hidden">
        
        {/* Header & Usage Summary (Part 2) */}
        <div className="p-3 border-b border-borderHairline bg-bgElevated space-y-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-accent uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Cpu className="w-4 h-4 text-accent" />
              AI Action & Tool Registry
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-accent/15 text-accent font-bold font-mono">
              {totalActionsCount} TOOLS READY
            </span>
          </div>

          {/* Strategy Usage Badge */}
          <div className="p-2 rounded bg-bgPanel text-[10px] text-textSecondary flex items-center justify-between font-mono">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-up" />
              <span>Strategy Usage:</span>
              <b className="text-textPrimary">{usedActionsCount} of {totalActionsCount}</b> actions active
            </div>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-up/15 text-up font-bold">
              {Math.round((usedActionsCount / totalActionsCount) * 100)}%
            </span>
          </div>

          {/* Search Filter */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-textMuted absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search actions (e.g. 'rsi', 'order', 'candle')..."
              className="w-full bg-bgPanel rounded pl-8 pr-2.5 py-1.5 text-xs text-textPrimary placeholder:text-textMuted focus:outline-none"
            />
          </div>
        </div>

        {/* Scrollable Action List (Part 1 & 2) */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono">
          {ACTION_REGISTRY.map((cat, catIdx) => {
            const isCollapsed = collapsedCategories[cat.category];
            const filteredActions = cat.actions.filter(a =>
              a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              a.desc.toLowerCase().includes(searchQuery.toLowerCase())
            );

            if (searchQuery && filteredActions.length === 0) return null;

            return (
              <div key={catIdx} className="space-y-1.5">
                {/* Category Accordion Header */}
                <button
                  onClick={() => toggleCategory(cat.category)}
                  className="w-full flex items-center justify-between text-[10px] uppercase font-bold text-textMuted hover:text-textPrimary px-1 py-1 transition"
                >
                  <span>{cat.category} ({filteredActions.length})</span>
                  {isCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                </button>

                {/* Action Cards */}
                {!isCollapsed && (
                  <div className="space-y-1">
                    {filteredActions.map((action) => {
                      const isSelected = selectedActionId === action.id;
                      const isUsedByStrategy = usedToolIds.has(action.id);

                      return (
                        <div
                          key={action.id}
                          onClick={() => setSelectedActionId(action.id)}
                          className={`p-2.5 rounded-lg cursor-pointer transition flex flex-col justify-between space-y-1.5 ${
                            isSelected
                              ? 'bg-bgElevated text-textPrimary border-l-2 border-l-gold shadow-sm'
                              : isUsedByStrategy
                              ? 'bg-bgElevated/50 text-textPrimary hover:bg-bgElevated'
                              : 'bg-transparent text-textMuted hover:text-textPrimary hover:bg-bgElevated/30 opacity-70'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[11px] text-textPrimary truncate">{action.name}</span>
                            
                            <div className="flex items-center gap-1.5">
                              {isUsedByStrategy && (
                                <span className="text-[8px] px-1.5 py-0.2 rounded bg-up/15 text-up font-bold flex items-center gap-0.5">
                                  <Check className="w-2.5 h-2.5" />
                                  ACTIVE IN STRATEGY
                                </span>
                              )}
                              {action.isStateChanging && (
                                <span className="text-[8px] px-1.5 py-0.2 rounded bg-warn/15 text-warn font-bold">
                                  STATEFUL
                                </span>
                              )}
                            </div>
                          </div>

                          <p className="text-[10px] text-textSecondary font-sans leading-tight">
                            {action.desc}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT COLUMN: MANUAL TEST CONSOLE & RUNNING LOGS (Part 3) */}
      <div className="flex-1 flex flex-col overflow-hidden bg-bgBase">
        
        {/* Top Console Bar */}
        <div className="h-11 px-4 bg-bgPanel border-b border-borderHairline flex items-center justify-between flex-shrink-0 font-mono">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-gold" />
            <span className="font-bold text-textPrimary text-xs uppercase">Manual Action Test Console</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-gold/15 text-gold font-bold">
              {currentAction?.name}
            </span>
          </div>

          {/* Dry Run Toggle */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className={dryRun ? 'text-up font-bold' : 'text-down font-bold'}>
                {dryRun ? '🛡️ DRY RUN (SAFE)' : '⚠️ LIVE EXECUTION'}
              </span>
              <button
                onClick={() => setDryRun(!dryRun)}
                className={`px-2 py-1 rounded text-[9px] font-bold transition ${
                  dryRun ? 'bg-up/20 text-up' : 'bg-down/20 text-down animate-pulse'
                }`}
              >
                {dryRun ? 'SWITCH TO LIVE' : 'SWITCH TO DRY RUN'}
              </button>
            </div>

            {/* Run Action Button */}
            <button
              onClick={() => executeAction(false)}
              disabled={running}
              className="h-7 px-4 bg-gold hover:bg-gold-hover text-black font-bold rounded flex items-center gap-1.5 text-[11px] transition shadow-sm disabled:opacity-50"
            >
              <Play className={`w-3 h-3 ${running ? 'animate-spin' : ''}`} />
              <span>{running ? 'Executing...' : 'Run Action'}</span>
            </button>
          </div>
        </div>

        {/* Console Workspace */}
        <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4 font-mono">
          
          {/* Dynamic Parameters Input Form */}
          <div className="p-4 rounded-xl bg-bgPanel space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-textPrimary uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-accent" />
                Action Parameters: {currentAction?.name}
              </span>
              <span className="text-[10px] text-textMuted">Auto-generated schema form</span>
            </div>

            {currentAction.params.length === 0 ? (
              <div className="p-3 text-textMuted text-xs rounded bg-bgElevated">
                This action requires no input parameters. Click <b>&quot;Run Action&quot;</b> to execute immediately.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {currentAction.params.map((param) => (
                  <div key={param.name} className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-textMuted block">
                      {param.name}
                    </label>

                    {param.type === 'select' ? (
                      <select
                        value={paramValues[param.name] ?? param.default}
                        onChange={(e) => handleParamChange(param.name, e.target.value)}
                        className="w-full bg-bgElevated text-textPrimary rounded p-2 text-xs focus:outline-none"
                      >
                        {param.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={param.type === 'number' ? 'number' : 'text'}
                        value={paramValues[param.name] ?? param.default}
                        onChange={(e) => handleParamChange(param.name, param.type === 'number' ? Number(e.target.value) : e.target.value)}
                        className="w-full bg-bgElevated text-textPrimary rounded p-2 text-xs focus:outline-none"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Raw Output Box */}
          <div className="p-4 rounded-xl bg-bgPanel space-y-2 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-3.5 h-3.5 text-up" />
                <span className="text-[11px] font-bold text-textPrimary uppercase tracking-wider">Raw JSON Response</span>
                {testOutput && (
                  <span className="text-[9px] px-2 py-0.2 rounded bg-up/15 text-up font-bold tabular-nums">
                    {testOutput.executionDurationMs || 10}ms latency
                  </span>
                )}
              </div>

              {testOutput && (
                <button
                  onClick={handleCopyOutput}
                  className="px-2.5 py-1 rounded bg-bgElevated hover:bg-bgHover text-textSecondary hover:text-textPrimary text-[10px] font-bold flex items-center gap-1 transition"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
                </button>
              )}
            </div>

            {!testOutput ? (
              <div className="p-8 text-center text-textMuted rounded bg-bgElevated text-xs flex flex-col items-center justify-center gap-2">
                <Terminal className="w-8 h-8 text-textMuted/30" />
                <span>Select an action and click <b>&quot;Run Action&quot;</b> to view live server output.</span>
              </div>
            ) : (
              <pre className="p-4 rounded-lg bg-bgBase text-[11px] text-emerald-400 overflow-x-auto max-h-72 overflow-y-auto leading-relaxed">
                {JSON.stringify(testOutput, null, 2)}
              </pre>
            )}
          </div>

          {/* Session Execution History Log */}
          <div className="p-4 rounded-xl bg-bgPanel space-y-2 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-textPrimary uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gold" />
                Session Test History ({sessionLogs.length})
              </span>
              <span className="text-[9px] text-textMuted">Latest 15 runs in this session</span>
            </div>

            {sessionLogs.length === 0 ? (
              <div className="p-3 text-textMuted text-xs rounded bg-bgElevated text-center">
                No manual test runs recorded in this session yet.
              </div>
            ) : (
              <div className="space-y-1.5">
                {sessionLogs.map((log) => (
                  <div
                    key={log.id}
                    onClick={() => setTestOutput({ success: true, action: log.actionId, executionDurationMs: log.durationMs, dryRun: log.dryRun, output: log.output })}
                    className="p-2.5 rounded-lg bg-bgElevated hover:bg-bgHover cursor-pointer transition flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${log.status === 'SUCCESS' ? 'bg-up' : 'bg-down'}`} />
                      <span className="font-bold text-textPrimary">{log.action}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/40 text-textMuted">
                        {log.dryRun ? 'DRY RUN' : 'REAL'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 tabular-nums text-textMuted text-[10px]">
                      <span>{log.durationMs}ms</span>
                      <span>{log.timestamp}</span>
                      <ArrowRight className="w-3 h-3 text-gold" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Safety Confirmation Modal for Real State-Changing Actions */}
      {showLiveConfirmModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-bgPanel rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-fadeIn font-sans">
            <div className="flex items-center gap-2.5 text-down">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 animate-pulse" />
              <h3 className="text-base font-bold text-white">Execute Real Action Confirmation</h3>
            </div>

            <p className="text-xs text-textSecondary leading-relaxed">
              You are about to execute <b className="text-white">&quot;{currentAction.name}&quot;</b> with <b>DRY RUN OFF</b>.
            </p>

            <div className="p-3 rounded-lg bg-down/15 text-down text-xs space-y-1 font-bold">
              <div>⚠️ CRITICAL ACTION:</div>
              <div className="font-normal text-slate-200">
                This will place a real trade order or dispatch a real broadcast message to your live broker or Telegram channel.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-borderHairline">
              <button
                onClick={() => setShowLiveConfirmModal(false)}
                className="px-4 py-2 rounded-lg bg-bgElevated hover:bg-bgHover text-textSecondary hover:text-textPrimary text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={() => executeAction(true)}
                className="px-4 py-2 rounded-lg bg-down hover:brightness-110 text-white text-xs font-bold transition shadow-lg flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Execute Real Action</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
