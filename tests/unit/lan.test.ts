import { afterEach, describe, it, expect, vi } from "vitest";
import os from "os";
import {
  isUnreachableHostIp,
  buildJoinUrlFromRequest,
  getLanIp,
} from "../../src/server/lan.js";

describe("lan", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  it("flags docker bridge and localhost as unreachable", () => {
    expect(isUnreachableHostIp("172.19.0.2")).toBe(true);
    expect(isUnreachableHostIp("localhost")).toBe(true);
    expect(isUnreachableHostIp("127.0.0.1")).toBe(true);
    expect(isUnreachableHostIp("192.168.1.103")).toBe(false);
  });

  it("uses client Host header for join URL", () => {
    expect(buildJoinUrlFromRequest("192.168.1.103:3000", 3000)).toBe(
      "http://192.168.1.103:3000/play"
    );
  });

  it("ignores localhost Host header", () => {
    const url = buildJoinUrlFromRequest("localhost:3000", 3000);
    expect(url === null || !url.includes("localhost")).toBe(true);
  });

  it("ignores docker internal Host header", () => {
    const url = buildJoinUrlFromRequest("172.19.0.2:3000", 3000);
    expect(url === null || !url.includes("172.19.0.2")).toBe(true);
  });

  it("prefers request Host header over PUBLIC_HOST", () => {
    vi.stubEnv("PUBLIC_HOST", "192.168.1.103");
    expect(buildJoinUrlFromRequest("10.0.0.55:3000", 3000)).toBe(
      "http://10.0.0.55:3000/play"
    );
  });

  it("prefers detected interfaces over PUBLIC_HOST", () => {
    vi.stubEnv("PUBLIC_HOST", "192.168.1.103");
    vi.spyOn(os, "networkInterfaces").mockReturnValue({
      en0: [{ family: "IPv4", internal: false, address: "10.0.0.55" } as os.NetworkInterfaceInfo],
    });
    expect(getLanIp()).toBe("10.0.0.55");
  });
});
