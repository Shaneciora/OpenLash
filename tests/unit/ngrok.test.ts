import { afterEach, describe, it, expect, vi } from "vitest";
import { clearNgrokCache, getNgrokPlayBase } from "../../src/server/ngrok.js";

describe("ngrok", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    clearNgrokCache();
    vi.restoreAllMocks();
  });

  it("returns null when NGROK_API_URL is not set", async () => {
    expect(await getNgrokPlayBase()).toBeNull();
  });

  it("reads the https tunnel from the ngrok agent API", async () => {
    vi.stubEnv("NGROK_API_URL", "http://ngrok:4040");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          tunnels: [
            { public_url: "http://abc.ngrok-free.app", proto: "http" },
            { public_url: "https://abc.ngrok-free.app", proto: "https" },
          ],
        }),
        { status: 200 }
      )
    );

    expect(await getNgrokPlayBase()).toBe("https://abc.ngrok-free.app/play");
  });

  it("caches the tunnel URL between lookups", async () => {
    vi.stubEnv("NGROK_API_URL", "http://ngrok:4040");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          tunnels: [{ public_url: "https://cached.ngrok-free.app", proto: "https" }],
        }),
        { status: 200 }
      )
    );

    expect(await getNgrokPlayBase()).toBe("https://cached.ngrok-free.app/play");
    expect(await getNgrokPlayBase()).toBe("https://cached.ngrok-free.app/play");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
