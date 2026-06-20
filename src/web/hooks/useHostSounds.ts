import { useEffect, useRef } from "react";
import type { PublicRoomState } from "../../shared/types";
import { isAnswerPhase, isGameBgmPhase } from "../lib/phaseKeys";
import { hostSounds } from "../lib/sounds";

export function useHostSounds(state: PublicRoomState | null): void {
  const prevPhaseRef = useRef(state?.phase ?? null);
  const prevPausedRef = useRef(state?.paused ?? false);

  useEffect(() => {
    if (!state) {
      hostSounds.stopPromptTimer();
      return;
    }

    const wasPaused = prevPausedRef.current;
    const isPaused = state.paused;
    if (!wasPaused && isPaused) {
      hostSounds.pauseAllForMenu();
    } else if (wasPaused && !isPaused) {
      hostSounds.resumeFromMenuPause();
    }
    prevPausedRef.current = isPaused;
  }, [state?.paused, state?.phase]);

  useEffect(() => {
    if (!state || state.paused) return;

    const phase = state.phase;
    const prev = prevPhaseRef.current;

    if (prev !== phase) {
      if (isAnswerPhase(phase) && (prev === null || !isAnswerPhase(prev))) {
        hostSounds.beginPromptTimer(phase);
      }

      if (prev && isAnswerPhase(prev) && !isAnswerPhase(phase)) {
        hostSounds.stopPromptTimer();
        if (isGameBgmPhase(phase)) {
          hostSounds.resumeBgm();
        }
        hostSounds.playAnswerEnd();
      } else if (
        isGameBgmPhase(phase) &&
        prev &&
        isGameBgmPhase(prev) &&
        !isAnswerPhase(prev)
      ) {
        hostSounds.resumeBgmIfStopped();
      }

      if (phase === "podium" && prev !== "podium") {
        hostSounds.stopPromptTimer();
        hostSounds.stopBgm();
        hostSounds.playGameWinner();
      }

      if (phase === "lobby" && prev !== "lobby" && prev !== null) {
        hostSounds.stopPromptTimer();
        hostSounds.stopBgm();
      }
    }

    hostSounds.syncPromptTimer(phase);

    prevPhaseRef.current = phase;
  }, [state?.phase, state?.paused]);

  useEffect(() => {
    return () => hostSounds.stopPromptTimer();
  }, []);
}
