import { apiClient } from "@/server/api-client";
import { dayKey, formatDay, formatTimeRange } from "../lib/format";
import { SlotPicker, type SlotView } from "./slot-picker";
import { Card, ErrorNotice, Skeleton } from "./ui";

/**
 * Fetches slots from the API at request time and shapes them for display. A slot
 * whose start has passed can't be booked even though the API reports it available.
 */
async function loadSlotViews(): Promise<SlotView[] | null> {
  const outcome = await apiClient.listSlots();
  if (!outcome.ok) return null;

  const now = Date.now();
  return outcome.data.slots.map((slot) => ({
    id: slot.id,
    provider: slot.provider,
    day: dayKey(slot.start),
    dayLabel: formatDay(slot.start),
    timeLabel: formatTimeRange(slot.start, slot.end),
    status: Date.parse(slot.start) <= now ? "started" : slot.available ? "open" : "booked",
  }));
}

export async function SlotBoard() {
  const slots = await loadSlotViews();
  if (!slots) {
    return (
      <ErrorNotice>
        We couldn&apos;t load appointment times. Please refresh to try again.
      </ErrorNotice>
    );
  }

  if (slots.length === 0) {
    return (
      <Card className="text-center">
        <p className="font-medium">No appointment times are open right now.</p>
        <p className="mt-1 text-sm text-muted">Please check back soon.</p>
      </Card>
    );
  }
  return <SlotPicker slots={slots} />;
}

export function SlotBoardSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]" aria-busy="true" aria-label="Loading">
      <div className="space-y-4">
        <Skeleton className="h-9 w-64 rounded-full" />
        <Skeleton className="h-5 w-48" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
      <Skeleton className="hidden h-72 lg:block" />
    </div>
  );
}
