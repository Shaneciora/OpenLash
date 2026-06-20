import { useEffect, useRef, type ReactNode } from "react";
import {
  clearPlayVisualViewport,
  resetPlayScreenScroll,
  scrollPlayFormIntoView,
  syncPlayVisualViewport,
} from "./playVisualViewport.js";

interface Props {
  children: ReactNode;
}

function resetViewportScroll() {
  window.scrollTo(0, 0);
  document.documentElement.scrollLeft = 0;
  document.documentElement.scrollTop = 0;
  document.body.scrollLeft = 0;
  document.body.scrollTop = 0;
}

export function PlayShell({ children }: Props) {
  const appRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.add("play-route");
    document.body.classList.add("play-route");

    const app = appRef.current;
    if (!app) return;

    const onViewportChange = () => {
      const keyboardOpen = syncPlayVisualViewport(app);
      if (keyboardOpen) {
        const active = document.activeElement;
        if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
          scrollPlayFormIntoView(active);
        }
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      syncPlayVisualViewport(app);
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        scrollPlayFormIntoView(event.target);
      }
    };

    const onFocusOut = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        const resetIfKeyboardClosed = () => {
          syncPlayVisualViewport(app);
          if (!app.classList.contains("play-keyboard-open")) {
            resetViewportScroll();
            resetPlayScreenScroll(app);
          }
        };
        window.setTimeout(resetIfKeyboardClosed, 50);
        window.setTimeout(resetIfKeyboardClosed, 300);
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("input, textarea, select, .avatar-canvas-wrap")) return;
      if (app.classList.contains("play-keyboard-open") && target.closest(".play-screen")) return;
      event.preventDefault();
    };

    syncPlayVisualViewport(app);
    resetViewportScroll();
    window.visualViewport?.addEventListener("resize", onViewportChange);
    window.visualViewport?.addEventListener("scroll", onViewportChange);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("orientationchange", onViewportChange);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      window.visualViewport?.removeEventListener("resize", onViewportChange);
      window.visualViewport?.removeEventListener("scroll", onViewportChange);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("orientationchange", onViewportChange);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("touchmove", onTouchMove);
      document.documentElement.classList.remove("play-route");
      document.body.classList.remove("play-route");
      clearPlayVisualViewport(app);
      resetViewportScroll();
    };
  }, []);

  return (
    <div ref={appRef} className="play-app">
      {children}
    </div>
  );
}
