const { analyzeMarketStructure } = require('./marketStructure');
const { findOrderBlocks } = require('./orderBlocks');
const { findFairValueGaps } = require('./fairValueGaps');
const { findLiquidityPools } = require('./liquidity');
const { calculatePremiumDiscountZones } = require('./premiumDiscount');

/**
 * SMC Master Analyzer
 */
function analyzeSMC(candles) {
  if (!candles || candles.length < 15) {
    return {
      bias: 'NEUTRAL',
      score: 0,
      structure: null,
      orderBlocks: null,
      fvg: null,
      liquidity: null,
      premiumDiscount: null,
      summary: 'Insufficient data for SMC analysis',
    };
  }

  const structure = analyzeMarketStructure(candles);
  const orderBlocks = findOrderBlocks(candles);
  const fvg = findFairValueGaps(candles);
  const liquidity = findLiquidityPools(candles, structure);

  const lastCandle = candles[candles.length - 1];
  const currentPrice = lastCandle.close;

  const isUptrend = structure.trend === 'BULLISH';
  const lastSwingHighPrice = structure.lastSwingHigh ? structure.lastSwingHigh.price : Math.max(...candles.slice(-20).map(c => c.high));
  const lastSwingLowPrice = structure.lastSwingLow ? structure.lastSwingLow.price : Math.min(...candles.slice(-20).map(c => c.low));

  const premiumDiscount = calculatePremiumDiscountZones(currentPrice, lastSwingHighPrice, lastSwingLowPrice, isUptrend);

  // Compute SMC Signal Score [-100 to +100]
  let smcScore = 0;
  const confluenceReasons = [];

  // 1. Structure Trend (+/- 30 pts)
  if (structure.trend === 'BULLISH') {
    smcScore += 25;
    confluenceReasons.push('Bullish Market Structure');
  } else if (structure.trend === 'BEARISH') {
    smcScore -= 25;
    confluenceReasons.push('Bearish Market Structure');
  }

  // 2. Recent CHoCH / BOS (+/- 20 pts)
  if (structure.recentCHoCH) {
    if (structure.recentCHoCH.type === 'CHOCH_BULLISH') {
      smcScore += 20;
      confluenceReasons.push('Fresh Bullish Change of Character (CHoCH)');
    } else if (structure.recentCHoCH.type === 'CHOCH_BEARISH') {
      smcScore -= 20;
      confluenceReasons.push('Fresh Bearish Change of Character (CHoCH)');
    }
  } else if (structure.recentBOS) {
    if (structure.recentBOS.type === 'BOS_BULLISH') {
      smcScore += 15;
      confluenceReasons.push('Bullish Break of Structure (BOS)');
    } else if (structure.recentBOS.type === 'BOS_BEARISH') {
      smcScore -= 15;
      confluenceReasons.push('Bearish Break of Structure (BOS)');
    }
  }

  // 3. Order Block Reaction (+/- 25 pts)
  if (orderBlocks.nearestBullishOB) {
    const ob = orderBlocks.nearestBullishOB;
    if (currentPrice >= ob.bottom && currentPrice <= ob.top * 1.002) {
      smcScore += 25;
      confluenceReasons.push(`Price inside Bullish Order Block (${ob.bottom.toFixed(2)} - ${ob.top.toFixed(2)})`);
    }
  }
  if (orderBlocks.nearestBearishOB) {
    const ob = orderBlocks.nearestBearishOB;
    if (currentPrice <= ob.top && currentPrice >= ob.bottom * 0.998) {
      smcScore -= 25;
      confluenceReasons.push(`Price inside Bearish Order Block (${ob.bottom.toFixed(2)} - ${ob.top.toFixed(2)})`);
    }
  }

  // 4. Fair Value Gap Reaction (+/- 15 pts)
  if (fvg.nearestBullishFVG && currentPrice >= fvg.nearestBullishFVG.bottom && currentPrice <= fvg.nearestBullishFVG.top) {
    smcScore += 15;
    confluenceReasons.push(`Price tapping Bullish FVG (${fvg.nearestBullishFVG.bottom.toFixed(2)} - ${fvg.nearestBullishFVG.top.toFixed(2)})`);
  }
  if (fvg.nearestBearishFVG && currentPrice <= fvg.nearestBearishFVG.top && currentPrice >= fvg.nearestBearishFVG.bottom) {
    smcScore -= 15;
    confluenceReasons.push(`Price tapping Bearish FVG (${fvg.nearestBearishFVG.bottom.toFixed(2)} - ${fvg.nearestBearishFVG.top.toFixed(2)})`);
  }

  // 5. Liquidity Sweeps (+/- 20 pts)
  if (liquidity.latestSweep) {
    if (liquidity.latestSweep.type === 'BULLISH_SWEEP') {
      smcScore += 20;
      confluenceReasons.push(`Sell-side liquidity swept at ${liquidity.latestSweep.sweptLevel.toFixed(2)} with quick rejection`);
    } else if (liquidity.latestSweep.type === 'BEARISH_SWEEP') {
      smcScore -= 20;
      confluenceReasons.push(`Buy-side liquidity swept at ${liquidity.latestSweep.sweptLevel.toFixed(2)} with quick rejection`);
    }
  }

  // 6. Premium / Discount Alignment
  if (smcScore > 0 && premiumDiscount.zone === 'DISCOUNT') {
    smcScore += 10;
    confluenceReasons.push('Bullish setup aligned with Discount pricing');
  } else if (smcScore < 0 && premiumDiscount.zone === 'PREMIUM') {
    smcScore -= 10;
    confluenceReasons.push('Bearish setup aligned with Premium pricing');
  }

  // Clamp score
  smcScore = Math.max(-100, Math.min(100, smcScore));

  let bias = 'NEUTRAL';
  if (smcScore >= 30) bias = 'BULLISH';
  else if (smcScore <= -30) bias = 'BEARISH';

  return {
    bias,
    score: smcScore,
    confluenceReasons,
    structure,
    orderBlocks,
    fvg,
    liquidity,
    premiumDiscount,
  };
}

module.exports = {
  analyzeSMC,
};
