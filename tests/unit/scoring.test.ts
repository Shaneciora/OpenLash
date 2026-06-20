import { describe, it, expect } from "vitest";
import { scoreBattle, scoreLastLash, scoreTripleBattle } from "../../src/game/scoring.js";

const baseAnswer = {
  playerId: "a",
  text: "funny",
  censored: false,
  moderated: false,
  approved: true,
};

describe("scoring", () => {
  it("awards points by vote percentage", () => {
    const result = scoreBattle({
      votesA: 3,
      votesB: 1,
      totalVoters: 4,
      audienceVotesA: 0,
      audienceVotesB: 0,
      round: 1,
      answerA: { ...baseAnswer, playerId: "a" },
      answerB: { ...baseAnswer, playerId: "b", text: "also funny" },
      playerCount: 4,
    });
    expect(result.pointsA).toBeGreaterThan(result.pointsB);
    expect(result.jinx).toBe(false);
  });

  it("detects jinx", () => {
    const result = scoreBattle({
      votesA: 2,
      votesB: 2,
      totalVoters: 4,
      audienceVotesA: 0,
      audienceVotesB: 0,
      round: 1,
      answerA: { ...baseAnswer, text: "Same Answer" },
      answerB: { ...baseAnswer, text: "same answer" },
      playerCount: 4,
    });
    expect(result.jinx).toBe(true);
    expect(result.pointsA).toBe(0);
    expect(result.pointsB).toBe(0);
  });

  it("distributes last lash pool", () => {
    const points = scoreLastLash(
      [
        { playerId: "a", votes: 3 },
        { playerId: "b", votes: 1 },
      ],
      3
    );
    expect(points.a + points.b).toBeCloseTo(9000, -1);
    expect(points.a).toBeGreaterThan(points.b);
  });

  it("awards triple battle points by vote share", () => {
    const answer = {
      playerId: "a",
      text: "funny",
      censored: false,
      moderated: false,
      approved: true,
    };
    const result = scoreTripleBattle({
      votesA: 4,
      votesB: 2,
      votesC: 1,
      round: 3,
      answerA: answer,
      answerB: { ...answer, playerId: "b", text: "also" },
      answerC: { ...answer, playerId: "c", text: "third" },
    });
    expect(result.pointsA).toBeGreaterThan(result.pointsB);
    expect(result.pointsB).toBeGreaterThan(result.pointsC);
    expect(result.winnerId).toBe("a");
  });
});
