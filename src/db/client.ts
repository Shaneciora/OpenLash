import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const DB_PATH = process.env.DB_PATH ?? path.join(DATA_DIR, "openlash.db");

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  db = new DatabaseSync(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER,
      text TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'regular',
      mature INTEGER NOT NULL DEFAULT 0,
      us_centric INTEGER NOT NULL DEFAULT 0,
      is_builtin INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS settings_presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      settings_json TEXT NOT NULL
    );
  `);
  return db;
}

export function closeDb() {
  db?.close();
  db = null;
}
