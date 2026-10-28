import { describe, expect, it } from "vitest";
import { rateLimitKey, retryAfterSeconds } from "@/server/lib/rate-limit";

describe("retryAfterSeconds", () => {
  const oldest = new Date("2026-10-28T10:00:00.000Z");
  const at = (iso: string) => new Date(iso);

  it("counts down to when the oldest attempt leaves the 60s window", () => {
    expect(retryAfterSeconds(oldest, at("2026-10-28T10:00:00.000Z"))).toBe(60);
    expect(retryAfterSeconds(oldest, at("2026-10-28T10:00:45.000Z"))).toBe(15);
  });

  it("rounds partial seconds up so waiting that long is enough", () => {
    expect(retryAfterSeconds(oldest, at("2026-10-28T10:00:45.001Z"))).toBe(15);
    expect(retryAfterSeconds(oldest, at("2026-10-28T10:00:44.999Z"))).toBe(16);
  });

  it("never returns less than 1", () => {
    expect(retryAfterSeconds(oldest, at("2026-10-28T10:00:59.999Z"))).toBe(1);
    expect(retryAfterSeconds(oldest, at("2026-10-28T10:01:05.000Z"))).toBe(1);
  });
});

describe("rateLimitKey", () => {
  it("normalises like the stored email", () => {
    expect(rateLimitKey("  Ada@Example.COM ")).toBe("ada@example.com");
  });

  it.each([undefined, null, 42, "", "   ", ["a@b.co"]])("has no bucket for %j", (email) => {
    expect(rateLimitKey(email)).toBeNull();
  });
});
