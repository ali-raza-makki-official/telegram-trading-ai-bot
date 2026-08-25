'use client';

import React from 'react';
import { Activity, Shield, TrendingUp, TrendingDown, Clock, Bot, Wallet } from 'lucide-react';

export default function AccountPanel({ account, status }) {
  const balance = account?.balance || 0;
  const equity = account?.equity || 0;
  const pnl = equity - balance;

  return (
    <div className="p-3 bg-bgPanel font-mono text-[11px] select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Wallet className="w-3.5 h-3.5 text-gold" />
          <span className="text-textSecondary uppercase tracking-wider text-[10px] font-bold">Account Metrics</span>
        </div>
        <span className="text-[9px] px-2 py-0.5 rounded bg-gold/15 text-gold border border-gold/30 font-bold">
          {status?.mode || 'AUTO'} MODE
        </span>
      </div>

      {/* Metrics Grid with Tabular Numerals */}
      <div className="grid grid-cols-2 gap-2 tabular-nums">
        <div className="bg-bgElevated border border-borderHairline rounded-lg p-2">
          <div className="text-textMuted text-[9px] uppercase mb-0.5">Balance</div>
          <div className="text-textPrimary font-bold text-sm">${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>

        <div className="bg-bgElevated border border-borderHairline rounded-lg p-2">
          <div className="text-textMuted text-[9px] uppercase mb-0.5">Equity</div>
          <div className="text-textPrimary font-bold text-sm">${equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>

        <div className="bg-bgElevated border border-borderHairline rounded-lg p-2">
          <div className="text-textMuted text-[9px] uppercase mb-0.5">Floating P&L</div>
          <div className={`font-bold text-sm flex items-center gap-1 ${pnl >= 0 ? 'text-up' : 'text-down'}`}>
            {pnl >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-up" /> : <TrendingDown className="w-3.5 h-3.5 text-down" />}
            <span>{pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}</span>
          </div>
        </div>

        <div className="bg-bgElevated border border-borderHairline rounded-lg p-2">
          <div className="text-textMuted text-[9px] uppercase mb-0.5">Open Trades</div>
          <div className="text-textPrimary font-bold text-sm">{status?.openTrades || 0} active</div>
        </div>
      </div>

      {/* Session & Killzone Meta */}
      <div className="mt-2.5 pt-2 border-t border-borderHairline flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-gold" />
          <span className="text-textMuted">Session:</span>
          <span className="text-gold font-bold">{status?.session || 'LONDON'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-accent" />
          <span className="text-textMuted">Killzone:</span>
          <span className="text-accent font-bold">{status?.killzone || 'Active'}</span>
        </div>
      </div>

      {/* AI Bias & Confidence */}
      <div className="mt-1.5 flex items-center justify-between text-[10px] bg-bgBase p-1.5 rounded border border-borderHairline">
        <div className="flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-gold" />
          <span className="text-textMuted">AI Bias:</span>
          <span className={`font-bold ${
            status?.bias?.includes('BULL') ? 'text-up' :
            status?.bias?.includes('BEAR') ? 'text-down' : 'text-gold'
          }`}>
            {status?.bias || 'NEUTRAL'}
          </span>
        </div>
        {status?.confidence && (
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/40 text-textSecondary font-mono font-bold">
            {status.confidence}% Conf
          </span>
        )}
      </div>
    </div>
  );
}
