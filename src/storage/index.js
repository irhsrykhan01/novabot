import fs from "node:fs/promises";
import path from "node:path";

const FILE = path.resolve("data/database.json");

const DEFAULT = {
  users: {},
  groups: {},
  settings: {}
};

let db = structuredClone(DEFAULT);

async function save() {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2));
}

export async function initStorage() {
  try {
    db = JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    db = structuredClone(DEFAULT);
    await save();
  }
}

export function getUser(id) {
  return db.users[id] ?? null;
}

export async function setUser(id, data) {
  db.users[id] = {
    ...db.users[id],
    ...data
  };
  await save();
  return db.users[id];
}

export function getGroup(id) {
  return db.groups[id] ?? null;
}

export async function setGroup(id, data) {
  db.groups[id] = {
    ...db.groups[id],
    ...data
  };
  await save();
  return db.groups[id];
}

export function getSetting(key) {
  return db.settings[key] ?? null;
}

export async function setSetting(key, value) {
  db.settings[key] = value;
  await save();
  return value;
}
