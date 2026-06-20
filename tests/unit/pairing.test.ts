import { describe, it, expect } from "vitest";
import {
  buildPairings,
  buildThriplashPairings,
  promptsNeededForPlayers,
} from "../../src/game/pairing.js";
import type { Prompt } from "../../src/shared/types.js";

function makePrompts(n: number): Prompt[] {
  return Array.from({ length: n }, (_, i) => ({
    id: String(i),
    text: `Prompt ${i}`,
    type: "regular" as const,
    mature: false,
    usCentric: false,
  }));
}

describe("pairing", () => {
  it("assigns 2 prompts per player for 4 players", () => {
    const ids = ["a", "b", "c", "d"];
    const { assignedPrompts, battles } = buildPairings(ids, makePrompts(8));
    for (const id of ids) {
      expect(assignedPrompts[id]).toHaveLength(2);
    }
    expect(battles).toHaveLength(4);
    expect(battles.every((b) => b.playerC === null)).toBe(true);
  });

  it("handles 2 players", () => {
    const ids = ["a", "b"];
    const { battles, assignedPrompts } = buildPairings(ids, makePrompts(6));
    expect(battles).toHaveLength(2);
    expect(assignedPrompts.a).toHaveLength(2);
    expect(assignedPrompts.b).toHaveLength(2);
  });

  it("uses pair battles for 3 players with 2 prompts each", () => {
    const ids = ["a", "b", "c"];
    const { battles, assignedPrompts } = buildPairings(ids, makePrompts(6));
    expect(battles).toHaveLength(3);
    expect(battles.every((b) => b.playerC === null)).toBe(true);
    for (const id of ids) {
      expect(assignedPrompts[id]).toHaveLength(2);
    }
  });

  it("uses pair battles for 7 players with 2 prompts each", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g"];
    const { battles, assignedPrompts } = buildPairings(ids, makePrompts(12));
    expect(battles).toHaveLength(7);
    expect(battles.every((b) => b.playerC === null)).toBe(true);
    for (const id of ids) {
      expect(assignedPrompts[id]).toHaveLength(2);
    }
  });

  it("calculates prompt budget", () => {
    expect(promptsNeededForPlayers(8)).toBe(12);
    expect(promptsNeededForPlayers(20)).toBe(20);
  });
});

describe("buildThriplashPairings", () => {
  it("creates pair battles for 8 players with 2 prompts each", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const { battles, assignedPrompts } = buildThriplashPairings(ids, makePrompts(12));
    expect(battles).toHaveLength(8);
    for (const id of ids) {
      expect(assignedPrompts[id]).toHaveLength(2);
    }
    const promptIds = battles.map((b) => b.promptId);
    expect(new Set(promptIds).size).toBe(8);
    expect(battles.every((b) => b.playerC === null)).toBe(true);
  });

  it("creates pair battles for 3 players with 2 prompts each", () => {
    const ids = ["a", "b", "c"];
    const { battles, assignedPrompts } = buildThriplashPairings(ids, makePrompts(12));
    expect(battles).toHaveLength(3);
    expect(battles.every((b) => b.playerC === null)).toBe(true);
    expect(new Set(battles.map((b) => b.promptId)).size).toBe(3);
    for (const id of ids) {
      expect(assignedPrompts[id]).toHaveLength(2);
      expect(new Set(assignedPrompts[id]).size).toBe(2);
    }
  });

  it("creates pair battles for 7 players with 2 prompts each", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g"];
    const { battles, assignedPrompts } = buildThriplashPairings(ids, makePrompts(12));
    expect(battles).toHaveLength(7);
    expect(battles.every((b) => b.playerC === null)).toBe(true);
    for (const id of ids) {
      expect(assignedPrompts[id]).toHaveLength(2);
    }
  });

  it("creates pair battles for 5 players with 2 prompts each", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const { battles, assignedPrompts } = buildThriplashPairings(ids, makePrompts(12));
    expect(battles).toHaveLength(5);
    expect(battles.every((b) => b.playerC === null)).toBe(true);
    for (const id of ids) {
      expect(assignedPrompts[id]).toHaveLength(2);
    }
  });
});
