/**
 * Deterministic Rule Tree Evaluator
 * Evaluates conditions and AND/OR rule trees against the current indicator and pattern cache.
 */

const { getIndicatorHistory } = require('./indicators');

/**
 * Evaluate Rule Tree
 * @param {Object} ruleTree - { purpose, logic: 'AND'|'OR', condition_ids: [...] }
 * @param {Array} allConditions - List of all defined conditions in strategy
 * @param {Map} indicatorCache - In-memory indicator & pattern cache
 * @returns {boolean} Whether rule tree matches
 */
function evaluateRuleTree(ruleTree, allConditions = [], indicatorCache = new Map()) {
  if (!ruleTree || !ruleTree.condition_ids || ruleTree.condition_ids.length === 0) {
    return false;
  }

  const results = ruleTree.condition_ids.map(condId => {
    const cond = allConditions.find(c => c.id === condId);
    if (!cond) return false;
    return evaluateCondition(cond, indicatorCache);
  });

  return ruleTree.logic === 'OR' 
    ? results.some(r => r === true)
    : results.every(r => r === true);
}

/**
 * Evaluate a Single Measurable Condition
 */
function evaluateCondition(condition, cache) {
  const current = cache.get(condition.reference_alias);
  if (current === undefined || current === null) return false;

  // Resolve compare_to: could be a number, boolean string, or another alias (e.g. 'EMA_50')
  let compareVal = condition.compare_to;
  if (typeof compareVal === 'string' && cache.has(compareVal)) {
    compareVal = cache.get(compareVal);
  } else if (!isNaN(Number(compareVal))) {
    compareVal = Number(compareVal);
  }

  const numCurrent = typeof current === 'number' ? current : (typeof current === 'object' && current.macd !== undefined ? current.macd : null);

  switch (condition.operator) {
    case 'greater_than':
      return numCurrent !== null && numCurrent > compareVal;

    case 'less_than':
      return numCurrent !== null && numCurrent < compareVal;

    case 'equals':
      return current === compareVal || current.toString().toLowerCase() === compareVal.toString().toLowerCase();

    case 'pattern_detected':
      return current === true;

    case 'crosses_above':
      return checkCrossover(condition.reference_alias, compareVal, 'above');

    case 'crosses_below':
      return checkCrossover(condition.reference_alias, compareVal, 'below');

    case 'within_range': {
      // compare_to could be e.g. "30-70"
      if (typeof condition.compare_to === 'string' && condition.compare_to.includes('-')) {
        const [min, max] = condition.compare_to.split('-').map(Number);
        return numCurrent >= min && numCurrent <= max;
      }
      return false;
    }

    default:
      return false;
  }
}

/**
 * Check Crossover against historical indicator values
 */
function checkCrossover(alias, threshold, direction) {
  const history = getIndicatorHistory(alias);
  if (history.length < 2) return false;

  const prev = history[history.length - 2];
  const curr = history[history.length - 1];

  const target = typeof threshold === 'number' ? threshold : Number(threshold);
  if (isNaN(target)) return false;

  return direction === 'above'
    ? prev <= target && curr > target
    : prev >= target && curr < target;
}

module.exports = {
  evaluateRuleTree,
  evaluateCondition,
};
