type Props = {
  onResume: () => void;
  onEndGame: () => void;
};

export function HostPauseMenu({ onResume, onEndGame }: Props) {
  return (
    <div className="host-pause-overlay" data-testid="host-pause-menu">
      <div className="host-pause-card card">
        <h2 className="host-pause-title">Game Paused</h2>
        <div className="host-pause-actions">
          <button
            type="button"
            className="primary"
            data-testid="pause-resume-btn"
            onClick={onResume}
          >
            Resume
          </button>
          <button
            type="button"
            className="secondary"
            data-testid="pause-end-game-btn"
            onClick={onEndGame}
          >
            End Game
          </button>
        </div>
      </div>
    </div>
  );
}
