/**
 * Technical Indicators Engine (telegram-trading-ai-bot adapter)
 * Re-exports strategy-agnostic indicator calculators from the shared @trading/core package.
 */

const indicators = require('../../packages/trading-core/src/indicators');

module.exports = {
  ...indicators,
};
