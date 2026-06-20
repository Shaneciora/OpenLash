import os from "os";
import { isUsableJoinHostname, isUsablePlayBase, pickPhoneJoinIp } from "../shared/joinUrl.js";

/** Docker bridge / private ranges that phones on WiFi cannot reach */
export function isUnreachableHostIp(ip: string): boolean {
  return !isUsableJoinHostname(ip);
}

export function detectLanIpFromInterfaces(): string | null {
  const interfaces = os.networkInterfaces();
  const candidates: string[] = [];

  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name];
    if (!nets) continue;
    for (const net of nets) {
      if (net.family !== "IPv4" || net.internal) continue;
      if (isUsableJoinHostname(net.address)) {
        candidates.push(net.address);
      }
    }
  }

  return pickPhoneJoinIp(candidates);
}

export function getLanIp(): string | null {
  const detected = detectLanIpFromInterfaces();
  if (detected) return detected;

  if (process.env.PUBLIC_HOST && isUsableJoinHostname(process.env.PUBLIC_HOST)) {
    return process.env.PUBLIC_HOST;
  }

  return null;
}

export function buildJoinUrlFromRequest(
  hostHeader: string | undefined,
  port: number
): string | null {
  if (process.env.PUBLIC_URL) {
    const base = process.env.PUBLIC_URL.replace(/\/$/, "");
    const url = base.endsWith("/play") ? base : `${base}/play`;
    return isUsablePlayBase(url) ? url : null;
  }

  if (hostHeader) {
    const hostname = hostHeader.split(":")[0];
    if (isUsableJoinHostname(hostname)) {
      const host = hostHeader.includes(":") ? hostHeader : `${hostHeader}:${port}`;
      return `http://${host}/play`;
    }
  }

  const detected = detectLanIpFromInterfaces();
  if (detected) {
    return `http://${detected}:${port}/play`;
  }

  if (process.env.PUBLIC_HOST && isUsableJoinHostname(process.env.PUBLIC_HOST)) {
    return `http://${process.env.PUBLIC_HOST}:${port}/play`;
  }

  return null;
}

export function buildJoinUrl(port: number, code?: string): string | null {
  const ip = getLanIp();
  if (!ip) return null;
  const base = `http://${ip}:${port}/play`;
  return code ? `${base}/${code}` : base;
}
