'use client';

import React from 'react';
import { Brain, RefreshCw, Zap, AlertTriangle, TrendingUp, TrendingDown, Minus, Compass, Layers, ShieldCheck, Target } from 'lucide-react';

export default function AIAnalysisPanel({ analysis, loading, onRefresh }) {
  return (
    <div className="h-full flex flex-col bg-bgPanel font-mono text-[11px] overflow-hidden">
      {/* Header */}
      <div className="panel-header flex-shrink-0">
        <div className="flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-gold" />
          <span className="font-bold">AI Confluence Synthesis</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-2 py-0.5 bg-gold/15 hover:bg-gold/30 text-gold border border-gold/30 rounded font-bold transition disabled:opacity-50 text-[10px]"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Scanning Market...' : 'Run Scan'}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading && !analysis && (
          <div className="flex items-center justify-center h-full text-textMuted">
            <div className="text-center">
              <RefreshCw className="w-7 h-7 animate-spin text-gold mx-auto mb-2" />
              <span className="text-[11px] font-bold text-white block">Running 7-TF Deep Scan...</span>
              <span className="text-[9px] text-textMuted">Evaluating SMC + ICT Killzones + Macro DXY</span>
            </div>
          </div>
        )}

        {/* Informative Preview Mockup Empty State */}
        {!loading && !analysis && (
          <div className="flex flex-col h-full justify-between p-1">
            <div className="space-y-2 opacity-50 select-none">
              <div className="flex items-center justify-between border-b border-borderHairline pb-1 text-[10px] text-textMuted uppercase">
                <span>Analysis Preview Mockup</span>
                <span>Standby</span>
              </div>

              {/* Mockup Bias & Confidence */}
              <div className="p-2 rounded bg-[#0F1420] border border-borderHairline flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-up/60" />
                  <span className="font-bold text-slate-300">BULLISH / BEARISH BIAS</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-black/40 text-textMuted">
                  85% Confidence
                </span>
              </div>

              {/* Mockup Trade Geometry */}
              <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                <div className="p-1.5 rounded bg-[#141A28] border border-down/20 text-down/70">
                  <div className="text-[8px] uppercase">SL Distance</div>
                  <div className="font-bold">$4,508.00</div>
                </div>
                <div className="p-1.5 rounded bg-[#141A28] border border-up/20 text-up/70">
                  <div className="text-[8px] uppercase">Target TP1</div>
                  <div className="font-bold">$4,535.00</div>
                </div>
                <div className="p-1.5 rounded bg-[#141A28] border border-gold/20 text-gold/70">
                  <div className="text-[8px] uppercase">Risk/Reward</div>
                  <div className="font-bold">1:2.5 RR</div>
                </div>
              </div>

              {/* Mockup Confluence Factors */}
              <div className="p-2 rounded bg-[#0D121D] border border-borderHairline text-[10px] space-y-1">
                <div className="text-textMuted uppercase font-bold text-[9px] flex items-center gap-1">
                  <Layers className="w-3 h-3 text-cyan-400" />
                  Synthesis Includes:
                </div>
                <div className="text-slate-400">• Institutional 4H/1H Trend + 15m FVGs</div>
                <div className="text-slate-400">• London/NY Killzone Liquidity Sweeps</div>
                <div className="text-slate-400">• Macro DXY & Silver SMT Correlation</div>
              </div>
            </div>

            {/* Prominent Action Call */}
            <div className="mt-2 text-center">
              <button
                onClick={onRefresh}
                className="w-full py-2 bg-gradient-to-r from-gold/20 via-gold/30 to-gold/20 hover:from-gold/40 hover:to-gold/40 text-gold border border-gold/50 rounded font-bold flex items-center justify-center gap-2 transition text-xs shadow-md"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>⚡ Run 7-TF AI Confluence Scan</span>
              </button>
            </div>
          </div>
        )}

        {analysis && (
          <div className="space-y-2">
            {/* Bias & Confidence */}
            <div className="flex items-center gap-2">
              {analysis.bias === 'BULLISH' ? (
                <TrendingUp className="w-4 h-4 text-up" />
              ) : analysis.bias === 'BEARISH' ? (
                <TrendingDown className="w-4 h-4 text-down" />
              ) : (
                <Minus className="w-4 h-4 text-gold" />
              )}
              <span className={`font-bold text-sm ${
                analysis.bias === 'BULLISH' ? 'text-up' :
                analysis.bias === 'BEARISH' ? 'text-down' : 'text-gold'
              }`}>
                {analysis.bias || 'NEUTRAL'}
              </span>
              <span className="text-textMuted">
                ({analysis.confidence || 0}% confidence)
              </span>
            </div>

            {/* Setup */}
            {analysis.primary_setup && (
              <div className="bg-[#0D1117] border border-borderHairline rounded p-2">
                <div className="text-textMuted text-[9px] uppercase mb-1">Setup</div>
                <div className="text-textPrimary text-[11px]">{analysis.primary_setup}</div>
              </div>
            )}

            {/* Trade Geometry */}
            <div className="grid grid-cols-3 gap-1.5">
              {analysis.suggested_sl && (
                <div className="bg-down/10 border border-down/25 rounded p-1.5 text-center">
                  <div className="text-down text-[9px] uppercase">SL</div>
                  <div className="text-down font-bold text-[11px]">${analysis.suggested_sl}</div>
                </div>
              )}
              {analysis.suggested_tp1 && (
                <div className="bg-up/10 border border-up/25 rounded p-1.5 text-center">
                  <div className="text-up text-[9px] uppercase">TP1</div>
                  <div className="text-up font-bold text-[11px]">${analysis.suggested_tp1}</div>
                </div>
              )}
              {analysis.suggested_tp2 && (
                <div className="bg-up/10 border border-up/25 rounded p-1.5 text-center">
                  <div className="text-up text-[9px] uppercase">TP2</div>
                  <div className="text-up font-bold text-[11px]">${analysis.suggested_tp2}</div>
                </div>
              )}
            </div>

            {/* R:R */}
            {analysis.risk_reward_ratio && (
              <div className="flex items-center gap-2 text-[10px]">
                <Zap className="w-3 h-3 text-gold" />
                <span className="text-textMuted">Risk/Reward:</span>
                <span className="text-gold font-bold">{analysis.risk_reward_ratio}</span>
              </div>
            )}

            {/* Reasoning */}
            {analysis.reasoning && (
              <div className="bg-[#0D1117] border border-borderHairline rounded p-2">
                <div className="text-textMuted text-[9px] uppercase mb-1">Reasoning</div>
                <div className="text-textMuted text-[10px] leading-relaxed">
                  {analysis.reasoning.substring(0, 200)}{analysis.reasoning.length > 200 ? '...' : ''}
                </div>
              </div>
            )}

            {/* Caution Flags */}
            {analysis.caution_flags && analysis.caution_flags.length > 0 && (
              <div className="flex items-start gap-2 bg-warn/10 border border-warn/25 rounded p-2">
                <AlertTriangle className="w-3 h-3 text-warn mt-0.5 flex-shrink-0" />
                <div className="text-warn text-[10px]">
                  {analysis.caution_flags.join(' • ')}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
