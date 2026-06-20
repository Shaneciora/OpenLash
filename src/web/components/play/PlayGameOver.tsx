import { useState } from "react";
import type { PublicRoomState, Player } from "../../../shared/types";

interface Props {
  state: PublicRoomState;
  player: Player;
  onPlayAgain: () => Promise<{ ok: boolean; error?: string }>;
  onLeave: () => void;
}

function playerInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function PlayGameOver({ state, player, onPlayAgain, onLeave }: Props) {
  const [playAgainError, setPlayAgainError] = useState<string | null>(null);

  const sorted = [...state.players]
    .filter((p) => !p.isAudience && !p.kicked)
    .sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const isVip = state.vipId === player.id;

  const handlePlayAgain = async () => {
    setPlayAgainError(null);
    const result = await onPlayAgain();
    if (!result.ok) {
      setPlayAgainError(result.error ?? "Could not start a new game");
    }
  };

  return (
    <div className="play-screen" data-testid="play-game-over">
      <h1 className="play-title">Game Over</h1>

      {winner && (
        <div className="play-game-over-winner" data-testid="play-winner">
          {winner.avatar ? (
            <img src={winner.avatar} alt="" className="play-game-over-avatar" />
          ) : (
            <div className="play-game-over-avatar play-game-over-avatar--placeholder">
              {playerInitial(winner.name)}
            </div>
          )}
          <p className="play-game-over-winner-label">Winner</p>
          <p className="play-game-over-winner-name" data-testid="play-winner-name">
            {winner.name}
          </p>
          <p className="play-game-over-winner-score">{winner.score} pts</p>
        </div>
      )}

      <div className="play-game-over-actions">
        {isVip && (
          <>
            <button
              type="button"
              className="primary play-game-over-play-again"
              data-testid="play-again-btn"
              onClick={() => void handlePlayAgain()}
            >
              Play Again
            </button>
            {playAgainError && (
              <p className="play-error" data-testid="play-again-error">
                {playAgainError}
              </p>
            )}
          </>
        )}

        {!isVip && (
          <p className="play-hint" data-testid="play-again-waiting">
            Waiting for VIP to play again...
          </p>
        )}

        <button
          type="button"
          className="secondary play-game-over-leave"
          data-testid="leave-btn"
          onClick={onLeave}
        >
          Leave
        </button>
      </div>
    </div>
  );
}
