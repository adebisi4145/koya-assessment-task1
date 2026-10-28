"use client";

import { useActionState, useState } from "react";
import { cancelBooking } from "../actions";
import { buttonSecondary, ErrorNotice } from "./ui";

/** Two-step cancel: the first click asks for confirmation instead of acting. */
export function CancelButton({ bookingId }: { bookingId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(cancelBooking.bind(null, bookingId), {});

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={buttonSecondary}>
        Cancel booking
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm font-medium">Cancel this appointment? The time will be released.</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className={`${buttonSecondary} border-danger/40 text-danger hover:border-danger`}
        >
          {pending ? "Cancelling…" : "Yes, cancel it"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className={buttonSecondary}
        >
          Keep it
        </button>
      </div>
      <div aria-live="polite">{state.error && <ErrorNotice>{state.error}</ErrorNotice>}</div>
    </form>
  );
}
