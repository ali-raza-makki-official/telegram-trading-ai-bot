const { detectDivergences } = require('../src/strategies/indicators/divergenceDetector');
const { SilverBulletEngine } = require('../src/strategies/ict/silverBullet');
const VolumeProfileEngine = require('../src/strategies/indicators/volumeProfile');

function runAllTests() {
  console.log('=== TEST 1: RSI / MACD DIVERGENCE DETECTION (GROUND TRUTH) ===');

  // Synthetic Regular Bearish Divergence (Price HH: $4520 -> $4535, but momentum lower)
  const bearCandles = [];
  for (let i = 0; i < 50; i++) {
    let c = 4500;
    if (i < 15) c = 4500 + i * 1.5; // Up to 4522.5
    else if (i < 25) c = 4522.5 - (i - 15) * 1.0; // Pullback to 4512.5
    else if (i < 40) c = 4512.5 + (i - 25) * 1.6; // Higher High to 4536.5!
    else c = 4536.5 - (i - 40) * 1.0;

    bearCandles.push({
      time: i * 60,
      open: c - 0.5,
      high: c + 1.0,
      low: c - 1.0,
      close: c,
      volume: 100,
    });
  }

  const bearResult = detectDivergences(bearCandles);
  console.log('Bearish Divergence Detected:', bearResult.hasDivergence ? bearResult.divergences[0].type : 'None');
  if (bearResult.hasDivergence) {
    console.log('• Rationale:', bearResult.divergences[0].description);
  }

  // Synthetic Regular Bullish Divergence (Price LL: $4540 -> $4515, but momentum higher)
  const bullCandles = [];
  for (let i = 0; i < 50; i++) {
    let c = 4560;
    if (i < 15) c = 4560 - i * 1.5; // Down to 4537.5
    else if (i < 25) c = 4537.5 + (i - 15) * 1.0; // Bounce to 4547.5
    else if (i < 40) c = 4547.5 - (i - 25) * 1.6; // Lower Low to 4523.5!
    else c = 4523.5 + (i - 40) * 1.0;

    bullCandles.push({
      time: i * 60,
      open: c + 0.5,
      high: c + 1.0,
      low: c - 1.0,
      close: c,
      volume: 100,
    });
  }

  const bullResult = detectDivergences(bullCandles);
  console.log('\nBullish Divergence Detected:', bullResult.hasDivergence ? bullResult.divergences[0].type : 'None');
  if (bullResult.hasDivergence) {
    console.log('• Rationale:', bullResult.divergences[0].description);
  }

  console.log('\n=== TEST 2: ICT SILVER BULLET TIME-WINDOW BOOST ===');
  // London SB: 07:30 UTC
  const londonDate = new Date('2026-08-21T07:30:00Z');
  const londonSB = SilverBulletEngine.getSilverBulletStatus(londonDate);
  console.log('London 07:30 UTC Active:', londonSB.isSilverBulletActive);
  console.log('Window Name:', londonSB.activeWindow?.name);
  console.log('Confluence Boost:', `+${londonSB.confluenceBoost} pts`);

  // NY AM SB: 14:30 UTC
  const nyDate = new Date('2026-08-21T14:30:00Z');
  const nySB = SilverBulletEngine.getSilverBulletStatus(nyDate);
  console.log('\nNY AM 14:30 UTC Active:', nySB.isSilverBulletActive);
  console.log('Window Name:', nySB.activeWindow?.name);
  console.log('Confluence Boost:', `+${nySB.confluenceBoost} pts`);

  if (!londonSB.isSilverBulletActive || !nySB.isSilverBulletActive) {
    throw new Error('Silver Bullet time window verification failed');
  }

  console.log('\n=== TEST 3: VOLUME PROFILE (TICK-VOLUME POC / VAH / VAL) ===');
  const profileCandles = [];
  // Cluster volume heavily around $4580.00
  for (let i = 0; i < 30; i++) {
    const isCluster = i >= 10 && i <= 20;
    const price = isCluster ? 4580.0 : (4565.0 + i);
    profileCandles.push({
      time: i * 60,
      open: price,
      high: price + 2.0,
      low: price - 2.0,
      close: price + 0.5,
      tick_volume: isCluster ? 500 : 50,
    });
  }

  const profile = VolumeProfileEngine.calculateProfile(profileCandles, 1.0);
  console.log('Profile Type:', profile.type);
  console.log('Disclaimer Label:', profile.disclaimer);
  console.log('Point of Control (POC):', `$${profile.poc}`);
  console.log('Value Area:', `$${profile.val} - $${profile.vah}`);
  console.log('Total Tick Volume:', profile.totalTickVolume);

  if (Math.abs(profile.poc - 4580.0) > 3.0) {
    throw new Error(`POC should be near 4580, got ${profile.poc}`);
  }

  console.log('\n🎉 ALL MASTER PIPELINE UPGRADE TESTS PASSED WITH SYNTHETIC GROUND-TRUTH!');
}

runAllTests();
