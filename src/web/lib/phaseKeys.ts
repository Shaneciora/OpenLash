import type { GamePhase, PublicRoomState } from "../../shared/types";

export function getHostScreenKey(state: PublicRoomState): string {
  const { phase, currentBattleIndex } = state;

  if (phase === "final_vote") {
    return state.settings.finalRoundMode === "thriplash"
      ? `final_vote_${currentBattleIndex}`
      : "final_vote_last_lash";
  }

  if (phase === "round1_battle" || phase === "round2_battle") {
    return `${phase}_${currentBattleIndex}`;
  }

  if (phase === "round1_battle_reveal" || phase === "round2_battle_reveal") {
    return `${phase}_${currentBattleIndex}`;
  }

  if (phase === "final_vote_reveal") {
    return `final_vote_reveal_${currentBattleIndex}`;
  }

  return phase;
}

export function getPlayScreenKey(state: PublicRoomState): string {
  return getHostScreenKey(state);
}

export type TransitionVariant = "fade" | "reveal-in" | "next-battle" | "scores";

export function getTransitionVariant(
  from: string | null,
  to: string
): TransitionVariant {
  if (!from || from === to) return "fade";

  const fromReveal =
    from.includes("_battle_reveal") || from.startsWith("final_vote_reveal");
  const toBattle = to.includes("_battle_") && !to.includes("_reveal");
  const fromBattle =
    from.includes("_battle_") && !from.includes("_reveal");
  const toReveal =
    to.includes("_battle_reveal") || to.startsWith("final_vote_reveal");

  if (fromBattle && toReveal) return "reveal-in";
  if (fromReveal && toBattle) return "next-battle";
  if (to.endsWith("_scores") || to === "final_reveal" || to === "podium") {
    return "scores";
  }

  return "fade";
}

export function isAnswerPhase(phase: GamePhase): boolean {
  return (
    phase === "round1_answer" ||
    phase === "round2_answer" ||
    phase === "final_answer"
  );
}

export function isGameBgmPhase(phase: GamePhase): boolean {
  return phase !== "lobby" && phase !== "podium" && !isAnswerPhase(phase);
}
