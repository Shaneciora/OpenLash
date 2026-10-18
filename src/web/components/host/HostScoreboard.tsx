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
  // Past 10 players a column per player no longer fits, so it becomes a two-column leaderboard.
  const listLayout = sorted.length > 10;
  const rowStagger = listLayout ? 0.06 : 0.12;
  // A big game shows only its best Last Lash answers, so all ranked rows keep their height.
  const lashEntries = listLayout
    ? state.lastLashEntries
        .filter((e) => e.answer?.text)
        .sort((a, b) => b.votes - a.votes || b.points - a.points)
        .slice(0, 5)
    : state.lastLashEntries;

  return (
    <div
      data-testid="scoreboard"
      className={`host-scoreboard${listLayout ? " host-scoreboard--list" : ""}${
        reducedMotion ? " host-scoreboard--instant" : ""
      }`}
      style={
        {
          "--player-count": sorted.length,
          "--list-rows": Math.ceil(sorted.length / 2),
        } as CSSProperties
      }
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
                  "--row-delay": `${i * rowStagger}s`,
                  "--bar-target": `${pct}%`,
                } as CSSProperties
              }
            >
              {listLayout && <span className="host-scoreboard-rank">{i + 1}</span>}
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
      {lastLash && lashEntries.length > 0 && (
        <div className="host-scoreboard-lash">
          {listLayout && <h2 className="host-scoreboard-lash-heading">Top Last Lash answers</h2>}
          {lashEntries.map((e) => {
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
