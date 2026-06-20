import { useEffect, useState } from "react";
import {
  buildPhonePlayBase,
  isUsableJoinHostname,
  isUsablePlayBase,
  pickPhoneJoinIp,
} from "../../shared/joinUrl";

async function fetchJoinBaseFromApi(): Promise<string | null> {
  try {
    const res = await fetch("/api/join-base");
    const data = (await res.json()) as { playBase: string | null };
    if (data.playBase && isUsablePlayBase(data.playBase)) {
      return data.playBase;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function discoverPhoneJoinIp(): Promise<string | null> {
  if (typeof RTCPeerConnection === "undefined") return null;

  return new Promise((resolve) => {
    const candidates = new Set<string>();
    let finished = false;

    const pc = new RTCPeerConnection({ iceServers: [] });

    const finish = () => {
      if (finished) return;
      finished = true;
      pc.close();
      resolve(pickPhoneJoinIp(candidates));
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        finish();
        return;
      }
      if (!event.candidate.candidate.includes(" typ host ")) return;
      for (const part of event.candidate.candidate.split(" ")) {
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(part)) {
          candidates.add(part);
        }
      }
    };

    pc.createDataChannel("openlash");
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(() => finish());

    setTimeout(finish, 1500);
  });
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

async function resolvePhoneJoinBase(): Promise<{ playBase: string | null; warning: string | null }> {
  const apiBase = await fetchJoinBaseFromApi();
  if (apiBase) {
    return { playBase: apiBase, warning: null };
  }

  const { hostname, port } = window.location;
  const portStr = port || "3000";

  if (!isLocalHostname(hostname) && isUsableJoinHostname(hostname)) {
    const base = buildPhonePlayBase(hostname, portStr);
    if (base) {
      return { playBase: base, warning: null };
    }
  }

  const phoneIp = await discoverPhoneJoinIp();
  if (phoneIp) {
    return { playBase: buildPhonePlayBase(phoneIp, portStr), warning: null };
  }

  return {
    playBase: null,
    warning:
      "Could not detect the address phones need. Set NGROK_AUTHTOKEN in .env for cross-network play, or open this page at http://YOUR-LAN-IP:3000/host.",
  };
}

export function usePlayJoinBase() {
  const [playJoinBase, setPlayJoinBase] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      const { playBase, warning: nextWarning } = await resolvePhoneJoinBase();
      if (cancelled) return;
      setPlayJoinBase(playBase);
      setWarning(nextWarning);
    }

    resolve();
    const interval = setInterval(resolve, 10_000);
    window.addEventListener("online", resolve);
    window.addEventListener("focus", resolve);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("online", resolve);
      window.removeEventListener("focus", resolve);
    };
  }, []);

  return { playJoinBase, warning };
}
