import type {
  RoomState,
  PublicRoomState,
  GameSettings,
  Player,
  Battle,
  Answer,
  Prompt,
  GamePhase,
  ThriplashBattle,
} from "../shared/types.js";
import { DEFAULT_SETTINGS } from "../shared/types.js";
import { canPauseGame } from "../shared/phases.js";
import {
  ANSWER_TIMER_MS,
  VOTE_TIMER_MS,
  E2E_ANSWER_TIMER_MS,
  E2E_VOTE_TIMER_MS,
  BATTLE_REVEAL_MS,
  E2E_BATTLE_REVEAL_MS,
  BATTLE_VOTE_GRACE_MS,
  E2E_SCORES_MS,
} from "../shared/constants.js";
import { generateId, generateToken, generateRoomCode } from "../shared/ids.js";
import { buildPairings, buildThriplashPairings } from "./pairing.js";
import { scoreBattle, scoreTripleBattle, scoreLastLash } from "./scoring.js";
import { getBotFillTargetCount, isBotFillEnabled, fillsLobbyImmediately } from "./botFill.js";
import {
  isThriplashBattler,
  thriplashAnswerSideForPlayer,
  thriplashAnswersForSide,
  isTripleThriplashBattle,
} from "../shared/thriplashBattle.js";
import {
  answerSideForPlayer,
  battlerIds,
  isBattler,
  isTripleBattle,
} from "../shared/battleLayout.js";
import {
  getHostBotAnswers,
  getBotAnswerText,
  getBotVoteChoice,
  getBotTripleVoteChoice,
  createFillerBot,
  isBot,
  makeBotAnswer,
  FILLER_BOT_ID_PREFIX,
} from "./hostbot.js";

const E2E_MODE = process.env.E2E_MODE === "1";

export function createRoom(joinUrl: string, settings?: Partial<GameSettings>): RoomState {
  const code = generateRoomCode();
  const modPassword = settings?.moderationEnabled
    ? generateRoomCode()
    : null;

  return {
    code,
    phase: "lobby",
    settings: { ...DEFAULT_SETTINGS, ...settings },
    players: [],
    modPassword,
    joinUrl,
    vipId: null,
    phaseEndsAt: null,
    round: 0,
    battles: [],
    currentBattleIndex: 0,
    thriplashBattles: [],
    lastLashPrompt: null,
    lastLashEntries: [],
    lastLashVotes: {},
    assignedPrompts: {},
    promptPool: [],
    usedPromptIds: new Set(),
    kickedTokens: new Set(),
    highlights: [],
    battleVoteGraceUntil: null,
    paused: false,
    pauseRemainingMs: null,
    pauseBattleVoteGraceRemainingMs: null,
  };
}

export function toPublicState(room: RoomState): PublicRoomState {
  return {
    code: room.code,
    phase: room.phase,
    settings: room.settings,
    players: room.players.map((p) => ({ ...p })),
    joinUrl: room.joinUrl,
    vipId: room.vipId,
    phaseEndsAt: room.phaseEndsAt,
    round: room.round,
    battles: room.battles,
    currentBattleIndex: room.currentBattleIndex,
    thriplashBattles: room.thriplashBattles,
    lastLashPrompt: room.lastLashPrompt,
    lastLashEntries: room.lastLashEntries,
    modPassword: room.modPassword,
    highlights: room.highlights,
    paused: room.paused,
    pausedRemainingMs: room.paused ? room.pauseRemainingMs : null,
  };
}

export function pauseGame(room: RoomState): boolean {
  if (room.paused || !canPauseGame(room.phase)) return false;

  room.paused = true;

  if (room.phaseEndsAt !== null) {
    room.pauseRemainingMs = Math.max(0, room.phaseEndsAt - Date.now());
    room.phaseEndsAt = null;
  }

  if (room.battleVoteGraceUntil !== null) {
    room.pauseBattleVoteGraceRemainingMs = Math.max(
      0,
      room.battleVoteGraceUntil - Date.now()
    );
    room.battleVoteGraceUntil = null;
  }

  return true;
}

export function resumeGame(room: RoomState): boolean {
  if (!room.paused) return false;

  room.paused = false;

  if (room.pauseRemainingMs !== null) {
    room.phaseEndsAt = Date.now() + room.pauseRemainingMs;
    room.pauseRemainingMs = null;
  }

  if (room.pauseBattleVoteGraceRemainingMs !== null) {
    room.battleVoteGraceUntil = Date.now() + room.pauseBattleVoteGraceRemainingMs;
    room.pauseBattleVoteGraceRemainingMs = null;
  }

  return true;
}

export function getAnswerTimerMs(): number {
  if (E2E_MODE) return E2E_ANSWER_TIMER_MS;
  return ANSWER_TIMER_MS;
}

export function getVoteTimerMs(): number {
  if (E2E_MODE) return E2E_VOTE_TIMER_MS;
  return VOTE_TIMER_MS;
}

function enterVotePhaseTimers(room: RoomState): void {
  room.phaseEndsAt = Date.now() + getVoteTimerMs();
  room.battleVoteGraceUntil = E2E_MODE
    ? null
    : Date.now() + BATTLE_VOTE_GRACE_MS;
}

export function getBattleRevealMs(): number {
  return E2E_MODE ? E2E_BATTLE_REVEAL_MS : BATTLE_REVEAL_MS;
}

export function getScoresPhaseMs(): number {
  return E2E_MODE ? E2E_SCORES_MS : 8_000;
}

export function joinRoom(
  room: RoomState,
  name: string,
  token: string | undefined,
  password: string | undefined,
  avatar: string | null,
  forceAudience = false
): { player: Player; error?: string } {
  if (room.settings.password && room.settings.password !== password) {
    return { player: null as unknown as Player, error: "Wrong password" };
  }

  if (token && room.kickedTokens.has(token)) {
    return { player: null as unknown as Player, error: "You were kicked from this room" };
  }

  const existing = token
    ? room.players.find((p) => p.token === token)
    : undefined;

  if (existing) {
    existing.connected = true;
    existing.name = name;
    if (avatar) existing.avatar = avatar;
    return { player: existing };
  }

  const activePlayers = room.players.filter((p) => !p.isAudience && !p.kicked);
  const gameStarted = room.phase !== "lobby";
  const isAudience =
    forceAudience ||
    gameStarted ||
    activePlayers.length >= room.settings.maxPlayers;

  const player: Player = {
    id: generateId(),
    token: token ?? generateToken(),
    name,
    avatar,
    isAudience,
    isVip: !gameStarted && activePlayers.length === 0,
    score: 0,
    connected: true,
    kicked: false,
  };

  if (player.isVip) room.vipId = player.id;
  room.players.push(player);
  return { player };
}

export function canStartGame(room: RoomState): boolean {
  const active = room.players.filter((p) => !p.isAudience && !p.kicked && p.connected);
  const humans = active.filter((p) => !isBot(p.id));
  if (isBotFillEnabled(room.settings)) {
    return humans.length >= 1;
  }
  return active.length >= room.settings.minPlayers;
}

export function applyBotLobbySettings(room: RoomState): void {
  if (room.settings.botTestLobbyMode === "off") {
    clearFillerBots(room);
    return;
  }
  if (fillsLobbyImmediately(room.settings)) {
    fillLobbyWithBots(room);
    return;
  }
  if (room.settings.botTestLobbyMode === "max") {
    clearFillerBots(room);
  }
}

export function clearFillerBots(room: RoomState): void {
  room.players = room.players.filter(
    (p) => !p.id.startsWith(FILLER_BOT_ID_PREFIX)
  );
}

export function fillLobbyWithBots(room: RoomState): void {
  if (!isBotFillEnabled(room.settings)) return;

  const targetCount = getBotFillTargetCount(room.settings);
  const humans = room.players.filter((p) => !p.isAudience && !p.kicked && !isBot(p.id));
  let fillerBots = room.players.filter(
    (p) => !p.isAudience && !p.kicked && p.id.startsWith(FILLER_BOT_ID_PREFIX)
  );

  while (humans.length + fillerBots.length > targetCount && fillerBots.length > 0) {
    const removed = fillerBots.pop()!;
    room.players = room.players.filter((p) => p.id !== removed.id);
  }

  fillerBots = room.players.filter(
    (p) => !p.isAudience && !p.kicked && p.id.startsWith(FILLER_BOT_ID_PREFIX)
  );
  const needed = targetCount - humans.length - fillerBots.length;

  for (let i = 0; i < needed; i++) {
    room.players.push(createFillerBot(fillerBots.length + i));
  }
}

export function submitBotAnswers(room: RoomState): void {
  if (room.phase === "round1_answer" || room.phase === "round2_answer") {
    for (const bot of getActivePlayers(room).filter((p) => isBot(p.id))) {
      for (const battle of room.battles) {
        const side = answerSideForPlayer(battle, bot.id);
        if (!side) continue;
        const existing =
          side === "a" ? battle.answerA : side === "b" ? battle.answerB : battle.answerC;
        if (existing?.text) continue;
        submitAnswers(room, bot.id, [
          {
            promptId: battle.promptId,
            battleId: battle.id,
            text: getBotAnswerText(),
          },
        ]);
      }
    }
    return;
  }

  if (room.phase === "final_answer" && room.settings.finalRoundMode === "last_lash") {
    for (const entry of room.lastLashEntries) {
      if (!isBot(entry.playerId) || entry.answer?.text) continue;
      submitAnswers(room, entry.playerId, [{ promptId: "last_lash", text: getBotAnswerText() }]);
    }
    return;
  }

  if (room.phase === "final_answer" && room.settings.finalRoundMode === "thriplash") {
    for (const tb of room.thriplashBattles) {
      for (const playerId of [tb.playerA, tb.playerB, tb.playerC].filter(Boolean) as string[]) {
        if (!isBot(playerId)) continue;
        const side = thriplashAnswerSideForPlayer(tb, playerId);
        if (!side) continue;
        const existing = thriplashAnswersForSide(tb, side);
        if (existing.length >= 3) continue;
        const answers = getHostBotAnswers().map((t) => makeBotAnswer(playerId, t));
        if (side === "a") tb.answersA = answers;
        else if (side === "b") tb.answersB = answers;
        else tb.answersC = answers;
      }
    }
  }
}

export function submitBotVotesForCurrentBattle(room: RoomState): void {
  if (room.phase === "round1_battle" || room.phase === "round2_battle") {
    const battle = getCurrentBattle(room);
    if (!battle) return;

    for (const bot of getActivePlayers(room).filter((p) => isBot(p.id))) {
      if (isBattler(battle, bot.id)) continue;
      const voted =
        battle.votesA.includes(bot.id) ||
        battle.votesB.includes(bot.id) ||
        battle.votesC.includes(bot.id) ||
        battle.abstentions.includes(bot.id);
      if (voted) continue;
      const choice = isTripleBattle(battle)
        ? getBotTripleVoteChoice()
        : getBotVoteChoice();
      submitVote(room, bot.id, battle.id, choice);
    }
    return;
  }

  if (room.phase === "final_vote" && room.settings.finalRoundMode === "thriplash") {
    const tb = room.thriplashBattles[room.currentBattleIndex];
    if (!tb) return;

    for (const bot of getActivePlayers(room).filter((p) => isBot(p.id))) {
      if (isThriplashBattler(tb, bot.id)) continue;
      const voted =
        tb.votesA.includes(bot.id) ||
        tb.votesB.includes(bot.id) ||
        tb.votesC.includes(bot.id) ||
        tb.abstentions.includes(bot.id);
      if (voted) continue;
      const choice = isTripleThriplashBattle(tb)
        ? getBotTripleVoteChoice()
        : getBotVoteChoice();
      submitThriplashVote(room, bot.id, tb.id, choice);
    }
  }
}

export function startGame(room: RoomState, prompts: Prompt[]): void {
  room.promptPool = prompts;
  room.usedPromptIds = new Set();
  room.round = 1;
  startAnswerPhase(room, 1);
}

function getActivePlayers(room: RoomState): Player[] {
  return room.players.filter((p) => !p.isAudience && !p.kicked);
}

function pickRandom<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

function availablePrompts(room: RoomState, typeFilter: (p: Prompt) => boolean): Prompt[] {
  return room.promptPool.filter((p) => typeFilter(p) && !room.usedPromptIds.has(p.id));
}

function markPromptsUsed(room: RoomState, promptIds: string[]): void {
  for (const id of promptIds) {
    room.usedPromptIds.add(id);
  }
}

function startAnswerPhase(room: RoomState, round: number): void {
  room.round = round;
  if (isBotFillEnabled(room.settings)) {
    fillLobbyWithBots(room);
  }
  const players = getActivePlayers(room);
  const playerIds = players.map((p) => p.id);

  if (round <= 2) {
    const regular = availablePrompts(room, (p) => p.type === "regular");
    const { battles, assignedPrompts } = buildPairings(playerIds, regular);
    markPromptsUsed(
      room,
      battles.map((b) => b.promptId)
    );
    room.battles = battles.map((b) => ({
      ...b,
      answerA: null,
      answerB: null,
      answerC: null,
      votesA: [],
      votesB: [],
      votesC: [],
      abstentions: [],
      result: null,
    }));
    room.assignedPrompts = assignedPrompts;
    room.currentBattleIndex = 0;
    room.phase = round === 1 ? "round1_answer" : "round2_answer";
  } else if (room.settings.finalRoundMode === "thriplash") {
    const thriplashPrompts = availablePrompts(
      room,
      (p) => p.type === "thriplash" || p.type === "regular"
    );
    const { battles } = buildThriplashPairings(playerIds, thriplashPrompts);
    markPromptsUsed(
      room,
      battles.map((b) => b.promptId)
    );

    room.thriplashBattles = battles.map((b) => ({
      ...b,
      answersA: [],
      answersB: [],
      answersC: [],
      votesA: [],
      votesB: [],
      votesC: [],
      abstentions: [],
      result: null,
    }));

    for (const tb of room.thriplashBattles) {
      for (const playerId of [tb.playerA, tb.playerB, tb.playerC].filter(Boolean) as string[]) {
        if (!isBot(playerId)) continue;
        const side = thriplashAnswerSideForPlayer(tb, playerId);
        if (!side) continue;
        const answers = getHostBotAnswers().map((t) => makeBotAnswer(playerId, t));
        if (side === "a") tb.answersA = answers;
        else if (side === "b") tb.answersB = answers;
        else tb.answersC = answers;
      }
    }
    room.phase = "final_answer";
  } else {
    const regular = availablePrompts(room, (p) => p.type === "regular");
    const fallback = availablePrompts(room, () => true);
    const prompt = pickRandom(regular) ?? pickRandom(fallback);
    if (prompt) {
      markPromptsUsed(room, [prompt.id]);
    }
    room.lastLashPrompt = prompt?.text ?? "Something funny";
    room.lastLashEntries = players.map((p) => ({
      playerId: p.id,
      answer: null,
      votes: 0,
      points: 0,
    }));
    room.lastLashVotes = {};
    room.phase = "final_answer";
  }

  room.phaseEndsAt = Date.now() + getAnswerTimerMs();
}

export function submitAnswers(
  room: RoomState,
  playerId: string,
  answers: { promptId: string; text: string; slot?: number; battleId?: string }[]
): string | null {
  const settings = room.settings;

  if (room.phase === "final_answer" && room.settings.finalRoundMode === "last_lash") {
    const entry = room.lastLashEntries.find((e) => e.playerId === playerId);
    if (!entry) return "Not a player";
    const ans = answers[0];
    entry.answer = {
      playerId,
      text: ans?.text ?? "",
      censored: false,
      moderated: false,
      approved: settings.moderationEnabled ? null : true,
    };
    return null;
  }

  if (room.phase === "final_answer" && room.settings.finalRoundMode === "thriplash") {
    const battleIds = new Set(
      answers.map((ans) => ans.battleId).filter((id): id is string => Boolean(id))
    );
    if (battleIds.size === 0) {
      return "battleId required for thriplash answers";
    }

    for (const tb of room.thriplashBattles) {
      if (!battleIds.has(tb.id)) continue;

      const side = thriplashAnswerSideForPlayer(tb, playerId);
      if (!side) continue;
      const existing = thriplashAnswersForSide(tb, side);
      if (existing.length >= 3) continue;

      const slotAnswers = answers.filter((ans) => ans.battleId === tb.id);
      if (slotAnswers.length === 0) continue;

      const stored = slotAnswers.slice(0, 3).map((ans) => ({
        playerId,
        text: ans.text ?? "",
        censored: false,
        moderated: false,
        approved: settings.moderationEnabled ? null : true,
      }));

      while (stored.length < 3) {
        stored.push({
          playerId,
          text: "",
          censored: false,
          moderated: false,
          approved: settings.moderationEnabled ? null : true,
        });
      }

      if (side === "a") tb.answersA = stored;
      else if (side === "b") tb.answersB = stored;
      else tb.answersC = stored;
    }
    return null;
  }

  const battleList = room.battles;
  for (const ans of answers) {
    const matches = ans.battleId
      ? battleList.filter((b) => b.id === ans.battleId)
      : battleList.filter((b) => b.promptId === ans.promptId);
    for (const battle of matches) {
      const answer: Answer = {
        playerId,
        text: ans.text,
        censored: false,
        moderated: false,
        approved: settings.moderationEnabled ? null : true,
      };
      const side = answerSideForPlayer(battle, playerId);
      if (side === "a") battle.answerA = answer;
      else if (side === "b") battle.answerB = answer;
      else if (side === "c") battle.answerC = answer;
    }
  }
  return null;
}

export function allAnswersSubmitted(room: RoomState): boolean {
  const players = getActivePlayers(room).filter((p) => !isBot(p.id));

  if (room.phase === "round1_answer" || room.phase === "round2_answer") {
    for (const battle of room.battles) {
      for (const playerId of battlerIds(battle)) {
        if (isBot(playerId)) continue;
        const side = answerSideForPlayer(battle, playerId);
        if (!side) continue;
        const answer =
          side === "a" ? battle.answerA : side === "b" ? battle.answerB : battle.answerC;
        if (!answer?.text) {
          const p = players.find((pl) => pl.id === playerId);
          if (p) return false;
        }
      }
    }
    for (const p of players) {
      for (const battle of room.battles) {
        const side = answerSideForPlayer(battle, p.id);
        if (!side) continue;
        const ans =
          side === "a" ? battle.answerA : side === "b" ? battle.answerB : battle.answerC;
        if (!ans?.text) return false;
      }
    }
    return true;
  }

  if (room.phase === "final_answer" && room.settings.finalRoundMode === "last_lash") {
    return room.lastLashEntries.every((e) => e.answer?.text);
  }

  if (room.phase === "final_answer" && room.settings.finalRoundMode === "thriplash") {
    return room.thriplashBattles.every((tb) => {
      for (const playerId of [tb.playerA, tb.playerB, tb.playerC].filter(Boolean) as string[]) {
        if (isBot(playerId)) continue;
        const side = thriplashAnswerSideForPlayer(tb, playerId);
        if (!side) continue;
        if (thriplashAnswersForSide(tb, side).length < 3) return false;
      }
      return true;
    });
  }

  return false;
}

export function advanceFromAnswerPhase(room: RoomState): boolean {
  if (!allAnswersSubmitted(room)) return false;

  if (room.phase === "round1_answer" || room.phase === "round2_answer") {
    beginBattlePhase(room);
    return true;
  }

  if (room.phase === "final_answer") {
    room.phase = "final_vote";
    if (room.settings.finalRoundMode === "thriplash") {
      room.currentBattleIndex = 0;
    }
    enterVotePhaseTimers(room);
    return true;
  }

  return false;
}

export function beginBattlePhase(room: RoomState): void {
  room.currentBattleIndex = 0;
  if (room.phase === "round1_answer") room.phase = "round1_battle";
  else if (room.phase === "round2_answer") room.phase = "round2_battle";
  else return;
  enterVotePhaseTimers(room);
}

export function getCurrentBattle(room: RoomState): Battle | null {
  if (room.phase !== "round1_battle" && room.phase !== "round2_battle") return null;
  return room.battles[room.currentBattleIndex] ?? null;
}

export function submitVote(
  room: RoomState,
  voterId: string,
  battleId: string,
  choice: "a" | "b" | "c" | "abstain"
): string | null {
  const battle = room.battles.find((b) => b.id === battleId);
  if (!battle) return "Battle not found";
  if (isBattler(battle, voterId)) {
    return "Cannot vote on own battle";
  }

  battle.votesA = battle.votesA.filter((v) => v !== voterId);
  battle.votesB = battle.votesB.filter((v) => v !== voterId);
  battle.votesC = battle.votesC.filter((v) => v !== voterId);
  battle.abstentions = battle.abstentions.filter((v) => v !== voterId);

  if (choice === "a") battle.votesA.push(voterId);
  else if (choice === "b") battle.votesB.push(voterId);
  else if (choice === "c") battle.votesC.push(voterId);
  else if (choice === "abstain") battle.abstentions.push(voterId);
  return null;
}

function battleVotersSubmitted(
  voters: { id: string }[],
  votesA: string[],
  votesB: string[],
  abstentions: string[],
  votesC: string[] = []
): boolean {
  const voted = new Set([...votesA, ...votesB, ...votesC, ...abstentions]);
  return voters.every((v) => voted.has(v.id));
}

export function allVotesSubmitted(room: RoomState): boolean {
  const battle = getCurrentBattle(room);
  if (!battle) return false;
  const voters = room.players.filter(
    (p) =>
      p.connected &&
      !p.kicked &&
      !p.isAudience &&
      !isBattler(battle, p.id)
  );
  return battleVotersSubmitted(
    voters,
    battle.votesA,
    battle.votesB,
    battle.abstentions,
    battle.votesC
  );
}

export function allThriplashVotesSubmitted(room: RoomState): boolean {
  const tb = room.thriplashBattles[room.currentBattleIndex];
  if (!tb) return false;
  const voters = room.players.filter(
    (p) =>
      p.connected &&
      !p.kicked &&
      !p.isAudience &&
      !isThriplashBattler(tb, p.id)
  );
  return battleVotersSubmitted(
    voters,
    tb.votesA,
    tb.votesB,
    tb.abstentions,
    tb.votesC
  );
}

export function advanceFromVotePhase(
  room: RoomState,
  options?: { force?: boolean }
): boolean {
  if (
    !options?.force &&
    room.battleVoteGraceUntil &&
    Date.now() < room.battleVoteGraceUntil
  ) {
    return false;
  }
  if (
    room.phase === "round1_battle" ||
    room.phase === "round2_battle" ||
    (room.phase === "final_vote" && room.settings.finalRoundMode === "thriplash")
  ) {
    submitBotVotesForCurrentBattle(room);
  }

  if (room.phase === "round1_battle" || room.phase === "round2_battle") {
    if (!allVotesSubmitted(room)) return false;
    finishBattleVoting(room);
    return true;
  }

  if (room.phase === "final_vote" && room.settings.finalRoundMode === "thriplash") {
    if (!allThriplashVotesSubmitted(room)) return false;
    finishBattleVoting(room);
    return true;
  }

  return false;
}

export function getRevealBattle(
  room: RoomState
): Battle | ThriplashBattle | null {
  if (
    room.phase === "round1_battle_reveal" ||
    room.phase === "round2_battle_reveal"
  ) {
    return room.battles[room.currentBattleIndex] ?? null;
  }
  if (room.phase === "final_vote_reveal") {
    return room.thriplashBattles[room.currentBattleIndex] ?? null;
  }
  return null;
}

export function finishBattleVoting(room: RoomState): void {
  if (room.phase === "final_vote") {
    resolveThriplashBattle(room);
    room.phase = "final_vote_reveal";
  } else if (room.phase === "round1_battle") {
    resolveCurrentBattle(room);
    room.phase = "round1_battle_reveal";
  } else if (room.phase === "round2_battle") {
    resolveCurrentBattle(room);
    room.phase = "round2_battle_reveal";
  } else {
    return;
  }
  room.phaseEndsAt = Date.now() + getBattleRevealMs();
  room.battleVoteGraceUntil = null;
}

export function advanceAfterBattleReveal(room: RoomState): void {
  room.currentBattleIndex++;

  if (room.phase === "round1_battle_reveal") {
    if (room.currentBattleIndex >= room.battles.length) {
      room.phase = "round1_scores";
      room.phaseEndsAt = Date.now() + getScoresPhaseMs();
      room.battleVoteGraceUntil = null;
    } else {
      room.phase = "round1_battle";
      enterVotePhaseTimers(room);
    }
    return;
  }

  if (room.phase === "round2_battle_reveal") {
    if (room.currentBattleIndex >= room.battles.length) {
      room.phase = "round2_scores";
      room.phaseEndsAt = Date.now() + getScoresPhaseMs();
      room.battleVoteGraceUntil = null;
    } else {
      room.phase = "round2_battle";
      enterVotePhaseTimers(room);
    }
    return;
  }

  if (room.phase === "final_vote_reveal") {
    if (room.currentBattleIndex >= room.thriplashBattles.length) {
      room.phase = "podium";
      room.phaseEndsAt = null;
      room.battleVoteGraceUntil = null;
    } else {
      room.phase = "final_vote";
      enterVotePhaseTimers(room);
    }
  }
}

export function resolveCurrentBattle(room: RoomState): void {
  const battle = getCurrentBattle(room);
  if (!battle) return;

  const audience = room.players.filter((p) => p.isAudience);
  const audA = battle.votesA.filter((v) => audience.some((a) => a.id === v)).length;
  const audB = battle.votesB.filter((v) => audience.some((a) => a.id === v)).length;
  const audC = battle.votesC.filter((v) => audience.some((a) => a.id === v)).length;
  const playerCount = getActivePlayers(room).length;

  const result = isTripleBattle(battle)
    ? scoreTripleBattle({
        votesA: battle.votesA.length,
        votesB: battle.votesB.length,
        votesC: battle.votesC.length,
        round: room.round,
        answerA: battle.answerA,
        answerB: battle.answerB,
        answerC: battle.answerC,
      })
    : scoreBattle({
        votesA: battle.votesA.length,
        votesB: battle.votesB.length,
        totalVoters: battle.votesA.length + battle.votesB.length,
        audienceVotesA: audA,
        audienceVotesB: audB,
        round: room.round,
        answerA: battle.answerA,
        answerB: battle.answerB,
        playerCount,
      });

  battle.result = result;

  const playerA = room.players.find((p) => p.id === battle.playerA);
  const playerB = room.players.find((p) => p.id === battle.playerB);
  const playerC = battle.playerC ? room.players.find((p) => p.id === battle.playerC) : null;
  if (playerA) playerA.score += result.pointsA;
  if (playerB) playerB.score += result.pointsB;
  if (playerC) playerC.score += result.pointsC;

  const ranked = [
    { answer: battle.answerA, points: result.pointsA, votes: battle.votesA.length, player: playerA },
    { answer: battle.answerB, points: result.pointsB, votes: battle.votesB.length, player: playerB },
    ...(battle.playerC
      ? [{
          answer: battle.answerC,
          points: result.pointsC,
          votes: battle.votesC.length,
          player: playerC,
        }]
      : []),
  ];

  const winner = [...ranked].sort((a, b) => b.points - a.points)[0];
  if (winner?.answer?.text && winner.points > 0) {
    const runnerUp = ranked.find((r) => r !== winner);
    if (!runnerUp || winner.points > runnerUp.points) {
      room.highlights.push({
        text: winner.answer.text,
        playerName: winner.player?.name ?? "?",
        votes: winner.votes,
      });
    }
  }
}

export function advanceBattle(room: RoomState): GamePhase | null {
  finishBattleVoting(room);
  advanceAfterBattleReveal(room);
  return room.phase;
}

export function advanceFromScores(room: RoomState): void {
  if (room.phase === "round1_scores") {
    startAnswerPhase(room, 2);
  } else if (room.phase === "round2_scores") {
    startAnswerPhase(room, 3);
  }
}

export function advancePhaseOnTimer(room: RoomState): void {
  if (room.phase === "round1_answer" || room.phase === "round2_answer") {
    beginBattlePhase(room);
    return;
  }
  if (room.phase === "round1_battle" || room.phase === "round2_battle") {
    finishBattleVoting(room);
    return;
  }
  if (room.phase === "final_vote" && room.settings.finalRoundMode === "thriplash") {
    finishBattleVoting(room);
    return;
  }
  if (
    room.phase === "round1_battle_reveal" ||
    room.phase === "round2_battle_reveal" ||
    room.phase === "final_vote_reveal"
  ) {
    advanceAfterBattleReveal(room);
    return;
  }
  if (room.phase === "round1_scores" || room.phase === "round2_scores") {
    advanceFromScores(room);
    return;
  }
  if (room.phase === "final_answer") {
    room.phase = "final_vote";
    if (room.settings.finalRoundMode === "thriplash") {
      room.currentBattleIndex = 0;
    }
    enterVotePhaseTimers(room);
    return;
  }
  if (room.phase === "final_vote") {
    if (room.settings.finalRoundMode === "last_lash") {
      resolveLastLash(room);
      room.phase = "final_reveal";
      room.phaseEndsAt = Date.now() + getScoresPhaseMs();
    }
    return;
  }
  if (room.phase === "final_reveal") {
    room.phase = "podium";
    room.phaseEndsAt = null;
    return;
  }
}

function resolveLastLash(room: RoomState): void {
  const voteCounts: Record<string, number> = {};
  for (const entry of room.lastLashEntries) {
    voteCounts[entry.playerId] = 0;
  }
  for (const votes of Object.values(room.lastLashVotes)) {
    for (const pid of votes) {
      voteCounts[pid] = (voteCounts[pid] ?? 0) + 1;
    }
  }
  const entries = room.lastLashEntries.map((e) => ({
    playerId: e.playerId,
    votes: voteCounts[e.playerId] ?? 0,
  }));
  const points = scoreLastLash(entries, 3);
  for (const entry of room.lastLashEntries) {
    entry.votes = voteCounts[entry.playerId] ?? 0;
    entry.points = points[entry.playerId] ?? 0;
    const player = room.players.find((p) => p.id === entry.playerId);
    if (player) player.score += entry.points;
  }
}

function resolveThriplashBattle(room: RoomState): void {
  const tb = room.thriplashBattles[room.currentBattleIndex];
  if (!tb) return;

  const combinedA = tb.answersA.map((a) => a.text).join(" | ");
  const combinedB = tb.answersB.map((a) => a.text).join(" | ");
  const combinedC = tb.answersC.map((a) => a.text).join(" | ");

  const answerA: Answer = {
    playerId: tb.playerA,
    text: combinedA,
    censored: false,
    moderated: false,
    approved: true,
  };
  const answerB: Answer = {
    playerId: tb.playerB,
    text: combinedB,
    censored: false,
    moderated: false,
    approved: true,
  };
  const answerC: Answer = {
    playerId: tb.playerC ?? "",
    text: combinedC,
    censored: false,
    moderated: false,
    approved: true,
  };

  const audience = room.players.filter((p) => p.isAudience);
  const audA = tb.votesA.filter((v) => audience.some((a) => a.id === v)).length;
  const audB = tb.votesB.filter((v) => audience.some((a) => a.id === v)).length;
  const audC = tb.votesC.filter((v) => audience.some((a) => a.id === v)).length;

  const result = isTripleThriplashBattle(tb)
    ? scoreTripleBattle({
        votesA: tb.votesA.length,
        votesB: tb.votesB.length,
        votesC: tb.votesC.length,
        round: 3,
        answerA,
        answerB,
        answerC,
      })
    : scoreBattle({
        votesA: tb.votesA.length,
        votesB: tb.votesB.length,
        totalVoters: tb.votesA.length + tb.votesB.length,
        audienceVotesA: audA,
        audienceVotesB: audB,
        round: 3,
        answerA,
        answerB,
        playerCount: getActivePlayers(room).length,
      });

  tb.result = result;
  const playerA = room.players.find((p) => p.id === tb.playerA);
  const playerB = room.players.find((p) => p.id === tb.playerB);
  const playerC = tb.playerC ? room.players.find((p) => p.id === tb.playerC) : null;
  if (playerA) playerA.score += result.pointsA;
  if (playerB && !isBot(tb.playerB)) playerB.score += result.pointsB;
  if (playerC && !isBot(tb.playerC!)) playerC.score += result.pointsC;
}

export function submitLastLashVotes(
  room: RoomState,
  voterId: string,
  answerIds: string[]
): void {
  room.lastLashVotes[voterId] = answerIds;
}

export function submitThriplashVote(
  room: RoomState,
  voterId: string,
  battleId: string,
  choice: "a" | "b" | "c" | "abstain"
): string | null {
  const tb = room.thriplashBattles.find((b) => b.id === battleId);
  if (!tb) return "Battle not found";
  if (isThriplashBattler(tb, voterId)) return "Cannot vote on own battle";
  tb.votesA = tb.votesA.filter((v) => v !== voterId);
  tb.votesB = tb.votesB.filter((v) => v !== voterId);
  tb.votesC = tb.votesC.filter((v) => v !== voterId);
  tb.abstentions = tb.abstentions.filter((v) => v !== voterId);
  if (choice === "a") tb.votesA.push(voterId);
  else if (choice === "b") tb.votesB.push(voterId);
  else if (choice === "c") tb.votesC.push(voterId);
  else if (choice === "abstain") tb.abstentions.push(voterId);
  return null;
}

export function censorQuip(
  room: RoomState,
  battleId: string,
  target: "a" | "b"
): void {
  const battle = room.battles.find((b) => b.id === battleId);
  if (!battle) return;
  if (target === "a" && battle.answerA) battle.answerA.censored = true;
  if (target === "b" && battle.answerB) battle.answerB.censored = true;
}

export function kickPlayer(room: RoomState, playerId: string): void {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return;
  player.kicked = true;
  player.connected = false;
  room.kickedTokens.add(player.token);
  if (player.isVip) {
    player.isVip = false;
    const next = room.players.find((p) => !p.kicked && !p.isAudience && p.id !== playerId);
    if (next) {
      next.isVip = true;
      room.vipId = next.id;
    } else {
      room.vipId = null;
    }
  }
}

function promoteNextVip(room: RoomState): void {
  const next = room.players.find((p) => !p.kicked && !p.isAudience);
  if (next) {
    next.isVip = true;
    room.vipId = next.id;
  } else {
    room.vipId = null;
  }
}

export function shouldRemovePlayerOnLeave(room: RoomState): boolean {
  return room.phase === "lobby" || room.phase === "podium";
}

export function leavePlayer(room: RoomState, playerId: string): void {
  const index = room.players.findIndex((p) => p.id === playerId);
  if (index === -1) return;

  const player = room.players[index];
  const wasVip = player.isVip;
  room.players.splice(index, 1);

  if (wasVip && shouldRemovePlayerOnLeave(room)) {
    promoteNextVip(room);
  }
}

function pruneDisconnectedPlayers(room: RoomState): void {
  const vipRemoved = room.players.some(
    (p) => p.id === room.vipId && !p.connected && !isBot(p.id)
  );
  room.players = room.players.filter((p) => isBot(p.id) || p.connected);
  if (vipRemoved || (room.vipId && !room.players.some((p) => p.id === room.vipId))) {
    promoteNextVip(room);
  }
}

export function syncLobbyPlayers(room: RoomState): boolean {
  if (room.phase !== "lobby") return false;
  const before = room.players.length;
  pruneDisconnectedPlayers(room);
  return room.players.length !== before;
}

export function resetToLobby(room: RoomState): void {
  pruneDisconnectedPlayers(room);
  for (const p of room.players) {
    if (!isBot(p.id)) {
      p.score = 0;
      p.isAudience = false;
    }
  }
  room.players = room.players.filter((p) => !isBot(p.id));
  room.phase = "lobby";
  room.round = 0;
  room.battles = [];
  room.thriplashBattles = [];
  room.lastLashEntries = [];
  room.lastLashVotes = {};
  room.highlights = [];
  room.currentBattleIndex = 0;
  room.phaseEndsAt = null;
  room.usedPromptIds = new Set();
  room.paused = false;
  room.pauseRemainingMs = null;
  room.pauseBattleVoteGraceRemainingMs = null;
  room.battleVoteGraceUntil = null;
}

export function getPlayerPrompts(room: RoomState, playerId: string): { id: string; text: string }[] {
  return room.battles
    .filter((b) => answerSideForPlayer(b, playerId) !== null)
    .map((b) => ({ id: b.promptId, text: b.promptText }));
}
