import { beforeEach, describe, expect, it } from "vitest";
import { api, book, futureSlot, reset, uniqueEmail } from "./client";

const statusCounts = (statuses: number[]) =>
  statuses.reduce<Record<number, number>>((acc, s) => ({ ...acc, [s]: (acc[s] ?? 0) + 1 }), {});

describe("Level 3: no double booking, cancellation", () => {
  beforeEach(async () => {
    await reset([futureSlot("s1", 24), futureSlot("s2", 25)]);
  });

  it("a slot with a confirmed booking returns 409", async () => {
    expect((await book("s1")).status).toBe(201);
    const second = await book("s1");
    expect(second.status).toBe(409);
    expect(typeof second.body.error).toBe("string");
  });

  it("25 simultaneous bookings for one slot produce exactly one 201", async () => {
    const results = await Promise.all(
      Array.from({ length: 25 }, (_, i) => book("s1", uniqueEmail(`racer${i}`))),
    );
    expect(statusCounts(results.map((r) => r.status))).toEqual({ 201: 1, 409: 24 });

    const slots = await api("GET", "/slots");
    expect(slots.body.slots.find((s: { id: string }) => s.id === "s1").available).toBe(false);
  });

  it("concurrent bookings for different slots all succeed", async () => {
    const [a, b] = await Promise.all([book("s1"), book("s2")]);
    expect([a.status, b.status]).toEqual([201, 201]);
  });

  it("DELETE /bookings/{id} cancels the booking and frees the slot", async () => {
    const created = await book("s1");
    const res = await api("DELETE", `/bookings/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ...created.body, status: "cancelled" });

    const fetched = await api("GET", `/bookings/${created.body.id}`);
    expect(fetched.body.status).toBe("cancelled");

    const slots = await api("GET", "/slots");
    expect(slots.body.slots.find((s: { id: string }) => s.id === "s1").available).toBe(true);

    const rebooked = await book("s1");
    expect(rebooked.status).toBe(201);
    expect(rebooked.body.id).not.toBe(created.body.id);
  });

  it("cancelling twice returns 409", async () => {
    const created = await book("s1");
    await api("DELETE", `/bookings/${created.body.id}`);
    const again = await api("DELETE", `/bookings/${created.body.id}`);
    expect(again.status).toBe(409);
    expect(typeof again.body.error).toBe("string");
  });

  it("simultaneous cancels: exactly one succeeds", async () => {
    const created = await book("s1");
    const results = await Promise.all(
      Array.from({ length: 10 }, () => api("DELETE", `/bookings/${created.body.id}`)),
    );
    expect(statusCounts(results.map((r) => r.status))).toEqual({ 200: 1, 409: 9 });
  });

  it.each(["00000000-0000-0000-0000-000000000000", "not-a-uuid"])(
    "cancelling unknown booking %s returns 404",
    async (id) => {
      const res = await api("DELETE", `/bookings/${id}`);
      expect(res.status).toBe(404);
    },
  );
});
