const cron = require('node-cron');
const EventEmitter = require('events');
const { getCurrentSessionInfo } = require('../strategies/ict/killzones');
const config = require('../config');
const logger = require('../utils/logger');

class MarketScheduler extends EventEmitter {
  constructor() {
    super();
    this.jobs = [];
    this.lastSessionState = null;
    this.lastKzTime = 0; // FIX #22: Initialize to 0 so first killzone event is not missed
  }

  start() {
    logger.info('Starting Market Session and Candle Close Scheduler...');

    // 1. 15-Minute Candle Close Trigger (Primary Trigger)
    const m15Job = cron.schedule('*/15 * * * *', () => {
      this.emit('candleClose', { timeframe: '15m', timestamp: Date.now() });
    });
    this.jobs.push(m15Job);

    // 3. 1-Hour Candle Close Trigger
    const h1Job = cron.schedule('0 * * * *', () => {
      this.emit('candleClose', { timeframe: '1h', timestamp: Date.now() });
    });
    this.jobs.push(h1Job);

    // 4. 4-Hour Candle Close Trigger
    const h4Job = cron.schedule('0 */4 * * *', () => {
      this.emit('candleClose', { timeframe: '4h', timestamp: Date.now() });
    });
    this.jobs.push(h4Job);

    // 5. Session State & Killzone Transition Monitor (Every minute)
    const sessionJob = cron.schedule('* * * * *', () => {
      this.checkSessionTransitions();
    });
    this.jobs.push(sessionJob);

    logger.info('Scheduler started with 15m, 5m, 1h, 4h candle close jobs and 1m session monitor');
  }

  checkSessionTransitions() {
    const sessionInfo = getCurrentSessionInfo();

    // Check Killzone Transition with 30-minute debounce
    const currentKz = sessionInfo.activeKillzone ? sessionInfo.activeKillzone.key : null;
    const now = Date.now();
    if (currentKz && this.lastSessionState !== currentKz && (!this.lastKzTime || now - this.lastKzTime > 30 * 60 * 1000)) {
      this.lastSessionState = currentKz;
      this.lastKzTime = now;
      logger.info({ killzone: sessionInfo.activeKillzone.name }, 'Entered ICT Killzone');
      this.emit('killzoneEnter', sessionInfo.activeKillzone);
    } else if (!currentKz) {
      this.lastSessionState = null;
    }

    // Check Friday Close Warning
    if (sessionInfo.dayOfWeek === 5 && sessionInfo.minutesToFridayClose !== null) {
      if (sessionInfo.minutesToFridayClose === config.risk.fridayCloseBufferMinutes) {
        this.emit('fridayCloseWarning', {
          minutesRemaining: sessionInfo.minutesToFridayClose,
          message: `⚠️ Warning: Approaching Friday market close (${sessionInfo.minutesToFridayClose} minutes remaining). New entries will be frozen to avoid weekend gap risk.`,
        });
      }
    }

    // Check Weekend State
    this.emit('sessionTick', sessionInfo);
  }

  stop() {
    for (const job of this.jobs) {
      job.stop();
    }
    this.jobs = [];
    logger.info('Market Scheduler stopped');
  }
}

module.exports = new MarketScheduler();
