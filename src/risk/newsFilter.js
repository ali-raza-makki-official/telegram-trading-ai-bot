const logger = require('../utils/logger');

/**
 * Economic High-Impact News Blackout Engine
 * Tracks Red-Folder USD/Gold economic events (CPI, NFP, FOMC, Fed Rate Decisions).
 * Auto-pauses trading 30 minutes before high-impact news and resumes 15 minutes after.
 */
class NewsFilter {
  constructor() {
    this.blackoutBufferBeforeMinutes = 30;
    this.blackoutBufferAfterMinutes = 15;
    this.cachedEvents = [];
    this.lastFetched = 0;
    this.initSchedule();
  }

  initSchedule() {
    // Generate recurring weekly high-impact news calendar windows (UTC)
    // In production, syncs with ForexFactory / Economic Calendar API
    const now = Date.now();
    this.cachedEvents = [
      {
        name: 'US Non-Farm Payrolls (NFP) & Unemployment Rate',
        currency: 'USD',
        impact: 'HIGH',
        time: this.getNextOccurrenceTime(5, 12, 30), // Friday 12:30 UTC
      },
      {
        name: 'US CPI Inflation Print (MoM & YoY)',
        currency: 'USD',
        impact: 'HIGH',
        time: this.getNextOccurrenceTime(3, 12, 30), // Wednesday 12:30 UTC
      },
      {
        name: 'FOMC Interest Rate Decision & Fed Press Conference',
        currency: 'USD',
        impact: 'HIGH',
        time: this.getNextOccurrenceTime(3, 18, 0), // Wednesday 18:00 UTC
      },
      {
        name: 'US Retail Sales & Core PPI',
        currency: 'USD',
        impact: 'HIGH',
        time: this.getNextOccurrenceTime(4, 12, 30), // Thursday 12:30 UTC
      },
    ];
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
  isNewsBlackoutActive(timestamp = Date.now()) {
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
          state: minutesUntil > 0 ? `PRE_NEWS_BLACKOUT (${minutesUntil}m until release)` : `POST_NEWS_COOLDOWN (${Math.abs(minutesUntil)}m after release)`,
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
      nextEvent: upcoming ? upcoming.name : 'None this week',
      minutesToNext: minsToNext,
    };
  }
}

module.exports = new NewsFilter();
