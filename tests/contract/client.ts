import { randomUUID } from "node:crypto";

export interface ApiResponse<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

interface RequestOptions {
  body?: unknown;
  /** Raw request body, sent as-is (for malformed-JSON tests). */
  rawBody?: string;
  headers?: Record<string, string>;
  /** API key to send; `null` omits the header. Defaults to the configured key. */
  apiKey?: string | null;
}

export async function api<T = any>(
  method: string,
  path: string,
  opts: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { ...opts.headers };
  const apiKey = opts.apiKey === undefined ? process.env.API_KEY : opts.apiKey;
  if (apiKey !== null && apiKey !== undefined) headers["X-API-Key"] = apiKey;

  let body: string | undefined = opts.rawBody;
  if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(new URL(path, process.env.API_URL), { method, headers, body });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // leave non-JSON bodies as text so assertions can show them
  }
  return { status: res.status, body: parsed as T, headers: res.headers };
}

/** An ISO timestamp `minutes` from now (negative for the past), whole seconds, `Z` suffix. */
export function isoFromNow(minutes: number): string {
  const d = new Date(Date.now() + minutes * 60_000);
  d.setUTCMilliseconds(0);
  return d.toISOString().replace(".000Z", "Z");
}

export interface SlotInput {
  id: string;
  provider: string;
  start: string;
  end: string;
}

/** A future 30-minute slot starting `hours` from now. */
export function futureSlot(id: string, hours: number, provider = "Dr Ade"): SlotInput {
  return { id, provider, start: isoFromNow(hours * 60), end: isoFromNow(hours * 60 + 30) };
}

export async function reset(slots: SlotInput[]): Promise<void> {
  const res = await api("POST", "/reset", { body: { slots } });
  if (res.status !== 200)
    throw new Error(`reset failed: ${res.status} ${JSON.stringify(res.body)}`);
}

/** A fresh email per test keeps the per-email rate limit out of unrelated tests. */
export function uniqueEmail(prefix = "patient"): string {
  return `${prefix}-${randomUUID().slice(0, 8)}@example.com`;
}

export function book(
  slotId: string,
  email = uniqueEmail(),
  name = "Ada Obi",
  headers?: Record<string, string>,
) {
  return api("POST", "/bookings", { body: { slot_id: slotId, name, email }, headers });
}
