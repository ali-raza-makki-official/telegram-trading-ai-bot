const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../../config');
const logger = require('../../utils/logger');
const { SYSTEM_PROMPT, TradeThesisSchema } = require('../prompts');

const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash-lite'];

class GeminiProvider {
  constructor() {
    this.apiKey = config.llm.gemini.apiKey || process.env.GEMINI_API_KEY;
    this.modelName = config.llm.gemini.model || 'gemini-3.6-flash';
    this.client = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
  }

  isAvailable() {
    return Boolean((this.apiKey || process.env.GEMINI_API_KEY) && this.client);
  }

  /**
   * Smart Dual-Mode Gemini Text Completion with Resilient Model Failover
   */
  async chatCompletion(promptText, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Google Gemini API key not configured (GEMINI_API_KEY)');
    }

    const mode = options.mode || 'FAST_CHAT';
    const isDeep = mode === 'DEEP_THINKING';
    const modelsToTry = [this.modelName, ...FALLBACK_MODELS.filter(m => m !== this.modelName)];
    let lastError = null;

    for (const targetModel of modelsToTry) {
      try {
        const genConfig = {
          temperature: isDeep ? 0.2 : 0.4,
          maxOutputTokens: isDeep ? 2000 : (options.maxTokens || 1000),
        };
        if (options.responseFormat === 'json_object' || options.jsonMode) {
          genConfig.responseMimeType = 'application/json';
        }

        const model = this.client.getGenerativeModel({
          model: targetModel,
          systemInstruction: options.systemInstruction || SYSTEM_PROMPT,
          generationConfig: genConfig,
        });

        logger.info({ mode, model: targetModel }, '[Gemini Multi-Model] Executing Gemini Generation');
        const result = await model.generateContent(promptText);
        const rawText = result.response.text() || '';

        return {
          content: rawText,
          mode,
          model: targetModel,
        };
      } catch (err) {
        lastError = err;
        logger.warn({ err: err.message, model: targetModel }, 'Gemini model failed or busy, trying next free fallback model...');
      }
    }

    logger.error({ err: lastError?.message, mode }, 'All Gemini free models failed');
    throw lastError;
  }

  /**
   * Multimodal Vision: Direct Candlestick Chart & Image Analysis
   */
  async analyzeImage(imageBuffer, mimeType = 'image/png', promptText = 'Analyze this Gold (XAU/USD) SMC chart. Identify Order Blocks, FVGs, and Key Levels.') {
    if (!this.isAvailable()) throw new Error('Gemini API key not configured');

    const modelsToTry = [this.modelName, ...FALLBACK_MODELS.filter(m => m !== this.modelName)];
    for (const targetModel of modelsToTry) {
      try {
        const model = this.client.getGenerativeModel({
          model: targetModel,
          systemInstruction: SYSTEM_PROMPT,
        });

        const imagePart = {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType,
          },
        };

        logger.info({ model: targetModel }, '[Gemini Multimodal] Analyzing Candlestick Chart Image with Vision AI');
        const result = await model.generateContent([promptText, imagePart]);
        return result.response.text();
      } catch (err) {
        logger.warn({ err: err.message, model: targetModel }, 'Vision analysis failed on model, trying next...');
      }
    }
    throw new Error('All vision models failed');
  }

  /**
   * Multimodal Audio: Direct Urdu & English Voice Notes Audio Processing
   */
  async processAudio(audioBuffer, mimeType = 'audio/ogg', promptText = 'Listen to this trading voice note in Urdu/English. Transcribe user intent and formulate trading command or response.') {
    if (!this.isAvailable()) throw new Error('Gemini API key not configured');

    const modelsToTry = [this.modelName, ...FALLBACK_MODELS.filter(m => m !== this.modelName)];
    for (const targetModel of modelsToTry) {
      try {
        const model = this.client.getGenerativeModel({
          model: targetModel,
          systemInstruction: SYSTEM_PROMPT,
        });

        const audioPart = {
          inlineData: {
            data: audioBuffer.toString('base64'),
            mimeType,
          },
        };

        logger.info({ model: targetModel }, '[Gemini Multimodal] Processing Audio Voice Note with Gemini');
        const result = await model.generateContent([promptText, audioPart]);
        return result.response.text();
      } catch (err) {
        logger.warn({ err: err.message, model: targetModel }, 'Audio processing failed on model, trying next...');
      }
    }
    throw new Error('All audio models failed');
  }

  async generateThesis(promptText, options = {}) {
    const result = await this.chatCompletion(promptText, {
      mode: options.mode || 'DEEP_THINKING',
      systemInstruction: SYSTEM_PROMPT,
      jsonMode: true,
      responseFormat: 'json_object',
    });

    let raw = result.content ? result.content.replace(/^```json|^```|```$/gm, '').trim() : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    let parsed = {};
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {}
    }

    const bias = ['BULLISH', 'BEARISH', 'NEUTRAL'].includes(String(parsed.bias || '').toUpperCase())
      ? String(parsed.bias).toUpperCase()
      : 'NEUTRAL';

    let entryZone = null;
    if (parsed.entry_zone) {
      if (typeof parsed.entry_zone === 'object' && parsed.entry_zone.min && parsed.entry_zone.max) {
        entryZone = { min: Number(parsed.entry_zone.min), max: Number(parsed.entry_zone.max) };
      } else if (typeof parsed.entry_zone === 'string') {
        const nums = parsed.entry_zone.match(/\d+(\.\d+)?/g);
        if (nums && nums.length >= 2) {
          entryZone = { min: Math.min(Number(nums[0]), Number(nums[1])), max: Math.max(Number(nums[0]), Number(nums[1])) };
        }
      }
    }

    return {
      bias,
      confidence: Number(parsed.confidence) || (bias === 'NEUTRAL' ? 50 : 75),
      primary_setup: parsed.primary_setup || 'Institutional SMC/ICT Confluence Zone',
      reasoning: parsed.reasoning || raw || 'Multi-timeframe SMC order flow structure analysis.',
      invalidation_level: parsed.invalidation_level !== undefined && parsed.invalidation_level !== null ? Number(parsed.invalidation_level) : null,
      entry_zone: entryZone,
      suggested_sl: parsed.suggested_sl !== undefined && parsed.suggested_sl !== null ? Number(parsed.suggested_sl) : null,
      suggested_tp1: parsed.suggested_tp1 !== undefined && parsed.suggested_tp1 !== null ? Number(parsed.suggested_tp1) : null,
      suggested_tp2: parsed.suggested_tp2 !== undefined && parsed.suggested_tp2 !== null ? Number(parsed.suggested_tp2) : null,
      risk_reward_ratio: parsed.risk_reward_ratio !== undefined && parsed.risk_reward_ratio !== null ? Number(parsed.risk_reward_ratio) : 2.0,
      timeframe_alignment_summary: parsed.timeframe_alignment_summary || 'Multi-timeframe aligned',
      caution_flags: Array.isArray(parsed.caution_flags) ? parsed.caution_flags : [],
    };
  }
}

module.exports = GeminiProvider;
