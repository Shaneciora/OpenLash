export const AUTO_SUBMIT_BUFFER_MS = 300;

export function msUntilPhaseEnd(
  endsAt: number | null,
  paused: boolean,
  now = Date.now()
): number | null {
  if (paused || endsAt === null) return null;
  return Math.max(0, endsAt - now);
}

export function msUntilAutoSubmit(
  endsAt: number | null,
  paused: boolean,
  now = Date.now()
): number | null {
  const remaining = msUntilPhaseEnd(endsAt, paused, now);
  if (remaining === null) return null;
  return Math.max(0, remaining - AUTO_SUBMIT_BUFFER_MS);
}
