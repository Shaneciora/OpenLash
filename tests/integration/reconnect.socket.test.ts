import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as ioc, Socket } from "socket.io-client";
import { createAppServer } from "../../src/server/index.js";
import { getRoom, setRoom } from "../../src/server/rooms.js";
import { clientEvents } from "../../src/shared/protocol.js";
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

describe("player reconnect socket integration", () => {
  beforeAll(async () => {
    process.env.E2E_MODE = "1";
    process.env.DB_PATH = path.join(__dirname, "../../data/test-reconnect.db");
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

  it("rejoins with token after disconnect so votes count", async () => {
    const host = client();
    await new Promise<void>((r, j) => {
      host.on("connect", () => r());
      host.on("connect_error", j);
    });

    const created = await emitAck<{ state: PublicRoomState }>(host, clientEvents.CREATE_ROOM, {});
    const code = created.state.code;

    const alice = client();
    const bob = client();
    const carol = client();
    await Promise.all(
      [alice, bob, carol].map(
        (socket) =>
          new Promise<void>((r, j) => {
            socket.on("connect", () => r());
            socket.on("connect_error", j);
          })
      )
    );

    const aliceJoin = await emitAck<{ player: { id: string; token: string } }>(
      alice,
      clientEvents.JOIN_ROOM,
      { code, name: "Alice" }
    );
    const bobJoin = await emitAck<{ player: { id: string } }>(bob, clientEvents.JOIN_ROOM, {
      code,
      name: "Bob",
    });
    const carolJoin = await emitAck<{ player: { id: string } }>(carol, clientEvents.JOIN_ROOM, {
      code,
      name: "Carol",
    });

    const room = getRoom(code);
    expect(room).toBeTruthy();
    const battleId = "battle-test";
    room!.phase = "round1_battle";
    room!.round = 1;
    room!.battles = [
      {
        id: battleId,
        promptId: "p1",
        promptText: "Test prompt",
        playerA: bobJoin.player.id,
        playerB: carolJoin.player.id,
        playerC: null,
        answerA: {
          playerId: bobJoin.player.id,
          text: "Bob answer",
          censored: false,
          moderated: false,
          approved: true,
        },
        answerB: {
          playerId: carolJoin.player.id,
          text: "Carol answer",
          censored: false,
          moderated: false,
          approved: true,
        },
        answerC: null,
        votesA: [],
        votesB: [],
        votesC: [],
        abstentions: [],
        result: null,
      },
    ];
    room!.currentBattleIndex = 0;
    setRoom(room!);

    alice.disconnect();

    const fresh = client();
    await new Promise<void>((r, j) => {
      fresh.on("connect", () => r());
      fresh.on("connect_error", j);
    });

    await expect(
      emitAck(fresh, clientEvents.SUBMIT_VOTE, {
        battleId,
        choice: "a",
      })
    ).rejects.toThrow("No room");

    await emitAck(fresh, clientEvents.JOIN_ROOM, {
      code,
      name: "Alice",
      token: aliceJoin.player.token,
    });

    await emitAck(fresh, clientEvents.SUBMIT_VOTE, {
      battleId,
      choice: "a",
    });

    const updated = getRoom(code);
    expect(updated?.battles[0].votesA).toContain(aliceJoin.player.id);

    host.disconnect();
    bob.disconnect();
    carol.disconnect();
    fresh.disconnect();
  }, 15000);

  it("mid-game, rejoining with the same name and no token reclaims the player, and the old socket dropping later doesn't mark them gone", async () => {
    const connected = (socket: Socket) =>
      new Promise<void>((r, j) => {
        socket.on("connect", () => r());
        socket.on("connect_error", j);
      });
    const host = client();
    await connected(host);
    const created = await emitAck<{ state: PublicRoomState }>(host, clientEvents.CREATE_ROOM, {});
    const code = created.state.code;

    const alice = client();
    const bob = client();
    const carol = client();
    await Promise.all([alice, bob, carol].map(connected));
    const aliceJoin = await emitAck<{ player: { id: string; token: string } }>(
      alice,
      clientEvents.JOIN_ROOM,
      { code, name: "Alice" }
    );
    await emitAck(bob, clientEvents.JOIN_ROOM, { code, name: "Bob" });
    await emitAck(carol, clientEvents.JOIN_ROOM, { code, name: "Carol" });

    const room = getRoom(code)!;
    room.phase = "round1_answer";
    room.round = 1;
    room.players.find((p) => p.id === aliceJoin.player.id)!.score = 777;
    setRoom(room);

    // New tab / cleared phone: no token, same name, while the old socket is still open.
    const fresh = client();
    await connected(fresh);
    const again = await emitAck<{ player: { id: string; token: string; isAudience: boolean; score: number } }>(
      fresh,
      clientEvents.JOIN_ROOM,
      { code, name: "alice" }
    );
    expect(again.player.id).toBe(aliceJoin.player.id);
    expect(again.player.token).toBe(aliceJoin.player.token);
    expect(again.player.isAudience).toBe(false);
    expect(again.player.score).toBe(777);

    alice.disconnect();
    await new Promise((r) => setTimeout(r, 200));
    const after = getRoom(code)!;
    expect(after.players.find((p) => p.id === aliceJoin.player.id)?.connected).toBe(true);
    expect(after.players.filter((p) => p.name.toLowerCase() === "alice")).toHaveLength(1);

    for (const s of [host, bob, carol, fresh]) s.disconnect();
  }, 15000);
});
