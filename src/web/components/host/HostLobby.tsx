import { useEffect, useState, type CSSProperties } from "react";
import type { PublicRoomState } from "../../../shared/types";

interface CollectionRow {
  id: number;
  name: string;
  prompt_count: number;
}

interface Props {
  state: PublicRoomState;
  qrUrl: string;
  codeRevealed: boolean;
  onRevealCode: () => void;
  onCollectionChange: (collectionId: number) => void;
  onKickPlayer: (playerId: string) => void;
  reducedMotion?: boolean;
}

export function HostLobby({
  state,
  qrUrl,
  codeRevealed,
  onRevealCode,
  onCollectionChange,
  onKickPlayer,
  reducedMotion = false,
}: Props) {
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const players = state.players.filter((p) => !p.isAudience && !p.kicked);
  const audienceCount = state.players.filter((p) => p.isAudience).length;
  const selectedId = state.settings.collectionId;

  useEffect(() => {
    fetch("/api/collections")
      .then((r) => r.json())
      .then(setCollections)
      .catch(() => setCollections([]));
  }, []);

  const maxSlots = state.settings.maxPlayers;
  const slots = Array.from({ length: maxSlots }, (_, i) => players[i] ?? null);

  function playerInitial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || "?";
  }

  return (
    <div className="host-lobby-main">
      <aside className="host-lobby-players-column">
        <h2 className="host-lobby-players-heading">
          Players ({players.length}/{maxSlots})
        </h2>
        <ul
          className="host-lobby-player-list"
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
              <li
                key={p.id}
                className="host-player-slot"
                data-testid="lobby-player"
              >
                <button
                  type="button"
                  className="host-player-kick"
                  data-testid="kick-player-btn"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => onKickPlayer(p.id)}
                >
                  ×
                </button>
                {p.avatar ? (
                  <img src={p.avatar} alt="" className="host-player-avatar" />
                ) : (
                  <div className="host-player-avatar host-player-avatar--placeholder">
                    {playerInitial(p.name)}
                  </div>
                )}
                <span className="host-player-name">{p.name}</span>
                {p.isVip && <span className="host-player-vip">VIP</span>}
              </li>
            ) : (
              <li
                key={`empty-${index}`}
                className="host-player-slot host-player-slot--empty"
                data-testid="lobby-player-slot-empty"
                aria-hidden
              >
                <div className="host-player-avatar host-player-avatar--empty" />
                <span className="host-player-empty-label">Empty</span>
              </li>
            )
          )}
        </ul>
        {audienceCount > 0 && (
          <p className="host-lobby-audience">Audience: {audienceCount}</p>
        )}
      </aside>

      <div className="host-lobby-center">
        <header className="host-lobby-header">
          <h1
            className={`host-lobby-title${reducedMotion ? " host-lobby-title--static" : ""}`}
          >
            OpenLash
          </h1>
        </header>

        <p className="host-lobby-tagline">Get out your phones!</p>

        <div className="host-lobby-center-main">
          <div className="host-lobby-join-row">
          {codeRevealed ? (
            <div className="room-code host-room-code" data-testid="room-code">
              {state.code}
            </div>
          ) : (
            <button
              className="host-reveal-btn host-reveal-btn--large"
              onClick={onRevealCode}
              data-testid="reveal-code-btn"
            >
              Reveal Room Code
            </button>
          )}

          {qrUrl ? (
            <img src={qrUrl} alt="QR code" data-testid="join-qr" className="host-lobby-qr" />
          ) : (
            <div className="host-lobby-qr host-lobby-qr--pending" data-testid="join-qr-resolving" />
          )}
          </div>

          <div className="host-lobby-collection-row" data-testid="collection-picker">
          <label className="host-field-label host-field-label--on-gradient" htmlFor="collection-select">
            Prompt collection
          </label>
          <select
            id="collection-select"
            className="ui-select ui-select--lg"
            data-testid="collection-select"
            value={selectedId ?? ""}
            disabled={collections.length === 0}
            onChange={(e) => onCollectionChange(Number(e.target.value))}
          >
            {collections.length === 0 ? (
              <option value="">Loading...</option>
            ) : (
              collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.prompt_count} prompts)
                </option>
              ))
            )}
          </select>
        </div>
        </div>
      </div>
    </div>
  );
}
