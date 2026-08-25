# 📦 trading-core

**Strategy-Agnostic Quantitative Trading Engine**

A pure JavaScript / Node.js library containing mathematical calculations, technical indicators, candlestick pattern recognition, position sizing, and guardrail validation.

- ✅ **100% Pure Functions**: No side-effects, no database calls, no network requests.
- ✅ **Zero Platform Dependencies**: Independent of Telegram, MetaApi, MT5, or LLM providers.
- ✅ **Deterministic & Fast**: Sub-millisecond execution for real-time tick-by-tick and candle-close processing.

---

## 🚀 Installation

### Option A: Local File Dependency (Recommended for Monorepos & Two-Repo setups)
In your target project (`package.json`):
```json
{
  "dependencies": {
    "trading-core": "file:../packages/trading-core"
  }
}
```

### Option B: npm workspaces
In root `package.json`:
```json
{
  "workspaces": [
    "packages/*"
  ]
}
```

---

## 📚 API Reference

### 1. Technical Indicators (`trading-core/indicators` or root)

```javascript
const {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateStochasticRSI,
  calculateATR,
  calculateMACD,
  calculateBollingerBands,
  calculateVWAP,
  calculateFibonacciLevels,
  computeAllIndicators
} = require('trading-core');
```

#### `calculateSMA(values, period)`
* **Params**: `values: number[]`, `period: number`
* **Returns**: `(number | null)[]`

#### `calculateEMA(values, period)`
* **Params**: `values: number[]`, `period: number`
* **Returns**: `(number | null)[]`

#### `calculateRSI(closes, period = 14)`
* **Params**: `closes: number[]`, `period?: number`
* **Returns**: `(number | null)[]` (0 to 100)

#### `calculateStochasticRSI(closes, rsiPeriod = 14, stochPeriod = 14, kSmooth = 3, dSmooth = 3)`
* **Params**: `closes: number[]`, `rsiPeriod?: number`, `stochPeriod?: number`, `kSmooth?: number`, `dSmooth?: number`
* **Returns**: `{ k: (number | null)[], d: (number | null)[] }`

#### `calculateATR(candles, period = 14)`
* **Params**: `candles: { open, high, low, close }[]`, `period?: number`
* **Returns**: `(number | null)[]`

#### `calculateMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9)`
* **Params**: `closes: number[]`, `fastPeriod?: number`, `slowPeriod?: number`, `signalPeriod?: number`
* **Returns**: `{ macd: (number | null)[], signal: (number | null)[], histogram: (number | null)[] }`

#### `calculateBollingerBands(closes, period = 20, stdDevMultiplier = 2)`
* **Params**: `closes: number[]`, `period?: number`, `stdDevMultiplier?: number`
* **Returns**: `{ upper: (number | null)[], middle: (number | null)[], lower: (number | null)[] }`

#### `calculateVWAP(candles)`
* **Params**: `candles: { high, low, close, volume }[]`
* **Returns**: `number[]`

#### `calculateFibonacciLevels(high, low, isUptrend = true)`
* **Params**: `high: number`, `low: number`, `isUptrend?: boolean`
* **Returns**: `{ '0.0': number, '0.236': number, '0.382': number, '0.5': number, '0.618': number, '0.705': number, '0.786': number, '1.0': number, '1.272': number, '1.618': number }`

#### `computeAllIndicators(candles)`
* **Params**: `candles: { open, high, low, close, volume }[]`
* **Returns**: Composite snapshot: `{ ema9, ema21, ema50, ema200, emaBias, rsi, rsiCondition, atr, macd, bollingerBands, vwap, vwapBias }`

---

### 2. Candlestick Pattern Recognition (`trading-core/candlesticks` or root)

```javascript
const {
  scanCandlestickPatterns,
  checkHammer,
  checkInvertedHammer,
  checkEngulfing,
  checkMorningEveningStar,
  checkThreeSoldiersCrows,
  checkDoji,
  checkTweezer,
  checkHarami,
  checkPiercingAndDarkCloud,
  checkMarubozu
} = require('trading-core');
```

#### `scanCandlestickPatterns(candles)`
* **Params**: `candles: { open, high, low, close }[]`
* **Returns**:
  ```json
  {
    "patterns": [
      { "pattern": "HAMMER", "bias": "BULLISH", "confidence": 80, "category": "SINGLE", "candleIndices": [19] }
    ],
    "primaryPattern": { "pattern": "HAMMER", "bias": "BULLISH", "confidence": 80 },
    "bias": "BULLISH" | "BEARISH" | "NEUTRAL",
    "score": 30.0
  }
  ```

---

### 3. Risk Management & Position Sizing Math (`trading-core/risk` or root)

```javascript
const {
  calculateLotSize,
  checkDailyLossLimit,
  checkFridayWeekendBuffer,
  calculateRiskRewardRatio
} = require('trading-core');
```

#### `calculateLotSize({ balance, riskPercent, entryPrice, stopLoss, contractSize = 100, minLot = 0.01, maxLot = 1.0 })`
* **Formula**: `Risk Amount / (SL Distance * Contract Size)`
* **Returns**: `{ lotSize: number, riskAmountUsd: number, slDistance: number, slPips: number, balance: number }`

#### `checkDailyLossLimit({ balance, maxLossPercent, currentDailyPnl })`
* **Returns**: `{ isBreached: boolean, maxLossDollars: number, currentLossDollars: number, remainingBufferDollars: number }`

#### `checkFridayWeekendBuffer({ dayOfWeek, minutesToFridayClose, bufferMinutes = 120 })`
* **Returns**: `{ isBufferActive: boolean, reason: string | null }`

#### `calculateRiskRewardRatio({ entryPrice, stopLoss, takeProfit, isLong = true })`
* **Returns**: `{ rrRatio: number, riskDistance: number, rewardDistance: number, isValid: boolean }`

---

### 4. Guardrails & Boundary Checks (`trading-core/guardrails` or root)

```javascript
const {
  checkSpreadGuard,
  checkSessionFilter,
  checkTradeCountGuard,
  checkStopLossSanity,
  evaluateAllGuardrails
} = require('trading-core');
```

#### `checkSpreadGuard(currentSpreadPips, maxSpreadPips)`
* **Returns**: `{ passed: boolean, reason: string | null }`

#### `checkSessionFilter(currentSession, allowedSessions)`
* **Returns**: `{ passed: boolean, reason: string | null }`

#### `checkTradeCountGuard(currentOpenTrades, maxOpenTrades)`
* **Returns**: `{ passed: boolean, reason: string | null }`

#### `checkStopLossSanity({ entryPrice, stopLoss, direction, maxDistancePoints })`
* **Returns**: `{ passed: boolean, reason: string | null }`

#### `evaluateAllGuardrails({ marketState, accountState, tradeParams, limits })`
* **Returns**: `{ passed: boolean, failures: string[] }`

---

## 🧪 Unit Tests

Run the package test suite:
```bash
node tests/testCore.js
```
