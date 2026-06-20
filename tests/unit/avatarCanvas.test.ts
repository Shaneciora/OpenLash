import { describe, it, expect } from "vitest";
import { isInsideCircle } from "../../src/web/lib/avatarCanvas";

describe("avatarCanvas", () => {
  it("detects points inside the circular avatar", () => {
    expect(isInsideCircle(50, 50, 100)).toBe(true);
    expect(isInsideCircle(0, 0, 100)).toBe(false);
    expect(isInsideCircle(99, 50, 100)).toBe(true);
  });
});
