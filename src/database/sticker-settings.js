import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SETTINGS_DIR = path.join(
  __dirname,
  "../../data"
);

const SETTINGS_FILE = path.join(
  SETTINGS_DIR,
  "sticker-settings.json"
);

const DEFAULT_SETTINGS = {
  pack: "NovaBot",
  author: "Rashii"
};

let cache = null;

async function ensureFile() {
  await fs.mkdir(
    SETTINGS_DIR,
    {
      recursive: true
    }
  );

  try {
    await fs.access(SETTINGS_FILE);
  } catch {
    await fs.writeFile(
      SETTINGS_FILE,
      JSON.stringify(
        DEFAULT_SETTINGS,
        null,
        2
      ),
      "utf8"
    );
  }
}

async function loadSettings() {
  if (cache) {
    return cache;
  }

  await ensureFile();

  try {
    const raw =
      await fs.readFile(
        SETTINGS_FILE,
        "utf8"
      );

    const parsed =
      JSON.parse(raw);

    cache = {
      ...DEFAULT_SETTINGS,
      ...parsed
    };

    return cache;
  } catch {
    cache = {
      ...DEFAULT_SETTINGS
    };

    return cache;
  }
}

async function saveSettings(settings) {
  await ensureFile();

  cache = {
    ...DEFAULT_SETTINGS,
    ...settings
  };

  await fs.writeFile(
    SETTINGS_FILE,
    JSON.stringify(
      cache,
      null,
      2
    ),
    "utf8"
  );

  return cache;
}

export async function getStickerSettings() {
  return loadSettings();
}

export async function setStickerSettings(
  pack,
  author
) {
  return saveSettings({
    pack,
    author
  });
}
