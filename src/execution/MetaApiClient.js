const EventEmitter = require('events');
const config = require('../config');
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

      // Wait for broker connection
      logger.info('Waiting for MetaApi connection to broker...');
      await this.account.waitConnected();

      // 1. Establish Streaming WebSocket Connection for real-time prices & sync
      this.streamingConnection = this.account.getStreamingConnection();
      await this.streamingConnection.connect();
      await this.streamingConnection.waitSynchronized();

      // 2. Establish RPC Connection for deterministic trade execution
      this.rpcConnection = this.account.getRPCConnection();
      await this.rpcConnection.connect();
      await this.rpcConnection.waitSynchronized();

      this.isConnected = true;
      this.isConnecting = false;

      // Auto-discover broker symbol (e.g. XAUUSDm on Exness)
      this.brokerSymbols = await this.rpcConnection.getSymbols();
      this.resolvedSymbol = this.resolveSymbol(config.system.primarySymbol);

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
      logger.error({ err: err.message }, 'MetaApi Cloud connection error');
      this.emit('error', err);
      // Auto reconnect after 10 seconds
      setTimeout(() => this.connect(), 10000);
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

      return {
        balance: info?.balance || 0,
        equity: info?.equity || ((info?.balance || 0) + floatingPnl),
        floatingPnl: Number(floatingPnl.toFixed(2)),
        dailyPnl: 0,
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

  // Execute Market Order via RPC Connection
  async openOrder({ symbol = config.system.primarySymbol, type, lot, sl = null, tp = null }) {
    if (!this.isConnected || !this.rpcConnection) {
      throw new Error('MetaApi Cloud is not connected. Check METAAPI_API_TOKEN and METAAPI_ACCOUNT_ID.');
    }

    const targetSymbol = this.resolveSymbol(symbol);
    logger.info({ symbol, targetSymbol, type, lot, sl, tp }, 'Executing live order via MetaApi Cloud RPC...');

    const execClient = this.rpcConnection;
    let tradeResult;

    const stopLossValue = sl ? Number(Number(sl).toFixed(2)) : undefined;
    const takeProfitValue = tp ? Number(Number(tp).toFixed(2)) : undefined;
    const volumeValue = Number(Number(lot).toFixed(2));

    if (type === 'BUY') {
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
