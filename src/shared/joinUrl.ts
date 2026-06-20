export function isUsableJoinHostname(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return false;
  return true;
}

export function isUsablePlayBase(url: string): boolean {
  try {
    return isUsableJoinHostname(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Pick the LAN IP phones on the same Wi-Fi should use to reach this host. */
export function pickPhoneJoinIp(candidates: Iterable<string>): string | null {
  const usable = [...new Set(candidates)].filter(isUsableJoinHostname);
  return (
    usable.find((ip) => ip.startsWith("192.168.")) ??
    usable.find((ip) => ip.startsWith("10.")) ??
    usable[0] ??
    null
  );
}

export function buildPhonePlayBase(hostname: string, port: number | string): string | null {
  if (!isUsableJoinHostname(hostname)) return null;
  const portStr = String(port || 3000);
  return `http://${hostname}:${portStr}/play`;
}
