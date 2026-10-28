import { withApi } from "@/server/http";
import { cancelBooking, getBooking } from "@/server/services/bookings.service";

type Ctx = RouteContext<"/bookings/[id]">;

export const GET = withApi<Ctx>(async (_req, ctx) => {
  const { id } = await ctx.params;
  return Response.json(await getBooking(id));
});

export const DELETE = withApi<Ctx>(async (_req, ctx) => {
  const { id } = await ctx.params;
  return Response.json(await cancelBooking(id));
});
