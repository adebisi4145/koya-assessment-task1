import { beforeEach, describe, expect, it } from "vitest";
import { api, book, futureSlot, isoFromNow, reset, uniqueEmail } from "./client";

describe("Level 1: list slots, book one, look up a booking", () => {
  beforeEach(async () => {
    await reset([
      futureSlot("late", 48, "Dr Bello"),
      futureSlot("early", 24, "Dr Ade"),
      futureSlot("middle", 36, "Dr Ade"),
    ]);
  });

  it("POST /reset replaces all slots, including slots in the past", async () => {
    const past = { id: "past", provider: "Dr Ade", start: isoFromNow(-120), end: isoFromNow(-90) };
    const res = await api("POST", "/reset", { body: { slots: [past] } });
    expect(res.status).toBe(200);

    const slots = await api("GET", "/slots");
    expect(slots.body.slots).toEqual([{ ...past, available: true }]);
  });

  it("GET /slots lists every slot, earliest start first, echoing times exactly", async () => {
    const res = await api("GET", "/slots");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.body.slots.map((s: { id: string }) => s.id)).toEqual(["early", "middle", "late"]);

    const early = res.body.slots[0];
    expect(Object.keys(early).sort()).toEqual(["available", "end", "id", "provider", "start"]);
    expect(early.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(early.available).toBe(true);
  });

  it("GET /slots?provider= filters by exact provider name", async () => {
    const res = await api("GET", "/slots?provider=Dr%20Ade");
    expect(res.body.slots.map((s: { id: string }) => s.id)).toEqual(["early", "middle"]);

    const none = await api("GET", "/slots?provider=dr%20ade");
    expect(none.body.slots).toEqual([]);
  });

  it("POST /bookings returns 201 with a confirmed booking", async () => {
    const email = uniqueEmail();
    const res = await book("early", email, "Ada Obi");
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      slot_id: "early",
      name: "Ada Obi",
      email,
      status: "confirmed",
    });
    expect(typeof res.body.id).toBe("string");
    expect(Number.isNaN(Date.parse(res.body.created_at))).toBe(false);
  });

  it("a booked slot is no longer available", async () => {
    await book("middle");
    const res = await api("GET", "/slots");
    const bySlot = Object.fromEntries(
      res.body.slots.map((s: { id: string; available: boolean }) => [s.id, s.available]),
    );
    expect(bySlot).toEqual({ early: true, middle: false, late: true });
  });

  it("GET /bookings/{id} returns the booking", async () => {
    const created = await book("late");
    const res = await api("GET", `/bookings/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(created.body);
  });

  it("GET /bookings/{id} returns 404 for an unknown id", async () => {
    for (const id of ["00000000-0000-0000-0000-000000000000", "not-a-uuid"]) {
      const res = await api("GET", `/bookings/${id}`);
      expect(res.status).toBe(404);
      expect(typeof res.body.error).toBe("string");
    }
  });

  it("unknown paths return a JSON 404", async () => {
    const res = await api("GET", "/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "not found" });
  });
});
