import { describe, it, expect } from "vitest";
import { ANSWER_TIMER_MS } from "../../src/shared/constants";

describe("constants", () => {
  it("uses a 40 second default answer timer to match the prompt-phase music", () => {
    expect(ANSWER_TIMER_MS).toBe(40_000);
  });
});
