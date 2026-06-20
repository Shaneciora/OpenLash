import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { RoomState } from "../shared/types.js";
import { applyBotLobbySettings } from "../game/engine.js";
import {
  createRoom,
  toPublicState,
  joinRoom,
  canStartGame,
  fillLobbyWithBots,
  startGame,
  submitAnswers,
  submitBotAnswers,
  advanceFromAnswerPhase,
  advanceFromVotePhase,
  finishBattleVoting,
  submitVote,
  advancePhaseOnTimer,
  submitLastLashVotes,
  submitThriplashVote,
  censorQuip,
  kickPlayer,
  leavePlayer,
  shouldRemovePlayerOnLeave,
  syncLobbyPlayers,
  resetToLobby,
  pauseGame,
  resumeGame,
  getPlayerPrompts,
} from "../game/engine.js";
import { deleteRoom, getRoom, setRoom } from "./rooms.js";
import { buildJoinUrl } from "./lan.js";
import { resolvePlayJoinBase } from "./joinBase.js";
import { isUsablePlayBase } from "../shared/joinUrl.js";
import { loadPromptsSync, resolveLobbySettings } from "../db/seed.js";
import {
  clientEvents,
  serverEvents,
  checkRoomSchema,
  joinRoomSchema,
  submitAnswersSchema,
  submitVoteSchema,
  submitLastLashVotesSchema,
  modDecisionSchema,
  censorQuipSchema,
  kickPlayerSchema,
  updateSettingsSchema,
} from "../shared/protocol.js";

interface ModQueueItem {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  battleId?: string;
}

const modQueues = new Map<string, ModQueueItem[]>();

function isUnreachableJoinUrl(url: string): boolean {
  return !isUsablePlayBase(url);
}

async function resolveJoinUrl(hostHeader: string | undefined, port: number): Promise<string> {
  const { playBase } = await resolvePlayJoinBase(hostHeader, port);
  return playBase ?? buildJoinUrl(port) ?? `http://127.0.0.1:${port}/play`;
}

export function setupSocket(httpServer: HttpServer, port: number) {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
    path: "/socket.io",
  });

  const roomTimers = new Map<string, ReturnType<typeof setInterval>>();

  function broadcast(room: RoomState) {
    io.to(room.code).emit(serverEvents.STATE_SNAPSHOT, toPublicState(room));
  }

  function closeRoom(roomCode: string) {
    const timer = roomTimers.get(roomCode);
    if (timer) {
      clearInterval(timer);
      roomTimers.delete(roomCode);
    }
    modQueues.delete(roomCode);
    io.to(roomCode).emit(serverEvents.ROOM_CLOSED);
    deleteRoom(roomCode);
  }

  function startPhaseTimer(room: RoomState) {
    const existing = roomTimers.get(room.code);
    if (existing) clearInterval(existing);

    const interval = setInterval(() => {
      const r = getRoom(room.code);
      if (!r || r.paused) return;

      if (syncLobbyPlayers(r)) {
        setRoom(r);
        broadcast(r);
      }

      if (!r.phaseEndsAt) {
        // still run bot logic for answer/vote phases without timers
      } else if (Date.now() >= r.phaseEndsAt) {
        advancePhaseOnTimer(r);
        setRoom(r);
        broadcast(r);
      }

      if (r.phase === "round1_answer" || r.phase === "round2_answer" || r.phase === "final_answer") {
        submitBotAnswers(r);
        if (advanceFromAnswerPhase(r)) {
          setRoom(r);
          broadcast(r);
        }
      }

      if (
        r.phase === "round1_battle" ||
        r.phase === "round2_battle" ||
        (r.phase === "final_vote" && r.settings.finalRoundMode === "thriplash")
      ) {
        if (advanceFromVotePhase(r)) {
          setRoom(r);
          broadcast(r);
        }
      }
    }, 500);

    roomTimers.set(room.code, interval);
  }

  io.on("connection", (socket) => {
    let currentRoom: string | null = null;
    let playerId: string | null = null;
    let isHostDisplay = false;

    socket.on(clientEvents.HOST_JOIN, async (payload, ack) => {
      const code = String(payload?.code ?? "").toUpperCase();
      const room = getRoom(code);
      if (!room) {
        ack?.({ ok: false, error: "Room not found" });
        return;
      }
      socket.join(room.code);
      currentRoom = room.code;
      isHostDisplay = true;
      const joinUrl = await resolveJoinUrl(socket.handshake.headers.host, port);
      if (isUnreachableJoinUrl(room.joinUrl)) {
        room.joinUrl = joinUrl;
        setRoom(room);
      }
      ack?.({ ok: true, state: toPublicState(room) });
    });

    socket.on(clientEvents.CREATE_ROOM, async (payload, ack) => {
      if (currentRoom && isHostDisplay) {
        const previousRoom = getRoom(currentRoom);
        if (previousRoom?.phase === "lobby") {
          closeRoom(currentRoom);
        }
        void socket.leave(currentRoom);
      }

      const joinUrl = await resolveJoinUrl(socket.handshake.headers.host, port);
      const settings = resolveLobbySettings(payload?.settings);
      const room = createRoom(joinUrl, settings);
      setRoom(room);
      socket.join(room.code);
      currentRoom = room.code;
      isHostDisplay = true;
      startPhaseTimer(room);
      ack?.({ ok: true, state: toPublicState(room) });
      broadcast(room);
    });

    socket.on(clientEvents.CHECK_ROOM, (payload, ack) => {
      const parsed = checkRoomSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ ok: false, error: "Invalid room code" });
        return;
      }

      const code = parsed.data.code.toUpperCase();
      const room = getRoom(code);
      if (!room) {
        ack?.({ ok: false, error: "Room not found" });
        return;
      }

      const passwordRequired = Boolean(room.settings.password);
      if (!passwordRequired) {
        ack?.({ ok: true, passwordRequired: false });
        return;
      }

      const password = parsed.data.password;
      if (!password) {
        ack?.({ ok: true, passwordRequired: true });
        return;
      }

      if (room.settings.password !== password) {
        ack?.({ ok: false, error: "Wrong password" });
        return;
      }

      ack?.({ ok: true, passwordRequired: true });
    });

    socket.on(clientEvents.LEAVE_ROOM, (_, ack) => {
      if (currentRoom && playerId) {
        const room = getRoom(currentRoom);
        if (room) {
          if (shouldRemovePlayerOnLeave(room)) {
            leavePlayer(room, playerId);
          } else {
            const player = room.players.find((p) => p.id === playerId);
            if (player) player.connected = false;
          }
          setRoom(room);
          broadcast(room);
        }
        void socket.leave(currentRoom);
      }
      currentRoom = null;
      playerId = null;
      ack?.({ ok: true });
    });

    socket.on(clientEvents.JOIN_ROOM, (payload, ack) => {
      const parsed = joinRoomSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.({ ok: false, error: "Invalid join data" });
        return;
      }

      const { code, name, token, password, avatar, role, modPassword } = parsed.data;
      const room = getRoom(code);
      if (!room) {
        ack?.({ ok: false, error: "Room not found" });
        return;
      }

      if (role === "mod") {
        if (room.modPassword !== modPassword) {
          ack?.({ ok: false, error: "Invalid mod password" });
          return;
        }
        socket.join(room.code);
        currentRoom = room.code;
        ack?.({ ok: true, role: "mod", queue: modQueues.get(room.code) ?? [] });
        return;
      }

      const displayName = name.trim().slice(0, 16);
      if (!displayName) {
        ack?.({ ok: false, error: "Name required" });
        return;
      }

      const result = joinRoom(
        room,
        displayName,
        token,
        password,
        avatar ?? null,
        role === "audience"
      );

      if (result.error) {
        ack?.({ ok: false, error: result.error });
        return;
      }

      playerId = result.player.id;
      socket.join(room.code);
      currentRoom = room.code;
      isHostDisplay = false;
      setRoom(room);
      ack?.({
        ok: true,
        player: result.player,
        state: toPublicState(room),
        prompts: getPlayerPrompts(room, result.player.id),
      });
      broadcast(room);
    });

    socket.on(clientEvents.START_GAME, (_, ack) => {
      const room = currentRoom ? getRoom(currentRoom) : null;
      if (!room) return ack?.({ ok: false, error: "No room" });
      if (room.vipId !== playerId) return ack?.({ ok: false, error: "Only VIP can start" });
      if (!canStartGame(room)) return ack?.({ ok: false, error: "Not enough players" });

      fillLobbyWithBots(room);
      const promptList = loadPromptsSync(
        room.settings.collectionId,
        room.settings.promptSource
      );
      startGame(room, promptList);
      submitBotAnswers(room);
      setRoom(room);
      startPhaseTimer(room);
      ack?.({ ok: true });
      broadcast(room);
    });

    socket.on(clientEvents.SUBMIT_ANSWERS, (payload, ack) => {
      const parsed = submitAnswersSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "Invalid answers" });
      const room = currentRoom ? getRoom(currentRoom) : null;
      if (!room || !playerId) return ack?.({ ok: false, error: "No room" });

      const err = submitAnswers(room, playerId, parsed.data.answers);
      if (err) return ack?.({ ok: false, error: err });

      if (room.settings.moderationEnabled) {
        const queue = modQueues.get(room.code) ?? [];
        for (const a of parsed.data.answers) {
          queue.push({
            id: `${playerId}-${a.promptId}`,
            playerId,
            playerName: room.players.find((p) => p.id === playerId)?.name ?? "?",
            text: a.text,
          });
        }
        modQueues.set(room.code, queue);
        io.to(room.code).emit(serverEvents.MOD_QUEUE, queue);
      }

      advanceFromAnswerPhase(room);
      setRoom(room);
      ack?.({ ok: true });
      broadcast(room);
    });

    socket.on(clientEvents.SUBMIT_VOTE, (payload, ack) => {
      const parsed = submitVoteSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "Invalid vote" });
      const room = currentRoom ? getRoom(currentRoom) : null;
      if (!room || !playerId) return ack?.({ ok: false, error: "No room" });

      if (room.phase === "final_vote" && room.settings.finalRoundMode === "thriplash") {
        const err = submitThriplashVote(
          room,
          playerId,
          parsed.data.battleId,
          parsed.data.choice
        );
        if (err) return ack?.({ ok: false, error: err });
      } else {
        const err = submitVote(
          room,
          playerId,
          parsed.data.battleId,
          parsed.data.choice
        );
        if (err) return ack?.({ ok: false, error: err });
      }

      advanceFromVotePhase(room, { force: true });
      setRoom(room);
      ack?.({ ok: true });
      broadcast(room);
    });

    socket.on(clientEvents.SUBMIT_LAST_LASH_VOTES, (payload, ack) => {
      const parsed = submitLastLashVotesSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "Invalid votes" });
      const room = currentRoom ? getRoom(currentRoom) : null;
      if (!room || !playerId) return ack?.({ ok: false, error: "No room" });
      submitLastLashVotes(room, playerId, parsed.data.answerIds);
      setRoom(room);
      ack?.({ ok: true });
      broadcast(room);
    });

    socket.on(clientEvents.CENSOR_QUIP, (payload, ack) => {
      const parsed = censorQuipSchema.safeParse(payload);
      if (!parsed.success) return;
      const room = currentRoom ? getRoom(currentRoom) : null;
      if (!room || room.vipId !== playerId) return ack?.({ ok: false });
      censorQuip(room, parsed.data.battleId, parsed.data.target);
      setRoom(room);
      broadcast(room);
      ack?.({ ok: true });
    });

    socket.on(clientEvents.MOD_DECISION, (payload, ack) => {
      const parsed = modDecisionSchema.safeParse(payload);
      if (!parsed.success) return;
      const room = currentRoom ? getRoom(currentRoom) : null;
      if (!room) return;
      const queue = modQueues.get(room.code) ?? [];
      modQueues.set(
        room.code,
        queue.filter((q) => q.id !== parsed.data.itemId)
      );
      io.to(room.code).emit(serverEvents.MOD_QUEUE, modQueues.get(room.code));
      ack?.({ ok: true });
    });

    socket.on(clientEvents.KICK_PLAYER, (payload, ack) => {
      const parsed = kickPlayerSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "Invalid kick data" });
      const room = currentRoom ? getRoom(currentRoom) : null;
      if (!room) return ack?.({ ok: false, error: "No room" });
      if (room.phase !== "lobby") return ack?.({ ok: false, error: "Can only kick in lobby" });
      kickPlayer(room, parsed.data.playerId);
      setRoom(room);
      broadcast(room);
      ack?.({ ok: true });
    });

    socket.on(clientEvents.PLAY_AGAIN, (_, ack) => {
      const room = currentRoom ? getRoom(currentRoom) : null;
      if (!room) return;
      resetToLobby(room);
      setRoom(room);
      broadcast(room);
      ack?.({ ok: true });
    });

    socket.on(clientEvents.PAUSE_GAME, (_, ack) => {
      if (!isHostDisplay) return ack?.({ ok: false, error: "Host only" });
      const room = currentRoom ? getRoom(currentRoom) : null;
      if (!room) return ack?.({ ok: false, error: "No room" });
      if (!pauseGame(room)) return ack?.({ ok: false, error: "Cannot pause" });
      setRoom(room);
      broadcast(room);
      ack?.({ ok: true });
    });

    socket.on(clientEvents.RESUME_GAME, (_, ack) => {
      if (!isHostDisplay) return ack?.({ ok: false, error: "Host only" });
      const room = currentRoom ? getRoom(currentRoom) : null;
      if (!room) return ack?.({ ok: false, error: "No room" });
      if (!resumeGame(room)) return ack?.({ ok: false, error: "Not paused" });
      setRoom(room);
      broadcast(room);
      ack?.({ ok: true });
    });

    socket.on(clientEvents.REVEAL_CODE, (_, ack) => {
      const room = currentRoom ? getRoom(currentRoom) : null;
      if (!room) return;
      room.settings.roomCodeHidden = false;
      setRoom(room);
      broadcast(room);
      ack?.({ ok: true });
    });

    socket.on(clientEvents.UPDATE_SETTINGS, (payload, ack) => {
      const parsed = updateSettingsSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "Invalid settings" });
      const room = currentRoom ? getRoom(currentRoom) : null;
      if (!room) return ack?.({ ok: false, error: "No room" });
      if (room.phase !== "lobby") return ack?.({ ok: false, error: "Settings locked after start" });
      room.settings = { ...room.settings, ...parsed.data };
      applyBotLobbySettings(room);
      setRoom(room);
      broadcast(room);
      ack?.({ ok: true });
    });

    socket.on("disconnect", () => {
      if (currentRoom && isHostDisplay && !playerId) {
        const room = getRoom(currentRoom);
        if (room?.phase === "lobby") {
          closeRoom(currentRoom);
        }
        return;
      }

      if (!currentRoom || !playerId) return;
      const room = getRoom(currentRoom);
      if (!room) return;
      const player = room.players.find((p) => p.id === playerId);
      if (player) player.connected = false;
      setRoom(room);
      broadcast(room);
    });
  });

  return io;
}

export function createTestSocketServer(httpServer: HttpServer, port: number) {
  return setupSocket(httpServer, port);
}
