'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText, Save, Sparkles, Sliders, ToggleLeft, ToggleRight,
  Check, Clock, Shield, RefreshCw
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function StrategyPanel({ onStrategySaved }) {
  const [instructions, setInstructions] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [updatedAt, setUpdatedAt] = useState('');
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saveToast, setSaveToast] = useState(null);

  const fetchStrategy = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/strategy/instructions`);
      if (res.ok) {
        const data = await res.json();
        setInstructions(data.instructions || '');
        setEnabled(data.enabled !== false);
        setUpdatedAt(data.updatedAt || '');
        setPresets(data.presets || []);
      }
    } catch (e) {
      console.error('Failed to load strategy:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategy();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/strategy/instructions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions, enabled }),
      });
      if (res.ok) {
        const data = await res.json();
        setUpdatedAt(data.updatedAt);
        setSaveToast({ type: 'success', text: '✅ Master Strategy Directives saved & active 24/7!' });
        if (onStrategySaved) onStrategySaved(data);
      } else {
        setSaveToast({ type: 'error', text: '❌ Failed to save strategy instructions.' });
      }
    } catch (e) {
      setSaveToast({ type: 'error', text: '❌ Error: ' + e.message });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveToast(null), 4000);
    }
  };

  const handleToggle = async () => {
    const nextState = !enabled;
    setEnabled(nextState);
    try {
      await fetch(`${API_BASE}/api/strategy/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState }),
      });
      setSaveToast({
        type: nextState ? 'success' : 'warn',
        text: nextState ? '🟢 Strategy Directives ENABLED' : '🔴 Strategy Directives PAUSED',
      });
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handlePresetSelect = (presetId) => {
    setSelectedPreset(presetId);
    const found = presets.find((p) => p.id === presetId);
    if (found) {
      setInstructions(found.instructions);
    }
  };

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
      } else {
        setTestResult({ reply: 'Failed testing strategy against market.' });
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
        <span>Loading Master Strategy Directives...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#090C12] text-textPrimary font-mono text-xs overflow-hidden select-none">
      {/* Top Controls Bar */}
      <div className="h-12 px-4 bg-[#0D1118] border-b border-borderHairline flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold text-white">
            <FileText className="w-4 h-4 text-gold" />
            <span className="text-sm tracking-wide text-gold">MASTER STRATEGY DIRECTIVES</span>
          </div>

          <button
            onClick={handleToggle}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold border transition ${
              enabled
                ? 'bg-up/15 text-up border-up/30 hover:bg-up/25'
                : 'bg-down/15 text-down border-down/30 hover:bg-down/25'
            }`}
          >
            {enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            <span>{enabled ? 'ENFORCED 24/7' : 'PAUSED'}</span>
          </button>
        </div>

        {/* Action Buttons */}
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

          <button
            onClick={handleTestOnMarket}
            disabled={testing}
            className="h-7 px-3 bg-[#161B26] hover:bg-[#1E2536] text-accent border border-accent/40 rounded font-bold flex items-center gap-1.5 transition disabled:opacity-50 text-[11px]"
          >
            <Sparkles className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
            <span>{testing ? 'Evaluating Market...' : 'Test Strategy on Live Market'}</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="h-7 px-4 bg-gold hover:bg-yellow-400 text-black font-bold rounded flex items-center gap-1.5 transition shadow-sm disabled:opacity-50 text-[11px]"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Strategy'}</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Editor, Right Presets & AI Test Box */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Strategy Markdown / Prompt Editor */}
        <div className="flex-1 flex flex-col border-r border-borderHairline bg-[#0B0E14] overflow-hidden">
          <div className="h-8 px-3 bg-[#111622] border-b border-borderHairline flex items-center justify-between text-[10px] text-textMuted flex-shrink-0">
            <div className="flex items-center gap-2">
              <span>✍️ Natural Language Rules & Directives (English / Roman Urdu)</span>
            </div>
            <div className="flex items-center gap-3">
              {updatedAt && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-gold" />
                  Last Updated: <b className="text-textPrimary">{new Date(updatedAt).toLocaleTimeString()}</b>
                </span>
              )}
              <span>Chars: <b className="text-textPrimary">{instructions.length}</b></span>
            </div>
          </div>

          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Write your trading strategy rules here in plain English or Roman Urdu...&#10;&#10;Examples:&#10;1. Sirf London Open (07:00 - 10:00 UTC) aur NY Open mein trade lo.&#10;2. 15m Fair Value Gap sweep pe 5m CHoCH confirmation ka intezar karo.&#10;3. Minimum 1:2.0 Risk-to-Reward ratio hona lazmi hai.&#10;4. CPI/NFP news ke 15 mins pehle ya baad trade mat karo."
            className="flex-1 p-4 bg-transparent text-slate-100 font-mono text-[12px] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-gold/30 selection:bg-gold/20"
            spellCheck="false"
          />
        </div>

        {/* Right Presets & AI Test Evaluation */}
        <div className="w-[400px] flex-shrink-0 flex flex-col bg-[#0D111A] overflow-hidden">
          {/* Preset Strategies Selector */}
          <div className="p-3 border-b border-borderHairline bg-[#0E131F]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-bold text-gold flex items-center gap-1">
                <Sliders className="w-3 h-3" />
                Strategy Presets & Templates
              </span>
            </div>

            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePresetSelect(p.id)}
                  className={`w-full text-left p-2 rounded border transition text-[11px] ${
                    selectedPreset === p.id
                      ? 'bg-gold/15 border-gold/40 text-gold'
                      : 'bg-[#131826] border-white/5 text-textPrimary hover:border-white/20'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>{p.name}</span>
                    {selectedPreset === p.id && <Check className="w-3 h-3 text-gold" />}
                  </div>
                  <div className="text-[10px] text-textMuted mt-0.5 line-clamp-1">{p.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* AI Strategy Evaluation Box */}
          <div className="flex-1 flex flex-col overflow-hidden p-3 bg-[#0B0E17]">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <span className="text-[10px] uppercase font-bold text-accent flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Live AI Strategy Evaluation
              </span>
              {testResult && (
                <button
                  onClick={() => setTestResult(null)}
                  className="text-[9px] text-textMuted hover:text-textPrimary"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto bg-[#101420] border border-borderHairline rounded p-3 text-[11px] leading-relaxed">
              {testing && (
                <div className="flex flex-col items-center justify-center h-full text-textMuted gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-accent" />
                  <span>Evaluating Exness market against your rules...</span>
                </div>
              )}

              {!testing && !testResult && (
                <div className="flex flex-col items-center justify-center h-full text-textMuted text-center p-4">
                  <Shield className="w-8 h-8 text-textMuted/40 mb-2" />
                  <p className="text-[10px]">Click <b className="text-accent">&quot;Test Strategy on Live Market&quot;</b> to see how Google Gemini evaluates current market conditions against your custom instructions.</p>
                </div>
              )}

              {!testing && testResult && (
                <div className="space-y-2">
                  <div className="p-2 rounded bg-[#161C2C] border border-accent/20 text-accent font-bold text-[11px]">
                    🤖 Gemini 3.6 Flash Compliance Check:
                  </div>
                  <div className="whitespace-pre-wrap text-slate-200 text-[11px] font-sans">
                    {testResult.reply || testResult.thought_process || JSON.stringify(testResult, null, 2)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
