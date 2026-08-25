'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, Save, Sparkles, ToggleLeft, ToggleRight,
  Check, Clock, Shield, RefreshCw, Plus, Trash2, BookOpen,
  Cpu, CheckCircle2, AlertTriangle, Eye, Layers, ChevronRight,
  Activity, Zap, Compass, BarChart2, Play, Award, CheckCircle,
  XCircle, Code2, Terminal, TrendingUp, TrendingDown, History, RotateCcw,
  HelpCircle, ChevronDown, ChevronUp, Copy, ShieldAlert, Sparkle,
  Sliders, SlidersHorizontal, ArrowUpRight, ArrowDownRight, Folder,
  FileCode2, ShieldCheck, Target, CheckSquare, AlertCircle, Info,
  Flame, Radio
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const EXAMPLE_STRATEGIES = [
  {
    title: '15m Reversal Scalper',
    desc: 'Catches trend exhaustion with 15m Hammer/Engulfing candles in oversold/overbought zones.',
    instructions: `# 15m Hammer & RSI Reversal Scalper
- Primary Timeframe: 15m, Higher Timeframe: 1h trend direction.
- Entry Trigger: Buy when a Bullish Hammer or Bullish Engulfing candle forms at support AND 15m RSI is below 38.
- Entry Trigger Short: Sell when Shooting Star or Bearish Engulfing forms at resistance AND 15m RSI is above 62.
- Risk/Reward: Target minimum 1:2.5 RR.
- Stop Loss: 2 pips beyond the trigger candle wick.
- Session: London Open (07:00 - 10:00 UTC) and NY Open (12:00 - 15:00 UTC).`,
  },
  {
    title: 'London & NY Killzone Sweep',
    desc: 'Waits for Asian session high/low sweep during London/NY open before entering on market structure shift.',
    instructions: `# London & NY Killzone Liquidity Sweep
- Execution Window: London Open (07:00 - 10:00 UTC) and NY Open (12:00 - 15:00 UTC).
- Rule 1: Wait for price to sweep Asian Session High (for Sell) or Asian Low (for Buy).
- Rule 2: Confirm with 15m Market Structure Shift (MSS) and Fair Value Gap (FVG) creation.
- Rule 3: Check Silver (XAG/USD) SMT Divergence confirmation.
- Risk Management: 1% risk per trade. Move Stop Loss to Break-Even at 1.0R. Take 50% partials at 1.5R.`,
  },
  {
    title: 'Conservative 1H Trend Follower',
    desc: 'Trades strictly in the direction of the 1H 50/200 EMA trend on 15m pullbacks.',
    instructions: `# Conservative 1H Trend Follower
- Timeframe: 1H Trend Filter, 15m Entry Execution.
- Trend Condition: 1H EMA 21 > EMA 50 > EMA 200 for Bullish trend.
- Entry Trigger: Wait for 15m pullback into the EMA 21 zone with Bullish Candlestick confirmation.
- Exit Protocol: Target previous swing high (minimum 1:2.0 RR). Stop Loss below the recent swing low.
- Risk: 0.5% - 1.0% per trade. Avoid trading during high-impact USD news.`,
  },
];

export default function StrategyPanel({ onStrategySaved }) {
  // Strategy State
  const [strategies, setStrategies] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [currentStrategy, setCurrentStrategy] = useState(null);
  const [instructions, setInstructions] = useState('');
  const [title, setTitle] = useState('');

  // Sub-tabs: 'editor' | 'hud' | 'playbook' | 'backtest' | 'history'
  const [activeSubTab, setActiveSubTab] = useState('editor');

  // Preview Confirmation Modal State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewSpec, setPreviewSpec] = useState(null);
  const [compilingPreview, setCompilingPreview] = useState(false);
  const [activating, setActivating] = useState(false);

  // Delete Confirmation Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Example Library Toggle
  const [showExamples, setShowExamples] = useState(false);

  // Live Rule Conformance HUD State
  const [hudData, setHudData] = useState(null);
  const [hudLoading, setHudLoading] = useState(false);

  // Backtest State
  const [backtestData, setBacktestData] = useState(null);
  const [backtesting, setBacktesting] = useState(false);

  // Status & Loading Flags
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saveToast, setSaveToast] = useState(null);

  // New Strategy Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const textareaRef = useRef(null);

  const showToast = (text, type = 'success') => {
    setSaveToast({ text, type });
    setTimeout(() => setSaveToast(null), 4000);
  };

  // Fetch Strategy List
  const fetchStrategies = useCallback(async (selectId = null) => {
    try {
      const res = await fetch(`${API_BASE}/api/strategy/list`);
      if (res.ok) {
        const data = await res.json();
        setStrategies(data.strategies || []);
        const targetId = selectId || data.activeId || data.strategies[0]?.id;
        setActiveId(data.activeId);

        const target = data.strategies.find((s) => s.id === targetId) || data.strategies[0];
        if (target) {
          setCurrentStrategy(target);
          setInstructions(target.instructions || '');
          setTitle(target.title || '');
        }
      }
    } catch (e) {
      console.error('Failed loading strategies:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Live Rule Conformance HUD
  const fetchHUD = useCallback(async () => {
    setHudLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/strategy/conformance-hud`);
      if (res.ok) {
        const data = await res.json();
        setHudData(data);
      }
    } catch (e) {
      console.error('HUD fetch error:', e);
    } finally {
      setHudLoading(false);
    }
  }, []);

  // Run MT5 Backtest
  const runBacktest = useCallback(async () => {
    setBacktesting(true);
    try {
      const res = await fetch(`${API_BASE}/api/strategy/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candleCount: 250 }),
      });
      if (res.ok) {
        const data = await res.json();
        setBacktestData(data);
      }
    } catch (e) {
      console.error('Backtest fetch error:', e);
    } finally {
      setBacktesting(false);
    }
  }, []);

  useEffect(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  useEffect(() => {
    if (activeSubTab === 'hud') {
      fetchHUD();
      const interval = setInterval(fetchHUD, 4000);
      return () => clearInterval(interval);
    }
    if (activeSubTab === 'backtest' && !backtestData) {
      runBacktest();
    }
  }, [activeSubTab, fetchHUD, runBacktest, backtestData]);

  const handleSelectStrategy = (strat) => {
    setCurrentStrategy(strat);
    setInstructions(strat.instructions || '');
    setTitle(strat.title || '');
    setTestResult(null);
  };

  // Save Raw Instructions
  const handleSave = async () => {
    if (!currentStrategy) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/strategy/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentStrategy.id,
          title,
          instructions,
        }),
      });
      if (res.ok) {
        showToast('Strategy Instructions saved', 'success');
        await fetchStrategies(currentStrategy.id);
      } else {
        showToast('Failed saving strategy', 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Compile Preview Trigger
  const handleCompilePreview = async () => {
    if (!instructions.trim()) {
      showToast('Please write strategy instructions first', 'warn');
      return;
    }
    setCompilingPreview(true);
    try {
      const res = await fetch(`${API_BASE}/api/strategy/compile-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentStrategy?.id,
          instructions,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.needsClarification) {
          showToast(`Clarification needed: ${data.clarification?.question_to_user}`, 'warn');
          return;
        }
        setPreviewSpec(data.previewSpec);
        setShowPreviewModal(true);
      } else {
        showToast('Compilation error', 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setCompilingPreview(false);
    }
  };

  // Confirm & Activate Trigger
  const handleConfirmActivate = async () => {
    if (!currentStrategy || !previewSpec) return;
    setActivating(true);
    try {
      const res = await fetch(`${API_BASE}/api/strategy/confirm-activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentStrategy.id,
          instructions,
          compiledSpec: previewSpec,
          executionMode: currentStrategy.executionMode || 'auto_execute',
        }),
      });
      if (res.ok) {
        setShowPreviewModal(false);
        showToast(`"${previewSpec.title}" is now LIVE 24/7`, 'success');
        setActiveSubTab('playbook');
        await fetchStrategies(currentStrategy.id);
      } else {
        showToast('Failed activating strategy', 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setActivating(false);
    }
  };

  // Delete Strategy
  const handleConfirmDelete = async () => {
    if (!currentStrategy || strategies.length <= 1) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/strategy/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentStrategy.id }),
      });
      if (res.ok) {
        setShowDeleteModal(false);
        showToast(`Strategy "${currentStrategy.title}" deleted`, 'warn');
        await fetchStrategies();
      } else {
        showToast('Failed deleting strategy', 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Rollback to historical version
  const handleRollback = async (versionNumber) => {
    if (!currentStrategy) return;
    if (!confirm(`Revert to Strategy Version #${versionNumber}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/strategy/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentStrategy.id,
          version: versionNumber,
        }),
      });
      if (res.ok) {
        showToast(`Reverted to Version #${versionNumber}`, 'success');
        await fetchStrategies(currentStrategy.id);
      }
    } catch (e) {
      showToast('Rollback error: ' + e.message, 'error');
    }
  };

  // Set as Active 24/7 Strategy
  const handleSetActive = async () => {
    if (!currentStrategy) return;
    try {
      const res = await fetch(`${API_BASE}/api/strategy/set-active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentStrategy.id }),
      });
      if (res.ok) {
        setActiveId(currentStrategy.id);
        showToast(`"${currentStrategy.title}" is now ACTIVE 24/7`, 'success');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  // Create New Strategy
  const handleCreateStrategy = async () => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/strategy/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          instructions: `# Custom Strategy Directives\n- 15m timeframe: Look for Hammer or Bullish Engulfing candles.\n- Risk/Reward 1:2.0.`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowNewModal(false);
        setNewTitle('');
        showToast('New Strategy created', 'success');
        await fetchStrategies(data.strategy.id);
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  // Test Strategy on Live Market
  const handleTestOnMarket = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/strategy/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions }),
      });
      if (res.ok) {
        const data = await res.json();
        setTestResult(data.evaluation);
      }
    } catch (e) {
      setTestResult({ reply: 'Error: ' + e.message });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-bgBase text-textMuted font-mono text-xs">
        <RefreshCw className="w-5 h-5 animate-spin text-gold mr-2" />
        <span>Loading Strategy Directives Hub...</span>
      </div>
    );
  }

  const isCurrentActive = currentStrategy?.id === activeId;
  const playbook = currentStrategy?.compiledPlaybook;
  const historyList = currentStrategy?.history || [];
  const executionMode = currentStrategy?.executionMode || 'auto_execute';

  const charCount = instructions.length;
  const wordCount = instructions.trim() ? instructions.trim().split(/\s+/).length : 0;
  const ruleCount = (instructions.match(/^[ \t]*[-*•\d+.]/gm) || []).length;

  const SUB_NAV_ITEMS = [
    { id: 'editor', title: 'Strategy Editor', subtitle: 'Write rules & live test', icon: FileText },
    { id: 'hud', title: 'Live Rule Conformance', subtitle: 'Real-time rule matrix', icon: CheckCircle2, color: 'text-up' },
    { id: 'playbook', title: 'Operational Mandate', subtitle: 'Compiled AI playbook', icon: BookOpen, color: 'text-accent' },
    { id: 'backtest', title: 'MT5 Backtest & Tuning', subtitle: 'Historical simulation', icon: BarChart2, color: 'text-warn' },
    { id: 'history', title: 'Version History', subtitle: 'Audit log & rollback', icon: History, color: 'text-accent' },
  ];

  return (
    <div className="flex-1 flex h-full bg-bgBase text-textPrimary font-mono text-xs overflow-hidden select-none">

      {/* TIER 1: PRIMARY LEFT SIDEBAR (Width: 220px) */}
      <div className="w-[220px] flex-shrink-0 bg-bgPanel border-r border-borderHairline flex flex-col justify-between overflow-y-auto">
        <div className="p-3 space-y-2.5">
          
          {/* Integrated Header (Issue 2 Fixed) */}
          <div className="flex items-center justify-between border-b border-borderHairline pb-2">
            <div className="flex items-center gap-1.5 font-bold text-textSecondary text-[10px] uppercase tracking-wider">
              <Cpu className="w-3.5 h-3.5 text-gold" />
              <span>Strategies</span>
            </div>
            <button
              onClick={() => setShowNewModal(true)}
              className="p-1 bg-bgElevated hover:bg-bgHover text-gold border border-borderHairline rounded transition"
              title="Create New Strategy"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Single Strategy Notice */}
          <div className="p-2 rounded bg-bgElevated border border-borderHairline text-[9px] text-textSecondary leading-snug flex items-start gap-1.5">
            <Info className="w-3 h-3 text-gold flex-shrink-0 mt-0.5" />
            <span><b>Single-Engine Mode:</b> 1 strategy active at a time. Switching auto-switches live execution.</span>
          </div>

          {/* Clean Selected Strategy Cards (No Double Borders) */}
          <div className="space-y-1.5">
            {strategies.map((strat) => {
              const isSelected = currentStrategy?.id === strat.id;
              const isActive247 = activeId === strat.id;
              const winRate = strat.compiledPlaybook ? '64.2%' : 'Untested';

              return (
                <button
                  key={strat.id}
                  onClick={() => handleSelectStrategy(strat)}
                  className={`w-full p-2.5 rounded-lg text-left transition duration-150 flex flex-col justify-between space-y-1.5 ${
                    isSelected
                      ? 'bg-bgElevated text-gold border-l-2 border-l-gold border-y-transparent border-r-transparent font-bold shadow-sm'
                      : 'bg-bgElevated/50 text-textMuted hover:text-textPrimary hover:bg-bgElevated border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[11px] font-bold text-textPrimary">{strat.title}</span>
                    <span className="text-[8px] px-1.5 py-0.2 rounded bg-black/40 text-textSecondary font-mono font-bold">
                      v{strat.history?.length || 1}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[9px] tabular-nums">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1 py-0.2 rounded bg-black/40 text-textSecondary font-mono">15m</span>
                      {strat.compiledPlaybook && (
                        <span className="text-up font-bold flex items-center gap-0.5">
                          <TrendingUp className="w-2.5 h-2.5 text-up" />
                          {winRate}
                        </span>
                      )}
                    </div>

                    {isActive247 ? (
                      <span className="text-up font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-up animate-live-dot" />
                        ACTIVE
                      </span>
                    ) : (
                      <span className="text-textMuted">STANDBY</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Execution Controller Card (Issue 7 Fixed) */}
        <div className="p-3 border-t border-borderHairline bg-bgBase space-y-2">
          <div className="p-2.5 rounded-lg bg-bgElevated border border-borderHairline space-y-2">
            <div className="flex items-center justify-between text-[9px] uppercase font-bold text-textMuted">
              <span>Live Engine</span>
              <span className={isCurrentActive ? 'text-up font-bold' : 'text-textMuted'}>
                {isCurrentActive ? 'RUNNING' : 'IDLE'}
              </span>
            </div>

            <button
              onClick={handleSetActive}
              className={`w-full py-1.5 px-2 rounded font-bold text-[10px] flex items-center justify-center gap-1.5 transition duration-150 border ${
                isCurrentActive
                  ? 'bg-up/20 text-up border-up/40 shadow-sm'
                  : 'bg-bgPanel text-textMuted border-borderHairline hover:border-white/20 hover:text-textPrimary'
              }`}
            >
              {isCurrentActive ? <ToggleRight className="w-4 h-4 text-up" /> : <ToggleLeft className="w-4 h-4" />}
              <span>{isCurrentActive ? '24/7 SCANNING: ON' : 'ACTIVATE FOR 24/7'}</span>
            </button>

            <div className={`p-1.5 rounded text-center text-[9px] font-bold border ${
              executionMode === 'auto_execute'
                ? 'bg-up/15 text-up border-up/30'
                : 'bg-warn/15 text-warn border-warn/30'
            }`}>
              <div className="flex items-center justify-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${executionMode === 'auto_execute' ? 'bg-up animate-live-dot' : 'bg-warn'}`} />
                <span>{executionMode === 'auto_execute' ? 'AUTO-EXECUTE (REAL TRADES)' : 'WATCH-ONLY (ALERTS)'}</span>
              </div>
              <p className="text-[8px] opacity-75 mt-0.5 font-normal">
                {executionMode === 'auto_execute' ? 'Auto-places orders on Exness MT5' : 'Generates alerts only'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowNewModal(true)}
            className="w-full py-1.5 bg-bgElevated hover:bg-bgHover text-gold border border-borderHairline rounded font-bold text-[10px] flex items-center justify-center gap-1 transition duration-150"
          >
            <Plus className="w-3 h-3" />
            <span>+ Create New Strategy</span>
          </button>
        </div>
      </div>

      {/* TIER 2: SECONDARY SUB-SIDEBAR (Width: 210px) */}
      <div className="w-[210px] flex-shrink-0 bg-bgElevated border-r border-borderHairline flex flex-col justify-between overflow-y-auto">
        <div className="p-3 space-y-3">
          
          {/* Integrated Sub-Sidebar Header (Issue 2 Fixed) */}
          <div className="border-b border-borderHairline pb-2.5">
            <h3 className="font-bold text-textPrimary text-sm truncate">{currentStrategy?.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-bgPanel text-textSecondary font-mono border border-borderHairline">
                v{currentStrategy?.history?.length || 1}
              </span>
              <span className="text-[9px] text-textMuted font-mono">
                {currentStrategy?.updatedAt ? new Date(currentStrategy.updatedAt).toLocaleTimeString() : 'Draft'}
              </span>
            </div>
          </div>

          {/* Clean Functional Navigation */}
          <div className="space-y-1">
            {SUB_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSubTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSubTab(item.id);
                    if (item.id === 'hud') fetchHUD();
                    if (item.id === 'backtest' && !backtestData) runBacktest();
                  }}
                  className={`w-full p-2.5 rounded-lg text-left transition duration-150 flex items-center gap-2.5 ${
                    isActive
                      ? 'bg-bgPanel text-textPrimary font-bold shadow-sm'
                      : 'text-textMuted hover:text-textPrimary hover:bg-bgPanel/50 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? (item.color || 'text-gold') : 'text-textMuted'}`} />
                  <div className="truncate">
                    <div className={`text-[11px] ${isActive ? 'text-textPrimary font-bold' : ''}`}>{item.title}</div>
                    <div className="text-[8px] text-textMuted leading-tight">{item.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Delete Action with Safe Modal Trigger */}
        <div className="p-3 border-t border-borderHairline bg-bgBase space-y-2">
          {strategies.length > 1 && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-full py-1.5 px-2 bg-down/10 hover:bg-down/20 text-down border border-down/30 rounded font-bold text-[10px] flex items-center justify-center gap-1.5 transition duration-150"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete This Strategy</span>
            </button>
          )}
        </div>
      </div>

      {/* TIER 3: MAIN CONTENT WORKSPACE */}
      <div className="flex-1 flex flex-col overflow-hidden bg-bgBase">

        {/* Top Header Bar (No Stray Outlines) */}
        <div className="h-11 px-4 bg-bgPanel border-b border-borderHairline flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-textPrimary uppercase">{currentStrategy?.title}</span>
            <span className="text-[10px] text-gold px-2 py-0.5 rounded bg-gold/15 border border-gold/30 font-semibold">
              {SUB_NAV_ITEMS.find(n => n.id === activeSubTab)?.title}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {saveToast && (
              <span
                className={`text-[10px] px-2.5 py-0.5 rounded font-bold border ${
                  saveToast.type === 'success'
                    ? 'bg-up/20 text-up border-up/30'
                    : saveToast.type === 'warn'
                    ? 'bg-gold/20 text-gold border-gold/30'
                    : 'bg-down/20 text-down border-down/30'
                }`}
              >
                {saveToast.text}
              </span>
            )}

            {/* Load Instructions & Compile Action */}
            <button
              onClick={handleCompilePreview}
              disabled={compilingPreview}
              className="h-7 px-3.5 bg-accent hover:bg-accentHover text-black font-bold rounded flex items-center gap-1.5 transition duration-150 shadow-sm disabled:opacity-50 text-[11px]"
              title="Parse instructions and show full preview before going live"
            >
              <Sparkles className={`w-3.5 h-3.5 ${compilingPreview ? 'animate-spin' : ''}`} />
              <span>{compilingPreview ? 'AI Parsing...' : 'Load Instructions & Compile'}</span>
            </button>

            {/* Save Raw Instructions Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-7 px-3 bg-gold hover:bg-gold-hover text-black font-bold rounded flex items-center gap-1.5 transition duration-150 shadow-sm disabled:opacity-50 text-[11px]"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </div>

        {/* WORKSPACE CONTENT PER ACTIVE TAB */}
        <div className="flex-1 flex overflow-hidden">

          {/* TAB 1: STRATEGY EDITOR */}
          {activeSubTab === 'editor' && (
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Textarea Editor & Inline Guidance */}
              <div className="flex-1 flex flex-col border-r border-borderHairline bg-bgBase overflow-hidden">
                
                {/* Title & Example Library Toggle Bar */}
                <div className="p-2 px-3 bg-bgPanel border-b border-borderHairline flex items-center justify-between text-[11px]">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Strategy Title..."
                    className="bg-transparent font-bold text-textPrimary text-sm focus:outline-none px-2 py-0.5 rounded w-1/2"
                  />
                  
                  <button
                    onClick={() => setShowExamples(!showExamples)}
                    className="px-2.5 py-1 rounded bg-bgElevated hover:bg-bgHover text-gold border border-borderHairline text-[10px] font-bold flex items-center gap-1 transition duration-150"
                  >
                    <BookOpen className="w-3 h-3" />
                    <span>{showExamples ? 'Hide Examples' : 'Example Strategy Library'}</span>
                    {showExamples ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {/* Collapsible Example Strategy Library */}
                {showExamples && (
                  <div className="p-3 bg-bgElevated border-b border-gold/30 grid grid-cols-3 gap-2 flex-shrink-0 animate-fadeIn">
                    {EXAMPLE_STRATEGIES.map((ex, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-bgPanel border border-borderHairline hover:border-gold/50 flex flex-col justify-between space-y-1.5 transition">
                        <div>
                          <div className="font-bold text-textPrimary text-[11px]">{ex.title}</div>
                          <div className="text-[9px] text-textMuted mt-0.5 leading-tight">{ex.desc}</div>
                        </div>
                        <button
                          onClick={() => {
                            setInstructions(ex.instructions);
                            setTitle(ex.title);
                            setShowExamples(false);
                            showToast(`Loaded "${ex.title}"`, 'success');
                          }}
                          className="py-1 bg-gold/15 hover:bg-gold text-gold hover:text-black border border-gold/40 rounded text-[9px] font-bold flex items-center justify-center gap-1 transition duration-150"
                        >
                          <Copy className="w-2.5 h-2.5" />
                          <span>Load Template</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Textarea Editor */}
                <textarea
                  ref={textareaRef}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Write your custom trading strategy rules here in plain English or Roman Urdu...&#10;&#10;Examples:&#10;1. 15m timeframe pe jab Hammer ya Bullish Engulfing candle bane aur RSI 38 se kam ho to BUY trade lo.&#10;2. Stop Loss candle wick ke 2 pips neechay rakho aur target 1:2.5 Risk to Reward.&#10;3. London Open (07:00 - 10:00 UTC) aur NY Open mein trade lo.&#10;4. Click 'Load Instructions & Compile' to preview what the AI understood before activating."
                  className="flex-1 p-4 bg-transparent text-textPrimary font-mono text-[12px] leading-relaxed resize-none focus:outline-none selection:bg-gold/20"
                  spellCheck="false"
                />

                {/* Inline Guidance & Metrics Bar */}
                <div className="p-2 px-3 bg-bgPanel border-t border-borderHairline flex items-center justify-between text-[10px] text-textMuted flex-shrink-0 tabular-nums">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-3 h-3 text-accent" />
                    <span><b>Pro-Tip:</b> Include <b>Timeframe</b> (15m/1h), <b>Candle Trigger</b> (Hammer/Engulfing), and <b>SL/TP ratio</b> (1:2.0).</span>
                  </div>

                  <div className="flex items-center gap-3 font-mono">
                    <span>Rules: <b className="text-textPrimary">{ruleCount}</b></span>
                    <span>Words: <b className="text-textPrimary">{wordCount}</b></span>
                    <span>Chars: <b className="text-textPrimary">{charCount}</b></span>
                  </div>
                </div>
              </div>

              {/* Right: AI Live Strategy Evaluation Simulator */}
              <div className="w-[360px] flex-shrink-0 flex flex-col bg-bgPanel overflow-hidden">
                <div className="p-3 border-b border-borderHairline bg-bgElevated flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold text-accent flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Live Market Test
                  </span>
                  <button
                    onClick={handleTestOnMarket}
                    disabled={testing}
                    className="h-6 px-3 bg-bgBase hover:bg-bgHover text-accent border border-accent/40 rounded font-bold flex items-center gap-1 text-[10px] transition duration-150 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${testing ? 'animate-spin' : ''}`} />
                    <span>{testing ? 'Scanning...' : 'Test Now'}</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 bg-bgBase">
                  {testing && (
                    <div className="flex flex-col items-center justify-center h-full text-textMuted gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-accent" />
                      <span>Evaluating Exness market against your rules...</span>
                    </div>
                  )}

                  {!testing && !testResult && (
                    <div className="flex flex-col items-center justify-center h-full text-textMuted text-center p-4">
                      <ShieldCheck className="w-8 h-8 text-textMuted/40 mb-2" />
                      <p className="text-[10px] leading-relaxed">
                        Click <b className="text-accent">&quot;Test Now&quot;</b> to simulate how Gemini will evaluate incoming ticks right now.
                      </p>
                    </div>
                  )}

                  {!testing && testResult && (
                    <div className="space-y-2.5">
                      <div className="p-2.5 rounded-lg bg-bgElevated border border-accent/30 text-accent font-bold text-[11px] flex items-center justify-between">
                        <span>Strategy Decision:</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-black/40 text-textPrimary">
                          {testResult.trade_decision?.action || 'HOLD'}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg bg-bgPanel border border-borderHairline text-textPrimary text-[11px] leading-relaxed whitespace-pre-wrap font-sans">
                        {testResult.reply || testResult.thought_process}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE RULE CONFORMANCE */}
          {activeSubTab === 'hud' && (
            <div className="flex-1 flex flex-col p-4 bg-bgBase overflow-y-auto font-sans">
              <div className="max-w-4xl mx-auto w-full space-y-4">
                <div className="p-4 rounded-xl bg-bgPanel border border-up/30 shadow-lg flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-up uppercase tracking-wider flex items-center gap-1.5 mb-1">
                      <CheckCircle2 className="w-4 h-4 text-up" />
                      Live Strategy Rule Checklist
                    </div>
                    <h2 className="text-base font-bold text-textPrimary">
                      Strategy: {hudData?.strategyTitle || currentStrategy?.title}
                    </h2>
                    <p className="text-xs text-textMuted mt-0.5">
                      Real-time verification of your active strategy rules on live Exness MT5 feeds.
                    </p>
                  </div>

                  <div className="flex items-center gap-4 tabular-nums">
                    <div className="text-right">
                      <span className="text-[10px] text-textMuted uppercase block">Match Score</span>
                      <span className="text-2xl font-bold text-up">{hudData?.conformanceScore || 0}%</span>
                    </div>
                    <button
                      onClick={fetchHUD}
                      disabled={hudLoading}
                      className="h-8 px-3 bg-bgElevated hover:bg-bgHover text-up border border-up/30 rounded font-bold flex items-center gap-1 text-xs transition duration-150"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${hudLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                {/* Rule Checklist */}
                <div className="space-y-2.5">
                  {(hudData?.rules || []).map((r, i) => {
                    const isPass = r.status === 'PASS';
                    const isFail = r.status === 'FAIL';
                    return (
                      <div
                        key={i}
                        className={`p-3.5 rounded-lg border transition flex items-start justify-between ${
                          isPass
                            ? 'bg-bgElevated border-up/30'
                            : isFail
                            ? 'bg-bgElevated border-down/30'
                            : 'bg-bgPanel border-borderHairline'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {isPass && <CheckCircle className="w-5 h-5 text-up flex-shrink-0 mt-0.5" />}
                          {isFail && <XCircle className="w-5 h-5 text-down flex-shrink-0 mt-0.5" />}
                          {!isPass && !isFail && <Clock className="w-5 h-5 text-warn flex-shrink-0 mt-0.5" />}

                          <div>
                            <div className="text-xs font-bold text-textPrimary flex items-center gap-2">
                              <span>{r.rule}</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/40 text-textMuted uppercase font-mono">
                                {r.category}
                              </span>
                            </div>
                            <p className="text-xs text-textSecondary mt-1 leading-relaxed">{r.details}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              isPass
                                ? 'bg-up/15 text-up border-up/30'
                                : isFail
                                ? 'bg-down/15 text-down border-down/30'
                                : 'bg-warn/15 text-warn border-warn/30'
                            }`}
                          >
                            {r.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OPERATIONAL MANDATE */}
          {activeSubTab === 'playbook' && (
            <div className="flex-1 flex overflow-hidden p-4 bg-bgBase overflow-y-auto font-sans">
              {!playbook ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-textMuted p-6">
                  <BookOpen className="w-12 h-12 text-gold/40 mb-3" />
                  <h3 className="text-textPrimary font-bold text-sm mb-1">Playbook Not Yet Compiled</h3>
                  <p className="text-[11px] max-w-md mb-4 text-textMuted">
                    Click <b>&quot;Load Instructions & Compile&quot;</b> to compile your instructions into a structured operational playbook.
                  </p>
                  <button
                    onClick={handleCompilePreview}
                    disabled={compilingPreview}
                    className="px-4 py-2 bg-accent hover:bg-accentHover text-black font-bold rounded flex items-center gap-2 text-xs transition duration-150"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Compile Strategy Playbook</span>
                  </button>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto w-full space-y-4 text-textSecondary">
                  {/* Header Card */}
                  <div className="p-4 rounded-xl bg-bgPanel border border-accent/30 shadow-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                        <Cpu className="w-4 h-4" />
                        AI Operational Mandate
                      </span>
                      <span className="text-[10px] text-textMuted font-mono">
                        Compiled: {new Date(playbook.compiledAt).toLocaleString()}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-textPrimary">
                      {playbook.title || currentStrategy?.title}
                    </h2>
                    <p className="text-xs text-textMuted mt-1">{playbook.summary}</p>
                  </div>

                  {/* Grid of Rules */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Candlestick Triggers */}
                    <div className="p-3.5 rounded-xl bg-bgElevated border border-borderHairline">
                      <span className="text-[11px] font-bold text-up uppercase tracking-wider block mb-2">
                        Target Candle Patterns
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(playbook.candle_patterns || []).map((c, i) => (
                          <span key={i} className="px-2 py-1 rounded bg-up/15 text-up text-[10px] font-bold border border-up/30 font-mono">
                            {c.pattern || c} ({c.timeframe || '15m'})
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Indicators Used */}
                    <div className="p-3.5 rounded-xl bg-bgElevated border border-borderHairline">
                      <span className="text-[11px] font-bold text-gold uppercase tracking-wider block mb-2">
                        Indicators Used
                      </span>
                      <div className="space-y-1.5">
                        {(playbook.indicators || []).map((ind, i) => (
                          <div key={i} className="p-2 rounded bg-bgPanel text-[11px]">
                            <b className="text-textPrimary">{ind.alias || ind.indicator_type}</b>: <span className="text-textMuted font-mono">{ind.timeframe}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Safety Guardrails */}
                    <div className="p-3.5 rounded-xl bg-bgElevated border border-borderHairline">
                      <span className="text-[11px] font-bold text-accent uppercase tracking-wider block mb-2">
                        Safety Guardrails
                      </span>
                      {playbook.guardrails && (
                        <div className="space-y-1 text-[11px] tabular-nums">
                          <div>Daily Loss: <b className="text-gold">{playbook.guardrails.max_daily_loss_percent}%</b></div>
                          <div>News Buffer: <b className="text-gold">{playbook.guardrails.news_blackout_minutes}m</b></div>
                          <div>Max Spread: <b className="text-gold">{playbook.guardrails.max_spread_pips} pips</b></div>
                          <div>Sessions: <b className="text-accent">{playbook.guardrails.allowed_sessions?.join(', ')}</b></div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Risk Parameters */}
                  <div className="p-3.5 rounded-xl bg-bgElevated border border-borderHairline">
                    <span className="text-[11px] font-bold text-textPrimary uppercase tracking-wider block mb-2">
                      Risk & Position Sizing Parameters
                    </span>
                    {playbook.risk_parameters && (
                      <div className="grid grid-cols-4 gap-2 text-[11px] tabular-nums">
                        <div className="p-2 rounded bg-bgPanel">
                          <span className="text-textMuted block text-[9px] uppercase">Risk / Trade</span>
                          <span className="text-gold font-bold">{playbook.risk_parameters.risk_percent_per_trade}%</span>
                        </div>
                        <div className="p-2 rounded bg-bgPanel">
                          <span className="text-textMuted block text-[9px] uppercase">Stop Loss</span>
                          <span className="text-textPrimary font-bold">{playbook.risk_parameters.sl_value} pips</span>
                        </div>
                        <div className="p-2 rounded bg-bgPanel">
                          <span className="text-textMuted block text-[9px] uppercase">Take Profit</span>
                          <span className="text-up font-bold">1:{playbook.risk_parameters.tp_value} RR</span>
                        </div>
                        <div className="p-2 rounded bg-bgPanel">
                          <span className="text-textMuted block text-[9px] uppercase">Max Trades</span>
                          <span className="text-textPrimary font-bold">{playbook.risk_parameters.max_open_trades}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MT5 BACKTEST & TUNING */}
          {activeSubTab === 'backtest' && (
            <div className="flex-1 flex flex-col p-4 bg-bgBase overflow-y-auto font-sans">
              <div className="max-w-4xl mx-auto w-full space-y-4">
                <div className="p-4 rounded-xl bg-bgPanel border border-warn/30 shadow-lg flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-warn uppercase tracking-wider flex items-center gap-1.5 mb-1">
                      <BarChart2 className="w-4 h-4 text-warn" />
                      MT5 Historical Candle Simulator
                    </div>
                    <h2 className="text-base font-bold text-textPrimary">
                      Simulate: {currentStrategy?.title}
                    </h2>
                    <p className="text-xs text-textMuted mt-0.5">
                      Tests your strategy conditions against real Exness historical candles.
                    </p>
                  </div>

                  <button
                    onClick={runBacktest}
                    disabled={backtesting}
                    className="h-8 px-4 bg-warn hover:bg-yellow-400 text-black font-bold rounded flex items-center gap-1.5 text-xs transition duration-150"
                  >
                    <Play className={`w-3.5 h-3.5 ${backtesting ? 'animate-spin' : ''}`} />
                    <span>{backtesting ? 'Simulating...' : 'Run Simulation'}</span>
                  </button>
                </div>

                {backtestData && (
                  <div className="space-y-3 tabular-nums">
                    <div className="grid grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg bg-bgElevated border border-borderHairline">
                        <span className="text-[10px] text-textMuted uppercase block">Win Rate</span>
                        <div className="text-2xl font-bold text-up">{backtestData.winRate}%</div>
                      </div>
                      <div className="p-3 rounded-lg bg-bgElevated border border-borderHairline">
                        <span className="text-[10px] text-textMuted uppercase block">Total Setups</span>
                        <div className="text-2xl font-bold text-textPrimary">{backtestData.totalTrades} Trades</div>
                      </div>
                      <div className="p-3 rounded-lg bg-bgElevated border border-borderHairline">
                        <span className="text-[10px] text-textMuted uppercase block">Profit Factor</span>
                        <div className="text-2xl font-bold text-gold">{backtestData.profitFactor}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-bgElevated border border-borderHairline">
                        <span className="text-[10px] text-textMuted uppercase block">Average R:R</span>
                        <div className="text-2xl font-bold text-accent">1:{backtestData.averageRR}</div>
                      </div>
                    </div>

                    {/* AI Tuning Advice */}
                    <div className="p-4 rounded-xl bg-bgElevated border border-borderHairline">
                      <span className="text-xs font-bold text-gold uppercase tracking-wider block mb-2">
                        AI Parameter Tuning Recommendations
                      </span>
                      <ul className="space-y-1.5 text-xs text-textSecondary">
                        {(backtestData.aiTuningRecommendations || []).map((rec, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check className="w-3.5 h-3.5 text-up flex-shrink-0 mt-0.5" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: VERSION HISTORY */}
          {activeSubTab === 'history' && (
            <div className="flex-1 flex flex-col p-4 bg-bgBase overflow-y-auto font-sans">
              <div className="max-w-4xl mx-auto w-full space-y-4">
                <div className="p-4 rounded-xl bg-bgPanel border border-accent/30 shadow-lg flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-accent uppercase tracking-wider flex items-center gap-1.5 mb-1">
                      <History className="w-4 h-4 text-accent" />
                      Strategy Version History
                    </div>
                    <h2 className="text-base font-bold text-textPrimary">
                      Audit Log & Past Compiled Versions
                    </h2>
                    <p className="text-xs text-textMuted mt-0.5">
                      Review past compiled versions and safely roll back at any time.
                    </p>
                  </div>
                </div>

                {historyList.length === 0 ? (
                  <div className="p-8 text-center text-textMuted bg-bgElevated rounded-xl border border-borderHairline">
                    <History className="w-8 h-8 text-textMuted/40 mx-auto mb-2" />
                    <p className="text-xs">No past versions saved yet. Compile and activate a strategy to start recording history.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historyList.map((ver, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-bgElevated border border-borderHairline hover:border-accent/40 transition flex items-start justify-between">
                        <div className="space-y-1.5 max-w-2xl">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-accent/15 text-accent font-bold text-[10px] border border-accent/30 font-mono">
                              Version #{ver.version}
                            </span>
                            <span className="font-bold text-textPrimary text-xs">{ver.title}</span>
                            <span className="text-[10px] text-textMuted font-mono">
                              {new Date(ver.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-textSecondary leading-relaxed">{ver.summary}</p>
                          <div className="text-[10px] text-textMuted font-mono">
                            Mode: <b className="text-up">{ver.executionMode?.toUpperCase() || 'AUTO_EXECUTE'}</b>
                          </div>
                        </div>

                        <button
                          onClick={() => handleRollback(ver.version)}
                          className="px-3 py-1.5 bg-bgPanel hover:bg-bgHover text-accent border border-accent/40 rounded font-bold text-[10px] flex items-center gap-1.5 transition duration-150"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Rollback to v{ver.version}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* COMPILED STRATEGY PREVIEW & CONFIRMATION MODAL */}
      {showPreviewModal && previewSpec && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-bgPanel border border-gold/50 rounded-2xl p-6 w-full max-w-3xl space-y-4 shadow-2xl animate-fadeIn font-sans max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-borderHairline pb-3">
              <div>
                <span className="text-xs font-bold text-gold uppercase tracking-wider flex items-center gap-1.5 mb-0.5">
                  <ShieldAlert className="w-4 h-4 text-gold" />
                  Strategy Confirmation Required
                </span>
                <h2 className="text-base font-bold text-textPrimary">
                  Preview What AI Understood Before Activating
                </h2>
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded bg-gold/15 text-gold border border-gold/30 font-bold font-mono">
                CANDIDATE SPECIFICATION
              </span>
            </div>

            {/* Plain-Language Restatement in Roman Urdu & English */}
            <div className="p-4 rounded-xl bg-bgElevated border border-gold/30 space-y-1">
              <span className="text-[10px] font-bold text-gold uppercase tracking-wider block">
                🧠 Plain-Language AI Understanding:
              </span>
              <p className="text-xs leading-relaxed text-textPrimary font-sans">
                {previewSpec.summary}
              </p>
            </div>

            {/* Structured Specifications Grid */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-3 rounded-lg bg-bgElevated border border-borderHairline">
                <span className="text-[10px] text-textMuted uppercase font-bold block mb-1">Target Candles</span>
                <div className="flex flex-wrap gap-1">
                  {(previewSpec.candle_patterns || []).map((c, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-up/15 text-up text-[10px] font-bold font-mono">
                      {c.pattern || c} ({c.timeframe || '15m'})
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-bgElevated border border-borderHairline">
                <span className="text-[10px] text-textMuted uppercase font-bold block mb-1">Indicators</span>
                <div className="space-y-0.5 text-[10px]">
                  {(previewSpec.indicators || []).map((ind, i) => (
                    <div key={i} className="text-textSecondary">
                      • <b className="text-textPrimary">{ind.alias || ind.indicator_type}</b> ({ind.timeframe})
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-bgElevated border border-borderHairline">
                <span className="text-[10px] text-textMuted uppercase font-bold block mb-1">Risk Parameters</span>
                <div className="space-y-0.5 text-[10px] tabular-nums">
                  <div>Risk: <b className="text-gold">{previewSpec.risk_parameters?.risk_percent_per_trade || 1.0}%</b></div>
                  <div>Target: <b className="text-up">1:{previewSpec.risk_parameters?.tp_value || 2.0} RR</b></div>
                  <div>SL: <b className="text-down">{previewSpec.risk_parameters?.sl_value || 20} pips</b></div>
                </div>
              </div>
            </div>

            {/* Assumptions and Defaults Alert */}
            {((previewSpec.assumptions_made && previewSpec.assumptions_made.length > 0) || (previewSpec.defaults_used && previewSpec.defaults_used.length > 0)) && (
              <div className="p-3 rounded-xl bg-warn/10 border border-warn/30 text-warn text-[11px] space-y-1">
                <div className="font-bold uppercase flex items-center gap-1.5 text-[10px]">
                  <AlertTriangle className="w-3.5 h-3.5 text-warn" />
                  Assumptions & Applied Defaults:
                </div>
                <div className="text-textSecondary text-[10px] space-y-0.5">
                  {(previewSpec.assumptions_made || []).map((a, i) => <div key={i}>• {a}</div>)}
                  {(previewSpec.defaults_used || []).map((d, i) => <div key={i}>• {d}</div>)}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-borderHairline">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 rounded-lg bg-bgElevated hover:bg-bgHover text-textSecondary hover:text-textPrimary text-xs font-bold transition duration-150"
              >
                ✏️ Edit Instructions
              </button>
              <button
                onClick={handleConfirmActivate}
                disabled={activating}
                className="px-5 py-2 rounded-lg bg-up hover:brightness-110 text-white text-xs font-bold transition duration-150 shadow-lg flex items-center gap-1.5"
              >
                <CheckCircle2 className={`w-4 h-4 ${activating ? 'animate-spin' : ''}`} />
                <span>{activating ? 'Activating Live...' : '🟢 Confirm & Activate Strategy'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-bgPanel border border-down/50 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-fadeIn font-sans">
            <div className="flex items-center gap-2.5 text-down">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-base font-bold text-white">Delete Strategy Confirmation</h3>
            </div>

            <p className="text-xs text-textSecondary leading-relaxed">
              Are you sure you want to permanently delete <b className="text-white">&quot;{currentStrategy?.title}&quot;</b>?
            </p>

            {isCurrentActive && (
              <div className="p-3 rounded-lg bg-down/15 border border-down/30 text-down text-xs space-y-1 font-bold">
                <div>⚠️ CRITICAL WARNING:</div>
                <div className="font-normal text-slate-200">
                  This strategy is currently <b>ACTIVE</b> and executing live trades. Deleting it will stop live bot operations on Exness MT5 immediately!
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-borderHairline">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-lg bg-bgElevated hover:bg-bgHover text-textSecondary hover:text-textPrimary text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-down hover:brightness-110 text-white text-xs font-bold transition shadow-lg flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? 'Deleting...' : 'Permanent Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW STRATEGY MODAL */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bgPanel border border-gold/40 rounded-xl p-5 w-full max-w-md space-y-4 shadow-2xl font-sans">
            <h3 className="text-sm font-bold text-gold uppercase flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create New Custom Trading Strategy
            </h3>
            <div>
              <label className="text-[10px] uppercase font-bold text-textMuted block mb-1">Strategy Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. 15m Hammer Scalper, Asian Sweep Breakout..."
                className="w-full bg-bgElevated border border-borderHairline rounded p-2.5 text-xs text-textPrimary focus:outline-none"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-3 py-1.5 rounded text-xs text-textMuted hover:text-textPrimary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateStrategy}
                className="px-4 py-1.5 bg-gold hover:bg-gold-hover text-black font-bold rounded text-xs transition duration-150"
              >
                Create Strategy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
