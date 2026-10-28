import "server-only";
import { pool, withTransaction } from "../db";
import { listSlots, replaceAllSlots } from "../repos/slots.repo";
import { parseOrThrow, ResetBody } from "../schemas";

export interface SlotDto {
  id: string;
  provider: string;
  start: string;
  end: string;
  available: boolean;
}

/**
 * Replaces all slots and wipes all booking state. Idempotency records and rate-limit
 * attempts are cleared too, so each reset starts from a genuinely clean slate.
 */
export async function resetSlots(input: unknown): Promise<{ ok: true; slots: number }> {
  const { slots } = parseOrThrow(ResetBody, input);
  await withTransaction(async (tx) => {
    await tx.query("DELETE FROM bookings");
    await tx.query("DELETE FROM idempotency_keys");
    await tx.query("DELETE FROM booking_attempts");
    await replaceAllSlots(tx, slots);
  });
  return { ok: true, slots: slots.length };
}

export async function getSlots(provider: string | null): Promise<SlotDto[]> {
  const rows = await listSlots(pool(), provider);
  // start/end are echoed exactly as they were sent to /reset.
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    start: r.start_raw,
    end: r.end_raw,
    available: r.available,
  }));
}
