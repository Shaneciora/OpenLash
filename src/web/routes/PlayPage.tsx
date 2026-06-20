import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useGameSocket } from "../hooks/useGameSocket";
import { clientEvents } from "../../shared/protocol";
import { PlayLobby } from "../components/play/PlayLobby";
import { PlayAnswer } from "../components/play/PlayAnswer";
import { PlayVote } from "../components/play/PlayVote";
import { PlayGameOver } from "../components/play/PlayGameOver";
import { AvatarDraw, type AvatarDrawHandle } from "../components/avatar/AvatarDraw";
import { PlayShell } from "../components/play/PlayShell";
import { PlayPausedOverlay } from "../components/play/PlayPausedOverlay";
import { RoomCodeQrScanner } from "../components/play/RoomCodeQrScanner";
import { canUseCamera } from "../lib/camera";
import { ScreenTransition } from "../components/ScreenTransition";
import { getPlayScreenKey } from "../lib/phaseKeys";
import { canPauseGame } from "../../shared/phases";
import { getPlayWatchTvHint } from "../lib/playPhaseMessage";
import type { Player, PublicRoomState } from "../../shared/types";

type JoinStep = "code" | "password" | "name" | "avatar" | "game";

function renderPlayPhase(
  state: PublicRoomState,
  player: Player,
  emit: ReturnType<typeof useGameSocket>["emit"],
  onLeave: () => void
) {
  if (state.phase === "lobby") {
    return (
      <PlayLobby
        state={state}
        player={player}
        onStart={() => emit(clientEvents.START_GAME)}
        onLeave={onLeave}
      />
    );
  }

  if (
    state.phase === "round1_answer" ||
    state.phase === "round2_answer" ||
    state.phase === "final_answer"
  ) {
    return (
      <PlayAnswer
        state={state}
        player={player}
        onSubmit={(answers) => emit(clientEvents.SUBMIT_ANSWERS, { answers })}
      />
    );
  }

  const isReveal =
    state.phase === "round1_battle_reveal" ||
    state.phase === "round2_battle_reveal" ||
    state.phase === "final_vote_reveal";

  if (
    state.phase === "round1_battle" ||
    state.phase === "round2_battle" ||
    isReveal ||
    (state.phase === "final_vote" && state.settings.finalRoundMode === "thriplash")
  ) {
    if (isReveal) {
      return (
        <div className="play-screen" data-testid="play-waiting">
          <div className="play-status-card">
            <h2>Watch the TV!</h2>
            <p>{getPlayWatchTvHint(state.phase)}</p>
          </div>
        </div>
      );
    }

    return (
      <PlayVote
        state={state}
        player={player}
        onVote={(battleId, choice) =>
          emit(clientEvents.SUBMIT_VOTE, { battleId, choice })
        }
        thriplash={state.phase === "final_vote"}
      />
    );
  }

  if (state.phase === "final_vote" && state.settings.finalRoundMode === "last_lash") {
    return (
      <PlayVote
        state={state}
        player={player}
        lastLash
        onVote={() => Promise.resolve({ ok: true })}
        onLastLashVote={(ids) =>
          emit(clientEvents.SUBMIT_LAST_LASH_VOTES, { answerIds: ids })
        }
      />
    );
  }

  if (state.phase === "podium") {
    return (
      <PlayGameOver
        state={state}
        player={player}
        onPlayAgain={() => emit(clientEvents.PLAY_AGAIN)}
        onLeave={onLeave}
      />
    );
  }

  return (
    <div className="play-screen" data-testid="play-waiting">
      <div className="play-status-card">
        <h2>Watch the TV!</h2>
        <p>{getPlayWatchTvHint(state.phase)}</p>
      </div>
    </div>
  );
}

export function PlayPage() {
  const { code: urlCode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    state,
    player,
    connected,
    rejoining,
    checkRoom,
    joinRoom,
    leaveRoom,
    emit,
    roomClosed,
    acknowledgeRoomClosed,
  } = useGameSocket();
  const [step, setStep] = useState<JoinStep>("code");
  const [code, setCode] = useState(urlCode?.toUpperCase() ?? "");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const avatarDrawRef = useRef<AvatarDrawHandle>(null);
  const showScanQr = canUseCamera();

  const isE2e = searchParams.get("e2e") === "1";

  useEffect(() => {
    if (urlCode) setCode(urlCode.toUpperCase());
  }, [urlCode]);

  const resetJoinFlow = (message?: string) => {
    localStorage.removeItem("openlash_token");
    setStep("code");
    setCode("");
    setName("");
    setPassword("");
    setAvatar(null);
    setJoinError(message ?? null);
    navigate("/play");
  };

  const handleLeave = () => {
    void leaveRoom().then(() => resetJoinFlow());
  };

  useEffect(() => {
    if (!player?.kicked) return;
    void leaveRoom().then(() => resetJoinFlow("You were removed from the room"));
  }, [player?.kicked, leaveRoom]);

  useEffect(() => {
    if (!roomClosed) return;
    acknowledgeRoomClosed();
    void leaveRoom().then(() => resetJoinFlow("This room is no longer active"));
  }, [roomClosed, acknowledgeRoomClosed, leaveRoom]);

  const handleJoin = async (avatarOverride?: string | null) => {
    setJoinError(null);
    try {
      const token = localStorage.getItem("openlash_token") ?? undefined;
      const avatarToSend = avatarOverride !== undefined ? avatarOverride : avatar;
      await joinRoom({ code, name, token, password, avatar: avatarToSend });
      if (avatarOverride !== undefined) setAvatar(avatarOverride);
      setStep("game");
    } catch (e) {
      const message = (e as Error).message;
      if (message === "Room not found") {
        resetJoinFlow(message);
        return;
      }
      setJoinError(message);
    }
  };

  const handleCodeNext = async () => {
    setJoinError(null);
    if (code.length !== 4) {
      setJoinError("Enter a 4-letter room code");
      return;
    }

    setChecking(true);
    try {
      const { passwordRequired } = await checkRoom(code);
      setStep(passwordRequired ? "password" : "name");
    } catch (e) {
      setJoinError((e as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const handlePasswordNext = async () => {
    setJoinError(null);
    if (!password) {
      setJoinError("Enter the room password");
      return;
    }

    setChecking(true);
    try {
      await checkRoom(code, password);
      setStep("name");
    } catch (e) {
      setJoinError((e as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const handleNameNext = () => {
    setJoinError(null);
    if (!name.trim()) {
      setJoinError("Enter your name");
      return;
    }
    setStep("avatar");
  };

  const handleScannedCode = useCallback((scannedCode: string) => {
    setScanning(false);
    setJoinError(null);
    setCode(scannedCode);
  }, []);

  const handleCloseScanner = useCallback(() => {
    setScanning(false);
  }, []);

  if (!connected || rejoining) {
    return (
      <PlayShell>
        <div className="play-screen">
          <div className="play-status-card">
            <h2>{rejoining ? "Reconnecting..." : "Connecting..."}</h2>
          </div>
        </div>
      </PlayShell>
    );
  }

  if (step === "avatar") {
    return (
      <PlayShell>
        <div className="play-screen" data-testid="avatar-step">
          <h1 className="play-title">Draw your avatar</h1>
          {joinError && (
            <p className="play-error" data-testid="join-error">
              {joinError}
            </p>
          )}
          <div className="play-avatar-wrap">
            <AvatarDraw ref={avatarDrawRef} onSave={(data) => void handleJoin(data)} />
          </div>
          <button
            type="button"
            className="play-skip-btn primary"
            data-testid="save-avatar-btn"
            onClick={() => avatarDrawRef.current?.save()}
          >
            Save
          </button>
        </div>
      </PlayShell>
    );
  }

  if (step === "code" || step === "password" || step === "name" || !player) {
    const doJoin = () => void handleJoin();

    if (step === "code") {
      return (
        <PlayShell>
          <div className="play-screen play-screen--stacked" data-testid="join-code-step">
            <h1 className="play-title">Join OpenLash</h1>
            <p className="play-subtitle">Enter the room code from the TV</p>
            <div className="play-join-card card">
              <input
                className="play-join-input play-join-input--code"
                data-testid="room-code-input"
                placeholder="Room code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={4}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
              />
              {joinError && (
                <p className="play-error" data-testid="join-error">
                  {joinError}
                </p>
              )}
              <button
                data-testid="code-next-btn"
                className="primary"
                onClick={() => void handleCodeNext()}
                disabled={checking}
              >
                Next
              </button>
              {showScanQr && (
                <button
                  type="button"
                  data-testid="scan-qr-btn"
                  className="secondary"
                  onClick={() => {
                    setJoinError(null);
                    setScanning(true);
                  }}
                  disabled={checking}
                >
                  Scan QR Code
                </button>
              )}
            </div>
            {scanning && (
              <RoomCodeQrScanner onCode={handleScannedCode} onClose={handleCloseScanner} />
            )}
            {isE2e && <div data-testid="e2e-mode" hidden />}
          </div>
        </PlayShell>
      );
    }

    if (step === "password") {
      return (
        <PlayShell>
          <div className="play-screen play-screen--stacked" data-testid="join-password-step">
            <h1 className="play-title">Join OpenLash</h1>
            <p className="play-subtitle">This room requires a password</p>
            <div className="play-join-card card">
              <input
                data-testid="password-input"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
              />
              {joinError && (
                <p className="play-error" data-testid="join-error">
                  {joinError}
                </p>
              )}
              <button
                data-testid="password-next-btn"
                className="primary"
                onClick={() => void handlePasswordNext()}
                disabled={checking}
              >
                Next
              </button>
            </div>
            {isE2e && <div data-testid="e2e-mode" hidden />}
          </div>
        </PlayShell>
      );
    }

    return (
      <PlayShell>
        <div className="play-screen play-screen--stacked" data-testid="join-name-step">
          <h1 className="play-title">Join OpenLash</h1>
          <p className="play-subtitle">What's your name?</p>
          <div className="play-join-card card">
            <input
              className="play-join-input play-join-input--name"
              data-testid="player-name-input"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={16}
              autoCorrect="off"
            />
            {joinError && (
              <p className="play-error" data-testid="join-error">
                {joinError}
              </p>
            )}
            {isE2e ? (
              <button data-testid="join-btn" className="primary" onClick={doJoin}>
                Join
              </button>
            ) : (
              <>
                <button data-testid="join-next-btn" className="primary" onClick={handleNameNext}>
                  Next (draw avatar)
                </button>
                <button data-testid="join-btn" onClick={doJoin}>
                  Join without avatar
                </button>
              </>
            )}
          </div>
          {isE2e && <div data-testid="e2e-mode" hidden />}
        </div>
      </PlayShell>
    );
  }

  if (!state) {
    return (
      <PlayShell>
        <div className="play-screen">
          <div className="play-status-card">
            <h2>Loading...</h2>
          </div>
        </div>
      </PlayShell>
    );
  }

  return (
    <PlayShell>
      <ScreenTransition
        screenKey={getPlayScreenKey(state)}
        reducedMotion={state.settings.motionSensitivity || isE2e}
      >
        {renderPlayPhase(state, player, emit, handleLeave)}
      </ScreenTransition>
      {state.paused && canPauseGame(state.phase) && <PlayPausedOverlay />}
    </PlayShell>
  );
}
