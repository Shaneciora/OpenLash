import { describe, it, expect } from "vitest";
import {
  formatThriplashAnswers,
  hasSubmittedThriplashAnswers,
  thriplashAnswerLines,
} from "../../src/shared/thriplashAnswers.js";

describe("thriplashAnswers", () => {
  it("returns non-empty answer lines in order", () => {
    expect(
      thriplashAnswerLines([
        { text: " first " },
        { text: "" },
        { text: "third" },
      ])
    ).toEqual(["first", "third"]);
  });

  it("formats answers with line breaks", () => {
    expect(
      formatThriplashAnswers([
        { text: "one" },
        { text: "two" },
        { text: "three" },
      ])
    ).toBe("one\ntwo\nthree");
  });

  it("tracks submission after three slots are stored", () => {
    expect(hasSubmittedThriplashAnswers([])).toBe(false);
    expect(hasSubmittedThriplashAnswers([{ text: "a" }])).toBe(false);
    expect(
      hasSubmittedThriplashAnswers([
        { text: "a" },
        { text: "" },
        { text: "" },
      ])
    ).toBe(true);
  });
});
