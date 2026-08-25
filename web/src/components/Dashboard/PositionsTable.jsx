'use client';

import React, { useState } from 'react';
import { Activity, X, RefreshCw, ArrowUpRight, ArrowDownRight, Layers } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function PositionsTable({ positions, onRefresh }) {
  const [closingId, setClosingId] = useState(null);

  const handleClose = async (ticket) => {
    setClosingId(ticket);
    try {
      await fetch(`${API_BASE}/api/trade/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket }),
      });
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setClosingId(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-bgPanel font-mono text-[11px] overflow-hidden select-none">
      {/* Header */}
      <div className="panel-header flex-shrink-0">
        <div className="flex items-center gap-1.5 font-bold text-textPrimary">
          <Layers className="w-3.5 h-3.5 text-accent" />
          <span>Active Positions ({positions.length})</span>
        </div>
        <button
          onClick={onRefresh}
          className="p-1 rounded text-textMuted hover:text-textPrimary hover:bg-bgElevated transition"
          title="Refresh Positions"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {positions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-textMuted p-4 text-center">
            <Activity className="w-7 h-7 text-textMuted/40 mb-1.5" />
            <span className="text-[11px] font-semibold text-textSecondary">No Open Positions</span>
            <span className="text-[9px] text-textMuted mt-0.5">Orders executed by AI or terminal will appear here.</span>
          </div>
        ) : (
          <table className="w-full text-left border-collapse tabular-nums">
            <thead className="bg-bgElevated text-textMuted text-[9px] uppercase sticky top-0 border-b border-borderHairline">
              <tr>
                <th className="py-1.5 px-2.5 font-bold">Ticket</th>
                <th className="py-1.5 px-2 font-bold">Side</th>
                <th className="py-1.5 px-2 font-bold text-right">Lot</th>
                <th className="py-1.5 px-2 font-bold text-right">Entry</th>
                <th className="py-1.5 px-2.5 font-bold text-right">P&L</th>
                <th className="py-1.5 px-2 font-bold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderHairline">
              {positions.map((pos) => {
                const pnl = pos.floatingPnl || pos.pnl || 0;
                const isBuy = pos.type === 'BUY';
                return (
                  <tr key={pos.ticket || pos.id} className="terminal-row">
                    <td className="py-1.5 px-2.5 text-accent font-bold">
                      #{(pos.ticket || pos.id || '').toString().slice(-6)}
                    </td>
                    <td className="py-1.5 px-2">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 w-fit ${
                        isBuy ? 'bg-up/15 text-up border border-up/30' : 'bg-down/15 text-down border border-down/30'
                      }`}>
                        {isBuy ? <ArrowUpRight className="w-2.5 h-2.5 text-up" /> : <ArrowDownRight className="w-2.5 h-2.5 text-down" />}
                        <span>{pos.type}</span>
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right text-textPrimary">{pos.lot}</td>
                    <td className="py-1.5 px-2 text-right text-textPrimary">${pos.entryPrice?.toFixed(2)}</td>
                    <td className={`py-1.5 px-2.5 text-right font-bold ${pnl >= 0 ? 'text-up' : 'text-down'}`}>
                      {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <button
                        onClick={() => handleClose(pos.ticket || pos.id)}
                        disabled={closingId === (pos.ticket || pos.id)}
                        className="p-1 rounded bg-down/15 text-down hover:bg-down hover:text-white border border-down/30 transition disabled:opacity-50"
                        title="Close Position"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
