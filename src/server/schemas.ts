import { z } from "zod";
import { badRequest } from "./errors";

/** A string field that must be present; trimmed, and non-empty after trimming. */
const requiredString = (field: string) =>
  z
    .string({
      error: (issue) =>
        issue.input === undefined ? `${field} is required` : `${field} must be a string`,
    })
    .trim()
    .min(1, `${field} is required`);

const dateTime = (field: string) =>
  z.iso.datetime({ offset: true, error: `${field} must be an ISO 8601 date-time` });

export const SlotInput = z
  .object({
    id: requiredString("id"),
    provider: requiredString("provider"),
    start: dateTime("start"),
    end: dateTime("end"),
  })
  .refine((s) => Date.parse(s.end) > Date.parse(s.start), "end must be after start");

export const ResetBody = z.object({
  slots: z
    .array(SlotInput, { error: "slots must be an array" })
    .refine(
      (slots) => new Set(slots.map((s) => s.id)).size === slots.length,
      "slot ids must be unique",
    ),
});
export type ResetBody = z.infer<typeof ResetBody>;

export const NewBooking = z.object({
  slot_id: requiredString("slot_id"),
  name: requiredString("name"),
  email: requiredString("email"),
});
export type NewBooking = z.infer<typeof NewBooking>;

/** Parses input against a schema, throwing a 400 with the first problem's message. */
export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw badRequest(result.error.issues[0]?.message ?? "invalid request");
  return result.data;
}
