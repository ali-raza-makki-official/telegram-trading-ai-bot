const config = require('../../config');
const { computeAllIndicators } = require('../../indicators');
const { analyzeSMC } = require('../smc');
const { analyzeICT } = require('../ict');
const { scanCandlestickPatterns } = require('../candlesticks');

/**
 * Confluence & Signal Scorer
 * Aggregates multi-timeframe technical, SMC, ICT, candlestick, and correlation data
 * into a single unified score [-100 to +100] and structured trade setup payload.
 */
function scoreConfluence({
  symbol = 'XAUUSD',
  candlesByTimeframe = {}, // { '1m': [...], '5m': [...], '15m': [...], '1h': [...], '4h': [...], '1d': [...] }
  correlatedData = {},     // { DXY: { change: -0.3, bias: 'BEARISH' }, XAGUSD: { change: +0.8, bias: 'BULLISH' }, US10Y: { change: -1.2 } }
  timestamp = Date.now(),
}) {
  const timeframes = Object.keys(candlesByTimeframe);
  if (timeframes.length === 0) {
    return {
      symbol,
      score: 0,
      confidence: 0,
      bias: 'NEUTRAL',
      isActionable: false,
      reasons: ['No candle data provided'],
    };
  }

  // Primary execution timeframe is 15m or 5m, Higher timeframe is 1h / 4h / 1d
  const triggerTf = candlesByTimeframe['15m'] ? '15m' : (candlesByTimeframe['5m'] ? '5m' : timeframes[0]);
  const htf = candlesByTimeframe['4h'] ? '4h' : (candlesByTimeframe['1h'] ? '1h' : (candlesByTimeframe['1d'] ? '1d' : null));

  const triggerCandles = candlesByTimeframe[triggerTf] || [];
  const htfCandles = htf ? candlesByTimeframe[htf] : [];

  // Run Sub-Engines on Trigger Timeframe
  const indicators = computeAllIndicators(triggerCandles);
  const smc = analyzeSMC(triggerCandles);
  const ict = analyzeICT(triggerCandles, { fvgData: smc.fvg, structureData: smc.structure, timestamp });
  const candlesPattern = scanCandlestickPatterns(triggerCandles);

  // Run HTF Analysis if available
  let htfBias = 'NEUTRAL';
  let htfSmc = null;
  if (htfCandles.length >= 15) {
    htfSmc = analyzeSMC(htfCandles);
    htfBias = htfSmc.bias;
  }

  // Weight components
  // 1. SMC: 30%
  // 2. ICT: 25%
  // 3. Candlesticks: 15%
  // 4. Indicators (EMA, RSI, MACD): 15%
  // 5. HTF Trend Alignment: 10%
  // 6. Correlated Pairs Confirmation: 5%

  const smcContribution = (smc.score || 0) * 0.30;
  const ictContribution = (ict.score || 0) * 0.25;
  const candleContribution = (candlesPattern.score || 0) * 0.15;

  let indicatorScore = 0;
  if (indicators.emaBias === 'BULLISH') indicatorScore += 40;
  else if (indicators.emaBias === 'BEARISH') indicatorScore -= 40;

  if (indicators.macd && indicators.macd.bias === 'BULLISH') indicatorScore += 30;
  else if (indicators.macd && indicators.macd.bias === 'BEARISH') indicatorScore -= 30;

  if (indicators.rsiCondition === 'OVERSOLD') indicatorScore += 30;
  else if (indicators.rsiCondition === 'OVERBOUGHT') indicatorScore -= 30;

  const indicatorContribution = Math.max(-100, Math.min(100, indicatorScore)) * 0.15;

  let htfContribution = 0;
  if (htfBias === 'BULLISH') htfContribution = 10;
  else if (htfBias === 'BEARISH') htfContribution = -10;

  // Correlated confirmation (Gold vs DXY is inversely correlated, Gold vs Silver is positively correlated)
  let correlationScore = 0;
  if (correlatedData.DXY) {
    if (correlatedData.DXY.bias === 'BEARISH' || correlatedData.DXY.change < -0.1) correlationScore += 50;
    else if (correlatedData.DXY.bias === 'BULLISH' || correlatedData.DXY.change > 0.1) correlationScore -= 50;
  }
  // SMT Divergence (Gold vs Silver)
  const macroEngine = require('../../market-data/macroEngine');
  const silverCandles = candlesByTimeframe['XAGUSD'] || [];
  const smt = macroEngine.detectSMTDivergence(triggerCandles, silverCandles);
  if (smt) {
    if (smt.bias === 'BULLISH') correlationScore += 40;
    else if (smt.bias === 'BEARISH') correlationScore -= 40;
  }

  const correlationContribution = Math.max(-100, Math.min(100, correlationScore)) * 0.10;

  // Total raw score [-100 to +100]
  const rawTotalScore =
    smcContribution +
    ictContribution +
    candleContribution +
    indicatorContribution +
    htfContribution +
    correlationContribution;

  const finalScore = Number(rawTotalScore.toFixed(1));
  const confidence = Math.min(100, Math.abs(finalScore));

  const MIN_CONFLUENCE_THRESHOLD = Number(config.strategy.minConfluenceScore || 70.0);

  let bias = 'NEUTRAL';
  if (finalScore >= 35 && confidence >= 50) bias = 'BULLISH';
  else if (finalScore <= -35 && confidence >= 50) bias = 'BEARISH';

  const isActionable = confidence >= MIN_CONFLUENCE_THRESHOLD && bias !== 'NEUTRAL';

  // Gather key confluence bullet points
  const keyReasons = [];
  if (smc.confluenceReasons) keyReasons.push(...smc.confluenceReasons);
  if (ict.confluenceReasons) keyReasons.push(...ict.confluenceReasons);
  if (smt) keyReasons.push(`SMT Divergence: ${smt.description}`);
  if (candlesPattern.primaryPattern) {
    keyReasons.push(`Candlestick Pattern: ${candlesPattern.primaryPattern.pattern} (${candlesPattern.primaryPattern.bias})`);
  }
  if (indicators.emaBias !== 'NEUTRAL') {
    keyReasons.push(`EMA Alignment: ${indicators.emaBias}`);
  }
  if (htfBias !== 'NEUTRAL') {
    keyReasons.push(`HTF Trend (${htf}): ${htfBias}`);
  }
  if (correlatedData.DXY) {
    keyReasons.push(`DXY Inversion: ${correlatedData.DXY.bias || (correlatedData.DXY.change < 0 ? 'BEARISH' : 'BULLISH')}`);
  }

  const currentPrice = triggerCandles.length > 0 ? triggerCandles[triggerCandles.length - 1].close : 0;
  const currentAtr = indicators.atr || 2.5;

  // Suggested SL/TP based on SMC levels + ATR buffer
  let suggestedSl = null;
  let suggestedTp1 = null;
  let suggestedTp2 = null;
  let invalidationLevel = null;

  if (bias === 'BULLISH') {
    suggestedSl = Number((smc.structure?.lastSwingLow ? Math.min(smc.structure.lastSwingLow.price, currentPrice - currentAtr * 1.5) : currentPrice - currentAtr * 1.5).toFixed(2));
    invalidationLevel = suggestedSl;
    const riskDistance = currentPrice - suggestedSl;
    suggestedTp1 = Number((currentPrice + riskDistance * 1.5).toFixed(2));
    suggestedTp2 = Number((currentPrice + riskDistance * 3.0).toFixed(2));
  } else if (bias === 'BEARISH') {
    suggestedSl = Number((smc.structure?.lastSwingHigh ? Math.max(smc.structure.lastSwingHigh.price, currentPrice + currentAtr * 1.5) : currentPrice + currentAtr * 1.5).toFixed(2));
    invalidationLevel = suggestedSl;
    const riskDistance = suggestedSl - currentPrice;
    suggestedTp1 = Number((currentPrice - riskDistance * 1.5).toFixed(2));
    suggestedTp2 = Number((currentPrice - riskDistance * 3.0).toFixed(2));
  }

  const riskRewardRatio = suggestedSl && suggestedTp1 && Math.abs(currentPrice - suggestedSl) > 0
    ? Number((Math.abs(suggestedTp1 - currentPrice) / Math.abs(currentPrice - suggestedSl)).toFixed(2))
    : 1.5;

  return {
    symbol,
    triggerTimeframe: triggerTf,
    htfTimeframe: htf,
    score: finalScore,
    confidence,
    minThreshold: MIN_CONFLUENCE_THRESHOLD,
    bias,
    isActionable,
    currentPrice,
    suggestedSl,
    suggestedTp1,
    suggestedTp2,
    invalidationLevel,
    riskRewardRatio: `${riskRewardRatio}R`,
    primarySetup: smc.primarySetup || ict.primarySetup || 'Multi-Timeframe Structure',
    reasons: keyReasons,
    keyReasons,
    timeframeDetails: {
      triggerTimeframe: triggerTf,
      higherTimeframe: htf,
      smc,
      ict,
      smt,
      indicators,
      candlesticks: candlesPattern,
    },
    breakdown: {
      smc: { score: smc.score, bias: smc.bias, details: smc },
      ict: { score: ict.score, bias: ict.bias, details: ict },
      candlesticks: { score: candlesPattern.score, bias: candlesPattern.bias, patterns: candlesPattern.patterns },
      indicators,
      htf: { timeframe: htf, bias: htfBias },
      correlated: correlatedData,
    },
  };
}

module.exports = {
  scoreConfluence,
};
