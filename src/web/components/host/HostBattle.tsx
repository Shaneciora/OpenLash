import { useEffect } from "react";
import type { ReactNode } from "react";
import type {
  Battle,
  Player,
  PublicRoomState,
  ThriplashBattle,
} from "../../../shared/types";
import {
  isTripleBattle,
  battlerIds,
  isBattler,
} from "../../../shared/battleLayout";
import { thriplashAnswerLines } from "../../../shared/thriplashAnswers";
import { TimerRing, timerRingProps } from "../TimerRing";
import { BATTLE_WINNER_SOUND_DELAY_MS, hostSounds, isE2eMode } from "../../lib/sounds";

function playerInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function getBattle(
  state: PublicRoomState,
  thriplash?: boolean
): Battle | ThriplashBattle | null {
  const battles = thriplash ? state.thriplashBattles : state.battles;
  return battles[state.currentBattleIndex] ?? null;
}

function getAnswerText(
  battle: Battle | ThriplashBattle,
  side: "a" | "b" | "c",
  thriplash?: boolean
): string | string[] {
  if (thriplash) {
    const tb = battle as ThriplashBattle;
    const answers =
      side === "a" ? tb.answersA : side === "b" ? tb.answersB : tb.answersC;
    const lines = thriplashAnswerLines(answers);
    return lines.length > 0 ? lines : "(no answer)";
  }
  const b = battle as Battle;
  const answer =
    side === "a" ? b.answerA : side === "b" ? b.answerB : b.answerC;
  return answer?.text || "(no answer)";
}

function countVoteProgress(
  state: PublicRoomState,
  battle: Battle | ThriplashBattle,
  thriplash?: boolean
): { voted: number; total: number } {
  const battlerIdsList = battlerIds(battle);
  const voters = state.players.filter(
    (p) =>
      p.connected &&
      !p.kicked &&
      !p.isAudience &&
      !battlerIdsList.includes(p.id)
  );
  const tb = thriplash ? (battle as ThriplashBattle) : null;
  const votedIds = new Set([
    ...battle.votesA,
    ...battle.votesB,
    ...(tb?.votesC ?? []),
    ...battle.abstentions,
  ]);
  const voted = voters.filter((v) => votedIds.has(v.id)).length;
  return { voted, total: voters.length };
}

function playerById(players: Player[], id: string): Player | undefined {
  return players.find((p) => p.id === id);
}

interface VoteProps {
  state: PublicRoomState;
  thriplash?: boolean;
}

export function HostBattleVote({ state, thriplash }: VoteProps) {
  const battles = thriplash ? state.thriplashBattles : state.battles;
  const battle = getBattle(state, thriplash);

  if (!battle) {
    return (
      <div className="host-battle-vote" data-testid="host-battle-vote">
        <p>No battle</p>
      </div>
    );
  }

  const { voted, total } = countVoteProgress(state, battle, thriplash);
  const isTriple = isTripleBattle(battle);

  return (
    <div
      className={`host-battle-vote${isTriple ? " host-battle-vote--triple" : ""}`}
      data-testid="host-battle-vote"
    >
      <p className="host-battle-vote-battle-index" data-testid="battle-progress">
        Battle {state.currentBattleIndex + 1} of {battles.length}
      </p>
      <h1 className="host-battle-vote-prompt">{battle.promptText}</h1>
      <TimerRing {...timerRingProps(state)} />
      <p className="host-battle-vote-hint">Pick your favorite on your phone!</p>
      <p className="host-battle-vote-progress" data-testid="vote-progress">
        {voted} of {total} voted
      </p>
    </div>
  );
}

interface RevealQuipProps {
  side: "a" | "b" | "c";
  player: Player | undefined;
  answer: string | string[];
  voterIds: string[];
  points: number;
  winner: boolean;
  players: Player[];
  stepVoters: string;
  stepPoints: string;
  compact?: boolean;
}

function RevealQuip({
  side,
  player,
  answer,
  voterIds,
  points,
  winner,
  players,
  stepVoters,
  stepPoints,
  compact,
}: RevealQuipProps) {
  const voters = voterIds
    .map((id) => playerById(players, id))
    .filter((p): p is Player => Boolean(p));

  return (
    <div
      className={`host-reveal-quip${winner ? " host-reveal-quip--winner" : ""}${compact ? " host-reveal-quip--compact" : ""}`}
      data-testid={`quip-${side}`}
    >
      <div className="host-reveal-player">
        {player?.avatar ? (
          <img src={player.avatar} alt="" className="host-reveal-avatar" />
        ) : (
          <div className="host-reveal-avatar host-reveal-avatar--placeholder">
            {playerInitial(player?.name ?? "?")}
          </div>
        )}
        <span className="host-reveal-name">{player?.name ?? "?"}</span>
      </div>

      <div className="host-reveal-answer">
        {Array.isArray(answer) ? (
          answer.map((line, index) => (
            <p key={index}>{line}</p>
          ))
        ) : (
          <p>{answer}</p>
        )}
      </div>

      <div className={`host-reveal-voters host-reveal-step ${stepVoters}`}>
        <span className="host-reveal-voters-label">Voted for this</span>
        {voters.length > 0 ? (
          <ul className="host-reveal-voter-list">
            {voters.map((v) => (
              <li key={v.id} className="host-reveal-voter-chip">
                {v.name}
              </li>
            ))}
          </ul>
        ) : (
          <span className="host-reveal-voter-empty">Nobody</span>
        )}
      </div>

      <div className={`host-reveal-points host-reveal-step ${stepPoints}`}>
        +{points}
      </div>
    </div>
  );
}

interface RevealProps {
  state: PublicRoomState;
  thriplash?: boolean;
}

export function HostBattleReveal({ state, thriplash }: RevealProps) {
  const battles = thriplash ? state.thriplashBattles : state.battles;
  const battle = getBattle(state, thriplash);

  useEffect(() => {
    if (!battle) return;
    const delay =
      state.settings.motionSensitivity || isE2eMode() ? 0 : BATTLE_WINNER_SOUND_DELAY_MS;
    const timer = window.setTimeout(() => hostSounds.playBattleWinner(), delay);
    return () => window.clearTimeout(timer);
  }, [battle?.id, state.settings.motionSensitivity]);

  if (!battle) {
    return (
      <div className="host-reveal" data-testid="host-battle-reveal">
        <p>No battle</p>
      </div>
    );
  }

  const result = battle.result;
  const isTriple = isTripleBattle(battle);
  const playerA = playerById(state.players, battle.playerA);
  const playerB = playerById(state.players, battle.playerB);
  const playerC = battle.playerC ? playerById(state.players, battle.playerC) : undefined;
  const answerA = getAnswerText(battle, "a", thriplash);
  const answerB = getAnswerText(battle, "b", thriplash);
  const answerC = isTriple ? getAnswerText(battle, "c", thriplash) : "";

  const pointsA = result?.pointsA ?? 0;
  const pointsB = result?.pointsB ?? 0;
  const pointsC = result?.pointsC ?? 0;
  const winnerA = result?.winnerId === "a" || (result && pointsA > pointsB && pointsA > pointsC);
  const winnerB = result?.winnerId === "b" || (result && pointsB > pointsA && pointsB > pointsC);
  const winnerC = result?.winnerId === "c" || (result && pointsC > pointsA && pointsC > pointsB);

  const abstainCount = battle.abstentions.length;

  let banner: ReactNode = null;
  if (result?.jinx) {
    banner = (
      <p className="host-reveal-banner host-reveal-banner--jinx host-reveal-step host-reveal-step--4">
        JINX!
      </p>
    );
  } else if (result?.superQuiplash) {
    banner = (
      <p className="host-reveal-banner host-reveal-banner--quiplash host-reveal-step host-reveal-step--4">
        SUPER QUIPLASH!
      </p>
    );
  } else if (result?.quiplash) {
    banner = (
      <p className="host-reveal-banner host-reveal-banner--quiplash host-reveal-step host-reveal-step--4">
        QUIPLASH!
      </p>
    );
  }

  return (
    <div
      className={`host-reveal${isTriple ? " host-reveal--triple" : ""}`}
      data-testid="host-battle-reveal"
    >
      <p className="host-reveal-progress" data-testid="battle-progress">
        Battle {state.currentBattleIndex + 1} of {battles.length}
      </p>

      <h1 className="host-reveal-prompt host-reveal-step host-reveal-step--1">
        {battle.promptText}
      </h1>

      <div
        className={`host-reveal-matchup host-reveal-step host-reveal-step--2${isTriple ? " host-reveal-matchup--triple" : ""}`}
      >
        <RevealQuip
          side="a"
          player={playerA}
          answer={answerA}
          voterIds={battle.votesA}
          points={pointsA}
          winner={Boolean(winnerA)}
          players={state.players}
          stepVoters="host-reveal-step--3"
          stepPoints="host-reveal-step--4"
          compact={isTriple}
        />
        {!isTriple && <span className="host-reveal-vs">VS</span>}
        <RevealQuip
          side="b"
          player={playerB}
          answer={answerB}
          voterIds={battle.votesB}
          points={pointsB}
          winner={Boolean(winnerB)}
          players={state.players}
          stepVoters="host-reveal-step--3"
          stepPoints="host-reveal-step--4"
          compact={isTriple}
        />
        {isTriple && (
          <RevealQuip
            side="c"
            player={playerC}
            answer={answerC}
            voterIds={battle.votesC}
            points={pointsC}
            winner={Boolean(winnerC)}
            players={state.players}
            stepVoters="host-reveal-step--3"
            stepPoints="host-reveal-step--4"
            compact
          />
        )}
      </div>

      {abstainCount > 0 && (
        <p className="host-reveal-abstain host-reveal-step host-reveal-step--4">
          {abstainCount} abstained
        </p>
      )}

      {banner}
    </div>
  );
}
