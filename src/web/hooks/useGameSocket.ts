import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type { PublicRoomState, Player } from "../../shared/types";
import { clientEvents, serverEvents } from "../../shared/protocol";

type PlayerSession = {
  code: string;
  name: string;
  token: string;
  password?: string;
};

export function useGameSocket() {
  const sessionRef = useRef<PlayerSession | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [state, setState] = useState<PublicRoomState | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [rejoining, setRejoining] = useState(false);
  const [roomClosed, setRoomClosed] = useState(false);

  useEffect(() => {
    const s = io({ path: "/socket.io" });
    setSocket(s);

    const rejoinSession = () => {
      const session = sessionRef.current;
      if (!session) return;

      setRejoining(true);
      s.emit(
        clientEvents.JOIN_ROOM,
        {
          code: session.code,
          name: session.name,
          token: session.token,
          password: session.password,
        },
        (res: { ok: boolean; player?: Player; state?: PublicRoomState; error?: string }) => {
          setRejoining(false);
          if (res.ok && res.player && res.state) {
            setPlayer(res.player);
            setState(res.state);
            return;
          }

          sessionRef.current = null;
          setPlayer(null);
          setState(null);
          setError(res.error ?? "Failed to rejoin room");
        }
      );
    };

    s.on("connect", () => {
      setConnected(true);
      rejoinSession();
    });
    s.on("disconnect", () => setConnected(false));
    s.on(serverEvents.STATE_SNAPSHOT, (snap: PublicRoomState) => {
      setState(snap);
      setPlayer((current) => {
        const token = localStorage.getItem("openlash_token");
        if (token) {
          const byToken = snap.players.find((p) => p.token === token);
          if (byToken) return byToken;
        }
        if (current) {
          const byId = snap.players.find((p) => p.id === current.id);
          if (byId) return byId;
        }
        return current;
      });
    });
    s.on(serverEvents.ROOM_CLOSED, () => {
      sessionRef.current = null;
      setPlayer(null);
      setState(null);
      setRoomClosed(true);
    });
    s.on(serverEvents.ERROR, (err: { message: string }) => {
      setError(err.message);
    });

    return () => {
      s.disconnect();
    };
  }, []);

  const createRoom = useCallback(
    (settings?: Record<string, unknown>) =>
      new Promise<PublicRoomState>((resolve, reject) => {
        socket?.emit(clientEvents.CREATE_ROOM, { settings }, (res: { ok: boolean; state?: PublicRoomState; error?: string }) => {
          if (res.ok && res.state) {
            setState(res.state);
            resolve(res.state);
          } else reject(new Error(res.error ?? "Failed"));
        });
      }),
    [socket]
  );

  const checkRoom = useCallback(
    (code: string, password?: string) =>
      new Promise<{ passwordRequired: boolean }>((resolve, reject) => {
        socket?.emit(
          clientEvents.CHECK_ROOM,
          { code, password },
          (res: { ok: boolean; passwordRequired?: boolean; error?: string }) => {
            if (res.ok && res.passwordRequired !== undefined) {
              resolve({ passwordRequired: res.passwordRequired });
            } else {
              reject(new Error(res.error ?? "Failed"));
            }
          }
        );
      }),
    [socket]
  );

  const leaveRoom = useCallback(
    () =>
      new Promise<void>((resolve) => {
        socket?.emit(clientEvents.LEAVE_ROOM, {}, () => {
          sessionRef.current = null;
          setPlayer(null);
          setState(null);
          resolve();
        });
      }),
    [socket]
  );

  const joinRoom = useCallback(
    (payload: {
      code: string;
      name: string;
      token?: string;
      password?: string;
      avatar?: string | null;
      role?: string;
      modPassword?: string;
    }) =>
      new Promise<{ player: Player; state: PublicRoomState }>((resolve, reject) => {
        socket?.emit(clientEvents.JOIN_ROOM, payload, (res: {
          ok: boolean;
          player?: Player;
          state?: PublicRoomState;
          error?: string;
        }) => {
          if (res.ok && res.player && res.state) {
            sessionRef.current = {
              code: payload.code,
              name: payload.name,
              token: res.player.token,
              password: payload.password,
            };
            setPlayer(res.player);
            setState(res.state);
            localStorage.setItem("openlash_token", res.player.token);
            resolve({ player: res.player, state: res.state });
          } else reject(new Error(res.error ?? "Failed"));
        });
      }),
    [socket]
  );

  const emit = useCallback(
    (event: string, payload?: unknown) =>
      new Promise<{ ok: boolean; error?: string }>((resolve) => {
        socket?.emit(event, payload, (res: { ok: boolean; error?: string }) => {
          resolve(res ?? { ok: true });
        });
      }),
    [socket]
  );

  const hostJoin = useCallback(
    (code: string) =>
      new Promise<PublicRoomState>((resolve, reject) => {
        socket?.emit(clientEvents.HOST_JOIN, { code }, (res: { ok: boolean; state?: PublicRoomState; error?: string }) => {
          if (res.ok && res.state) {
            setState(res.state);
            resolve(res.state);
          } else reject(new Error(res.error ?? "Failed"));
        });
      }),
    [socket]
  );

  return {
    socket,
    state,
    player,
    error,
    connected,
    rejoining,
    roomClosed,
    acknowledgeRoomClosed: () => setRoomClosed(false),
    createRoom,
    checkRoom,
    joinRoom,
    leaveRoom,
    emit,
    hostJoin,
    setState,
  };
}
