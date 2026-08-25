'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import {
  Eye, EyeOff, Play, Pause, RotateCcw, Maximize2,
  Crosshair, TrendingUp, TrendingDown, BarChart3, Activity,
  Sliders, Layers
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

  const [currentTick, setCurrentTick] = useState(null);
  const [tickDirection, setTickDirection] = useState(null);
  const [showEma, setShowEma] = useState(true);
  const [showRiskBands, setShowRiskBands] = useState(true);
  const [crosshairData, setCrosshairData] = useState(null);
  const prevPriceRef = useRef(null);

  // Initialize TradingView Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0e14' },
        textColor: '#848e9c',
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: 'rgba(41, 182, 246, 0.5)', width: 1, style: 3, labelBackgroundColor: '#161d27' },
        horzLine: { color: 'rgba(41, 182, 246, 0.5)', width: 1, style: 3, labelBackgroundColor: '#161d27' },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        scaleMargins: { top: 0.1, bottom: 0.15 },
        alignLabels: true,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });
    chartRef.current = chart;

    // TradingView authentic Green/Red Candlestick styling
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#089981',
      downColor: '#f23645',
      borderUpColor: '#089981',
      borderDownColor: '#f23645',
      wickUpColor: '#089981',
      wickDownColor: '#f23645',
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });
    candleSeriesRef.current = candleSeries;

    // EMA Series
    const emaSeries = chart.addLineSeries({
      color: '#29b6f6',
      lineWidth: 1.5,
      title: 'EMA 20',
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });
    emaSeriesRef.current = emaSeries;

    // Crosshair inspection
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

    // Responsive Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) chart.applyOptions({ width, height });
      }
    });
    resizeObserver.observe(chartContainerRef.current);

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
          const emaData = sorted.map((c) => {
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

  // Real-time Tick Stream with Directional Flash
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.goldPrice) {
            const price = Number(data.goldPrice);
            if (prevPriceRef.current !== null && price !== prevPriceRef.current) {
              setTickDirection(price > prevPriceRef.current ? 'up' : 'down');
            }
            prevPriceRef.current = price;
            setCurrentTick({ bid: price - 0.15, ask: price + 0.15, last: price });

            // Update last candle real-time
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
      price: tp,
      color: '#089981',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: `TP (+${tpPips}p)`,
    });
    slLineRef.current = candleSeriesRef.current.createPriceLine({
      price: sl,
      color: '#f23645',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: `SL (-${slPips}p)`,
    });

    return () => {
      if (candleSeriesRef.current) {
        if (tpLineRef.current) candleSeriesRef.current.removePriceLine(tpLineRef.current);
        if (slLineRef.current) candleSeriesRef.current.removePriceLine(slLineRef.current);
      }
    };
  }, [currentTick, slPips, tpPips, showRiskBands]);

  return (
    <div className="flex flex-col h-full w-full bg-bgBase border-b border-borderHairline relative overflow-hidden">

      {/* Chart Toolbar */}
      <div className="h-[34px] px-3 bg-bgPanel border-b border-borderHairline flex items-center justify-between font-mono text-[11px] flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-gold font-bold text-xs tracking-wider mr-2">XAU/USD</span>
          
          <div className="flex items-center bg-bgBase rounded p-0.5 border border-borderHairline">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => onTimeframeChange(tf)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition duration-150 ${
                  timeframe === tf
                    ? 'bg-gold text-black shadow-sm'
                    : 'text-textMuted hover:text-textPrimary hover:bg-bgElevated'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowEma(!showEma)}
            className={`px-2 py-0.5 rounded text-[10px] border transition duration-150 flex items-center gap-1 ${
              showEma
                ? 'border-accent/40 bg-accent/15 text-accent font-bold'
                : 'border-borderHairline text-textMuted hover:text-textPrimary'
            }`}
          >
            <span>EMA 20</span>
          </button>
          
          <button
            onClick={() => setShowRiskBands(!showRiskBands)}
            className={`px-2 py-0.5 rounded text-[10px] border transition duration-150 flex items-center gap-1 ${
              showRiskBands
                ? 'border-gold/40 bg-gold/15 text-gold font-bold'
                : 'border-borderHairline text-textMuted hover:text-textPrimary'
            }`}
          >
            <span>SL/TP Bands</span>
          </button>

          <button
            onClick={() => loadCandles(timeframe)}
            className="p-1 rounded border border-borderHairline text-textMuted hover:text-textPrimary hover:bg-bgElevated transition"
            title="Refresh Candles"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Real-time Ticker Ribbon with Directional Flashing */}
      <div className="h-[28px] px-3 bg-bgElevated border-b border-borderHairline flex items-center gap-4 font-mono text-[11px] flex-shrink-0 tabular-nums">
        {currentTick && (
          <>
            <div className={`px-1.5 py-0.5 rounded font-bold text-xs flex items-center gap-1 transition-colors duration-200 ${
              tickDirection === 'up' ? 'flash-up text-up' :
              tickDirection === 'down' ? 'flash-down text-down' :
              'text-textPrimary'
            }`}>
              {tickDirection === 'up' && <TrendingUp className="w-3.5 h-3.5 text-up" />}
              {tickDirection === 'down' && <TrendingDown className="w-3.5 h-3.5 text-down" />}
              <span>${currentTick.last?.toFixed(2)}</span>
            </div>

            <span className="text-textMuted text-[10px]">
              BID: <span className="text-down font-bold">${currentTick.bid?.toFixed(2)}</span>
            </span>
            <span className="text-textMuted text-[10px]">
              ASK: <span className="text-up font-bold">${currentTick.ask?.toFixed(2)}</span>
            </span>
            <span className="text-[10px] text-accent font-semibold">
              SPREAD: {((currentTick.ask - currentTick.bid) * 10).toFixed(1)}p
            </span>
          </>
        )}

        {/* Real-Time Crosshair OHLC Inspector */}
        {crosshairData && (
          <div className="ml-auto flex items-center gap-3 text-[10px] text-textMuted tabular-nums">
            <span>O: <b className="text-textPrimary">${crosshairData.open?.toFixed(2)}</b></span>
            <span>H: <b className="text-up">${crosshairData.high?.toFixed(2)}</b></span>
            <span>L: <b className="text-down">${crosshairData.low?.toFixed(2)}</b></span>
            <span>C: <b className="text-textPrimary">${crosshairData.close?.toFixed(2)}</b></span>
            {crosshairData.ema && <span>EMA: <b className="text-accent">${crosshairData.ema?.toFixed(2)}</b></span>}
          </div>
        )}
      </div>

      {/* Chart Canvas */}
      <div ref={chartContainerRef} className="flex-1 w-full min-h-[220px]" />
    </div>
  );
}
