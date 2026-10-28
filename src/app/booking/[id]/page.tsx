import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { apiClient } from "@/server/api-client";
import { CancelButton } from "../../components/cancel-button";
import { buttonPrimary, Card, ErrorNotice, Skeleton, StatusBadge } from "../../components/ui";
import { CLINIC_TIME_ZONE_LABEL, formatDay, formatTimeRange } from "../../lib/format";

export const metadata: Metadata = { title: "Your booking" };

export default function BookingPage({ params }: PageProps<"/booking/[id]">) {
  return (
    <div className="mx-auto max-w-xl">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <BookingDetails params={params} />
      </Suspense>
    </div>
  );
}

async function BookingDetails({ params }: Pick<PageProps<"/booking/[id]">, "params">) {
  const { id } = await params;
  const [booking, slots] = await Promise.all([apiClient.getBooking(id), apiClient.listSlots()]);

  if (!booking.ok) {
    if (booking.status === 404) notFound();
    return (
      <ErrorNotice>We couldn&apos;t load this booking. Please refresh to try again.</ErrorNotice>
    );
  }

  const { data } = booking;
  const slot = slots.ok ? slots.data.slots.find((s) => s.id === data.slot_id) : undefined;
  const confirmed = data.status === "confirmed";

  return (
    <Card className="p-6 sm:p-8">
      <StatusBadge status={data.status} />
      <h1 className="mt-4 font-serif text-3xl tracking-tight sm:text-4xl">
        {confirmed ? "You're booked in." : "This booking was cancelled."}
      </h1>
      <p className="mt-2 text-muted">
        {confirmed
          ? "Keep this page or your booking reference. We look forward to seeing you."
          : "The time has been released. You're welcome to book another."}
      </p>

      <dl className="mt-6 divide-y divide-line border-y border-line text-sm">
        {slot && (
          <>
            <Row label="When">
              {formatDay(slot.start)}, {formatTimeRange(slot.start, slot.end)}
              <span className="block text-xs text-muted">{CLINIC_TIME_ZONE_LABEL}</span>
            </Row>
            <Row label="With">{slot.provider}</Row>
          </>
        )}
        <Row label="Name">{data.name}</Row>
        <Row label="Email">{data.email}</Row>
        <Row label="Reference">
          <span className="font-mono text-xs break-all">{data.id}</span>
        </Row>
      </dl>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <Link href="/" className={buttonPrimary}>
          {confirmed ? "Book another" : "Choose a new time"}
        </Link>
        {confirmed && <CancelButton bookingId={data.id} />}
      </div>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6rem_1fr] gap-4 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
