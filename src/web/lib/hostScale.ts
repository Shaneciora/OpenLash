const STORAGE_KEY = "openlash_host_scale";
export const HOST_SCALE_MIN = 0.5;
export const HOST_SCALE_MAX = 2;
export const HOST_SCALE_DEFAULT = 1;

export function clampHostScale(value: number): number {
  if (!Number.isFinite(value)) return HOST_SCALE_DEFAULT;
  return Math.min(HOST_SCALE_MAX, Math.max(HOST_SCALE_MIN, Math.round(value * 100) / 100));
}

export function getHostScale(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return HOST_SCALE_DEFAULT;
    return clampHostScale(Number(raw));
  } catch {
    return HOST_SCALE_DEFAULT;
  }
}

export function setHostScale(value: number): number {
  const scale = clampHostScale(value);
  localStorage.setItem(STORAGE_KEY, String(scale));
  return scale;
}
