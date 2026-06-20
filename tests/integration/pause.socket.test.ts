import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as ioc, Socket } from "socket.io-client";
import { createAppServer } from "../../src/server/index.js";
import { clientEvents, serverEvents } from "../../src/shared/protocol.js";
import type { PublicRoomState } from "../../src/shared/types.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let port: number;
let close: () => void;

function client(): Socket {
  return ioc(`http://localhost:${port}`, { path: "/socket.io", transports: ["websocket"] });
}

function emitAck<T>(socket: Socket, event: string, payload?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), 5000);
    socket.emit(event, payload, (res: T) => {
      clearTimeout(timer);
      if ((res as { ok?: boolean }).ok === false) {
        reject(new Error((res as { error?: string }).error ?? "failed"));
      } else {
        resolve(res);
      }
    });
  });
}

function waitForSnapshot(socket: Socket, predicate: (s: PublicRoomState) => boolean): Promise<PublicRoomState> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout waiting for snapshot")), 5000);
    const handler = (state: PublicRoomState) => {
      if (predicate(state)) {
        clearTimeout(timer);
        socket.off(serverEvents.STATE_SNAPSHOT, handler);
        resolve(state);
      }
    };
    socket.on(serverEvents.STATE_SNAPSHOT, handler);
  });
}

describe("pause socket integration", () => {
  beforeAll(async () => {
    process.env.E2E_MODE = "1";
    process.env.DB_PATH = path.join(__dirname, "../../data/test-pause.db");
    const result = await createAppServer({
      port: 0,
      webRoot: path.join(__dirname, "../../dist/web"),
      skipSeed: false,
    });
    port = result.port;
    close = () => result.server.close();
  }, 15000);

  afterAll(() => {
    close?.();
  });

  it("host pauses and resumes during gameplay; end game returns to lobby", async () => {
    const host = client();
    await new Promise<void>((r, j) => {
      host.on("connect", () => r());
      host.on("connect_error", j);
    });

    const created = await emitAck<{ state: PublicRoomState }>(host, clientEvents.CREATE_ROOM, {});
    const code = created.state.code;

    const vip = client();
    await new Promise<void>((r, j) => {
      vip.on("connect", () => r());
      vip.on("connect_error", j);
    });
    await emitAck(vip, clientEvents.JOIN_ROOM, { code, name: "VIP" });

    const p2 = client();
    await new Promise<void>((r, j) => {
      p2.on("connect", () => r());
      p2.on("connect_error", j);
    });
    await emitAck(p2, clientEvents.JOIN_ROOM, { code, name: "Bob" });

    const p3 = client();
    await new Promise<void>((r, j) => {
      p3.on("connect", () => r());
      p3.on("connect_error", j);
    });
    await emitAck(p3, clientEvents.JOIN_ROOM, { code, name: "Carol" });

    const inGame = waitForSnapshot(vip, (s) => s.phase === "round1_answer");
    await emitAck(vip, clientEvents.START_GAME);
    const gameState = await inGame;
    expect(gameState.paused).toBe(false);

    const pausedPromise = waitForSnapshot(vip, (s) => s.paused);
    await emitAck(host, clientEvents.PAUSE_GAME);
    const pausedState = await pausedPromise;
    expect(pausedState.paused).toBe(true);
    expect(pausedState.phaseEndsAt).toBeNull();
    expect(pausedState.pausedRemainingMs).toBeGreaterThan(0);

    await expect(emitAck(vip, clientEvents.PAUSE_GAME)).rejects.toThrow("Host only");

    const resumedPromise = waitForSnapshot(vip, (s) => !s.paused);
    await emitAck(host, clientEvents.RESUME_GAME);
    const resumedState = await resumedPromise;
    expect(resumedState.paused).toBe(false);
    expect(resumedState.phaseEndsAt).toBeGreaterThan(Date.now());

    await emitAck(host, clientEvents.PAUSE_GAME);
    await waitForSnapshot(vip, (s) => s.paused);

    const lobbyPromise = waitForSnapshot(vip, (s) => s.phase === "lobby");
    await emitAck(host, clientEvents.PLAY_AGAIN);
    const lobbyState = await lobbyPromise;
    expect(lobbyState.paused).toBe(false);
    expect(lobbyState.round).toBe(0);

    host.disconnect();
    vip.disconnect();
    p2.disconnect();
    p3.disconnect();
  }, 15000);
});
