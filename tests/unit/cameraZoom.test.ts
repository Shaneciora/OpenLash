import { describe, it, expect } from "vitest";
import { clampZoom, pinchZoomValue } from "../../src/web/lib/cameraZoom";

describe("cameraZoom", () => {
  it("clamps zoom within bounds", () => {
    expect(clampZoom(0.5, 1, 4)).toBe(1);
    expect(clampZoom(5, 1, 4)).toBe(4);
    expect(clampZoom(2.5, 1, 4)).toBe(2.5);
  });

  it("scales pinch distance into zoom", () => {
    expect(pinchZoomValue(100, 200, 1, 1, 4)).toBe(2);
    expect(pinchZoomValue(200, 100, 2, 1, 4)).toBe(1);
    expect(pinchZoomValue(0, 200, 2, 1, 4)).toBe(2);
  });
});
