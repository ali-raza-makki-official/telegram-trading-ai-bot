const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const config = require('../src/config');

async function diagnose() {
  const token = config.telegram.botToken;
  console.log('--- TESTING TELEGRAM BOT WITH IPv4 ---');
  console.log('Token:', token.substring(0, 15) + '...');

  try {
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const meData = await meRes.json();
    console.log('1. getMe API Result:', meData);

    const whRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const whData = await whRes.json();
    console.log('2. Webhook info:', whData);

    const upRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=5`);
    const upData = await upRes.json();
    console.log('3. Recent updates count:', upData.result?.length);
    if (upData.result && upData.result.length > 0) {
      console.log('Last message text:', upData.result[upData.result.length - 1].message?.text);
      console.log('From user ID:', upData.result[upData.result.length - 1].message?.from?.id);
    }
  } catch (err) {
    console.error('Error connecting to Telegram API:', err);
  }
}

diagnose();
