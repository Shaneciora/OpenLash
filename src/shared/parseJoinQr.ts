import { isValidRoomCode } from "./ids.js";

const PLAY_CODE_PATH = /\/play\/([A-Za-z0-9]{4})\/?$/;

export function parseRoomCodeFromJoinQr(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (isValidRoomCode(trimmed)) {
    return trimmed.toUpperCase();
  }

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(PLAY_CODE_PATH);
    if (match && isValidRoomCode(match[1])) {
      return match[1].toUpperCase();
    }
  } catch {
    const pathMatch = trimmed.match(PLAY_CODE_PATH);
    if (pathMatch && isValidRoomCode(pathMatch[1])) {
      return pathMatch[1].toUpperCase();
    }
  }

  return null;
}
