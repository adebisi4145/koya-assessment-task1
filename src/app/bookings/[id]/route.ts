import { withApi } from "@/server/http";
import { getBooking } from "@/server/services/bookings.service";

export const GET = withApi<RouteContext<"/bookings/[id]">>(async (_req, ctx) => {
  const { id } = await ctx.params;
  return Response.json(await getBooking(id));
});
