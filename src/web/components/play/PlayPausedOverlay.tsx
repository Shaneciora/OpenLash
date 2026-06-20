export function PlayPausedOverlay() {
  return (
    <div className="play-paused-overlay" data-testid="play-paused-overlay">
      <div className="play-status-card">
        <h2>Game Paused</h2>
        <p>Waiting for the host to resume...</p>
      </div>
    </div>
  );
}
