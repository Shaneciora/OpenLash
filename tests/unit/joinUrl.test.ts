import { describe, it, expect } from "vitest";
import {
  buildPhonePlayBase,
  isUsableJoinHostname,
  pickPhoneJoinIp,
} from "../../src/shared/joinUrl";

describe("joinUrl", () => {
  it("rejects localhost and docker bridge IPs", () => {
    expect(isUsableJoinHostname("localhost")).toBe(false);
    expect(isUsableJoinHostname("127.0.0.1")).toBe(false);
    expect(isUsableJoinHostname("172.19.0.2")).toBe(false);
    expect(isUsableJoinHostname("192.168.1.50")).toBe(true);
    expect(isUsableJoinHostname("10.0.0.55")).toBe(true);
  });

  it("prefers home LAN IPs for phone join", () => {
    expect(pickPhoneJoinIp(["10.0.0.55", "192.168.1.50"])).toBe("192.168.1.50");
    expect(pickPhoneJoinIp(["10.0.0.55", "10.0.0.12"])).toBe("10.0.0.55");
    expect(pickPhoneJoinIp(["172.19.0.2", "192.168.1.50"])).toBe("192.168.1.50");
  });

  it("builds the play URL phones should open", () => {
    expect(buildPhonePlayBase("192.168.1.50", 3000)).toBe("http://192.168.1.50:3000/play");
    expect(buildPhonePlayBase("localhost", 3000)).toBeNull();
  });
});
