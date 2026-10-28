import { Suspense } from "react";
import { SlotBoard, SlotBoardSkeleton } from "./components/slot-board";
import { CLINIC_TIME_ZONE_LABEL } from "./lib/format";

export default function HomePage() {
  return (
    <>
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-accent">Appointments</p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight sm:text-5xl">
          Book a visit in under a minute.
        </h1>
        <p className="mt-4 text-lg text-muted">
          Pick a time that suits you, add your name and email, and you&apos;re confirmed. Times are
          shown in {CLINIC_TIME_ZONE_LABEL}.
        </p>
      </div>

      <div className="mt-10">
        <Suspense fallback={<SlotBoardSkeleton />}>
          <SlotBoard />
        </Suspense>
      </div>
    </>
  );
}
