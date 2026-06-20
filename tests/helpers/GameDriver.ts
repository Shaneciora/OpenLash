import type { RoomState, Prompt, GamePhase } from "../../src/shared/types.js";
import {
  createRoom,
  joinRoom,
  startGame,
  submitAnswers,
  submitVote,
  submitThriplashVote,
  advanceFromAnswerPhase,
  advanceFromVotePhase,
  advanceAfterBattleReveal,
  advancePhaseOnTimer,
  fillLobbyWithBots,
  submitBotAnswers,
  allAnswersSubmitted,
} from "../../src/game/engine.js";
import { isBot } from "../../src/game/hostbot.js";
import { answerSideForPlayer, isBattler } from "../../src/shared/battleLayout.js";
import {
  thriplashAnswerSideForPlayer,
  isThriplashBattler,
  thriplashAnswersForSide,
} from "../../src/shared/thriplashBattle.js";
import { hasSubmittedThriplashAnswers } from "../../src/shared/thriplashAnswers.js";

const prompts: Prompt[] = Array.from({ length: 24 }, (_, i) => ({
  id: String(i),
  text: `Prompt number ${i}: the funniest _____`,
  type: i >= 20 ? "thriplash" : "regular",
  mature: false,
  usCentric: false,
}));

export interface GameDriverOptions {
  botFill?: boolean;
  minPlayers?: number;
  finalRoundMode?: "thriplash" | "last_lash";
}

const BATTLE_PHASES = new Set<GamePhase>(["round1_battle", "round2_battle"]);

const REVEAL_PHASES = new Set<GamePhase>([
  "round1_battle_reveal",
  "round2_battle_reveal",
  "final_vote_reveal",
]);

const ANSWER_PHASES = new Set<GamePhase>([
  "round1_answer",
  "round2_answer",
  "final_answer",
]);

const SCORE_PHASES = new Set<GamePhase>(["round1_scores", "round2_scores"]);

export class GameDriver {
  room: RoomState;

  constructor(options: GameDriverOptions = {}) {
    this.room = createRoom("http://localhost/play", {
      minPlayers: options.minPlayers ?? 3,
      maxPlayers: options.botFill ? 3 : 8,
      botTestLobbyMode: options.botFill ? ("max" as const) : ("off" as const),
      finalRoundMode: options.finalRoundMode ?? "thriplash",
    });
  }

  addPlayer(name: string) {
    return joinRoom(this.room, name, undefined, undefined, null);
  }

  setupPlayers(options: GameDriverOptions = {}) {
    if (options.botFill) {
      this.room.settings.botTestLobbyMode = "max";
      this.addPlayer("Alice");
      fillLobbyWithBots(this.room);
      return;
    }

    this.addPlayer("Alice");
    this.addPlayer("Bob");
    this.addPlayer("Carol");
  }

  start() {
    if (this.room.settings.botTestLobbyMode !== "off") {
      fillLobbyWithBots(this.room);
    }
    startGame(this.room, prompts);
    submitBotAnswers(this.room);
  }

  getHumanPlayer() {
    return this.room.players.find((p) => !p.isAudience && !p.kicked && !isBot(p.id));
  }

  answerRound(textPrefix = "funny") {
    const players = this.room.players.filter((p) => !p.isAudience && !p.kicked);

    if (this.room.phase === "final_answer") {
      if (this.room.settings.finalRoundMode === "thriplash") {
        for (const p of players) {
          if (isBot(p.id)) continue;
          for (const tb of this.room.thriplashBattles) {
            const side = thriplashAnswerSideForPlayer(tb, p.id);
            if (!side) continue;
            if (hasSubmittedThriplashAnswers(thriplashAnswersForSide(tb, side))) continue;
            submitAnswers(this.room, p.id, [
              {
                battleId: tb.id,
                promptId: tb.promptId,
                text: `${textPrefix}-${p.name}-0`,
              },
              {
                battleId: tb.id,
                promptId: tb.promptId,
                text: `${textPrefix}-${p.name}-1`,
              },
              {
                battleId: tb.id,
                promptId: tb.promptId,
                text: `${textPrefix}-${p.name}-2`,
              },
            ]);
          }
        }
      } else {
        for (const entry of this.room.lastLashEntries) {
          if (entry.answer?.text || isBot(entry.playerId)) continue;
          submitAnswers(this.room, entry.playerId, [
            { promptId: "lastlash", text: `${textPrefix}-${entry.playerId}` },
          ]);
        }
      }
      return;
    }

    for (const p of players) {
      if (isBot(p.id)) continue;
      for (const battle of this.room.battles) {
        const side = answerSideForPlayer(battle, p.id);
        if (!side) continue;
        const existing =
          side === "a" ? battle.answerA : side === "b" ? battle.answerB : battle.answerC;
        if (existing?.text) continue;
        submitAnswers(this.room, p.id, [
          {
            promptId: battle.promptId,
            battleId: battle.id,
            text: `${textPrefix}-${p.name}-${battle.promptId}`,
          },
        ]);
      }
    }
  }

  voteCurrentBattle(choice: "a" | "b" = "a") {
    if (
      this.room.phase === "final_vote" &&
      this.room.settings.finalRoundMode === "thriplash"
    ) {
      const tb = this.room.thriplashBattles[this.room.currentBattleIndex];
      if (!tb) return;
      for (const p of this.room.players) {
        if (isThriplashBattler(tb, p.id) || p.isAudience || !p.connected) {
          continue;
        }
        submitThriplashVote(this.room, p.id, tb.id, choice);
      }
      return;
    }

    if (!BATTLE_PHASES.has(this.room.phase)) {
      return;
    }

    const battle = this.room.battles[this.room.currentBattleIndex];
    if (!battle) return;

    for (const p of this.room.players) {
      if (isBattler(battle, p.id) || p.isAudience || !p.connected) {
        continue;
      }
      submitVote(this.room, p.id, battle.id, choice);
    }
  }

  tick(): boolean {
    submitBotAnswers(this.room);

    if (ANSWER_PHASES.has(this.room.phase)) {
      this.answerRound(`r${this.room.round}`);
      submitBotAnswers(this.room);
      if (allAnswersSubmitted(this.room)) {
        return advanceFromAnswerPhase(this.room);
      }
      return false;
    }

    if (this.room.phase === "final_vote") {
      if (this.room.settings.finalRoundMode === "thriplash") {
        this.voteCurrentBattle();
        return advanceFromVotePhase(this.room, { force: true });
      }
      advancePhaseOnTimer(this.room);
      return true;
    }

    if (BATTLE_PHASES.has(this.room.phase)) {
      this.voteCurrentBattle();
      return advanceFromVotePhase(this.room, { force: true });
    }

    if (REVEAL_PHASES.has(this.room.phase)) {
      advanceAfterBattleReveal(this.room);
      return true;
    }

    if (SCORE_PHASES.has(this.room.phase) || this.room.phase === "final_reveal") {
      advancePhaseOnTimer(this.room);
      return true;
    }

    return false;
  }

  playToPodium(options: GameDriverOptions = {}): GamePhase {
    this.setupPlayers(options);
    this.start();

    let steps = 0;
    while (this.room.phase !== "podium" && steps < 400) {
      this.tick();
      steps++;
    }

    return this.room.phase;
  }

  countBattlesPlayedInRound(round: 1 | 2): number {
    const prefix = round === 1 ? "round1_battle" : "round2_battle";
    return this.room.battles.filter((b) => b.result !== null).length;
  }
}
