import type { Player, PublicRoomState } from "../../shared/types";

export function resolveRoomPlayer(
  state: PublicRoomState,
  player: Player
): Player {
  const token =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("openlash_token")
      : null;
  if (token) {
    const byToken = state.players.find((p) => p.token === token);
    if (byToken) return byToken;
  }
  return state.players.find((p) => p.id === player.id) ?? player;
}
