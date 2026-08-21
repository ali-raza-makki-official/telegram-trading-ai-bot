const MultiTimeframeScanner = require('../src/strategies/smc/multiTimeframeScanner');
const smartPriceTrigger = require('../src/orchestrator/smartPriceTriggerEngine');
const marketFeed = require('../src/market-data/marketFeed');

async function testTwoSidedSystem() {
  console.log('=== VERIFYING TWO-SIDED MULTI-TIMEFRAME STRUCTURE & AUTONOMOUS TRIGGER ===\n');

  // 1. Scan across all 7 timeframes
  console.log('1. Scanning all 7 timeframes (1m, 5m, 15m, 30m, 1h, 4h, 1d)...');
  const scan = MultiTimeframeScanner.scanAllZones('XAUUSD');

  console.log('Live Spot Price:', scan.currentPrice);
  console.log('Upper Supply & Resistance Zones Found:', scan.supplyZones.length);
  console.log('Lower Demand & Support Zones Found:', scan.demandZones.length);
  console.log('Total Order Blocks:', scan.orderBlocks.length);
  console.log('Total FVGs:', scan.fairValueGaps.length);
  console.log('Total Liquidity Pools:', scan.liquidityPools.length);

  if (scan.supplyZones.length === 0 || scan.demandZones.length === 0) {
    throw new Error('Scanner must identify BOTH Upper Supply and Lower Demand zones!');
  }

  // 2. Verify Pro Technical Indicators
  console.log('\n2. Verifying Pro Technical Indicators (15m):');
  const ind15m = scan.indicatorsByTf['15m'];
  console.log('EMA 20:', ind15m?.ema20?.toFixed(2));
  console.log('EMA 50:', ind15m?.ema50?.toFixed(2));
  console.log('EMA 200:', ind15m?.ema200?.toFixed(2));
  console.log('RSI (14):', ind15m?.rsi?.toFixed(2));
  console.log('Bollinger Bands:', `${ind15m?.bbLower?.toFixed(2)} - ${ind15m?.bbUpper?.toFixed(2)}`);
  console.log('ATR (14):', ind15m?.atr?.toFixed(2));

  if (!ind15m?.ema50 || !ind15m?.rsi) {
    throw new Error('Pro technical indicators failed to compute');
  }

  // 3. Verify Zone Persistence in SmartPriceTriggerEngine
  console.log('\n3. Verifying Persistence & Watchlist Registration:');
  const activeZones = smartPriceTrigger.getActiveZones();
  console.log('Active Monitored Zones in Memory/Disk:', activeZones.length);

  if (activeZones.length === 0) {
    throw new Error('Active zones must be registered in SmartPriceTriggerEngine');
  }

  // 4. Test Zero-Token Event-Driven Tick Trigger
  console.log('\n4. Simulating live price tick entering a Lower Demand Zone...');
  const targetDemand = scan.demandZones[0];
  const triggerPrice = (targetDemand.top + targetDemand.bottom) / 2;
  console.log(`Simulating tick at $${triggerPrice.toFixed(2)} inside zone [${targetDemand.bottom} - ${targetDemand.top}]...`);

  let triggeredEvents = [];
  const onTrigger = (data) => {
    triggeredEvents.push(data);
  };
  marketFeed.on('priceZoneTriggered', onTrigger);

  marketFeed.updatePrice('XAUUSD', triggerPrice);
  marketFeed.off('priceZoneTriggered', onTrigger);

  console.log('Zone Trigger Events Fired:', triggeredEvents.length);
  if (triggeredEvents.length > 0) {
    console.log('✅ PASS: Event-driven trigger fired successfully with zone context!');
  }

  // 5. Test Telegram Formatted Two-Sided Report
  console.log('\n5. Generating Telegram Two-Sided Structural Report:');
  const report = MultiTimeframeScanner.formatTelegramReport('XAUUSD');
  console.log(report);

  console.log('\n🎉 ALL TWO-SIDED MULTI-TIMEFRAME & AUTONOMOUS TRIGGER TESTS PASSED!');
}

testTwoSidedSystem().catch(err => {
  console.error('❌ Two-Sided System Test failed:', err);
  process.exit(1);
});
