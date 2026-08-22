import config from "./config/index.js";
import { logger } from "./core/logger.js";
import {
  connectWhatsApp,
  disconnectWhatsApp
} from "./core/connection.js";

async function bootstrap() {
  logger.info("Starting NovaBot...");
  logger.info(`Environment: ${config.env}`);
  logger.info(`Bot Name: ${config.bot.name}`);
  logger.info(`Prefix: ${config.command.prefix}`);

  await connectWhatsApp();
}

async function shutdown(signal) {
  logger.info(`${signal} received.`);
  logger.info("Shutting down NovaBot...");

  disconnectWhatsApp();

  process.exit(0);
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

bootstrap().catch((error) => {
  logger.error(
    `Fatal startup error: ${error.message}`
  );

  process.exit(1);
});
