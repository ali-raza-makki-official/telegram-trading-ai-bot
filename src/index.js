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

async function main() {
  printBanner();

  try {
    await orchestrator.initialize();

    // Handle graceful shutdown
    const handleShutdown = async (signal) => {
      console.log(chalk.yellow(`\nReceived ${signal}. Gracefully stopping trading agent...`));
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
