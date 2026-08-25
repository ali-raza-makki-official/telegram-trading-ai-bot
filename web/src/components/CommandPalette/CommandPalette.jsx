'use client';

import React, { useEffect } from 'react';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, SlidersHorizontal, Zap, Clock, ShieldCheck,
  TrendingUp, TrendingDown, Play, Sparkles, Plus, RefreshCw, X
} from 'lucide-react';
import { useTradingStore } from '../../store/useTradingStore';

export default function CommandPalette({ onRunAnalysis, onQuickOrder }) {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    setActiveTab,
    setSelectedTimeframe,
  } = useTradingStore();

  useEffect(() => {
    const down = (e) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName))) {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  if (!commandPaletteOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="w-full max-w-xl bg-bgPanel border border-borderHairline rounded-xl shadow-2xl overflow-hidden font-mono text-xs text-textPrimary"
        >
          <Command label="Global Command Palette" className="w-full">
            {/* Search Input Bar */}
            <div className="flex items-center px-3.5 border-b border-borderHairline">
              <Sparkles className="w-4 h-4 text-gold mr-2.5 flex-shrink-0" />
              <Command.Input
                placeholder="Type a command or search (e.g. '15m', 'strategy', 'analyze', 'buy')..."
                className="w-full h-11 bg-transparent text-textPrimary placeholder:text-textMuted focus:outline-none text-xs"
                autoFocus
              />
              <button
                onClick={() => setCommandPaletteOpen(false)}
                className="p-1 text-textMuted hover:text-textPrimary rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Command List Results */}
            <Command.List className="max-h-80 overflow-y-auto p-2 space-y-1">
              <Command.Empty className="p-4 text-center text-textMuted text-xs">
                No matching trading commands found.
              </Command.Empty>

              {/* Navigation Group */}
              <Command.Group heading="WORKSPACES & VIEWS" className="text-[9px] uppercase font-bold text-textMuted px-2 py-1">
                <Command.Item
                  onSelect={() => {
                    setActiveTab('terminal');
                    setCommandPaletteOpen(false);
                  }}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-bgElevated text-textPrimary transition"
                >
                  <LineChart className="w-3.5 h-3.5 text-gold" />
                  <span>Switch to <b>Live Terminal View</b></span>
                </Command.Item>

                <Command.Item
                  onSelect={() => {
                    setActiveTab('strategy');
                    setCommandPaletteOpen(false);
                  }}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-bgElevated text-textPrimary transition"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-gold" />
                  <span>Switch to <b>Strategy Directives Hub</b></span>
                </Command.Item>
              </Command.Group>

              {/* Timeframe Group */}
              <Command.Group heading="TIMEFRAME SWITCHER" className="text-[9px] uppercase font-bold text-textMuted px-2 py-1">
                {['1m', '5m', '15m', '1h', '4h', '1d'].map((tf) => (
                  <Command.Item
                    key={tf}
                    onSelect={() => {
                      setSelectedTimeframe(tf);
                      setCommandPaletteOpen(false);
                    }}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-bgElevated text-textPrimary transition"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-accent" />
                      <span>Set Active Chart to <b>{tf.toUpperCase()}</b></span>
                    </div>
                    <span className="text-[9px] text-textMuted px-1.5 py-0.5 rounded bg-black/40 uppercase">Timeframe</span>
                  </Command.Item>
                ))}
              </Command.Group>

              {/* AI & Execution Actions */}
              <Command.Group heading="TRADING ACTIONS" className="text-[9px] uppercase font-bold text-textMuted px-2 py-1">
                <Command.Item
                  onSelect={() => {
                    if (onRunAnalysis) onRunAnalysis();
                    setCommandPaletteOpen(false);
                  }}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-bgElevated text-accent transition"
                >
                  <Zap className="w-3.5 h-3.5 text-accent" />
                  <span>Trigger <b>Live AI Market Synthesis Scan</b></span>
                </Command.Item>
              </Command.Group>
            </Command.List>

            {/* Footer Shortcut Hints */}
            <div className="px-3 py-2 border-t border-borderHairline bg-bgBase flex items-center justify-between text-[9px] text-textMuted">
              <span>ProTip: Press <kbd className="px-1 py-0.5 rounded bg-bgElevated text-textPrimary">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-bgElevated text-textPrimary">↓</kbd> to navigate, <kbd className="px-1 py-0.5 rounded bg-bgElevated text-textPrimary">Enter</kbd> to select</span>
              <span><kbd className="px-1 py-0.5 rounded bg-bgElevated text-textPrimary">ESC</kbd> to close</span>
            </div>
          </Command>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
