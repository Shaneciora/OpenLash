import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as ioc, Socket } from "socket.io-client";
import { createAppServer } from "../../src/server/index.js";
import { getRoom, setRoom } from "../../src/server/rooms.js";
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

describe("socket integration", () => {
  beforeAll(async () => {
    process.env.E2E_MODE = "1";
    process.env.DB_PATH = path.join(__dirname, "../../data/test-integration.db");
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

  it("creates room and joins players", async () => {
    const host = client();
    await new Promise<void>((r, j) => {
      host.on("connect", () => r());
      host.on("connect_error", j);
    });

    const created = await emitAck<{ state: PublicRoomState }>(host, clientEvents.CREATE_ROOM, {});
    expect(created.state.code).toHaveLength(4);
    expect(created.state.settings.promptSource).toBe("collection");
    expect(created.state.settings.collectionId).toBeTruthy();

    const p1 = client();
    await new Promise<void>((r, j) => {
      p1.on("connect", () => r());
      p1.on("connect_error", j);
    });
    const joined = await emitAck<{ player: { name: string }; state: PublicRoomState }>(
      p1,
      clientEvents.JOIN_ROOM,
      { code: created.state.code, name: "Alice" }
    );
    expect(joined.player.name).toBe("Alice");

    host.disconnect();
    p1.disconnect();
  }, 15000);

  it("checks room password requirement", async () => {
    const host = client();
    await new Promise<void>((r, j) => {
      host.on("connect", () => r());
      host.on("connect_error", j);
    });

    const created = await emitAck<{ state: PublicRoomState }>(host, clientEvents.CREATE_ROOM, {
      settings: { password: "secret" },
    });

    const checker = client();
    await new Promise<void>((r, j) => {
      checker.on("connect", () => r());
      checker.on("connect_error", j);
    });

    const needsPassword = await emitAck<{ passwordRequired: boolean }>(
      checker,
      clientEvents.CHECK_ROOM,
      { code: created.state.code }
    );
    expect(needsPassword.passwordRequired).toBe(true);

    await expect(
      emitAck(checker, clientEvents.CHECK_ROOM, {
        code: created.state.code,
        password: "wrong",
      })
    ).rejects.toThrow("Wrong password");

    const verified = await emitAck<{ passwordRequired: boolean }>(
      checker,
      clientEvents.CHECK_ROOM,
      { code: created.state.code, password: "secret" }
    );
    expect(verified.passwordRequired).toBe(true);

    host.disconnect();
    checker.disconnect();
  }, 15000);

  it("removes player from lobby on leave and promotes VIP", async () => {
    const host = client();
    await new Promise<void>((r, j) => {
      host.on("connect", () => r());
      host.on("connect_error", j);
    });

    const created = await emitAck<{ state: PublicRoomState }>(host, clientEvents.CREATE_ROOM, {});

    const vip = client();
    const next = client();
    await Promise.all([
      new Promise<void>((r, j) => {
        vip.on("connect", () => r());
        vip.on("connect_error", j);
      }),
      new Promise<void>((r, j) => {
        next.on("connect", () => r());
        next.on("connect_error", j);
      }),
    ]);

    await emitAck(vip, clientEvents.JOIN_ROOM, { code: created.state.code, name: "VIP" });
    await emitAck(next, clientEvents.JOIN_ROOM, { code: created.state.code, name: "Next" });

    await emitAck(vip, clientEvents.LEAVE_ROOM, {});

    const rejoined = await emitAck<{ state: PublicRoomState }>(host, clientEvents.HOST_JOIN, {
      code: created.state.code,
    });
    expect(rejoined.state.players).toHaveLength(1);
    expect(rejoined.state.players[0].name).toBe("Next");
    expect(rejoined.state.players[0].isVip).toBe(true);
    expect(rejoined.state.vipId).toBe(rejoined.state.players[0].id);

    host.disconnect();
    vip.disconnect();
    next.disconnect();
  }, 15000);

  it("kicks player from lobby and promotes VIP", async () => {
    const host = client();
    await new Promise<void>((r, j) => {
      host.on("connect", () => r());
      host.on("connect_error", j);
    });

    const created = await emitAck<{ state: PublicRoomState }>(host, clientEvents.CREATE_ROOM, {});
    await emitAck(host, clientEvents.HOST_JOIN, { code: created.state.code });

    const vip = client();
    const next = client();
    await Promise.all([
      new Promise<void>((r, j) => {
        vip.on("connect", () => r());
        vip.on("connect_error", j);
      }),
      new Promise<void>((r, j) => {
        next.on("connect", () => r());
        next.on("connect_error", j);
      }),
    ]);

    const vipJoin = await emitAck<{ player: { id: string } }>(vip, clientEvents.JOIN_ROOM, {
      code: created.state.code,
      name: "VIP",
    });
    await emitAck(next, clientEvents.JOIN_ROOM, { code: created.state.code, name: "Next" });

    const kicked = await emitAck<{ ok: boolean }>(host, clientEvents.KICK_PLAYER, {
      playerId: vipJoin.player.id,
    });
    expect(kicked.ok).toBe(true);

    const refreshed = await emitAck<{ state: PublicRoomState }>(host, clientEvents.HOST_JOIN, {
      code: created.state.code,
    });
    const active = refreshed.state.players.filter((p) => !p.isAudience && !p.kicked);
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe("Next");
    expect(active[0].isVip).toBe(true);
    expect(refreshed.state.vipId).toBe(active[0].id);

    host.disconnect();
    vip.disconnect();
    next.disconnect();
  }, 15000);

  it("removes player who left on podium when VIP plays again", async () => {
    const host = client();
    await new Promise<void>((r, j) => {
      host.on("connect", () => r());
      host.on("connect_error", j);
    });

    const created = await emitAck<{ state: PublicRoomState }>(host, clientEvents.CREATE_ROOM, {});

    const vip = client();
    const leaver = client();
    await Promise.all([
      new Promise<void>((r, j) => {
        vip.on("connect", () => r());
        vip.on("connect_error", j);
      }),
      new Promise<void>((r, j) => {
        leaver.on("connect", () => r());
        leaver.on("connect_error", j);
      }),
    ]);

    await emitAck(vip, clientEvents.JOIN_ROOM, { code: created.state.code, name: "VIP" });
    await emitAck(leaver, clientEvents.JOIN_ROOM, { code: created.state.code, name: "Gone" });

    const room = getRoom(created.state.code);
    expect(room).toBeTruthy();
    room!.phase = "podium";
    setRoom(room!);

    await emitAck(leaver, clientEvents.LEAVE_ROOM, {});

    const afterLeave = await emitAck<{ state: PublicRoomState }>(host, clientEvents.HOST_JOIN, {
      code: created.state.code,
    });
    expect(afterLeave.state.players.filter((p) => !p.isAudience && !p.kicked)).toHaveLength(1);
    expect(afterLeave.state.players[0].name).toBe("VIP");

    await emitAck(vip, clientEvents.PLAY_AGAIN, {});

    const afterPlayAgain = await emitAck<{ state: PublicRoomState }>(host, clientEvents.HOST_JOIN, {
      code: created.state.code,
    });
    expect(afterPlayAgain.state.phase).toBe("lobby");
    expect(afterPlayAgain.state.players.filter((p) => !p.isAudience && !p.kicked)).toHaveLength(1);
    expect(afterPlayAgain.state.players[0].name).toBe("VIP");

    host.disconnect();
    vip.disconnect();
    leaver.disconnect();
  }, 15000);

  it("closes lobby and notifies players when host disconnects", async () => {
    const host = client();
    await new Promise<void>((r, j) => {
      host.on("connect", () => r());
      host.on("connect_error", j);
    });

    const created = await emitAck<{ state: PublicRoomState }>(host, clientEvents.CREATE_ROOM, {});

    const player = client();
    await new Promise<void>((r, j) => {
      player.on("connect", () => r());
      player.on("connect_error", j);
    });

    await emitAck(player, clientEvents.JOIN_ROOM, {
      code: created.state.code,
      name: "Shane",
    });

    const closed = new Promise<void>((resolve) => {
      player.on(serverEvents.ROOM_CLOSED, () => resolve());
    });

    host.disconnect();
    await closed;

    expect(getRoom(created.state.code)).toBeUndefined();

    player.disconnect();
  }, 15000);

  it("closes previous lobby when host creates a new room", async () => {
    const host = client();
    await new Promise<void>((r, j) => {
      host.on("connect", () => r());
      host.on("connect_error", j);
    });

    const first = await emitAck<{ state: PublicRoomState }>(host, clientEvents.CREATE_ROOM, {});
    const firstCode = first.state.code;

    const player = client();
    await new Promise<void>((r, j) => {
      player.on("connect", () => r());
      player.on("connect_error", j);
    });

    await emitAck(player, clientEvents.JOIN_ROOM, {
      code: firstCode,
      name: "Shane",
    });

    const closed = new Promise<void>((resolve) => {
      player.on(serverEvents.ROOM_CLOSED, () => resolve());
    });

    const second = await emitAck<{ state: PublicRoomState }>(host, clientEvents.CREATE_ROOM, {});
    await closed;

    expect(getRoom(firstCode)).toBeUndefined();
    expect(getRoom(second.state.code)).toBeTruthy();
    expect(second.state.code).not.toBe(firstCode);

    host.disconnect();
    player.disconnect();
  }, 15000);

  it("fills and clears bots when debug bot mode changes", async () => {
    const host = client();
    await new Promise<void>((r, j) => {
      host.on("connect", () => r());
      host.on("connect_error", j);
    });

    const created = await emitAck<{ state: PublicRoomState }>(host, clientEvents.CREATE_ROOM, {});
    await emitAck(host, clientEvents.HOST_JOIN, { code: created.state.code });

    const player = client();
    await new Promise<void>((r, j) => {
      player.on("connect", () => r());
      player.on("connect_error", j);
    });
    await emitAck(player, clientEvents.JOIN_ROOM, {
      code: created.state.code,
      name: "Alice",
    });

    await emitAck(host, clientEvents.UPDATE_SETTINGS, {
      botTestLobbyMode: "lobby_3",
    });
    const filled = getRoom(created.state.code)!;
    expect(filled.players.filter((p) => p.name.startsWith("Bot"))).toHaveLength(2);

    await emitAck(host, clientEvents.UPDATE_SETTINGS, {
      botTestLobbyMode: "off",
    });
    const cleared = getRoom(created.state.code)!;
    expect(cleared.players.filter((p) => p.name.startsWith("Bot"))).toHaveLength(0);
    expect(cleared.players).toHaveLength(1);

    host.disconnect();
    player.disconnect();
  }, 15000);
});
