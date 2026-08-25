'use client';

import React, { useState, useEffect, useCallback } from 'react';
import CountUp from 'react-countup';
import confetti from 'canvas-confetti';
import dayjs from 'dayjs';
import { Toaster, toast } from 'sonner';
import {
  Activity, Bot, Layers, Settings, Bell, Play, Pause,
  LineChart, TrendingUp, TrendingDown, Shield, Zap,
  BarChart3, RefreshCw, Send, ChevronDown, CheckCircle2,
  FileCode2, Sparkles, SlidersHorizontal, Search, Command as CmdIcon
} from 'lucide-react';

import TradingChart from '../components/Chart/TradingChart';
import AccountPanel from '../components/Dashboard/AccountPanel';
import PositionsTable from '../components/Dashboard/PositionsTable';
import AIAnalysisPanel from '../components/Dashboard/AIAnalysisPanel';
import StrategyPanel from '../components/Dashboard/StrategyPanel';
import OrderEntryStrip from '../components/Execution/OrderEntryStrip';
import CommandPalette from '../components/CommandPalette/CommandPalette';
import { useTradingStore } from '../store/useTradingStore';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function TerminalWorkspace() {
  const {
    activeTab,
    setActiveTab,
    selectedTimeframe,
    setSelectedTimeframe,
    account,
    setAccount,
    status,
    setStatus,
    positions,
    setPositions,
    toggleCommandPalette,
  } = useTradingStore();

  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [slPips, setSlPips] = useState(15);
  const [tpPips, setTpPips] = useState(45);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setAccount({ balance: data.balance || 462.14, equity: data.equity || 462.14, pnl: data.pnl || 0 });
      }
    } catch (e) {}
  }, [setStatus, setAccount]);

  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/positions`);
      if (res.ok) {
        const data = await res.json();
        setPositions(data.positions || []);
      }
    } catch (e) {}
  }, [setPositions]);

  const runAnalysis = useCallback(async () => {
    setAnalysisLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/analyze`);
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
        toast.success('AI Market Synthesis scan complete', {
          description: `Bias: ${data.overall_bias || 'NEUTRAL'} | Confidence: ${data.confidence || '85%'}`,
        });
      }
    } catch (e) {
      toast.error('Analysis failed: ' + e.message);
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
    // Micro-moment celebration with subtle confetti
    try {
      confetti({
        particleCount: 35,
        spread: 60,
        origin: { y: 0.9, x: 0.2 },
        colors: ['#089981', '#f59e0b', '#29b6f6'],
      });
    } catch (e) {}
    toast.success('Order executed successfully on Exness MT5 feeds');
  };

  const currentTime = dayjs().format('HH:mm:ss');

  return (
    <div className="flex flex-col h-screen w-screen bg-bgBase text-textPrimary overflow-hidden font-sans select-none">
      
      {/* Sonner Rich Toaster Notifications */}
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#10151d',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#f0f3f6',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px',
          },
        }}
      />

      {/* Cmd+K Command Palette */}
      <CommandPalette onRunAnalysis={runAnalysis} />

      {/* TOP HEADER NAVIGATION RIBBON */}
      <header className="h-[38px] px-3 bg-bgPanel border-b border-borderHairline flex items-center justify-between font-mono text-[11px] flex-shrink-0 z-30">
        
        {/* Left Branding & Workspace Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold tracking-wider text-textPrimary">
            <span className="w-2 h-2 rounded-full bg-gold animate-live-dot" />
            <span className="text-gold tracking-widest font-extrabold text-[12px]">GOLD//AI</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-gold/15 text-gold font-bold">v2.0</span>
          </div>

          {/* MAIN TAB SWITCHER */}
          <div className="flex items-center gap-1 bg-bgBase p-0.5 rounded ml-2">
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

          {/* Real-Time Tabular Account Balances with React CountUp */}
          <div className="flex items-center gap-3 text-textMuted border-l border-borderHairline pl-3 text-[11px] tabular-nums">
            <span>
              BAL: <b className="text-textPrimary">
                $<CountUp end={account?.balance || 462.14} decimals={2} duration={0.8} preserveValue />
              </b>
            </span>
            <span>
              EQ: <b className="text-textPrimary">
                $<CountUp end={account?.equity || 462.14} decimals={2} duration={0.8} preserveValue />
              </b>
            </span>
            <span>
              P&L:{' '}
              <b className={`font-bold ${status?.bias ? 'text-up' : 'text-textPrimary'}`}>
                {status?.bias ? `+${status.bias}` : '$0.00'}
              </b>
            </span>
          </div>
        </div>

        {/* Right Status Tags & Command Trigger */}
        <div className="flex items-center gap-2">
          {/* Cmd+K Shortcut Button */}
          <button
            onClick={toggleCommandPalette}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-bgElevated hover:bg-bgHover text-textMuted hover:text-textPrimary text-[10px] font-mono transition"
            title="Open Command Palette (Ctrl+K)"
          >
            <CmdIcon className="w-3 h-3 text-gold" />
            <span>Search</span>
            <kbd className="px-1 py-0.2 rounded bg-black/40 text-[9px] text-textSecondary">Ctrl+K</kbd>
          </button>

          {/* Session Tag */}
          <div className="flex items-center gap-1.5 bg-bgElevated rounded px-2 py-0.5 text-[10px]">
            <span className="text-textMuted">SESSION:</span>
            <span className="text-gold font-bold">{status?.session || 'LONDON'}</span>
          </div>

          {/* Bias Tag */}
          <div className="flex items-center gap-1.5 bg-bgElevated rounded px-2 py-0.5 text-[10px]">
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

          {/* Quick AI Trigger */}
          <button
            onClick={runAnalysis}
            disabled={analysisLoading}
            className="h-6 px-2.5 bg-gold/15 hover:bg-gold text-gold hover:text-black rounded font-bold transition duration-150 flex items-center gap-1 text-[10px] disabled:opacity-50"
          >
            <Zap className={`w-3 h-3 ${analysisLoading ? 'animate-spin' : ''}`} />
            <span>{analysisLoading ? 'SCANNING...' : 'ANALYZE'}</span>
          </button>
        </div>
      </header>

      {/* MAIN VIEWPORT */}
      {activeTab === 'strategy' ? (
        <StrategyPanel onStrategySaved={() => toast.success('Master Strategy updated & active 24/7')} />
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
    </div>
  );
}
