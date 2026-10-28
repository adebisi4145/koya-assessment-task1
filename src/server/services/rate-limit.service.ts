import "server-only";
import type { PoolClient } from "pg";
import { lockFor } from "../db";
import { MAX_ATTEMPTS, retryAfterSeconds } from "../lib/rate-limit";
import { currentWindow, recordAttempt } from "../repos/attempts.repo";

/**
 * Counts a booking attempt against `email`'s sliding window. Returns null if the
 * attempt is allowed (and records it), or the Retry-After seconds if it is not.
 * Rejected attempts are not recorded, so a client that backs off recovers on time.
 *
 * The advisory lock makes concurrent attempts for one email take turns, so a burst
 * cannot all read "4 so far" and slip through together.
 */
export async function consumeAttempt(tx: PoolClient, email: string): Promise<number | null> {
  await lockFor(tx, `rate-limit:${email}`);
  const window = await currentWindow(tx, email);
  if (window.count >= MAX_ATTEMPTS && window.oldest) {
    return retryAfterSeconds(window.oldest, window.now);
  }
  await recordAttempt(tx, email);
  return null;
}
