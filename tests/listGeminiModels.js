const config = require('../src/config');

async function listModels() {
  const key = config.llm.gemini.apiKey || process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
  const res = await fetch(url);
  const data = await res.json();
  
  if (data.models) {
    const textModels = data.models
      .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => ({ name: m.name, displayName: m.displayName }));
    console.log('Available generateContent models:', JSON.stringify(textModels, null, 2));
  } else {
    console.log('Response:', data);
  }
}

listModels().catch(err => console.error(err));
