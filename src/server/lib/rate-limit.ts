/** POST /bookings attempts allowed per email within the sliding window. */
export const MAX_ATTEMPTS = 5;
export const WINDOW_SECONDS = 60;

/**
 * Whole seconds until the oldest attempt in the window expires, freeing a slot.
 * Rounded up (and at least 1) so a client that waits exactly this long succeeds.
 */
export function retryAfterSeconds(oldestAttempt: Date, now: Date): number {
  const freesAtMs = oldestAttempt.getTime() + WINDOW_SECONDS * 1000;
  return Math.max(1, Math.ceil((freesAtMs - now.getTime()) / 1000));
}

/** The rate-limit bucket for a request body: its email, normalised as it will be stored. */
export function rateLimitKey(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const key = email.trim().toLowerCase();
  return key === "" ? null : key;
}
