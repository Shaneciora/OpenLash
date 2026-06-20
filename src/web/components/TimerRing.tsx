import { useEffect, useState } from "react";
import type { PublicRoomState } from "../../shared/types";

type Props = {
  endsAt: number | null;
  paused?: boolean;
  pausedRemainingMs?: number | null;
};

export function timerRingProps(state: PublicRoomState): Props {
  return {
    endsAt: state.phaseEndsAt,
    paused: state.paused,
    pausedRemainingMs: state.pausedRemainingMs,
  };
}

export function TimerRing({ endsAt, paused = false, pausedRemainingMs = null }: Props) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (paused && pausedRemainingMs !== null) {
      setRemaining(Math.max(0, Math.ceil(pausedRemainingMs / 1000)));
      return;
    }
    if (!endsAt) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [endsAt, paused, pausedRemainingMs]);

  const pulse = remaining > 0 && remaining <= 10;

  return (
    <div
      className="timer-ring"
      data-testid="timer-ring"
      style={{
        animation: pulse ? "pulse 0.5s infinite alternate" : undefined,
        borderColor: pulse ? "var(--color-coral)" : "var(--color-ink)",
      }}
    >
      {remaining}
      <style>{`
        @keyframes pulse {
          from { transform: scale(1); }
          to { transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}
