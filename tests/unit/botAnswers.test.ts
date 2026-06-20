import { describe, expect, it } from "vitest";
import {
  BOT_ANSWER_POOL,
  pickBotAnswerText,
  pickBotThriplashAnswers,
} from "../../src/game/botAnswers.js";
import { getBotAnswerText, getHostBotAnswers } from "../../src/game/hostbot.js";

describe("botAnswers", () => {
  it("has at least 100 unique single-word answers", () => {
    expect(BOT_ANSWER_POOL.length).toBeGreaterThanOrEqual(100);
    expect(new Set(BOT_ANSWER_POOL).size).toBe(BOT_ANSWER_POOL.length);
    for (const answer of BOT_ANSWER_POOL) {
      expect(answer.trim().split(/\s+/)).toHaveLength(1);
    }
  });

  it("picks answers from the pool", () => {
    expect(BOT_ANSWER_POOL).toContain(pickBotAnswerText());
  });

  it("picks three unique thriplash answers", () => {
    const answers = pickBotThriplashAnswers();
    expect(answers).toHaveLength(3);
    expect(new Set(answers).size).toBe(3);
    for (const answer of answers) {
      expect(BOT_ANSWER_POOL).toContain(answer);
    }
  });

  it("exposes hostbot helpers from the pool", () => {
    expect(BOT_ANSWER_POOL).toContain(getBotAnswerText());
    const thriplash = getHostBotAnswers();
    expect(thriplash).toHaveLength(3);
    expect(new Set(thriplash).size).toBe(3);
  });
});
