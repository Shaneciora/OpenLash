export function HostScreenSample() {
  return (
    <div className="host-ui" data-testid="screen-sample">
      <div className="host-reveal" data-testid="host-battle-reveal">
        <p className="host-reveal-progress">Battle 2 of 3</p>

        <h1 className="host-reveal-prompt">
          The worst thing to say at a wedding: _____
        </h1>

        <div className="host-reveal-matchup">
          <div className="host-reveal-quip host-reveal-quip--winner" data-testid="quip-a">
            <div className="host-reveal-player">
              <div className="host-reveal-avatar host-reveal-avatar--placeholder">A</div>
              <span className="host-reveal-name">Alice</span>
            </div>
            <div className="host-reveal-answer">
              <p>I object, emotionally</p>
            </div>
            <div className="host-reveal-voters">
              <span className="host-reveal-voters-label">Voted for this</span>
              <ul className="host-reveal-voter-list">
                <li className="host-reveal-voter-chip">Bot 2</li>
                <li className="host-reveal-voter-chip">Bot 3</li>
                <li className="host-reveal-voter-chip">Bot 6</li>
              </ul>
            </div>
            <div className="host-reveal-points">+767</div>
          </div>

          <span className="host-reveal-vs">VS</span>

          <div className="host-reveal-quip" data-testid="quip-b">
            <div className="host-reveal-player">
              <div className="host-reveal-avatar host-reveal-avatar--placeholder">B</div>
              <span className="host-reveal-name">Bob</span>
            </div>
            <div className="host-reveal-answer">
              <p>Anyone here single?</p>
            </div>
            <div className="host-reveal-voters">
              <span className="host-reveal-voters-label">Voted for this</span>
              <ul className="host-reveal-voter-list">
                <li className="host-reveal-voter-chip">Bot 1</li>
                <li className="host-reveal-voter-chip">Bot 5</li>
              </ul>
            </div>
            <div className="host-reveal-points">+333</div>
          </div>
        </div>
      </div>
    </div>
  );
}
