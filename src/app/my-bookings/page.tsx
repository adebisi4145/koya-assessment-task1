import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { apiClient } from "@/server/api-client";
import {
  buttonPrimary,
  buttonSecondary,
  Card,
  ErrorNotice,
  inputClass,
  Skeleton,
  StatusBadge,
} from "../components/ui";
import { formatDay, formatTimeRange } from "../lib/format";

export const metadata: Metadata = { title: "My bookings" };

type SearchParams = PageProps<"/my-bookings">["searchParams"];

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default function MyBookingsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-serif text-4xl tracking-tight">My bookings</h1>
      <p className="mt-2 text-muted">Enter the email you booked with to see your appointments.</p>
      <Suspense fallback={<Skeleton className="mt-8 h-64" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const email = one(params.email)?.trim() ?? "";
  const cursor = one(params.cursor);

  const form = (
    <form action="/my-bookings" className="mt-6 flex flex-col gap-3 sm:flex-row">
      <label htmlFor="lookup-email" className="sr-only">
        Email
      </label>
      <input
        id="lookup-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        defaultValue={email}
        className={inputClass}
      />
      <button type="submit" className={buttonPrimary}>
        Find bookings
      </button>
    </form>
  );

  if (!email) return form;

  const [page, slots] = await Promise.all([
    apiClient.listBookings(email, cursor),
    apiClient.listSlots(),
  ]);
  const slotById = new Map(slots.ok ? slots.data.slots.map((s) => [s.id, s]) : []);

  return (
    <>
      {form}
      <section aria-label="Bookings" className="mt-8 space-y-3">
        {!page.ok ? (
          <ErrorNotice>
            We couldn&apos;t load bookings for that email. Please try again.
          </ErrorNotice>
        ) : page.data.bookings.length === 0 ? (
          <Card className="text-center text-muted">No bookings found for {email}.</Card>
        ) : (
          <>
            <ul className="space-y-3">
              {page.data.bookings.map((b) => {
                const slot = slotById.get(b.slot_id);
                return (
                  <li key={b.id}>
                    <Link
                      href={`/booking/${b.id}`}
                      className="flex items-center justify-between gap-4 rounded-xl border border-line bg-card p-4 transition-colors hover:border-fg/30"
                    >
                      <span>
                        <span className="block font-medium">
                          {slot ? formatDay(slot.start) : `Slot ${b.slot_id}`}
                        </span>
                        <span className="block text-sm text-muted tabular-nums">
                          {slot
                            ? `${formatTimeRange(slot.start, slot.end)} · ${slot.provider}`
                            : ""}
                        </span>
                      </span>
                      <StatusBadge status={b.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
            <nav aria-label="Pages" className="flex justify-between gap-3 pt-2">
              {cursor ? (
                <Link
                  href={`/my-bookings?${new URLSearchParams({ email })}`}
                  className={buttonSecondary}
                >
                  ← First page
                </Link>
              ) : (
                <span />
              )}
              {page.data.next_cursor && (
                <Link
                  href={`/my-bookings?${new URLSearchParams({ email, cursor: page.data.next_cursor })}`}
                  className={buttonSecondary}
                >
                  More bookings →
                </Link>
              )}
            </nav>
          </>
        )}
      </section>
    </>
  );
}
