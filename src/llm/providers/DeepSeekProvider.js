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

  /**
   * Smart Dual-Mode Chat Completion
   * @param {Array} messages - Chat messages array
   * @param {Object} options - { mode: 'FAST_CHAT' | 'DEEP_THINKING', maxTokens: number, responseFormat: string }
   */
  async chatCompletion(messages, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('DeepSeek API key not configured (DEEPSEEK_API_KEY)');
    }

    const mode = options.mode || (this.thinkingMode ? 'DEEP_THINKING' : 'FAST_CHAT');
    const isDeep = mode === 'DEEP_THINKING';
    const url = `${this.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    const requestBody = {
      model: isDeep ? (this.model || 'deepseek-v4-pro') : 'deepseek-chat',
      messages,
      response_format: options.responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
      temperature: isDeep ? 0.2 : 0.3,
      stream: false,
    };

    if (isDeep) {
      requestBody.thinking = { type: 'enabled' };
      requestBody.reasoning_effort = this.reasoningEffort;
      logger.info({ mode: 'DEEP_THINKING', model: requestBody.model }, '[DeepSeek SmartRouter] Executing Deep Institutional Reasoning');
    } else {
      requestBody.max_tokens = options.maxTokens || 400;
      logger.info({ mode: 'FAST_CHAT', model: requestBody.model }, '[DeepSeek SmartRouter] Executing Fast Lightweight Response (Token-Saving Active)');
    }

    try {
      let response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      // Fallback if thinking or deepseek-v4-pro is unsupported by standard proxy
      if (!response.ok && (response.status === 400 || response.status === 404)) {
        logger.warn({ status: response.status }, '[DeepSeek SmartRouter] Retrying with standard deepseek-chat fallback...');
        const fallbackBody = {
          model: 'deepseek-chat',
          messages,
          response_format: options.responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
          temperature: 0.3,
          max_tokens: options.maxTokens || 400,
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

      return {
        content,
        reasoningContent,
        mode,
        usage: data.usage || null,
      };
    } catch (err) {
      logger.error({ err: err.message, mode }, 'DeepSeek API execution failed');
      throw err;
    }
  }

  async generateThesis(promptText, options = {}) {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: promptText },
    ];

    const result = await this.chatCompletion(messages, {
      mode: options.mode || 'DEEP_THINKING',
      responseFormat: 'json_object',
    });

    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('DeepSeek response did not contain a valid JSON object');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (result.reasoningContent) {
      parsed.thinking_process = result.reasoningContent;
    }
    return TradeThesisSchema.parse(parsed);
  }
}

module.exports = DeepSeekProvider;
