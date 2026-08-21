const logger = require('../utils/logger');

/**
 * Economic High-Impact News Blackout Engine
 * Tracks Red-Folder USD/Gold economic events (CPI, NFP, FOMC, Fed Rate Decisions).
 * Auto-pauses trading 30 minutes before high-impact news and resumes 15 minutes after.
 *
 * FIX #2: Calendar now refreshes daily at midnight UTC so events never go stale.
 */
class NewsFilter {
  constructor() {
    this.blackoutBufferBeforeMinutes = 30;
    this.blackoutBufferAfterMinutes = 15;
    this.cachedEvents = [];
    this.lastFetched = 0;
    this.refreshTimer = null;
    this.initSchedule();
    this.startDailyRefresh();
  }

  // Define the recurring weekly events template
  _getEventTemplates() {
    return [
      {
        name: 'US Non-Farm Payrolls (NFP) & Unemployment Rate',
        currency: 'USD',
        impact: 'HIGH',
        dayOfWeek: 5, // Friday
        hour: 12,
        minute: 30,
      },
      {
        name: 'US CPI Inflation Print (MoM & YoY)',
        currency: 'USD',
        impact: 'HIGH',
        dayOfWeek: 3, // Wednesday
        hour: 12,
        minute: 30,
      },
      {
        name: 'FOMC Interest Rate Decision & Fed Press Conference',
        currency: 'USD',
        impact: 'HIGH',
        dayOfWeek: 3, // Wednesday
        hour: 18,
        minute: 0,
      },
      {
        name: 'US Retail Sales & Core PPI',
        currency: 'USD',
        impact: 'HIGH',
        dayOfWeek: 4, // Thursday
        hour: 12,
        minute: 30,
      },
      {
        name: 'US Initial Jobless Claims',
        currency: 'USD',
        impact: 'MEDIUM',
        dayOfWeek: 4, // Thursday
        hour: 12,
        minute: 30,
      },
      {
        name: 'Fed Chair Powell Speech / FOMC Minutes',
        currency: 'USD',
        impact: 'HIGH',
        dayOfWeek: 3, // Wednesday
        hour: 19,
        minute: 0,
      },
    ];
  }

  // FIX #2: Recalculate all event times from current date
  initSchedule() {
    const templates = this._getEventTemplates();
    this.cachedEvents = templates.map(t => ({
      name: t.name,
      currency: t.currency,
      impact: t.impact,
      time: this.getNextOccurrenceTime(t.dayOfWeek, t.hour, t.minute),
    }));
    this.lastFetched = Date.now();
    logger.debug({ count: this.cachedEvents.length }, 'News calendar refreshed');
  }

  // FIX #2: Start daily refresh at midnight UTC to keep calendar current
  startDailyRefresh() {
    // Refresh every 24 hours
    this.refreshTimer = setInterval(() => {
      logger.info('Refreshing news event calendar (daily refresh)...');
      this.initSchedule();
    }, 24 * 60 * 60 * 1000);

    // Also schedule a refresh at the next midnight UTC
    const now = new Date();
    const midnight = new Date(now);
    midnight.setUTCHours(0, 0, 0, 0);
    midnight.setUTCDate(midnight.getUTCDate() + 1);
    const msToMidnight = midnight.getTime() - now.getTime();

    setTimeout(() => {
      logger.info('Midnight UTC: refreshing news event calendar...');
      this.initSchedule();
    }, msToMidnight);
  }

  getNextOccurrenceTime(targetDayOfWeek, targetHour, targetMinute) {
    const now = new Date();
    const result = new Date(now);
    result.setUTCHours(targetHour, targetMinute, 0, 0);

    const currentDay = now.getUTCDay();
    let distance = (targetDayOfWeek + 7 - currentDay) % 7;
    if (distance === 0 && now.getTime() > result.getTime()) {
      distance = 7;
    }
    result.setUTCDate(now.getUTCDate() + distance);
    return result.getTime();
  }

  // Check if trading is currently in a news blackout window
  // FIX #2: Also checks if cached events are stale (> 25 hours) and refreshes
  isNewsBlackoutActive(timestamp = Date.now()) {
    // Auto-refresh if calendar is older than 25 hours (safety net)
    if (timestamp - this.lastFetched > 25 * 60 * 60 * 1000) {
      logger.warn('News calendar stale (>25h) — force refreshing...');
      this.initSchedule();
    }

    for (const event of this.cachedEvents) {
      const beforeWindow = event.time - this.blackoutBufferBeforeMinutes * 60 * 1000;
      const afterWindow = event.time + this.blackoutBufferAfterMinutes * 60 * 1000;

      if (timestamp >= beforeWindow && timestamp <= afterWindow) {
        const minutesUntil = Math.round((event.time - timestamp) / 60000);
        return {
          isBlackout: true,
          event: event.name,
          impact: event.impact,
          minutesUntil,
          state: minutesUntil > 0
            ? `PRE_NEWS_BLACKOUT (${minutesUntil}m until release)`
            : `POST_NEWS_COOLDOWN (${Math.abs(minutesUntil)}m after release)`,
        };
      }
    }

    // Find next upcoming high-impact event
    const upcoming = this.cachedEvents
      .filter(e => e.time > timestamp)
      .sort((a, b) => a.time - b.time)[0];

    const minsToNext = upcoming ? Math.round((upcoming.time - timestamp) / 60000) : null;

    return {
      isBlackout: false,
      nextEvent: upcoming ? upcoming.name : 'None scheduled this week',
      minutesToNext: minsToNext,
    };
  }

  // Get all upcoming events for display
  getUpcomingEvents(limit = 5) {
    const now = Date.now();
    return this.cachedEvents
      .filter(e => e.time > now)
      .sort((a, b) => a.time - b.time)
      .slice(0, limit)
      .map(e => ({
        name: e.name,
        impact: e.impact,
        time: new Date(e.time).toISOString(),
        minutesUntil: Math.round((e.time - now) / 60000),
      }));
  }

  destroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

module.exports = new NewsFilter();

