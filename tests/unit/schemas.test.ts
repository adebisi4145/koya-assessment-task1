import { describe, expect, it } from "vitest";
import { AppError } from "@/server/errors";
import { ListBookingsQuery, NewBooking, parseOrThrow, ResetBody } from "@/server/schemas";

function errorOf(fn: () => unknown): AppError {
  try {
    fn();
  } catch (err) {
    if (err instanceof AppError) return err;
    throw err;
  }
  throw new Error("expected an AppError");
}

describe("NewBooking", () => {
  const valid = { slot_id: "s1", name: "Ada Obi", email: "ada@example.com" };

  it("trims name and email and lower-cases the email", () => {
    expect(
      parseOrThrow(NewBooking, { slot_id: " s1 ", name: "  Ada ", email: " ADA@Example.com " }),
    ).toEqual({ slot_id: "s1", name: "Ada", email: "ada@example.com" });
  });

  it("names the missing field", () => {
    const err = errorOf(() => parseOrThrow(NewBooking, { ...valid, name: undefined }));
    expect(err.status).toBe(400);
    expect(err.message).toBe("name is required");
  });

  it("treats whitespace-only as missing", () => {
    expect(errorOf(() => parseOrThrow(NewBooking, { ...valid, email: "  " })).message).toBe(
      "email is required",
    );
  });

  it("distinguishes a wrong type from a missing field", () => {
    expect(errorOf(() => parseOrThrow(NewBooking, { ...valid, slot_id: 7 })).message).toBe(
      "slot_id must be a string",
    );
  });

  it.each(["plainaddress", "a@b", "a b@c.com", "a@b .com", "@b.com"])(
    "rejects %j as an email",
    (email) => {
      expect(errorOf(() => parseOrThrow(NewBooking, { ...valid, email })).message).toBe(
        "email is invalid",
      );
    },
  );

  it.each(["a@b.co", "first.last+tag@sub.example.org"])("accepts %j", (email) => {
    expect(parseOrThrow(NewBooking, { ...valid, email }).email).toBe(email);
  });

  it("caps field lengths", () => {
    expect(
      errorOf(() => parseOrThrow(NewBooking, { ...valid, name: "x".repeat(201) })).message,
    ).toBe("name is too long");
  });
});

describe("ListBookingsQuery", () => {
  it("defaults limit to 10 and lower-cases the email", () => {
    expect(parseOrThrow(ListBookingsQuery, { email: " Ada@Example.com " })).toEqual({
      email: "ada@example.com",
      limit: 10,
    });
  });

  it.each(["1", "50"])("accepts limit %s", (limit) => {
    expect(parseOrThrow(ListBookingsQuery, { email: "a@b.co", limit }).limit).toBe(Number(limit));
  });

  it.each(["0", "51", "-1", "1.5", "abc", "", " 5"])("rejects limit %j", (limit) => {
    expect(errorOf(() => parseOrThrow(ListBookingsQuery, { email: "a@b.co", limit })).message).toBe(
      "limit must be an integer between 1 and 50",
    );
  });
});

describe("ResetBody", () => {
  const slot = {
    id: "s1",
    provider: "Dr Ade",
    start: "2026-12-10T09:00:00Z",
    end: "2026-12-10T09:30:00Z",
  };

  it("accepts UTC and offset date-times", () => {
    const offset = {
      ...slot,
      id: "s2",
      start: "2026-12-10T10:00:00+01:00",
      end: "2026-12-10T10:30:00+01:00",
    };
    expect(parseOrThrow(ResetBody, { slots: [slot, offset] }).slots).toHaveLength(2);
  });

  it("accepts an empty slot list", () => {
    expect(parseOrThrow(ResetBody, { slots: [] }).slots).toEqual([]);
  });

  it("rejects end before start", () => {
    expect(
      errorOf(() => parseOrThrow(ResetBody, { slots: [{ ...slot, end: "2026-12-10T08:00:00Z" }] }))
        .message,
    ).toBe("end must be after start");
  });

  it("rejects duplicate ids", () => {
    expect(errorOf(() => parseOrThrow(ResetBody, { slots: [slot, slot] })).message).toBe(
      "slot ids must be unique",
    );
  });
});
