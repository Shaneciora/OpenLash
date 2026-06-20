import type { GameSettings } from "./types.js";

export function isBotFillEnabled(settings: GameSettings): boolean {
  return settings.botTestLobbyMode !== "off";
}
