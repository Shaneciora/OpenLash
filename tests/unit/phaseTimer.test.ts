import { describe, expect, it, vi, afterEach } from "vitest";
import { AUTO_SUBMIT_BUFFER_MS, msUntilAutoSubmit, msUntilPhaseEnd } from "../../src/web/lib/phaseTimer";

describe("msUntilPhaseEnd", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when paused or no end time", () => {
    expect(msUntilPhaseEnd(null, false, 1000)).toBeNull();
    expect(msUntilPhaseEnd(5000, true, 1000)).toBeNull();
  });

  it("returns zero when the phase has already ended", () => {
    expect(msUntilPhaseEnd(1000, false, 2000)).toBe(0);
  });

  it("returns remaining milliseconds until the phase ends", () => {
    expect(msUntilPhaseEnd(5000, false, 1000)).toBe(4000);
  });

  it("subtracts the auto-submit buffer", () => {
    expect(msUntilAutoSubmit(5000, false, 1000)).toBe(4000 - AUTO_SUBMIT_BUFFER_MS);
    expect(msUntilAutoSubmit(1000, false, 900)).toBe(0);
  });
});
