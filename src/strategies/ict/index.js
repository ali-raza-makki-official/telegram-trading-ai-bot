const { getCurrentSessionInfo } = require('./killzones');
const { detectJudasSwing } = require('./judasSwing');
const { analyzePowerOfThree } = require('./powerOfThree');
const { detectSilverBullet } = require('./silverBullet');
const { detectTurtleSoup } = require('./turtleSoup');

/**
 * Master ICT Strategy Suite Analyzer
 */
function analyzeICT(candles, { fvgData = null, structureData = null, timestamp = Date.now() } = {}) {
  const sessionInfo = getCurrentSessionInfo(timestamp);
  const judasSwing = detectJudasSwing(candles, sessionInfo);
  const powerOfThree = analyzePowerOfThree(candles, sessionInfo);
  const silverBullet = detectSilverBullet(candles, fvgData, structureData, sessionInfo);
  const turtleSoup = detectTurtleSoup(candles);

  let ictScore = 0;
  const confluenceReasons = [];

  // Killzone presence bonus
  if (sessionInfo.isKillzoneActive) {
    confluenceReasons.push(`Active Killzone: ${sessionInfo.activeWindows.map(w => w.name).join(', ')}`);
  }

  // Silver Bullet Setup (+/- 35 pts)
  if (silverBullet) {
    if (silverBullet.bias === 'BULLISH') {
      ictScore += 35;
      confluenceReasons.push(`Bullish Silver Bullet active (${silverBullet.windowName})`);
    } else {
      ictScore -= 35;
      confluenceReasons.push(`Bearish Silver Bullet active (${silverBullet.windowName})`);
    }
  }

  // Judas Swing Setup (+/- 30 pts)
  if (judasSwing) {
    if (judasSwing.bias === 'BULLISH') {
      ictScore += 30;
      confluenceReasons.push(judasSwing.description);
    } else {
      ictScore -= 30;
      confluenceReasons.push(judasSwing.description);
    }
  }

  // Turtle Soup Setup (+/- 25 pts)
  if (turtleSoup) {
    if (turtleSoup.bias === 'BULLISH') {
      ictScore += 25;
      confluenceReasons.push(turtleSoup.description);
    } else {
      ictScore -= 25;
      confluenceReasons.push(turtleSoup.description);
    }
  }

  // Power of Three (AMD) (+/- 20 pts)
  if (powerOfThree && powerOfThree.bias !== 'NEUTRAL') {
    if (powerOfThree.bias === 'BULLISH') {
      ictScore += 20;
      confluenceReasons.push('ICT Power of Three (AMD): Distribution phase expanding bullish');
    } else {
      ictScore -= 20;
      confluenceReasons.push('ICT Power of Three (AMD): Distribution phase expanding bearish');
    }
  }

  ictScore = Math.max(-100, Math.min(100, ictScore));

  let bias = 'NEUTRAL';
  if (ictScore >= 25) bias = 'BULLISH';
  else if (ictScore <= -25) bias = 'BEARISH';

  return {
    bias,
    score: ictScore,
    sessionInfo,
    judasSwing,
    powerOfThree,
    silverBullet,
    turtleSoup,
    confluenceReasons,
  };
}

module.exports = {
  getCurrentSessionInfo,
  detectJudasSwing,
  analyzePowerOfThree,
  detectSilverBullet,
  detectTurtleSoup,
  analyzeICT,
};
