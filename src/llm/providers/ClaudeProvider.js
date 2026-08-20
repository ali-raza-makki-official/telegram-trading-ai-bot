const Anthropic = require('@anthropic-ai/sdk');
const config = require('../../config');
const logger = require('../../utils/logger');
const { SYSTEM_PROMPT, TradeThesisSchema } = require('../prompts');

class ClaudeProvider {
  constructor() {
    this.apiKey = config.llm.claude.apiKey;
    this.model = config.llm.claude.model;
    this.client = this.apiKey ? new Anthropic({ apiKey: this.apiKey }) : null;
  }

  isAvailable() {
    return Boolean(this.client && this.apiKey);
  }

  async generateThesis(promptText) {
    if (!this.isAvailable()) {
      throw new Error('Anthropic Claude API key not configured');
    }

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: promptText }],
      });

      const rawText = response.content[0]?.text || '{}';
      // Clean possible markdown code fences
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Claude response did not contain valid JSON');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return TradeThesisSchema.parse(parsed);
    } catch (err) {
      logger.error({ err: err.message }, 'Claude LLM reasoning error');
      throw err;
    }
  }
}

module.exports = ClaudeProvider;
