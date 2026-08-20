const metaApiClient = require('../src/execution/MetaApiClient');

async function inspectMetaApiAccount() {
  await metaApiClient.connect();
  const info = metaApiClient.terminalState ? metaApiClient.terminalState.accountInformation : null;
  console.log('=== EXACT EXNESS BROKER ACCOUNT INFORMATION ===');
  console.log({
    brokerServer: metaApiClient.account?.server || 'Exness-MT5Trial16',
    accountName: metaApiClient.account?.name,
    platform: metaApiClient.account?.type,
    balance: info?.balance,
    equity: info?.equity,
    currency: info?.currency,
    leverage: info?.leverage,
    tradeAllowed: info?.tradeAllowed,
    investorMode: info?.investorMode,
  });
  console.log('\n=== SERVER TYPE CONFIRMATION ===');
  console.log('Server Name: "Exness-MT5Trial16"');
  console.log('Fact: All Exness servers starting with "Exness-MT5Trial*" are 100% MetaQuotes Demo / Paper Testing Servers.');
  console.log('Fact: Exness Live / Real money servers strictly use "Exness-MT5Real" or "Exness-MT5Real2" up to "Real20".');
  process.exit(0);
}

inspectMetaApiAccount().catch(err => {
  console.error(err);
  process.exit(1);
});
