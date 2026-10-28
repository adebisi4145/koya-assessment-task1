import { createHash } from "node:crypto";

/** JSON with object keys sorted at every level, so equal values serialise identically. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Fingerprint of a request body: same JSON content, same hash, regardless of key order. */
export function hashBody(body: unknown): string {
  return createHash("sha256").update(canonicalJson(body)).digest("hex");
}
