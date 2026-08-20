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
    await orchestrator.initialize();

    // Start lightweight HTTP Status & Health Check Server for Cloud Hosts (Hostinger, Render, Heroku)
    const port = process.env.PORT || 3000;
    const server = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: Date.now(), uptime: process.uptime() }));
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>Gold Trading AI Agent</title></head>
          <body style="background:#0f172a;color:#f8fafc;font-family:sans-serif;text-align:center;padding:50px;">
            <h1 style="color:#f59e0b;">Gold (XAU/USD) Trading AI Agent</h1>
            <p style="color:#10b981;">&#9679; Status: LIVE &amp; RUNNING</p>
            <p>Controlled via Telegram: <a style="color:#38bdf8;" href="https://t.me/XAUUSD_Trading_AI_Agent_bot">@XAUUSD_Trading_AI_Agent_bot</a></p>
          </body>
          </html>
        `);
      }
    });

    server.listen(port, () => {
      logger.info({ port }, 'HTTP Health Check & Dashboard Server running');
    });

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
