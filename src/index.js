import config from "./config/index.js";
import { logger } from "./core/logger.js";

async function bootstrap() {
  logger.info("Starting NovaBot...");
  logger.info(`Environment: ${config.env}`);
  logger.info(`Bot Name: ${config.bot.name}`);
  logger.info(`Prefix: ${config.command.prefix}`);

  logger.info("Foundation initialized.");
  logger.info("NovaBot is ready for WhatsApp Core.");
}

bootstrap().catch((error) => {
  logger.error(`Fatal startup error: ${error.message}`);
  process.exit(1);
});
