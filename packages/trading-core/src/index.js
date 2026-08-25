/**
 * @fileoverview trading-core
 * Strategy-agnostic quantitative trading calculation core.
 * Contains pure technical indicators, candlestick pattern detection, risk mathematics, and guardrail validation.
 */

const indicators = require('./indicators');
const candlesticks = require('./candlesticks');
const risk = require('./risk');
const guardrails = require('./guardrails');

module.exports = {
  // Indicators
  ...indicators,
  indicators,

  // Candlestick Patterns
  ...candlesticks,
  candlesticks,

  // Risk Math & Position Sizing
  ...risk,
  risk,

  // Guardrails
  ...guardrails,
  guardrails,
};
