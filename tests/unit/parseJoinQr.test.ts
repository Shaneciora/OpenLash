import { describe, it, expect } from "vitest";
import { parseRoomCodeFromJoinQr } from "../../src/shared/parseJoinQr";

describe("parseRoomCodeFromJoinQr", () => {
  it("extracts a room code from a join URL", () => {
    expect(parseRoomCodeFromJoinQr("http://192.168.1.50:3000/play/ABCD")).toBe("ABCD");
    expect(parseRoomCodeFromJoinQr("https://abc.ngrok-free.app/play/WXYZ")).toBe("WXYZ");
  });

  it("handles trailing slashes and query strings", () => {
    expect(parseRoomCodeFromJoinQr("http://192.168.1.50:3000/play/ABCD/")).toBe("ABCD");
    expect(parseRoomCodeFromJoinQr("https://example.com/play/ABCD?e2e=1")).toBe("ABCD");
  });

  it("accepts a raw room code", () => {
    expect(parseRoomCodeFromJoinQr("ab23")).toBe("AB23");
  });

  it("rejects invalid values", () => {
    expect(parseRoomCodeFromJoinQr("")).toBeNull();
    expect(parseRoomCodeFromJoinQr("http://example.com/play/IO01")).toBeNull();
    expect(parseRoomCodeFromJoinQr("http://example.com/other/ABCD")).toBeNull();
    expect(parseRoomCodeFromJoinQr("not-a-code")).toBeNull();
  });
});
