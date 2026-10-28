import "server-only";
import type { Queryable } from "../db";

export interface StoredResponse {
  request_hash: string;
  status: number;
  body: unknown;
}

/** How long a stored outcome is replayed before the key may be reused. */
const TTL = "24 hours";

export async function findStoredResponse(
  db: Queryable,
  key: string,
): Promise<StoredResponse | null> {
  const { rows } = await db.query<StoredResponse>(
    `SELECT request_hash, status, body FROM idempotency_keys
     WHERE key = $1 AND created_at > now() - interval '${TTL}'`,
    [key],
  );
  return rows[0] ?? null;
}

/** Stores (or, for an expired key, replaces) the outcome of a request. */
export async function saveResponse(
  db: Queryable,
  key: string,
  response: StoredResponse,
): Promise<void> {
  await db.query(
    `INSERT INTO idempotency_keys (key, request_hash, status, body)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (key) DO UPDATE
       SET request_hash = EXCLUDED.request_hash, status = EXCLUDED.status,
           body = EXCLUDED.body, created_at = now()`,
    [key, response.request_hash, response.status, JSON.stringify(response.body)],
  );
}
