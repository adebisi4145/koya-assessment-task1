import "server-only";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { unstable_rethrow } from "next/navigation";
import { connection, type NextRequest } from "next/server";
import { env } from "./env";
import { AppError, badRequest, unauthorized } from "./errors";

/** A response as data, so it can be stored (idempotency) before being sent. */
export interface ApiResult {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export function json({ status, body, headers }: ApiResult): Response {
  return Response.json(body, { status, headers });
}

export function errorResult(err: AppError): ApiResult {
  return { status: err.status, body: { error: err.message }, headers: err.headers };
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/** Constant-time comparison; hashing first gives equal-length buffers for timingSafeEqual. */
function isValidApiKey(provided: string | null): boolean {
  if (!provided) return false;
  return timingSafeEqual(digest(provided), digest(env().API_KEY));
}

/** Parses the body as JSON, requiring a top-level object. */
export async function readJsonObject(req: Request): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await req.text());
  } catch {
    throw badRequest("request body must be valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw badRequest("request body must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/**
 * Wraps every API route: checks the API key, turns AppErrors into
 * `{"error": ...}` responses, hides unexpected errors behind a JSON 500,
 * and logs one structured line per request.
 */
export function withApi<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    // API responses are always request-time: opt out of prerendering before doing anything.
    await connection();
    const started = performance.now();
    const requestId = randomUUID();
    let res: Response;

    try {
      if (!isValidApiKey(req.headers.get("x-api-key"))) throw unauthorized();
      res = await handler(req, ctx);
    } catch (err) {
      // Never swallow Next.js control-flow errors (prerender bail-outs, redirects…).
      unstable_rethrow(err);
      if (err instanceof AppError) {
        res = json(errorResult(err));
      } else {
        console.error(JSON.stringify({ level: "error", requestId, error: String(err) }));
        res = json({ status: 500, body: { error: "internal server error" } });
      }
    }

    res.headers.set("x-request-id", requestId);
    console.log(
      JSON.stringify({
        level: "info",
        requestId,
        method: req.method,
        path: req.nextUrl.pathname,
        status: res.status,
        ms: Math.round(performance.now() - started),
      }),
    );
    return res;
  };
}
