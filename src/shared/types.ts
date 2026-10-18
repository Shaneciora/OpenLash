export type GamePhase =
  | "lobby"
  | "round1_answer"
  | "round1_battle"
  | "round1_battle_reveal"
  | "round1_scores"
  | "round2_answer"
  | "round2_battle"
  | "round2_battle_reveal"
  | "round2_scores"
  | "final_answer"
  | "final_vote"
  | "final_vote_reveal"
  | "final_reveal"
  | "podium";

export type PromptType = "regular" | "thriplash";
export type FinalRoundMode = "thriplash" | "last_lash";
export type PromptSource = "builtin" | "collection" | "mixed";
export type BotTestLobbyMode = "off" | "max" | "lobby_3" | "lobby_7" | "lobby_full";

export interface GameSettings {
  audienceEnabled: boolean;
  maxPlayers: number;
  minPlayers: number;
  password: string | null;
  moderationEnabled: boolean;
  finalRoundMode: FinalRoundMode;
  promptSource: PromptSource;
  collectionId: number | null;
  skipBattleIntros: boolean;
  roomCodeHidden: boolean;
  motionSensitivity: boolean;
  subtitles: boolean;
  narratorEnabled: boolean;
  botTestLobbyMode: BotTestLobbyMode;
}

export const DEFAULT_SETTINGS: GameSettings = {
  audienceEnabled: true,
  maxPlayers: 20,
  minPlayers: 3,
  password: null,
  moderationEnabled: false,
  finalRoundMode: "thriplash",
  promptSource: "collection",
  collectionId: null,
  skipBattleIntros: false,
  roomCodeHidden: false,
  motionSensitivity: false,
  subtitles: false,
  narratorEnabled: false,
  botTestLobbyMode: "off",
};

export interface Player {
  id: string;
  token: string;
  name: string;
  avatar: string | null;
  isAudience: boolean;
  isVip: boolean;
  score: number;
  connected: boolean;
  kicked: boolean;
}

export interface Prompt {
  id: string;
  text: string;
  type: PromptType;
  mature: boolean;
  usCentric: boolean;
}

export interface Answer {
  playerId: string;
  text: string;
  censored: boolean;
  moderated: boolean;
  approved: boolean | null;
}

export interface Battle {
  id: string;
  promptId: string;
  promptText: string;
  playerA: string;
  playerB: string;
  playerC: string | null;
  answerA: Answer | null;
  answerB: Answer | null;
  answerC: Answer | null;
  votesA: string[];
  votesB: string[];
  votesC: string[];
  abstentions: string[];
  result: BattleResult | null;
}

export interface BattleResult {
  jinx: boolean;
  quiplash: boolean;
  superQuiplash: boolean;
  pointsA: number;
  pointsB: number;
  pointsC: number;
  winnerId: "a" | "b" | "c" | null;
}

export interface ThriplashBattle {
  id: string;
  promptId: string;
  promptText: string;
  playerA: string;
  playerB: string;
  playerC: string | null;
  answersA: Answer[];
  answersB: Answer[];
  answersC: Answer[];
  votesA: string[];
  votesB: string[];
  votesC: string[];
  abstentions: string[];
  result: BattleResult | null;
}

export interface LastLashEntry {
  playerId: string;
  answer: Answer | null;
  votes: number;
  points: number;
}

export interface RoomState {
  code: string;
  phase: GamePhase;
  settings: GameSettings;
  players: Player[];
  modPassword: string | null;
  joinUrl: string;
  vipId: string | null;
  phaseEndsAt: number | null;
  round: number;
  battles: Battle[];
  currentBattleIndex: number;
  thriplashBattles: ThriplashBattle[];
  lastLashPrompt: string | null;
  lastLashEntries: LastLashEntry[];
  lastLashVotes: Record<string, string[]>;
  assignedPrompts: Record<string, string[]>;
  promptPool: Prompt[];
  usedPromptIds: Set<string>;
  kickedTokens: Set<string>;
  highlights: { text: string; playerName: string; votes: number }[];
  battleVoteGraceUntil: number | null;
  paused: boolean;
  pauseRemainingMs: number | null;
  pauseBattleVoteGraceRemainingMs: number | null;
}

export interface PublicRoomState {
  code: string;
  phase: GamePhase;
  settings: GameSettings;
  players: Player[];
  joinUrl: string;
  vipId: string | null;
  phaseEndsAt: number | null;
  round: number;
  battles: Battle[];
  currentBattleIndex: number;
  thriplashBattles: ThriplashBattle[];
  lastLashPrompt: string | null;
  lastLashEntries: LastLashEntry[];
  modPassword: string | null;
  highlights: { text: string; playerName: string; votes: number }[];
  paused: boolean;
  pausedRemainingMs: number | null;
}

export interface Collection {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionPrompt {
  id: number;
  collectionId: number;
  text: string;
  type: PromptType;
  mature: boolean;
  usCentric: boolean;
}

export interface SettingsPreset {
  id: number;
  name: string;
  settings: GameSettings;
}
