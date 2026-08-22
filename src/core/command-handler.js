import { getCommand } from "./command-loader.js";
import { parseCommand } from "./command-parser.js";
import { logger } from "./logger.js";

export async function handleCommand(message, prefix) {
  const text =
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    "";

  const parsed = parseCommand(
    text,
    prefix
  );

  if (!parsed) {
    return false;
  }

  const command = getCommand(
    parsed.command
  );

  if (!command) {
    return false;
  }

  try {
    await command.execute({
      message,
      args: parsed.args,
      command: parsed.command,
      raw: parsed.raw
    });

    return true;
  } catch (error) {
    logger.error(
      `Command "${parsed.command}" failed: ${error.message}`
    );

    return true;
  }
}
