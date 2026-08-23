const logger = require('../utils/logger');

/**
 * Real-Time Correlated Market Data Fetcher
 * Fetches live DXY, Silver, US 10Y Yield, and AUD/USD from Yahoo Finance free v8 chart API.
 *
 * Yahoo Finance ticker mapping:
 *   DXY    → DX-Y.NYB  (US Dollar Index)
 *   XAGUSD → SI=F       (Silver Futures)
 *   US10Y  → ^TNX       (CBOE 10-Year Treasury Yield)
 *   AUDUSD → AUDUSD=X   (AUD/USD spot)
 *
 * API: query2.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=1d
 * Returns: regularMarketPrice, chartPreviousClose, regularMarketDayHigh/Low
 *
 * Graceful fallback: if the API is unreachable, returns cached data or null.
 * No external dependencies required — uses Node.js built-in fetch.
 */

const YAHOO_TICKERS = {
  DXY:    'DX-Y.NYB',
  XAGUSD: 'SI=F',
  US10Y:  '^TNX',
  AUDUSD: 'AUDUSD=X',
};

const YAHOO_CHART_URL = 'https://query2.finance.yahoo.com/v8/finance/chart';
const FETCH_TIMEOUT_MS = 10000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Simple in-memory cache to avoid hammering the API
let cachedData = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

/**
 * Fetch a single ticker from Yahoo Finance v8 chart API
 */
async function fetchTickerQuote(ticker) {
  const url = `${YAHOO_CHART_URL}/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error('No chart result');

    const meta = result.meta || {};
    const price = meta.regularMarketPrice || 0;
    const prevClose = meta.chartPreviousClose || 0;

    // Calculate change from previous close
    const change = prevClose ? Number((price - prevClose).toFixed(4)) : 0;
    const changePercent = prevClose ? Number(((change / prevClose) * 100).toFixed(2)) : 0;

    return {
      price,
      change,
      changePercent,
      dayHigh: meta.regularMarketDayHigh || price,
      dayLow: meta.regularMarketDayLow || price,
      previousClose: prevClose,
      currency: meta.currency || 'USD',
      marketTime: meta.regularMarketTime || 0,
    };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Fetch real-time correlated market data from Yahoo Finance.
 * Returns the same shape as the old simulated data:
 * {
 *   DXY:    { price, change, changePercent, bias },
 *   XAGUSD: { price, change, changePercent, bias },
 *   US10Y:  { price, change, changePercent, bias },
 *   AUDUSD: { price, change, changePercent, bias },
 * }
 */
async function fetchCorrelatedData() {
  // Return cached data if fresh enough
  const now = Date.now();
  if (cachedData && (now - lastFetchTime) < CACHE_TTL_MS) {
    return cachedData;
  }

  const result = {};
  const fetchPromises = [];

  for (const [key, ticker] of Object.entries(YAHOO_TICKERS)) {
    fetchPromises.push(
      fetchTickerQuote(ticker)
        .then(data => {
          const threshold = getBiasThreshold(key);
          let bias = 'NEUTRAL';
          if (data.changePercent > threshold) {
            bias = 'BULLISH';
          } else if (data.changePercent < -threshold) {
            bias = 'BEARISH';
          }

          result[key] = {
            price: Number(data.price.toFixed(getDecimals(key))),
            change: Number(data.change.toFixed(getDecimals(key))),
            changePercent: data.changePercent,
            bias,
            source: 'yahoo_finance',
            fetchedAt: now,
          };
        })
        .catch(err => {
          logger.warn({ err: err.message, ticker, key }, `Failed fetching ${key} from Yahoo Finance`);
          // No simulated fallback — use cached real data only, or null
          result[key] = cachedData?.[key] || null;
        })
    );
  }

  await Promise.all(fetchPromises);

  // Check if we got at least some data
  const validKeys = Object.keys(result).filter(k => result[k] !== null);
  if (validKeys.length === 0) {
    logger.warn('All Yahoo Finance fetches failed — no correlated data available (no simulated fallback)');
    return null;
  }

  // Fill any missing keys with cached real data only — no simulated data
  for (const key of Object.keys(YAHOO_TICKERS)) {
    if (!result[key]) {
      result[key] = cachedData?.[key] || null;
    }
  }

  // If any key is still null, return null instead of partial simulated data
  const anyNull = Object.keys(result).some(k => result[k] === null);
  if (anyNull) {
    logger.warn('Partial data available — returning null to avoid mixed real/simulated data');
    return cachedData || null;
  }

  cachedData = result;
  lastFetchTime = now;

  logger.info({
    DXY: result.DXY?.price,
    XAGUSD: result.XAGUSD?.price,
    US10Y: result.US10Y?.price,
    AUDUSD: result.AUDUSD?.price,
    source: 'yahoo_finance',
  }, 'Real correlated market data fetched successfully');

  return result;
}

/**
 * Bias sensitivity threshold per asset (in percent change)
 * DXY moves less than individual currencies, so threshold is lower
 */
function getBiasThreshold(key) {
  switch (key) {
    case 'DXY':    return 0.08;  // DXY typically moves 0.1-0.3% daily
    case 'XAGUSD': return 0.30;  // Silver is volatile
    case 'US10Y':  return 0.05;  // Yields move in small increments
    case 'AUDUSD': return 0.15;  // FX pairs move ~0.1-0.3%
    default:       return 0.10;
  }
}

/**
 * Decimal precision per asset
 */
function getDecimals(key) {
  switch (key) {
    case 'DXY':    return 2;
    case 'XAGUSD': return 2;
    case 'US10Y':  return 4;
    case 'AUDUSD': return 4;
    default:       return 2;
  }
}

module.exports = {
  fetchCorrelatedData,
  YAHOO_TICKERS,
};
