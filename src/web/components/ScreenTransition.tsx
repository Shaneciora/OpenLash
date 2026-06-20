import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { TransitionVariant } from "../lib/phaseKeys";
import { getTransitionVariant } from "../lib/phaseKeys";

const DURATION_MS = 520;

type Snapshot = {
  key: string;
  node: ReactNode;
  variant: TransitionVariant;
};

interface Props {
  screenKey: string;
  children: ReactNode;
  className?: string;
  reducedMotion?: boolean;
}

export function ScreenTransition({
  screenKey,
  children,
  className,
  reducedMotion,
}: Props) {
  const prevKeyRef = useRef<string | null>(null);
  const childrenRef = useRef(children);
  childrenRef.current = children;
  const [snapshots, setSnapshots] = useState<Snapshot[]>([
    { key: screenKey, node: children, variant: "fade" },
  ]);
  const duration = reducedMotion ? 0 : DURATION_MS;

  useEffect(() => {
    const variant = getTransitionVariant(prevKeyRef.current, screenKey);
    prevKeyRef.current = screenKey;

    setSnapshots((prev) => {
      const last = prev[prev.length - 1];
      if (last?.key === screenKey) return prev;

      const outgoing = prev[prev.length - 1];
      if (!outgoing) {
        return [{ key: screenKey, node: childrenRef.current, variant }];
      }

      if (duration === 0) {
        return [{ key: screenKey, node: childrenRef.current, variant }];
      }

      return [
        { ...outgoing, variant },
        { key: screenKey, node: childrenRef.current, variant },
      ];
    });
  }, [screenKey, duration]);

  useEffect(() => {
    setSnapshots((prev) => {
      if (prev.length > 1) return prev;
      const last = prev[prev.length - 1];
      if (last?.key !== screenKey) return prev;
      return [{ ...last, node: children }];
    });
  }, [children, screenKey]);

  useLayoutEffect(() => {
    if (snapshots.length <= 1) return;
    if (duration === 0) {
      setSnapshots((prev) =>
        prev.length > 1 ? [prev[prev.length - 1]] : prev
      );
      return;
    }
    const timer = window.setTimeout(() => {
      setSnapshots((prev) =>
        prev.length > 1 ? [prev[prev.length - 1]] : prev
      );
    }, duration);
    return () => window.clearTimeout(timer);
  }, [snapshots.length, duration, snapshots[snapshots.length - 1]?.key]);

  return (
    <div
      className={`screen-transition${className ? ` ${className}` : ""}${
        reducedMotion ? " screen-transition--instant" : ""
      }`}
      data-testid="screen-transition"
      data-transitioning={snapshots.length > 1 ? "true" : "false"}
    >
      {snapshots.map((snap, index) => {
        const isLast = index === snapshots.length - 1;
        const isExiting = snapshots.length > 1 && index === 0;
        const isEntering = snapshots.length > 1 && isLast;

        return (
          <div
            key={`${snap.key}-${isExiting ? "exit" : "active"}`}
            className={[
              "screen-transition__layer",
              isExiting && `screen-transition__layer--exit screen-transition__layer--${snap.variant}`,
              isEntering && `screen-transition__layer--enter screen-transition__layer--${snap.variant}`,
              !isExiting && !isEntering && "screen-transition__layer--static",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {snap.node}
          </div>
        );
      })}
    </div>
  );
}
