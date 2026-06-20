import { buildJoinUrlFromRequest } from "./lan.js";
import { getNgrokPlayBase } from "./ngrok.js";

export type JoinBaseSource = "public" | "lan" | null;

export async function resolvePlayJoinBase(
  hostHeader: string | undefined,
  port: number
): Promise<{ playBase: string | null; source: JoinBaseSource }> {
  const manual = buildJoinUrlFromRequest(hostHeader, port);
  if (process.env.PUBLIC_URL && manual) {
    return { playBase: manual, source: "public" };
  }

  const ngrokBase = await getNgrokPlayBase();
  if (ngrokBase) {
    return { playBase: ngrokBase, source: "public" };
  }

  if (manual) {
    return { playBase: manual, source: "lan" };
  }

  return { playBase: null, source: null };
}
