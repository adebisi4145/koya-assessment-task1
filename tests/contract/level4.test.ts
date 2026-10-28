import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { api, futureSlot, reset, uniqueEmail } from "./client";

const listFor = (email: string, query = "") =>
  api("GET", `/bookings?email=${encodeURIComponent(email)}${query}`);

describe("Level 4: idempotent retries", () => {
  beforeEach(async () => {
    await reset([futureSlot("s1", 24), futureSlot("s2", 25)]);
  });

  const post = (key: string, body: Record<string, unknown>) =>
    api("POST", "/bookings", { body, headers: { "Idempotency-Key": key } });

  it("the same key and body returns the same response and creates one booking", async () => {
    const key = randomUUID();
    const body = { slot_id: "s1", name: "Ada Obi", email: uniqueEmail() };

    const first = await post(key, body);
    const retry = await post(key, body);
    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(retry.body).toEqual(first.body);

    const list = await listFor(body.email);
    expect(list.body.bookings).toHaveLength(1);
  });

  it("key order in the body doesn't make it a different body", async () => {
    const key = randomUUID();
    const email = uniqueEmail();
    const first = await post(key, { slot_id: "s1", name: "Ada", email });
    const retry = await post(key, { email, name: "Ada", slot_id: "s1" });
    expect(retry.status).toBe(201);
    expect(retry.body.id).toBe(first.body.id);
  });

  it("10 simultaneous retries with one key create exactly one booking", async () => {
    const key = randomUUID();
    const body = { slot_id: "s1", name: "Ada Obi", email: uniqueEmail() };
    const results = await Promise.all(Array.from({ length: 10 }, () => post(key, body)));

    expect(new Set(results.map((r) => r.status))).toEqual(new Set([201]));
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    expect((await listFor(body.email)).body.bookings).toHaveLength(1);
  });

  it("the same key with a different body returns 422 and books nothing", async () => {
    const key = randomUUID();
    const email = uniqueEmail();
    await post(key, { slot_id: "s1", name: "Ada", email });

    const other = await post(key, { slot_id: "s2", name: "Ada", email });
    expect(other.status).toBe(422);
    expect(typeof other.body.error).toBe("string");

    const slots = await api("GET", "/slots");
    expect(slots.body.slots.find((s: { id: string }) => s.id === "s2").available).toBe(true);
  });

  it("an error outcome is replayed too (same status for the same key)", async () => {
    const key = randomUUID();
    const body = { slot_id: "missing", name: "Ada", email: uniqueEmail() };
    expect((await post(key, body)).status).toBe(404);
    expect((await post(key, body)).status).toBe(404);
  });

  it("a replay still returns the original booking after the slot is taken", async () => {
    const key = randomUUID();
    const body = { slot_id: "s1", name: "Ada", email: uniqueEmail() };
    const first = await post(key, body);
    await api("DELETE", `/bookings/${first.body.id}`);
    await api("POST", "/bookings", { body: { ...body, email: uniqueEmail() } });

    const retry = await post(key, body);
    expect(retry.status).toBe(201);
    expect(retry.body.id).toBe(first.body.id);
  });

  it("different keys are independent", async () => {
    const email = uniqueEmail();
    const a = await post(randomUUID(), { slot_id: "s1", name: "Ada", email });
    const b = await post(randomUUID(), { slot_id: "s1", name: "Ada", email });
    expect(a.status).toBe(201);
    expect(b.status).toBe(409);
  });

  it("requests without a key are not deduplicated", async () => {
    const email = uniqueEmail();
    const body = { slot_id: "s1", name: "Ada", email };
    expect((await api("POST", "/bookings", { body })).status).toBe(201);
    expect((await api("POST", "/bookings", { body })).status).toBe(409);
  });
});

describe("Level 4: GET /bookings pagination", () => {
  const email = uniqueEmail("pager");
  const TOTAL = 23;

  beforeEach(async () => {
    await reset(Array.from({ length: TOTAL + 1 }, (_, i) => futureSlot(`p${i}`, 24 + i)));
    // Sequential so creation order is deterministic; one booking goes to someone else.
    for (let i = 0; i < TOTAL; i++) {
      const res = await api("POST", "/bookings", {
        body: { slot_id: `p${i}`, name: "Pat", email: i % 2 ? email.toUpperCase() : email },
        headers: { "Idempotency-Key": randomUUID() },
      });
      expect(res.status).toBe(201);
    }
    await api("POST", "/bookings", {
      body: { slot_id: `p${TOTAL}`, name: "Other", email: uniqueEmail() },
    });
  });

  it("pages through all bookings oldest first, ending with next_cursor null", async () => {
    const seen: string[] = [];
    const sizes: number[] = [];
    let cursor: string | null = null;
    do {
      const res = await listFor(email, `&limit=10${cursor ? `&cursor=${cursor}` : ""}`);
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(["bookings", "next_cursor"]);
      sizes.push(res.body.bookings.length);
      seen.push(...res.body.bookings.map((b: { slot_id: string }) => b.slot_id));
      cursor = res.body.next_cursor;
    } while (cursor);

    expect(sizes).toEqual([10, 10, 3]);
    expect(seen).toEqual(Array.from({ length: TOTAL }, (_, i) => `p${i}`));
  });

  it("defaults to 10 per page", async () => {
    const res = await listFor(email);
    expect(res.body.bookings).toHaveLength(10);
    expect(typeof res.body.next_cursor).toBe("string");
  });

  it("an exact final page has next_cursor null", async () => {
    const res = await listFor(email, "&limit=23");
    expect(res.body.bookings).toHaveLength(23);
    expect(res.body.next_cursor).toBeNull();
  });

  it("matches the email ignoring case", async () => {
    const res = await listFor(`  ${email.toUpperCase()} `, "&limit=50");
    expect(res.body.bookings).toHaveLength(TOTAL);
    expect(new Set(res.body.bookings.map((b: { email: string }) => b.email))).toEqual(
      new Set([email]),
    );
  });

  it("includes cancelled bookings", async () => {
    const first = (await listFor(email, "&limit=1")).body.bookings[0];
    await api("DELETE", `/bookings/${first.id}`);
    const again = (await listFor(email, "&limit=1")).body.bookings[0];
    expect(again).toEqual({ ...first, status: "cancelled" });
  });

  it("returns an empty page for an email with no bookings", async () => {
    const res = await listFor(uniqueEmail("nobody"));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ bookings: [], next_cursor: null });
  });

  it.each(["0", "51", "-1", "abc", "1.5", "", "10abc"])("400 for limit=%j", async (limit) => {
    const res = await listFor(email, `&limit=${limit}`);
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe("string");
  });

  it.each(["1", "50"])("accepts limit=%s", async (limit) => {
    expect((await listFor(email, `&limit=${limit}`)).status).toBe(200);
  });

  it("400 when email is missing", async () => {
    expect((await api("GET", "/bookings")).status).toBe(400);
  });

  it("400 for a malformed cursor", async () => {
    expect((await listFor(email, "&cursor=not-a-cursor")).status).toBe(400);
  });
});
