import { HOSTBOT_ID } from "./constants.js";

export const FILLER_BOT_ID_PREFIX = "__filler_bot__";

export function isBotPlayerId(playerId: string): boolean {
  return playerId === HOSTBOT_ID || playerId.startsWith(FILLER_BOT_ID_PREFIX);
}
