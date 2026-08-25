const EventEmitter = require('events');
const config = require('../config');
const { SettingsRepo } = require('../database');
const logger = require('../utils/logger');

class MetaApiClient extends EventEmitter {
  constructor() {
    super();
    this.token = config.metaApi.token || process.env.METAAPI_API_TOKEN || '';
    this.accountId = config.metaApi.accountId || process.env.METAAPI_ACCOUNT_ID || '';
    this.api = null;
    this.account = null;
    this.streamingConnection = null;
    this.rpcConnection = null;
    this.isConnected = false;
    this.isConnecting = false;
    // FIX #14: Exponential backoff reconnect tracking
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.baseReconnectDelayMs = 5000;
    // FIX #4: Daily PnL tracking (session-based)
    this.sessionStartBalance = null;
    this.dailyPnlCache = 0;
    // FIX #23: Connection timeout — prevent hanging indefinitely
    this.connectionTimeoutMs = 90000; // 90 seconds max for full connection sequence
  }

  // FIX #23: Helper to race a promise against a timeout
  _withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`MetaApi ${label} timed out after ${ms / 1000}s`)), ms)
      ),
    ]);
  }

  isConfigured() {
    return Boolean(this.token && this.accountId);
  }

  async connect() {
    if (!this.isConfigured()) {
      logger.warn('METAAPI_API_TOKEN or METAAPI_ACCOUNT_ID is not configured. Live MetaApi trading is in standby.');
      return;
    }

    if (this.isConnecting || this.isConnected) return;
    this.isConnecting = true;

    try {
      logger.info({ accountId: this.accountId }, 'Connecting to MetaApi Cloud (WebSocket + RPC)...');

      let MetaApi;
      try {
        MetaApi = require('metaapi.cloud-sdk').default || require('metaapi.cloud-sdk');
      } catch (sdkErr) {
        logger.error({ err: sdkErr.message }, 'Failed to require metaapi.cloud-sdk');
        this.isConnecting = false;
        return;
      }

      this.api = new MetaApi(this.token);
      this.account = await this.api.metatraderAccountApi.getAccount(this.accountId);

      // Deploy cloud instance if needed
      if (this.account.state !== 'DEPLOYED') {
        logger.info('MetaApi account is deploying to cloud instance...');
        await this.account.deploy();
      }

      // FIX #23: Wait for broker connection with timeout
      logger.info('Waiting for MetaApi connection to broker (90s timeout)...');
      await this._withTimeout(this.account.waitConnected(), 45000, 'waitConnected');

      // 1. Establish Streaming WebSocket Connection for real-time prices & sync
      this.streamingConnection = this.account.getStreamingConnection();
      await this._withTimeout(this.streamingConnection.connect(), 20000, 'streaming.connect');
      await this._withTimeout(this.streamingConnection.waitSynchronized(), 25000, 'streaming.waitSynchronized');

      // 2. Establish RPC Connection for deterministic trade execution
      this.rpcConnection = this.account.getRPCConnection();
      await this._withTimeout(this.rpcConnection.connect(), 20000, 'rpc.connect');
      await this._withTimeout(this.rpcConnection.waitSynchronized(), 25000, 'rpc.waitSynchronized');

      this.reconnectAttempts = 0; // Reset on success
      this.isConnected = true;
      this.isConnecting = false;

      // Auto-discover broker symbol (e.g. XAUUSDm on Exness)
      this.brokerSymbols = await this.rpcConnection.getSymbols();
      this.resolvedSymbol = this.resolveSymbol(config.system.primarySymbol);

      // FIX #4 + FIX #19: Record session start balance for dailyPnl calculation
      // Persist to DB so dailyPnl survives bot restarts within the same day
      try {
        const todayStr = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
        const savedDate = await SettingsRepo.get('metaapi_daily_pnl_date');
        const savedBalance = await SettingsRepo.get('metaapi_session_start_balance');

        if (savedDate === todayStr && savedBalance !== null && !isNaN(Number(savedBalance))) {
          // Same day — restore the original session start balance
          this.sessionStartBalance = Number(savedBalance);
          logger.info({ sessionStartBalance: this.sessionStartBalance, savedDate }, 'Restored session start balance from database (same day)');
        } else {
          // New day or first run — record fresh start balance
          const info = this.streamingConnection?.terminalState?.accountInformation
            || await this.rpcConnection?.getAccountInformation();
          if (info?.balance) {
            this.sessionStartBalance = info.balance;
            await SettingsRepo.set('metaapi_session_start_balance', info.balance);
            await SettingsRepo.set('metaapi_daily_pnl_date', todayStr);
            logger.info({ sessionStartBalance: this.sessionStartBalance }, 'Recorded fresh session start balance for daily PnL tracking');
          }
        }
      } catch (_) {}

      logger.info({
        brokerServer: this.account.server,
        primarySymbol: config.system.primarySymbol,
        resolvedBrokerSymbol: this.resolvedSymbol,
      }, 'Connected and synchronized with MetaApi Cloud (Streaming & RPC ready)!');

      this.emit('connected');

      // Subscribe to symbol price stream
      try {
        await this.streamingConnection.subscribeToMarketData(this.resolvedSymbol);
      } catch (subErr) {
        logger.warn({ err: subErr.message }, `Could not subscribe to market stream for ${this.resolvedSymbol}`);
      }

      // Synchronize price ticks cleanly using SynchronizationListener base class
      let SynchronizationListener;
      try {
        SynchronizationListener = require('metaapi.cloud-sdk/dist/clients/metaApi/synchronizationListener').default;
      } catch {
        SynchronizationListener = class {};
      }

      const self = this;
      class CustomSyncListener extends SynchronizationListener {
        async onSymbolPriceUpdated(instanceIndex, price) {
          if (price && price.symbol) {
            self.emit('tick', {
              symbol: price.symbol,
              price: price.bid,
              ask: price.ask,
              bid: price.bid,
              timestamp: Date.now(),
            });
          }
        }
      }

      this.streamingConnection.addSynchronizationListener(new CustomSyncListener());
    } catch (err) {
      this.isConnecting = false;
      this.isConnected = false;
      this.reconnectAttempts++;
      logger.error({ err: err.message, attempt: this.reconnectAttempts }, 'MetaApi Cloud connection error');
      this.emit('error', err);

      // FIX #14: Exponential backoff with max attempt limit
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        logger.error(
          { attempts: this.reconnectAttempts },
          `MetaApi reconnect gave up after ${this.maxReconnectAttempts} attempts. Check METAAPI_API_TOKEN and METAAPI_ACCOUNT_ID.`
        );
        return; // Stop reconnecting — prevents infinite loop
      }

      const delay = Math.min(
        this.baseReconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1),
        5 * 60 * 1000 // Max 5 minute wait
      );
      logger.info({ delay: Math.round(delay / 1000) + 's', attempt: this.reconnectAttempts }, 'Scheduling MetaApi reconnect...');
      setTimeout(() => this.connect(), delay);
    }
  }

  resolveSymbol(requested = 'XAUUSD') {
    if (!this.brokerSymbols || this.brokerSymbols.length === 0) return requested;
    if (this.brokerSymbols.includes(requested)) return requested;

    // Search for suffix or prefix matches (e.g., XAUUSDm, XAUUSD.m, GOLD)
    const upper = requested.toUpperCase();
    const match = this.brokerSymbols.find(s => s.toUpperCase() === `${upper}M` || s.toUpperCase() === `${upper}.M` || s.toUpperCase() === upper);
    if (match) return match;

    if (upper.includes('XAU') || upper.includes('GOLD')) {
      const goldMatch = this.brokerSymbols.find(s => s.toUpperCase().includes('XAUUSD') || s.toUpperCase() === 'GOLD');
      if (goldMatch) return goldMatch;
    }

    return requested;
  }

  async getLivePrice(symbol = config.system.primarySymbol) {
    if (!this.rpcConnection) return null;
    try {
      const resolved = this.resolveSymbol(symbol);
      const price = await this.rpcConnection.getSymbolPrice(resolved);
      return {
        symbol: resolved,
        price: price.bid,
        bid: price.bid,
        ask: price.ask,
        timestamp: Date.now(),
      };
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to fetch live symbol price from MetaApi');
      return null;
    }
  }

  async getHistoricalCandles(symbol = config.system.primarySymbol, timeframe = '15m', limit = 100) {
    if (!this.account) return null;
    try {
      const targetSymbol = this.resolveSymbol(symbol);
      const metaTf = timeframe.toLowerCase();
      const tfMinutes = metaTf === '1m' ? 1 : metaTf === '5m' ? 5 : metaTf === '15m' ? 15 : metaTf === '30m' ? 30 : metaTf === '1h' ? 60 : metaTf === '4h' ? 240 : metaTf === '1d' ? 1440 : 10080;
      
      // Calculate precise startTime to ensure we always capture the latest live market candle
      const startTime = new Date(Date.now() - (limit * tfMinutes * 60 * 1000 * 1.5));
      
      const rawCandles = await this.account.getHistoricalCandles(targetSymbol, metaTf, startTime, limit);

      if (rawCandles && rawCandles.length > 0) {
        return rawCandles.map(c => ({
          timestamp: new Date(c.time).getTime(),
          time: new Date(c.time).toISOString(),
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.tickVolume || c.volume || 100),
        }));
      }
      return null;
    } catch (err) {
      logger.warn({ err: err.message, symbol, timeframe }, 'Failed fetching real historical candles from MetaApi account');
      return null;
    }
  }

  async getAccountSummary() {
    if (!this.isConnected) {
      return {
        balance: config.risk.accountStartingBalance,
        equity: config.risk.accountStartingBalance,
        floatingPnl: 0,
        dailyPnl: 0,
        openPositionsCount: 0,
      };
    }

    try {
      const info = this.streamingConnection?.terminalState?.accountInformation 
        || await this.rpcConnection?.getAccountInformation();

      const positions = await this.getOpenPositions();
      let floatingPnl = 0;
      for (const p of positions) {
        floatingPnl += p.floatingPnl || 0;
      }

      const currentBalance = info?.balance || 0;

      // FIX #4: Calculate actual daily PnL as (current balance - session start balance)
      // sessionStartBalance is recorded when we first connect each session
      if (this.sessionStartBalance === null && currentBalance > 0) {
        this.sessionStartBalance = currentBalance;
      }
      const dailyPnl = this.sessionStartBalance
        ? Number((currentBalance - this.sessionStartBalance).toFixed(2))
        : 0;

      return {
        balance: currentBalance,
        equity: info?.equity || (currentBalance + floatingPnl),
        floatingPnl: Number(floatingPnl.toFixed(2)),
        dailyPnl,
        openPositionsCount: positions.length,
        currency: info?.currency || 'USD',
        server: info?.server || 'MetaApi-Cloud',
      };

    } catch (err) {
      logger.error({ err: err.message }, 'Failed to fetch MetaApi account summary');
      return {
        balance: 0,
        equity: 0,
        floatingPnl: 0,
        dailyPnl: 0,
        openPositionsCount: 0,
      };
    }
  }

  async getOpenPositions() {
    if (!this.isConnected) return [];

    try {
      const rawPositions = this.streamingConnection?.terminalState?.positions 
        || await this.rpcConnection?.getPositions() 
        || [];

      return rawPositions.map(p => ({
        id: p.id,
        ticket: p.id,
        symbol: p.symbol,
        type: p.type === 'POSITION_TYPE_BUY' || p.type === 'BUY' ? 'BUY' : 'SELL',
        lot: p.volume,
        entryPrice: p.openPrice,
        sl: p.stopLoss || null,
        tp: p.takeProfit || null,
        floatingPnl: Number((p.profit || 0).toFixed(2)),
        openTime: p.time ? new Date(p.time).getTime() : Date.now(),
      }));
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to fetch MetaApi open positions');
      return [];
    }
  }

  // Execute Market or Pending Limit Order via RPC Connection
  async openOrder({ symbol = config.system.primarySymbol, type, lot, openPrice = null, sl = null, tp = null }) {
    if (!this.isConnected || !this.rpcConnection) {
      throw new Error('MetaApi Cloud is not connected. Check METAAPI_API_TOKEN and METAAPI_ACCOUNT_ID.');
    }

    const targetSymbol = this.resolveSymbol(symbol);
    logger.info({ symbol, targetSymbol, type, lot, openPrice, sl, tp }, 'Executing live order via MetaApi Cloud RPC...');

    const execClient = this.rpcConnection;
    let tradeResult;

    const stopLossValue = sl ? Number(Number(sl).toFixed(2)) : undefined;
    const takeProfitValue = tp ? Number(Number(tp).toFixed(2)) : undefined;
    const volumeValue = Number(Number(lot).toFixed(2));
    const priceValue = openPrice ? Number(Number(openPrice).toFixed(2)) : undefined;

    const upperType = (type || '').toUpperCase();

    if (upperType === 'BUY_LIMIT') {
      tradeResult = await execClient.createLimitBuyOrder(
        targetSymbol,
        volumeValue,
        priceValue,
        stopLossValue,
        takeProfitValue,
        { comment: 'AI Gold Limit' }
      );
    } else if (upperType === 'SELL_LIMIT') {
      tradeResult = await execClient.createLimitSellOrder(
        targetSymbol,
        volumeValue,
        priceValue,
        stopLossValue,
        takeProfitValue,
        { comment: 'AI Gold Limit' }
      );
    } else if (upperType === 'BUY') {
      tradeResult = await execClient.createMarketBuyOrder(
        targetSymbol,
        volumeValue,
        stopLossValue,
        takeProfitValue,
        { comment: 'AI Gold Agent' }
      );
    } else {
      tradeResult = await execClient.createMarketSellOrder(
        targetSymbol,
        volumeValue,
        stopLossValue,
        takeProfitValue,
        { comment: 'AI Gold Agent' }
      );
    }

    logger.info({ tradeResult }, 'MetaApi order executed successfully!');

    return {
      id: tradeResult.orderId || tradeResult.positionId,
      ticket: tradeResult.orderId || tradeResult.positionId,
      symbol,
      type,
      lot: volumeValue,
      entryPrice: tradeResult.openPrice || 0,
      sl: stopLossValue,
      tp: takeProfitValue,
      status: 'OPEN',
      openTime: Date.now(),
      raw: tradeResult,
    };
  }

  // Close specific position by ticket/position ID
  async closeOrder(positionId) {
    if (!this.isConnected || !this.rpcConnection) {
      throw new Error('MetaApi Cloud is not connected.');
    }

    logger.info({ positionId }, 'Closing position via MetaApi Cloud RPC...');
    const result = await this.rpcConnection.closePosition(positionId);

    return {
      ticket: positionId,
      status: 'CLOSED',
      closePrice: result?.closePrice || 0,
      pnl: result?.profit || 0,
      raw: result,
    };
  }

  // Modify Stop Loss / Take Profit
  async modifyPosition(positionId, sl = null, tp = null) {
    if (!this.isConnected || !this.rpcConnection) {
      throw new Error('MetaApi Cloud is not connected.');
    }

    const stopLoss = sl ? Number(Number(sl).toFixed(2)) : undefined;
    const takeProfit = tp ? Number(Number(tp).toFixed(2)) : undefined;

    return this.rpcConnection.modifyPosition(positionId, stopLoss, takeProfit);
  }

  // Close all open positions
  async closeAll() {
    if (!this.isConnected) return [];
    const positions = await this.getOpenPositions();
    const results = [];
    for (const p of positions) {
      try {
        const res = await this.closeOrder(p.id);
        results.push(res);
      } catch (err) {
        logger.error({ id: p.id, err: err.message }, 'Failed to close position');
      }
    }
    return results;
  }

  async disconnect() {
    if (this.streamingConnection) {
      await this.streamingConnection.close().catch(() => {});
      this.streamingConnection = null;
    }
    if (this.rpcConnection) {
      await this.rpcConnection.close().catch(() => {});
      this.rpcConnection = null;
    }
    this.isConnected = false;
    logger.info('MetaApi Cloud client disconnected');
  }
}

module.exports = new MetaApiClient();
