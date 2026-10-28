"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { type BookingFormState, bookSlot } from "../actions";
import type { SlotView } from "./slot-picker";
import { buttonPrimary, Card, ErrorNotice, inputClass } from "./ui";

export function BookingForm({ slot }: { slot: SlotView }) {
  // One Idempotency-Key per submission: a double-click or network retry of the
  // same submission can't double-book. A fresh key is issued once a response
  // arrives, so correcting the details and resubmitting is a new request.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [state, formAction, pending] = useActionState(
    async (prev: BookingFormState, form: FormData) => {
      const next = await bookSlot(prev, form);
      setIdempotencyKey(crypto.randomUUID());
      return next;
    },
    {},
  );

  // The form mounts when a slot is picked. Moving focus to it scrolls it into view
  // (it sits below the slot list on small screens) and lets keyboard users type at once.
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  return (
    <Card>
      <h2 className="font-serif text-2xl">Your details</h2>
      <p className="mt-1 text-sm text-muted">
        {slot.dayLabel}
        <br />
        <span className="font-medium text-fg tabular-nums">{slot.timeLabel}</span> with{" "}
        {slot.provider}
      </p>

      <form action={formAction} className="mt-5 space-y-4">
        <input type="hidden" name="slot_id" value={slot.id} />
        <input type="hidden" name="idempotency_key" value={idempotencyKey} />

        <div className="space-y-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            Full name
          </label>
          <input
            ref={nameRef}
            id="name"
            name="name"
            required
            maxLength={200}
            autoComplete="name"
            defaultValue={state.values?.name}
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            defaultValue={state.values?.email}
            aria-describedby="email-hint"
            className={inputClass}
          />
          <p id="email-hint" className="text-xs text-muted">
            We&apos;ll use this to find your bookings.
          </p>
        </div>

        <div aria-live="polite">{state.error && <ErrorNotice>{state.error}</ErrorNotice>}</div>

        <button type="submit" disabled={pending} className={`${buttonPrimary} w-full`}>
          {pending ? "Booking…" : "Book appointment"}
        </button>
      </form>
    </Card>
  );
}
