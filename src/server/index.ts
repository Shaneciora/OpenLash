import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import type { Server as HttpServer } from "node:http";
import { httpApp } from "./http.js";
import { setupSocket } from "./socket.js";
import { buildJoinUrl, getLanIp } from "./lan.js";
import { seedBuiltinPrompts, seedDefaultCollection } from "../db/seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function ensureSounds(webRoot: string): void {
  const src = path.join(process.cwd(), "sounds");
  const dest = path.join(webRoot, "sounds");
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const file of fs.readdirSync(src)) {
    if (file.endsWith(".wav") || file.endsWith(".mp3")) {
      fs.copyFileSync(path.join(src, file), path.join(dest, file));
    }
  }
}

export async function createAppServer(options?: {
  port?: number;
  webRoot?: string;
  skipSeed?: boolean;
}): Promise<{ server: HttpServer; port: number }> {
  const requestedPort = options?.port ?? Number(process.env.PORT ?? 3000);
  const defaultWeb = path.join(__dirname, "../web");
  const WEB_ROOT =
    options?.webRoot ??
    (fs.existsSync(path.join(defaultWeb, "index.html"))
      ? defaultWeb
      : path.join(process.cwd(), "dist/web"));

  ensureSounds(WEB_ROOT);

  if (!options?.skipSeed) {
    await seedBuiltinPrompts();
    seedDefaultCollection();
  }

  const app = httpApp;
  app.use("/*", serveStatic({ root: WEB_ROOT }));
  app.get("*", serveStatic({ root: WEB_ROOT, path: "index.html" }));

  return new Promise((resolve) => {
    const server = serve(
      {
        fetch: app.fetch,
        port: requestedPort,
        hostname: process.env.HOST ?? "0.0.0.0",
      },
      (info) => {
        setupSocket(server as HttpServer, info.port);
        resolve({ server: server as HttpServer, port: info.port });
      }
    ) as HttpServer;
  });
}

async function main() {
  const { port } = await createAppServer({
    webRoot: path.join(__dirname, "../web"),
  });
  const lanIp = getLanIp();
  const joinUrl = buildJoinUrl(port);
  console.log(`OpenLash running at http://${lanIp ?? "localhost"}:${port}`);
  console.log(`Join players at ${joinUrl ?? `http://YOUR-LAN-IP:${port}/play`}`);
  console.log(`Host display at http://${lanIp}:${port}/host`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("index.js")) {
  main().catch(console.error);
}
