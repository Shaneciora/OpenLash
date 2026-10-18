import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import QRCode from "qrcode";
import { useGameSocket } from "../hooks/useGameSocket";
import { usePlayJoinBase } from "../hooks/usePlayJoinBase";
import type { z } from "zod";
import { clientEvents, updateSettingsSchema } from "../../shared/protocol";
import type { PublicRoomState } from "../../shared/types";
import { HostLobby } from "../components/host/HostLobby";
import { HostSettings } from "../components/host/HostSettings";
import { HostBattleVote, HostBattleReveal } from "../components/host/HostBattle";
import { HostLastLashVote } from "../components/host/HostLastLashVote";
import { HostAnswerPhase } from "../components/host/HostAnswerPhase";
import { HostScoreboard } from "../components/host/HostScoreboard";
import { HostPodium } from "../components/host/HostPodium";
import { useAnnouncer } from "../hooks/useAnnouncer";
import { useHostSounds } from "../hooks/useHostSounds";
import { HostViewport } from "../components/screenChecker/HostViewport";
import { HostGameScale } from "../components/screenChecker/HostGameScale";
import { getHostScale } from "../lib/hostScale";
import { isUsablePlayBase } from "../../shared/joinUrl";
import { ScreenTransition } from "../components/ScreenTransition";
import { getHostScreenKey } from "../lib/phaseKeys";
import { FullscreenButton } from "../components/FullscreenButton";
import { HostPauseMenu } from "../components/host/HostPauseMenu";
import { canPauseGame } from "../../shared/phases";

function getCurrentBattle(s: PublicRoomState | null) {
  if (!s) return null;
  if (s.phase === "round1_battle" || s.phase === "round2_battle") {
    return s.battles[s.currentBattleIndex];
  }
  if (
    s.phase === "round1_battle_reveal" ||
    s.phase === "round2_battle_reveal"
  ) {
    return s.battles[s.currentBattleIndex];
  }
  if (s.phase === "final_vote" && s.settings.finalRoundMode === "thriplash") {
    return s.thriplashBattles[s.currentBattleIndex];
  }
  if (s.phase === "final_vote_reveal") {
    return s.thriplashBattles[s.currentBattleIndex];
  }
  return null;
}

function renderHostPhase(
  state: PublicRoomState,
  opts: {
    qrUrl: string;
    codeRevealed: boolean;
    onRevealCode: () => void;
    onCollectionChange: (collectionId: number) => void;
    onUpdateSettings: (patch: z.infer<typeof updateSettingsSchema>) => void;
    onKickPlayer: (playerId: string) => void;
    onPlayAgain: () => void;
    reducedMotion: boolean;
  }
) {
  if (state.phase === "lobby") {
    return (
      <div className="host-lobby-layout">
        <HostLobby
          state={state}
          qrUrl={opts.qrUrl}
          codeRevealed={opts.codeRevealed}
          onRevealCode={opts.onRevealCode}
          reducedMotion={opts.reducedMotion}
          onCollectionChange={opts.onCollectionChange}
          onKickPlayer={opts.onKickPlayer}
        />
        <div className="host-lobby-settings-column">
          <HostSettings state={state} onUpdate={opts.onUpdateSettings} />
        </div>
      </div>
    );
  }

  if (
    state.phase === "round1_answer" ||
    state.phase === "round2_answer" ||
    state.phase === "final_answer"
  ) {
    return <HostAnswerPhase state={state} reducedMotion={opts.reducedMotion} />;
  }

  if (state.phase === "round1_battle" || state.phase === "round2_battle") {
    return <HostBattleVote state={state} />;
  }

  if (
    state.phase === "round1_battle_reveal" ||
    state.phase === "round2_battle_reveal"
  ) {
    return <HostBattleReveal state={state} />;
  }

  if (state.phase === "final_vote" && state.settings.finalRoundMode === "thriplash") {
    return <HostBattleVote state={state} thriplash />;
  }

  if (state.phase === "final_vote" && state.settings.finalRoundMode === "last_lash") {
    return <HostLastLashVote state={state} />;
  }

  if (state.phase === "final_vote_reveal") {
    return <HostBattleReveal state={state} thriplash />;
  }

  if (state.phase === "round1_scores" || state.phase === "round2_scores") {
    return <HostScoreboard state={state} reducedMotion={opts.reducedMotion} />;
  }

  if (state.phase === "podium") {
    return (
      <HostPodium
        state={state}
        onPlayAgain={opts.onPlayAgain}
        reducedMotion={opts.reducedMotion}
      />
    );
  }

  if (state.phase === "final_reveal") {
    return <HostScoreboard state={state} lastLash reducedMotion={opts.reducedMotion} />;
  }

  return null;
}

function getE2eCreateSettings(): Record<string, unknown> | undefined {
  const params = new URLSearchParams(window.location.search);
  if (params.get("e2e") !== "1") return undefined;

  const settings: Record<string, unknown> = {};
  const maxPlayers = params.get("maxPlayers");
  if (maxPlayers) {
    const n = Number(maxPlayers);
    if (Number.isFinite(n)) settings.maxPlayers = n;
  }

  return Object.keys(settings).length > 0 ? settings : undefined;
}

export function HostPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { state, connected, createRoom, emit, hostJoin } = useGameSocket();
  const { playJoinBase, warning: joinWarning } = usePlayJoinBase();
  const [qrUrl, setQrUrl] = useState<string>("");
  const [codeRevealed, setCodeRevealed] = useState(true);
  const [hostScale] = useState(() => getHostScale());

  useEffect(() => {
    if (!connected) return;
    if (code) {
      hostJoin(code).catch(() => navigate("/host", { replace: true }));
      return;
    }
    createRoom(getE2eCreateSettings()).then((s) => {
      navigate(`/host/${s.code}`, { replace: true });
    });
  }, [connected, code, createRoom, hostJoin, navigate]);

  useEffect(() => {
    if (!state?.code || !playJoinBase || !isUsablePlayBase(playJoinBase)) {
      setQrUrl("");
      return;
    }
    const url = `${playJoinBase}/${state.code}`;
    QRCode.toDataURL(url).then(setQrUrl);
  }, [state?.code, playJoinBase]);

  useEffect(() => {
    if (state) setCodeRevealed(!state.settings.roomCodeHidden);
  }, [state?.settings.roomCodeHidden]);

  const isE2e = new URLSearchParams(window.location.search).get("e2e") === "1";

  const announcerText =
    state && state.phase === "lobby" && codeRevealed
      ? `Room code ${state.code.split("").join(" ")}`
      : getCurrentBattle(state)?.promptText ?? null;

  const subtitle = useAnnouncer(announcerText, state?.settings.narratorEnabled ?? false);
  useHostSounds(state);

  useEffect(() => {
    if (!state || !canPauseGame(state.phase)) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (state.paused) return;
      emit(clientEvents.PAUSE_GAME);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state?.phase, state?.paused, emit]);

  const updateSettings = (patch: z.infer<typeof updateSettingsSchema>) => {
    emit(clientEvents.UPDATE_SETTINGS, patch);
  };

  const revealCode = () => {
    emit(clientEvents.REVEAL_CODE);
    setCodeRevealed(true);
  };

  if (!state) {
    return (
      <HostViewport layout="centered">
        <FullscreenButton variant="dark" />
        <div className="host-ui" data-testid="host-loading">
          <h1 style={{ color: "white", textAlign: "center" }}>Starting lobby...</h1>
        </div>
      </HostViewport>
    );
  }

  const isLobby = state.phase === "lobby";

  const phaseContent = (
    <ScreenTransition
      screenKey={getHostScreenKey(state)}
      reducedMotion={state.settings.motionSensitivity || isE2e}
    >
      {renderHostPhase(state, {
        qrUrl,
        codeRevealed,
        onRevealCode: revealCode,
        onCollectionChange: (collectionId) =>
          updateSettings({ collectionId, promptSource: "collection" }),
        onUpdateSettings: updateSettings,
        onKickPlayer: (playerId) => emit(clientEvents.KICK_PLAYER, { playerId }),
        onPlayAgain: () => emit(clientEvents.PLAY_AGAIN),
        reducedMotion: state.settings.motionSensitivity || isE2e,
      })}
    </ScreenTransition>
  );

  return (
    <HostViewport layout={isLobby ? "lobby" : "game"}>
      <FullscreenButton variant="dark" />
      {isLobby && (
        <Link to="/" className="back-link" data-testid="host-back-link">
          Back
        </Link>
      )}

      {isLobby ? (
        <div className="host-ui host-ui--lobby" data-testid="host-screen">
          {joinWarning && (
            <div className="host-join-warning" data-testid="join-warning">
              {joinWarning}
            </div>
          )}
          {phaseContent}
        </div>
      ) : (
        <>
          {codeRevealed && (
            <div className="host-room-badge" data-testid="host-room-badge">
              Room <strong>{state.code}</strong>
            </div>
          )}
          <HostGameScale scale={hostScale}>
            <div className="host-ui" data-testid="host-screen">
              {phaseContent}
            </div>
          </HostGameScale>
          {state.settings.subtitles && subtitle && (
            <p
              data-testid="announcer-subtitles"
              className="host-announcer-subtitles"
            >
              {subtitle}
            </p>
          )}
        </>
      )}

      {isE2e && <div data-testid="e2e-mode" hidden />}
      {state.paused && canPauseGame(state.phase) && (
        <HostPauseMenu
          onResume={() => emit(clientEvents.RESUME_GAME)}
          onEndGame={() => emit(clientEvents.PLAY_AGAIN)}
        />
      )}
    </HostViewport>
  );
}
