import { useEffect, useRef } from "react";
import { msUntilAutoSubmit } from "../lib/phaseTimer";

export function usePhaseTimerExpiry(
  endsAt: number | null,
  paused: boolean,
  onExpiry: () => void,
  enabled = true
): void {
  const onExpiryRef = useRef(onExpiry);
  onExpiryRef.current = onExpiry;
  const firedForEndsAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const delay = msUntilAutoSubmit(endsAt, paused);
    if (delay === null) return;

    const fire = () => {
      if (firedForEndsAtRef.current === endsAt) return;
      firedForEndsAtRef.current = endsAt;
      onExpiryRef.current();
    };

    if (delay <= 0) {
      fire();
      return;
    }

    const id = setTimeout(fire, delay);
    return () => clearTimeout(id);
  }, [endsAt, paused, enabled]);
}
