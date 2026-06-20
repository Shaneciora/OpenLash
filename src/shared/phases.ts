import type { GamePhase } from "./types.js";

export function canPauseGame(phase: GamePhase): boolean {
  return phase !== "lobby" && phase !== "podium";
}
