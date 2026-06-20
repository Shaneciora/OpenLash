import { Hono } from "hono";
import { cors } from "hono/cors";
import { getDb } from "../db/client.js";
import { DEFAULT_SETTINGS } from "../shared/types.js";
import { resolvePlayJoinBase } from "./joinBase.js";
import { z } from "zod";

const app = new Hono();

app.use("/api/*", cors());

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/join-base", async (c) => {
  const host = c.req.header("host");
  const port = Number(process.env.PORT ?? 3000);
  const { playBase, source } = await resolvePlayJoinBase(host, port);
  const needsLanAccess = !playBase;

  return c.json({
    playBase,
    source,
    warning: needsLanAccess
      ? "Open the host page using your LAN IP address, or set NGROK_AUTHTOKEN in .env for cross-network play."
      : undefined,
  });
});

app.get("/api/collections", (c) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.*, COUNT(p.id) as prompt_count
       FROM collections c
       LEFT JOIN prompts p ON p.collection_id = c.id
       GROUP BY c.id
       ORDER BY c.id`
    )
    .all();
  return c.json(rows);
});

app.post("/api/collections", async (c) => {
  const body = await c.req.json();
  const name = z.string().min(1).max(20).parse(body.name);
  const db = getDb();
  const now = new Date().toISOString();
  const result = db
    .prepare("INSERT INTO collections (name, created_at, updated_at) VALUES (?, ?, ?) RETURNING *")
    .get(name, now, now);
  return c.json(result);
});

app.get("/api/collections/:id", (c) => {
  const id = Number(c.req.param("id"));
  const db = getDb();
  const col = db.prepare("SELECT * FROM collections WHERE id = ?").get(id);
  if (!col) return c.json({ error: "Not found" }, 404);
  const pr = db.prepare("SELECT * FROM prompts WHERE collection_id = ?").all(id);
  return c.json({ collection: col, prompts: pr });
});

app.post("/api/collections/:id/prompts", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const text = z.string().min(1).max(120).parse(body.text);
  const type = z.enum(["regular", "thriplash"]).parse(body.type ?? "regular");
  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO prompts (collection_id, text, type, mature, us_centric, is_builtin) VALUES (?, ?, ?, ?, ?, 0) RETURNING *"
    )
    .get(id, text, type, body.mature ? 1 : 0, body.usCentric ? 1 : 0);
  return c.json(result);
});

app.delete("/api/prompts/:id", (c) => {
  const id = Number(c.req.param("id"));
  const db = getDb();
  const row = db.prepare("SELECT id FROM prompts WHERE id = ? AND is_builtin = 0").get(id);
  if (!row) return c.json({ error: "Not found" }, 404);
  db.prepare("DELETE FROM prompts WHERE id = ?").run(id);
  return c.json({ ok: true });
});

app.patch("/api/prompts/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const parsed = z
    .object({
      text: z.string().min(1).max(120).optional(),
      type: z.enum(["regular", "thriplash"]).optional(),
      mature: z.boolean().optional(),
    })
    .parse(body);

  const db = getDb();
  const existing = db.prepare("SELECT * FROM prompts WHERE id = ? AND is_builtin = 0").get(id) as
    | { id: number; text: string; type: string; mature: number }
    | undefined;
  if (!existing) return c.json({ error: "Not found" }, 404);

  const text = parsed.text ?? existing.text;
  const type = parsed.type ?? existing.type;
  const mature = parsed.mature !== undefined ? (parsed.mature ? 1 : 0) : existing.mature;

  db.prepare("UPDATE prompts SET text = ?, type = ?, mature = ? WHERE id = ?").run(
    text,
    type,
    mature,
    id
  );

  const updated = db.prepare("SELECT * FROM prompts WHERE id = ?").get(id);
  return c.json(updated);
});

app.post("/api/collections/:id/import", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const items = z
    .array(
      z.object({
        text: z.string().max(120),
        type: z.enum(["regular", "thriplash"]).optional(),
        mature: z.boolean().optional(),
      })
    )
    .parse(body.prompts);
  const db = getDb();
  const insert = db.prepare(
    "INSERT INTO prompts (collection_id, text, type, mature, us_centric, is_builtin) VALUES (?, ?, ?, ?, 0, 0)"
  );
  for (const item of items) {
    insert.run(id, item.text, item.type ?? "regular", item.mature ? 1 : 0);
  }
  return c.json({ imported: items.length });
});

app.get("/api/settings-presets", (c) => {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM settings_presets").all() as {
    id: number;
    name: string;
    settings_json: string;
  }[];
  return c.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      settings: JSON.parse(r.settings_json),
    }))
  );
});

app.post("/api/settings-presets", async (c) => {
  const body = await c.req.json();
  const name = z.string().min(1).parse(body.name);
  const settings = body.settings ?? DEFAULT_SETTINGS;
  const db = getDb();
  const result = db
    .prepare("INSERT INTO settings_presets (name, settings_json) VALUES (?, ?) RETURNING *")
    .get(name, JSON.stringify(settings)) as { id: number };
  return c.json({ id: result.id, name, settings });
});

export { app as httpApp };
