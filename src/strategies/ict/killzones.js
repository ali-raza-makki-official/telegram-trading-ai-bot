/**
 * ICT Killzones & Trading Sessions (UTC)
 */

function getCurrentSessionInfo(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // Killzone definitions in UTC minutes
  const KILLZONES = {
    ASIAN_RANGE: { start: 0 * 60, end: 6 * 60, name: 'Asian Range' },
    LONDON_OPEN: { start: 7 * 60, end: 10 * 60, name: 'London Open Killzone' },
    NY_OPEN: { start: 12 * 60, end: 15 * 60, name: 'New York Open Killzone' },
    LONDON_CLOSE: { start: 15 * 60, end: 17 * 60, name: 'London Close Killzone' },
    // Silver Bullet Windows
    LONDON_SILVER_BULLET: { start: 3 * 60, end: 4 * 60, name: 'London Silver Bullet' },
    NY_AM_SILVER_BULLET: { start: 14 * 60, end: 15 * 60, name: 'NY AM Silver Bullet (10-11 AM EST)' },
    NY_PM_SILVER_BULLET: { start: 18 * 60, end: 19 * 60, name: 'NY PM Silver Bullet (2-3 PM EST)' },
  };

  let activeKillzone = null;
  const activeWindows = [];

  for (const [key, kz] of Object.entries(KILLZONES)) {
    if (timeInMinutes >= kz.start && timeInMinutes <= kz.end) {
      activeWindows.push({ key, name: kz.name });
      if (!activeKillzone && !key.includes('SILVER_BULLET')) {
        activeKillzone = { key, name: kz.name };
      }
    }
  }

  // Major market session
  let marketSession = 'OFF_HOURS';
  if (hours >= 0 && hours < 8) marketSession = 'ASIAN';
  else if (hours >= 8 && hours < 13) marketSession = 'LONDON';
  else if (hours >= 13 && hours < 17) marketSession = 'LONDON_NY_OVERLAP';
  else if (hours >= 17 && hours < 22) marketSession = 'NEW_YORK';

  // Day of week (0 = Sunday, 5 = Friday)
  const dayOfWeek = date.getUTCDay();
  const isWeekend = dayOfWeek === 6 || (dayOfWeek === 0 && hours < 22) || (dayOfWeek === 5 && hours >= 21);

  // Minutes until Friday 21:00 UTC Close
  let minutesToFridayClose = null;
  if (dayOfWeek === 5) {
    const closeMin = 21 * 60;
    minutesToFridayClose = Math.max(0, closeMin - timeInMinutes);
  }

  return {
    utcTime: date.toISOString().replace('T', ' ').substring(0, 19),
    hours,
    minutes,
    dayOfWeek,
    isWeekend,
    marketSession,
    activeKillzone,
    activeWindows,
    isKillzoneActive: activeWindows.length > 0,
    minutesToFridayClose,
  };
}

module.exports = {
  getCurrentSessionInfo,
};
