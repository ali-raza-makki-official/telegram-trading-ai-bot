'use client';

import React, { useState } from 'react';
import { Activity, X, RefreshCw } from 'lucide-react';

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
    <div className="h-full flex flex-col bg-bgPanel font-mono text-[11px] overflow-hidden">
      {/* Header */}
      <div className="panel-header flex-shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-3 h-3 text-accent" />
          <span>Open Positions ({positions.length})</span>
        </div>
        <button onClick={onRefresh} className="text-textMuted hover:text-textPrimary transition">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {positions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-textMuted">
            <div className="text-center">
              <Activity className="w-5 h-5 mx-auto mb-2 opacity-50" />
              <span className="text-[10px]">No open positions</span>
            </div>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-[#0A0D14] text-textMuted text-[9px] uppercase sticky top-0 border-b border-borderHairline">
              <tr>
                <th className="py-1.5 px-2 font-bold">Ticket</th>
                <th className="py-1.5 px-2 font-bold">Side</th>
                <th className="py-1.5 px-2 font-bold text-right">Lot</th>
                <th className="py-1.5 px-2 font-bold text-right">Entry</th>
                <th className="py-1.5 px-2 font-bold text-right">P&L</th>
                <th className="py-1.5 px-2 font-bold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1E24]">
              {positions.map((pos) => {
                const pnl = pos.floatingPnl || pos.pnl || 0;
                return (
                  <tr key={pos.ticket || pos.id} className="hover:bg-bgPanelAlt transition">
                    <td className="py-1.5 px-2 text-accent font-semibold">
                      #{(pos.ticket || pos.id || '').toString().slice(-6)}
                    </td>
                    <td className="py-1.5 px-2">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        pos.type === 'BUY' ? 'bg-up/15 text-up border border-up/25' : 'bg-down/15 text-down border border-down/25'
                      }`}>
                        {pos.type}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right text-textPrimary">{pos.lot}</td>
                    <td className="py-1.5 px-2 text-right text-textPrimary">${pos.entryPrice?.toFixed(2)}</td>
                    <td className={`py-1.5 px-2 text-right font-bold ${pnl >= 0 ? 'text-up' : 'text-down'}`}>
                      {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <button
                        onClick={() => handleClose(pos.ticket || pos.id)}
                        disabled={closingId === (pos.ticket || pos.id)}
                        className="p-1 rounded bg-down/15 text-down hover:bg-down/25 border border-down/25 transition disabled:opacity-50"
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
