"use client";

import { useMemo, useState } from "react";
import { BookingForm } from "./booking-form";
import { AvailableDot, Card, ErrorNotice } from "./ui";

export interface SlotView {
  id: string;
  provider: string;
  /** Calendar day in the clinic's time zone, for grouping. */
  day: string;
  dayLabel: string;
  timeLabel: string;
  status: "open" | "booked" | "started";
}

const STATUS_LABEL = { open: "Available", booked: "Booked", started: "Unavailable" } as const;

export function SlotPicker({ slots }: { slots: SlotView[] }) {
  const providers = useMemo(() => [...new Set(slots.map((s) => s.provider))].sort(), [slots]);
  const [provider, setProvider] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const days = useMemo(() => {
    const groups = new Map<string, { label: string; slots: SlotView[] }>();
    for (const slot of slots) {
      if (provider && slot.provider !== provider) continue;
      const group = groups.get(slot.day) ?? { label: slot.dayLabel, slots: [] };
      group.slots.push(slot);
      groups.set(slot.day, group);
    }
    return [...groups.values()];
  }, [slots, provider]);

  // Derived from the latest data: if the picked slot was taken, started or removed
  // since it was picked (e.g. the list refreshed after a failed booking), the form
  // is replaced by an explanation rather than silently disappearing.
  const picked = selectedId === null ? null : (slots.find((s) => s.id === selectedId) ?? "gone");
  const selected = picked !== null && picked !== "gone" && picked.status === "open" ? picked : null;
  const lostMessage =
    picked === null || selected
      ? null
      : picked === "gone"
        ? "That time is no longer offered. Please choose another."
        : picked.status === "booked"
          ? "Sorry, someone has just booked this time. Please choose another."
          : "That time has already started. Please choose a later one.";
  const openCount = slots.filter((s) => s.status === "open").length;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
      <section aria-labelledby="slots-heading" className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="slots-heading" className="text-lg font-medium">
            Choose a time
          </h2>
          <p className="text-sm text-muted">
            {openCount} {openCount === 1 ? "time" : "times"} available
          </p>
        </div>

        {providers.length > 1 && (
          <div role="group" aria-label="Filter by doctor" className="mt-4 flex flex-wrap gap-2">
            {[null, ...providers].map((p) => (
              <button
                key={p ?? "all"}
                type="button"
                aria-pressed={provider === p}
                onClick={() => setProvider(p)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  provider === p
                    ? "border-fg bg-fg text-bg"
                    : "border-line bg-card hover:border-fg/30"
                }`}
              >
                {p ?? "All doctors"}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 space-y-8">
          {days.map((day) => (
            <div key={day.label}>
              <h3 className="font-serif text-xl">{day.label}</h3>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {day.slots.map((slot) => {
                  const isSelected = selected?.id === slot.id;
                  const open = slot.status === "open";
                  return (
                    <li key={slot.id}>
                      <button
                        type="button"
                        disabled={!open}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedId(slot.id)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition-all ${
                          isSelected
                            ? "border-accent bg-accent-soft/50 ring-1 ring-accent"
                            : open
                              ? "border-line bg-card hover:-translate-y-px hover:border-fg/30"
                              : "cursor-not-allowed border-line bg-bg text-muted"
                        }`}
                      >
                        <span>
                          <span className="block font-medium tabular-nums">{slot.timeLabel}</span>
                          <span className="block text-sm text-muted">{slot.provider}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-xs font-medium">
                          {open && <AvailableDot />}
                          <span className={open ? "text-accent" : ""}>
                            {STATUS_LABEL[slot.status]}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <aside aria-label="Your booking" className="lg:sticky lg:top-6">
        {selected ? (
          // Keyed by slot so switching slots starts a fresh form (and Idempotency-Key).
          <BookingForm key={selected.id} slot={selected} />
        ) : lostMessage ? (
          <Card>
            <ErrorNotice>{lostMessage}</ErrorNotice>
          </Card>
        ) : (
          <Card className="text-center">
            <p className="font-medium">Pick a time to book</p>
            <p className="mt-1 text-sm text-muted">
              Select any available slot and we&apos;ll ask for your name and email.
            </p>
          </Card>
        )}
      </aside>
    </div>
  );
}
