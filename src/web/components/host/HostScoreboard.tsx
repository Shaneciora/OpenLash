import type { CSSProperties } from "react";
import type { PublicRoomState } from "../../../shared/types";

interface Props {
  state: PublicRoomState;
  lastLash?: boolean;
  reducedMotion?: boolean;
}

const BAR_COLORS = ["coral", "sunshine", "teal", "purple"] as const;

function playerInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function HostScoreboard({ state, lastLash, reducedMotion }: Props) {
  const sorted = [...state.players]
    .filter((p) => !p.isAudience)
    .sort((a, b) => b.score - a.score);

  const maxScore = Math.max(...sorted.map((p) => p.score), 1);

  return (
    <div
      data-testid="scoreboard"
      className={`host-scoreboard${reducedMotion ? " host-scoreboard--instant" : ""}`}
      style={{ "--player-count": sorted.length } as CSSProperties}
    >
      <h1 className="host-scoreboard-title">
        {lastLash ? "Final Results" : `Round ${state.round} Scores`}
      </h1>
      <ol className="host-scoreboard-chart">
        {sorted.map((p, i) => {
          const pct = (p.score / maxScore) * 100;
          return (
            <li
              key={p.id}
              data-testid="score-row"
              className="host-scoreboard-column"
              style={
                {
                  "--row-delay": `${i * 0.12}s`,
                  "--bar-target": `${pct}%`,
                } as CSSProperties
              }
            >
              <span className="host-scoreboard-score">{p.score.toLocaleString()}</span>
              <div className="host-scoreboard-bar-track">
                <div
                  className={`host-scoreboard-bar host-scoreboard-bar--${BAR_COLORS[i % BAR_COLORS.length]}`}
                />
              </div>
              <div className="host-scoreboard-player-card">
                {p.avatar ? (
                  <img src={p.avatar} alt="" className="host-scoreboard-avatar" />
                ) : (
                  <div className="host-scoreboard-avatar host-scoreboard-avatar--placeholder">
                    {playerInitial(p.name)}
                  </div>
                )}
                <span className="host-scoreboard-player-name">{p.name}</span>
              </div>
            </li>
          );
        })}
      </ol>
      {lastLash && state.lastLashEntries.length > 0 && (
        <div className="host-scoreboard-lash">
          {state.lastLashEntries.map((e) => {
            const player = state.players.find((pl) => pl.id === e.playerId);
            return (
              <div key={e.playerId}>
                <strong>{player?.name}</strong>: {e.answer?.text} ({e.votes} votes, +{e.points})
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
