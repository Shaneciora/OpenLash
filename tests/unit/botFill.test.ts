import { describe, it, expect } from "vitest";
import {
  getBotFillTargetCount,
  fillsLobbyImmediately,
  isBotFillEnabled,
} from "../../src/game/botFill.js";
import { DEFAULT_SETTINGS } from "../../src/shared/types.js";

describe("getBotFillTargetCount", () => {
  it("returns max players when bot fill is disabled", () => {
    expect(getBotFillTargetCount(DEFAULT_SETTINGS)).toBe(DEFAULT_SETTINGS.maxPlayers);
    expect(isBotFillEnabled(DEFAULT_SETTINGS)).toBe(false);
  });

  it("returns 3 for lobby_3 test mode", () => {
    expect(
      getBotFillTargetCount({
        ...DEFAULT_SETTINGS,
        botTestLobbyMode: "lobby_3",
      })
    ).toBe(3);
  });

  it("returns 7 for lobby_7 test mode", () => {
    expect(
      getBotFillTargetCount({
        ...DEFAULT_SETTINGS,
        botTestLobbyMode: "lobby_7",
      })
    ).toBe(7);
  });

  it("returns maxPlayers for lobby_full test mode", () => {
    expect(
      getBotFillTargetCount({
        ...DEFAULT_SETTINGS,
        botTestLobbyMode: "lobby_full",
        maxPlayers: 8,
      })
    ).toBe(8);
  });
});

describe("fillsLobbyImmediately", () => {
  it("is true for lobby test modes", () => {
    expect(
      fillsLobbyImmediately({
        ...DEFAULT_SETTINGS,
        botTestLobbyMode: "lobby_full",
      })
    ).toBe(true);
    expect(
      fillsLobbyImmediately({
        ...DEFAULT_SETTINGS,
        botTestLobbyMode: "max",
      })
    ).toBe(false);
    expect(
      fillsLobbyImmediately({
        ...DEFAULT_SETTINGS,
        botTestLobbyMode: "off",
      })
    ).toBe(false);
  });
});
