import { isUsablePlayBase } from "../shared/joinUrl.js";

interface NgrokTunnel {
  public_url?: string;
  proto?: string;
}

interface NgrokTunnelsResponse {
  tunnels?: NgrokTunnel[];
}

const CACHE_MS = 10_000;

let cached: { playBase: string; fetchedAt: number } | null = null;

function ngrokApiUrl(): string | null {
  const url = process.env.NGROK_API_URL?.trim();
  return url || null;
}

function pickTunnelOrigin(tunnels: NgrokTunnel[]): string | null {
  const https = tunnels.find((t) => t.public_url?.startsWith("https://"));
  const tunnel = https ?? tunnels.find((t) => t.public_url);
  if (!tunnel?.public_url) return null;
  return tunnel.public_url.replace(/\/$/, "");
}

export function clearNgrokCache(): void {
  cached = null;
}

export async function getNgrokPlayBase(): Promise<string | null> {
  const apiUrl = ngrokApiUrl();
  if (!apiUrl) return null;

  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_MS) {
    return cached.playBase;
  }

  try {
    const res = await fetch(`${apiUrl}/api/tunnels`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return cached?.playBase ?? null;

    const data = (await res.json()) as NgrokTunnelsResponse;
    const origin = pickTunnelOrigin(data.tunnels ?? []);
    if (!origin) return cached?.playBase ?? null;

    const playBase = `${origin}/play`;
    if (!isUsablePlayBase(playBase)) return cached?.playBase ?? null;

    cached = { playBase, fetchedAt: now };
    return playBase;
  } catch {
    return cached?.playBase ?? null;
  }
}
