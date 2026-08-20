const config = require('../src/config');

async function testMetaApiRest() {
  const accountId = config.metaApi.accountId;
  const token = config.metaApi.token;

  console.log('Testing MetaApi REST API endpoints...');

  // 1. Account Information
  try {
    const accRes = await fetch(`https://mt-client-api-v1.london-a.agiliumtrade.ai/users/current/accounts/${accountId}/account-information`, {
      headers: { 'auth-token': token },
    });
    const accData = await accRes.json();
    console.log('1. Account Information:', {
      balance: accData.balance,
      equity: accData.equity,
      currency: accData.currency,
      server: accData.server,
      leverage: accData.leverage,
    });
  } catch (err) {
    console.error('Account info error:', err.message);
  }

  // 2. Symbol Price
  try {
    const priceRes = await fetch(`https://mt-client-api-v1.london-a.agiliumtrade.ai/users/current/accounts/${accountId}/symbols/XAUUSDm/current-price`, {
      headers: { 'auth-token': token },
    });
    const priceData = await priceRes.json();
    console.log('2. Live Gold Price:', {
      bid: priceData.bid,
      ask: priceData.ask,
      time: priceData.time,
    });
  } catch (err) {
    console.error('Symbol price error:', err.message);
  }
}

testMetaApiRest().catch(console.error);
