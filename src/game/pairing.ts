import type { Prompt } from "../shared/types.js";
import { generateId } from "../shared/ids.js";

export interface PairingBattle {
  id: string;
  promptId: string;
  promptText: string;
  playerA: string;
  playerB: string;
  playerC: string | null;
}

export interface PairingResult {
  battles: PairingBattle[];
  assignedPrompts: Record<string, string[]>;
}

function assignPrompt(
  assignedPrompts: Record<string, string[]>,
  playerId: string,
  promptId: string
) {
  if (!assignedPrompts[playerId]) assignedPrompts[playerId] = [];
  assignedPrompts[playerId].push(promptId);
}

function makePairBattle(prompt: Prompt, playerA: string, playerB: string): PairingBattle {
  return {
    id: generateId(),
    promptId: prompt.id,
    promptText: prompt.text,
    playerA,
    playerB,
    playerC: null,
  };
}

function pickBattlePrompts(prompts: Prompt[], count: number): Prompt[] {
  const shuffled = [...prompts].sort(() => Math.random() - 0.5);
  const picked: Prompt[] = [];
  const used = new Set<string>();

  for (const prompt of shuffled) {
    if (picked.length >= count) break;
    if (used.has(prompt.id)) continue;
    picked.push(prompt);
    used.add(prompt.id);
  }

  while (picked.length < count && shuffled.length > 0) {
    picked.push(shuffled[picked.length % shuffled.length]);
  }

  return picked;
}

function buildRegularPairings(playerIds: string[], prompts: Prompt[]): PairingResult {
  const n = playerIds.length;
  const shuffledPlayers = [...playerIds].sort(() => Math.random() - 0.5);
  const battlePrompts = pickBattlePrompts(prompts, n);

  const battles: PairingBattle[] = [];
  const assignedPrompts: Record<string, string[]> = {};
  for (const id of playerIds) assignedPrompts[id] = [];

  for (let i = 0; i < n; i++) {
    const playerA = shuffledPlayers[i];
    const playerB = shuffledPlayers[(i + 1) % n];
    const prompt = battlePrompts[i] ?? battlePrompts[i % battlePrompts.length];
    battles.push(makePairBattle(prompt, playerA, playerB));
    assignPrompt(assignedPrompts, playerA, prompt.id);
    assignPrompt(assignedPrompts, playerB, prompt.id);
  }

  return { battles, assignedPrompts };
}

export function buildPairings(playerIds: string[], prompts: Prompt[]): PairingResult {
  if (playerIds.length === 2) {
    const shuffledPlayers = [...playerIds].sort(() => Math.random() - 0.5);
    const shuffledPrompts = [...prompts].sort(() => Math.random() - 0.5);
    const battles: PairingBattle[] = [];
    const assignedPrompts: Record<string, string[]> = {};
    for (const id of playerIds) assignedPrompts[id] = [];

    const [a, b] = shuffledPlayers;
    if (shuffledPrompts.length >= 2) {
      battles.push(makePairBattle(shuffledPrompts[0], a, b));
      battles.push(makePairBattle(shuffledPrompts[1], a, b));
      assignedPrompts[a].push(shuffledPrompts[0].id, shuffledPrompts[1].id);
      assignedPrompts[b].push(shuffledPrompts[0].id, shuffledPrompts[1].id);
    }
    return { battles, assignedPrompts };
  }

  return buildRegularPairings(playerIds, prompts);
}

function thriplashPrompts(prompts: Prompt[]): Prompt[] {
  return [...prompts]
    .filter((p) => p.type === "thriplash" || p.type === "regular")
    .sort(() => Math.random() - 0.5);
}

export function buildThriplashPairings(
  playerIds: string[],
  prompts: Prompt[]
): PairingResult {
  return buildPairings(playerIds, thriplashPrompts(prompts));
}

export function promptsNeededForPlayers(playerCount: number): number {
  return Math.max(12, playerCount);
}
