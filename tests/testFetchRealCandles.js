const config = require('../src/config');

async function testFetchRealCandles() {
  const accountId = config.metaApi.accountId;
  const token = config.metaApi.token;

  console.log('Testing MetaApi REST real historical candles...');

  // MetaApi historical candles REST endpoint
  const url = `https://mt-market-data-client-api-v1.london-a.agiliumtrade.ai/users/current/accounts/${accountId}/historical-market-data/symbols/XAUUSDm/timeframes/15m/candles?limit=10`;
  
  try {
    const res = await fetch(url, {
      headers: { 'auth-token': token },
    });
    const candles = await res.json();
    console.log('Real Candles Result Count:', Array.isArray(candles) ? candles.length : candles);
    if (Array.isArray(candles) && candles.length > 0) {
      console.log('Latest Real 15m Candle:', candles[candles.length - 1]);
    }
  } catch (err) {
    console.error('Error fetching candles:', err);
  }
}

testFetchRealCandles().catch(console.error);
