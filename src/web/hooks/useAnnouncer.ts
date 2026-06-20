import { useEffect, useRef, useState } from "react";

export function useAnnouncer(text: string | null, enabled = true): string | null {
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const lastRef = useRef<string | null>(null);

  useEffect(() => {
    if (!text || !enabled) {
      setSubtitle(null);
      return;
    }

    if (text === lastRef.current) return;

    if (new URLSearchParams(window.location.search).get("e2e") === "1") {
      setSubtitle(null);
      return;
    }

    lastRef.current = text;

    if (!("speechSynthesis" in window)) {
      setSubtitle(text);
      const timer = setTimeout(() => setSubtitle(null), 4000);
      return () => clearTimeout(timer);
    }

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.88;
    utter.pitch = 1.1;
    utter.onstart = () => setSubtitle(text);
    utter.onend = () => setSubtitle(null);
    utter.onerror = () => setSubtitle(null);
    window.speechSynthesis.speak(utter);

    return () => {
      window.speechSynthesis.cancel();
      setSubtitle(null);
    };
  }, [text, enabled]);

  useEffect(() => {
    if (!text) lastRef.current = null;
  }, [text]);

  return subtitle;
}
