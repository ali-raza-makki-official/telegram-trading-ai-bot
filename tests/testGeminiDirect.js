const config = require('../src/config');

async function testDirect() {
  const key = config.llm.gemini.apiKey || process.env.GEMINI_API_KEY;
  const model = 'gemini-3.6-flash';
  console.log('Testing model:', model, 'with key:', key ? key.substring(0, 10) + '...' : 'NONE');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const payload = {
    contents: [
      {
        parts: [
          { text: "Assalam o Alaikum! Market ka kia scene hai? Answer in 1 short sentence." }
        ]
      }
    ]
  };

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000),
    });
    const took = Date.now() - start;
    const data = await res.json();
    console.log(`\nHTTP ${res.status} received in ${took}ms:`);
    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      console.log('✅ Response:', data.candidates[0].content.parts[0].text);
    } else {
      console.log('Data:', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Fetch failed after', Date.now() - start, 'ms:', err.message);
  }
}

testDirect();
