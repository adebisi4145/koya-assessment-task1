import "server-only";
import type { Queryable } from "../db";
import type { ResetBody } from "../schemas";

export interface SlotRow {
  id: string;
  provider: string;
  start_raw: string;
  end_raw: string;
  available: boolean;
}

/** Deletes every slot (and, via cascade, every booking) and inserts the given ones. */
export async function replaceAllSlots(db: Queryable, slots: ResetBody["slots"]): Promise<void> {
  await db.query("DELETE FROM slots");
  if (slots.length === 0) return;
  await db.query(
    `INSERT INTO slots (id, provider, start_raw, end_raw, start_at, end_at)
     SELECT id, provider, s, e, s::timestamptz, e::timestamptz
     FROM unnest($1::text[], $2::text[], $3::text[], $4::text[]) AS t(id, provider, s, e)`,
    [
      slots.map((s) => s.id),
      slots.map((s) => s.provider),
      slots.map((s) => s.start),
      slots.map((s) => s.end),
    ],
  );
}

/** All slots (optionally for one provider), earliest start first, with availability. */
export async function listSlots(db: Queryable, provider: string | null): Promise<SlotRow[]> {
  const { rows } = await db.query<SlotRow>(
    `SELECT s.id, s.provider, s.start_raw, s.end_raw,
            NOT EXISTS (
              SELECT 1 FROM bookings b WHERE b.slot_id = s.id AND b.status = 'confirmed'
            ) AS available
     FROM slots s
     WHERE $1::text IS NULL OR s.provider = $1
     ORDER BY s.start_at, s.id`,
    [provider],
  );
  return rows;
}

/** Looks up a slot for booking; `started` is evaluated against the database clock. */
export async function findSlotForBooking(
  db: Queryable,
  id: string,
): Promise<{ id: string; started: boolean } | null> {
  const { rows } = await db.query<{ id: string; started: boolean }>(
    "SELECT id, start_at <= now() AS started FROM slots WHERE id = $1",
    [id],
  );
  return rows[0] ?? null;
}
