const { getCurrentSessionInfo } = require('./killzones');

/**
 * ICT Silver Bullet Model
 * Occurs during specific 60-minute windows:
 * - London: 03:00 - 04:00 UTC
 * - NY AM: 10:00 - 11:00 AM EST (14:00 - 15:00 UTC)
 * - NY PM: 02:00 - 03:00 PM EST (18:00 - 19:00 UTC)
 * Pattern requires: Liquidity sweep -> Market structure shift (MSS) -> Entry on Fair Value Gap (FVG).
 */
function detectSilverBullet(candles, fvgData, structureData, sessionInfo) {
  if (!candles || candles.length < 10) return null;

  const currentSession = sessionInfo || getCurrentSessionInfo();
  const silverBulletWindow = currentSession.activeWindows.find(w => w.key.includes('SILVER_BULLET'));

  if (!silverBulletWindow) return null;

  const currentPrice = candles[candles.length - 1].close;

  // Check if we have an active FVG in the direction of the recent MSS/CHoCH
  if (structureData && structureData.recentCHoCH) {
    if (structureData.recentCHoCH.type === 'CHOCH_BULLISH' && fvgData && fvgData.nearestBullishFVG) {
      const fvg = fvgData.nearestBullishFVG;
      if (currentPrice >= fvg.bottom && currentPrice <= fvg.top * 1.002) {
        return {
          type: 'BULLISH_SILVER_BULLET',
          windowName: silverBulletWindow.name,
          bias: 'BULLISH',
          fvgZone: { top: fvg.top, bottom: fvg.bottom },
          confidence: 85,
          suggestedSl: structureData.lastSwingLow ? structureData.lastSwingLow.price : fvg.bottom - 2.0,
          suggestedTp: (structureData.lastSwingHigh ? structureData.lastSwingHigh.price : currentPrice + 10.0),
          description: `Silver Bullet setup active in ${silverBulletWindow.name}: Bullish MSS + FVG test at ${fvg.bottom.toFixed(2)} - ${fvg.top.toFixed(2)}`,
        };
      }
    }

    if (structureData.recentCHoCH.type === 'CHOCH_BEARISH' && fvgData && fvgData.nearestBearishFVG) {
      const fvg = fvgData.nearestBearishFVG;
      if (currentPrice <= fvg.top && currentPrice >= fvg.bottom * 0.998) {
        return {
          type: 'BEARISH_SILVER_BULLET',
          windowName: silverBulletWindow.name,
          bias: 'BEARISH',
          fvgZone: { top: fvg.top, bottom: fvg.bottom },
          confidence: 85,
          suggestedSl: structureData.lastSwingHigh ? structureData.lastSwingHigh.price : fvg.top + 2.0,
          suggestedTp: (structureData.lastSwingLow ? structureData.lastSwingLow.price : currentPrice - 10.0),
          description: `Silver Bullet setup active in ${silverBulletWindow.name}: Bearish MSS + FVG test at ${fvg.bottom.toFixed(2)} - ${fvg.top.toFixed(2)}`,
        };
      }
    }
  }

  return null;
}

module.exports = {
  detectSilverBullet,
};
