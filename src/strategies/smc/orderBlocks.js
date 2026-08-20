/**
 * SMC Order Blocks Detection & Mitigation Tracking
 */

function findOrderBlocks(candles, lookback = 100) {
  if (!candles || candles.length < 5) return { bullishOBs: [], bearishOBs: [], activeOBs: [] };

  const startIdx = Math.max(0, candles.length - lookback);
  const bullishOBs = [];
  const bearishOBs = [];

  for (let i = startIdx + 1; i < candles.length - 2; i++) {
    const candle0 = candles[i];     // Candidate OB candle
    const candle1 = candles[i + 1]; // Displacement candle 1
    const candle2 = candles[i + 2]; // Displacement candle 2

    const isDownCandle = candle0.close < candle0.open;
    const isUpCandle = candle0.close > candle0.open;

    // Displacement magnitude
    const body0 = Math.abs(candle0.close - candle0.open);
    const avgBody = (Math.abs(candle1.close - candle1.open) + Math.abs(candle2.close - candle2.open)) / 2;

    // 1. Bullish Order Block: Bearish candle followed by strong bullish displacement
    if (isDownCandle && candle1.close > candle1.open && avgBody > body0 * 1.5) {
      if (candle2.high > candle0.high && candle2.close > candle0.open) {
        const obHigh = Math.max(candle0.high, candle0.open);
        const obLow = candle0.low;

        // Check mitigation status across subsequent candles
        let isMitigated = false;
        let isInvalidated = false;
        let mitigationCount = 0;

        for (let j = i + 1; j < candles.length; j++) {
          const subsequent = candles[j];
          if (subsequent.low <= obHigh && subsequent.low >= obLow) {
            isMitigated = true;
            mitigationCount++;
          }
          if (subsequent.close < obLow) {
            isInvalidated = true;
            break;
          }
        }

        if (!isInvalidated) {
          bullishOBs.push({
            type: 'BULLISH_OB',
            index: i,
            timestamp: candle0.timestamp,
            top: obHigh,
            bottom: obLow,
            meanThreshold: (obHigh + obLow) / 2, // 50% equilibrium of the OB
            isMitigated,
            mitigationCount,
            ageBars: candles.length - 1 - i,
          });
        }
      }
    }

    // 2. Bearish Order Block: Bullish candle followed by strong bearish displacement
    if (isUpCandle && candle1.close < candle1.open && avgBody > body0 * 1.5) {
      if (candle2.low < candle0.low && candle2.close < candle0.open) {
        const obHigh = candle0.high;
        const obLow = Math.min(candle0.low, candle0.open);

        let isMitigated = false;
        let isInvalidated = false;
        let mitigationCount = 0;

        for (let j = i + 1; j < candles.length; j++) {
          const subsequent = candles[j];
          if (subsequent.high >= obLow && subsequent.high <= obHigh) {
            isMitigated = true;
            mitigationCount++;
          }
          if (subsequent.close > obHigh) {
            isInvalidated = true;
            break;
          }
        }

        if (!isInvalidated) {
          bearishOBs.push({
            type: 'BEARISH_OB',
            index: i,
            timestamp: candle0.timestamp,
            top: obHigh,
            bottom: obLow,
            meanThreshold: (obHigh + obLow) / 2,
            isMitigated,
            mitigationCount,
            ageBars: candles.length - 1 - i,
          });
        }
      }
    }
  }

  // Active unmitigated or freshly tested OBs
  const activeBullish = bullishOBs.filter(ob => !ob.isMitigated || ob.mitigationCount <= 1).slice(-3);
  const activeBearish = bearishOBs.filter(ob => !ob.isMitigated || ob.mitigationCount <= 1).slice(-3);

  return {
    bullishOBs: bullishOBs.slice(-6),
    bearishOBs: bearishOBs.slice(-6),
    activeBullish,
    activeBearish,
    nearestBullishOB: activeBullish[activeBullish.length - 1] || null,
    nearestBearishOB: activeBearish[activeBearish.length - 1] || null,
  };
}

module.exports = {
  findOrderBlocks,
};
