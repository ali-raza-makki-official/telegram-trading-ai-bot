const assert = require('assert');
const tradingCore = require('../src/index');

console.log('--- RUNNING TRADING-CORE PACKAGE UNIT TESTS ---');

// 1. Indicators Test
console.log('1. Testing Indicators:');
const sampleCloses = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const sma5 = tradingCore.calculateSMA(sampleCloses, 5);
assert.strictEqual(sma5[4], 12);
assert.strictEqual(sma5[sma5.length - 1], 18);
console.log('  ✓ calculateSMA verified');

const ema5 = tradingCore.calculateEMA(sampleCloses, 5);
assert(ema5[ema5.length - 1] > 17);
console.log('  ✓ calculateEMA verified');

const fib = tradingCore.calculateFibonacciLevels(2000, 1900, true);
assert.strictEqual(fib['0.705'], 1929.5);
console.log('  ✓ calculateFibonacciLevels verified');

// 2. Candlestick Patterns Test
console.log('\n2. Testing Candlestick Patterns:');
const hammerCandle = { open: 2648, close: 2650, high: 2650.5, low: 2635 };
const hammerResult = tradingCore.checkHammer(hammerCandle, true);
assert(hammerResult !== null);
assert.strictEqual(hammerResult.pattern, 'HAMMER');
console.log('  ✓ checkHammer verified');

const engulfingPrev = { open: 1950, high: 1952, low: 1940, close: 1941 };
const engulfingCurr = { open: 1939, high: 1955, low: 1938, close: 1953 };
const engulfResult = tradingCore.checkEngulfing(engulfingPrev, engulfingCurr);
assert(engulfResult !== null);
assert.strictEqual(engulfResult.pattern, 'BULLISH_ENGULFING');
console.log('  ✓ checkEngulfing verified');

// 3. Risk Management Test
console.log('\n3. Testing Risk Math:');
const lotResult = tradingCore.calculateLotSize({
  balance: 1000,
  riskPercent: 1.0, // $10 risk
  entryPrice: 2000,
  stopLoss: 1995, // 5 point SL ($500 per lot on Gold)
  contractSize: 100,
});
// 10 / (5 * 100) = 0.02 lots
assert.strictEqual(lotResult.lotSize, 0.02);
assert.strictEqual(lotResult.riskAmountUsd, 10);
console.log('  ✓ calculateLotSize verified (0.02 lots on $10 risk)');

const lossCheck = tradingCore.checkDailyLossLimit({
  balance: 1000,
  maxLossPercent: 3.0,
  currentDailyPnl: -35.0,
});
assert.strictEqual(lossCheck.isBreached, true);
console.log('  ✓ checkDailyLossLimit verified');

// 4. Guardrails Test
console.log('\n4. Testing Guardrails:');
const spreadPassed = tradingCore.checkSpreadGuard(20, 30);
assert.strictEqual(spreadPassed.passed, true);
const spreadFailed = tradingCore.checkSpreadGuard(40, 30);
assert.strictEqual(spreadFailed.passed, false);
console.log('  ✓ checkSpreadGuard verified');

const sessionCheck = tradingCore.checkSessionFilter('LONDON_OPEN', ['london', 'newyork']);
assert.strictEqual(sessionCheck.passed, true);
console.log('  ✓ checkSessionFilter verified');

console.log('\n=============================================');
console.log('  ALL TRADING-CORE TESTS PASSED (100% SUCCESS)');
console.log('=============================================\n');
