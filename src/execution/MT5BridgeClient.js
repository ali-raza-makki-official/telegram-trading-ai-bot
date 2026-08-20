const net = require('net');
const EventEmitter = require('events');
const config = require('../config');
const logger = require('../utils/logger');

class MT5BridgeClient extends EventEmitter {
  constructor() {
    super();
    this.host = config.mt5.host;
    this.port = config.mt5.port;
    this.socket = null;
    this.isConnected = false;
    this.pendingRequests = new Map(); // requestId -> { resolve, reject, timeout }
    this.reconnectTimer = null;
  }

  connect() {
    if (this.socket) {
      this.socket.destroy();
    }

    logger.info({ host: this.host, port: this.port }, 'Connecting to MT5 Winsock TCP Bridge...');
    this.socket = new net.Socket();

    this.socket.connect(this.port, this.host, () => {
      this.isConnected = true;
      logger.info('Connected to MT5 Bridge');
      this.emit('connected');
    });

    this.socket.on('data', (data) => {
      this.handleIncomingData(data);
    });

    this.socket.on('close', () => {
      this.isConnected = false;
      logger.warn('MT5 Bridge connection closed, scheduling reconnect...');
      this.emit('disconnected');
      this.scheduleReconnect();
    });

    this.socket.on('error', (err) => {
      logger.error({ err: err.message }, 'MT5 Bridge socket error');
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isConnected && config.system.executionMode === 'mt5') {
        this.connect();
      }
    }, config.mt5.reconnectIntervalMs);
  }

  handleIncomingData(buffer) {
    try {
      const text = buffer.toString('utf8').trim();
      const lines = text.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;
        const msg = JSON.parse(line);

        if (msg.requestId && this.pendingRequests.has(msg.requestId)) {
          const { resolve, timeout } = this.pendingRequests.get(msg.requestId);
          clearTimeout(timeout);
          this.pendingRequests.delete(msg.requestId);
          resolve(msg);
        } else {
          this.emit('message', msg);
        }
      }
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to parse incoming MT5 message');
    }
  }

  async sendCommand(action, params = {}) {
    if (!this.isConnected) {
      throw new Error('MT5 Bridge is not connected');
    }

    const requestId = `REQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const payload = JSON.stringify({ action, requestId, ...params }) + '\n';

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`MT5 Bridge command timed out: ${action}`));
        }
      }, 10000);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });
      this.socket.write(payload, 'utf8');
    });
  }

  async openOrder({ symbol, type, lot, sl, tp }) {
    return this.sendCommand('OPEN_ORDER', { symbol, type, lot, sl, tp });
  }

  async closeOrder(ticket) {
    return this.sendCommand('CLOSE_ORDER', { ticket });
  }

  async getAccountSummary() {
    return this.sendCommand('GET_ACCOUNT_INFO');
  }

  async getOpenPositions() {
    return this.sendCommand('GET_POSITIONS');
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.isConnected = false;
  }
}

module.exports = new MT5BridgeClient();
