import { describe, expect, it } from "vitest";
import { getPlayWatchTvHint } from "../../src/web/lib/playPhaseMessage";

describe("getPlayWatchTvHint", () => {
  it("describes battle reveal phases", () => {
    expect(getPlayWatchTvHint("round1_battle_reveal")).toBe("Results are in...");
    expect(getPlayWatchTvHint("round2_battle_reveal")).toBe("Results are in...");
    expect(getPlayWatchTvHint("final_vote_reveal")).toBe("Results are in...");
  });

  it("describes scoreboard phases", () => {
    expect(getPlayWatchTvHint("round1_scores")).toBe("Round 1 scores are on the TV.");
    expect(getPlayWatchTvHint("round2_scores")).toBe("Round 2 scores are on the TV.");
    expect(getPlayWatchTvHint("final_reveal")).toBe("Final results are on the TV.");
  });
});
