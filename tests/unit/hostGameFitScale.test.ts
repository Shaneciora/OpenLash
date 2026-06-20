import { describe, expect, it } from "vitest";
import {
  measureHostGameFitScale,
  measureInverseFillScale,
} from "../../src/web/lib/hostGameFitScale";

describe("measureInverseFillScale", () => {
  it("allows user scale when content fits the logical viewport", () => {
    expect(measureInverseFillScale(960, 900, 600, 600, 1.45)).toBe(1.45);
  });

  it("caps scale when content exceeds logical viewport height", () => {
    expect(measureInverseFillScale(960, 900, 600, 800, 1.45)).toBe(1.13);
  });

  it("allows full scale when content fits at 100%", () => {
    expect(measureInverseFillScale(960, 900, 900, 800, 1)).toBe(1);
  });
});

describe("measureHostGameFitScale", () => {
  it("caps scale when content exceeds viewport height", () => {
    expect(measureHostGameFitScale(960, 900, 960, 1200, 1.45)).toBe(0.75);
  });

  it("allows user scale when content is narrower than the viewport", () => {
    expect(measureHostGameFitScale(960, 900, 720, 400, 1.45)).toBe(1.33);
  });

  it("caps scale when content exceeds viewport width", () => {
    expect(measureHostGameFitScale(960, 900, 1200, 400, 1.45)).toBe(0.8);
  });
});
