import { describe, it, expect } from "vitest";
import { playerHasSubmittedAnswers } from "../../src/shared/playerStatus.js";

const emptyBattle = {
  id: "battle-a",
  promptId: "p0",
  promptText: "Prompt",
  playerC: null as string | null,
  answerC: null as { text: string } | null,
};

describe("playerHasSubmittedAnswers", () => {
  const base = {
    phase: "round1_answer",
    settings: { finalRoundMode: "thriplash" as const },
    thriplashBattles: [],
    lastLashEntries: [],
    battles: [
      {
        ...emptyBattle,
        id: "battle-b",
        playerA: "alice",
        playerB: "bob",
        answerA: null,
        answerB: { text: "bob answer" },
      },
      {
        ...emptyBattle,
        id: "battle-c",
        playerA: "alice",
        playerB: "carol",
        answerA: null,
        answerB: null,
      },
    ],
  };

  it("returns false when player still has empty answers", () => {
    expect(playerHasSubmittedAnswers(base, "alice")).toBe(false);
  });

  it("returns true when all player battles have answers", () => {
    const done = {
      ...base,
      battles: base.battles.map((b) =>
        b.playerA === "alice"
          ? { ...b, answerA: { text: "alice quip" } }
          : b
      ),
    };
    expect(playerHasSubmittedAnswers(done, "alice")).toBe(true);
  });

  it("tracks bot answer status like humans", () => {
    expect(playerHasSubmittedAnswers(base, "__filler_bot__0")).toBe(true);

    const botPending = {
      ...base,
      battles: [
        {
          ...emptyBattle,
          playerA: "__filler_bot__0",
          playerB: "alice",
          answerA: null,
          answerB: { text: "alice answer" },
        },
      ],
    };
    expect(playerHasSubmittedAnswers(botPending, "__filler_bot__0")).toBe(false);

    const botDone = {
      ...botPending,
      battles: [
        {
          ...emptyBattle,
          playerA: "__filler_bot__0",
          playerB: "alice",
          answerA: { text: "bot quip" },
          answerB: { text: "alice answer" },
        },
      ],
    };
    expect(playerHasSubmittedAnswers(botDone, "__filler_bot__0")).toBe(true);
  });
});
