const MetaApi = require('metaapi.cloud-sdk').default || require('metaapi.cloud-sdk');
const config = require('../src/config');
const logger = require('../src/utils/logger');

async function testLiveConnection() {
  console.log('Testing live MetaApi connection with token and account ID...');
  const token = config.metaApi.token;
  const accountId = config.metaApi.accountId;

  console.log('Account ID:', accountId);
  console.log('Token starts with:', token.substring(0, 20) + '...');

  const api = new MetaApi(token);
  const account = await api.metatraderAccountApi.getAccount(accountId);

  console.log('Account Name:', account.name);
  console.log('Account State:', account.state);
  console.log('Server:', account.server);
  console.log('Connection Status:', account.connectionStatus);

  console.log('\nFetching RPC connection...');
  const rpc = account.getRPCConnection();
  await rpc.connect();
  await rpc.waitSynchronized();

  const info = await rpc.getAccountInformation();
  console.log('--- LIVE MT5 ACCOUNT INFO ---');
  console.log('Broker Server:', info.server);
  console.log('Balance:', info.balance, info.currency);
  console.log('Equity:', info.equity, info.currency);
  console.log('Leverage:', info.leverage);

  const positions = await rpc.getPositions();
  console.log('Open Positions Count:', positions.length);

  await rpc.close();
  console.log('\nTest completed successfully! MetaApi is fully operational.');
}

testLiveConnection().catch(err => {
  console.error('MetaApi test error:', err);
});
