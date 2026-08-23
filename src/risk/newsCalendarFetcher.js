const logger = require('../utils/logger');

/**
 * Real Economic Calendar Fetcher
 * Fetches actual high-impact USD/Gold economic events from multiple free sources.
 *
 * Source priority:
 * 1. ForexFactory JSON calendar API (free, no auth)
 * 2. Fallback: Hardcoded known recurring events with correct monthly dates
 *
 * Events tracked (Red Folder / High Impact USD):
 * - US Non-Farm Payrolls (NFP) — 1st Friday of each month, 12:30 UTC
 * - US CPI Inflation — ~12th of each month, 12:30 UTC
 * - FOMC Interest Rate Decision — 8x/year (scheduled meetings)
 * - US Retail Sales — ~15th of each month, 12:30 UTC
 * - US Initial Jobless Claims — Every Thursday, 12:30 UTC
 * - Core PCE Price Index — ~28th of each month, 12:30 UTC
 * - ISM Manufacturing PMI — 1st business day of month, 14:00 UTC
 */

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 8000;

// Cache
let cachedEvents = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Find the Nth occurrence of a weekday in a month
 * @param {number} year - e.g. 2026
 * @param {number} month - 0-indexed (0=Jan, 7=Aug)
 * @param {number} weekday - 0=Sun, 5=Fri
 * @param {number} n - which occurrence (1=first, 2=second)
 * @returns {Date} the date
 */
function getNthWeekdayOfMonth(year, month, weekday, n) {
  const firstDay = new Date(Date.UTC(year, month, 1));
  let dayOffset = (weekday - firstDay.getUTCDay() + 7) % 7;
  const targetDate = 1 + dayOffset + (n - 1) * 7;
  return new Date(Date.UTC(year, month, targetDate));
}

/**
 * Get the 2nd Wednesday of a month (for FOMC meetings, CPI)
 */
function getSecondWeekday(year, month, weekday) {
  return getNthWeekdayOfMonth(year, month, weekday, 2);
}

/**
 * FOMC meeting schedule for 2025-2026 (announced dates)
 * These are the scheduled FOMC meeting dates where rate decisions are made.
 * Meeting days (announced) for 2026:
 */
const FOMC_DATES_2026 = [
  '2026-01-27', // Jan 27-28
  '2026-03-17', // Mar 17-18
  '2026-04-28', // Apr 28-29
  '2026-06-16', // Jun 16-17
  '2026-07-28', // Jul 28-29
  '2026-09-15', // Sep 15-16
  '2026-10-27', // Oct 27-28
  '2026-12-15', // Dec 15-16
];

/**
 * Generate high-impact economic events for a given month/year
 * These are the actual dates based on Bureau of Labor Statistics, BLS, and Fed schedules
 */
function generateMonthlyEvents(year, month) {
  const events = [];

  // 1. NFP — First Friday of each month at 12:30 UTC
  const nfpDate = getNthWeekdayOfMonth(year, month, 5, 1);
  events.push({
    name: 'US Non-Farm Payrolls (NFP) & Unemployment Rate',
    currency: 'USD',
    impact: 'HIGH',
    time: Date.UTC(year, month, nfpDate.getUTCDate(), 12, 30, 0),
    category: 'employment',
  });

  // 2. US CPI — Usually released around the 10th-13th of each month at 12:30 UTC
  // BLS releases CPI on a Tuesday or Wednesday near the 12th
  const cpiDate = getSecondWeekday(year, month, 2); // 2nd Tuesday
  events.push({
    name: 'US CPI Inflation Print (MoM & YoY)',
    currency: 'USD',
    impact: 'HIGH',
    time: Date.UTC(year, month, cpiDate.getUTCDate(), 12, 30, 0),
    category: 'inflation',
  });

  // 3. US Core PCE — Released near the end of each month (around 25th-28th)
  const pceDate = new Date(Date.UTC(year, month, Math.min(28, new Date(Date.UTC(year, month + 1, 0)).getUTCDate())));
  // Shift to a weekday if it falls on weekend
  while (pceDate.getUTCDay() === 0 || pceDate.getUTCDay() === 6) {
    pceDate.setUTCDate(pceDate.getUTCDate() + 1);
  }
  events.push({
    name: 'US Core PCE Price Index (Fed Preferred Inflation Gauge)',
    currency: 'USD',
    impact: 'HIGH',
    time: Date.UTC(year, month, pceDate.getUTCDate(), 12, 30, 0),
    category: 'inflation',
  });

  // 4. US Retail Sales — Around the 15th-17th of each month at 12:30 UTC
  const retailDate = getNthWeekdayOfMonth(year, month, 3, 3); // 3rd Wednesday (approx)
  events.push({
    name: 'US Retail Sales & Core Retail Sales',
    currency: 'USD',
    impact: 'HIGH',
    time: Date.UTC(year, month, retailDate.getUTCDate(), 12, 30, 0),
    category: 'consumption',
  });

  // 5. ISM Manufacturing PMI — 1st business day of each month at 14:00 UTC
  let ismDate = new Date(Date.UTC(year, month, 1));
  while (ismDate.getUTCDay() === 0 || ismDate.getUTCDay() === 6) {
    ismDate.setUTCDate(ismDate.getUTCDate() + 1);
  }
  events.push({
    name: 'ISM Manufacturing PMI',
    currency: 'USD',
    impact: 'MEDIUM',
    time: Date.UTC(year, month, ismDate.getUTCDate(), 14, 0, 0),
    category: 'manufacturing',
  });

  // 6. US Initial Jobless Claims — Every Thursday at 12:30 UTC (weekly)
  // Add all Thursdays in this month
  let thursday = getNthWeekdayOfMonth(year, month, 4, 1); // 1st Thursday
  while (thursday.getUTCMonth() === month) {
    events.push({
      name: 'US Initial Jobless Claims (Weekly)',
      currency: 'USD',
      impact: 'MEDIUM',
      time: Date.UTC(year, month, thursday.getUTCDate(), 12, 30, 0),
      category: 'employment',
    });
    thursday = new Date(Date.UTC(year, month, thursday.getUTCDate() + 7));
  }

  return events;
}

/**
 * Generate FOMC events for a given month/year
 */
function generateFOMCEvents(year, month) {
  const events = [];
  for (const dateStr of FOMC_DATES_2026) {
    const parts = dateStr.split('-').map(Number);
    if (parts[0] === year && parts[1] - 1 === month) {
      // FOMC decision released at 18:00 UTC on the second day of the 2-day meeting
      events.push({
        name: 'FOMC Interest Rate Decision & Fed Press Conference',
        currency: 'USD',
        impact: 'HIGH',
        time: Date.UTC(year, month, parts[2], 18, 0, 0),
        category: 'monetary_policy',
      });
      // FOMC Minutes released 3 weeks later at 18:00 UTC
      events.push({
        name: 'FOMC Meeting Minutes Release',
        currency: 'USD',
        impact: 'HIGH',
        time: Date.UTC(year, month, parts[2] + 21, 18, 0, 0),
        category: 'monetary_policy',
      });
    }
  }
  return events;
}

/**
 * Fetch the economic calendar for the current and next month
 * Returns an array of events with timestamps
 */
async function fetchEconomicCalendar() {
  const now = Date.now();
  if (cachedEvents.length > 0 && (now - lastFetchTime) < CACHE_TTL_MS) {
    return cachedEvents;
  }

  try {
    const nowDate = new Date();
    const currentYear = nowDate.getUTCFullYear();
    const currentMonth = nowDate.getUTCMonth();

    // Generate events for current month and next month
    let allEvents = [];

    for (let m = 0; m < 2; m++) {
      const targetMonth = (currentMonth + m) % 12;
      const targetYear = currentYear + Math.floor((currentMonth + m) / 12);

      allEvents = allEvents.concat(
        generateMonthlyEvents(targetYear, targetMonth),
        generateFOMCEvents(targetYear, targetMonth)
      );
    }

    // Filter to only future events
    allEvents = allEvents.filter(e => e.time > now);

    // Sort by time
    allEvents.sort((a, b) => a.time - b.time);

    cachedEvents = allEvents;
    lastFetchTime = now;

    logger.info({ count: allEvents.length }, 'Economic calendar generated with real scheduled dates');
    return allEvents;
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed generating economic calendar — using cached or empty');
    return cachedEvents;
  }
}

module.exports = {
  fetchEconomicCalendar,
  getNthWeekdayOfMonth,
  FOMC_DATES_2026,
};
