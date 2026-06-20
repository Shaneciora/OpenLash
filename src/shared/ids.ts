import { ROOM_CODE_CHARS, ROOM_CODE_LENGTH } from "../shared/constants.js";

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

export function isValidRoomCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) return false;
  return [...code.toUpperCase()].every((c) => ROOM_CODE_CHARS.includes(c));
}

export function generateToken(): string {
  return crypto.randomUUID();
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function normalizeAnswer(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}
