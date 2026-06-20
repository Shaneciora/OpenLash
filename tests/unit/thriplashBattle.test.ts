import { describe, it, expect } from "vitest";
import {
  isTripleBattle,
  battlerIds,
  answerSideForPlayer,
} from "../../src/shared/battleLayout.js";
import type { Battle, ThriplashBattle } from "../../src/shared/types.js";

function makeRegularBattle(overrides: Partial<Battle> = {}): Battle {
  return {
    id: "b1",
    promptId: "p1",
    promptText: "Prompt",
    playerA: "a",
    playerB: "b",
    playerC: null,
    answerA: null,
    answerB: null,
    answerC: null,
    votesA: [],
    votesB: [],
    votesC: [],
    abstentions: [],
    result: null,
    ...overrides,
  };
}

function makeThriplashBattle(overrides: Partial<ThriplashBattle> = {}): ThriplashBattle {
  return {
    id: "b1",
    promptId: "p1",
    promptText: "Prompt",
    playerA: "a",
    playerB: "b",
    playerC: null,
    answersA: [],
    answersB: [],
    answersC: [],
    votesA: [],
    votesB: [],
    votesC: [],
    abstentions: [],
    result: null,
    ...overrides,
  };
}

describe("battleLayout", () => {
  it("detects triple battles for regular and thriplash", () => {
    expect(isTripleBattle(makeRegularBattle())).toBe(false);
    expect(isTripleBattle(makeRegularBattle({ playerC: "c" }))).toBe(true);
    expect(isTripleBattle(makeThriplashBattle({ playerC: "c" }))).toBe(true);
  });

  it("lists battlers and answer sides", () => {
    const battle = makeRegularBattle({ playerC: "c" });
    expect(battlerIds(battle)).toEqual(["a", "b", "c"]);
    expect(answerSideForPlayer(battle, "b")).toBe("b");
    expect(answerSideForPlayer(battle, "z")).toBeNull();
  });
});
