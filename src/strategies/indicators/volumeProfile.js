/**
 * Volume Profile Engine (Point of Control, Value Area High, Value Area Low)
 *
 * NOTE / DISCLAIMER:
 * In OTC Forex/CFD markets (including MetaTrader 5), volume represents "Tick Volume"
 * (frequency of price updates) rather than centralized exchange cleared contracts.
 * It serves as an effective statistical proxy for institutional activity zones.
 */

class VolumeProfileEngine {
  static calculateProfile(candles, binSize = 1.0) {
    if (!candles || candles.length < 10) {
      return null;
    }

    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let totalTickVolume = 0;

    for (const c of candles) {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
      totalTickVolume += (c.volume || c.tick_volume || 50);
    }

    if (minPrice >= maxPrice) return null;

    // Create histogram bins
    const bins = {};
    for (const c of candles) {
      const vol = c.volume || c.tick_volume || 50;
      const spread = Math.max(0.1, c.high - c.low);
      const startBin = Math.floor(c.low / binSize) * binSize;
      const endBin = Math.floor(c.high / binSize) * binSize;

      const numBins = Math.max(1, Math.round((endBin - startBin) / binSize) + 1);
      const volPerBin = vol / numBins;

      for (let p = startBin; p <= endBin; p += binSize) {
        const key = Number(p.toFixed(1));
        bins[key] = (bins[key] || 0) + volPerBin;
      }
    }

    // Identify Point of Control (POC)
    let pocPrice = null;
    let maxBinVol = -1;
    const sortedBins = [];

    for (const [priceStr, vol] of Object.entries(bins)) {
      const price = parseFloat(priceStr);
      sortedBins.push({ price, volume: vol });
      if (vol > maxBinVol) {
        maxBinVol = vol;
        pocPrice = price;
      }
    }

    sortedBins.sort((a, b) => b.volume - a.volume);

    // Calculate 70% Value Area
    const targetValueAreaVol = totalTickVolume * 0.70;
    let accumulatedVol = 0;
    const valueAreaPrices = [];

    for (const item of sortedBins) {
      accumulatedVol += item.volume;
      valueAreaPrices.push(item.price);
      if (accumulatedVol >= targetValueAreaVol) break;
    }

    const vah = Math.max(...valueAreaPrices);
    const val = Math.min(...valueAreaPrices);

    return {
      type: 'TICK_VOLUME_PROFILE',
      disclaimer: 'Based on MT5 broker tick-volume distribution',
      poc: Number(pocPrice.toFixed(2)),
      vah: Number(vah.toFixed(2)),
      val: Number(val.toFixed(2)),
      totalTickVolume: Math.round(totalTickVolume),
      lookbackCandles: candles.length,
    };
  }
}

module.exports = VolumeProfileEngine;
