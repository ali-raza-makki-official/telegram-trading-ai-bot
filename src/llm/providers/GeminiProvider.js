const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../../config');
const logger = require('../../utils/logger');
const { SYSTEM_PROMPT, TradeThesisSchema } = require('../prompts');

class GeminiProvider {
  constructor() {
    this.apiKey = config.llm.gemini.apiKey;
    this.modelName = config.llm.gemini.model;
    this.client = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
  }

  isAvailable() {
    return Boolean(this.client && this.apiKey);
  }

  async generateThesis(promptText) {
    if (!this.isAvailable()) {
      throw new Error('Google Gemini API key not configured');
    }

    try {
      const model = this.client.getGenerativeModel({
        model: this.modelName,
        systemInstruction: SYSTEM_PROMPT,
      });

      const result = await model.generateContent(promptText);
      const rawText = result.response.text() || '{}';

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Gemini response did not contain valid JSON');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return TradeThesisSchema.parse(parsed);
    } catch (err) {
      logger.error({ err: err.message }, 'Gemini LLM reasoning error');
      throw err;
    }
  }
}

module.exports = GeminiProvider;
