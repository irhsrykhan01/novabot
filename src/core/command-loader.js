import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { logger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMMANDS_PATH = path.resolve(
  __dirname,
  "../commands"
);

const commands = new Map();

export async function loadCommands() {
  commands.clear();

  await fs.mkdir(COMMANDS_PATH, {
    recursive: true
  });

  const files = await fs.readdir(COMMANDS_PATH);

  for (const file of files) {
    if (!file.endsWith(".js")) {
      continue;
    }

    const filePath = path.join(
      COMMANDS_PATH,
      file
    );

    try {
      const module = await import(
        `${pathToFileURL(filePath).href}?update=${Date.now()}`
      );

      const command = module.default;

      if (!command?.name || typeof command.execute !== "function") {
        logger.warn(
          `Invalid command file: ${file}`
        );

        continue;
      }

      registerCommand(command);

      logger.debug(
        `Loaded command: ${command.name}`
      );
    } catch (error) {
      logger.error(
        `Failed to load command ${file}: ${error.message}`
      );
    }
  }

  logger.info(
    `Loaded ${commands.size} command(s).`
  );

  return commands;
}

function registerCommand(command) {
  const names = [
    command.name,
    ...(command.aliases || [])
  ];

  for (const name of names) {
    commands.set(
      name.toLowerCase(),
      command
    );
  }
}

export function getCommand(name) {
  return commands.get(
    name.toLowerCase()
  );
}

export function getCommands() {
  return commands;
}
