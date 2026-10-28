import { json, readJsonObject, withApi } from "@/server/http";
import { createBooking } from "@/server/services/bookings.service";

export const POST = withApi(async (req) => {
  return json(await createBooking(await readJsonObject(req)));
});
