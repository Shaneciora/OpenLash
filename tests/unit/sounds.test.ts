import { describe, it, expect, vi, beforeEach } from "vitest";

const howlInstances: Array<{
  src: string[];
  loop: boolean;
  state: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  playing: ReturnType<typeof vi.fn>;
  volume: ReturnType<typeof vi.fn>;
  fade: ReturnType<typeof vi.fn>;
  once: ReturnType<typeof vi.fn>;
}> = [];

vi.mock("howler", () => ({
  Howl: vi.fn((opts: { src: string[]; loop?: boolean }) => {
    const instance = {
      src: opts.src,
      loop: opts.loop ?? false,
      state: vi.fn(() => "loaded"),
      load: vi.fn(),
      play: vi.fn(() => 1),
      stop: vi.fn(),
      pause: vi.fn(),
      playing: vi.fn(() => false),
      volume: vi.fn(() => 0),
      fade: vi.fn(),
      once: vi.fn(),
    };
    howlInstances.push(instance);
    return instance;
  }),
}));

describe("HostSoundManager", () => {
  beforeEach(() => {
    howlInstances.length = 0;
    vi.resetModules();
    vi.stubGlobal("window", {
      setTimeout,
      clearTimeout,
      location: { search: "" },
    });
  });

  it("plays answer-end without changing BGM volume", async () => {
    const { HostSoundManager, SOUND_PATHS } = await import("../../src/web/lib/sounds");
    const manager = new HostSoundManager();

    const bgm = manager["getBgm"]() as (typeof howlInstances)[number];
    bgm.playing.mockReturnValue(true);

    manager.playAnswerEnd();

    expect(bgm.pause).not.toHaveBeenCalled();
    expect(bgm.fade).not.toHaveBeenCalled();

    const answerEnd = howlInstances.find((h) =>
      h.src.includes(SOUND_PATHS.answerPhaseEnd)
    );
    expect(answerEnd?.play).toHaveBeenCalled();
  });

  it("resumes BGM at full volume immediately when leaving answer phase", async () => {
    const { HostSoundManager } = await import("../../src/web/lib/sounds");
    const manager = new HostSoundManager();
    const bgm = manager["getBgm"]() as (typeof howlInstances)[number];

    manager.resumeBgm();

    expect(bgm.stop).toHaveBeenCalled();
    expect(bgm.volume).toHaveBeenCalledWith(0.35);
    expect(bgm.play).toHaveBeenCalled();
    expect(bgm.fade).not.toHaveBeenCalled();
  });

  it("preloads BGM when prompting begins", async () => {
    const { HostSoundManager } = await import("../../src/web/lib/sounds");
    const manager = new HostSoundManager();
    const bgm = manager["getBgm"]() as (typeof howlInstances)[number];
    bgm.state.mockReturnValue("unloaded");

    manager.beginPromptTimer("round1_answer");

    expect(bgm.load).toHaveBeenCalled();
  });

  it("pauses BGM immediately when prompting begins", async () => {
    const { HostSoundManager } = await import("../../src/web/lib/sounds");
    const manager = new HostSoundManager();
    const bgm = manager["getBgm"]() as (typeof howlInstances)[number];
    bgm.playing.mockReturnValue(true);

    manager.beginPromptTimer("round1_answer");

    expect(bgm.pause).toHaveBeenCalled();
    expect(bgm.fade).not.toHaveBeenCalled();
  });
});
