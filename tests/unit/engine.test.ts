import { describe, it, expect } from "vitest";
import { isBattler, answerSideForPlayer } from "../../src/shared/battleLayout.js";
import {
  createRoom,
  joinRoom,
  leavePlayer,
  kickPlayer,
  canStartGame,
  fillLobbyWithBots,
  applyBotLobbySettings,
  startGame,
  submitAnswers,
  allAnswersSubmitted,
  submitBotAnswers,
  advanceFromAnswerPhase,
  advanceFromVotePhase,
  beginBattlePhase,
  submitVote,
  finishBattleVoting,
  advanceAfterBattleReveal,
  advanceFromScores,
  pauseGame,
  resumeGame,
  resetToLobby,
  syncLobbyPlayers,
} from "../../src/game/engine.js";
import type { Prompt } from "../../src/shared/types.js";
import { isBot } from "../../src/game/hostbot.js";

const prompts: Prompt[] = Array.from({ length: 20 }, (_, i) => ({
  id: String(i),
  text: `Something funny about ${i}`,
  type: i < 16 ? "regular" : "thriplash",
  mature: false,
  usCentric: false,
}));

describe("engine", () => {
  it("creates lobby and joins players", () => {
    const room = createRoom("http://localhost/play");
    const r1 = joinRoom(room, "Alice", undefined, undefined, null);
    const r2 = joinRoom(room, "Bob", undefined, undefined, null);
    const r3 = joinRoom(room, "Carol", undefined, undefined, null);
    expect(r1.player.isVip).toBe(true);
    expect(r2.player.isVip).toBe(false);
    expect(canStartGame(room)).toBe(true);
    expect(room.players).toHaveLength(3);
  });

  it("starts game and accepts answers", () => {
    const room = createRoom("http://localhost/play");
    joinRoom(room, "Alice", undefined, undefined, null);
    joinRoom(room, "Bob", undefined, undefined, null);
    joinRoom(room, "Carol", undefined, undefined, null);
    startGame(room, prompts);

    const p1 = room.players[0];
    for (const pid of room.assignedPrompts[p1.id] ?? []) {
      submitAnswers(room, p1.id, [{ promptId: pid, text: `Answer for ${pid}` }]);
    }
    expect(room.phase).toBe("round1_answer");
  });

  it("rejects wrong password", () => {
    const room = createRoom("http://localhost/play", { password: "secret" });
    const r = joinRoom(room, "Alice", undefined, "wrong", null);
    expect(r.error).toBe("Wrong password");
  });

  it("removes leaving player and promotes next VIP in lobby", () => {
    const room = createRoom("http://localhost/play");
    const alice = joinRoom(room, "Alice", undefined, undefined, null).player;
    const bob = joinRoom(room, "Bob", undefined, undefined, null).player;
    joinRoom(room, "Carol", undefined, undefined, null);

    leavePlayer(room, alice.id);

    expect(room.players).toHaveLength(2);
    expect(room.players.find((p) => p.id === alice.id)).toBeUndefined();
    expect(room.vipId).toBe(bob.id);
    expect(room.players.find((p) => p.id === bob.id)?.isVip).toBe(true);
  });

  it("removes leaving player and promotes next VIP on podium", () => {
    const room = createRoom("http://localhost/play");
    const alice = joinRoom(room, "Alice", undefined, undefined, null).player;
    const bob = joinRoom(room, "Bob", undefined, undefined, null).player;
    room.phase = "podium";

    leavePlayer(room, alice.id);

    expect(room.players).toHaveLength(1);
    expect(room.vipId).toBe(bob.id);
    expect(bob.isVip).toBe(true);
  });

  it("resetToLobby removes disconnected players", () => {
    const room = createRoom("http://localhost/play");
    const alice = joinRoom(room, "Alice", undefined, undefined, null).player;
    const bob = joinRoom(room, "Bob", undefined, undefined, null).player;
    bob.connected = false;
    room.phase = "podium";

    resetToLobby(room);

    expect(room.phase).toBe("lobby");
    expect(room.players).toHaveLength(1);
    expect(room.players[0].id).toBe(alice.id);
    expect(room.vipId).toBe(alice.id);
  });

  it("syncLobbyPlayers is a no-op outside lobby", () => {
    const room = createRoom("http://localhost/play");
    joinRoom(room, "Alice", undefined, undefined, null);
    const bob = joinRoom(room, "Bob", undefined, undefined, null).player;
    bob.connected = false;
    room.phase = "podium";

    expect(syncLobbyPlayers(room)).toBe(false);
    expect(room.players).toHaveLength(2);
  });

  it("syncLobbyPlayers removes disconnected players in lobby", () => {
    const room = createRoom("http://localhost/play");
    const alice = joinRoom(room, "Alice", undefined, undefined, null).player;
    const bob = joinRoom(room, "Bob", undefined, undefined, null).player;
    bob.connected = false;

    expect(syncLobbyPlayers(room)).toBe(true);
    expect(room.players).toHaveLength(1);
    expect(room.players[0].id).toBe(alice.id);
    expect(syncLobbyPlayers(room)).toBe(false);
  });

  it("kicks player, shifts lobby list, and promotes next VIP", () => {
    const room = createRoom("http://localhost/play");
    const alice = joinRoom(room, "Alice", undefined, undefined, null).player;
    const bob = joinRoom(room, "Bob", undefined, undefined, null).player;
    joinRoom(room, "Carol", undefined, undefined, null);

    kickPlayer(room, alice.id);

    const active = room.players.filter((p) => !p.isAudience && !p.kicked);
    expect(active).toHaveLength(2);
    expect(active[0].name).toBe("Bob");
    expect(room.vipId).toBe(bob.id);
    expect(bob.isVip).toBe(true);
    expect(room.players.find((p) => p.id === alice.id)?.kicked).toBe(true);
    expect(room.kickedTokens.has(alice.token)).toBe(true);
  });

  it("applyBotLobbySettings removes bots when debug mode is off", () => {
    const room = createRoom("http://localhost/play", {
      botTestLobbyMode: "lobby_3",
      maxPlayers: 8,
    });
    joinRoom(room, "Alice", undefined, undefined, null);
    fillLobbyWithBots(room);
    expect(room.players.filter((p) => isBot(p.id)).length).toBe(2);

    room.settings.botTestLobbyMode = "off";
    applyBotLobbySettings(room);
    expect(room.players.filter((p) => isBot(p.id)).length).toBe(0);
    expect(room.players).toHaveLength(1);
  });

  it("allows solo start with bot fill and fills bots to min players", () => {
    const room = createRoom("http://localhost/play", {
      botTestLobbyMode: "max" as const,
      minPlayers: 3,
      maxPlayers: 3,
    });
    joinRoom(room, "Alice", undefined, undefined, null);
    expect(canStartGame(room)).toBe(true);
    fillLobbyWithBots(room);
    expect(room.players).toHaveLength(3);
    expect(room.players.filter((p) => p.name.startsWith("Bot"))).toHaveLength(2);
    startGame(room, prompts);
    submitBotAnswers(room);
    expect(room.phase).toBe("round1_answer");
    expect(allAnswersSubmitted(room)).toBe(false);
    const human = room.players.find((p) => p.name === "Alice")!;
    for (const pid of room.assignedPrompts[human.id] ?? []) {
      submitAnswers(room, human.id, [{ promptId: pid, text: `Answer for ${pid}` }]);
    }
    submitBotAnswers(room);
    expect(allAnswersSubmitted(room)).toBe(true);
    expect(advanceFromAnswerPhase(room)).toBe(true);
    expect(room.phase).toBe("round1_battle");
  });

  it("bot fill lobby creates multiple battles with human prompts", () => {
    const room = createRoom("http://localhost/play", {
      botTestLobbyMode: "max" as const,
      minPlayers: 3,
      maxPlayers: 3,
    });
    joinRoom(room, "Alice", undefined, undefined, null);
    fillLobbyWithBots(room);
    startGame(room, prompts);

    const human = room.players.find((p) => p.name === "Alice")!;
    expect(room.battles.length).toBeGreaterThanOrEqual(2);
    expect(room.assignedPrompts[human.id]?.length).toBe(2);

    const humanBattles = room.battles.filter((b) => isBattler(b, human.id));
    expect(humanBattles.length).toBe(2);

    for (const pid of room.assignedPrompts[human.id] ?? []) {
      submitAnswers(room, human.id, [{ promptId: pid, text: `My answer ${pid}` }]);
    }
    submitBotAnswers(room);
    advanceFromAnswerPhase(room);

    expect(room.phase).toBe("round1_battle");
    expect(room.currentBattleIndex).toBe(0);

    let battlesShown = 0;
    while (room.phase === "round1_battle" || room.phase === "round1_battle_reveal") {
      if (room.phase === "round1_battle") {
        battlesShown++;
        const battle = room.battles[room.currentBattleIndex];
        if (!isBattler(battle, human.id)) {
          submitVote(room, human.id, battle.id, "a");
        }
        advanceFromVotePhase(room, { force: true });
      } else {
        advanceAfterBattleReveal(room);
      }
    }

    expect(battlesShown).toBe(room.battles.length);
    expect(room.phase).toBe("round1_scores");

    for (const pid of room.assignedPrompts[human.id] ?? []) {
      const battle = room.battles.find(
        (b) => b.promptId === pid && answerSideForPlayer(b, human.id) !== null
      );
      expect(battle).toBeDefined();
      const side = answerSideForPlayer(battle!, human.id);
      const ans =
        side === "a" ? battle!.answerA : side === "b" ? battle!.answerB : battle!.answerC;
      expect(ans?.text).toContain("My answer");
    }
  });

  it("bot fill adds bots up to maxPlayers even when minPlayers is 1", () => {
    const room = createRoom("http://localhost/play", {
      botTestLobbyMode: "max" as const,
      minPlayers: 1,
      maxPlayers: 3,
    });
    joinRoom(room, "Alice", undefined, undefined, null);
    fillLobbyWithBots(room);
    expect(room.players).toHaveLength(3);
    startGame(room, prompts);
    expect(room.battles.length).toBe(3);
  });

  it("resolves battle voting into reveal phase", () => {
    const room = createRoom("http://localhost/play");
    joinRoom(room, "Alice", undefined, undefined, null);
    joinRoom(room, "Bob", undefined, undefined, null);
    joinRoom(room, "Carol", undefined, undefined, null);
    joinRoom(room, "Dave", undefined, undefined, null);
    startGame(room, prompts);
    for (const p of room.players) {
      for (const pid of room.assignedPrompts[p.id] ?? []) {
        submitAnswers(room, p.id, [{ promptId: pid, text: `Answer ${pid}` }]);
      }
    }
    beginBattlePhase(room);
    const battle = room.battles[0];
    for (const p of room.players) {
      if (isBattler(battle, p.id)) continue;
      submitVote(room, p.id, battle.id, "a");
    }
    finishBattleVoting(room);
    expect(room.phase).toBe("round1_battle_reveal");
    expect(battle.result).not.toBeNull();
    expect(
      battle.votesA.length + battle.votesB.length + battle.votesC.length
    ).toBeGreaterThan(0);
  });

  it("counts abstentions as submitted votes", () => {
    const room = createRoom("http://localhost/play");
    joinRoom(room, "Alice", undefined, undefined, null);
    joinRoom(room, "Bob", undefined, undefined, null);
    joinRoom(room, "Carol", undefined, undefined, null);
    joinRoom(room, "Dave", undefined, undefined, null);
    startGame(room, prompts);
    for (const p of room.players) {
      for (const pid of room.assignedPrompts[p.id] ?? []) {
        submitAnswers(room, p.id, [{ promptId: pid, text: `Answer ${pid}` }]);
      }
    }
    beginBattlePhase(room);
    const battle = room.battles[0];
    const voters = room.players.filter((p) => !isBattler(battle, p.id));
    expect(voters.length).toBeGreaterThanOrEqual(2);
    submitVote(room, voters[0].id, battle.id, "a");
    submitVote(room, voters[1].id, battle.id, "abstain");
    expect(advanceFromVotePhase(room, { force: true })).toBe(voters.length === 2);
    if (voters.length > 2) {
      submitVote(room, voters[2].id, battle.id, "b");
      expect(advanceFromVotePhase(room, { force: true })).toBe(true);
    }
    expect(room.phase).toBe("round1_battle_reveal");
  });

  it("holds auto vote advance during grace after entering battle", () => {
    const room = createRoom("http://localhost/play", {
      botTestLobbyMode: "max" as const,
      minPlayers: 3,
      maxPlayers: 3,
    });
    joinRoom(room, "Alice", undefined, undefined, null);
    fillLobbyWithBots(room);
    startGame(room, prompts);
    submitBotAnswers(room);
    const human = room.players.find((p) => p.name === "Alice")!;
    for (const pid of room.assignedPrompts[human.id] ?? []) {
      submitAnswers(room, human.id, [{ promptId: pid, text: `A ${pid}` }]);
    }
    submitBotAnswers(room);
    advanceFromAnswerPhase(room);
    expect(room.battleVoteGraceUntil).not.toBeNull();

    const battle = room.battles[room.currentBattleIndex];
    const humanCanVote = !isBattler(battle, human.id);

    if (humanCanVote) {
      submitVote(room, human.id, battle.id, "a");
      expect(advanceFromVotePhase(room, { force: true })).toBe(true);
      return;
    }

    expect(advanceFromVotePhase(room)).toBe(false);
    room.battleVoteGraceUntil = Date.now() - 1;
    expect(advanceFromVotePhase(room)).toBe(true);
  });

  it("does not reuse prompts between round 1 and round 2", () => {
    const regularPrompts: Prompt[] = Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      text: `Prompt ${i}`,
      type: "regular" as const,
      mature: false,
      usCentric: false,
    }));
    const room = createRoom("http://localhost/play");
    joinRoom(room, "Alice", undefined, undefined, null);
    joinRoom(room, "Bob", undefined, undefined, null);
    joinRoom(room, "Carol", undefined, undefined, null);
    startGame(room, regularPrompts);

    const round1PromptIds = new Set(room.battles.map((b) => b.promptId));
    expect(round1PromptIds.size).toBe(3);

    for (const p of room.players) {
      for (const pid of room.assignedPrompts[p.id] ?? []) {
        submitAnswers(room, p.id, [{ promptId: pid, text: `Answer ${pid}` }]);
      }
    }
    beginBattlePhase(room);
    while (room.phase === "round1_battle" || room.phase === "round1_battle_reveal") {
      if (room.phase === "round1_battle") {
        const battle = room.battles[room.currentBattleIndex];
        for (const p of room.players) {
          if (isBattler(battle, p.id)) continue;
          submitVote(room, p.id, battle.id, "a");
        }
        advanceFromVotePhase(room, { force: true });
      } else {
        advanceAfterBattleReveal(room);
      }
    }
    expect(room.phase).toBe("round1_scores");

    advanceFromScores(room);
    expect(room.phase).toBe("round2_answer");

    const round2PromptIds = room.battles.map((b) => b.promptId);
    for (const id of round2PromptIds) {
      expect(round1PromptIds.has(id)).toBe(false);
    }
  });

  it("pauses and resumes phase timers", () => {
    const room = createRoom("http://localhost/play");
    joinRoom(room, "Alice", undefined, undefined, null);
    joinRoom(room, "Bob", undefined, undefined, null);
    joinRoom(room, "Carol", undefined, undefined, null);
    startGame(room, prompts);

    expect(room.phaseEndsAt).not.toBeNull();
    expect(pauseGame(room)).toBe(true);
    expect(room.paused).toBe(true);
    expect(room.phaseEndsAt).toBeNull();
    expect(room.pauseRemainingMs).toBeGreaterThan(0);

    expect(resumeGame(room)).toBe(true);
    expect(room.paused).toBe(false);
    expect(room.phaseEndsAt).toBeGreaterThan(Date.now());
    expect(room.pauseRemainingMs).toBeNull();
  });

  it("cannot pause in lobby or podium", () => {
    const room = createRoom("http://localhost/play");
    expect(pauseGame(room)).toBe(false);

    room.phase = "podium";
    expect(pauseGame(room)).toBe(false);
  });

  it("resetToLobby clears pause state", () => {
    const room = createRoom("http://localhost/play");
    joinRoom(room, "Alice", undefined, undefined, null);
    joinRoom(room, "Bob", undefined, undefined, null);
    joinRoom(room, "Carol", undefined, undefined, null);
    startGame(room, prompts);
    pauseGame(room);

    resetToLobby(room);
    expect(room.paused).toBe(false);
    expect(room.phase).toBe("lobby");
  });
});
