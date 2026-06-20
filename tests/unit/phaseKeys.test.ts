import { describe, it, expect } from "vitest";
import {
  getHostScreenKey,
  getTransitionVariant,
  isGameBgmPhase,
} from "../../src/web/lib/phaseKeys";
import type { PublicRoomState } from "../../src/shared/types";
import { DEFAULT_SETTINGS } from "../../src/shared/types";

function baseState(overrides: Partial<PublicRoomState> = {}): PublicRoomState {
  return {
    code: "ABCD",
    phase: "lobby",
    settings: DEFAULT_SETTINGS,
    players: [],
    joinUrl: "http://localhost/play/ABCD",
    vipId: null,
    phaseEndsAt: null,
    round: 1,
    battles: [],
    currentBattleIndex: 0,
    thriplashBattles: [],
    lastLashPrompt: null,
    lastLashEntries: [],
    modPassword: null,
    highlights: [],
    paused: false,
    pausedRemainingMs: null,
    ...overrides,
  };
}

describe("phaseKeys", () => {
  it("keys battles by index", () => {
    expect(
      getHostScreenKey(
        baseState({ phase: "round1_battle", currentBattleIndex: 2 })
      )
    ).toBe("round1_battle_2");
    expect(
      getHostScreenKey(
        baseState({ phase: "round1_battle_reveal", currentBattleIndex: 1 })
      )
    ).toBe("round1_battle_reveal_1");
  });

  it("picks transition variants for battle flow", () => {
    expect(
      getTransitionVariant("round1_battle_0", "round1_battle_reveal_0")
    ).toBe("reveal-in");
    expect(
      getTransitionVariant("round1_battle_reveal_0", "round1_battle_1")
    ).toBe("next-battle");
    expect(getTransitionVariant("round1_answer", "round1_battle_0")).toBe("fade");
    expect(getTransitionVariant("round1_battle_reveal_2", "round1_scores")).toBe(
      "scores"
    );
  });

  it("identifies phases that should play game background music", () => {
    expect(isGameBgmPhase("lobby")).toBe(false);
    expect(isGameBgmPhase("round1_answer")).toBe(false);
    expect(isGameBgmPhase("round1_battle")).toBe(true);
    expect(isGameBgmPhase("round1_battle_reveal")).toBe(true);
    expect(isGameBgmPhase("round1_scores")).toBe(true);
    expect(isGameBgmPhase("podium")).toBe(false);
  });
});
