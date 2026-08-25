'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Save, Sparkles, Sliders, ToggleLeft, ToggleRight,
  Check, Clock, Shield, RefreshCw, Plus, Trash2, BookOpen,
  Cpu, CheckCircle2, AlertTriangle, Eye, Layers, ChevronRight,
  Activity, Zap, Compass, BarChart2, Play, Award, CheckCircle,
  XCircle, HelpCircle, ArrowUpRight, TrendingUp, Filter
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const RULE_INJECTORS = [
  { label: '🏛️ Silver SMT Divergence', text: '\n- SMT Filter: Check inverse correlation with Silver (XAG/USD) before confirming entry.' },
  { label: '🎯 London Killzone Sweep', text: '\n- Killzone: Wait for 07:00 UTC London Open sweep of Asian session High/Low.' },
  { label: '🛡️ Break-Even at 1.0R', text: '\n- Trade Management: Automatically move Stop Loss to Break-Even as soon as 1.0R profit is reached.' },
  { label: '⚡ 50% Partials at 1.5R', text: '\n- Partials: Close 50% of position size at 1.5R and let remaining 50% run to final target.' },
  { label: '🚫 15m High-Impact News Blackout', text: '\n- News Guard: Do not enter new trades 15 minutes before or after USD CPI, NFP, or FOMC.' },
  { label: '🕯️ Candlestick Reversal Confirmation', text: '\n- Candle Trigger: Require 15m Bullish/Bearish Engulfing or Pinbar wick rejection at the key zone.' },
];

export default function StrategyPanel({ onStrategySaved }) {
  // Strategy State
  const [strategies, setStrategies] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [currentStrategy, setCurrentStrategy] = useState(null);
  const [instructions, setInstructions] = useState('');
  const [title, setTitle] = useState('');

  // Sub-tabs: 'editor' | 'hud' | 'playbook' | 'backtest' | 'telemetry'
  const [activeSubTab, setActiveSubTab] = useState('editor');

  // Live Rule Conformance HUD State
  const [hudData, setHudData] = useState(null);
  const [hudLoading, setHudLoading] = useState(false);

  // Backtest State
  const [backtestData, setBacktestData] = useState(null);
  const [backtestLoading, setBacktestLoading] = useState(false);

  // Telemetry State
  const [telemetry, setTelemetry] = useState(null);
  const [telemetryLoading, setTelemetryLoading] = useState(false);

  // Status & Loading Flags
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saveToast, setSaveToast] = useState(null);

  // New Strategy Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');

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

  // Fetch Full Market Telemetry
  const fetchTelemetry = useCallback(async () => {
    setTelemetryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/market/full-telemetry`);
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
    } catch (e) {
      console.error('Telemetry fetch error:', e);
    } finally {
      setTelemetryLoading(false);
    }
  }, []);

  // Auto-refresh HUD if HUD tab is active
  useEffect(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  useEffect(() => {
    if (activeSubTab === 'hud') {
      fetchHUD();
      const interval = setInterval(fetchHUD, 4000);
      return () => clearInterval(interval);
    }
  }, [activeSubTab, fetchHUD]);

  const handleSelectStrategy = (strat) => {
    setCurrentStrategy(strat);
    setInstructions(strat.instructions || '');
    setTitle(strat.title || '');
    setTestResult(null);
  };

  const handleInjectRule = (snippet) => {
    setInstructions((prev) => prev.trim() + '\n' + snippet.trim() + '\n');
    showToast('⚡ Institutional Rule injected!', 'success');
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
        showToast('✅ Strategy Instructions saved successfully!', 'success');
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

  // "⚡ Load Instructions & Compile AI Playbook"
  const handleCompilePlaybook = async () => {
    if (!currentStrategy) return;
    setCompiling(true);
    try {
      const res = await fetch(`${API_BASE}/api/strategy/compile-playbook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentStrategy.id,
          instructions,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast('🧠 AI Strategy Playbook compiled & linked!', 'success');
        setActiveSubTab('playbook');
        await fetchStrategies(currentStrategy.id);
      } else {
        showToast('❌ Failed compiling playbook', 'error');
      }
    } catch (e) {
      showToast('❌ Compilation error: ' + e.message, 'error');
    } finally {
      setCompiling(false);
    }
  };

  // Run Historical Simulation Backtest
  const handleRunBacktest = async () => {
    setBacktestLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/strategy/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candleCount: 250 }),
      });
      if (res.ok) {
        const data = await res.json();
        setBacktestData(data);
        showToast('🧪 Historical MT5 simulation complete!', 'success');
      }
    } catch (e) {
      showToast('❌ Backtest failed: ' + e.message, 'error');
    } finally {
      setBacktestLoading(false);
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
        showToast(`🟢 "${currentStrategy.title}" is now active 24/7!`, 'success');
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
          instructions: `# Custom Trading Strategy Directives\n- Trade strictly during London & NY sessions.\n- Require 15m Fair Value Gap sweep before entry.\n- Minimum 1:2.0 Risk-to-Reward.`,
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
    if (!confirm(`Are you sure you want to delete "${currentStrategy.title}"?`)) return;
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
        <span>Loading Institutional Strategy Engine...</span>
      </div>
    );
  }

  const isCurrentActive = currentStrategy?.id === activeId;
  const playbook = currentStrategy?.compiledPlaybook;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090C12] text-textPrimary font-mono text-xs overflow-hidden select-none">
      
      {/* TOP HEADER: Multi-Strategy Selector & Action Buttons */}
      <div className="h-12 px-4 bg-[#0D1118] border-b border-borderHairline flex items-center justify-between flex-shrink-0 z-20">
        
        {/* Left: Strategy Selector Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto max-w-[65%] py-1">
          <div className="flex items-center gap-1.5 font-bold text-gold mr-2 flex-shrink-0">
            <Cpu className="w-4 h-4 text-gold animate-pulse" />
            <span className="text-[11px] tracking-wide">STRATEGY:</span>
          </div>

          {strategies.map((strat) => {
            const isSelected = currentStrategy?.id === strat.id;
            const isActive247 = activeId === strat.id;
            return (
              <button
                key={strat.id}
                onClick={() => handleSelectStrategy(strat)}
                className={`px-3 py-1 rounded text-[10px] font-bold flex items-center gap-1.5 transition border flex-shrink-0 ${
                  isSelected
                    ? 'bg-gold text-black border-gold shadow-sm'
                    : 'bg-[#141926] text-textMuted hover:text-white border-white/10 hover:border-white/20'
                }`}
              >
                {isActive247 && <span className="w-1.5 h-1.5 rounded-full bg-up animate-ping" />}
                <span className="truncate max-w-[130px]">{strat.title}</span>
                {strat.compiledPlaybook && (
                  <span className={`text-[8px] px-1 rounded ${isSelected ? 'bg-black/30 text-black' : 'bg-accent/20 text-accent font-mono'}`}>
                    PLAYBOOK
                  </span>
                )}
              </button>
            );
          })}

          <button
            onClick={() => setShowNewModal(true)}
            className="h-7 px-2.5 bg-[#171E2E] hover:bg-[#20293D] text-gold border border-gold/30 rounded font-bold flex items-center gap-1 transition text-[10px] flex-shrink-0"
            title="Create New Custom Strategy"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>NEW STRATEGY</span>
          </button>
        </div>

        {/* Right: Main Execution Controls */}
        <div className="flex items-center gap-2">
          {saveToast && (
            <span
              className={`text-[11px] px-2.5 py-0.5 rounded font-bold border ${
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

          {/* Active 24/7 Switch */}
          <button
            onClick={handleSetActive}
            className={`h-7 px-3 rounded font-bold flex items-center gap-1.5 transition border text-[11px] ${
              isCurrentActive
                ? 'bg-up/20 text-up border-up/40'
                : 'bg-[#151B28] text-textMuted border-white/10 hover:border-white/30 hover:text-white'
            }`}
          >
            {isCurrentActive ? <ToggleRight className="w-4 h-4 text-up" /> : <ToggleLeft className="w-4 h-4" />}
            <span>{isCurrentActive ? '🟢 ACTIVE 24/7' : 'SET ACTIVE 24/7'}</span>
          </button>

          {/* Load Instructions & Compile Playbook Button */}
          <button
            onClick={handleCompilePlaybook}
            disabled={compiling}
            className="h-7 px-3.5 bg-accent hover:bg-cyan-400 text-black font-bold rounded flex items-center gap-1.5 transition shadow-sm disabled:opacity-50 text-[11px]"
            title="AI parses natural language instructions and compiles into an operational execution playbook"
          >
            <Sparkles className={`w-3.5 h-3.5 ${compiling ? 'animate-spin' : ''}`} />
            <span>{compiling ? 'AI Compiling...' : '⚡ Load Instructions & Compile'}</span>
          </button>

          {/* Save Raw Instructions Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-7 px-3.5 bg-gold hover:bg-yellow-400 text-black font-bold rounded flex items-center gap-1.5 transition shadow-sm disabled:opacity-50 text-[11px]"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save'}</span>
          </button>

          {strategies.length > 1 && (
            <button
              onClick={handleDeleteStrategy}
              className="h-7 w-7 bg-down/15 hover:bg-down/30 text-down border border-down/30 rounded flex items-center justify-center transition"
              title="Delete Strategy"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* SECONDARY NAVIGATION: 5 Institutional Sub-Tabs */}
      <div className="h-9 px-4 bg-[#0A0E17] border-b border-borderHairline flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('editor')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded transition font-bold ${
              activeSubTab === 'editor'
                ? 'bg-[#182030] text-gold border border-gold/30'
                : 'text-textMuted hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>1. ✍️ Rules & Injector</span>
          </button>

          <button
            onClick={() => {
              setActiveSubTab('hud');
              fetchHUD();
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded transition font-bold ${
              activeSubTab === 'hud'
                ? 'bg-[#182030] text-up border border-up/30'
                : 'text-textMuted hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-up animate-pulse" />
            <span>2. 🟢 Live Rule Conformance HUD</span>
          </button>

          <button
            onClick={() => setActiveSubTab('playbook')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded transition font-bold ${
              activeSubTab === 'playbook'
                ? 'bg-[#182030] text-accent border border-accent/30'
                : 'text-textMuted hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>3. 🤖 AI Operational Playbook</span>
          </button>

          <button
            onClick={() => {
              setActiveSubTab('backtest');
              if (!backtestData) handleRunBacktest();
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded transition font-bold ${
              activeSubTab === 'backtest'
                ? 'bg-[#182030] text-yellow-400 border border-yellow-400/30'
                : 'text-textMuted hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-yellow-400" />
            <span>4. 🧪 MT5 Backtest & AI Tuner</span>
          </button>

          <button
            onClick={() => {
              setActiveSubTab('telemetry');
              fetchTelemetry();
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded transition font-bold ${
              activeSubTab === 'telemetry'
                ? 'bg-[#182030] text-cyan-400 border border-cyan-400/30'
                : 'text-textMuted hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>5. 🔍 Telemetry & Patterns</span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-[10px] text-textMuted">
          {currentStrategy?.updatedAt && (
            <span>Updated: <b className="text-textPrimary">{new Date(currentStrategy.updatedAt).toLocaleTimeString()}</b></span>
          )}
          <span>Length: <b className="text-textPrimary">{instructions.length} chars</b></span>
        </div>
      </div>

      {/* MAIN VIEWPORT */}
      <div className="flex-1 flex overflow-hidden">

        {/* SUB-TAB 1: RAW INSTRUCTIONS & QUICK INJECTOR */}
        {activeSubTab === 'editor' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Textarea Editor & Injector Chips */}
            <div className="flex-1 flex flex-col border-r border-borderHairline bg-[#0B0E14] overflow-hidden">
              <div className="p-2 px-3 bg-[#0F1420] border-b border-borderHairline flex items-center justify-between text-[11px]">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Strategy Title..."
                  className="bg-transparent font-bold text-white text-sm focus:outline-none focus:ring-1 focus:ring-gold/40 px-2 py-0.5 rounded w-1/2"
                />
                <span className="text-[10px] text-textMuted">✍️ Type in English, Roman Urdu, or Urdu</span>
              </div>

              {/* Quick Institutional Rule Injector Chips */}
              <div className="p-2 px-3 bg-[#0D121D] border-b border-borderHairline flex items-center gap-1.5 overflow-x-auto">
                <span className="text-[9px] uppercase font-bold text-gold flex items-center gap-1 mr-1 flex-shrink-0">
                  <Zap className="w-3 h-3" /> Quick Add Rules:
                </span>
                {RULE_INJECTORS.map((inj, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleInjectRule(inj.text)}
                    className="px-2 py-0.5 bg-[#141A28] hover:bg-[#1D253A] text-textPrimary hover:text-white border border-white/10 hover:border-gold/40 rounded text-[10px] whitespace-nowrap transition"
                  >
                    {inj.label}
                  </button>
                ))}
              </div>

              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Write your trading strategy rules here in plain English or Roman Urdu...&#10;&#10;Example:&#10;1. Sirf London Open (07:00 - 10:00 UTC) aur NY Open mein trade lo.&#10;2. 15m Fair Value Gap sweep pe 5m CHoCH confirmation ka intezar karo.&#10;3. RSI must be < 35 for BUY setups.&#10;4. Minimum 1:2.0 Risk-to-Reward ratio hona lazmi hai.&#10;5. Click '⚡ Load Instructions & Compile' to let AI learn your rules."
                className="flex-1 p-4 bg-transparent text-slate-100 font-mono text-[12px] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-gold/30 selection:bg-gold/20"
                spellCheck="false"
              />
            </div>

            {/* Right: AI Live Strategy Evaluation Simulator */}
            <div className="w-[420px] flex-shrink-0 flex flex-col bg-[#0D111A] overflow-hidden">
              <div className="p-3 border-b border-borderHairline bg-[#0E131F] flex items-center justify-between">
                <span className="text-[11px] uppercase font-bold text-accent flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Live Market Evaluation
                </span>
                <button
                  onClick={handleTestOnMarket}
                  disabled={testing}
                  className="h-6 px-3 bg-[#161B26] hover:bg-[#1E2536] text-accent border border-accent/40 rounded font-bold flex items-center gap-1 text-[10px] transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${testing ? 'animate-spin' : ''}`} />
                  <span>{testing ? 'Scanning...' : 'Test on Live Market'}</span>
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
                      Click <b className="text-accent">&quot;Test on Live Market&quot;</b> to let Google Gemini 3.6 Flash check current live Exness MT5 ticks and candles against your instructions.
                    </p>
                  </div>
                )}

                {!testing && testResult && (
                  <div className="space-y-2.5">
                    <div className="p-2.5 rounded bg-[#161C2C] border border-accent/30 text-accent font-bold text-[11px] flex items-center justify-between">
                      <span>🤖 Gemini 3.6 Flash Strategy Conformance:</span>
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

        {/* SUB-TAB 2: REAL-TIME RULE CONFORMANCE HUD */}
        {activeSubTab === 'hud' && (
          <div className="flex-1 flex flex-col p-4 bg-[#090C14] overflow-y-auto font-sans">
            <div className="max-w-5xl mx-auto w-full space-y-4">
              {/* HUD Summary Strip */}
              <div className="p-4 rounded-xl bg-[#0F1424] border border-up/30 shadow-lg flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-up uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-up animate-pulse" />
                    Live Deterministic Rule Conformance HUD
                  </div>
                  <h2 className="text-base font-bold text-white">
                    Strategy: {hudData?.strategyTitle || currentStrategy?.title}
                  </h2>
                  <p className="text-xs text-textMuted mt-0.5">
                    Continuous quantitative rule verification on live Exness MT5 market data.
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[10px] text-textMuted uppercase block">Conformance Score</span>
                    <span className="text-2xl font-bold text-up">{hudData?.conformanceScore || 0}%</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#141B2D] border border-white/10 text-center">
                    <span className="text-[10px] text-textMuted uppercase block">Status</span>
                    <span className={`text-xs font-bold ${hudData?.overallState === 'READY_TO_EXECUTE' ? 'text-up' : hudData?.overallState === 'CONDITIONS_FAILED' ? 'text-down' : 'text-yellow-400'}`}>
                      {hudData?.overallState === 'READY_TO_EXECUTE' ? '🟢 READY TO EXECUTE' : hudData?.overallState === 'CONDITIONS_FAILED' ? '🔴 CONDITIONS FAILED' : '⏳ WAITING FOR CONFLUENCE'}
                    </span>
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

              {/* Rule-by-Rule Live Matrix */}
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

        {/* SUB-TAB 3: COMPILED AI OPERATIONAL PLAYBOOK */}
        {activeSubTab === 'playbook' && (
          <div className="flex-1 flex overflow-hidden p-4 bg-[#090C14] overflow-y-auto">
            {!playbook ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-textMuted p-6">
                <BookOpen className="w-12 h-12 text-gold/40 mb-3" />
                <h3 className="text-white font-bold text-sm mb-1">Playbook Not Yet Compiled</h3>
                <p className="text-[11px] max-w-md mb-4 text-textMuted">
                  Click the <b>&quot;⚡ Load Instructions & Compile&quot;</b> button in the top bar to let Gemini translate your natural language rules into an autonomous execution playbook.
                </p>
                <button
                  onClick={handleCompilePlaybook}
                  disabled={compiling}
                  className="px-4 py-2 bg-accent hover:bg-cyan-400 text-black font-bold rounded flex items-center gap-2 text-xs transition"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Compile Playbook Now</span>
                </button>
              </div>
            ) : (
              <div className="max-w-5xl mx-auto w-full space-y-4 font-sans text-slate-200">
                {/* Header Card */}
                <div className="p-4 rounded-lg bg-[#0F1422] border border-accent/30 shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                      <Cpu className="w-4 h-4" />
                      Compiled AI Strategy Identity
                    </span>
                    <span className="text-[10px] text-textMuted">
                      Compiled At: {new Date(playbook.compiledAt).toLocaleString()}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white">{playbook.strategy_name || currentStrategy.title}</h2>
                  <p className="text-xs text-textMuted mt-1">{playbook.core_philosophy}</p>
                </div>

                {/* AI Self-Learning Summary in Roman Urdu */}
                {playbook.ai_learning_summary && (
                  <div className="p-4 rounded-lg bg-[#141A29] border border-gold/30">
                    <div className="text-xs font-bold text-gold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Compass className="w-4 h-4" />
                      AI Internal Execution Mandate (Roman Urdu):
                    </div>
                    <p className="text-xs leading-relaxed text-slate-100 whitespace-pre-wrap">
                      {playbook.ai_learning_summary}
                    </p>
                  </div>
                )}

                {/* Monitored Elements Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-lg bg-[#0E131E] border border-borderHairline">
                    <span className="text-[11px] font-bold text-gold uppercase tracking-wider block mb-2">
                      📊 Monitored Indicators
                    </span>
                    <div className="space-y-1.5">
                      {(playbook.monitored_indicators || []).map((ind, i) => (
                        <div key={i} className="p-2 rounded bg-[#141A29] text-[11px]">
                          <b className="text-white">{ind.name}</b> ({ind.timeframe}): <span className="text-textMuted">{ind.condition}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-[#0E131E] border border-borderHairline">
                    <span className="text-[11px] font-bold text-up uppercase tracking-wider block mb-2">
                      🕯️ Candlestick Patterns
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(playbook.monitored_candlesticks || []).map((c, i) => (
                        <span key={i} className="px-2 py-1 rounded bg-up/15 text-up text-[10px] font-bold border border-up/30">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-[#0E131E] border border-borderHairline">
                    <span className="text-[11px] font-bold text-accent uppercase tracking-wider block mb-2">
                      🏛️ SMC & Session Filters
                    </span>
                    <div className="space-y-1.5 text-[11px]">
                      {(playbook.monitored_smc_structures || []).map((s, i) => (
                        <div key={i} className="p-2 rounded bg-[#141A29]">
                          <b className="text-accent">{s.concept}:</b> <span className="text-textMuted">{s.rule}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Trigger Checklist & Risk Protocol */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-lg bg-[#0E131E] border border-borderHairline">
                    <span className="text-[11px] font-bold text-white uppercase tracking-wider block mb-2">
                      ✅ 24/7 Execution Trigger Checklist
                    </span>
                    <div className="space-y-1.5">
                      {(playbook.execution_trigger_checklist || []).map((step, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 rounded bg-[#141A29] text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-up flex-shrink-0 mt-0.5" />
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-[#0E131E] border border-borderHairline">
                    <span className="text-[11px] font-bold text-white uppercase tracking-wider block mb-2">
                      🛡️ Risk Management Protocol
                    </span>
                    {playbook.risk_management_protocol && (
                      <div className="space-y-1.5 text-[11px]">
                        <div className="p-2 rounded bg-[#141A29]">
                          <b>Max Risk:</b> <span className="text-gold font-bold">{playbook.risk_management_protocol.max_risk_percent}% per trade</span>
                        </div>
                        <div className="p-2 rounded bg-[#141A29]">
                          <b>Stop Loss:</b> <span className="text-textMuted">{playbook.risk_management_protocol.stop_loss_logic}</span>
                        </div>
                        <div className="p-2 rounded bg-[#141A29]">
                          <b>Take Profit:</b> <span className="text-textMuted">{playbook.risk_management_protocol.take_profit_logic}</span>
                        </div>
                        <div className="p-2 rounded bg-[#141A29]">
                          <b>Break-Even:</b> <span className="text-textMuted">{playbook.risk_management_protocol.break_even_rule}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUB-TAB 4: HISTORICAL MT5 BACKTEST & AI PARAMETER AUTO-TUNER */}
        {activeSubTab === 'backtest' && (
          <div className="flex-1 flex flex-col p-4 bg-[#090C14] overflow-y-auto font-sans">
            <div className="max-w-5xl mx-auto w-full space-y-4">
              {/* Backtest Header & Trigger */}
              <div className="p-4 rounded-xl bg-[#121828] border border-yellow-400/30 shadow-lg flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-yellow-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <Award className="w-4 h-4 text-yellow-400" />
                    Historical MT5 Candle Backtest & Parameter Auto-Tuner
                  </div>
                  <h2 className="text-base font-bold text-white">
                    Testing on Exness MT5 15m Real Data
                  </h2>
                  <p className="text-xs text-textMuted mt-0.5">
                    Evaluates strategy entry triggers, SL/TP dynamics, and Win Rate over past market cycles.
                  </p>
                </div>

                <button
                  onClick={handleRunBacktest}
                  disabled={backtestLoading}
                  className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-lg flex items-center gap-2 text-xs transition shadow-md disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 ${backtestLoading ? 'animate-spin' : ''}`} />
                  <span>{backtestLoading ? 'Simulating MT5 Candles...' : 'Run Simulation'}</span>
                </button>
              </div>

              {backtestLoading && (
                <div className="flex flex-col items-center justify-center p-12 text-textMuted gap-2">
                  <RefreshCw className="w-8 h-8 animate-spin text-yellow-400" />
                  <span>Running deterministic simulation across 250 historical Exness candles...</span>
                </div>
              )}

              {!backtestLoading && backtestData && (
                <div className="space-y-4">
                  {/* Metric Cards Grid */}
                  <div className="grid grid-cols-5 gap-3">
                    <div className="p-3.5 rounded-xl bg-[#0E131E] border border-borderHairline text-center">
                      <span className="text-[10px] text-textMuted uppercase block">Simulated Win Rate</span>
                      <span className="text-2xl font-bold text-up">{backtestData.winRate}%</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#0E131E] border border-borderHairline text-center">
                      <span className="text-[10px] text-textMuted uppercase block">Total Setups</span>
                      <span className="text-2xl font-bold text-white">{backtestData.totalTrades}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#0E131E] border border-borderHairline text-center">
                      <span className="text-[10px] text-textMuted uppercase block">Profit Factor</span>
                      <span className="text-2xl font-bold text-yellow-400">{backtestData.profitFactor}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#0E131E] border border-borderHairline text-center">
                      <span className="text-[10px] text-textMuted uppercase block">Average R:R</span>
                      <span className="text-2xl font-bold text-cyan-400">1:{backtestData.averageRR}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#0E131E] border border-borderHairline text-center">
                      <span className="text-[10px] text-textMuted uppercase block">Max Drawdown</span>
                      <span className="text-2xl font-bold text-textPrimary">{backtestData.maxDrawdown}</span>
                    </div>
                  </div>

                  {/* AI Parameter Tuning Recommendations */}
                  <div className="p-4 rounded-xl bg-[#141A29] border border-gold/30">
                    <h3 className="text-xs font-bold text-gold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      AI Parameter Optimization & Tuning Recommendations:
                    </h3>
                    <div className="space-y-2">
                      {(backtestData.aiTuningRecommendations || []).map((rec, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 rounded bg-[#0E131E] text-xs text-slate-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-gold flex-shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUB-TAB 5: FULL AI MARKET TELEMETRY & PATTERN INSPECTOR */}
        {activeSubTab === 'telemetry' && (
          <div className="flex-1 flex flex-col p-4 bg-[#090C14] overflow-y-auto">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <div>
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-up" />
                  Full Multi-Timeframe AI Telemetry Inspector
                </h3>
                <span className="text-[10px] text-textMuted">
                  Live readings fed directly into Gemini 3.6 Flash reasoning core across all timeframes
                </span>
              </div>
              <button
                onClick={fetchTelemetry}
                disabled={telemetryLoading}
                className="h-7 px-3 bg-[#161B26] hover:bg-[#1E2536] text-up border border-up/40 rounded font-bold flex items-center gap-1.5 text-[10px] transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${telemetryLoading ? 'animate-spin' : ''}`} />
                <span>{telemetryLoading ? 'Refreshing...' : 'Refresh Telemetry'}</span>
              </button>
            </div>

            {telemetryLoading && !telemetry && (
              <div className="flex-1 flex items-center justify-center text-textMuted">
                <RefreshCw className="w-6 h-6 animate-spin text-up mr-2" />
                <span>Reading live indicators and candlestick patterns...</span>
              </div>
            )}

            {telemetry && (
              <div className="space-y-4">
                {/* Live Macro Strip */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="p-2.5 rounded bg-[#111726] border border-borderHairline">
                    <span className="text-[9px] uppercase text-textMuted">Live Gold Price</span>
                    <div className="text-base font-bold text-gold">${telemetry.livePrice}</div>
                  </div>
                  <div className="p-2.5 rounded bg-[#111726] border border-borderHairline">
                    <span className="text-[9px] uppercase text-textMuted">DXY Dollar Index</span>
                    <div className="text-base font-bold text-white">{telemetry.macro?.DXY?.value || '98.9'}</div>
                  </div>
                  <div className="p-2.5 rounded bg-[#111726] border border-borderHairline">
                    <span className="text-[9px] uppercase text-textMuted">Silver (XAG/USD)</span>
                    <div className="text-base font-bold text-white">${telemetry.macro?.XAGUSD?.value || '68.86'}</div>
                  </div>
                  <div className="p-2.5 rounded bg-[#111726] border border-borderHairline">
                    <span className="text-[9px] uppercase text-textMuted">Market Session</span>
                    <div className="text-base font-bold text-accent">{telemetry.session}</div>
                  </div>
                </div>

                {/* Timeframes Grid */}
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(telemetry.telemetry || {}).map(([tf, data]) => (
                    <div key={tf} className="p-3 rounded-lg bg-[#0E131E] border border-borderHairline space-y-2">
                      <div className="flex items-center justify-between border-b border-borderHairline pb-1.5">
                        <span className="text-xs font-bold text-gold uppercase">{tf} Timeframe</span>
                        <span className="text-[10px] text-textMuted">Close: ${data.latestClose}</span>
                      </div>

                      {/* Candlestick Pattern */}
                      <div className="p-1.5 rounded bg-[#141A28] flex items-center justify-between">
                        <span className="text-[10px] text-textMuted">Pattern:</span>
                        <span className={`text-[10px] font-bold ${data.candlestickPattern.bias === 'BULLISH' ? 'text-up' : data.candlestickPattern.bias === 'BEARISH' ? 'text-down' : 'text-slate-200'}`}>
                          {data.candlestickPattern.pattern}
                        </span>
                      </div>

                      {/* Indicators */}
                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                        <div className="p-1 rounded bg-[#141A28]">
                          <span className="text-textMuted">RSI (14):</span> <b className={data.indicators.rsi > 70 ? 'text-down' : data.indicators.rsi < 30 ? 'text-up' : 'text-slate-200'}>{data.indicators.rsi || 'N/A'}</b>
                        </div>
                        <div className="p-1 rounded bg-[#141A28]">
                          <span className="text-textMuted">EMA 21:</span> <b>${data.indicators.ema21 || 'N/A'}</b>
                        </div>
                        <div className="p-1 rounded bg-[#141A28]">
                          <span className="text-textMuted">EMA 50:</span> <b>${data.indicators.ema50 || 'N/A'}</b>
                        </div>
                        <div className="p-1 rounded bg-[#141A28]">
                          <span className="text-textMuted">EMA 200:</span> <b>${data.indicators.ema200 || 'N/A'}</b>
                        </div>
                      </div>

                      {/* SMC Details */}
                      <div className="text-[10px] text-textMuted border-t border-borderHairline pt-1">
                        <div>Trend: <b className="text-slate-200">{data.smc.trend}</b> | Zone: <b className="text-accent">{data.smc.zone}</b></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

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
                placeholder="e.g. 5m FVG Scalper, Asian Sweep Breakout..."
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
