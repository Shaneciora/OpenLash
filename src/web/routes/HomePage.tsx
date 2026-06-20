import { Link } from "react-router-dom";
import { FullscreenButton } from "../components/FullscreenButton";

export function HomePage() {
  return (
    <>
      <FullscreenButton />
      <div className="play-screen home-page" style={{ maxWidth: 600, paddingTop: 48 }}>
      <h1 style={{ fontSize: "3rem", margin: "0 0 8px" }}>OpenLash</h1>
      <p style={{ fontSize: "1.2rem", marginBottom: 32 }}>
        The open-source party game. Host on your TV, play on your phones.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Link to="/host">
          <button className="primary" style={{ width: "100%" }} data-testid="play-game-btn">
            Play Game
          </button>
        </Link>
        <Link to="/collections">
          <button className="secondary" style={{ width: "100%" }} data-testid="collections-btn">
            Collections
          </button>
        </Link>
        <Link to="/screen-checker">
          <button style={{ width: "100%" }} data-testid="screen-checker-btn">
            Screen Checker
          </button>
        </Link>
        <Link to="/play">
          <button style={{ width: "100%" }} data-testid="join-game-btn">
            Join Game
          </button>
        </Link>
      </div>
      <div className="card" style={{ marginTop: 32 }}>
        <h2>How to Play</h2>
        <ol>
          <li>Open <strong>Play Game</strong> on your TV or laptop</li>
          <li>Everyone goes to the join URL on their phone</li>
          <li>Enter the room code and your name</li>
          <li>VIP hits &quot;Everybody&apos;s In&quot; when ready</li>
          <li>Write funny answers, vote for favorites, win!</li>
        </ol>
      </div>
    </div>
    </>
  );
}
