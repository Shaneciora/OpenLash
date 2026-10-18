import type { CSSProperties } from "react";
import type { PublicRoomState } from "../../../shared/types";
import { playerHasSubmittedAnswers } from "../../../shared/playerStatus";
import { TimerRing, timerRingProps } from "../TimerRing";

const THINKING_PHRASES = [
  "Pondering",
  "Noodling",
  "Marinating",
  "Percolating",
  "Hatching",
  "Stalling",
  "Scheming",
  "Cogitating",
  "Overthinking",
  "Panicking",
  "Squinting",
  "Grunting",
  "Brooding",
  "Mulling",
  "Stumped",
  "Vibing",
  "Stewing",
  "Incubating",
  "Buffering",
  "Compiling",
  "Plotting",
  "Dithering",
  "Hesitating",
  "Ruminating",
  "Processing",
];

function thinkingPhrase(playerId: string): string {
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) {
    hash = (hash + playerId.charCodeAt(i)) % THINKING_PHRASES.length;
  }
  const index = ((hash % THINKING_PHRASES.length) + THINKING_PHRASES.length) % THINKING_PHRASES.length;
  return THINKING_PHRASES[index] ?? THINKING_PHRASES[0];
}

function playerInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

interface Props {
  state: PublicRoomState;
  reducedMotion?: boolean;
}

export function HostAnswerPhase({ state, reducedMotion = false }: Props) {
  const writers = state.players.filter(
    (p) => !p.isAudience && !p.kicked && p.connected
  );
  const doneCount = writers.filter((p) => playerHasSubmittedAnswers(state, p.id)).length;
  // Big lobbies wrap onto two rows; every size in the strip is computed per column.
  const columns = writers.length > 10 ? Math.ceil(writers.length / 2) : writers.length;

  const title =
    state.phase === "final_answer"
      ? "Final round — Write your answers!"
      : `Round ${state.round} — Write your answers!`;

  return (
    <div
      className="host-answer-phase"
      data-testid="host-answer-phase"
      style={{ "--answer-player-count": columns } as CSSProperties}
    >
      <header className="host-answer-header">
        <h1 className="host-answer-title" data-testid="phase-indicator">
          {title}
        </h1>
        <TimerRing {...timerRingProps(state)} />
        <p className="host-answer-subtitle">Check your phone!</p>
        <p className="host-answer-progress" data-testid="answer-progress">
          {doneCount} of {writers.length} done
        </p>
      </header>

      <ul className="host-answer-players">
        {writers.map((player, index) => {
          const done = playerHasSubmittedAnswers(state, player.id);
          return (
            <li
              key={player.id}
              className={`host-answer-player host-answer-player--${done ? "done" : "thinking"}`}
              style={{ animationDelay: `${index * 0.08}s` }}
              data-testid="host-answer-player"
              data-status={done ? "done" : "thinking"}
            >
              <div className="host-answer-player-card">
                {player.avatar ? (
                  <img
                    src={player.avatar}
                    alt=""
                    className="host-answer-avatar"
                  />
                ) : (
                  <div className="host-answer-avatar host-answer-avatar--placeholder">
                    {playerInitial(player.name)}
                  </div>
                )}
                <span className="host-answer-name">{player.name}</span>
              </div>

              <div
                className={`host-answer-bubble host-answer-bubble--${done ? "done" : "thinking"}${
                  !done && !reducedMotion ? " host-answer-bubble--wiggle" : ""
                }`}
                style={
                  !done && !reducedMotion ? { animationDelay: `${index * 0.18}s` } : undefined
                }
                data-testid={done ? "host-answer-done" : "host-answer-thinking"}
              >
                {done ? (
                  <>
                    <span className="host-answer-check" aria-hidden>
                      ✓
                    </span>
                    <span className="host-answer-status-label">Done!</span>
                  </>
                ) : (
                  <span className="host-answer-status-label host-answer-status-label--thinking">
                    {thinkingPhrase(player.id)}…
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
