import type { GamePhase } from "../../shared/types";

export function getPlayWatchTvHint(phase: GamePhase): string {
  switch (phase) {
    case "round1_battle_reveal":
    case "round2_battle_reveal":
    case "final_vote_reveal":
      return "Results are in...";
    case "round1_scores":
      return "Round 1 scores are on the TV.";
    case "round2_scores":
      return "Round 2 scores are on the TV.";
    case "final_reveal":
      return "Final results are on the TV.";
    default:
      return "Something fun is happening on the TV.";
  }
}
