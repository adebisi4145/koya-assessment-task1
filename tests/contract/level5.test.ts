import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { api, type ApiResponse, futureSlot, reset, uniqueEmail } from "./client";

const attempt = (email: string, slot_id = "s1", headers?: Record<string, string>) =>
  api("POST", "/bookings", { body: { slot_id, name: "Ada", email }, headers });

function expectRateLimited(res: ApiResponse) {
  expect(res.status).toBe(429);
  expect(typeof res.body.error).toBe("string");
  const retryAfter = res.headers.get("retry-after");
  expect(retryAfter).toMatch(/^\d+$/);
  expect(Number(retryAfter)).toBeGreaterThanOrEqual(1);
  expect(Number(retryAfter)).toBeLessThanOrEqual(60);
}

describe("Level 5: at most 5 booking attempts per email per minute", () => {
  beforeEach(async () => {
    await reset(Array.from({ length: 8 }, (_, i) => futureSlot(`s${i + 1}`, 24 + i)));
  });

  it("the 6th attempt returns 429 with Retry-After; failed attempts count", async () => {
    const email = uniqueEmail();
    const statuses = [
      (await attempt(email, "s1")).status, // 201
      (await attempt(email, "s1")).status, // 409: already booked
      (await attempt(email, "missing")).status, // 404
      (await attempt(email, "s2")).status, // 201
      (await api("POST", "/bookings", { body: { slot_id: "s3", name: "", email } })).status, // 400
    ];
    expect(statuses).toEqual([201, 409, 404, 201, 400]);

    expectRateLimited(await attempt(email, "s4"));
  });

  it("a rate-limited attempt books nothing", async () => {
    const email = uniqueEmail();
    for (let i = 0; i < 5; i++) await attempt(email, "missing");
    expectRateLimited(await attempt(email, "s1"));

    const slots = await api("GET", "/slots");
    expect(slots.body.slots.find((s: { id: string }) => s.id === "s1").available).toBe(true);
  });

  it("other emails aren't affected", async () => {
    const spammer = uniqueEmail("spam");
    for (let i = 0; i < 6; i++) await attempt(spammer, "missing");
    expectRateLimited(await attempt(spammer, "s1"));

    expect((await attempt(uniqueEmail("innocent"), "s1")).status).toBe(201);
  });

  it("the limit is per email regardless of case or surrounding spaces", async () => {
    const email = uniqueEmail();
    const variants = [email, email.toUpperCase(), ` ${email} `, email, email.toUpperCase()];
    for (const v of variants) await attempt(v, "missing");
    expectRateLimited(await attempt(email, "s1"));
  });

  it("a burst of 12 simultaneous attempts lets exactly 5 through", async () => {
    const email = uniqueEmail();
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => attempt(email, `s${(i % 8) + 1}`)),
    );
    const limited = results.filter((r) => r.status === 429);
    expect(limited).toHaveLength(7);
    limited.forEach(expectRateLimited);
  });

  it("replaying an idempotent request is not a new attempt", async () => {
    const email = uniqueEmail();
    const key = randomUUID();
    const first = await attempt(email, "s1", { "Idempotency-Key": key });
    for (let i = 0; i < 4; i++) await attempt(email, "missing");

    // The window is full, but a retry of an earlier request still gets its stored answer.
    const replay = await attempt(email, "s1", { "Idempotency-Key": key });
    expect(replay.status).toBe(201);
    expect(replay.body.id).toBe(first.body.id);

    expectRateLimited(await attempt(email, "s2"));
  });

  it("a 429 is not stored against an Idempotency-Key", async () => {
    const email = uniqueEmail();
    for (let i = 0; i < 5; i++) await attempt(email, "missing");
    const key = randomUUID();
    expectRateLimited(await attempt(email, "s1", { "Idempotency-Key": key }));
    // Same key, same body, still limited: it is being evaluated afresh, not replayed.
    // (Once the window frees, this retry will be allowed to book.)
    expectRateLimited(await attempt(email, "s1", { "Idempotency-Key": key }));
  });

  it("POST /reset clears the rate-limit window", async () => {
    const email = uniqueEmail();
    for (let i = 0; i < 5; i++) await attempt(email, "missing");
    expectRateLimited(await attempt(email, "s1"));

    await reset([futureSlot("s1", 24)]);
    expect((await attempt(email, "s1")).status).toBe(201);
  });
});
