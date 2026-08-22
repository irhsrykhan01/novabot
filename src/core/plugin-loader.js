import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { registerCommand } from "./command-loader.js";
import { logger } from "./logger.js";
import * as storage from "../storage/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLUGINS_PATH = path.resolve(__dirname, "../plugins");

const plugins = new Map();

export async function loadPlugins() {
  await fs.mkdir(PLUGINS_PATH, { recursive: true });

  const entries = await fs.readdir(PLUGINS_PATH, {
    withFileTypes: true
  });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const pluginFile = path.join(
      PLUGINS_PATH,
      entry.name,
      "index.js"
    );

    try {
      const module = await import(
        `${pathToFileURL(pluginFile).href}?t=${Date.now()}`
      );

      const plugin = module.default;

      if (!plugin?.name) {
        logger.warn(`Invalid plugin: ${entry.name}`);
        continue;
      }

      if (plugins.has(plugin.name)) {
        logger.warn(`Duplicate plugin: ${plugin.name}`);
        continue;
      }

      if (Array.isArray(plugin.commands)) {
        for (const command of plugin.commands) {
          registerCommand(command);
        }
      }

      if (typeof plugin.init === "function") {
        await plugin.init({
          storage
        });
      }

      plugins.set(plugin.name, plugin);

      logger.info(`Loaded plugin: ${plugin.name}`);
    } catch (error) {
      logger.error(
        `Failed to load plugin ${entry.name}: ${error.message}`
      );
    }
  }

  logger.info(`Loaded ${plugins.size} plugin(s).`);
}

export function getPlugins() {
  return plugins;
}
