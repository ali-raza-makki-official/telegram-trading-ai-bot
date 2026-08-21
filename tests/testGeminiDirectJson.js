const config = require('../src/config');

async function testJson() {
  const key = config.llm.gemini.apiKey || process.env.GEMINI_API_KEY;
  const model = 'gemini-3.6-flash';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const payload = {
    contents: [
      {
        parts: [
          { text: "Synthesize Gold 15m decision. Return JSON: { thought_process, reply, action_type, trade_decision: { action, lot, sl, tp, rationale } }" }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
      maxOutputTokens: 1000
    }
  };

  const start = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  const took = Date.now() - start;

  console.log(`Generated JSON in ${took}ms:`);
  console.log(data.candidates[0].content.parts[0].text);
}

testJson().catch(err => console.error('Error:', err));
