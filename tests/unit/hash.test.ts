import { describe, expect, it } from "vitest";
import { canonicalJson, hashBody } from "@/server/lib/hash";

describe("canonicalJson / hashBody", () => {
  it("ignores key order at every level", () => {
    const a = { slot_id: "s1", name: "Ada", meta: { b: 1, a: [2, { y: 1, x: 2 }] } };
    const b = { meta: { a: [2, { x: 2, y: 1 }], b: 1 }, name: "Ada", slot_id: "s1" };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(hashBody(a)).toBe(hashBody(b));
  });

  it("distinguishes different values", () => {
    expect(hashBody({ name: "Ada" })).not.toBe(hashBody({ name: "Ada " }));
    expect(hashBody({ n: 1 })).not.toBe(hashBody({ n: "1" }));
  });

  it("keeps array order significant", () => {
    expect(hashBody([1, 2])).not.toBe(hashBody([2, 1]));
  });

  it("produces valid JSON", () => {
    const value = { z: null, a: ["x", true, 1.5], q: 'say "hi"' };
    expect(JSON.parse(canonicalJson(value))).toEqual(value);
  });
});
