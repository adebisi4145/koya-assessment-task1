import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "@/server/lib/cursor";

describe("pagination cursor", () => {
  it("round-trips a seq", () => {
    expect(decodeCursor(encodeCursor("42"))).toBe("42");
    expect(decodeCursor(encodeCursor("9007199254740993"))).toBe("9007199254740993");
  });

  it("is URL-safe", () => {
    expect(encodeCursor("123456789")).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    "",
    "garbage",
    "!!!",
    Buffer.from("v1:abc").toString("base64url"),
    Buffer.from("v2:5").toString("base64url"),
    Buffer.from("v1:-1").toString("base64url"),
  ])("rejects malformed cursor %j", (cursor) => {
    expect(decodeCursor(cursor)).toBeNull();
  });
});
