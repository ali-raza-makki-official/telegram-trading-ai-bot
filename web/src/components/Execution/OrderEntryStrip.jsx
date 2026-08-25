'use client';

import React, { useState } from 'react';
import { Zap, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';

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
    <div className="h-11 px-3 bg-bgPanel border-b border-borderHairline flex items-center justify-between font-mono text-xs select-none gap-3 overflow-x-auto">

      {/* TradingView-grade Buy/Sell Buttons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => handlePlaceOrder('BUY')}
          disabled={loading}
          className="h-8 px-4 bg-up hover:brightness-110 text-white font-bold rounded flex items-center gap-1.5 transition duration-150 shadow-sm disabled:opacity-50 text-[11px]"
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>BUY / LONG</span>
        </button>

        <button
          onClick={() => handlePlaceOrder('SELL')}
          disabled={loading}
          className="h-8 px-4 bg-down hover:brightness-110 text-white font-bold rounded flex items-center gap-1.5 transition duration-150 shadow-sm disabled:opacity-50 text-[11px]"
        >
          <ArrowDownRight className="w-3.5 h-3.5" />
          <span>SELL / SHORT</span>
        </button>
      </div>

      {/* Execution Controls (Lots, SL, TP) */}
      <div className="flex items-center gap-2 text-[11px] flex-shrink-0 tabular-nums">
        
        {/* Lot Size */}
        <div className="flex items-center gap-1 bg-bgElevated border border-borderHairline rounded px-2 h-8">
          <span className="text-textMuted text-[10px] font-bold">LOTS:</span>
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
            className="bg-transparent text-textMuted text-[10px] focus:outline-none cursor-pointer border-l border-borderHairline pl-1"
          >
            <option value={0.01}>0.01</option>
            <option value={0.05}>0.05</option>
            <option value={0.10}>0.10</option>
            <option value={0.50}>0.50</option>
            <option value={1.00}>1.00</option>
          </select>
        </div>

        {/* SL */}
        <div className="flex items-center gap-1 bg-bgElevated border border-borderHairline rounded px-2 h-8">
          <span className="text-down text-[10px] font-bold">SL:</span>
          <input
            type="number"
            min="2"
            max="200"
            value={slPips}
            onChange={(e) => onSlPipsChange && onSlPipsChange(Number(e.target.value))}
            className="w-9 bg-transparent text-textPrimary text-center font-mono font-bold focus:outline-none"
          />
          <span className="text-textMuted text-[9px]">pips</span>
        </div>

        {/* TP */}
        <div className="flex items-center gap-1 bg-bgElevated border border-borderHairline rounded px-2 h-8">
          <span className="text-up text-[10px] font-bold">TP:</span>
          <input
            type="number"
            min="5"
            max="500"
            value={tpPips}
            onChange={(e) => onTpPipsChange && onTpPipsChange(Number(e.target.value))}
            className="w-10 bg-transparent text-textPrimary text-center font-mono font-bold focus:outline-none"
          />
          <span className="text-textMuted text-[9px]">pips</span>
        </div>

        {/* Loading spinner */}
        {loading && (
          <div className="flex items-center gap-1.5 text-gold text-[10px] ml-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-gold" />
            <span>Transmitting Order...</span>
          </div>
        )}
      </div>
    </div>
  );
}
