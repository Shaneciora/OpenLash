import { afterEach, describe, it, expect, vi } from "vitest";
import { resolvePlayJoinBase } from "../../src/server/joinBase.js";
import * as ngrok from "../../src/server/ngrok.js";

describe("joinBase", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("prefers ngrok over LAN when a public tunnel is available", async () => {
    vi.spyOn(ngrok, "getNgrokPlayBase").mockResolvedValue("https://abc.ngrok-free.app/play");
    const result = await resolvePlayJoinBase("192.168.1.50:3000", 3000);
    expect(result).toEqual({
      playBase: "https://abc.ngrok-free.app/play",
      source: "public",
    });
  });

  it("falls back to LAN when ngrok is unavailable", async () => {
    vi.spyOn(ngrok, "getNgrokPlayBase").mockResolvedValue(null);
    const result = await resolvePlayJoinBase("192.168.1.50:3000", 3000);
    expect(result).toEqual({
      playBase: "http://192.168.1.50:3000/play",
      source: "lan",
    });
  });

  it("uses PUBLIC_URL when set manually", async () => {
    vi.stubEnv("PUBLIC_URL", "https://custom.example.com");
    vi.spyOn(ngrok, "getNgrokPlayBase").mockResolvedValue("https://abc.ngrok-free.app/play");
    const result = await resolvePlayJoinBase("localhost:3000", 3000);
    expect(result).toEqual({
      playBase: "https://custom.example.com/play",
      source: "public",
    });
  });
});
