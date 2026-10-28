import { beforeEach, describe, expect, it } from "vitest";
import { api, futureSlot, isoFromNow, reset, uniqueEmail } from "./client";

// Every route must reject requests without a valid key (later levels add their routes here).
const ROUTES: Array<[method: string, path: string]> = [
  ["POST", "/reset"],
  ["GET", "/slots"],
  ["POST", "/bookings"],
  ["GET", "/bookings/00000000-0000-0000-0000-000000000000"],
  ["DELETE", "/bookings/00000000-0000-0000-0000-000000000000"],
];

const bodyFor = (method: string) => (method === "POST" ? {} : undefined);

describe("Level 2: API key and input validation", () => {
  beforeEach(async () => {
    await reset([
      futureSlot("s1", 24),
      { id: "past", provider: "Dr Ade", start: isoFromNow(-60), end: isoFromNow(-30) },
      { id: "ongoing", provider: "Dr Ade", start: isoFromNow(-10), end: isoFromNow(20) },
    ]);
  });

  describe("API key", () => {
    it.each(ROUTES)("%s %s returns 401 without a key", async (method, path) => {
      const res = await api(method, path, { apiKey: null, body: bodyFor(method) });
      expect(res.status).toBe(401);
      expect(typeof res.body.error).toBe("string");
    });

    it.each(ROUTES)("%s %s returns 401 with a wrong key", async (method, path) => {
      const res = await api(method, path, { apiKey: "wrong-key", body: bodyFor(method) });
      expect(res.status).toBe(401);
    });

    it("a rejected request has no side effects", async () => {
      await api("POST", "/reset", { apiKey: "wrong-key", body: { slots: [] } });
      const slots = await api("GET", "/slots");
      expect(slots.body.slots).toHaveLength(3);
    });
  });

  describe("POST /bookings validation", () => {
    const valid = () => ({ slot_id: "s1", name: "Ada Obi", email: uniqueEmail() });

    it.each([
      ["slot_id missing", { slot_id: undefined }],
      ["name missing", { name: undefined }],
      ["email missing", { email: undefined }],
      ["slot_id empty", { slot_id: "" }],
      ["name empty", { name: "" }],
      ["email empty", { email: "" }],
      ["name only spaces", { name: "   " }],
      ["email only spaces", { email: "   " }],
      ["name not a string", { name: 42 }],
      ["email not a string", { email: ["a@b.co"] }],
    ])("400 when %s", async (_label, override) => {
      const res = await api("POST", "/bookings", { body: { ...valid(), ...override } });
      expect(res.status).toBe(400);
      expect(typeof res.body.error).toBe("string");
    });

    it.each(["not-an-email", "a@b", "@example.com", "ada@", "ada obi@example.com", "a@@b.com"])(
      "400 for invalid email %j",
      async (email) => {
        const res = await api("POST", "/bookings", { body: { ...valid(), email } });
        expect(res.status).toBe(400);
      },
    );

    it("400 for a body that isn't JSON", async () => {
      const res = await api("POST", "/bookings", {
        rawBody: "{not json",
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(400);
    });

    it("400 for a JSON body that isn't an object", async () => {
      const res = await api("POST", "/bookings", { body: ["s1"] });
      expect(res.status).toBe(400);
    });

    it("404 when the slot doesn't exist", async () => {
      const res = await api("POST", "/bookings", { body: { ...valid(), slot_id: "nope" } });
      expect(res.status).toBe(404);
      expect(typeof res.body.error).toBe("string");
    });

    it.each(["past", "ongoing"])("400 when the slot has already started (%s)", async (slot_id) => {
      const res = await api("POST", "/bookings", { body: { ...valid(), slot_id } });
      expect(res.status).toBe(400);
    });

    it("trims name and email, and stores email in lower case", async () => {
      const res = await api("POST", "/bookings", {
        body: { slot_id: "s1", name: "  Ada Obi  ", email: "  Ada.Obi@Example.COM " },
      });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("Ada Obi");
      expect(res.body.email).toBe("ada.obi@example.com");

      const fetched = await api("GET", `/bookings/${res.body.id}`);
      expect(fetched.body.email).toBe("ada.obi@example.com");
    });
  });

  describe("POST /reset validation", () => {
    it.each([
      ["slots missing", {}],
      ["slots not an array", { slots: "s1" }],
      ["slot missing a field", { slots: [{ id: "x", provider: "Dr Ade", start: isoFromNow(60) }] }],
      [
        "bad date",
        { slots: [{ id: "x", provider: "Dr Ade", start: "tomorrow", end: isoFromNow(90) }] },
      ],
      ["duplicate ids", { slots: [futureSlot("dup", 1), futureSlot("dup", 2)] }],
    ])("400 when %s, and existing slots are untouched", async (_label, body) => {
      const res = await api("POST", "/reset", { body });
      expect(res.status).toBe(400);
      const slots = await api("GET", "/slots");
      expect(slots.body.slots).toHaveLength(3);
    });
  });
});
