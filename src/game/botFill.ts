import type { GameSettings } from "../shared/types.js";
import { isBotFillEnabled } from "../shared/botFillMode.js";

export { isBotFillEnabled } from "../shared/botFillMode.js";

export function getBotFillTargetCount(settings: GameSettings): number {
  if (!isBotFillEnabled(settings)) return settings.maxPlayers;
  if (settings.botTestLobbyMode === "lobby_3") return 3;
  if (settings.botTestLobbyMode === "lobby_7") return 7;
  if (settings.botTestLobbyMode === "lobby_full") return settings.maxPlayers;
  return settings.maxPlayers;
}

export function fillsLobbyImmediately(settings: GameSettings): boolean {
  return (
    settings.botTestLobbyMode === "lobby_3" ||
    settings.botTestLobbyMode === "lobby_7" ||
    settings.botTestLobbyMode === "lobby_full"
  );
}
