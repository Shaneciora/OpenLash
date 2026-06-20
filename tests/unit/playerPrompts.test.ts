import { describe, it, expect } from "vitest";
import {
  getPendingAnswerPrompts,
  playerHasSubmittedAnswers,
} from "../../src/shared/playerPrompts.js";
import { submitAnswers, createRoom, joinRoom } from "../../src/game/engine.js";
import { buildThriplashPairings } from "../../src/game/pairing.js";
import {
  thriplashAnswerSideForPlayer,
  thriplashAnswersForSide,
} from "../../src/shared/thriplashBattle.js";
import type { Prompt } from "../../src/shared/types.js";

const tripleBattle = {
  id: "battle-1",
  promptId: "p1",
  promptText: "Prompt one",
  playerA: "alice",
  playerB: "bob",
  playerC: "carol",
  answerA: null as { text: string } | null,
  answerB: null as { text: string } | null,
  answerC: null as { text: string } | null,
};

describe("playerPrompts", () => {
  const base = {
    phase: "round1_answer",
    settings: { finalRoundMode: "thriplash" as const },
    thriplashBattles: [],
    lastLashPrompt: null,
    lastLashEntries: [],
    battles: [
      tripleBattle,
      {
        ...tripleBattle,
        id: "battle-2",
        promptId: "p2",
        promptText: "Prompt two",
      },
    ],
  };

  it("lists each thriplash battle prompt separately for multi-battle players", () => {
    const pending = getPendingAnswerPrompts(
      {
        ...base,
        phase: "final_answer",
        settings: { finalRoundMode: "thriplash" },
        battles: [],
        thriplashBattles: [
          {
            id: "tb-1",
            promptId: "p1",
            promptText: "Prompt one",
            playerA: "alice",
            playerB: "bob",
            playerC: null,
            answersA: [],
            answersB: [],
            answersC: [],
          },
          {
            id: "tb-2",
            promptId: "p2",
            promptText: "Prompt two",
            playerA: "alice",
            playerB: "carol",
            playerC: null,
            answersA: [{ text: "a" }, { text: "b" }, { text: "c" }],
            answersB: [],
            answersC: [],
          },
        ],
      },
      "alice"
    );
    expect(pending).toHaveLength(1);
    expect(pending[0].battleId).toBe("tb-1");
    expect(pending[0].inputTestId).toBe("answer-input-tb-1");
  });

  it("returns false while any assigned battle answer is missing", () => {
    expect(playerHasSubmittedAnswers(base, "alice")).toBe(false);
  });

  it("returns true when all player battles are answered", () => {
    const done = {
      ...base,
      battles: base.battles.map((b) => ({ ...b, answerA: { text: "quip" } })),
    };
    expect(playerHasSubmittedAnswers(done, "alice")).toBe(true);
    expect(getPendingAnswerPrompts(done, "alice")).toHaveLength(0);
  });

  it("treats players with no battles as done", () => {
    expect(playerHasSubmittedAnswers(base, "__filler_bot__0")).toBe(true);
    expect(getPendingAnswerPrompts(base, "__filler_bot__0")).toHaveLength(0);
  });

  it("keeps thriplash prompts separate when submitting one battle at a time", () => {
    const prompts: Prompt[] = Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      text: `Prompt ${i}`,
      type: "thriplash" as const,
      mature: false,
      usCentric: false,
    }));
    const room = createRoom("http://localhost/play", { finalRoundMode: "thriplash" });
    const alice = joinRoom(room, "Alice", undefined, undefined, null).player;
    const bob = joinRoom(room, "Bob", undefined, undefined, null).player;
    joinRoom(room, "Carol", undefined, undefined, null).player;

    const playerIds = [alice.id, bob.id, room.players[2].id];
    const { battles } = buildThriplashPairings(playerIds, prompts);
    room.phase = "final_answer";
    room.thriplashBattles = battles.map((b) => ({
      ...b,
      answersA: [],
      answersB: [],
      answersC: [],
      votesA: [],
      votesB: [],
      votesC: [],
      abstentions: [],
      result: null,
    }));

    const pending = getPendingAnswerPrompts(room, alice.id);
    expect(pending).toHaveLength(2);

    const first = pending[0];
    const err = submitAnswers(room, alice.id, [
      { battleId: first.battleId, promptId: first.promptId, text: "one" },
      { battleId: first.battleId, promptId: first.promptId, text: "two" },
      { battleId: first.battleId, promptId: first.promptId, text: "three" },
    ]);
    expect(err).toBeNull();

    const remaining = getPendingAnswerPrompts(room, alice.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].battleId).not.toBe(first.battleId);

    const otherBattle = room.thriplashBattles.find((b) => b.id === remaining[0].battleId)!;
    const side = thriplashAnswerSideForPlayer(otherBattle, alice.id)!;
    expect(thriplashAnswersForSide(otherBattle, side)).toHaveLength(0);
    expect(playerHasSubmittedAnswers(room, alice.id)).toBe(false);

    expect(
      submitAnswers(room, alice.id, [
        { promptId: first.promptId, text: "nope" },
        { promptId: first.promptId, text: "nope" },
        { promptId: first.promptId, text: "nope" },
      ])
    ).toBe("battleId required for thriplash answers");
  });
});
