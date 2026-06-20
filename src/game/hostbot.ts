import { HOSTBOT_ID, HOSTBOT_NAME } from "../shared/constants.js";
import { generateId } from "../shared/ids.js";
import { pickBotAnswerText, pickBotThriplashAnswers } from "./botAnswers.js";

export const FILLER_BOT_ID_PREFIX = "__filler_bot__";

export function getHostBotAnswers(): string[] {
  return pickBotThriplashAnswers();
}

export function getBotAnswerText(): string {
  return pickBotAnswerText();
}

export function getBotVoteChoice(): "a" | "b" {
  return Math.random() < 0.5 ? "a" : "b";
}

export function getBotTripleVoteChoice(): "a" | "b" | "c" | "abstain" {
  const roll = Math.random();
  if (roll < 0.3) return "a";
  if (roll < 0.6) return "b";
  if (roll < 0.9) return "c";
  return "abstain";
}

export function isBot(playerId: string): boolean {
  return playerId === HOSTBOT_ID || playerId.startsWith(FILLER_BOT_ID_PREFIX);
}

export function isHostBot(playerId: string): boolean {
  return isBot(playerId);
}

export function createHostBotPlayer() {
  return {
    id: HOSTBOT_ID,
    token: "bot",
    name: HOSTBOT_NAME,
    avatar: null,
    isAudience: false,
    isVip: false,
    score: 0,
    connected: true,
    kicked: false,
  };
}

export function createFillerBot(slot: number) {
  return {
    id: `${FILLER_BOT_ID_PREFIX}${slot}`,
    token: generateId(),
    name: `Bot ${slot + 1}`,
    avatar: null,
    isAudience: false,
    isVip: false,
    score: 0,
    connected: true,
    kicked: false,
  };
}

export function makeBotAnswer(playerId: string, text: string) {
  return {
    playerId,
    text,
    censored: false,
    moderated: false,
    approved: true,
  };
}
