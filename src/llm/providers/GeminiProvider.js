const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../../config');
const logger = require('../../utils/logger');
const { SYSTEM_PROMPT, TradeThesisSchema } = require('../prompts');

class GeminiProvider {
  constructor() {
    this.apiKey = config.llm.gemini.apiKey;
    this.modelName = config.llm.gemini.model || 'gemini-2.5-flash';
    this.client = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
  }

  isAvailable() {
    return Boolean(this.client && this.apiKey);
  }

  /**
   * Smart Dual-Mode Gemini Completion
   */
  async chatCompletion(promptText, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Google Gemini API key not configured');
    }

    const mode = options.mode || 'FAST_CHAT';
    const isDeep = mode === 'DEEP_THINKING';

    try {
      const model = this.client.getGenerativeModel({
        model: this.modelName,
        systemInstruction: options.systemInstruction || SYSTEM_PROMPT,
        generationConfig: {
          temperature: isDeep ? 0.2 : 0.4,
          maxOutputTokens: isDeep ? 1500 : (options.maxTokens || 400),
        },
      });

      logger.info({ mode, model: this.modelName }, '[Gemini SmartRouter] Executing Gemini Generation');
      const result = await model.generateContent(promptText);
      const rawText = result.response.text() || '';

      return {
        content: rawText,
        mode,
      };
    } catch (err) {
      logger.error({ err: err.message, mode }, 'Gemini API execution error');
      throw err;
    }
  }

  async generateThesis(promptText, options = {}) {
    const result = await this.chatCompletion(promptText, {
      mode: options.mode || 'DEEP_THINKING',
      systemInstruction: SYSTEM_PROMPT,
    });

    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Gemini response did not contain valid JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return TradeThesisSchema.parse(parsed);
  }
}

module.exports = GeminiProvider;
