'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import {
  Eye, EyeOff, Play, Pause, RotateCcw, Maximize2,
  Crosshair, TrendingUp, BarChart3,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];

export default function TradingChart({
  timeframe = '15m',
  onTimeframeChange,
  slPips = 15,
  tpPips = 45,
  status,
}) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const emaSeriesRef = useRef(null);
  const slLineRef = useRef(null);
  const tpLineRef = useRef(null);
  const bidLineRef = useRef(null);

  const [currentTick, setCurrentTick] = useState(null);
  const [tickDirection, setTickDirection] = useState(null);
  const [showEma, setShowEma] = useState(true);
  const [showRiskBands, setShowRiskBands] = useState(true);
  const [crosshairData, setCrosshairData] = useState(null);
  const prevPriceRef = useRef(null);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0D1117' },
        textColor: '#8E9AA8',
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: '#171D28' },
        horzLines: { color: '#171D28' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#3D8BFF', width: 1, style: 3, labelBackgroundColor: '#1F2430' },
        horzLine: { color: '#3D8BFF', width: 1, style: 3, labelBackgroundColor: '#1F2430' },
      },
      timeScale: { borderColor: '#232A38', timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: '#232A38', scaleMargins: { top: 0.1, bottom: 0.15 } },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#1FBF75',
      downColor: '#F0433D',
      borderUpColor: '#1FBF75',
      borderDownColor: '#F0433D',
      wickUpColor: '#1FBF75',
      wickDownColor: '#F0433D',
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });
    candleSeriesRef.current = candleSeries;

    const emaSeries = chart.addLineSeries({
      color: '#3D8BFF',
      lineWidth: 1.5,
      title: 'EMA 20',
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });
    emaSeriesRef.current = emaSeries;

    // Crosshair data
    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time) {
        setCrosshairData(null);
        return;
      }
      const candle = param.seriesData.get(candleSeries);
      const ema = param.seriesData.get(emaSeries);
      if (candle) {
        setCrosshairData({
          time: param.time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          ema: ema?.value,
        });
      }
    });

    // Resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) chart.applyOptions({ width, height });
      }
    });
    resizeObserver.observe(chartContainerRef.current);

    // Load candles
    loadCandles(timeframe);

    return () => {
      resizeObserver.disconnect();
      try { chart.remove(); } catch (e) {}
    };
  }, [timeframe]);

  const loadCandles = useCallback(async (tf) => {
    try {
      const res = await fetch(`${API_BASE}/api/chart/candles?symbol=XAUUSD&timeframe=${tf}`);
      const data = await res.json();
      if (data.candles && data.candles.length > 0 && candleSeriesRef.current) {
        const sorted = data.candles.sort((a, b) => a.time - b.time);
        candleSeriesRef.current.setData(sorted);

        // Calculate EMA 20
        if (emaSeriesRef.current && sorted.length > 20) {
          const k = 2 / 21;
          let ema = sorted[0].close;
          const emaData = sorted.map((c, i) => {
            ema = c.close * k + ema * (1 - k);
            return { time: c.time, value: Number(ema.toFixed(2)) };
          });
          emaSeriesRef.current.setData(emaData);
        }

        chartRef.current?.timeScale().fitContent();
      }
    } catch (e) {
      console.error('Failed to load candles:', e);
    }
  }, []);

  // Live tick polling
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.goldPrice) {
            const price = Number(data.goldPrice);
            if (prevPriceRef.current !== null) {
              setTickDirection(price > prevPriceRef.current ? 'up' : price < prevPriceRef.current ? 'down' : null);
            }
            prevPriceRef.current = price;
            setCurrentTick({ bid: price - 0.15, ask: price + 0.15, last: price });

            // Update last candle
            if (candleSeriesRef.current) {
              const last = candleSeriesRef.current.data?.[candleSeriesRef.current.data.length - 1];
              if (last) {
                candleSeriesRef.current.update({
                  ...last,
                  close: price,
                  high: Math.max(last.high, price),
                  low: Math.min(last.low, price),
                });
              }
            }
          }
        }
      } catch (e) {}
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, []);

  // Risk bands (SL/TP)
  useEffect(() => {
    if (!candleSeriesRef.current || !currentTick || !showRiskBands) return;

    const price = currentTick.last;
    const tp = Number((price + tpPips / 10).toFixed(2));
    const sl = Number((price - slPips / 10).toFixed(2));

    if (tpLineRef.current) candleSeriesRef.current.removePriceLine(tpLineRef.current);
    if (slLineRef.current) candleSeriesRef.current.removePriceLine(slLineRef.current);

    tpLineRef.current = candleSeriesRef.current.createPriceLine({
      price: tp, color: '#1FBF75', lineWidth: 1, lineStyle: 2,
      axisLabelVisible: true, title: `TP (+${tpPips}p)`,
    });
    slLineRef.current = candleSeriesRef.current.createPriceLine({
      price: sl, color: '#F0433D', lineWidth: 1, lineStyle: 2,
      axisLabelVisible: true, title: `SL (-${slPips}p)`,
    });

    return () => {
      if (candleSeriesRef.current) {
        if (tpLineRef.current) candleSeriesRef.current.removePriceLine(tpLineRef.current);
        if (slLineRef.current) candleSeriesRef.current.removePriceLine(slLineRef.current);
      }
    };
  }, [currentTick, slPips, tpPips, showRiskBands]);

  return (
    <div className="flex flex-col h-full w-full bg-bgPanel border-b border-borderHairline relative overflow-hidden">

      {/* Chart Toolbar */}
      <div className="h-8 px-3 bg-[#0D1016] border-b border-borderHairline flex items-center justify-between font-mono text-[11px] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-gold font-bold mr-2">XAUUSD</span>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                timeframe === tf
                  ? 'bg-gold text-black'
                  : 'text-textMuted hover:text-textPrimary hover:bg-bgPanelAlt'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEma(!showEma)}
            className={`px-2 py-0.5 rounded text-[10px] border transition ${
              showEma ? 'border-accent/40 bg-accent/15 text-accent' : 'border-white/10 text-textMuted'
            }`}
          >
            EMA 20
          </button>
          <button
            onClick={() => setShowRiskBands(!showRiskBands)}
            className={`px-2 py-0.5 rounded text-[10px] border transition ${
              showRiskBands ? 'border-gold/40 bg-gold/15 text-gold' : 'border-white/10 text-textMuted'
            }`}
          >
            Risk Bands
          </button>
          <button
            onClick={() => loadCandles(timeframe)}
            className="px-2 py-0.5 rounded text-[10px] border border-white/10 text-textMuted hover:text-textPrimary"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Live Price Strip */}
      <div className="h-6 px-3 bg-[#0A0D14] border-b border-borderHairline flex items-center gap-4 font-mono text-[11px] flex-shrink-0">
        {currentTick && (
          <>
            <span className={`font-bold text-sm ${
              tickDirection === 'up' ? 'text-up flash-up' :
              tickDirection === 'down' ? 'text-down flash-down' :
              'text-textPrimary'
            }`}>
              ${currentTick.last?.toFixed(2)}
            </span>
            <span className="text-textMuted text-[10px]">
              BID: <span className="text-rose-400 font-semibold">{currentTick.bid?.toFixed(2)}</span>
            </span>
            <span className="text-textMuted text-[10px]">
              ASK: <span className="text-emerald-400 font-semibold">{currentTick.ask?.toFixed(2)}</span>
            </span>
            <span className="text-[10px] text-accent">
              SPD: {((currentTick.ask - currentTick.bid) * 10).toFixed(1)}p
            </span>
          </>
        )}

        {/* Crosshair OHLC */}
        {crosshairData && (
          <div className="ml-auto flex items-center gap-3 text-[10px] text-textMuted">
            <span>O: <b className="text-textPrimary">{crosshairData.open?.toFixed(2)}</b></span>
            <span>H: <b className="text-up">{crosshairData.high?.toFixed(2)}</b></span>
            <span>L: <b className="text-down">{crosshairData.low?.toFixed(2)}</b></span>
            <span>C: <b className="text-textPrimary">{crosshairData.close?.toFixed(2)}</b></span>
            {crosshairData.ema && <span>EMA: <b className="text-accent">{crosshairData.ema?.toFixed(2)}</b></span>}
          </div>
        )}
      </div>

      {/* Chart Canvas */}
      <div ref={chartContainerRef} className="flex-1 w-full min-h-[200px]" />
    </div>
  );
}
