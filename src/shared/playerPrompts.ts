import { answerSideForPlayer } from "./battleLayout.js";
import { hasSubmittedThriplashAnswers } from "./thriplashAnswers.js";
import {
  thriplashAnswerSideForPlayer,
  thriplashAnswersForSide,
} from "./thriplashBattle.js";

export interface PendingAnswerPrompt {
  battleId: string;
  promptId: string;
  text: string;
  inputTestId: string;
  progressLabel?: string;
}

export interface AnswerPromptState {
  phase: string;
  battles: {
    id: string;
    promptId: string;
    promptText: string;
    playerA: string;
    playerB: string;
    playerC: string | null;
    answerA: { text: string } | null;
    answerB: { text: string } | null;
    answerC: { text: string } | null;
  }[];
  thriplashBattles: {
    id: string;
    promptId: string;
    promptText: string;
    playerA: string;
    playerB: string;
    playerC: string | null;
    answersA: { text: string }[];
    answersB: { text: string }[];
    answersC: { text: string }[];
  }[];
  lastLashEntries: {
    playerId: string;
    answer: { text: string } | null;
  }[];
  lastLashPrompt: string | null;
  settings: { finalRoundMode: string };
}

function answerForSide(
  battle: AnswerPromptState["battles"][number],
  side: "a" | "b" | "c"
) {
  return side === "a" ? battle.answerA : side === "b" ? battle.answerB : battle.answerC;
}

export function playerAnswerBattles(
  state: AnswerPromptState,
  playerId: string
): AnswerPromptState["battles"] {
  return state.battles.filter((b) => answerSideForPlayer(b, playerId) !== null);
}

function playerThriplashBattles(
  state: AnswerPromptState,
  playerId: string
): AnswerPromptState["thriplashBattles"] {
  return state.thriplashBattles.filter(
    (b) => thriplashAnswerSideForPlayer(b, playerId) !== null
  );
}

export function getPendingAnswerPrompts(
  state: AnswerPromptState,
  playerId: string
): PendingAnswerPrompt[] {
  if (state.phase === "final_answer" && state.settings.finalRoundMode === "last_lash") {
    const entry = state.lastLashEntries.find((e) => e.playerId === playerId);
    if (entry?.answer?.text) return [];
    return [
      {
        battleId: "lastlash",
        promptId: "lastlash",
        text: state.lastLashPrompt ?? "",
        inputTestId: "answer-input-lastlash",
      },
    ];
  }

  if (state.phase === "final_answer" && state.settings.finalRoundMode === "thriplash") {
    const playerBattles = playerThriplashBattles(state, playerId);
    const answeredCount = playerBattles.filter((b) => {
      const side = thriplashAnswerSideForPlayer(b, playerId);
      if (!side) return false;
      return hasSubmittedThriplashAnswers(thriplashAnswersForSide(b, side));
    }).length;

    return playerBattles
      .filter((b) => {
        const side = thriplashAnswerSideForPlayer(b, playerId);
        if (!side) return false;
        return !hasSubmittedThriplashAnswers(thriplashAnswersForSide(b, side));
      })
      .map((b, index) => ({
        battleId: b.id,
        promptId: b.promptId,
        text: b.promptText,
        inputTestId: `answer-input-${b.id}`,
        progressLabel:
          playerBattles.length > 1
            ? `Prompt ${answeredCount + index + 1} of ${playerBattles.length}`
            : undefined,
      }));
  }

  const playerBattles = playerAnswerBattles(state, playerId);
  const answeredCount = playerBattles.filter((b) => {
    const side = answerSideForPlayer(b, playerId);
    if (!side) return false;
    return !!answerForSide(b, side)?.text;
  }).length;

  return playerBattles
    .filter((b) => {
      const side = answerSideForPlayer(b, playerId);
      if (!side) return false;
      return !answerForSide(b, side)?.text;
    })
    .map((b, index) => ({
      battleId: b.id,
      promptId: b.promptId,
      text: b.promptText,
      inputTestId: `answer-input-${b.id}`,
      progressLabel:
        playerBattles.length > 1
          ? `Prompt ${answeredCount + index + 1} of ${playerBattles.length}`
          : undefined,
    }));
}

export function playerHasSubmittedAnswers(
  state: AnswerPromptState,
  playerId: string
): boolean {
  if (state.phase === "round1_answer" || state.phase === "round2_answer") {
    const playerBattles = playerAnswerBattles(state, playerId);
    if (playerBattles.length === 0) return true;
    return playerBattles.every((b) => {
      const side = answerSideForPlayer(b, playerId);
      if (!side) return true;
      return !!answerForSide(b, side)?.text;
    });
  }

  if (state.phase === "final_answer" && state.settings.finalRoundMode === "last_lash") {
    const entry = state.lastLashEntries.find((e) => e.playerId === playerId);
    return !!entry?.answer?.text;
  }

  if (state.phase === "final_answer" && state.settings.finalRoundMode === "thriplash") {
    const playerBattles = playerThriplashBattles(state, playerId);
    if (playerBattles.length === 0) return true;
    return playerBattles.every((b) => {
      const side = thriplashAnswerSideForPlayer(b, playerId);
      if (!side) return true;
      return hasSubmittedThriplashAnswers(thriplashAnswersForSide(b, side));
    });
  }

  return false;
}
