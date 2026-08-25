const { SettingsRepo } = require('../database');
const logger = require('../utils/logger');

class CustomStrategyStore {
  /**
   * Get all user strategies and active strategy ID
   */
  static async getAllStrategies() {
    let list = await SettingsRepo.get('custom_strategies_list', null);
    let activeId = await SettingsRepo.get('active_strategy_id', null);

    if (!list || !Array.isArray(list) || list.length === 0) {
      const defaultUserStrategy = {
        id: 'strat_primary',
        title: 'Universal AI Trading Strategy',
        instructions: `# Universal Trading Strategy Directives
- Timeframe: 15m primary, 1h trend direction.
- Trigger: Look for 15m Bullish/Bearish Engulfing or Hammer at key support/resistance with RSI divergence.
- Session: London Open (07:00 - 10:00 UTC) and NY Open (12:00 - 15:00 UTC).
- Risk/Reward: Minimum 1:2.0. Stop loss beyond the trigger candle wick.`,
        enabled: true,
        executionMode: 'auto_execute', // 'auto_execute' | 'watch_only'
        compiledPlaybook: null,
        history: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      list = [defaultUserStrategy];
      activeId = defaultUserStrategy.id;
      await SettingsRepo.set('custom_strategies_list', list);
      await SettingsRepo.set('active_strategy_id', activeId);
    }

    if (!activeId || !list.some(s => s.id === activeId)) {
      activeId = list[0].id;
      await SettingsRepo.set('active_strategy_id', activeId);
    }

    return {
      strategies: list,
      activeId,
    };
  }

  /**
   * Get currently active strategy
   */
  static async getActiveStrategy() {
    const { strategies, activeId } = await this.getAllStrategies();
    return strategies.find(s => s.id === activeId) || strategies[0];
  }

  /**
   * Create new strategy
   */
  static async createStrategy({ title, instructions = '' }) {
    const { strategies } = await this.getAllStrategies();
    const newId = `strat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newStrategy = {
      id: newId,
      title: title || `Custom Strategy ${strategies.length + 1}`,
      instructions: instructions.trim() || '# Write your strategy here in plain English or Roman Urdu...',
      enabled: true,
      executionMode: 'auto_execute',
      compiledPlaybook: null,
      history: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    strategies.push(newStrategy);
    await SettingsRepo.set('custom_strategies_list', strategies);
    await SettingsRepo.set('active_strategy_id', newId);

    logger.info({ id: newId, title: newStrategy.title }, '✅ New Strategy created');
    return newStrategy;
  }

  /**
   * Update existing strategy
   */
  static async updateStrategy(id, updates = {}) {
    const { strategies } = await this.getAllStrategies();
    const idx = strategies.findIndex(s => s.id === id);
    if (idx === -1) throw new Error(`Strategy ${id} not found`);

    const strat = strategies[idx];
    if (updates.title) strat.title = updates.title;
    if (updates.instructions !== undefined) strat.instructions = updates.instructions;
    if (updates.enabled !== undefined) strat.enabled = !!updates.enabled;
    if (updates.executionMode !== undefined) strat.executionMode = updates.executionMode;
    if (updates.compiledPlaybook !== undefined) strat.compiledPlaybook = updates.compiledPlaybook;
    if (updates.history !== undefined) strat.history = updates.history;
    strat.updatedAt = new Date().toISOString();

    strategies[idx] = strat;
    await SettingsRepo.set('custom_strategies_list', strategies);
    logger.info({ id, title: strat.title }, '✅ Strategy updated in database');
    return strat;
  }

  /**
   * Confirm and Activate a Compiled Strategy Version (Saves to History)
   */
  static async confirmAndActivate(id, { instructions, compiledSpec, executionMode = 'auto_execute' }) {
    const { strategies } = await this.getAllStrategies();
    let strat = strategies.find(s => s.id === id) || strategies[0];

    const historyEntry = {
      version: (strat.history?.length || 0) + 1,
      timestamp: new Date().toISOString(),
      title: compiledSpec?.title || strat.title,
      instructions: instructions || strat.instructions,
      summary: compiledSpec?.summary || 'Compiled strategy version',
      assumptions: compiledSpec?.assumptions_made || [],
      defaults: compiledSpec?.defaults_used || [],
      compiledPlaybook: compiledSpec,
      executionMode,
    };

    const updatedHistory = [historyEntry, ...(strat.history || [])].slice(0, 15); // Keep last 15 versions

    strat.title = compiledSpec?.title || strat.title;
    strat.instructions = instructions || strat.instructions;
    strat.compiledPlaybook = compiledSpec;
    strat.executionMode = executionMode;
    strat.history = updatedHistory;
    strat.updatedAt = new Date().toISOString();

    await this.updateStrategy(strat.id, {
      title: strat.title,
      instructions: strat.instructions,
      compiledPlaybook: strat.compiledPlaybook,
      executionMode: strat.executionMode,
      history: updatedHistory,
    });

    await this.setActiveStrategy(strat.id);

    logger.info({ id: strat.id, version: historyEntry.version, title: strat.title }, '🟢 Strategy Confirmed & Activated');
    return {
      strategy: strat,
      activeVersion: historyEntry,
    };
  }

  /**
   * Rollback to a specific historical version
   */
  static async rollbackVersion(id, versionNumber) {
    const { strategies } = await this.getAllStrategies();
    const strat = strategies.find(s => s.id === id);
    if (!strat) throw new Error(`Strategy ${id} not found`);

    const targetVersion = (strat.history || []).find(h => h.version === Number(versionNumber));
    if (!targetVersion) throw new Error(`Version ${versionNumber} not found in history`);

    strat.title = targetVersion.title;
    strat.instructions = targetVersion.instructions;
    strat.compiledPlaybook = targetVersion.compiledPlaybook;
    strat.executionMode = targetVersion.executionMode || 'auto_execute';
    strat.updatedAt = new Date().toISOString();

    await this.updateStrategy(id, {
      title: strat.title,
      instructions: strat.instructions,
      compiledPlaybook: strat.compiledPlaybook,
      executionMode: strat.executionMode,
    });

    logger.info({ id, version: versionNumber }, '⏪ Strategy Rolled Back to Version');
    return strat;
  }

  /**
   * Delete strategy
   */
  static async deleteStrategy(id) {
    let { strategies, activeId } = await this.getAllStrategies();
    if (strategies.length <= 1) {
      throw new Error('Cannot delete the only remaining strategy');
    }

    strategies = strategies.filter(s => s.id !== id);
    if (activeId === id) {
      activeId = strategies[0].id;
      await SettingsRepo.set('active_strategy_id', activeId);
    }
    await SettingsRepo.set('custom_strategies_list', strategies);
    logger.info({ id, newActiveId: activeId }, '✅ Strategy deleted');
    return { strategies, activeId };
  }

  /**
   * Set active strategy
   */
  static async setActiveStrategy(id) {
    const { strategies } = await this.getAllStrategies();
    const found = strategies.find(s => s.id === id);
    if (!found) throw new Error(`Strategy with ID ${id} not found`);

    await SettingsRepo.set('active_strategy_id', id);
    logger.info({ id, title: found.title }, '🟢 Active 24/7 Strategy switched');
    return found;
  }
}

module.exports = CustomStrategyStore;
