import type { CSSProperties } from "react";
import type { PublicRoomState } from "../../../shared/types";
import { TimerRing, timerRingProps } from "../TimerRing";

interface Props {
  state: PublicRoomState;
}

/** Columns for the answer grid: 20 answers land as 5 x 4, small games stay roomy. */
function gridColumns(count: number): number {
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  if (count <= 16) return 4;
  return 5;
}

export function HostLastLashVote({ state }: Props) {
  const entries = state.lastLashEntries.filter((e) => e.answer?.text);
  const columns = gridColumns(entries.length);

  return (
    <div
      className="host-lastlash-vote"
      data-testid="host-lastlash-vote"
      style={
        {
          "--lastlash-cols": columns,
          "--lastlash-rows": Math.max(1, Math.ceil(entries.length / columns)),
        } as CSSProperties
      }
    >
      <header className="host-lastlash-header">
        <p className="host-battle-vote-battle-index">Last Lash</p>
        <h1 className="host-lastlash-prompt">{state.lastLashPrompt}</h1>
        <div className="host-lastlash-status">
          <TimerRing {...timerRingProps(state)} />
          <p className="host-battle-vote-hint">Pick your 3 favorites on your phone!</p>
        </div>
      </header>
      <ul className="host-lastlash-grid">
        {entries.map((e, i) => {
          const player = state.players.find((p) => p.id === e.playerId);
          return (
            <li
              key={e.playerId}
              className="host-lastlash-card"
              style={{ animationDelay: `${i * 0.05}s` }}
              data-testid="host-lastlash-card"
            >
              <p className="host-lastlash-answer">{e.answer?.text}</p>
              <span className="host-lastlash-author">{player?.name}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
