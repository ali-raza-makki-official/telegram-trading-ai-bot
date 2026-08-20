const MetaApi = require('metaapi.cloud-sdk').default || require('metaapi.cloud-sdk');
const config = require('../src/config');

async function testRpcCandles() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.log('Connecting to MetaApi RPC for real candles...');
  const api = new MetaApi(config.metaApi.token);
  const account = await api.metatraderAccountApi.getAccount(config.metaApi.accountId);
  const rpc = account.getRPCConnection();
  await rpc.connect();
  await rpc.waitSynchronized();

  console.log('Fetching real 15m candles from Exness MT5...');
  const candles = await rpc.getCandles('XAUUSDm', '15m', new Date(Date.now() - 24 * 60 * 60 * 1000), 50);
  console.log('Retrieved Real Candles Count:', candles.length);
  if (candles.length > 0) {
    const latest = candles[candles.length - 1];
    console.log('Latest Real MT5 Candle:');
    console.log({
      time: latest.time,
      open: latest.open,
      high: latest.high,
      low: latest.low,
      close: latest.close,
      volume: latest.volume,
    });
  }

  await rpc.close();
}

testRpcCandles().catch(console.error);
