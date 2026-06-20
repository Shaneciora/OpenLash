import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { clampHostScale } from "../../lib/hostScale";
import { measureInverseFillScale } from "../../lib/hostGameFitScale";

interface Props {
  scale: number;
  children: ReactNode;
  className?: string;
}

function measureEffectiveScale(
  outer: HTMLElement,
  content: HTMLElement,
  userScale: number
): number {
  const outerW = outer.clientWidth;
  const outerH = outer.clientHeight;
  if (outerW <= 0 || outerH <= 0) return clampHostScale(userScale);

  const logicalW = outerW / userScale;
  const logicalH = outerH / userScale;

  const prev = {
    transform: content.style.transform,
    transformOrigin: content.style.transformOrigin,
    width: content.style.width,
    height: content.style.height,
    minHeight: content.style.minHeight,
  };

  content.style.transform = "none";
  content.style.transformOrigin = "center center";
  content.style.width = `${logicalW}px`;
  content.style.height = `${logicalH}px`;
  content.style.minHeight = "0";

  const fitsAtUserScale =
    content.scrollWidth <= logicalW + 1 && content.scrollHeight <= logicalH + 1;

  content.style.height = "auto";
  const contentH = content.scrollHeight;
  const contentW = content.scrollWidth;

  content.style.transform = prev.transform;
  content.style.transformOrigin = prev.transformOrigin;
  content.style.width = prev.width;
  content.style.height = prev.height;
  content.style.minHeight = prev.minHeight;

  if (fitsAtUserScale) {
    return clampHostScale(userScale);
  }

  return measureInverseFillScale(outerW, outerH, contentW, contentH, userScale);
}

export function HostGameScale({ scale: userScale, children, className }: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [effectiveScale, setEffectiveScale] = useState(() => clampHostScale(userScale));

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const content = contentRef.current;
    if (!outer || !content) return;

    let frame = 0;
    let settleTimeout = 0;

    const measure = () => {
      const next = measureEffectiveScale(outer, content, userScale);
      setEffectiveScale((prev) => (prev === next ? prev : next));
    };

    const scheduleMeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    const scheduleMeasureSettled = () => {
      scheduleMeasure();
      window.clearTimeout(settleTimeout);
      settleTimeout = window.setTimeout(scheduleMeasure, 150);
    };

    scheduleMeasureSettled();

    const observer = new ResizeObserver(scheduleMeasureSettled);
    observer.observe(outer);

    const mutationObserver = new MutationObserver(scheduleMeasure);
    mutationObserver.observe(content, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    window.addEventListener("resize", scheduleMeasureSettled);
    document.addEventListener("fullscreenchange", scheduleMeasureSettled);
    document.addEventListener("webkitfullscreenchange", scheduleMeasureSettled);
    window.visualViewport?.addEventListener("resize", scheduleMeasureSettled);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settleTimeout);
      observer.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", scheduleMeasureSettled);
      document.removeEventListener("fullscreenchange", scheduleMeasureSettled);
      document.removeEventListener("webkitfullscreenchange", scheduleMeasureSettled);
      window.visualViewport?.removeEventListener("resize", scheduleMeasureSettled);
    };
  }, [userScale, children]);

  const inversePercent = 100 / effectiveScale;

  return (
    <div
      className={`host-game-scale-outer${className ? ` ${className}` : ""}`}
      ref={outerRef}
    >
      <div
        className="host-game-scale-inner"
        ref={contentRef}
        style={{
          width: `${inversePercent}%`,
          height: `${inversePercent}%`,
          transform: `scale(${effectiveScale})`,
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
}
