import "server-only";
import type { Queryable } from "../db";
import { WINDOW_SECONDS } from "../lib/rate-limit";

export interface AttemptWindow {
  count: number;
  oldest: Date | null;
  now: Date;
}

/**
 * Drops this email's attempts that have left the window (keeping the table small),
 * then reports what remains, all on the database clock.
 */
export async function currentWindow(db: Queryable, email: string): Promise<AttemptWindow> {
  await db.query(
    `DELETE FROM booking_attempts
     WHERE email = $1 AND at <= now() - make_interval(secs => $2)`,
    [email, WINDOW_SECONDS],
  );
  const { rows } = await db.query<{ count: number; oldest: Date | null; now: Date }>(
    `SELECT count(*)::int AS count, min(at) AS oldest, now() AS now
     FROM booking_attempts WHERE email = $1`,
    [email],
  );
  return rows[0];
}

export async function recordAttempt(db: Queryable, email: string): Promise<void> {
  await db.query("INSERT INTO booking_attempts (email) VALUES ($1)", [email]);
}
