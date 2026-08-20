const config = require('../../config');
const logger = require('../../utils/logger');
const { SYSTEM_PROMPT, TradeThesisSchema } = require('../prompts');

class DeepSeekProvider {
  constructor() {
    this.apiKey = config.llm.deepseek.apiKey;
    this.model = config.llm.deepseek.model;
    this.baseUrl = config.llm.deepseek.baseUrl;
  }

  isAvailable() {
    return Boolean(this.apiKey);
  }

  async generateThesis(promptText) {
    if (!this.isAvailable()) {
      throw new Error('DeepSeek API key not configured (DEEPSEEK_API_KEY)');
    }

    try {
      const url = `${this.baseUrl.replace(/\/+$/, '')}/chat/completions`;
      logger.info({ model: this.model }, 'Sending analysis request to DeepSeek API...');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: promptText },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`DeepSeek API error HTTP ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '{}';

      // Parse JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('DeepSeek response did not contain a valid JSON object');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return TradeThesisSchema.parse(parsed);
    } catch (err) {
      logger.error({ err: err.message }, 'DeepSeek LLM reasoning error');
      throw err;
    }
  }
}

module.exports = DeepSeekProvider;
