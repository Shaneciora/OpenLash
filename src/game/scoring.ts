import {
  ROUND1_MAX_POINTS,
  ROUND2_MAX_POINTS,
  ROUND3_MAX_POINTS,
  LAST_LASH_POOL,
  WINNER_BONUS_PCT,
  QUIPLASH_BONUS_R1,
  QUIPLASH_BONUS_R2,
  QUIPLASH_BONUS_R3,
  SUPER_QUIPLASH_AUDIENCE_PCT,
  QUIPLASH_MIN_PLAYERS,
} from "../shared/constants.js";
import { normalizeAnswer } from "../shared/ids.js";
import type { Answer, BattleResult } from "../shared/types.js";

export function getRoundMaxPoints(round: number): number {
  if (round === 1) return ROUND1_MAX_POINTS;
  if (round === 2) return ROUND2_MAX_POINTS;
  return ROUND3_MAX_POINTS;
}

export function getQuiplashBonus(round: number): number {
  if (round === 1) return QUIPLASH_BONUS_R1;
  if (round === 2) return QUIPLASH_BONUS_R2;
  return QUIPLASH_BONUS_R3;
}

export interface ScoreInput {
  votesA: number;
  votesB: number;
  totalVoters: number;
  audienceVotesA: number;
  audienceVotesB: number;
  round: number;
  answerA: Answer | null;
  answerB: Answer | null;
  playerCount: number;
}

export function scoreBattle(input: ScoreInput): BattleResult {
  const { answerA, answerB } = input;

  if (!answerA?.text && !answerB?.text) {
    return emptyResult();
  }
  if (!answerA?.text || answerA.censored) {
    return forfeitResult("b", input.round);
  }
  if (!answerB?.text || answerB.censored) {
    return forfeitResult("a", input.round);
  }

  const normA = normalizeAnswer(answerA.text);
  const normB = normalizeAnswer(answerB.text);
  if (normA === normB) {
    return {
      jinx: true,
      quiplash: false,
      superQuiplash: false,
      pointsA: 0,
      pointsB: 0,
      pointsC: 0,
      winnerId: null,
    };
  }

  const totalVotes = input.votesA + input.votesB;
  const maxPoints = getRoundMaxPoints(input.round);

  if (totalVotes === 0) {
    const half = Math.floor(maxPoints * WINNER_BONUS_PCT);
    return {
      jinx: false,
      quiplash: false,
      superQuiplash: false,
      pointsA: half,
      pointsB: half,
      pointsC: 0,
      winnerId: null,
    };
  }

  const pctA = input.votesA / totalVotes;
  const pctB = input.votesB / totalVotes;

  let pointsA = Math.round(pctA * maxPoints);
  let pointsB = Math.round(pctB * maxPoints);

  const playerVoters = input.totalVoters - input.audienceVotesA - input.audienceVotesB;
  const allPlayerVotesA = input.votesA > 0 && input.votesB === 0 && playerVoters > 0;
  const allPlayerVotesB = input.votesB > 0 && input.votesA === 0 && playerVoters > 0;

  let quiplash = false;
  let superQuiplash = false;
  let winnerId: "a" | "b" | "c" | null = null;

  if (input.votesA > input.votesB) {
    winnerId = "a";
    const bonus = Math.round(maxPoints * WINNER_BONUS_PCT);
    pointsA += bonus;
    if (allPlayerVotesA && input.playerCount >= QUIPLASH_MIN_PLAYERS) {
      const audTotal = input.audienceVotesA + input.audienceVotesB;
      if (audTotal > 0 && input.audienceVotesA / audTotal > 0.5) {
        quiplash = true;
        pointsA += getQuiplashBonus(input.round);
        if (input.audienceVotesA / audTotal >= SUPER_QUIPLASH_AUDIENCE_PCT) {
          superQuiplash = true;
        }
      }
    }
  } else if (input.votesB > input.votesA) {
    winnerId = "b";
    const bonus = Math.round(maxPoints * WINNER_BONUS_PCT);
    pointsB += bonus;
    if (allPlayerVotesB && input.playerCount >= QUIPLASH_MIN_PLAYERS) {
      const audTotal = input.audienceVotesA + input.audienceVotesB;
      if (audTotal > 0 && input.audienceVotesB / audTotal > 0.5) {
        quiplash = true;
        pointsB += getQuiplashBonus(input.round);
        if (input.audienceVotesB / audTotal >= SUPER_QUIPLASH_AUDIENCE_PCT) {
          superQuiplash = true;
        }
      }
    }
  }

  return { jinx: false, quiplash, superQuiplash, pointsA, pointsB, pointsC: 0, winnerId };
}

export interface TripleScoreInput {
  votesA: number;
  votesB: number;
  votesC: number;
  round: number;
  answerA: Answer | null;
  answerB: Answer | null;
  answerC: Answer | null;
}

export function scoreTripleBattle(input: TripleScoreInput): BattleResult {
  const sides: { key: "a" | "b" | "c"; answer: Answer | null; votes: number }[] = [
    { key: "a", answer: input.answerA, votes: input.votesA },
    { key: "b", answer: input.answerB, votes: input.votesB },
    { key: "c", answer: input.answerC, votes: input.votesC },
  ];

  const valid = sides.filter((s) => s.answer?.text && !s.answer.censored);
  if (valid.length === 0) return emptyResult();
  if (valid.length === 1) return forfeitResult(valid[0].key, input.round);

  const norms = valid.map((s) => normalizeAnswer(s.answer!.text));
  if (new Set(norms).size < norms.length) {
    return {
      jinx: true,
      quiplash: false,
      superQuiplash: false,
      pointsA: 0,
      pointsB: 0,
      pointsC: 0,
      winnerId: null,
    };
  }

  const totalVotes = input.votesA + input.votesB + input.votesC;
  const maxPoints = getRoundMaxPoints(input.round);

  if (totalVotes === 0) {
    const share = Math.floor(maxPoints / 3);
    return {
      jinx: false,
      quiplash: false,
      superQuiplash: false,
      pointsA: share,
      pointsB: share,
      pointsC: share,
      winnerId: null,
    };
  }

  let pointsA = Math.round((input.votesA / totalVotes) * maxPoints);
  let pointsB = Math.round((input.votesB / totalVotes) * maxPoints);
  let pointsC = Math.round((input.votesC / totalVotes) * maxPoints);

  const ranked = [
    { key: "a" as const, votes: input.votesA },
    { key: "b" as const, votes: input.votesB },
    { key: "c" as const, votes: input.votesC },
  ].sort((x, y) => y.votes - x.votes);

  let winnerId: "a" | "b" | "c" | null = null;
  if (ranked[0].votes > ranked[1].votes) {
    winnerId = ranked[0].key;
    const bonus = Math.round(maxPoints * WINNER_BONUS_PCT);
    if (winnerId === "a") pointsA += bonus;
    else if (winnerId === "b") pointsB += bonus;
    else pointsC += bonus;
  }

  return {
    jinx: false,
    quiplash: false,
    superQuiplash: false,
    pointsA,
    pointsB,
    pointsC,
    winnerId,
  };
}

function emptyResult(): BattleResult {
  return {
    jinx: false,
    quiplash: false,
    superQuiplash: false,
    pointsA: 0,
    pointsB: 0,
    pointsC: 0,
    winnerId: null,
  };
}

function forfeitResult(
  winner: "a" | "b" | "c",
  round: number
): BattleResult {
  const maxPoints = getRoundMaxPoints(round);
  const points = maxPoints;
  return {
    jinx: false,
    quiplash: false,
    superQuiplash: false,
    pointsA: winner === "a" ? points : 0,
    pointsB: winner === "b" ? points : 0,
    pointsC: winner === "c" ? points : 0,
    winnerId: winner,
  };
}

export function scoreLastLash(
  entries: { playerId: string; votes: number }[],
  roundMultiplier: number
): Record<string, number> {
  const totalVotes = entries.reduce((s, e) => s + e.votes, 0);
  const pool = LAST_LASH_POOL * roundMultiplier;
  const result: Record<string, number> = {};
  if (totalVotes === 0) {
    const each = Math.floor(pool / entries.length);
    for (const e of entries) result[e.playerId] = each;
    return result;
  }
  for (const e of entries) {
    result[e.playerId] = Math.round((e.votes / totalVotes) * pool);
  }
  return result;
}

export function getLowestScorer(
  players: { id: string; score: number }[]
): string | null {
  if (players.length === 0) return null;
  const sorted = [...players].sort((a, b) => a.score - b.score);
  return sorted[0].id;
}
