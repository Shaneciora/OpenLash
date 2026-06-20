import { z } from "zod";

export const clientEvents = {
  JOIN_ROOM: "join_room",
  CHECK_ROOM: "check_room",
  LEAVE_ROOM: "leave_room",
  CREATE_ROOM: "create_room",
  START_GAME: "start_game",
  SUBMIT_ANSWERS: "submit_answers",
  SUBMIT_VOTE: "submit_vote",
  SUBMIT_LAST_LASH_VOTES: "submit_last_lash_votes",
  CENSOR_QUIP: "censor_quip",
  MOD_DECISION: "mod_decision",
  KICK_PLAYER: "kick_player",
  PLAY_AGAIN: "play_again",
  PAUSE_GAME: "pause_game",
  RESUME_GAME: "resume_game",
  REVEAL_CODE: "reveal_code",
  HOST_JOIN: "host_join",
  UPDATE_SETTINGS: "update_settings",
} as const;

export const serverEvents = {
  STATE_SNAPSHOT: "state_snapshot",
  ERROR: "error",
  MOD_QUEUE: "mod_queue",
  ROOM_CLOSED: "room_closed",
} as const;

export const checkRoomSchema = z.object({
  code: z.string().length(4),
  password: z.string().optional(),
});

export const joinRoomSchema = z.object({
  code: z.string().length(4),
  name: z.string().min(1).max(16),
  token: z.string().optional(),
  password: z.string().optional(),
  avatar: z.string().nullable().optional(),
  role: z.enum(["player", "audience", "mod"]).optional(),
  modPassword: z.string().optional(),
});

export const createRoomSchema = z.object({
  settings: z.record(z.unknown()).optional(),
});

export const submitAnswersSchema = z.object({
  answers: z.array(
    z.object({
      promptId: z.string(),
      text: z.string().max(60),
      slot: z.number().optional(),
      battleId: z.string().optional(),
    })
  ),
});

export const submitVoteSchema = z.object({
  battleId: z.string(),
  choice: z.enum(["a", "b", "c", "abstain"]),
});

export const submitLastLashVotesSchema = z.object({
  answerIds: z.array(z.string()).max(3),
});

export const modDecisionSchema = z.object({
  itemId: z.string(),
  approved: z.boolean(),
});

export const censorQuipSchema = z.object({
  battleId: z.string(),
  target: z.enum(["a", "b"]),
});

export const kickPlayerSchema = z.object({
  playerId: z.string(),
});

export const updateSettingsSchema = z.object({
  subtitles: z.boolean().optional(),
  narratorEnabled: z.boolean().optional(),
  password: z.string().max(32).nullable().optional(),
  audienceEnabled: z.boolean().optional(),
  maxPlayers: z.number().min(3).max(20).optional(),
  moderationEnabled: z.boolean().optional(),
  finalRoundMode: z.enum(["thriplash", "last_lash"]).optional(),
  roomCodeHidden: z.boolean().optional(),
  motionSensitivity: z.boolean().optional(),
  promptSource: z.enum(["builtin", "collection", "mixed"]).optional(),
  collectionId: z.number().nullable().optional(),
  botTestLobbyMode: z.enum(["off", "max", "lobby_3", "lobby_7", "lobby_full"]).optional(),
});

export type CheckRoomPayload = z.infer<typeof checkRoomSchema>;
export type JoinRoomPayload = z.infer<typeof joinRoomSchema>;
export type SubmitAnswersPayload = z.infer<typeof submitAnswersSchema>;
export type SubmitVotePayload = z.infer<typeof submitVoteSchema>;
