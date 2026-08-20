const chalk = require('chalk');
const orchestrator = require('../src/orchestrator/agentOrchestrator');
const riskManager = require('../src/risk/riskManager');
const { initDatabase } = require('../src/database');

async function testAllMetaApiActions() {
  console.log(chalk.yellow.bold('\n======================================================'));
  console.log(chalk.yellow.bold('  METAPI CLOUD TRADING & ACTION VERIFICATION SUITE   '));
  console.log(chalk.yellow.bold('======================================================\n'));

  initDatabase();
  let passed = 0;
  let total = 0;

  function verify(condition, desc) {
    total++;
    if (condition) {
      console.log(chalk.green(`  ✓ [ACTION PASSED]: ${desc}`));
      passed++;
    } else {
      console.log(chalk.red(`  ✗ [ACTION FAILED]: ${desc}`));
    }
  }

  // 1. Mock MetaApi Client to test full RPC contract execution
  console.log(chalk.cyan('1. Testing MetaApi Order Execution Contract:'));
  const mockRpc = {
    async createMarketBuyOrder(symbol, volume, sl, tp, options) {
      return {
        orderId: 'METAAPI-BUY-1001',
        positionId: 'METAAPI-POS-1001',
        openPrice: 2650.50,
        volume,
        stopLoss: sl,
        takeProfit: tp,
        comment: options?.comment,
        type: 'ORDER_TYPE_BUY',
      };
    },
    async createMarketSellOrder(symbol, volume, sl, tp, options) {
      return {
        orderId: 'METAAPI-SELL-1002',
        positionId: 'METAAPI-POS-1002',
        openPrice: 2650.00,
        volume,
        stopLoss: sl,
        takeProfit: tp,
        comment: options?.comment,
        type: 'ORDER_TYPE_SELL',
      };
    },
    async getPositions() {
      return [
        {
          id: 'METAAPI-POS-1001',
          symbol: 'XAUUSD',
          type: 'POSITION_TYPE_BUY',
          volume: 0.2,
          openPrice: 2650.50,
          stopLoss: 2640.00,
          takeProfit: 2670.00,
          profit: 45.0,
          time: new Date().toISOString(),
        },
      ];
    },
    async closePosition(positionId) {
      return {
        orderId: 'METAAPI-CLOSE-1003',
        closePrice: 2655.00,
        profit: 90.0,
      };
    },
    async modifyPosition(positionId, sl, tp) {
      return { positionId, stopLoss: sl, takeProfit: tp, success: true };
    },
    async getAccountInformation() {
      return {
        balance: 10000,
        equity: 10045,
        currency: 'USD',
        server: 'MetaQuotes-Demo',
      };
    },
  };

  const metaApiClient = require('../src/execution/MetaApiClient');
  metaApiClient.rpcConnection = mockRpc;
  metaApiClient.isConnected = true;

  // Test BUY Order
  const buyRes = await metaApiClient.openOrder({
    symbol: 'XAUUSD',
    type: 'BUY',
    lot: 0.2,
    sl: 2640,
    tp: 2670,
  });
  verify(buyRes.ticket === 'METAAPI-BUY-1001' && buyRes.type === 'BUY' && buyRes.entryPrice === 2650.5, 'MetaApi BUY Order execution returns ticket, entry price & parameters');

  // Test SELL Order
  const sellRes = await metaApiClient.openOrder({
    symbol: 'XAUUSD',
    type: 'SELL',
    lot: 0.1,
    sl: 2660,
    tp: 2630,
  });
  verify(sellRes.ticket === 'METAAPI-SELL-1002' && sellRes.type === 'SELL', 'MetaApi SELL Order execution returns valid ticket');

  // Test Get Positions
  const positions = await metaApiClient.getOpenPositions();
  verify(positions.length === 1 && positions[0].symbol === 'XAUUSD' && positions[0].floatingPnl === 45, 'MetaApi getOpenPositions maps open cloud positions & PnL');

  // Test Modify Position SL/TP
  const modRes = await metaApiClient.modifyPosition('METAAPI-POS-1001', 2645, 2675);
  verify(modRes.success === true && modRes.stopLoss === 2645, 'MetaApi modifyPosition updates SL and TP on active position');

  // Test Close Position
  const closeRes = await metaApiClient.closeOrder('METAAPI-POS-1001');
  verify(closeRes.ticket === 'METAAPI-POS-1001' && closeRes.status === 'CLOSED' && closeRes.pnl === 90, 'MetaApi closeOrder closes position and returns realized PnL');

  // Test Account Summary
  const acc = await metaApiClient.getAccountSummary();
  verify(acc.balance === 10000 && acc.currency === 'USD', 'MetaApi getAccountSummary returns live balance and equity');

  // 2. Testing Risk Management Validation Before Execution
  console.log(chalk.cyan('\n2. Testing Risk Layer Guardrails Before MetaApi Send:'));
  const blockedTrade = await riskManager.validateTrade({
    symbol: 'XAUUSD',
    type: 'BUY',
    lot: 0.2,
    entryPrice: 2650,
    sl: null, // Missing SL
    accountBalance: 10000,
  });
  verify(blockedTrade.isValid === false, 'Risk Manager intercepts and blocks dangerous order without Stop Loss');

  const validTrade = await riskManager.validateTrade({
    symbol: 'XAUUSD',
    type: 'BUY',
    lot: 0.2,
    entryPrice: 2650,
    sl: 2640,
    accountBalance: 10000,
  });
  verify(validTrade.isValid === true, 'Risk Manager approves compliant trade with valid Stop Loss');

  // 3. Testing Orchestrator Integration (Signal to MetaApi Trade Execution)
  console.log(chalk.cyan('\n3. Testing Master Orchestrator Signal Execution via MetaApi:'));
  orchestrator.executionMode = 'metaapi';

  const testSignal = {
    symbol: 'XAUUSD',
    timeframe: '15m',
    currentPrice: 2650.0,
    predictionId: 'PRED-TEST-123',
    thesis: {
      bias: 'BULLISH',
      confidence: 85,
      primary_setup: 'SMC 15m Order Block + London Killzone',
      suggested_sl: 2640.0,
      suggested_tp1: 2665.0,
      suggested_tp2: 2680.0,
      risk_reward_ratio: 2.5,
      reasoning: 'High-probability bullish expansion',
    },
  };

  const executedSignal = await orchestrator.executeApprovedSignal(testSignal);
  verify(executedSignal.success === true && executedSignal.trade.ticket !== undefined, 'Orchestrator successfully processes approved trade signal and routes to MetaApi');

  // 4. Testing Manual Telegram Command Execution
  console.log(chalk.cyan('\n4. Testing Manual Trade Command Routing:'));
  const manualTrade = await orchestrator.executeManualTrade({
    symbol: 'XAUUSD',
    type: 'BUY',
    lot: 0.1,
    sl: 2640,
    tp: 2670,
  });
  verify(manualTrade.success === true && manualTrade.trade.ticket !== undefined, 'Manual Telegram /execute command routes directly to MetaApi order placement');

  console.log(chalk.yellow.bold(`\n======================================================`));
  console.log(chalk.green.bold(`  ALL METAAPI ACTIONS CONFIRMED: ${passed} / ${total} Actions Working Perfectly!`));
  console.log(chalk.yellow.bold(`======================================================\n`));

  if (passed !== total) process.exit(1);
}

testAllMetaApiActions().catch(err => {
  console.error(chalk.red(err.stack));
  process.exit(1);
});
