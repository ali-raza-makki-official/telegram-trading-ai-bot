'use client';

import React from 'react';
import { Brain, RefreshCw, Zap, AlertTriangle, TrendingUp, TrendingDown, Minus, Layers, ShieldCheck, Target } from 'lucide-react';

export default function AIAnalysisPanel({ analysis, loading, onRefresh }) {
  return (
    <div className="h-full flex flex-col bg-bgPanel font-mono text-[11px] overflow-hidden select-none">
      {/* Header */}
      <div className="panel-header flex-shrink-0">
        <div className="flex items-center gap-2 font-bold text-textPrimary">
          <Brain className="w-3.5 h-3.5 text-gold" />
          <span>AI Confluence Synthesis</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-2 py-0.5 bg-gold/15 hover:bg-gold text-gold hover:text-black border border-gold/30 rounded font-bold transition duration-150 disabled:opacity-50 text-[10px]"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Scanning...' : 'Run Scan'}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading && !analysis && (
          <div className="flex items-center justify-center h-full text-textMuted">
            <div className="text-center">
              <RefreshCw className="w-7 h-7 animate-spin text-gold mx-auto mb-2" />
              <span className="text-[11px] font-bold text-textPrimary block">Executing Deep Confluence Scan...</span>
              <span className="text-[9px] text-textMuted">Evaluating SMC + ICT Killzones + Macro DXY</span>
            </div>
          </div>
        )}

        {/* Informative Preview Mockup Empty State */}
        {!loading && !analysis && (
          <div className="flex flex-col h-full justify-between p-1">
            <div className="space-y-2 opacity-60">
              <div className="flex items-center justify-between border-b border-borderHairline pb-1 text-[10px] text-textMuted uppercase">
                <span>Analysis Standby</span>
                <span>Preview Mockup</span>
              </div>

              {/* Mockup Bias & Confidence */}
              <div className="p-2 rounded-lg bg-bgElevated border border-borderHairline flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-up" />
                  <span className="font-bold text-textPrimary">BULLISH / BEARISH BIAS</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-black/40 text-textSecondary font-bold">
                  85% Confidence
                </span>
              </div>

              {/* Mockup Trade Geometry */}
              <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] tabular-nums">
                <div className="p-1.5 rounded-lg bg-bgElevated border border-down/25 text-down">
                  <div className="text-[8px] uppercase">SL Target</div>
                  <div className="font-bold">$4,508.00</div>
                </div>
                <div className="p-1.5 rounded-lg bg-bgElevated border border-up/25 text-up">
                  <div className="text-[8px] uppercase">TP1 Target</div>
                  <div className="font-bold">$4,535.00</div>
                </div>
                <div className="p-1.5 rounded-lg bg-bgElevated border border-gold/25 text-gold">
                  <div className="text-[8px] uppercase">Risk/Reward</div>
                  <div className="font-bold">1:2.5 RR</div>
                </div>
              </div>

              {/* Mockup Confluence Factors */}
              <div className="p-2 rounded-lg bg-bgElevated border border-borderHairline text-[10px] space-y-1">
                <div className="text-textMuted uppercase font-bold text-[9px] flex items-center gap-1">
                  <Layers className="w-3 h-3 text-accent" />
                  Synthesis Breakdown:
                </div>
                <div className="text-textSecondary">• Institutional 4H/1H Trend + 15m FVGs</div>
                <div className="text-textSecondary">• London/NY Killzone Liquidity Sweeps</div>
                <div className="text-textSecondary">• Macro DXY & Silver SMT Correlation</div>
              </div>
            </div>

            {/* Action Trigger */}
            <div className="mt-2 text-center">
              <button
                onClick={onRefresh}
                className="w-full py-2 bg-gold/15 hover:bg-gold text-gold hover:text-black border border-gold/40 rounded-lg font-bold flex items-center justify-center gap-2 transition duration-150 text-xs shadow-sm"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Run 7-Timeframe AI Confluence Scan</span>
              </button>
            </div>
          </div>
        )}

        {/* Live Analysis Output */}
        {analysis && (
          <div className="space-y-2.5">
            {/* Bias & Confidence */}
            <div className="flex items-center justify-between bg-bgElevated p-2 rounded-lg border border-borderHairline">
              <div className="flex items-center gap-2">
                {analysis.bias === 'BULLISH' ? (
                  <TrendingUp className="w-4 h-4 text-up" />
                ) : analysis.bias === 'BEARISH' ? (
                  <TrendingDown className="w-4 h-4 text-down" />
                ) : (
                  <Minus className="w-4 h-4 text-gold" />
                )}
                <span className={`font-bold text-xs ${
                  analysis.bias === 'BULLISH' ? 'text-up' :
                  analysis.bias === 'BEARISH' ? 'text-down' : 'text-gold'
                }`}>
                  {analysis.bias || 'NEUTRAL'} BIAS
                </span>
              </div>
              <span className="text-[10px] text-textSecondary font-bold">
                {analysis.confidence || 0}% Confidence
              </span>
            </div>

            {/* Setup */}
            {analysis.primary_setup && (
              <div className="bg-bgElevated border border-borderHairline rounded-lg p-2">
                <div className="text-textMuted text-[9px] uppercase mb-0.5">Identified Setup</div>
                <div className="text-textPrimary text-[11px] font-semibold">{analysis.primary_setup}</div>
              </div>
            )}

            {/* Trade Geometry */}
            <div className="grid grid-cols-3 gap-1.5 tabular-nums">
              {analysis.suggested_sl && (
                <div className="bg-down/10 border border-down/30 rounded-lg p-1.5 text-center">
                  <div className="text-down text-[8px] uppercase">SL</div>
                  <div className="text-down font-bold text-[11px]">${analysis.suggested_sl}</div>
                </div>
              )}
              {analysis.suggested_tp1 && (
                <div className="bg-up/10 border border-up/30 rounded-lg p-1.5 text-center">
                  <div className="text-up text-[8px] uppercase">TP1</div>
                  <div className="text-up font-bold text-[11px]">${analysis.suggested_tp1}</div>
                </div>
              )}
              {analysis.suggested_tp2 && (
                <div className="bg-up/10 border border-up/30 rounded-lg p-1.5 text-center">
                  <div className="text-up text-[8px] uppercase">TP2</div>
                  <div className="text-up font-bold text-[11px]">${analysis.suggested_tp2}</div>
                </div>
              )}
            </div>

            {/* Risk/Reward */}
            {analysis.risk_reward_ratio && (
              <div className="flex items-center justify-between text-[10px] bg-bgElevated p-1.5 rounded border border-borderHairline">
                <span className="text-textMuted flex items-center gap-1">
                  <Target className="w-3 h-3 text-gold" /> Expected R:R:
                </span>
                <span className="text-gold font-bold">{analysis.risk_reward_ratio}</span>
              </div>
            )}

            {/* Reasoning */}
            {analysis.reasoning && (
              <div className="bg-bgElevated border border-borderHairline rounded-lg p-2">
                <div className="text-textMuted text-[9px] uppercase mb-0.5">Synthesis Reasoning</div>
                <div className="text-textSecondary text-[10px] leading-relaxed">
                  {analysis.reasoning.substring(0, 220)}{analysis.reasoning.length > 220 ? '...' : ''}
                </div>
              </div>
            )}

            {/* Caution Flags */}
            {analysis.caution_flags && analysis.caution_flags.length > 0 && (
              <div className="flex items-start gap-2 bg-warn/10 border border-warn/30 rounded-lg p-2">
                <AlertTriangle className="w-3.5 h-3.5 text-warn mt-0.5 flex-shrink-0" />
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
