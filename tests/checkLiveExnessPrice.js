const MetaApi = require('metaapi.cloud-sdk').default || require('metaapi.cloud-sdk');
const config = require('../src/config');

async function checkLivePrice() {
  console.log('Fetching exact live price from Exness MT5 account...');
  const api = new MetaApi(config.metaApi.token);
  const account = await api.metatraderAccountApi.getAccount(config.metaApi.accountId);
  const rpc = account.getRPCConnection();
  await rpc.connect();
  await rpc.waitSynchronized();

  const price = await rpc.getSymbolPrice('XAUUSDm');
  console.log('--- EXACT EXNESS LIVE GOLD PRICE ---');
  console.log('Symbol:', 'XAUUSDm');
  console.log('Bid Price (USD per Troy Ounce):', price.bid);
  console.log('Ask Price (USD per Troy Ounce):', price.ask);
  console.log('Spread (Pips):', Number(((price.ask - price.bid) * 10).toFixed(1)));
  console.log('Timestamp:', new Date(price.time).toISOString());

  // Also check if there are other symbols
  const allSymbols = await rpc.getSymbols();
  const goldSymbols = allSymbols.filter(s => s.toUpperCase().includes('XAU') || s.toUpperCase().includes('GOLD'));
  console.log('\nAll Gold/XAU symbols on this broker:', goldSymbols);

  for (const s of goldSymbols) {
    try {
      const p = await rpc.getSymbolPrice(s);
      console.log(`Symbol: ${s} -> Bid: ${p.bid}, Ask: ${p.ask}`);
    } catch {}
  }

  await rpc.close();
}

checkLivePrice().catch(console.error);
