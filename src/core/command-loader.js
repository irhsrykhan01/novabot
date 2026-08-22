import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { logger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COMMANDS_PATH = path.resolve(__dirname, "../commands");

const commands = new Map();

export function registerCommand(command) {
  if (!command?.name || typeof command.execute !== "function") {
    throw new Error("Invalid command.");
  }

  for (const name of [command.name, ...(command.aliases || [])]) {
    commands.set(name.toLowerCase(), command);
  }
}

export async function loadCommands() {
  commands.clear();
  await fs.mkdir(COMMANDS_PATH, { recursive: true });

  const files = await fs.readdir(COMMANDS_PATH);

  for (const file of files) {
    if (!file.endsWith(".js")) continue;

    try {
      const module = await import(
        `${pathToFileURL(path.join(COMMANDS_PATH, file)).href}?t=${Date.now()}`
      );

      registerCommand(module.default);
    } catch (error) {
      logger.error(`Failed to load command ${file}: ${error.message}`);
    }
  }

  logger.info(`Loaded ${commands.size} command(s).`);
}

export function getCommand(name) {
  return commands.get(name.toLowerCase());
}

export function getCommands() {
  return commands;
}
