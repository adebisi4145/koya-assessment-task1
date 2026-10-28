import "server-only";
import { connection } from "next/server";
import { env } from "./env";
import type { BookingDto } from "./services/bookings.service";
import type { SlotDto } from "./services/slots.service";

/**
 * Typed client for this app's own HTTP API, used by the web page's server code.
 * The page consumes the API exactly as any other client would; the API key is
 * attached here, on the server, and never reaches the browser.
 */

export type ApiOutcome<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; retryAfter?: number };

async function call<T>(
  method: string,
  path: string,
  { body, headers }: { body?: unknown; headers?: Record<string, string> } = {},
): Promise<ApiOutcome<T>> {
  // Live data on every call: never part of a prerendered shell.
  await connection();
  const { API_BASE_URL, API_KEY } = env();
  let res: Response;
  try {
    res = await fetch(new URL(path, API_BASE_URL), {
      method,
      cache: "no-store",
      headers: {
        "X-API-Key": API_KEY,
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    console.error(
      JSON.stringify({ level: "error", msg: "api unreachable", path, error: String(err) }),
    );
    return { ok: false, status: 503, error: "service unavailable" };
  }

  const payload = await res.json().catch(() => null);
  if (res.ok) return { ok: true, status: res.status, data: payload as T };

  const retryAfter = Number(res.headers.get("retry-after"));
  return {
    ok: false,
    status: res.status,
    error: typeof payload?.error === "string" ? payload.error : `request failed (${res.status})`,
    ...(Number.isFinite(retryAfter) && retryAfter > 0 && { retryAfter }),
  };
}

export const apiClient = {
  listSlots: () => call<{ slots: SlotDto[] }>("GET", "/slots"),

  getBooking: (id: string) => call<BookingDto>("GET", `/bookings/${encodeURIComponent(id)}`),

  createBooking: (
    input: { slot_id: string; name: string; email: string },
    idempotencyKey: string,
  ) =>
    call<BookingDto>("POST", "/bookings", {
      body: input,
      headers: { "Idempotency-Key": idempotencyKey },
    }),

  cancelBooking: (id: string) => call<BookingDto>("DELETE", `/bookings/${encodeURIComponent(id)}`),

  listBookings: (email: string, cursor?: string) => {
    const params = new URLSearchParams({ email, limit: "10" });
    if (cursor) params.set("cursor", cursor);
    return call<{ bookings: BookingDto[]; next_cursor: string | null }>(
      "GET",
      `/bookings?${params}`,
    );
  },
};
