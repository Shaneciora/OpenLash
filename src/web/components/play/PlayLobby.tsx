import { useState, type CSSProperties } from "react";
import type { PublicRoomState, Player } from "../../../shared/types";

interface Props {
  state: PublicRoomState;
  player: Player;
  onStart: () => Promise<{ ok: boolean; error?: string }>;
  onLeave: () => void;
}

function canStartLobby(state: PublicRoomState, playerCount: number): boolean {
  if (playerCount >= state.settings.minPlayers) return true;
  return state.settings.botTestLobbyMode !== "off" && playerCount >= 1;
}

function playerInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function PlayLobby({ state, player, onStart, onLeave }: Props) {
  const [startError, setStartError] = useState<string | null>(null);
  const players = state.players.filter((p) => !p.isAudience && !p.kicked);
  const maxSlots = state.settings.maxPlayers;
  const slots = Array.from({ length: maxSlots }, (_, i) => players[i] ?? null);
  const canStart = canStartLobby(state, players.length);
  const isVip = state.vipId === player.id;

  const handleStart = async () => {
    setStartError(null);
    const result = await onStart();
    if (!result.ok) {
      setStartError(result.error ?? "Could not start game");
    }
  };

  return (
    <div className="play-screen play-screen--lobby">
      <button
        type="button"
        className="secondary play-lobby-leave"
        data-testid="leave-btn"
        onClick={onLeave}
      >
        Leave
      </button>
      <h1 className="play-title">Lobby</h1>
      <p className="play-lobby-meta">Room {state.code}</p>
      <div className="play-lobby-players-section">
        <h2 className="play-lobby-players-heading">
          Players ({players.length}/{maxSlots})
        </h2>
        <ul
          className="play-lobby-player-list"
          data-testid="lobby-player-list"
          style={
            {
              "--lobby-slot-count": maxSlots,
              gridTemplateRows: `repeat(${Math.ceil(maxSlots / 2)}, minmax(0, 1fr))`,
            } as CSSProperties
          }
        >
          {slots.map((p, index) =>
            p ? (
              <li key={p.id} className="play-lobby-player-slot" data-testid="lobby-player">
                {p.avatar ? (
                  <img src={p.avatar} alt="" className="play-lobby-player-avatar" />
                ) : (
                  <div className="play-lobby-player-avatar play-lobby-player-avatar--placeholder">
                    {playerInitial(p.name)}
                  </div>
                )}
                <span className="play-lobby-player-name">{p.name}</span>
                {p.isVip && <span className="play-lobby-player-vip">VIP</span>}
              </li>
            ) : (
              <li
                key={`empty-${index}`}
                className="play-lobby-player-slot play-lobby-player-slot--empty"
                data-testid="lobby-player-slot-empty"
                aria-hidden
              >
                <span className="play-lobby-player-empty-icon" aria-hidden>
                  +
                </span>
              </li>
            )
          )}
        </ul>
      </div>
      {isVip && (
        <>
          <button
            className="primary"
            data-testid="everybodys-in-btn"
            onClick={() => void handleStart()}
            disabled={!canStart}
          >
            Everybody&apos;s In!
          </button>
          {!canStart && (
            <p className="play-hint" data-testid="lobby-start-hint">
              Need at least {state.settings.minPlayers} players, or enable a debug bot mode on
              the host screen.
            </p>
          )}
          {state.settings.botTestLobbyMode !== "off" &&
            canStart &&
            players.length < state.settings.maxPlayers && (
            <p className="play-hint" data-testid="lobby-bot-fill-hint">
              Bots will fill empty seats when you start.
            </p>
          )}
          {startError && (
            <p className="play-error" data-testid="start-error">
              {startError}
            </p>
          )}
        </>
      )}
      {!isVip && <p className="play-hint">Waiting for VIP to start...</p>}
    </div>
  );
}
