import type { BattleAnswerSide } from "./battleLayout.js";

export type ThriplashBattleLike = {
  playerA: string;
  playerB: string;
  playerC: string | null;
  answersA: { text: string }[];
  answersB: { text: string }[];
  answersC: { text: string }[];
};

export {
  isTripleBattle as isTripleThriplashBattle,
  battlerIds as thriplashBattlerIds,
  isBattler as isThriplashBattler,
  answerSideForPlayer as thriplashAnswerSideForPlayer,
} from "./battleLayout.js";

export function thriplashAnswersForSide(
  battle: ThriplashBattleLike,
  side: BattleAnswerSide
) {
  if (side === "a") return battle.answersA;
  if (side === "b") return battle.answersB;
  return battle.answersC;
}
