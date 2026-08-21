const ComprehensiveEngine = require('../src/strategies/smc/comprehensiveAnalysisEngine');
const smartTrigger = require('../src/orchestrator/smartPriceTriggerEngine');

async function testComprehensiveAnalysis() {
  console.log('=== VERIFYING FULL 7-TIMEFRAME ANALYSIS & PENDING LIMIT ZONES ===\n');

  console.log('1. Running Full Top-Down Deep Scan (1W -> 1D -> 4H -> 1H -> 30M -> 15M -> 5M) + Macro...');
  const data = await ComprehensiveEngine.runFullAnalysis('XAUUSD');

  console.log('Symbol:', data.symbol);
  console.log('Current Price:', `$${data.currentPrice.toFixed(2)}`);
  console.log('DXY Status:', `${data.macro.dxy.price} (${data.macro.dxy.bias})`);
  console.log('NASDAQ Status:', `${data.macro.nasdaq.price} (${data.macro.nasdaq.bias})`);

  console.log('\n2. Two-Sided Tiered Limit Trading Zones:');
  console.log(`Tiered BUY Limits Count: ${data.tieredBuyLimits.length}`);
  console.log(`Tiered SELL Limits Count: ${data.tieredSellLimits.length}`);

  console.log('\nNo-Trade Zone Range:');
  console.log(`• Range: $${data.noTradeZone.bottom.toFixed(2)} - $${data.noTradeZone.top.toFixed(2)}`);

  console.log('\n3. Formatting Full Telegram Report:');
  const report = ComprehensiveEngine.formatTelegramReport(data);
  console.log(report);

  const activeZones = smartTrigger.getActiveZones();
  console.log('Active Zones Registered in Memory/Disk:', activeZones.length);

  if (data.tieredBuyLimits.length > 0 && data.tieredSellLimits.length > 0 && activeZones.length > 0) {
    console.log('\n🎉 ALL FULL MULTI-TIMEFRAME ANALYSIS & LIMIT ZONE TESTS PASSED!');
  } else {
    throw new Error('Comprehensive analysis test failed');
  }
}

testComprehensiveAnalysis().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
