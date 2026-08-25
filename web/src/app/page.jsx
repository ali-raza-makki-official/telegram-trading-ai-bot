'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, Bot, Layers, Settings, Bell, Play, Pause,
  LineChart, TrendingUp, TrendingDown, Shield, Zap,
  BarChart3, RefreshCw, Send, ChevronDown, CheckCircle2,
  FileCode2, Sparkles, SlidersHorizontal
} from 'lucide-react';

import TradingChart from '../components/Chart/TradingChart';
import AccountPanel from '../components/Dashboard/AccountPanel';
import PositionsTable from '../components/Dashboard/PositionsTable';
import AIAnalysisPanel from '../components/Dashboard/AIAnalysisPanel';
import StrategyPanel from '../components/Dashboard/StrategyPanel';
import OrderEntryStrip from '../components/Execution/OrderEntryStrip';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function TerminalWorkspace() {
  const [activeTab, setActiveTab] = useState('terminal'); // 'terminal' | 'strategy'
  const [selectedTimeframe, setSelectedTimeframe] = useState('15m');
  const [account, setAccount] = useState(null);
  const [status, setStatus] = useState(null);
  const [positions, setPositions] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [slPips, setSlPips] = useState(15);
  const [tpPips, setTpPips] = useState(45);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setAccount({ balance: data.balance, equity: data.equity });
      }
    } catch (e) {}
  }, []);

  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/positions`);
      if (res.ok) {
        const data = await res.json();
        setPositions(data.positions || []);
      }
    } catch (e) {}
  }, []);

  const runAnalysis = useCallback(async () => {
    setAnalysisLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/analyze`);
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
        showToast('AI Analysis complete', 'success');
      }
    } catch (e) {
      showToast('Analysis failed: ' + e.message, 'error');
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchPositions();
    const interval = setInterval(() => {
      fetchStatus();
      fetchPositions();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchPositions]);

  const handleOrderPlaced = () => {
    fetchPositions();
    showToast('Order executed successfully', 'success');
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-bgBase text-textPrimary overflow-hidden font-sans select-none">

      {/* TOP HEADER NAVIGATION RIBBON */}
      <header className="h-[38px] px-3 bg-bgPanel border-b border-borderHairline flex items-center justify-between font-mono text-[11px] flex-shrink-0 z-30">
        
        {/* Left Branding & Workspace Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold tracking-wider text-textPrimary">
            <span className="w-2 h-2 rounded-full bg-gold animate-live-dot" />
            <span className="text-gold tracking-widest font-extrabold text-[12px]">GOLD//AI</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gold/15 text-gold font-bold border border-gold/30">v2.0</span>
          </div>

          {/* MAIN TAB SWITCHER */}
          <div className="flex items-center gap-1 bg-bgBase p-0.5 rounded border border-borderHairline ml-2">
            <button
              onClick={() => setActiveTab('terminal')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold transition duration-150 ${
                activeTab === 'terminal'
                  ? 'bg-gold text-black shadow-sm'
                  : 'text-textMuted hover:text-textPrimary hover:bg-bgElevated'
              }`}
            >
              <LineChart className="w-3.5 h-3.5" />
              <span>LIVE TERMINAL</span>
            </button>

            <button
              onClick={() => setActiveTab('strategy')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold transition duration-150 ${
                activeTab === 'strategy'
                  ? 'bg-gold text-black shadow-sm'
                  : 'text-textMuted hover:text-textPrimary hover:bg-bgElevated'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>STRATEGY DIRECTIVES</span>
            </button>
          </div>

          {/* Real-Time Tabular Account Balances */}
          <div className="flex items-center gap-3 text-textMuted border-l border-borderHairline pl-3 text-[11px] tabular-nums">
            <span>BAL: <b className="text-textPrimary">${(account?.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></span>
            <span>EQ: <b className="text-textPrimary">${(account?.equity || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></span>
            <span>
              P&L:{' '}
              <b className={`font-bold ${status?.bias ? 'text-up' : 'text-textPrimary'}`}>
                {status?.bias ? `+${status.bias}` : '$0.00'}
              </b>
            </span>
          </div>
        </div>

        {/* Right Status Tags & Trigger */}
        <div className="flex items-center gap-2">
          {/* Session Tag */}
          <div className="flex items-center gap-1.5 bg-bgElevated border border-borderHairline rounded px-2 py-0.5 text-[10px]">
            <span className="text-textMuted">SESSION:</span>
            <span className="text-gold font-bold">{status?.session || 'LONDON'}</span>
          </div>

          {/* Bias Tag */}
          <div className="flex items-center gap-1.5 bg-bgElevated border border-borderHairline rounded px-2 py-0.5 text-[10px]">
            <span className="text-textMuted">BIAS:</span>
            <span className={`font-bold flex items-center gap-1 ${
              status?.bias?.includes('BULL') ? 'text-up' :
              status?.bias?.includes('BEAR') ? 'text-down' : 'text-gold'
            }`}>
              {status?.bias?.includes('BULL') && <TrendingUp className="w-3 h-3 text-up" />}
              {status?.bias?.includes('BEAR') && <TrendingDown className="w-3 h-3 text-down" />}
              {status?.bias || 'NEUTRAL'}
            </span>
          </div>

          {/* Mode Tag */}
          <div className="flex items-center gap-1.5 bg-bgElevated border border-borderHairline rounded px-2 py-0.5 text-[10px]">
            <span className="text-textMuted">MODE:</span>
            <span className="text-accent font-bold">{status?.mode || 'AUTO'}</span>
          </div>

          {/* Quick AI Trigger */}
          <button
            onClick={runAnalysis}
            disabled={analysisLoading}
            className="h-6 px-2.5 bg-gold/15 hover:bg-gold text-gold hover:text-black border border-gold/40 rounded font-bold transition duration-150 flex items-center gap-1 text-[10px] disabled:opacity-50"
          >
            <Zap className={`w-3 h-3 ${analysisLoading ? 'animate-spin' : ''}`} />
            <span>{analysisLoading ? 'SCANNING...' : 'ANALYZE'}</span>
          </button>
        </div>
      </header>

      {/* MAIN VIEWPORT */}
      {activeTab === 'strategy' ? (
        <StrategyPanel onStrategySaved={() => showToast('Master Strategy updated & active 24/7', 'success')} />
      ) : (
        <div className="flex-1 flex overflow-hidden bg-bgBase">

          {/* LEFT: Chart + Order Entry Strip */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-borderHairline">
            {/* Chart Container */}
            <div className="flex-1 overflow-hidden">
              <TradingChart
                timeframe={selectedTimeframe}
                onTimeframeChange={setSelectedTimeframe}
                slPips={slPips}
                tpPips={tpPips}
                status={status}
              />
            </div>

            {/* Order Entry Strip */}
            <div className="flex-shrink-0">
              <OrderEntryStrip
                slPips={slPips}
                tpPips={tpPips}
                onSlPipsChange={setSlPips}
                onTpPipsChange={setTpPips}
                onOrderPlaced={handleOrderPlaced}
              />
            </div>
          </div>

          {/* RIGHT: Dashboard Panels (Account, AI Synthesis, Positions) */}
          <div className="w-[390px] flex-shrink-0 flex flex-col overflow-hidden bg-bgPanel">
            {/* Account Summary */}
            <div className="flex-shrink-0 border-b border-borderHairline">
              <AccountPanel account={account} status={status} />
            </div>

            {/* AI Analysis */}
            <div className="flex-shrink-0 border-b border-borderHairline" style={{ height: '36%' }}>
              <AIAnalysisPanel
                analysis={analysis}
                loading={analysisLoading}
                onRefresh={runAnalysis}
              />
            </div>

            {/* Positions Table */}
            <div className="flex-1 overflow-hidden">
              <PositionsTable positions={positions} onRefresh={fetchPositions} />
            </div>
          </div>
        </div>
      )}

      {/* Modern Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-3.5 py-2 rounded-lg shadow-2xl font-mono text-xs flex items-center gap-2 transition duration-200 border backdrop-blur-md ${
          toast.type === 'success' ? 'bg-up/15 border-up/40 text-up' :
          toast.type === 'error' ? 'bg-down/15 border-down/40 text-down' :
          'bg-accent/15 border-accent/40 text-accent'
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
