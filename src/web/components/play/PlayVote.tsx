import { useState, useEffect, useMemo } from "react";
import type { PublicRoomState, Player, Battle, ThriplashBattle } from "../../../shared/types";
import { formatThriplashAnswers } from "../../../shared/thriplashAnswers";
import { isBattler, isTripleBattle } from "../../../shared/battleLayout";
import { resolveRoomPlayer } from "../../lib/roomPlayer";
import { TimerRing, timerRingProps } from "../TimerRing";

interface Props {
  state: PublicRoomState;
  player: Player;
  thriplash?: boolean;
  lastLash?: boolean;
  onVote: (battleId: string, choice: "a" | "b" | "c" | "abstain") => Promise<{ ok: boolean }>;
  onLastLashVote?: (ids: string[]) => Promise<{ ok: boolean }>;
}

function VoteSubmitted() {
  return (
    <div className="play-screen" data-testid="vote-submitted">
      <div className="play-status-card">
        <h2>Vote submitted!</h2>
        <p>Watch the TV...</p>
      </div>
    </div>
  );
}

export function PlayVote({ state, player, thriplash, lastLash, onVote, onLastLashVote }: Props) {
  const self = useMemo(() => resolveRoomPlayer(state, player), [state, player]);
  const [voted, setVoted] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const battles = thriplash ? state.thriplashBattles : state.battles;
  const battle = battles[state.currentBattleIndex];

  useEffect(() => {
    setVoted(false);
    setSelected([]);
  }, [battle?.id, lastLash]);

  if (lastLash) {
    const toggle = (id: string) => {
      setSelected((s) => {
        if (s.includes(id)) return s.filter((x) => x !== id);
        if (s.length >= 3) return s;
        return [...s, id];
      });
    };

    const submit = async () => {
      await onLastLashVote?.(selected);
      setVoted(true);
    };

    if (voted) return <VoteSubmitted />;

    return (
      <div className="play-screen play-screen--stacked">
        <h1 className="play-title">Pick your 3 favorites</h1>
        <p className="play-subtitle">{state.lastLashPrompt}</p>
        <div className="play-lastlash-list">
          {state.lastLashEntries.map((e) => {
            const p = state.players.find((pl) => pl.id === e.playerId);
            if (e.playerId === self.id) return null;
            return (
              <button
                key={e.playerId}
                data-testid={`lastlash-vote-${e.playerId}`}
                onClick={() => toggle(e.playerId)}
                style={{
                  background: selected.includes(e.playerId) ? "var(--color-teal)" : undefined,
                }}
              >
                {p?.name}: {e.answer?.text}
              </button>
            );
          })}
        </div>
        <button className="primary" data-testid="submit-vote-btn" onClick={submit}>
          Submit Votes
        </button>
      </div>
    );
  }

  if (!battle) {
    return (
      <div className="play-screen">
        <div className="play-status-card">
          <h2>Waiting...</h2>
        </div>
      </div>
    );
  }

  const isBattlerPlayer = isBattler(battle, self.id);
  if (isBattlerPlayer) {
    return (
      <div className="play-screen" data-testid="cannot-vote-own">
        <div className="play-status-card">
          <h2>Your quip is on the TV!</h2>
          <p>{battle.promptText}</p>
          <p className="play-status-card__hint">You&apos;ll vote on the other battles.</p>
        </div>
      </div>
    );
  }

  const isTriple = isTripleBattle(battle);

  const answerA = thriplash
    ? formatThriplashAnswers((battle as ThriplashBattle).answersA ?? [])
    : (battle as Battle).answerA?.text;
  const answerB = thriplash
    ? formatThriplashAnswers((battle as ThriplashBattle).answersB ?? [])
    : (battle as Battle).answerB?.text;
  const answerC = isTriple
    ? thriplash
      ? formatThriplashAnswers((battle as ThriplashBattle).answersC ?? [])
      : (battle as Battle).answerC?.text
    : null;

  const vote = async (choice: "a" | "b" | "c" | "abstain") => {
    await onVote(battle.id, choice);
    setVoted(true);
  };

  if (voted) return <VoteSubmitted />;

  return (
    <div className="play-screen play-screen--stacked">
      <TimerRing {...timerRingProps(state)} />
      <div className={`play-vote-stack${isTriple ? " play-vote-stack--triple" : ""}`}>
        <h2>{battle.promptText}</h2>
        <button
          data-testid="vote-a-btn"
          className="primary play-vote-btn play-vote-btn--multiline"
          onClick={() => vote("a")}
        >
          {answerA || "(no answer)"}
        </button>
        <button
          data-testid="vote-b-btn"
          className="secondary play-vote-btn play-vote-btn--multiline"
          onClick={() => vote("b")}
        >
          {answerB || "(no answer)"}
        </button>
        {isTriple && (
          <button
            data-testid="vote-c-btn"
            className="secondary play-vote-btn play-vote-btn--multiline"
            onClick={() => vote("c")}
          >
            {answerC || "(no answer)"}
          </button>
        )}
        <button
          data-testid="vote-abstain-btn"
          className="play-vote-btn--abstain"
          onClick={() => vote("abstain")}
        >
          Abstain
        </button>
      </div>
    </div>
  );
}
