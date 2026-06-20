import { describe, it, expect } from "vitest";
import {
  PLAY_KEYBOARD_THRESHOLD_PX,
  getScrollDeltaForField,
  isPlayKeyboardOpen,
} from "../../src/web/components/play/playVisualViewport.js";

describe("isPlayKeyboardOpen", () => {
  it("detects when the visual viewport shrinks for the keyboard", () => {
    expect(isPlayKeyboardOpen(320, 800)).toBe(true);
  });

  it("treats a nearly full-height viewport as keyboard closed", () => {
    expect(isPlayKeyboardOpen(800 - PLAY_KEYBOARD_THRESHOLD_PX, 800)).toBe(false);
  });
});

describe("getScrollDeltaForField", () => {
  it("scrolls down when the field sits below the visible area", () => {
    expect(getScrollDeltaForField(420, 460, 0, 400)).toBe(60);
  });

  it("scrolls up when the field sits above the visible area", () => {
    expect(getScrollDeltaForField(10, 50, 60, 400)).toBe(-50);
  });

  it("does not scroll when the field is already visible", () => {
    expect(getScrollDeltaForField(100, 140, 60, 400)).toBe(0);
  });
});
