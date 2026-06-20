import { getDb } from "./client.js";
import type { GameSettings, Prompt } from "../shared/types.js";
import { DEFAULT_SETTINGS } from "../shared/types.js";
import { generateId } from "../shared/ids.js";
import {
  DEFAULT_COLLECTION_NAME,
  DEFAULT_COLLECTION_PROMPTS,
} from "./defaultCollectionPrompts.js";

const BUILTIN_PROMPTS: Omit<Prompt, "id">[] = DEFAULT_COLLECTION_PROMPTS.slice(0, 25);

export async function seedBuiltinPrompts() {
  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) as c FROM prompts WHERE is_builtin = 1").get() as { c: number };
  if (count.c > 0) return;

  const insert = db.prepare(
    "INSERT INTO prompts (collection_id, text, type, mature, us_centric, is_builtin) VALUES (?, ?, ?, ?, ?, 1)"
  );
  for (const p of BUILTIN_PROMPTS) {
    insert.run(null, p.text, p.type, p.mature ? 1 : 0, p.usCentric ? 1 : 0);
  }
}

export function seedDefaultCollection(): number {
  const db = getDb();
  let row = db
    .prepare("SELECT id FROM collections WHERE name = ?")
    .get(DEFAULT_COLLECTION_NAME) as { id: number } | undefined;

  if (!row) {
    const now = new Date().toISOString();
    const created = db
      .prepare(
        "INSERT INTO collections (name, created_at, updated_at) VALUES (?, ?, ?) RETURNING id"
      )
      .get(DEFAULT_COLLECTION_NAME, now, now) as { id: number };
    row = { id: created.id };
  }

  const count = db
    .prepare("SELECT COUNT(*) as c FROM prompts WHERE collection_id = ?")
    .get(row.id) as { c: number };

  if (count.c === 0) {
    const insert = db.prepare(
      "INSERT INTO prompts (collection_id, text, type, mature, us_centric, is_builtin) VALUES (?, ?, ?, ?, ?, 0)"
    );
    for (const p of DEFAULT_COLLECTION_PROMPTS) {
      insert.run(row.id, p.text, p.type, p.mature ? 1 : 0, p.usCentric ? 1 : 0);
    }
  }

  return row.id;
}

export function getDefaultCollectionId(): number | null {
  const db = getDb();
  const row = db
    .prepare("SELECT id FROM collections WHERE name = ?")
    .get(DEFAULT_COLLECTION_NAME) as { id: number } | undefined;
  return row?.id ?? null;
}

export function resolveLobbySettings(settings?: Partial<GameSettings>): Partial<GameSettings> {
  const merged: Partial<GameSettings> = { ...settings };
  if (!merged.promptSource) merged.promptSource = DEFAULT_SETTINGS.promptSource;
  if (merged.promptSource === "collection" && merged.collectionId == null) {
    const id = getDefaultCollectionId();
    if (id != null) merged.collectionId = id;
  }
  return merged;
}

export function loadPromptsSync(
  collectionId: number | null,
  source: "builtin" | "collection" | "mixed"
): Prompt[] {
  const db = getDb();
  let rows: {
    id: number;
    text: string;
    type: string;
    mature: number;
    us_centric: number;
  }[];

  if (source === "builtin") {
    rows = db.prepare("SELECT * FROM prompts WHERE is_builtin = 1").all() as typeof rows;
  } else if (source === "collection" && collectionId) {
    rows = db.prepare("SELECT * FROM prompts WHERE collection_id = ?").all(collectionId) as typeof rows;
  } else {
    rows = db
      .prepare("SELECT * FROM prompts WHERE is_builtin = 1 OR collection_id IS NOT NULL")
      .all() as typeof rows;
  }

  if (rows.length === 0) {
    return DEFAULT_COLLECTION_PROMPTS.map((p) => ({ ...p, id: generateId() }));
  }

  return rows.map((r) => ({
    id: String(r.id),
    text: r.text,
    type: r.type as "regular" | "thriplash",
    mature: !!r.mature,
    usCentric: !!r.us_centric,
  }));
}
