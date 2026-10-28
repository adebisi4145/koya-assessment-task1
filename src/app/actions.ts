"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { apiClient, type ApiOutcome } from "@/server/api-client";

// Server Actions are publicly reachable POST endpoints. These only expose what a
// patient may do (book, cancel), and every call still goes through the API's own
// validation and per-email rate limit.

export interface BookingFormState {
  error?: string;
  /** Echoed back so the form keeps what the patient typed after an error. */
  values?: { name: string; email: string };
}

export interface CancelState {
  error?: string;
}

const field = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

function friendlyError(outcome: Extract<ApiOutcome<unknown>, { ok: false }>): string {
  switch (outcome.status) {
    case 400:
      if (outcome.error === "slot has already started") {
        return "This appointment has already started. Please choose a later time.";
      }
      if (outcome.error === "email is invalid") return "Please enter a valid email address.";
      if (outcome.error.endsWith("is required")) return "Please fill in your name and email.";
      return "Please check your details and try again.";
    case 404:
      return "That appointment is no longer offered. Please choose another time.";
    case 409:
      return "Sorry, someone has just booked this time. Please choose another.";
    case 422:
      return "Your previous attempt is still being processed. Please try again.";
    case 429: {
      const wait = outcome.retryAfter ? ` in ${outcome.retryAfter} seconds` : " shortly";
      return `Too many booking attempts for this email. Please try again${wait}.`;
    }
    default:
      return "Something went wrong on our side. Please try again.";
  }
}

export async function bookSlot(_prev: BookingFormState, form: FormData): Promise<BookingFormState> {
  const values = { name: field(form, "name"), email: field(form, "email") };
  const idempotencyKey = field(form, "idempotency_key") || crypto.randomUUID();

  const outcome = await apiClient.createBooking(
    { slot_id: field(form, "slot_id"), ...values },
    idempotencyKey,
  );
  if (!outcome.ok) {
    // The slot was taken, removed or has started since the page loaded: re-render
    // the slot list so it reflects reality alongside the message.
    if ([404, 409].includes(outcome.status) || outcome.error === "slot has already started") {
      refresh();
    }
    return { error: friendlyError(outcome), values };
  }

  redirect(`/booking/${outcome.data.id}`);
}

export async function cancelBooking(id: string): Promise<CancelState> {
  const outcome = await apiClient.cancelBooking(id);
  // Already cancelled (409) is the state the patient wanted; just show it.
  if (!outcome.ok && outcome.status !== 409) {
    return { error: "We couldn't cancel this booking. Please try again." };
  }
  refresh();
  return {};
}
