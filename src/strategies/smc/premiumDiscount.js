/**
 * SMC Premium vs. Discount Zones & ICT OTE (Optimal Trade Entry)
 */

function calculatePremiumDiscountZones(currentPrice, swingHigh, swingLow, isUptrend = true) {
  if (!swingHigh || !swingLow || swingHigh <= swingLow) {
    return {
      zone: 'NEUTRAL',
      equilibrium: currentPrice,
      rangeHigh: currentPrice,
      rangeLow: currentPrice,
      oteZone: null,
      percentInRange: 50,
    };
  }

  const range = swingHigh - swingLow;
  const equilibrium = Number(((swingHigh + swingLow) / 2).toFixed(2));
  const percentInRange = Number((((currentPrice - swingLow) / range) * 100).toFixed(1));

  let zone = 'EQUILIBRIUM';
  if (currentPrice > equilibrium) {
    zone = 'PREMIUM'; // Expensive / Favorable for SELLS
  } else if (currentPrice < equilibrium) {
    zone = 'DISCOUNT'; // Cheap / Favorable for BUYS
  }

  // Calculate OTE (Optimal Trade Entry 62% - 79% retracement)
  let oteZone = null;
  if (isUptrend) {
    // Retracement from high down into discount
    const ote62 = swingHigh - range * 0.618;
    const ote705 = swingHigh - range * 0.705;
    const ote79 = swingHigh - range * 0.786;
    const inOTE = currentPrice <= ote62 && currentPrice >= ote79;

    oteZone = {
      type: 'BULLISH_OTE',
      high: Number(ote62.toFixed(2)),
      sweetSpot: Number(ote705.toFixed(2)),
      low: Number(ote79.toFixed(2)),
      isPriceInOTE: inOTE,
    };
  } else {
    // Retracement from low up into premium
    const ote62 = swingLow + range * 0.618;
    const ote705 = swingLow + range * 0.705;
    const ote79 = swingLow + range * 0.786;
    const inOTE = currentPrice >= ote62 && currentPrice <= ote79;

    oteZone = {
      type: 'BEARISH_OTE',
      high: Number(ote79.toFixed(2)),
      sweetSpot: Number(ote705.toFixed(2)),
      low: Number(ote62.toFixed(2)),
      isPriceInOTE: inOTE,
    };
  }

  return {
    zone,
    equilibrium,
    rangeHigh: swingHigh,
    rangeLow: swingLow,
    rangeSize: Number(range.toFixed(2)),
    percentInRange,
    oteZone,
  };
}

module.exports = {
  calculatePremiumDiscountZones,
};
