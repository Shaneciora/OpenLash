import { useCallback, useEffect, useState } from "react";

function getFullscreenElement(): Element | null {
  return (
    document.fullscreenElement ??
    (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement ??
    null
  );
}

async function enterFullscreen(): Promise<void> {
  const el = document.documentElement;
  if (el.requestFullscreen) {
    await el.requestFullscreen();
    return;
  }
  const webkit = el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  if (webkit.webkitRequestFullscreen) {
    await webkit.webkitRequestFullscreen();
  }
}

async function leaveFullscreen(): Promise<void> {
  if (document.exitFullscreen) {
    await document.exitFullscreen();
    return;
  }
  const webkitDoc = document as Document & { webkitExitFullscreen?: () => Promise<void> };
  if (webkitDoc.webkitExitFullscreen) {
    await webkitDoc.webkitExitFullscreen();
  }
}

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supported] = useState(() => {
    if (typeof document === "undefined") return false;
    const el = document.documentElement;
    return Boolean(
      el.requestFullscreen ||
        (el as HTMLElement & { webkitRequestFullscreen?: unknown }).webkitRequestFullscreen
    );
  });

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(getFullscreenElement()));
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const toggle = useCallback(async () => {
    if (getFullscreenElement()) {
      await leaveFullscreen();
    } else {
      await enterFullscreen();
    }
  }, []);

  return { isFullscreen, toggle, supported };
}
