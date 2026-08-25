'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, Save, Sparkles, ToggleLeft, ToggleRight,
  Check, Clock, Shield, RefreshCw, Plus, Trash2, BookOpen,
  Cpu, CheckCircle2, AlertTriangle, Eye, Layers, ChevronRight,
  Activity, Zap, Compass, BarChart2, Play, Award, CheckCircle,
  XCircle, Code2, Terminal, Flame, TrendingUp, History, RotateCcw,
  HelpCircle, ChevronDown, ChevronUp, Copy, ShieldAlert, Sparkle,
  Settings2, Sliders, CheckSquare, ListFilter
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const EXAMPLE_STRATEGIES = [
  {
    title: '🕯️ 15m Hammer & RSI Reversal Scalper',
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
    title: '🎯 London & NY Killzone Liquidity Sweep',
    desc: 'Waits for Asian session high/low sweep during London/NY open before entering on market structure shift.',
    instructions: `# London & NY Killzone Liquidity Sweep
- Execution Window: London Open (07:00 - 10:00 UTC) and NY Open (12:00 - 15:00 UTC).
- Rule 1: Wait for price to sweep Asian Session High (for Sell) or Asian Low (for Buy).
- Rule 2: Confirm with 15m Market Structure Shift (MSS) and Fair Value Gap (FVG) creation.
- Rule 3: Check Silver (XAG/USD) SMT Divergence confirmation.
- Risk Management: 1% risk per trade. Move Stop Loss to Break-Even at 1.0R. Take 50% partials at 1.5R.`,
  },
  {
    title: '🛡️ Conservative 1H Trend Follower',
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

  // Preview Confirmation Modal State (High Priority)
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewSpec, setPreviewSpec] = useState(null);
  const [compilingPreview, setCompilingPreview] = useState(false);
  const [activating, setActivating] = useState(false);

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
        showToast('✅ Strategy Instructions saved!', 'success');
        await fetchStrategies(currentStrategy.id);
      } else {
        showToast('❌ Failed saving strategy', 'error');
      }
    } catch (e) {
      showToast('❌ Error: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // STEP 1: "Load Instructions & Compile" -> Triggers PREVIEW Modal
  const handleCompilePreview = async () => {
    if (!instructions.trim()) {
      showToast('⚠️ Please write some instructions first', 'warn');
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
          showToast(`❓ Clarification needed: ${data.clarification?.question_to_user}`, 'warn');
          return;
        }
        setPreviewSpec(data.previewSpec);
        setShowPreviewModal(true);
      } else {
        showToast('❌ Compilation error', 'error');
      }
    } catch (e) {
      showToast('❌ Error: ' + e.message, 'error');
    } finally {
      setCompilingPreview(false);
    }
  };

  // STEP 2: "Confirm & Activate" -> Saves to Version History & Makes Strategy Live
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
        showToast(`🟢 "${previewSpec.title}" is now LIVE 24/7!`, 'success');
        setActiveSubTab('playbook');
        await fetchStrategies(currentStrategy.id);
      } else {
        showToast('❌ Failed activating strategy', 'error');
      }
    } catch (e) {
      showToast('❌ Error: ' + e.message, 'error');
    } finally {
      setActivating(false);
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
        showToast(`⏪ Reverted to Version #${versionNumber}!`, 'success');
        await fetchStrategies(currentStrategy.id);
      }
    } catch (e) {
      showToast('❌ Rollback error: ' + e.message, 'error');
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
        showToast(`🟢 "${currentStrategy.title}" is active 24/7!`, 'success');
      }
    } catch (e) {
      showToast('❌ Error: ' + e.message, 'error');
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
        showToast('✅ New Strategy created!', 'success');
        await fetchStrategies(data.strategy.id);
      }
    } catch (e) {
      showToast('❌ Error: ' + e.message, 'error');
    }
  };

  // Delete Strategy
  const handleDeleteStrategy = async () => {
    if (!currentStrategy || strategies.length <= 1) return;
    if (!confirm(`Delete strategy "${currentStrategy.title}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/strategy/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentStrategy.id }),
      });
      if (res.ok) {
        showToast('🗑️ Strategy deleted', 'warn');
        await fetchStrategies();
      }
    } catch (e) {
      showToast('❌ Error: ' + e.message, 'error');
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
      <div className="flex items-center justify-center h-full bg-[#0B0E14] text-textMuted font-mono text-xs">
        <RefreshCw className="w-5 h-5 animate-spin text-gold mr-2" />
        <span>Loading Universal Dynamic Strategy Engine...</span>
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

  const NAV_ITEMS = [
    { id: 'editor', title: '1. Write Strategy', subtitle: 'Prompt & Live Testing', icon: FileText },
    { id: 'hud', title: '2. Live Status', subtitle: 'Real-time rule matrix', icon: CheckCircle2, color: 'text-up' },
    { id: 'playbook', title: '3. How AI Behaves', subtitle: 'Compiled playbook logic', icon: BookOpen, color: 'text-accent' },
    { id: 'backtest', title: '4. Backtest & Adjust', subtitle: 'MT5 candle simulation', icon: BarChart2, color: 'text-yellow-400' },
    { id: 'history', title: '5. Version History', subtitle: 'Past versions & rollback', icon: History, color: 'text-cyan-400' },
  ];

  return (
    <div className="flex-1 flex h-full bg-[#090C12] text-textPrimary font-mono text-xs overflow-hidden select-none">

      {/* LEFT SUB-SIDEBAR NAVIGATION (Width: 230px) */}
      <div className="w-[230px] flex-shrink-0 bg-[#0C101A] border-r border-borderHairline flex flex-col justify-between overflow-y-auto">
        
        {/* Top: Strategy Selection & Status */}
        <div className="p-3 space-y-3">
          {/* Header Label */}
          <div className="flex items-center justify-between border-b border-borderHairline pb-2">
            <div className="flex items-center gap-1.5 font-bold text-gold">
              <Cpu className="w-4 h-4 text-gold animate-pulse" />
              <span className="text-[11px] tracking-wider">STRATEGY HUB</span>
            </div>
            <button
              onClick={() => setShowNewModal(true)}
              className="px-2 py-0.5 bg-[#171E2E] hover:bg-[#20293D] text-gold border border-gold/40 rounded font-bold flex items-center gap-1 transition text-[9px]"
              title="Create New Strategy"
            >
              <Plus className="w-3 h-3" />
              <span>NEW</span>
            </button>
          </div>

          {/* Strategy Selection List */}
          <div className="space-y-1">
            <span className="text-[9px] uppercase font-bold text-textMuted block px-1">Your Strategies:</span>
            {strategies.map((strat) => {
              const isSelected = currentStrategy?.id === strat.id;
              const isActive247 = activeId === strat.id;
              return (
                <button
                  key={strat.id}
                  onClick={() => handleSelectStrategy(strat)}
                  className={`w-full p-2 rounded-lg text-left transition border flex items-center justify-between ${
                    isSelected
                      ? 'bg-gold/15 text-gold border-gold/40 font-bold shadow-sm'
                      : 'bg-[#121724] text-textMuted hover:text-white border-white/5 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {isActive247 && <span className="w-1.5 h-1.5 rounded-full bg-up animate-ping flex-shrink-0" />}
                    <span className="truncate text-[11px]">{strat.title}</span>
                  </div>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-black/40 text-textMuted font-mono">
                    v{strat.history?.length || 1}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Persistent Strategy Status Badge */}
          <div className={`p-2 rounded-lg border text-center ${
            executionMode === 'auto_execute'
              ? 'bg-up/15 text-up border-up/30'
              : 'bg-yellow-400/15 text-yellow-400 border-yellow-400/30'
          }`}>
            <span className="text-[9px] uppercase block opacity-80">Execution Mode</span>
            <span className="font-bold text-[10px] flex items-center justify-center gap-1 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${executionMode === 'auto_execute' ? 'bg-up animate-pulse' : 'bg-yellow-400'}`} />
              {executionMode === 'auto_execute' ? 'AUTO-EXECUTE (REAL TRADES)' : 'WATCH-ONLY (ALERTS)'}
            </span>
          </div>

          {/* Navigation Sub-Tabs in Left Sidebar */}
          <div className="pt-2 border-t border-borderHairline space-y-1">
            <span className="text-[9px] uppercase font-bold text-textMuted block px-1 mb-1">Sections:</span>
            {NAV_ITEMS.map((item) => {
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
                  className={`w-full p-2 rounded-lg text-left transition flex items-center gap-2.5 ${
                    isActive
                      ? 'bg-[#182032] text-white border border-gold/40 shadow-sm'
                      : 'text-textMuted hover:text-slate-200 hover:bg-[#121622] border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? (item.color || 'text-gold') : 'text-textMuted'}`} />
                  <div className="truncate">
                    <div className={`text-[11px] font-bold ${isActive ? 'text-white' : ''}`}>{item.title}</div>
                    <div className="text-[8px] text-textMuted leading-tight">{item.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Sidebar Controls */}
        <div className="p-3 border-t border-borderHairline bg-[#0A0D15] space-y-2">
          <button
            onClick={handleSetActive}
            className={`w-full py-1.5 px-2 rounded font-bold text-[10px] flex items-center justify-center gap-1.5 transition border ${
              isCurrentActive
                ? 'bg-up/20 text-up border-up/40'
                : 'bg-[#151B28] text-textMuted border-white/10 hover:border-white/30 hover:text-white'
            }`}
          >
            {isCurrentActive ? <ToggleRight className="w-4 h-4 text-up" /> : <ToggleLeft className="w-4 h-4" />}
            <span>{isCurrentActive ? '🟢 24/7 ACTIVE STRATEGY' : 'SET AS ACTIVE 24/7'}</span>
          </button>

          {strategies.length > 1 && (
            <button
              onClick={handleDeleteStrategy}
              className="w-full py-1 text-center text-down/70 hover:text-down text-[10px] flex items-center justify-center gap-1 transition"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete Strategy</span>
            </button>
          )}
        </div>
      </div>

      {/* RIGHT MAIN VIEWPORT */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#090C12]">

        {/* Top Action Bar */}
        <div className="h-11 px-4 bg-[#0E121B] border-b border-borderHairline flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white uppercase">{currentStrategy?.title}</span>
            {currentStrategy?.updatedAt && (
              <span className="text-[10px] text-textMuted">
                (Updated: {new Date(currentStrategy.updatedAt).toLocaleTimeString()})
              </span>
            )}
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
              className="h-7 px-3.5 bg-accent hover:bg-cyan-400 text-black font-bold rounded flex items-center gap-1.5 transition shadow-sm disabled:opacity-50 text-[11px]"
              title="Parse instructions and preview before activating"
            >
              <Sparkles className={`w-3.5 h-3.5 ${compilingPreview ? 'animate-spin' : ''}`} />
              <span>{compilingPreview ? 'AI Parsing...' : '⚡ Load Instructions & Compile'}</span>
            </button>

            {/* Save Raw Instructions Button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-7 px-3 bg-gold hover:bg-yellow-400 text-black font-bold rounded flex items-center gap-1.5 transition shadow-sm disabled:opacity-50 text-[11px]"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </div>

        {/* VIEWPORT CONTENT PER ACTIVE TAB */}
        <div className="flex-1 flex overflow-hidden">

          {/* TAB 1: WRITE STRATEGY */}
          {activeSubTab === 'editor' && (
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Textarea Editor & Inline Guidance */}
              <div className="flex-1 flex flex-col border-r border-borderHairline bg-[#0B0E14] overflow-hidden">
                
                {/* Title & Example Library Toggle Bar */}
                <div className="p-2 px-3 bg-[#0F1420] border-b border-borderHairline flex items-center justify-between text-[11px]">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Strategy Title..."
                    className="bg-transparent font-bold text-white text-sm focus:outline-none focus:ring-1 focus:ring-gold/40 px-2 py-0.5 rounded w-1/2"
                  />
                  
                  <button
                    onClick={() => setShowExamples(!showExamples)}
                    className="px-2.5 py-1 rounded bg-[#171E2E] hover:bg-[#20293D] text-gold border border-gold/30 text-[10px] font-bold flex items-center gap-1 transition"
                  >
                    <BookOpen className="w-3 h-3" />
                    <span>{showExamples ? 'Hide Examples' : '📖 Example Strategy Library'}</span>
                    {showExamples ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {/* Collapsible Example Strategy Library */}
                {showExamples && (
                  <div className="p-3 bg-[#111726] border-b border-gold/30 grid grid-cols-3 gap-2 flex-shrink-0 animate-fadeIn">
                    {EXAMPLE_STRATEGIES.map((ex, idx) => (
                      <div key={idx} className="p-2.5 rounded bg-[#161D2E] border border-white/10 hover:border-gold/50 flex flex-col justify-between space-y-1.5 transition">
                        <div>
                          <div className="font-bold text-white text-[11px]">{ex.title}</div>
                          <div className="text-[9px] text-textMuted mt-0.5 leading-tight">{ex.desc}</div>
                        </div>
                        <button
                          onClick={() => {
                            setInstructions(ex.instructions);
                            setTitle(ex.title);
                            setShowExamples(false);
                            showToast(`✅ Loaded "${ex.title}"!`, 'success');
                          }}
                          className="py-1 bg-gold/20 hover:bg-gold/40 text-gold border border-gold/40 rounded text-[9px] font-bold flex items-center justify-center gap-1 transition"
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
                  placeholder="Write your custom trading strategy rules here in plain English or Roman Urdu...&#10;&#10;Examples:&#10;1. 15m timeframe pe jab Hammer ya Bullish Engulfing candle bane aur RSI 38 se kam ho to BUY trade lo.&#10;2. Stop Loss candle wick ke 2 pips neechay rakho aur target 1:2.5 Risk to Reward.&#10;3. London Open (07:00 - 10:00 UTC) aur NY Open mein trade lo.&#10;4. Click '⚡ Load Instructions & Compile' to preview what the AI understood before activating."
                  className="flex-1 p-4 bg-transparent text-slate-100 font-mono text-[12px] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-gold/30 selection:bg-gold/20"
                  spellCheck="false"
                />

                {/* Inline Guidance & Metrics Bar directly below Textarea */}
                <div className="p-2 px-3 bg-[#0D111A] border-t border-borderHairline flex items-center justify-between text-[10px] text-textMuted flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-3 h-3 text-accent" />
                    <span><b>Pro-Tip:</b> Include <b>Timeframe</b> (15m/1h), <b>Candle Trigger</b> (Hammer/Engulfing), and <b>SL/TP ratio</b> (1:2.0).</span>
                  </div>

                  <div className="flex items-center gap-3 font-mono">
                    <span>Rules: <b className="text-white">{ruleCount}</b></span>
                    <span>Words: <b className="text-white">{wordCount}</b></span>
                    <span>Chars: <b className="text-white">{charCount}</b></span>
                  </div>
                </div>
              </div>

              {/* Right: AI Live Strategy Evaluation Simulator */}
              <div className="w-[380px] flex-shrink-0 flex flex-col bg-[#0D111A] overflow-hidden">
                <div className="p-3 border-b border-borderHairline bg-[#0E131F] flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold text-accent flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Live Market Test
                  </span>
                  <button
                    onClick={handleTestOnMarket}
                    disabled={testing}
                    className="h-6 px-3 bg-[#161B26] hover:bg-[#1E2536] text-accent border border-accent/40 rounded font-bold flex items-center gap-1 text-[10px] transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${testing ? 'animate-spin' : ''}`} />
                    <span>{testing ? 'Scanning...' : 'Test Now'}</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 bg-[#0B0E17]">
                  {testing && (
                    <div className="flex flex-col items-center justify-center h-full text-textMuted gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-accent" />
                      <span>Evaluating Exness market against your rules...</span>
                    </div>
                  )}

                  {!testing && !testResult && (
                    <div className="flex flex-col items-center justify-center h-full text-textMuted text-center p-4">
                      <Shield className="w-8 h-8 text-textMuted/40 mb-2" />
                      <p className="text-[10px] leading-relaxed">
                        Click <b className="text-accent">&quot;Test Now&quot;</b> to simulate how Gemini will evaluate incoming ticks right now.
                      </p>
                    </div>
                  )}

                  {!testing && testResult && (
                    <div className="space-y-2.5">
                      <div className="p-2.5 rounded bg-[#161C2C] border border-accent/30 text-accent font-bold text-[11px] flex items-center justify-between">
                        <span>🤖 Strategy Decision:</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-black/40">
                          {testResult.trade_decision?.action || 'HOLD'}
                        </span>
                      </div>
                      <div className="p-3 rounded bg-[#101420] border border-borderHairline text-slate-200 text-[11px] leading-relaxed whitespace-pre-wrap font-sans">
                        {testResult.reply || testResult.thought_process}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE STATUS */}
          {activeSubTab === 'hud' && (
            <div className="flex-1 flex flex-col p-4 bg-[#090C14] overflow-y-auto font-sans">
              <div className="max-w-4xl mx-auto w-full space-y-4">
                <div className="p-4 rounded-xl bg-[#0F1424] border border-up/30 shadow-lg flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-up uppercase tracking-wider flex items-center gap-1.5 mb-1">
                      <CheckCircle2 className="w-4 h-4 text-up animate-pulse" />
                      Live Strategy Rule Checklist
                    </div>
                    <h2 className="text-base font-bold text-white">
                      Strategy: {hudData?.strategyTitle || currentStrategy?.title}
                    </h2>
                    <p className="text-xs text-textMuted mt-0.5">
                      Real-time verification of your active strategy rules on live Exness MT5 feeds.
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[10px] text-textMuted uppercase block">Match Score</span>
                      <span className="text-2xl font-bold text-up">{hudData?.conformanceScore || 0}%</span>
                    </div>
                    <button
                      onClick={fetchHUD}
                      disabled={hudLoading}
                      className="h-8 px-3 bg-[#1A2234] hover:bg-[#25304A] text-up border border-up/30 rounded font-bold flex items-center gap-1 text-xs transition"
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
                            ? 'bg-[#0E1624] border-up/30'
                            : isFail
                            ? 'bg-[#1A1118] border-down/30'
                            : 'bg-[#121622] border-white/10'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {isPass && <CheckCircle className="w-5 h-5 text-up flex-shrink-0 mt-0.5" />}
                          {isFail && <XCircle className="w-5 h-5 text-down flex-shrink-0 mt-0.5" />}
                          {!isPass && !isFail && <Clock className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />}

                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-2">
                              <span>{r.rule}</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/40 text-textMuted uppercase">
                                {r.category}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-1 leading-relaxed">{r.details}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              isPass
                                ? 'bg-up/20 text-up border-up/30'
                                : isFail
                                ? 'bg-down/20 text-down border-down/30'
                                : 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30'
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

          {/* TAB 3: HOW AI BEHAVES */}
          {activeSubTab === 'playbook' && (
            <div className="flex-1 flex overflow-hidden p-4 bg-[#090C14] overflow-y-auto font-sans">
              {!playbook ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-textMuted p-6">
                  <BookOpen className="w-12 h-12 text-gold/40 mb-3" />
                  <h3 className="text-white font-bold text-sm mb-1">Playbook Not Yet Compiled</h3>
                  <p className="text-[11px] max-w-md mb-4 text-textMuted">
                    Click <b>&quot;⚡ Load Instructions & Compile&quot;</b> to compile your instructions into a structured operational playbook.
                  </p>
                  <button
                    onClick={handleCompilePreview}
                    disabled={compilingPreview}
                    className="px-4 py-2 bg-accent hover:bg-cyan-400 text-black font-bold rounded flex items-center gap-2 text-xs transition"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Compile Strategy Playbook</span>
                  </button>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto w-full space-y-4 text-slate-200">
                  {/* Header Card */}
                  <div className="p-4 rounded-xl bg-[#0F1424] border border-accent/30 shadow-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                        <Cpu className="w-4 h-4" />
                        AI Operational Mandate
                      </span>
                      <span className="text-[10px] text-textMuted">
                        Compiled: {new Date(playbook.compiledAt).toLocaleString()}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-white">
                      {playbook.title || currentStrategy?.title}
                    </h2>
                    <p className="text-xs text-textMuted mt-1">{playbook.summary}</p>
                  </div>

                  {/* Grid of Rules */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Candlestick Triggers */}
                    <div className="p-3.5 rounded-xl bg-[#0E131E] border border-borderHairline">
                      <span className="text-[11px] font-bold text-up uppercase tracking-wider block mb-2">
                        🕯️ Target Candle Patterns
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(playbook.candle_patterns || []).map((c, i) => (
                          <span key={i} className="px-2 py-1 rounded bg-up/15 text-up text-[10px] font-bold border border-up/30">
                            {c.pattern || c} ({c.timeframe || '15m'})
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Indicators Used */}
                    <div className="p-3.5 rounded-xl bg-[#0E131E] border border-borderHairline">
                      <span className="text-[11px] font-bold text-gold uppercase tracking-wider block mb-2">
                        📊 Indicators Used
                      </span>
                      <div className="space-y-1.5">
                        {(playbook.indicators || []).map((ind, i) => (
                          <div key={i} className="p-2 rounded bg-[#141A29] text-[11px]">
                            <b className="text-white">{ind.alias || ind.indicator_type}</b>: <span className="text-textMuted">{ind.timeframe}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Safety Guardrails */}
                    <div className="p-3.5 rounded-xl bg-[#0E131E] border border-borderHairline">
                      <span className="text-[11px] font-bold text-accent uppercase tracking-wider block mb-2">
                        🛡️ Safety Guardrails
                      </span>
                      {playbook.guardrails && (
                        <div className="space-y-1 text-[11px]">
                          <div>Daily Loss: <b className="text-gold">{playbook.guardrails.max_daily_loss_percent}%</b></div>
                          <div>News Buffer: <b className="text-gold">{playbook.guardrails.news_blackout_minutes}m</b></div>
                          <div>Max Spread: <b className="text-gold">{playbook.guardrails.max_spread_pips} pips</b></div>
                          <div>Sessions: <b className="text-accent">{playbook.guardrails.allowed_sessions?.join(', ')}</b></div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Risk Parameters */}
                  <div className="p-3.5 rounded-xl bg-[#0E131E] border border-borderHairline">
                    <span className="text-[11px] font-bold text-white uppercase tracking-wider block mb-2">
                      ⚖️ Risk & Position Sizing Parameters
                    </span>
                    {playbook.risk_parameters && (
                      <div className="grid grid-cols-4 gap-2 text-[11px]">
                        <div className="p-2 rounded bg-[#141A29]">
                          <span className="text-textMuted block text-[9px] uppercase">Risk / Trade</span>
                          <span className="text-gold font-bold">{playbook.risk_parameters.risk_percent_per_trade}%</span>
                        </div>
                        <div className="p-2 rounded bg-[#141A29]">
                          <span className="text-textMuted block text-[9px] uppercase">Stop Loss</span>
                          <span className="text-white font-bold">{playbook.risk_parameters.sl_value} pips</span>
                        </div>
                        <div className="p-2 rounded bg-[#141A29]">
                          <span className="text-textMuted block text-[9px] uppercase">Take Profit</span>
                          <span className="text-up font-bold">1:{playbook.risk_parameters.tp_value} RR</span>
                        </div>
                        <div className="p-2 rounded bg-[#141A29]">
                          <span className="text-textMuted block text-[9px] uppercase">Max Trades</span>
                          <span className="text-white font-bold">{playbook.risk_parameters.max_open_trades}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: BACKTEST & ADJUST */}
          {activeSubTab === 'backtest' && (
            <div className="flex-1 flex flex-col p-4 bg-[#090C14] overflow-y-auto font-sans">
              <div className="max-w-4xl mx-auto w-full space-y-4">
                <div className="p-4 rounded-xl bg-[#121828] border border-yellow-400/30 shadow-lg flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-yellow-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                      <BarChart2 className="w-4 h-4 text-yellow-400" />
                      MT5 Historical Candle Simulator
                    </div>
                    <h2 className="text-base font-bold text-white">
                      Simulate: {currentStrategy?.title}
                    </h2>
                    <p className="text-xs text-textMuted mt-0.5">
                      Tests your strategy conditions against real Exness historical candles.
                    </p>
                  </div>

                  <button
                    onClick={runBacktest}
                    disabled={backtesting}
                    className="h-8 px-4 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded flex items-center gap-1.5 text-xs transition"
                  >
                    <Play className={`w-3.5 h-3.5 ${backtesting ? 'animate-spin' : ''}`} />
                    <span>{backtesting ? 'Simulating...' : 'Run Simulation'}</span>
                  </button>
                </div>

                {backtestData && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg bg-[#0E131E] border border-borderHairline">
                        <span className="text-[10px] text-textMuted uppercase block">Win Rate</span>
                        <div className="text-2xl font-bold text-up">{backtestData.winRate}%</div>
                      </div>
                      <div className="p-3 rounded-lg bg-[#0E131E] border border-borderHairline">
                        <span className="text-[10px] text-textMuted uppercase block">Total Setups</span>
                        <div className="text-2xl font-bold text-white">{backtestData.totalTrades} Trades</div>
                      </div>
                      <div className="p-3 rounded-lg bg-[#0E131E] border border-borderHairline">
                        <span className="text-[10px] text-textMuted uppercase block">Profit Factor</span>
                        <div className="text-2xl font-bold text-gold">{backtestData.profitFactor}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-[#0E131E] border border-borderHairline">
                        <span className="text-[10px] text-textMuted uppercase block">Average R:R</span>
                        <div className="text-2xl font-bold text-cyan-400">1:{backtestData.averageRR}</div>
                      </div>
                    </div>

                    {/* AI Tuning Advice */}
                    <div className="p-4 rounded-xl bg-[#0E1422] border border-borderHairline">
                      <span className="text-xs font-bold text-gold uppercase tracking-wider block mb-2">
                        💡 AI Parameter Tuning Recommendations
                      </span>
                      <ul className="space-y-1.5 text-xs text-slate-200">
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
            <div className="flex-1 flex flex-col p-4 bg-[#090C14] overflow-y-auto font-sans">
              <div className="max-w-4xl mx-auto w-full space-y-4">
                <div className="p-4 rounded-xl bg-[#0F1424] border border-cyan-400/30 shadow-lg flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                      <History className="w-4 h-4 text-cyan-400" />
                      Strategy Version History
                    </div>
                    <h2 className="text-base font-bold text-white">
                      Audit Log & Past Compiled Versions
                    </h2>
                    <p className="text-xs text-textMuted mt-0.5">
                      Review past compiled versions and safely roll back at any time.
                    </p>
                  </div>
                </div>

                {historyList.length === 0 ? (
                  <div className="p-8 text-center text-textMuted bg-[#0E131E] rounded-xl border border-borderHairline">
                    <History className="w-8 h-8 text-textMuted/40 mx-auto mb-2" />
                    <p className="text-xs">No past versions saved yet. Compile and activate a strategy to start recording history.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historyList.map((ver, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-[#0E131E] border border-borderHairline hover:border-cyan-400/40 transition flex items-start justify-between">
                        <div className="space-y-1.5 max-w-2xl">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-cyan-400/20 text-cyan-400 font-bold text-[10px] border border-cyan-400/30">
                              Version #{ver.version}
                            </span>
                            <span className="font-bold text-white text-xs">{ver.title}</span>
                            <span className="text-[10px] text-textMuted">
                              {new Date(ver.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{ver.summary}</p>
                          <div className="text-[10px] text-textMuted font-mono">
                            Mode: <b className="text-up">{ver.executionMode?.toUpperCase() || 'AUTO_EXECUTE'}</b>
                          </div>
                        </div>

                        <button
                          onClick={() => handleRollback(ver.version)}
                          className="px-3 py-1.5 bg-[#172030] hover:bg-[#223048] text-cyan-400 border border-cyan-400/40 rounded font-bold text-[10px] flex items-center gap-1.5 transition"
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
          <div className="bg-[#0D121F] border border-gold/50 rounded-2xl p-6 w-full max-w-3xl space-y-4 shadow-2xl animate-fadeIn font-sans max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-xs font-bold text-gold uppercase tracking-wider flex items-center gap-1.5 mb-0.5">
                  <ShieldAlert className="w-4 h-4 text-gold" />
                  Strategy Confirmation Required
                </span>
                <h2 className="text-base font-bold text-white">
                  Preview What AI Understood Before Activating
                </h2>
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded bg-gold/15 text-gold border border-gold/30 font-bold">
                CANDIDATE SPECIFICATION
              </span>
            </div>

            {/* Plain-Language Restatement */}
            <div className="p-4 rounded-xl bg-[#141B2D] border border-gold/30 space-y-1">
              <span className="text-[10px] font-bold text-gold uppercase tracking-wider block">
                🧠 Plain-Language AI Synthesis:
              </span>
              <p className="text-xs leading-relaxed text-slate-100 font-sans">
                {previewSpec.summary}
              </p>
            </div>

            {/* Structured Specifications Grid */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-3 rounded-lg bg-[#0E131E] border border-borderHairline">
                <span className="text-[10px] text-textMuted uppercase font-bold block mb-1">Target Candles</span>
                <div className="flex flex-wrap gap-1">
                  {(previewSpec.candle_patterns || []).map((c, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-up/15 text-up text-[10px] font-bold">
                      {c.pattern || c} ({c.timeframe || '15m'})
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#0E131E] border border-borderHairline">
                <span className="text-[10px] text-textMuted uppercase font-bold block mb-1">Indicators</span>
                <div className="space-y-0.5 text-[10px]">
                  {(previewSpec.indicators || []).map((ind, i) => (
                    <div key={i} className="text-slate-200">
                      • <b>{ind.alias || ind.indicator_type}</b> ({ind.timeframe})
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#0E131E] border border-borderHairline">
                <span className="text-[10px] text-textMuted uppercase font-bold block mb-1">Risk Parameters</span>
                <div className="space-y-0.5 text-[10px]">
                  <div>Risk: <b className="text-gold">{previewSpec.risk_parameters?.risk_percent_per_trade || 1.0}%</b></div>
                  <div>Target: <b className="text-up">1:{previewSpec.risk_parameters?.tp_value || 2.0} RR</b></div>
                  <div>SL: <b className="text-down">{previewSpec.risk_parameters?.sl_value || 20} pips</b></div>
                </div>
              </div>
            </div>

            {/* Assumptions and Defaults Alert */}
            {((previewSpec.assumptions_made && previewSpec.assumptions_made.length > 0) || (previewSpec.defaults_used && previewSpec.defaults_used.length > 0)) && (
              <div className="p-3 rounded-xl bg-[#1A1612] border border-warn/30 text-warn text-[11px] space-y-1">
                <div className="font-bold uppercase flex items-center gap-1.5 text-[10px]">
                  <AlertTriangle className="w-3.5 h-3.5 text-warn" />
                  Assumptions & Applied Defaults:
                </div>
                <div className="text-slate-300 text-[10px] space-y-0.5">
                  {(previewSpec.assumptions_made || []).map((a, i) => <div key={i}>• {a}</div>)}
                  {(previewSpec.defaults_used || []).map((d, i) => <div key={i}>• {d}</div>)}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 rounded-lg bg-[#141A28] hover:bg-[#1E263A] text-slate-300 text-xs font-bold transition"
              >
                ✏️ Edit Instructions
              </button>
              <button
                onClick={handleConfirmActivate}
                disabled={activating}
                className="px-5 py-2 rounded-lg bg-up hover:bg-emerald-400 text-black text-xs font-bold transition shadow-lg flex items-center gap-1.5"
              >
                <CheckCircle2 className={`w-4 h-4 ${activating ? 'animate-spin' : ''}`} />
                <span>{activating ? 'Activating Live...' : '🟢 Confirm & Activate Strategy'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW STRATEGY MODAL */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F1422] border border-gold/40 rounded-xl p-5 w-full max-w-md space-y-4 shadow-2xl">
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
                className="w-full bg-[#161C2C] border border-borderHairline rounded p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-gold"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-3 py-1.5 rounded text-xs text-textMuted hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateStrategy}
                className="px-4 py-1.5 bg-gold hover:bg-yellow-400 text-black font-bold rounded text-xs transition"
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
