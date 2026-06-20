import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicRoomState, Player } from "../../../shared/types";
import { hasSubmittedThriplashAnswers } from "../../../shared/thriplashAnswers";
import { getPendingAnswerPrompts } from "../../../shared/playerPrompts";
import {
  thriplashAnswerSideForPlayer,
  thriplashAnswersForSide,
} from "../../../shared/thriplashBattle";
import { resolveRoomPlayer } from "../../lib/roomPlayer";
import { usePhaseTimerExpiry } from "../../hooks/usePhaseTimerExpiry";
import { TimerRing, timerRingProps } from "../TimerRing";

interface Props {
  state: PublicRoomState;
  player: Player;
  onSubmit: (answers: {
    promptId: string;
    battleId?: string;
    text: string;
  }[]) => Promise<{ ok: boolean }>;
}

function AnswerSubmitted() {
  return (
    <div className="play-screen" data-testid="answer-submitted">
      <div className="play-status-card">
        <h2>Answer submitted!</h2>
        <p>Watch the TV...</p>
      </div>
    </div>
  );
}

export function PlayAnswer({ state, player, onSubmit }: Props) {
  const self = useMemo(() => resolveRoomPlayer(state, player), [state, player]);
  const [draft, setDraft] = useState("");
  const [thriplashDrafts, setThriplashDrafts] = useState(["", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const draftRef = useRef(draft);
  const thriplashDraftsRef = useRef(thriplashDrafts);
  const submittingRef = useRef(submitting);
  draftRef.current = draft;
  thriplashDraftsRef.current = thriplashDrafts;
  submittingRef.current = submitting;

  const isThriplash =
    state.phase === "final_answer" && state.settings.finalRoundMode === "thriplash";

  const pending = useMemo(
    () => getPendingAnswerPrompts(state, self.id),
    [state, self.id]
  );
  const current = pending[0];
  const currentRef = useRef(current);
  currentRef.current = current;

  const thriplashBattle = useMemo(() => {
    if (!isThriplash || !current) return null;
    return state.thriplashBattles.find((b) => b.id === current.battleId) ?? null;
  }, [isThriplash, current, state.thriplashBattles]);

  const thriplashSide = thriplashBattle
    ? thriplashAnswerSideForPlayer(thriplashBattle, self.id)
    : null;
  const thriplashAnswers =
    thriplashBattle && thriplashSide
      ? thriplashAnswersForSide(thriplashBattle, thriplashSide)
      : [];

  const thriplashBattleRef = useRef(thriplashBattle);
  thriplashBattleRef.current = thriplashBattle;

  useEffect(() => {
    setDraft("");
  }, [current?.battleId, current?.inputTestId]);

  useEffect(() => {
    if (thriplashBattle && !hasSubmittedThriplashAnswers(thriplashAnswers)) {
      setThriplashDrafts(["", "", ""]);
    }
  }, [thriplashBattle?.id, thriplashAnswers.length]);

  const submitCurrentAnswer = useCallback(
    async (text: string) => {
      const prompt = currentRef.current;
      if (!prompt || submittingRef.current) return;
      setSubmitting(true);
      try {
        await onSubmit([
          {
            promptId: prompt.promptId,
            battleId: prompt.battleId === "lastlash" ? undefined : prompt.battleId,
            text,
          },
        ]);
        setDraft("");
      } finally {
        setSubmitting(false);
      }
    },
    [onSubmit]
  );

  const submitThriplashAnswers = useCallback(
    async (drafts: string[]) => {
      const battle = thriplashBattleRef.current;
      const prompt = currentRef.current;
      if (!battle || !prompt || submittingRef.current) return;
      setSubmitting(true);
      try {
        await onSubmit(
          drafts.map((text) => ({
            promptId: prompt.promptId,
            battleId: battle.id,
            text,
          }))
        );
        setThriplashDrafts(["", "", ""]);
      } finally {
        setSubmitting(false);
      }
    },
    [onSubmit]
  );

  const handleSubmit = async () => {
    if (!draft.trim()) return;
    await submitCurrentAnswer(draft);
  };

  const handleThriplashSubmit = async () => {
    await submitThriplashAnswers(thriplashDrafts);
  };

  const autoSubmitOnTimerExpiry = useCallback(() => {
    if (submittingRef.current) return;

    if (isThriplash) {
      const battle = thriplashBattleRef.current;
      if (!battle) return;
      const side = thriplashAnswerSideForPlayer(battle, self.id);
      if (!side || hasSubmittedThriplashAnswers(thriplashAnswersForSide(battle, side))) return;
      void submitThriplashAnswers(thriplashDraftsRef.current);
      return;
    }

    const prompt = currentRef.current;
    if (!prompt) return;
    const text = draftRef.current;
    if (text.length === 0) return;
    void submitCurrentAnswer(text);
  }, [isThriplash, self.id, submitCurrentAnswer, submitThriplashAnswers]);

  usePhaseTimerExpiry(
    state.phaseEndsAt,
    state.paused,
    autoSubmitOnTimerExpiry,
    Boolean(current)
  );

  if (isThriplash) {
    if (!current || !thriplashBattle) {
      return <AnswerSubmitted />;
    }

    return (
      <div className="play-screen play-screen--stacked">
        <TimerRing {...timerRingProps(state)} />
        <p className="play-subtitle" data-testid="prompt-progress">
          {current?.progressLabel ?? "Give 3 answers"}
        </p>
        <div className="play-screen__body">
          <div className="play-prompt-card card">
            <p>{thriplashBattle.promptText}</p>
            <div className="play-thriplash-inputs">
              {thriplashDrafts.map((value, index) => (
                <label key={index} className="play-thriplash-input">
                  <span>Answer {index + 1}</span>
                  <input
                    data-testid={`${current?.inputTestId ?? thriplashBattle.id}-${index}`}
                    placeholder={`Answer ${index + 1}`}
                    value={value}
                    onChange={(e) => {
                      const next = [...thriplashDrafts];
                      next[index] = e.target.value;
                      setThriplashDrafts(next);
                    }}
                    maxLength={60}
                    autoFocus={index === 0}
                  />
                </label>
              ))}
            </div>
            <div className="play-prompt-actions">
              <button
                className="primary"
                data-testid="submit-answers-btn"
                onClick={() => void handleThriplashSubmit()}
                disabled={submitting}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!current) {
    return <AnswerSubmitted />;
  }

  return (
    <div className="play-screen play-screen--stacked">
      <TimerRing {...timerRingProps(state)} />
      {current.progressLabel && (
        <p className="play-subtitle" data-testid="prompt-progress">
          {current.progressLabel}
        </p>
      )}
      <div className="play-screen__body">
        <div className="play-prompt-card card">
          <p>{current.text}</p>
          <input
            data-testid={current.inputTestId}
            placeholder="Your answer"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={60}
            autoFocus
          />
          <div className="play-prompt-actions">
            <button
              className="primary"
              data-testid="submit-answers-btn"
              onClick={() => void handleSubmit()}
              disabled={submitting || !draft.trim()}
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
