import { useEffect, useState, type CSSProperties } from "react";
import type { PublicRoomState } from "../../../shared/types";

const VISIBLE_HIGHLIGHTS = 3;
const SCROLL_INTERVAL_MS = 3200;
const SCROLL_TRANSITION_MS = 700;

function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefers(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return prefers;
}

function playerInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

interface Highlight {
  text: string;
  playerName: string;
}

function HighlightCard({ highlight }: { highlight: Highlight }) {
  return (
    <li className="host-podium-highlight" data-testid="podium-highlight">
      <p className="host-podium-highlight-quote">&ldquo;{highlight.text}&rdquo;</p>
      <span className="host-podium-highlight-author">{highlight.playerName}</span>
    </li>
  );
}

function HostPodiumHighlights({
  highlights,
  reducedMotion,
}: {
  highlights: Highlight[];
  reducedMotion: boolean;
}) {
  const shouldScroll = highlights.length > VISIBLE_HIGHLIGHTS && !reducedMotion;
  const trackItems = shouldScroll
    ? [...highlights, ...highlights.slice(0, VISIBLE_HIGHLIGHTS)]
    : highlights;
  const [index, setIndex] = useState(0);
  const [instant, setInstant] = useState(false);

  useEffect(() => {
    if (!shouldScroll) return;
    const timer = window.setInterval(() => {
      setIndex((current) => current + 1);
    }, SCROLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [shouldScroll, highlights.length]);

  useEffect(() => {
    if (!shouldScroll || index < highlights.length) return;
    const timer = window.setTimeout(() => {
      setInstant(true);
      setIndex(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setInstant(false));
      });
    }, SCROLL_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [index, shouldScroll, highlights.length]);

  const staticList = reducedMotion ? highlights.slice(0, VISIBLE_HIGHLIGHTS) : highlights;

  return (
    <section
      className={`host-podium-highlights${reducedMotion ? " host-podium-highlights--static" : ""}`}
      aria-label="Highlights"
    >
      <h2 className="host-podium-highlights-heading">Highlights</h2>
      <div
        className={`host-podium-highlight-viewport${shouldScroll ? " host-podium-highlight-viewport--scroll" : ""}`}
        style={{ "--visible-slots": VISIBLE_HIGHLIGHTS } as CSSProperties}
      >
        <ul
          className={`host-podium-highlight-track${instant ? " host-podium-highlight-track--instant" : ""}`}
          style={
            shouldScroll
              ? ({ "--scroll-index": index } as CSSProperties)
              : undefined
          }
        >
          {(shouldScroll ? trackItems : staticList).map((highlight, i) => (
            <HighlightCard key={`${i}-${highlight.text}`} highlight={highlight} />
          ))}
        </ul>
      </div>
    </section>
  );
}

interface Props {
  state: PublicRoomState;
  onPlayAgain: () => void;
  reducedMotion?: boolean;
}

export function HostPodium({ state, onPlayAgain, reducedMotion = false }: Props) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const staticHighlights = reducedMotion || prefersReducedMotion;
  const sorted = [...state.players]
    .filter((p) => !p.isAudience)
    .sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const highlights = state.highlights.slice(-5);

  return (
    <div
      className={`host-podium${staticHighlights ? " host-podium--reduced-motion" : ""}`}
      data-testid="podium"
    >
      <div
        className={`host-podium-layout${highlights.length === 0 ? " host-podium-layout--solo" : ""}`}
      >
        <div className="host-podium-celebration">
          <h1 className="host-podium-title">Winner!</h1>

          {winner && (
            <div className="host-podium-winner">
              {winner.avatar ? (
                <img
                  src={winner.avatar}
                  alt=""
                  className="host-podium-avatar"
                />
              ) : (
                <div className="host-podium-avatar host-podium-avatar--placeholder">
                  {playerInitial(winner.name)}
                </div>
              )}
              <span className="host-podium-name" data-testid="winner-name">
                {winner.name}
              </span>
              <span className="host-podium-score">{winner.score} pts</span>
            </div>
          )}

          <button
            type="button"
            className="host-podium-play-again primary"
            onClick={onPlayAgain}
            data-testid="play-again-btn"
          >
            Play Again
          </button>
        </div>

        {highlights.length > 0 && (
          <HostPodiumHighlights highlights={highlights} reducedMotion={staticHighlights} />
        )}
      </div>
    </div>
  );
}
