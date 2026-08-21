const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Smart Price Action Zone & Liquidity Trigger Engine (SMC/ICT Price-Activated Re-Analysis)
 *
 * How it works:
 * 1. AI or SMC engine detects key zones: Order Blocks, FVGs, Liquidity Sweeps, Key Levels.
 * 2. Zones are registered as "Smart Watch Targets" with price boundaries [minPrice, maxPrice].
 * 3. Ticks are checked locally in 0ms (ZERO AI Token Cost).
 * 4. When price enters a watched zone, it triggers an instant Deep-Thinking Re-Analysis event!
 * 5. Prevents duplicate triggers: Once a zone triggers or is invalidated, it is marked as TRIGGERED/EXPIRED.
 */

class SmartPriceTriggerEngine {
  constructor() {
    this.zones = new Map(); // zoneId -> Zone Object
    this.filePath = path.join(process.cwd(), 'data', 'price_trigger_zones.json');
    this.lastTriggeredPrices = new Map(); // zoneKey -> lastTriggerTimestamp
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.zones)) {
          for (const z of data.zones) {
            if (z.status === 'ACTIVE') {
              this.zones.set(z.id, z);
            }
          }
        }
      }
      logger.info({ activeZones: this.zones.size }, 'SmartPriceTriggerEngine loaded active watchlist zones');
    } catch (err) {
      logger.error({ err: err.message }, 'Failed loading price trigger zones from disk');
    }
  }

  saveToDisk() {
    try {
      const payload = {
        zones: Array.from(this.zones.values()),
        updatedAt: Date.now(),
      };
      fs.writeFileSync(this.filePath, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err) {
      logger.error({ err: err.message }, 'Failed saving price trigger zones to disk');
    }
  }

  /**
   * Register a new Smart Price Watch Zone from an AI analysis or SMC calculation
   */
  registerZone({
    symbol = 'XAUUSD',
    type = 'ORDER_BLOCK', // 'ORDER_BLOCK' | 'FVG' | 'LIQUIDITY_SWEEP' | 'KEY_LEVEL' | 'LIMIT_ORDER_APPROACH'
    timeframe = '15m',
    bias = 'BULLISH', // 'BULLISH' | 'BEARISH'
    minPrice,
    maxPrice,
    referencePrice,
    description = '',
    expiryMs = 24 * 60 * 60 * 1000, // 24 hours default expiry
    cooldownMs = 30 * 60 * 1000, // 30 minutes cooldown before same level can re-trigger
  }) {
    // Avoid duplicate registration of near-identical active zones
    const zoneKey = `${symbol}_${type}_${bias}_${minPrice.toFixed(1)}_${maxPrice.toFixed(1)}`;
    for (const [id, existing] of this.zones.entries()) {
      if (existing.key === zoneKey && existing.status === 'ACTIVE') {
        logger.debug({ zoneKey }, 'Zone already actively monitored, skipping duplicate');
        return existing;
      }
    }

    const zoneId = `ZONE_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const zone = {
      id: zoneId,
      key: zoneKey,
      symbol,
      type,
      timeframe,
      bias,
      minPrice: Math.min(minPrice, maxPrice),
      maxPrice: Math.max(minPrice, maxPrice),
      referencePrice,
      description,
      status: 'ACTIVE', // 'ACTIVE', 'TRIGGERED', 'EXPIRED'
      createdAt: Date.now(),
      expiresAt: Date.now() + expiryMs,
      cooldownMs,
    };

    this.zones.set(zoneId, zone);
    this.saveToDisk();
    logger.info({ zoneId, type, bias, minPrice: zone.minPrice, maxPrice: zone.maxPrice }, 'Registered new Smart Price Watch Zone');
    return zone;
  }

  /**
   * Automatically extract and register zones from an SMC/ICT multi-timeframe analysis
   */
  registerFromAnalysis({ symbol = 'XAUUSD', smcData, ictData, currentPrice }) {
    if (!smcData && !ictData) return [];
    const registered = [];

    // 1. Register Active Order Blocks
    if (smcData?.orderBlocks && Array.isArray(smcData.orderBlocks)) {
      for (const ob of smcData.orderBlocks) {
        if (ob.unmitigated) {
          const z = this.registerZone({
            symbol,
            type: 'ORDER_BLOCK',
            timeframe: ob.timeframe || '15m',
            bias: ob.type === 'BULLISH' ? 'BULLISH' : 'BEARISH',
            minPrice: ob.low,
            maxPrice: ob.high,
            referencePrice: currentPrice,
            description: `Unmitigated ${ob.type} Order Block detected on ${ob.timeframe || '15m'}`,
          });
          if (z) registered.push(z);
        }
      }
    }

    // 2. Register Fair Value Gaps (FVG)
    if (smcData?.fvg && Array.isArray(smcData.fvg)) {
      for (const fvg of smcData.fvg) {
        if (!fvg.filled) {
          const z = this.registerZone({
            symbol,
            type: 'FVG',
            timeframe: fvg.timeframe || '15m',
            bias: fvg.type === 'BULLISH' ? 'BULLISH' : 'BEARISH',
            minPrice: fvg.bottom,
            maxPrice: fvg.top,
            referencePrice: currentPrice,
            description: `Open ${fvg.type} FVG (Imbalance Zone) on ${fvg.timeframe || '15m'}`,
          });
          if (z) registered.push(z);
        }
      }
    }

    // 3. Register Liquidity Pools (Equal Highs / Equal Lows)
    if (smcData?.liquidity && Array.isArray(smcData.liquidity)) {
      for (const liq of smcData.liquidity) {
        const buffer = 0.50; // $0.50 price zone buffer
        const z = this.registerZone({
          symbol,
          type: 'LIQUIDITY_SWEEP',
          timeframe: '15m',
          bias: liq.type === 'BUY_SIDE' ? 'BEARISH' : 'BULLISH',
          minPrice: liq.level - buffer,
          maxPrice: liq.level + buffer,
          referencePrice: currentPrice,
          description: `${liq.type} Liquidity Pool at $${liq.level.toFixed(2)}`,
        });
        if (z) registered.push(z);
      }
    }

    return registered;
  }

  /**
   * Evaluates incoming live price ticks against active watch zones (0ms, 0 tokens)
   * Returns triggered zones if price enters an active zone
   */
  evaluatePriceTick({ symbol = 'XAUUSD', currentPrice }) {
    const triggeredZones = [];
    const now = Date.now();

    for (const [id, zone] of this.zones.entries()) {
      if (zone.symbol !== symbol || zone.status !== 'ACTIVE') continue;

      // Check expiry
      if (now > zone.expiresAt) {
        zone.status = 'EXPIRED';
        continue;
      }

      // Check price entry into zone
      const isInZone = currentPrice >= zone.minPrice && currentPrice <= zone.maxPrice;

      if (isInZone) {
        const lastTrigger = this.lastTriggeredPrices.get(zone.key) || 0;
        const timeSinceLast = now - lastTrigger;

        if (timeSinceLast >= zone.cooldownMs) {
          zone.status = 'TRIGGERED';
          zone.triggeredAt = now;
          zone.triggeredPrice = currentPrice;
          this.lastTriggeredPrices.set(zone.key, now);
          triggeredZones.push(zone);
          logger.info({ zoneId: zone.id, type: zone.type, price: currentPrice, desc: zone.description }, '🎯 SMART PRICE ZONE TRIGGERED!');
        }
      }
    }

    if (triggeredZones.length > 0) {
      this.saveToDisk();
    }

    return triggeredZones;
  }

  getActiveZones() {
    return Array.from(this.zones.values()).filter(z => z.status === 'ACTIVE');
  }

  clearZone(zoneId) {
    if (this.zones.has(zoneId)) {
      this.zones.delete(zoneId);
      this.saveToDisk();
    }
  }
}

module.exports = new SmartPriceTriggerEngine();
