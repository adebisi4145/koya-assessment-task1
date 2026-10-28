import { json, readJsonObject, withApi } from "@/server/http";
import { IdempotencyKey, parseOrThrow } from "@/server/schemas";
import { createBooking, listBookings } from "@/server/services/bookings.service";

export const POST = withApi(async (req) => {
  const rawKey = req.headers.get("idempotency-key");
  const idempotencyKey = rawKey === null ? null : parseOrThrow(IdempotencyKey, rawKey);
  return json(await createBooking(await readJsonObject(req), idempotencyKey));
});

export const GET = withApi(async (req) => {
  const params = req.nextUrl.searchParams;
  const result = await listBookings({
    email: params.get("email") ?? undefined,
    limit: params.get("limit") ?? undefined,
    cursor: params.get("cursor") ?? undefined,
  });
  return Response.json(result);
});
