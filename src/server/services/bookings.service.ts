import "server-only";
import { pool } from "../db";
import { badRequest, conflict, notFound } from "../errors";
import type { ApiResult } from "../http";
import { type BookingRow, findBookingById, insertConfirmedBooking } from "../repos/bookings.repo";
import { findSlotForBooking } from "../repos/slots.repo";
import { NewBooking, parseOrThrow } from "../schemas";

export interface BookingDto {
  id: string;
  slot_id: string;
  name: string;
  email: string;
  status: "confirmed" | "cancelled";
  created_at: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export async function createBooking(body: Record<string, unknown>): Promise<ApiResult> {
  const input = parseOrThrow(NewBooking, body);

  const slot = await findSlotForBooking(pool(), input.slot_id);
  if (!slot) throw notFound("slot not found");
  if (slot.started) throw badRequest("slot has already started");

  const row = await insertConfirmedBooking(pool(), {
    slotId: input.slot_id,
    name: input.name,
    email: input.email,
  });
  if (!row) throw conflict("slot already booked");
  return { status: 201, body: toBookingDto(row) };
}

export async function getBooking(id: string): Promise<BookingDto> {
  // Booking ids are UUIDs; anything else cannot exist, so skip the query.
  const row = UUID_RE.test(id) ? await findBookingById(pool(), id) : null;
  if (!row) throw notFound("booking not found");
  return toBookingDto(row);
}
