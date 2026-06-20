export type BattleLayoutLike = {
  playerA: string;
  playerB: string;
  playerC: string | null;
};

export function isTripleBattle(battle: BattleLayoutLike): boolean {
  return battle.playerC != null;
}

export function battlerIds(battle: BattleLayoutLike): string[] {
  if (battle.playerC) {
    return [battle.playerA, battle.playerB, battle.playerC];
  }
  return [battle.playerA, battle.playerB];
}

export function isBattler(battle: BattleLayoutLike, playerId: string): boolean {
  return battlerIds(battle).includes(playerId);
}

export type BattleAnswerSide = "a" | "b" | "c";

export function answerSideForPlayer(
  battle: BattleLayoutLike,
  playerId: string
): BattleAnswerSide | null {
  if (battle.playerA === playerId) return "a";
  if (battle.playerB === playerId) return "b";
  if (battle.playerC === playerId) return "c";
  return null;
}
