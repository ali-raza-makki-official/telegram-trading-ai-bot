const metaApiClient = require('../src/execution/MetaApiClient');

async function checkAccountType() {
  console.log('Connecting to MetaApi to fetch exact broker account details...');
  await metaApiClient.connect();
  const info = await metaApiClient.getAccountInformation();
  console.log('\n=== RAW BROKER ACCOUNT INFORMATION FROM METAAPI ===');
  console.log(JSON.stringify(info, null, 2));
  
  if (metaApiClient.account) {
    console.log('\n=== METAAPI CLOUD METADATA ===');
    console.log({
      id: metaApiClient.account.id,
      name: metaApiClient.account.name,
      server: metaApiClient.account.server,
      type: metaApiClient.account.type,
      state: metaApiClient.account.state,
    });
  }
  process.exit(0);
}

checkAccountType().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
