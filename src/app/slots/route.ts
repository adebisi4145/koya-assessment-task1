import { withApi } from "@/server/http";
import { getSlots } from "@/server/services/slots.service";

export const GET = withApi(async (req) => {
  const slots = await getSlots(req.nextUrl.searchParams.get("provider"));
  return Response.json({ slots });
});
