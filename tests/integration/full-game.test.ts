import { describe, it, expect } from "vitest";
import { GameDriver } from "../helpers/GameDriver.js";
import { isBot } from "../../src/game/hostbot.js";
import { answerSideForPlayer, isBattler } from "../../src/shared/battleLayout.js";

describe("full game loop", () => {
  it("plays three humans from lobby to podium", () => {
    const driver = new GameDriver();
    const phase = driver.playToPodium();
    expect(phase).toBe("podium");

    const scores = driver.room.players
      .filter((p) => !p.isAudience)
      .map((p) => p.score);
    expect(scores.some((s) => s > 0)).toBe(true);
    expect(driver.room.battles.length).toBeGreaterThanOrEqual(2);
  });

  it("plays bot-fill solo lobby to podium with full round 1 battles", () => {
    const driver = new GameDriver({ botFill: true, minPlayers: 3 });
    const phase = driver.playToPodium({ botFill: true });
    expect(phase).toBe("podium");

    const human = driver.getHumanPlayer();
    expect(human).toBeDefined();
    expect(driver.room.battles.length).toBe(3);

    const humanBattles = driver.room.battles.filter((b) => isBattler(b, human!.id));
    expect(humanBattles).toHaveLength(2);
    expect(driver.room.assignedPrompts[human!.id]).toHaveLength(2);

    for (const pid of driver.room.assignedPrompts[human!.id] ?? []) {
      const battle = driver.room.battles.find(
        (b) => b.promptId === pid && answerSideForPlayer(b, human!.id) !== null
      );
      expect(battle).toBeDefined();
      const side = answerSideForPlayer(battle!, human!.id);
      const answer =
        side === "a" ? battle!.answerA : side === "b" ? battle!.answerB : battle!.answerC;
      expect(answer?.text).toContain(human!.name);
    }

    expect(driver.room.battles.every((b) => b.result !== null)).toBe(true);
    expect(driver.room.players.filter((p) => !isBot(p.id)).length).toBe(1);
  });

  it("uses unique prompts across all rounds", () => {
    const driver = new GameDriver();
    driver.setupPlayers();
    driver.start();

    const promptsByRound: string[][] = [];
    const recordBattles = () => {
      if (driver.room.phase === "final_answer" || driver.room.phase === "final_vote") {
        if (driver.room.settings.finalRoundMode === "thriplash") {
          promptsByRound.push(driver.room.thriplashBattles.map((b) => b.promptId));
        } else if (driver.room.lastLashPrompt) {
          const used = [...driver.room.usedPromptIds];
          promptsByRound.push(used.slice(-1));
        }
        return;
      }
      promptsByRound.push(driver.room.battles.map((b) => b.promptId));
    };

    recordBattles();
    let steps = 0;
    let recordedRound2 = false;
    let recordedFinal = false;
    while (driver.room.phase !== "podium" && steps < 400) {
      const prevPhase = driver.room.phase;
      driver.tick();
      if (!recordedRound2 && driver.room.phase === "round2_answer" && prevPhase !== "round2_answer") {
        recordBattles();
        recordedRound2 = true;
      }
      if (
        !recordedFinal &&
        driver.room.phase === "final_answer" &&
        prevPhase !== "final_answer"
      ) {
        recordBattles();
        recordedFinal = true;
      }
      steps++;
    }

    expect(driver.room.phase).toBe("podium");
    expect(promptsByRound.length).toBeGreaterThanOrEqual(2);

    for (let i = 1; i < promptsByRound.length; i++) {
      const earlier = new Set(promptsByRound.slice(0, i).flat());
      for (const id of new Set(promptsByRound[i])) {
        expect(earlier.has(id)).toBe(false);
      }
    }
  });
});
