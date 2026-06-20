import { Howl } from "howler";
import type { GamePhase } from "../../shared/types";
import { isAnswerPhase } from "./phaseKeys";

export const SOUND_PATHS = {
  answerPhaseEnd: "/sounds/mixkit-revealing-bonus-notification-958.wav",
  battleWinner: "/sounds/mixkit-positive-notification-951.wav",
  gameWinner: "/sounds/mixkit-correct-answer-reward-952.wav",
  promptTimer: "/sounds/mixkit-game-show-happy-timer-666.wav",
  buttonPress: "/sounds/47313572-ui-pop-sound-316482.mp3",
  gameBgm:
    "/sounds/maksymmalko-roblox-minecraft-fortnite-video-game-music-358426.mp3",
} as const;

export const BATTLE_WINNER_SOUND_DELAY_MS = 1650;

const BGM_NORMAL_VOLUME = 0.35;
const BGM_DUCK_VOLUME = 0.12;
const BGM_FADE_MS = 450;
const BGM_DUCK_FADE_MS = 80;
const BGM_UNDUCK_FADE_MS = 120;

export function isE2eMode(): boolean {
  return new URLSearchParams(window.location.search).get("e2e") === "1";
}

export class HostSoundManager {
  private howls = new Map<string, Howl>();
  private readonly disabled: boolean;
  private duckCount = 0;
  private bgmDucked = false;
  private bgmPauseTimer: ReturnType<typeof setTimeout> | null = null;
  private promptTimerPending = false;
  private promptTimerPhase: GamePhase | null = null;
  private menuPaused = false;
  private menuPausedHowls: Howl[] = [];

  constructor() {
    this.disabled = typeof window !== "undefined" && isE2eMode();
  }

  private getHowl(src: string, loop = false): Howl {
    const key = `${src}:${loop}`;
    let howl = this.howls.get(key);
    if (!howl) {
      howl = new Howl({
        src: [src],
        loop,
        html5: loop,
        volume: loop && src === SOUND_PATHS.gameBgm ? 0 : 1,
      });
      this.howls.set(key, howl);
    }
    return howl;
  }

  private getBgm(): Howl {
    return this.getHowl(SOUND_PATHS.gameBgm, true);
  }

  private getPromptTimerHowl(): Howl {
    return this.getHowl(SOUND_PATHS.promptTimer, false);
  }

  private cancelBgmPauseTimer(): void {
    if (this.bgmPauseTimer !== null) {
      window.clearTimeout(this.bgmPauseTimer);
      this.bgmPauseTimer = null;
    }
  }

  private preloadBgm(): void {
    const bgm = this.getBgm();
    if (bgm.state() === "unloaded") {
      bgm.load();
    }
  }

  private duckBgm(): void {
    if (this.disabled) return;

    const bgm = this.getBgm();
    if (!bgm.playing()) return;

    this.duckCount += 1;
    if (this.duckCount !== 1) return;

    this.bgmDucked = true;
    bgm.fade(bgm.volume() as number, BGM_DUCK_VOLUME, BGM_DUCK_FADE_MS);
  }

  private setBgmFullVolume(): void {
    this.duckCount = 0;
    this.bgmDucked = false;

    const bgm = this.getBgm();
    if (!bgm.playing()) {
      bgm.volume(BGM_NORMAL_VOLUME);
      return;
    }

    bgm.fade(bgm.volume() as number, BGM_NORMAL_VOLUME, BGM_UNDUCK_FADE_MS);
  }

  private unduckBgm(): void {
    if (this.disabled) return;
    this.duckCount = Math.max(0, this.duckCount - 1);
    if (this.duckCount !== 0) return;
    this.setBgmFullVolume();
  }

  private playEffect(src: string, onEnd?: () => void): void {
    if (this.disabled) {
      onEnd?.();
      return;
    }
    const howl = this.getHowl(src);
    this.duckBgm();
    const id = howl.play();
    howl.once(
      "end",
      () => {
        this.unduckBgm();
        onEnd?.();
      },
      id
    );
  }

  pauseBgmForPrompting(phase: GamePhase, onReady: () => void): void {
    if (this.disabled) {
      onReady();
      return;
    }

    this.cancelBgmPauseTimer();
    this.preloadBgm();

    const bgm = this.getBgm();
    if (bgm.playing()) {
      bgm.pause();
    }

    onReady();
  }

  resumeBgm(): void {
    if (this.disabled) return;

    this.cancelBgmPauseTimer();
    this.bgmDucked = false;
    this.duckCount = 0;

    const bgm = this.getBgm();

    const start = () => {
      bgm.stop();
      bgm.volume(BGM_NORMAL_VOLUME);
      const soundId = bgm.play();
      if (soundId === undefined) return;

      bgm.once(
        "playerror",
        () => {
          bgm.once("unlock", () => {
            bgm.volume(BGM_NORMAL_VOLUME);
            bgm.play();
          });
        },
        soundId
      );
    };

    if (bgm.state() === "unloaded") {
      bgm.once("load", start);
      bgm.load();
      return;
    }

    start();
  }

  resumeBgmIfStopped(): void {
    if (this.disabled) return;

    const bgm = this.getBgm();
    if (bgm.playing()) return;

    this.resumeBgm();
  }

  stopBgm(): void {
    if (this.disabled) return;

    const bgm = this.getBgm();
    if (!bgm.playing()) return;

    const from = bgm.volume() as number;
    bgm.fade(from, 0, BGM_FADE_MS);
    window.setTimeout(() => {
      bgm.stop();
      this.bgmDucked = false;
      this.duckCount = 0;
    }, BGM_FADE_MS + 50);
  }

  playPromptTimer(phase: GamePhase): void {
    if (this.disabled || !isAnswerPhase(phase)) return;

    this.promptTimerPhase = phase;
    this.promptTimerPending = false;
    const howl = this.getPromptTimerHowl();
    howl.stop();
    howl.play();
  }

  stopPromptTimer(): void {
    this.cancelBgmPauseTimer();
    this.promptTimerPending = false;
    this.promptTimerPhase = null;
    const howl = this.howls.get(`${SOUND_PATHS.promptTimer}:false`);
    if (!howl) return;
    howl.stop();
  }

  beginPromptTimer(phase: GamePhase): void {
    if (this.disabled || !isAnswerPhase(phase)) return;

    this.preloadBgm();
    this.promptTimerPhase = phase;
    this.promptTimerPending = true;
    this.pauseBgmForPrompting(phase, () => {
      if (!this.promptTimerPending || this.promptTimerPhase !== phase) return;
      this.playPromptTimer(phase);
    });
  }

  syncPromptTimer(phase: GamePhase): void {
    if (!isAnswerPhase(phase)) {
      this.stopPromptTimer();
    }
  }

  playAnswerEnd(onEnd?: () => void): void {
    if (this.disabled) {
      onEnd?.();
      return;
    }

    const howl = this.getHowl(SOUND_PATHS.answerPhaseEnd);
    howl.stop();

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onEnd?.();
    };

    const id = howl.play();
    const fallbackTimer = window.setTimeout(finish, 2500);
    howl.once(
      "end",
      () => {
        window.clearTimeout(fallbackTimer);
        finish();
      },
      id
    );
  }

  playBattleWinner(): void {
    this.playEffect(SOUND_PATHS.battleWinner);
  }

  playGameWinner(): void {
    this.playEffect(SOUND_PATHS.gameWinner);
  }

  playButtonPress(): void {
    if (this.disabled) return;
    this.getHowl(SOUND_PATHS.buttonPress).play();
  }

  pauseAllForMenu(): void {
    if (this.disabled || this.menuPaused) return;

    this.menuPaused = true;
    this.menuPausedHowls = [];
    this.cancelBgmPauseTimer();
    this.promptTimerPending = false;

    for (const howl of this.howls.values()) {
      if (howl.playing()) {
        howl.pause();
        this.menuPausedHowls.push(howl);
      }
    }
  }

  resumeFromMenuPause(): void {
    if (this.disabled || !this.menuPaused) return;

    this.menuPaused = false;
    for (const howl of this.menuPausedHowls) {
      howl.play();
    }
    this.menuPausedHowls = [];
  }
}

export const hostSounds = new HostSoundManager();
