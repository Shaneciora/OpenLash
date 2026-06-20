import { describe, it, expect } from "vitest";
import { generateRoomCode, isValidRoomCode } from "../../src/game/roomCode.js";
import { ROOM_CODE_CHARS } from "../../src/shared/constants.js";

describe("roomCode", () => {
  it("generates 4-char codes from valid charset", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(4);
      expect(isValidRoomCode(code)).toBe(true);
      for (const c of code) {
        expect(ROOM_CODE_CHARS).toContain(c);
      }
    }
  });

  it("rejects invalid codes", () => {
    expect(isValidRoomCode("IO01")).toBe(false);
    expect(isValidRoomCode("AB")).toBe(false);
    expect(isValidRoomCode("ABCD")).toBe(true);
  });
});
