const MultiTimeframeScanner = require('../src/strategies/smc/multiTimeframeScanner');
const smartTrigger = require('../src/orchestrator/smartPriceTriggerEngine');

async function testScanner() {
  console.log('=== VERIFYING MULTI-TIMEFRAME ORDER BLOCK & ZONE SCANNER ===\n');

  console.log('1. Scanning all timeframes (5m, 15m, 30m, 1h, 4h, 1D)...');
  const scan = MultiTimeframeScanner.scanAllZones('XAUUSD');
  console.log('Order Blocks found:', scan.orderBlocks.length);
  console.log('FVGs found:', scan.fairValueGaps.length);

  const activeZones = smartTrigger.getActiveZones();
  console.log('Active zones registered in SmartPriceTriggerEngine:', activeZones.length);

  console.log('\n2. Formatting Telegram Report:');
  const report = MultiTimeframeScanner.formatTelegramReport('XAUUSD');
  console.log(report);

  if (activeZones.length > 0 && report.includes('Active Order Blocks')) {
    console.log('\n✅ MultiTimeframeScanner successfully detected and registered Order Blocks!');
  } else {
    throw new Error('Scanner failed to register zones');
  }
}

testScanner().catch(err => {
  console.error('❌ Scanner test failed:', err);
  process.exit(1);
});
