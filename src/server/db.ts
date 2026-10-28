import "server-only";
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { env } from "./env";

/** Anything that can run a parameterised query: the pool or a client inside a transaction. */
export interface Queryable {
  query<R extends QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
}

// Reuse one pool per server instance (and across dev hot reloads).
const globalForDb = globalThis as unknown as { pgPool?: Pool };

export function pool(): Pool {
  if (!globalForDb.pgPool) {
    globalForDb.pgPool = new Pool({
      connectionString: env().DATABASE_URL,
      // Serverless-friendly: few connections per instance, released quickly when idle.
      // In production DATABASE_URL points at Neon's pooler, which multiplexes these.
      max: 10,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalForDb.pgPool;
}

/** Runs fn inside a transaction; commits if it resolves, rolls back if it throws. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Serialises concurrent transactions that share the same lock name until commit/rollback. */
export async function lockFor(client: PoolClient, name: string): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [name]);
}
