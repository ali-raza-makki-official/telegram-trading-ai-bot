const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const chalk = require('chalk');
const orchestrator = require('./orchestrator/agentOrchestrator');
const config = require('./config');
const logger = require('./utils/logger');

function printBanner() {
  console.log(chalk.yellow.bold(`
===================================================================
     ____  _  _ _____ ___  _  _  ___  __  __  ___  _   _ ___ 
    / __ \\| || |_   _/ _ \\| \\| |/ _ \\|  \\/  |/ _ \\| | | / __|
   | / _  | || | | || (_) | .  | (_) | |\\/| | (_) | |_| \\__ \\
   | \\__  |____| |_| \\___/|_|\\_|\\___/|_|  |_|\\___/ \\___/|___/
    \\____/   AUTONOMOUS GOLD (XAU/USD) TRADING AI AGENT      
===================================================================
`));
  console.log(chalk.cyan(`  Primary Asset    : ${config.system.primarySymbol}`));
  console.log(chalk.cyan(`  Autonomy Mode    : ${config.system.autonomyMode.toUpperCase()}`));
  console.log(chalk.cyan(`  Execution Engine : ${config.system.executionMode.toUpperCase()}`));
  console.log(chalk.cyan(`  LLM Reasoner     : ${config.llm.primaryProvider.toUpperCase()}`));
  console.log(chalk.cyan(`  Database Type    : ${config.database.type.toUpperCase()}`));
  console.log(chalk.yellow(`===================================================================\n`));
}

const http = require('http');

async function main() {
  printBanner();

  try {
    // 1. Start Interactive Web Dashboard & Health Check Server immediately
    const { handleDashboardRequest } = require('./server/webDashboard');
    const port = process.env.PORT || 3000;
    const server = http.createServer((req, res) => {
      // Health check endpoint for uptime monitors
      if (req.url === '/health' || req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          uptime: Math.round(process.uptime()),
          timestamp: new Date().toISOString(),
          executionMode: config.system.executionMode,
          autonomyMode: orchestrator.autonomyMode,
          isPaused: orchestrator.isPaused,
        }));
        return;
      }
      handleDashboardRequest(req, res, orchestrator);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.warn({ port }, `Port ${port} in use, continuing trading bot and Telegram polling seamlessly without HTTP port`);
      } else {
        logger.warn({ err: err.message }, 'HTTP server error');
      }
    });

    server.listen(port, () => {
      logger.info({ port }, `🌐 Web Dashboard & Real-Time Chart Terminal LIVE at http://localhost:${port}`);
    });

    // 2. Initialize Trading Orchestrator & Broker Streaming in parallel
    await orchestrator.initialize();

    // Handle graceful shutdown
    const handleShutdown = async (signal) => {
      console.log(chalk.yellow(`\nReceived ${signal}. Gracefully stopping trading agent...`));
      server.close();
      await orchestrator.shutdown();
      process.exit(0);
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  } catch (err) {
    logger.fatal({ err: err.message, stack: err.stack }, 'Fatal error during startup');
    process.exit(1);
  }
}

main();
