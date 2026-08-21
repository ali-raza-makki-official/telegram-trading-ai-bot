const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Dynamic Configuration & Adaptive Learning Store (Section 7 Spec)
 * Manages runtime strategy weights, thresholds, and risk bounds.
 * Allows live human adjustment and human-gated AI adaptive parameter tuning.
 */

const DEFAULT_STRATEGY_CONFIG = [
  // 1. AI-Tunable Strategy Weights & Thresholds
  {
    param_key: 'confluence.min_threshold',
    param_value: 50.0,
    param_type: 'threshold',
    min_bound: 35.0,
    max_bound: 80.0,
    is_ai_tunable: true,
    description: 'Minimum confluence confidence percentage required to trigger an actionable trade',
  },
  {
    param_key: 'weights.smc',
    param_value: 30.0,
    param_type: 'weight',
    min_bound: 10.0,
    max_bound: 50.0,
    is_ai_tunable: true,
    description: 'Weight assigned to Smart Money Concepts (BOS, CHoCH, Order Blocks, FVGs)',
  },
  {
    param_key: 'weights.ict',
    param_value: 25.0,
    param_type: 'weight',
    min_bound: 10.0,
    max_bound: 45.0,
    is_ai_tunable: true,
    description: 'Weight assigned to ICT setups (Killzones, Judas Swings, Turtle Soup)',
  },
  {
    param_key: 'weights.candlesticks',
    param_value: 20.0,
    param_type: 'weight',
    min_bound: 5.0,
    max_bound: 35.0,
    is_ai_tunable: true,
    description: 'Weight assigned to Japanese Candlestick formations (Engulfing, Pinbars)',
  },
  {
    param_key: 'weights.indicators',
    param_value: 15.0,
    param_type: 'weight',
    min_bound: 5.0,
    max_bound: 30.0,
    is_ai_tunable: true,
    description: 'Weight assigned to Classical Indicators (EMA 20/50/200, RSI, ATR)',
  },
  {
    param_key: 'weights.smt_divergence',
    param_value: 20.0,
    param_type: 'weight',
    min_bound: 5.0,
    max_bound: 40.0,
    is_ai_tunable: true,
    description: 'Weight / penalty assigned to Gold vs Silver SMT Divergence',
  },

  // 2. STRICT HUMAN-ONLY RISK LIMITS (is_ai_tunable: false, strictly forbidden for AI)
  {
    param_key: 'risk.max_percent_per_trade',
    param_value: 1.5,
    param_type: 'risk_limit',
    min_bound: 0.5,
    max_bound: 3.0,
    is_ai_tunable: false,
    description: 'Maximum percentage of account balance risked per trade',
  },
  {
    param_key: 'risk.max_lot_size',
    param_value: 0.5,
    param_type: 'risk_limit',
    min_bound: 0.01,
    max_bound: 1.0,
    is_ai_tunable: false,
    description: 'Maximum allowable lot size per single order',
  },
  {
    param_key: 'risk.max_daily_loss',
    param_value: 50.0,
    param_type: 'risk_limit',
    min_bound: 10.0,
    max_bound: 200.0,
    is_ai_tunable: false,
    description: 'Daily loss drawdown ceiling in USD before trading halts',
  },
];

class DynamicConfigStore {
  constructor() {
    this.cache = new Map();
    this.history = [];
    this.pendingProposals = new Map(); // proposalId -> proposalObject
    this.filePath = path.join(process.cwd(), 'data', 'strategy_config.json');
    this.init();
  }

  init() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.configs)) {
          for (const item of data.configs) {
            this.cache.set(item.param_key, item);
          }
        }
        if (Array.isArray(data.history)) {
          this.history = data.history;
        }
      }

      // Seed defaults if not present
      for (const def of DEFAULT_STRATEGY_CONFIG) {
        if (!this.cache.has(def.param_key)) {
          this.cache.set(def.param_key, {
            ...def,
            changed_by: 'system_init',
            changed_at: Date.now(),
            previous_value: def.param_value,
            version_number: 1,
          });
        }
      }
      this.saveToDisk();
      logger.info('Dynamic Strategy Config Store initialized with adaptive parameters');
    } catch (err) {
      logger.error({ err: err.message }, 'Failed initializing DynamicConfigStore');
    }
  }

  saveToDisk() {
    try {
      const payload = {
        configs: Array.from(this.cache.values()),
        history: this.history,
      };
      fs.writeFileSync(this.filePath, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err) {
      logger.error({ err: err.message }, 'Failed writing strategy_config to disk');
    }
  }

  get(paramKey, fallback = null) {
    const item = this.cache.get(paramKey);
    return item ? item.param_value : fallback;
  }

  getConfigItem(paramKey) {
    return this.cache.get(paramKey) || null;
  }

  getAll() {
    return Array.from(this.cache.values());
  }

  /**
   * Modify a parameter directly (by Human or approved AI)
   */
  set(paramKey, newValue, changedBy = 'human_dashboard', rationale = '') {
    const item = this.cache.get(paramKey);
    if (!item) {
      throw new Error(`Parameter '${paramKey}' not found in strategy_config.`);
    }

    const val = Number(newValue);
    if (isNaN(val)) {
      throw new Error(`Invalid numeric value: ${newValue}`);
    }

    // 1. Check AI Tunable Security Gate FIRST
    if (changedBy.startsWith('ai') && !item.is_ai_tunable) {
      throw new Error(`SECURITY ALERT: Parameter '${paramKey}' is a HARD RISK LIMIT and is NOT AI-tunable!`);
    }

    // 2. Enforce bounds
    if (item.min_bound !== null && val < item.min_bound) {
      throw new Error(`Value ${val} violates minimum safe bound of ${item.min_bound}`);
    }
    if (item.max_bound !== null && val > item.max_bound) {
      throw new Error(`Value ${val} violates maximum safe bound of ${item.max_bound}`);
    }

    const previousValue = item.param_value;
    item.param_value = val;
    item.previous_value = previousValue;
    item.changed_by = changedBy;
    item.changed_at = Date.now();
    item.version_number = (item.version_number || 1) + 1;

    this.cache.set(paramKey, item);

    // Record audit history
    this.history.push({
      id: `HIST-${Date.now()}`,
      param_key: paramKey,
      old_value: previousValue,
      new_value: val,
      changed_by: changedBy,
      rationale,
      timestamp: Date.now(),
    });

    this.saveToDisk();
    logger.info({ paramKey, previousValue, newValue: val, changedBy, version: item.version_number }, 'Strategy config updated');
    return item;
  }

  /**
   * AI Adaptive Proposal Generation
   */
  proposeTuning({ paramKey, proposedValue, rationale, patternContext = '' }) {
    const item = this.cache.get(paramKey);
    if (!item) throw new Error(`Unknown param: ${paramKey}`);

    if (!item.is_ai_tunable) {
      throw new Error(`Parameter ${paramKey} cannot be tuned by AI`);
    }

    // Clamp within bounds
    const clamped = Math.max(item.min_bound, Math.min(item.max_bound, Number(proposedValue)));
    const proposalId = `PROP-${Date.now()}`;

    const proposal = {
      id: proposalId,
      paramKey,
      currentValue: item.param_value,
      proposedValue: clamped,
      rationale,
      patternContext,
      status: 'PENDING',
      timestamp: Date.now(),
    };

    this.pendingProposals.set(proposalId, proposal);
    return proposal;
  }

  approveProposal(proposalId) {
    const prop = this.pendingProposals.get(proposalId);
    if (!prop) throw new Error('Proposal not found or expired');

    this.set(prop.paramKey, prop.proposedValue, 'ai_proposed_approved', prop.rationale);
    prop.status = 'APPROVED';
    this.pendingProposals.delete(proposalId);
    return prop;
  }

  rejectProposal(proposalId) {
    const prop = this.pendingProposals.get(proposalId);
    if (prop) {
      prop.status = 'REJECTED';
      this.pendingProposals.delete(proposalId);
    }
    return prop;
  }
}

module.exports = new DynamicConfigStore();
