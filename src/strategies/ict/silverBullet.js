/**
 * ICT Silver Bullet Time-Window & Algorithmic Delivery Engine
 *
 * Silver Bullet 60-Minute Windows (in NY Time / UTC):
 * 1. London Silver Bullet: 03:00 - 04:00 AM NY (07:00 - 08:00 UTC)
 * 2. NY AM Silver Bullet:  10:00 - 11:00 AM NY (14:00 - 15:00 UTC)
 * 3. NY PM Silver Bullet:  02:00 - 03:00 PM NY (18:00 - 19:00 UTC)
 */

class SilverBulletEngine {
  static getSilverBulletStatus(customDate = null) {
    const now = customDate || new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const currentUtcTime = `${String(utcHour).padStart(2, '0')}:${String(utcMinute).padStart(2, '0')}`;

    let activeWindow = null;
    let confluenceBoost = 0;

    // London Silver Bullet: 07:00 - 08:00 UTC
    if (utcHour === 7) {
      activeWindow = {
        name: 'London Silver Bullet',
        nyTime: '03:00 - 04:00 AM NY',
        utcTime: '07:00 - 08:00 UTC',
        targetPips: 20,
        description: 'London institutional expansion window. High probability FVG sweeps.',
      };
      confluenceBoost = 15.0;
    }
    // NY AM Silver Bullet: 14:00 - 15:00 UTC
    else if (utcHour === 14) {
      activeWindow = {
        name: 'NY AM Silver Bullet',
        nyTime: '10:00 - 11:00 AM NY',
        utcTime: '14:00 - 15:00 UTC',
        targetPips: 25,
        description: 'New York prime institutional delivery window. Highest liquidity algorithmic runs.',
      };
      confluenceBoost = 20.0;
    }
    // NY PM Silver Bullet: 18:00 - 19:00 UTC
    else if (utcHour === 18) {
      activeWindow = {
        name: 'NY PM Silver Bullet',
        nyTime: '02:00 - 03:00 PM NY',
        utcTime: '18:00 - 19:00 UTC',
        targetPips: 15,
        description: 'Late New York session liquidity sweep & algorithmic rebalancing window.',
      };
      confluenceBoost = 15.0;
    }

    return {
      isSilverBulletActive: Boolean(activeWindow),
      activeWindow,
      confluenceBoost,
      currentUtcTime,
    };
  }
}

function detectSilverBullet(candles, fvgData = null, structureData = null, sessionInfo = null) {
  const status = SilverBulletEngine.getSilverBulletStatus();
  if (!status.isSilverBulletActive) return null;

  let bias = 'NEUTRAL';
  let description = `${status.activeWindow.name} Active (${status.activeWindow.nyTime})`;

  if (fvgData?.bullishFVGs?.length > 0) {
    bias = 'BULLISH';
    description += ` - Bullish FVG setup detected in delivery window.`;
  } else if (fvgData?.bearishFVGs?.length > 0) {
    bias = 'BEARISH';
    description += ` - Bearish FVG setup detected in delivery window.`;
  }

  return {
    isTriggered: true,
    bias,
    windowName: status.activeWindow.name,
    nyTime: status.activeWindow.nyTime,
    confluenceBoost: status.confluenceBoost,
    description,
  };
}

module.exports = {
  SilverBulletEngine,
  detectSilverBullet,
  getSilverBulletStatus: SilverBulletEngine.getSilverBulletStatus,
};
