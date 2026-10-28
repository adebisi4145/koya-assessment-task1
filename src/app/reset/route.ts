import { readJsonObject, withApi } from "@/server/http";
import { resetSlots } from "@/server/services/slots.service";

export const POST = withApi(async (req) => {
  const result = await resetSlots(await readJsonObject(req));
  return Response.json(result);
});
