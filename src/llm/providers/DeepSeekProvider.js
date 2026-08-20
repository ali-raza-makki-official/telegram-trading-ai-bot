const config = require('../../config');
const logger = require('../../utils/logger');
const { SYSTEM_PROMPT, TradeThesisSchema } = require('../prompts');

class DeepSeekProvider {
  constructor() {
    this.apiKey = config.llm.deepseek.apiKey;
    this.model = config.llm.deepseek.model || 'deepseek-v4-pro';
    this.baseUrl = config.llm.deepseek.baseUrl;
    this.thinkingMode = config.llm.deepseek.thinkingMode;
    this.reasoningEffort = config.llm.deepseek.reasoningEffort || 'high';
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
      logger.info({ model: this.model, thinkingMode: this.thinkingMode }, 'Sending analysis request to DeepSeek-V4-Pro API...');

      const requestBody = {
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: promptText },
        ],
        response_format: { type: 'json_object' },
        stream: false,
      };

      if (this.thinkingMode) {
        requestBody.thinking = { type: 'enabled' };
        requestBody.reasoning_effort = this.reasoningEffort;
      } else {
        requestBody.temperature = 0.2;
      }

      let response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      // Graceful fallback if model name or thinking parameter needs standard format
      if (!response.ok && (response.status === 400 || response.status === 404)) {
        logger.warn({ status: response.status }, 'Retrying DeepSeek request with fallback payload...');
        const fallbackBody = {
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: promptText },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        };
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(fallbackBody),
        });
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`DeepSeek API error HTTP ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message || {};
      const content = message.content || '{}';
      const reasoningContent = message.reasoning_content || null;

      // Parse JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('DeepSeek response did not contain a valid JSON object');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (reasoningContent) {
        parsed.thinking_process = reasoningContent;
      }
      return TradeThesisSchema.parse(parsed);
    } catch (err) {
      logger.error({ err: err.message }, 'DeepSeek LLM reasoning error');
      throw err;
    }
  }
}

module.exports = DeepSeekProvider;
