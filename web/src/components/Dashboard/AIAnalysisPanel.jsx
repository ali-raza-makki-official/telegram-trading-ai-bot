'use client';

import React from 'react';
import { Brain, RefreshCw, Zap, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function AIAnalysisPanel({ analysis, loading, onRefresh }) {
  return (
    <div className="h-full flex flex-col bg-bgPanel font-mono text-[11px] overflow-hidden">
      {/* Header */}
      <div className="panel-header flex-shrink-0">
        <div className="flex items-center gap-2">
          <Brain className="w-3 h-3 text-gold" />
          <span>AI Confluence Synthesis</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1 text-gold hover:text-white transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Analyzing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading && !analysis && (
          <div className="flex items-center justify-center h-full text-textMuted">
            <div className="text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-gold mx-auto mb-2" />
              <span className="text-[10px]">Running 7-TF Deep Scan...</span>
            </div>
          </div>
        )}

        {!loading && !analysis && (
          <div className="flex items-center justify-center h-full text-textMuted">
            <div className="text-center">
              <Brain className="w-6 h-6 text-textMuted mx-auto mb-2" />
              <span className="text-[10px]">Click ANALYZE to run AI synthesis</span>
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
                  {analysis.caution_flags.join(' | ')}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
