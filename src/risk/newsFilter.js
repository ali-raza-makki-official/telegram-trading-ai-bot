const logger = require('../utils/logger');
const { fetchEconomicCalendar } = require('./newsCalendarFetcher');

/**
 * Economic High-Impact News Blackout Engine
 * Tracks Red-Folder USD/Gold economic events (CPI, NFP, FOMC, Fed Rate Decisions).
 * Auto-pauses trading 30 minutes before high-impact news and resumes 15 minutes after.
 *
 * FIX #18: Calendar now uses REAL scheduled dates from BLS, Fed, and economic data releases
 * instead of hardcoded weekly recurring events that miss the actual dates.
 */
class NewsFilter {
  constructor() {
    this.blackoutBufferBeforeMinutes = 30;
    this.blackoutBufferAfterMinutes = 15;
    this.cachedEvents = [];
    this.lastFetched = 0;
    this.refreshTimer = null;
    this.startDailyRefresh();
  }

  // FIX #18: Start async fetch of real calendar, then refresh daily
  startDailyRefresh() {
    // Initial fetch (async, non-blocking)
    this._refreshCalendar();

    // Refresh every 12 hours
    this.refreshTimer = setInterval(() => {
      logger.info('Refreshing economic calendar (scheduled refresh)...');
      this._refreshCalendar();
    }, 12 * 60 * 60 * 1000);

    // Also schedule a refresh at the next midnight UTC
    const now = new Date();
    const midnight = new Date(now);
    midnight.setUTCHours(0, 0, 0, 0);
    midnight.setUTCDate(midnight.getUTCDate() + 1);
    const msToMidnight = midnight.getTime() - now.getTime();

    setTimeout(() => {
      logger.info('Midnight UTC: refreshing economic calendar...');
      this._refreshCalendar();
    }, msToMidnight);
  }

  async _refreshCalendar() {
    try {
      const events = await fetchEconomicCalendar();
      if (events && events.length > 0) {
        this.cachedEvents = events;
        this.lastFetched = Date.now();
        logger.info({ count: events.length }, 'News calendar refreshed with real scheduled events');
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed refreshing economic calendar');
    }
  }

  // Check if trading is currently in a news blackout window
  // FIX #18: Uses real event timestamps instead of hardcoded weekly recurrence
  isNewsBlackoutActive(timestamp = Date.now()) {
    // Auto-refresh if calendar is older than 25 hours (safety net)
    if (timestamp - this.lastFetched > 25 * 60 * 60 * 1000) {
      logger.warn('News calendar stale (>25h) — force refreshing...');
      this._refreshCalendar();
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
      nextEvent: upcoming ? upcoming.name : 'None scheduled',
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
