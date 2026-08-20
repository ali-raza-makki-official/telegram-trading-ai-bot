const MetaApi = require('metaapi.cloud-sdk').default || require('metaapi.cloud-sdk');
const config = require('../src/config');

async function findGoldSymbol() {
  const api = new MetaApi(config.metaApi.token);
  const account = await api.metatraderAccountApi.getAccount(config.metaApi.accountId);
  const rpc = account.getRPCConnection();
  await rpc.connect();
  await rpc.waitSynchronized();

  const symbols = await rpc.getSymbols();
  const goldSymbols = symbols.filter(s => s.toUpperCase().includes('XAU') || s.toUpperCase().includes('GOLD'));
  console.log('Matching Gold symbols found on Exness MT5:', goldSymbols);

  await rpc.close();
}

findGoldSymbol().catch(console.error);
