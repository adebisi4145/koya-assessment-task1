import "server-only";
import type { PoolClient } from "pg";
import { lockFor, pool, withTransaction } from "../db";
import {
  AppError,
  badRequest,
  conflict,
  notFound,
  tooManyRequests,
  unprocessable,
} from "../errors";
import { type ApiResult, errorResult } from "../http";
import { decodeCursor, encodeCursor } from "../lib/cursor";
import { hashBody } from "../lib/hash";
import { rateLimitKey } from "../lib/rate-limit";
import {
  type BookingRow,
  cancelConfirmedBooking,
  findBookingById,
  insertConfirmedBooking,
  listBookingsByEmail,
} from "../repos/bookings.repo";
import { findStoredResponse, saveResponse } from "../repos/idempotency.repo";
import { findSlotForBooking } from "../repos/slots.repo";
import { ListBookingsQuery, NewBooking, parseOrThrow } from "../schemas";
import { consumeAttempt } from "./rate-limit.service";

export interface BookingDto {
  id: string;
  slot_id: string;
  name: string;
  email: string;
  status: "confirmed" | "cancelled";
  created_at: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Outcomes worth replaying for a retried Idempotency-Key. Transient ones
 * (429 rate limit, 5xx) are not stored, so a later retry can still succeed.
 */
const REPLAYABLE_STATUSES = new Set([201, 400, 404, 409]);

export function toBookingDto(row: BookingRow): BookingDto {
  return {
    id: row.id,
    slot_id: row.slot_id,
    name: row.name,
    email: row.email,
    status: row.status,
    created_at: row.created_at.toISOString(),
  };
}

/**
 * POST /bookings. Runs in one transaction so that an idempotent retry either sees
 * the first attempt's stored outcome or waits for it (advisory lock on the key).
 */
export async function createBooking(
  body: Record<string, unknown>,
  idempotencyKey: string | null,
): Promise<ApiResult> {
  return withTransaction(async (tx) => {
    const requestHash = idempotencyKey ? hashBody(body) : null;

    if (idempotencyKey && requestHash) {
      await lockFor(tx, `idempotency:${idempotencyKey}`);
      const stored = await findStoredResponse(tx, idempotencyKey);
      if (stored) {
        if (stored.request_hash !== requestHash) {
          throw unprocessable("Idempotency-Key was already used with a different request body");
        }
        return { status: stored.status, body: stored.body };
      }
    }

    // Every attempt that reaches this point counts, whether or not it then succeeds.
    // Replays above don't: they repeat an attempt rather than make a new one.
    const email = rateLimitKey(body.email);
    if (email) {
      const retryAfter = await consumeAttempt(tx, email);
      if (retryAfter !== null) return errorResult(tooManyRequests(retryAfter));
    }

    const result = await attemptBooking(tx, body);

    if (idempotencyKey && requestHash && REPLAYABLE_STATUSES.has(result.status)) {
      await saveResponse(tx, idempotencyKey, { request_hash: requestHash, ...result });
    }
    return result;
  });
}

/**
 * Validates and books, returning expected failures as results rather than throwing,
 * so the surrounding transaction still commits (and stores them for idempotency).
 */
async function attemptBooking(tx: PoolClient, body: Record<string, unknown>): Promise<ApiResult> {
  try {
    const input = parseOrThrow(NewBooking, body);

    const slot = await findSlotForBooking(tx, input.slot_id);
    if (!slot) throw notFound("slot not found");
    if (slot.started) throw badRequest("slot has already started");

    const row = await insertConfirmedBooking(tx, {
      slotId: input.slot_id,
      name: input.name,
      email: input.email,
    });
    if (!row) throw conflict("slot already booked");
    return { status: 201, body: toBookingDto(row) };
  } catch (err) {
    if (err instanceof AppError) return errorResult(err);
    throw err;
  }
}

export async function getBooking(id: string): Promise<BookingDto> {
  // Booking ids are UUIDs; anything else cannot exist, so skip the query.
  const row = UUID_RE.test(id) ? await findBookingById(pool(), id) : null;
  if (!row) throw notFound("booking not found");
  return toBookingDto(row);
}

export async function cancelBooking(id: string): Promise<BookingDto> {
  if (!UUID_RE.test(id)) throw notFound("booking not found");

  const cancelled = await cancelConfirmedBooking(pool(), id);
  if (cancelled) return toBookingDto(cancelled);

  // Nothing was updated: either the booking doesn't exist or it was already cancelled.
  if (await findBookingById(pool(), id)) throw conflict("booking is already cancelled");
  throw notFound("booking not found");
}

/** GET /bookings: one page of a person's bookings, oldest first, with a keyset cursor. */
export async function listBookings(
  query: Record<string, string | undefined>,
): Promise<{ bookings: BookingDto[]; next_cursor: string | null }> {
  const { email, limit, cursor } = parseOrThrow(ListBookingsQuery, query);

  let afterSeq: string | null = null;
  if (cursor !== undefined) {
    afterSeq = decodeCursor(cursor);
    if (afterSeq === null) throw badRequest("cursor is invalid");
  }

  const rows = await listBookingsByEmail(pool(), email, afterSeq, limit);
  const page = rows.slice(0, limit);
  const hasMore = rows.length > limit;

  return {
    bookings: page.map(toBookingDto),
    next_cursor: hasMore ? encodeCursor(page[page.length - 1].seq) : null,
  };
}
