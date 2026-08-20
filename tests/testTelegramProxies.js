const config = require('../src/config');

const token = config.telegram.botToken;

const endpoints = [
  'https://api.telegram.org',
  'https://tgproxy.me/api.telegram.org',
  'https://telegram-bot-api.vercel.app',
  'https://tlgrm.eu',
];

async function testEndpoints() {
  console.log('Testing Telegram API connectivity endpoints...');
  for (const ep of endpoints) {
    try {
      const url = `${ep}/bot${token}/getMe`;
      console.log(`Testing: ${ep} ...`);
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      console.log(`✓ SUCCESS on ${ep}:`, data.result?.username);
      return ep;
    } catch (err) {
      console.log(`✗ Failed on ${ep}:`, err.message);
    }
  }
}

testEndpoints().catch(console.error);
