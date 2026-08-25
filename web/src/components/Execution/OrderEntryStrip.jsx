'use client';

import React, { useState } from 'react';
import { Zap, AlertTriangle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function OrderEntryStrip({
  slPips = 15,
  tpPips = 45,
  onSlPipsChange,
  onTpPipsChange,
  onOrderPlaced,
}) {
  const [lotSize, setLotSize] = useState(0.01);
  const [loading, setLoading] = useState(false);
  const [orderType, setOrderType] = useState('BUY');

  const handlePlaceOrder = async (side) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/trade/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: side,
          lot: lotSize,
          sl: null,
          tp: null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (onOrderPlaced) onOrderPlaced();
      }
    } catch (e) {
      console.error('Order failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-10 px-3 bg-[#11141B] border-b border-borderHairline flex items-center justify-between font-mono text-xs select-none gap-3 overflow-x-auto">

      {/* Buy/Sell Buttons */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={() => handlePlaceOrder('BUY')}
          disabled={loading}
          className="h-7 px-3 bg-up/15 hover:bg-up text-up hover:text-black border border-up/35 font-bold rounded flex items-center gap-1.5 transition shadow-sm disabled:opacity-50 text-[11px]"
        >
          <Zap className="w-3 h-3" />
          <span>BUY</span>
          <span className="text-[9px] px-1 py-0.2 bg-black/40 text-up rounded border border-up/25">[B]</span>
        </button>

        <button
          onClick={() => handlePlaceOrder('SELL')}
          disabled={loading}
          className="h-7 px-3 bg-down/15 hover:bg-down text-down hover:text-white border border-down/35 font-bold rounded flex items-center gap-1.5 transition shadow-sm disabled:opacity-50 text-[11px]"
        >
          <Zap className="w-3 h-3" />
          <span>SELL</span>
          <span className="text-[9px] px-1 py-0.2 bg-black/40 text-down rounded border border-down/25">[S]</span>
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 text-[11px] flex-shrink-0">
        {/* Lot Size */}
        <div className="flex items-center gap-1 bg-[#0E1117] border border-white/10 rounded px-2 h-7">
          <span className="text-textMuted text-[10px]">LOTS:</span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max="10.00"
            value={lotSize}
            onChange={(e) => setLotSize(Number(e.target.value))}
            className="w-12 bg-transparent text-textPrimary text-center font-mono font-bold focus:outline-none"
          />
          <select
            value={lotSize}
            onChange={(e) => setLotSize(Number(e.target.value))}
            className="bg-transparent text-textMuted text-[10px] focus:outline-none cursor-pointer border-l border-white/10 pl-1"
          >
            <option value={0.01}>0.01</option>
            <option value={0.05}>0.05</option>
            <option value={0.10}>0.10</option>
            <option value={0.50}>0.50</option>
            <option value={1.00}>1.00</option>
          </select>
        </div>

        {/* SL */}
        <div className="flex items-center gap-1 bg-[#0E1117] border border-white/10 rounded px-2 h-7">
          <span className="text-down text-[10px] font-bold">SL:</span>
          <input
            type="number"
            min="2"
            max="200"
            value={slPips}
            onChange={(e) => onSlPipsChange && onSlPipsChange(Number(e.target.value))}
            className="w-8 bg-transparent text-textPrimary text-center font-mono font-bold focus:outline-none"
          />
          <span className="text-textMuted text-[9px]">p</span>
        </div>

        {/* TP */}
        <div className="flex items-center gap-1 bg-[#0E1117] border border-white/10 rounded px-2 h-7">
          <span className="text-up text-[10px] font-bold">TP:</span>
          <input
            type="number"
            min="5"
            max="500"
            value={tpPips}
            onChange={(e) => onTpPipsChange && onTpPipsChange(Number(e.target.value))}
            className="w-9 bg-transparent text-textPrimary text-center font-mono font-bold focus:outline-none"
          />
          <span className="text-textMuted text-[9px]">p</span>
        </div>

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-center gap-1 text-gold text-[10px]">
            <div className="w-3 h-3 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
            <span>Executing...</span>
          </div>
        )}
      </div>
    </div>
  );
}
