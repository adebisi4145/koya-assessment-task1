import "server-only";
import type { Queryable } from "../db";

export interface BookingRow {
  seq: string; // bigint arrives as a string from pg
  id: string;
  slot_id: string;
  name: string;
  email: string;
  status: "confirmed" | "cancelled";
  created_at: Date;
}

const COLUMNS = "seq, id, slot_id, name, email, status, created_at";

/**
 * Inserts a confirmed booking. Returns null if the slot already has a confirmed
 * booking: the partial unique index makes concurrent inserts for one slot wait on
 * each other, and every one after the first resolves to DO NOTHING.
 */
export async function insertConfirmedBooking(
  db: Queryable,
  booking: { slotId: string; name: string; email: string },
): Promise<BookingRow | null> {
  const { rows } = await db.query<BookingRow>(
    `INSERT INTO bookings (slot_id, name, email)
     VALUES ($1, $2, $3)
     ON CONFLICT (slot_id) WHERE status = 'confirmed' DO NOTHING
     RETURNING ${COLUMNS}`,
    [booking.slotId, booking.name, booking.email],
  );
  return rows[0] ?? null;
}

/**
 * One page of an email's bookings, oldest first, starting after `afterSeq`.
 * Fetches `limit + 1` rows so the caller can tell whether another page exists.
 */
export async function listBookingsByEmail(
  db: Queryable,
  email: string,
  afterSeq: string | null,
  limit: number,
): Promise<BookingRow[]> {
  const { rows } = await db.query<BookingRow>(
    `SELECT ${COLUMNS} FROM bookings
     WHERE email = $1 AND ($2::bigint IS NULL OR seq > $2::bigint)
     ORDER BY seq
     LIMIT $3`,
    [email, afterSeq, limit + 1],
  );
  return rows;
}

/**
 * Atomically flips a confirmed booking to cancelled. Returns null if there is no
 * confirmed booking with this id (it doesn't exist, or it is already cancelled).
 * Leaving the 'confirmed' state releases the slot from the partial unique index.
 */
export async function cancelConfirmedBooking(
  db: Queryable,
  id: string,
): Promise<BookingRow | null> {
  const { rows } = await db.query<BookingRow>(
    `UPDATE bookings SET status = 'cancelled'
     WHERE id = $1 AND status = 'confirmed'
     RETURNING ${COLUMNS}`,
    [id],
  );
  return rows[0] ?? null;
}

export async function findBookingById(db: Queryable, id: string): Promise<BookingRow | null> {
  const { rows } = await db.query<BookingRow>(`SELECT ${COLUMNS} FROM bookings WHERE id = $1`, [
    id,
  ]);
  return rows[0] ?? null;
}
