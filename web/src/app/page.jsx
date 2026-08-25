'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, Bot, Layers, Settings, Bell, Play, Pause,
  LineChart, TrendingUp, TrendingDown, Shield, Zap,
  BarChart3, RefreshCw, Send, ChevronDown,
} from 'lucide-react';

import TradingChart from '../components/Chart/TradingChart';
import AccountPanel from '../components/Dashboard/AccountPanel';
import PositionsTable from '../components/Dashboard/PositionsTable';
import AIAnalysisPanel from '../components/Dashboard/AIAnalysisPanel';
import OrderEntryStrip from '../components/Execution/OrderEntryStrip';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function TerminalWorkspace() {
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

      {/* TOP RIBBON BAR */}
      <header className="h-[36px] px-4 bg-[#0D1016] border-b border-borderHairline flex items-center justify-between font-mono text-[11px] flex-shrink-0 z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-bold tracking-wider text-white">
            <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />
            <span className="text-gold">GOLD//AI</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gold/15 text-gold font-semibold border border-gold/25">v2.0</span>
          </div>
          <div className="flex items-center gap-4 text-textMuted border-l border-borderHairline pl-4">
            <span>BAL: <b className="text-textPrimary">${(account?.balance || 0).toLocaleString()}</b></span>
            <span>EQ: <b className="text-textPrimary">${(account?.equity || 0).toLocaleString()}</b></span>
            <span>
              P&L:{' '}
              <b className="text-up font-bold">
                {status?.bias ? `+${status.bias}` : '$0.00'}
              </b>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-[#141822] border border-white/10 rounded px-2 py-0.5">
            <span className="text-textMuted">SESSION:</span>
            <span className="text-gold font-bold">{status?.session || 'LOADING'}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-[#141822] border border-white/10 rounded px-2 py-0.5">
            <span className="text-textMuted">BIAS:</span>
            <span className={`font-bold ${status?.bias?.includes('BULL') ? 'text-up' : status?.bias?.includes('BEAR') ? 'text-down' : 'text-gold'}`}>
              {status?.bias || 'NEUTRAL'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-[#141822] border border-white/10 rounded px-2 py-0.5">
            <span className="text-textMuted">MODE:</span>
            <span className="text-accent font-bold">{status?.mode || 'SEMI'}</span>
          </div>
          <button
            onClick={runAnalysis}
            className="h-6 px-2.5 bg-gold/20 hover:bg-gold text-gold hover:text-black border border-gold/40 rounded font-bold transition flex items-center gap-1"
          >
            <Zap className="w-3 h-3" />
            <span>ANALYZE</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT: Chart + Order Entry */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-borderHairline">
          {/* Chart */}
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

        {/* RIGHT: Dashboard Panels */}
        <div className="w-[380px] flex-shrink-0 flex flex-col overflow-hidden bg-bgPanel">
          {/* Account Summary */}
          <div className="flex-shrink-0 border-b border-borderHairline">
            <AccountPanel account={account} status={status} />
          </div>

          {/* AI Analysis */}
          <div className="flex-shrink-0 border-b border-borderHairline" style={{ height: '35%' }}>
            <AIAnalysisPanel
              analysis={analysis}
              loading={analysisLoading}
              onRefresh={runAnalysis}
            />
          </div>

          {/* Positions */}
          <div className="flex-1 overflow-hidden">
            <PositionsTable positions={positions} onRefresh={fetchPositions} />
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg shadow-2xl font-mono text-xs flex items-center gap-2 animate-in slide-in-from-bottom duration-150 ${
          toast.type === 'success' ? 'bg-up/20 border border-up/40 text-up' :
          toast.type === 'error' ? 'bg-down/20 border border-down/40 text-down' :
          'bg-accent/20 border border-accent/40 text-accent'
        }`}>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
