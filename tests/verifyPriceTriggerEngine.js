const smartTrigger = require('../src/orchestrator/smartPriceTriggerEngine');
const marketFeed = require('../src/market-data/marketFeed');

async function testPriceTriggerEngine() {
  console.log('=== VERIFYING SMART PRICE ACTION WATCH ZONES & LIQUIDITY TRIGGERS ===\n');

  // Test 1: Registering Order Block and FVG Zones
  console.log('Test 1: Registering SMC Bullish Order Block [$4510 - $4515]...');
  const zone1 = smartTrigger.registerZone({
    symbol: 'XAUUSD',
    type: 'ORDER_BLOCK',
    timeframe: '15m',
    bias: 'BULLISH',
    minPrice: 4510.0,
    maxPrice: 4515.0,
    referencePrice: 4525.0,
    description: '15m Bullish Demand Order Block at previous swing low',
  });

  console.log('Registered Zone 1:', zone1);

  // Test 2: Out of Zone Price Tick (e.g. $4522.00)
  console.log('\nTest 2: Testing Out-of-Zone price tick ($4522.00)...');
  const triggered1 = smartTrigger.evaluatePriceTick({ symbol: 'XAUUSD', currentPrice: 4522.0 });
  console.log('Triggered count:', triggered1.length);
  if (triggered1.length === 0) {
    console.log('✅ Test 2 PASS: Out-of-zone price does not trigger (0 tokens spent)!');
  } else {
    throw new Error('Test 2 FAILED: Triggered prematurely');
  }

  // Test 3: In Zone Price Tick (e.g. $4512.50)
  console.log('\nTest 3: Testing In-Zone price entry ($4512.50)...');
  const triggered2 = smartTrigger.evaluatePriceTick({ symbol: 'XAUUSD', currentPrice: 4512.5 });
  console.log('Triggered zones:', triggered2);
  if (triggered2.length === 1 && triggered2[0].id === zone1.id) {
    console.log('✅ Test 3 PASS: Price entering Order Block accurately fired instant trigger!');
  } else {
    throw new Error('Test 3 FAILED: Did not trigger zone');
  }

  // Test 4: Duplicate / Cooldown Prevention on same price
  console.log('\nTest 4: Testing Cooldown prevention on consecutive tick ($4513.00)...');
  const triggered3 = smartTrigger.evaluatePriceTick({ symbol: 'XAUUSD', currentPrice: 4513.0 });
  if (triggered3.length === 0) {
    console.log('✅ Test 4 PASS: Duplicate re-triggering prevented by cooldown/status guard!');
  } else {
    throw new Error('Test 4 FAILED: Repeated trigger fired without cooldown');
  }

  // Clean up
  smartTrigger.clearZone(zone1.id);
  console.log('\n🎉 ALL SMART PRICE TRIGGER ZONE & LIQUIDITY TESTS PASSED!');
}

testPriceTriggerEngine().catch(err => {
  console.error('❌ Price trigger engine test failed:', err);
  process.exit(1);
});
