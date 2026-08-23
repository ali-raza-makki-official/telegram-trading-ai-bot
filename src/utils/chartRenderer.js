const { calculateEMA, calculateRSI, calculateBollingerBands } = require('../indicators');
const logger = require('./logger');

/**
 * Institutional SMC / ICT Candlestick Chart SVG Renderer
 * Renders high-resolution TradingView-style dark charts with Order Blocks, FVGs, SL/TP levels, EMA ribbon & RSI.
 */
class ChartRenderer {
  static generateSMCChartSVG({
    symbol = 'XAUUSD',
    timeframe = '15m',
    candles = [],
    setup = {},
  }) {
    const width = 1050;
    const height = 620;
    const padding = { top: 75, right: 95, bottom: 90, left: 35 };
    const chartWidth = width - padding.left - padding.right;
    const mainChartHeight = height - padding.top - padding.bottom - 45; // Leave room for RSI
    const rsiHeight = 40;
    const rsiTop = height - padding.bottom + 5;

    if (!candles || candles.length < 5) {
      return this.renderEmptyChart(width, height, 'Insufficient candle data for chart rendering');
    }

    const displayCandles = candles.slice(-40);
    const count = displayCandles.length;

    // Price range calculation
    const allHighs = displayCandles.map(c => c.high);
    const allLows = displayCandles.map(c => c.low);

    if (setup.sl) allLows.push(setup.sl);
    if (setup.tp1) allHighs.push(setup.tp1);
    if (setup.tp2) allHighs.push(setup.tp2);
    if (setup.orderBlock) {
      if (setup.orderBlock.bottom) allLows.push(setup.orderBlock.bottom);
      if (setup.orderBlock.top) allHighs.push(setup.orderBlock.top);
    }

    let minPrice = Math.min(...allLows);
    let maxPrice = Math.max(...allHighs);
    const priceRange = maxPrice - minPrice || 10;
    minPrice -= priceRange * 0.06;
    maxPrice += priceRange * 0.06;
    const finalRange = maxPrice - minPrice;

    // Coordinate mapping helpers
    const getX = (index) => padding.left + (index / (count - 1)) * chartWidth;
    const getY = (price) => padding.top + mainChartHeight - ((price - minPrice) / finalRange) * mainChartHeight;

    const candleWidth = Math.max(6, (chartWidth / count) * 0.68);
    const latestPrice = displayCandles[displayCandles.length - 1].close;

    // Compute EMAs
    const closes = displayCandles.map(c => c.close);
    const ema20 = calculateEMA(closes, Math.min(20, closes.length));
    const ema50 = calculateEMA(closes, Math.min(50, closes.length));
    const rsiValues = calculateRSI(closes, 14);

    // 1. Grid Lines & Right Price Axis
    let gridSvg = '';
    let axisSvg = '';
    const steps = 6;
    for (let s = 0; s <= steps; s++) {
      const p = minPrice + (s / steps) * finalRange;
      const gy = getY(p);
      gridSvg += `<line x1="${padding.left}" y1="${gy}" x2="${width - padding.right}" y2="${gy}" stroke="#1e293b" stroke-dasharray="3,3" stroke-width="1" />`;
      axisSvg += `<text x="${width - padding.right + 12}" y="${gy + 4}" fill="#94a3b8" font-family="'JetBrains Mono', monospace" font-size="11">$${p.toFixed(1)}</text>`;
    }

    // 2. Candlestick SVG Elements
    let candleSvg = '';
    for (let i = 0; i < count; i++) {
      const c = displayCandles[i];
      const cx = getX(i);
      const isUp = c.close >= c.open;
      const color = isUp ? '#10b981' : '#ef4444';
      const wickY1 = getY(c.high);
      const wickY2 = getY(c.low);

      const bodyTop = getY(Math.max(c.open, c.close));
      const bodyBottom = getY(Math.min(c.open, c.close));
      const bodyHeight = Math.max(2, bodyBottom - bodyTop);

      // Wick
      candleSvg += `<line x1="${cx}" y1="${wickY1}" x2="${cx}" y2="${wickY2}" stroke="${color}" stroke-width="1.5" opacity="0.9" />`;
      // Body
      candleSvg += `<rect x="${cx - candleWidth / 2}" y="${bodyTop}" width="${candleWidth}" height="${bodyHeight}" rx="1.5" fill="${color}" stroke="${color}" stroke-width="1" />`;
    }

    // 3. EMA Lines (20 Gold, 50 Sky Blue)
    let emaSvg = '';
    const renderPath = (arr, strokeColor, width = 1.8) => {
      if (!arr || arr.length < 2) return '';
      let d = '';
      for (let i = 0; i < count; i++) {
        const val = arr[i];
        if (val) {
          const ex = getX(i);
          const ey = getY(val);
          d += (d === '' ? `M ${ex} ${ey}` : ` L ${ex} ${ey}`);
        }
      }
      return d ? `<path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${width}" opacity="0.85" stroke-linecap="round" />` : '';
    };

    emaSvg += renderPath(ema20, '#f59e0b', 2.0);
    emaSvg += renderPath(ema50, '#38bdf8', 1.5);

    // 4. SMC Visual Overlays
    let smcSvg = '';

    // Order Block Box
    if (setup.orderBlock && setup.orderBlock.top && setup.orderBlock.bottom) {
      const obTop = getY(setup.orderBlock.top);
      const obBottom = getY(setup.orderBlock.bottom);
      const obH = Math.max(8, obBottom - obTop);
      const isBull = setup.orderBlock.type === 'BULLISH' || setup.bias === 'BULLISH';
      const obColor = isBull ? '#10b981' : '#ef4444';
      const obLabel = isBull ? 'BULLISH DEMAND OB' : 'BEARISH SUPPLY OB';

      smcSvg += `
        <rect x="${padding.left + chartWidth * 0.25}" y="${obTop}" width="${chartWidth * 0.75}" height="${obH}" rx="4" fill="${obColor}" fill-opacity="0.16" stroke="${obColor}" stroke-dasharray="4,4" stroke-width="1.5" />
        <rect x="${padding.left + chartWidth * 0.25 + 8}" y="${obTop + 4}" width="165" height="20" rx="3" fill="#0f172a" fill-opacity="0.9" />
        <text x="${padding.left + chartWidth * 0.25 + 14}" y="${obTop + 18}" fill="${obColor}" font-family="'Inter', sans-serif" font-size="10" font-weight="700">📦 ${obLabel}</text>
      `;
    }

    // Stop Loss Line
    if (setup.sl) {
      const slY = getY(setup.sl);
      smcSvg += `
        <line x1="${padding.left}" y1="${slY}" x2="${width - padding.right}" y2="${slY}" stroke="#ef4444" stroke-width="2" stroke-dasharray="5,3" />
        <rect x="${width - padding.right + 6}" y="${slY - 10}" width="82" height="20" rx="4" fill="#ef4444" />
        <text x="${width - padding.right + 11}" y="${slY + 4}" fill="#ffffff" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="700">SL $${setup.sl.toFixed(1)}</text>
      `;
    }

    // Take Profit 1 & 2 Lines
    if (setup.tp1) {
      const tp1Y = getY(setup.tp1);
      smcSvg += `
        <line x1="${padding.left}" y1="${tp1Y}" x2="${width - padding.right}" y2="${tp1Y}" stroke="#10b981" stroke-width="2" stroke-dasharray="5,3" />
        <rect x="${width - padding.right + 6}" y="${tp1Y - 10}" width="82" height="20" rx="4" fill="#10b981" />
        <text x="${width - padding.right + 11}" y="${tp1Y + 4}" fill="#ffffff" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="700">TP1 $${setup.tp1.toFixed(1)}</text>
      `;
    }

    // Current Price Marker
    const curY = getY(latestPrice);
    const curColor = setup.bias === 'BULLISH' ? '#10b981' : '#f59e0b';
    smcSvg += `
      <line x1="${padding.left}" y1="${curY}" x2="${width - padding.right}" y2="${curY}" stroke="${curColor}" stroke-width="1.5" stroke-dasharray="2,2" />
      <rect x="${width - padding.right + 6}" y="${curY - 10}" width="84" height="20" rx="4" fill="#3b82f6" />
      <text x="${width - padding.right + 10}" y="${curY + 4}" fill="#ffffff" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="700">$${latestPrice.toFixed(2)}</text>
    `;

    // 5. RSI Subchart (Bottom Strip)
    let rsiSvg = '';
    const latestRsi = rsiValues && rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : 50;
    const rsiY = (val) => rsiTop + rsiHeight - (val / 100) * rsiHeight;
    
    rsiSvg += `
      <!-- RSI Container -->
      <rect x="${padding.left}" y="${rsiTop}" width="${chartWidth}" height="${rsiHeight}" fill="#0f172a" fill-opacity="0.6" stroke="#1e293b" rx="4" />
      <line x1="${padding.left}" y1="${rsiY(70)}" x2="${width - padding.right}" y2="${rsiY(70)}" stroke="#ef4444" stroke-dasharray="2,2" stroke-width="1" opacity="0.6" />
      <line x1="${padding.left}" y1="${rsiY(30)}" x2="${width - padding.right}" y2="${rsiY(30)}" stroke="#10b981" stroke-dasharray="2,2" stroke-width="1" opacity="0.6" />
      <text x="${width - padding.right + 12}" y="${rsiTop + 14}" fill="#94a3b8" font-family="'JetBrains Mono', monospace" font-size="10">RSI: ${Number(latestRsi).toFixed(1)}</text>
    `;

    if (rsiValues && rsiValues.length > 1) {
      let rsiD = '';
      for (let i = 0; i < count; i++) {
        const val = rsiValues[i];
        if (val !== undefined && !isNaN(val)) {
          const rx = getX(i);
          const ry = rsiY(val);
          rsiD += (rsiD === '' ? `M ${rx} ${ry}` : ` L ${rx} ${ry}`);
        }
      }
      if (rsiD) {
        rsiSvg += `<path d="${rsiD}" fill="none" stroke="#a855f7" stroke-width="1.6" opacity="0.9" />`;
      }
    }

    // 6. Complete SVG Output
    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="#0b0f19" rx="14" />
  
  <!-- Outer Border -->
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" fill="none" stroke="#1e293b" stroke-width="2" rx="14" />

  <!-- Top Institutional Header -->
  <g transform="translate(24, 20)">
    <!-- Symbol & Timeframe -->
    <rect x="0" y="0" width="165" height="34" rx="6" fill="#1e293b" />
    <text x="12" y="23" fill="#f59e0b" font-family="'Inter', sans-serif" font-size="15" font-weight="800">⚜️ XAU/USD (${timeframe})</text>

    <!-- Live Price Badge -->
    <rect x="175" y="0" width="135" height="34" rx="6" fill="#131b2e" stroke="#3b82f6" stroke-width="1" />
    <text x="187" y="22" fill="#38bdf8" font-family="'JetBrains Mono', monospace" font-size="14" font-weight="700">$${latestPrice.toFixed(2)}</text>

    <!-- Bias / Confidence Badge -->
    <rect x="320" y="0" width="165" height="34" rx="6" fill="${setup.bias === 'BULLISH' ? '#064e3b' : setup.bias === 'BEARISH' ? '#7f1d1d' : '#1e293b'}" />
    <text x="332" y="22" fill="${setup.bias === 'BULLISH' ? '#34d399' : setup.bias === 'BEARISH' ? '#f87171' : '#94a3b8'}" font-family="'Inter', sans-serif" font-size="13" font-weight="700">BIAS: ${setup.bias || 'NEUTRAL'} ${setup.confidence ? `(${setup.confidence}%)` : ''}</text>

    <!-- Indicator Legends -->
    <text x="500" y="22" fill="#f59e0b" font-family="'Inter', sans-serif" font-size="11" font-weight="600">● EMA 20</text>
    <text x="565" y="22" fill="#38bdf8" font-family="'Inter', sans-serif" font-size="11" font-weight="600">● EMA 50</text>
    <text x="630" y="22" fill="#a855f7" font-family="'Inter', sans-serif" font-size="11" font-weight="600">● RSI(14)</text>

    <!-- Broker / Engine Info -->
    <text x="${width - padding.right - 210}" y="22" fill="#64748b" font-family="'Inter', sans-serif" font-size="12">Exness MT5 • DeepSeek-Pro</text>
  </g>

  <!-- Grid -->
  ${gridSvg}

  <!-- SMC Overlays -->
  ${smcSvg}

  <!-- Candlesticks -->
  ${candleSvg}

  <!-- Indicator (EMA Ribbon) -->
  ${emaSvg}

  <!-- RSI Subchart -->
  ${rsiSvg}

  <!-- Right Price Axis Labels -->
  ${axisSvg}

  <!-- Footer Watermark -->
  <text x="24" y="${height - 12}" fill="#475569" font-family="'Inter', sans-serif" font-size="11">Autonomous Gold AI Trading Agent • SMC / ICT Confluence Engine</text>
</svg>
`.trim();
  }

  static renderEmptyChart(width, height, msg) {
    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="#0b0f19" rx="14" />
  <text x="${width / 2}" y="${height / 2}" fill="#94a3b8" font-family="'Inter', sans-serif" font-size="16" text-anchor="middle">${msg}</text>
</svg>
`.trim();
  }
}

module.exports = ChartRenderer;
