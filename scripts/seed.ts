/**
 * Seeds demo slots through the public API (POST /reset): weekday clinic hours for
 * the next 7 days, three doctors, 30-minute appointments, times in Africa/Lagos (UTC+1).
 *
 * WARNING: /reset deletes every booking. Only run against an environment you own.
 *
 * Usage: npm run db:seed                      (targets API_BASE_URL from .env.local)
 *        API_BASE_URL=https://… API_KEY=… npm run db:seed
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const DOCTORS = [
  { name: "Dr Ade Okafor", hours: [9, 10, 11] },
  { name: "Dr Bisi Bello", hours: [10, 13, 14] },
  { name: "Dr Chidi Eze", hours: [15, 16] },
];
const LAGOS_UTC_OFFSET_HOURS = 1; // West Africa Time has no daylight saving.
const DAYS_AHEAD = 7;

function buildSlots() {
  const slots: Array<{ id: string; provider: string; start: string; end: string }> = [];
  const today = new Date();
  for (let d = 1; d <= DAYS_AHEAD; d++) {
    const day = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + d),
    );
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue; // weekdays only
    const date = day.toISOString().slice(0, 10);

    for (const doctor of DOCTORS) {
      for (const hour of doctor.hours) {
        for (const minute of [0, 30]) {
          const start = new Date(day);
          start.setUTCHours(hour - LAGOS_UTC_OFFSET_HOURS, minute);
          const end = new Date(start.getTime() + 30 * 60_000);
          const initials = doctor.name
            .split(" ")
            .slice(1)
            .map((w) => w[0])
            .join("")
            .toLowerCase();
          slots.push({
            id: `${date}-${initials}-${String(hour).padStart(2, "0")}${String(minute).padStart(2, "0")}`,
            provider: doctor.name,
            start: start.toISOString().replace(".000Z", "Z"),
            end: end.toISOString().replace(".000Z", "Z"),
          });
        }
      }
    }
  }
  return slots;
}

async function main() {
  const baseUrl = process.env.API_BASE_URL;
  const apiKey = process.env.API_KEY;
  if (!baseUrl || !apiKey) throw new Error("API_BASE_URL and API_KEY must be set");

  const slots = buildSlots();
  const res = await fetch(new URL("/reset", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({ slots }),
  });
  if (!res.ok) throw new Error(`reset failed: ${res.status} ${await res.text()}`);
  console.log(`seeded ${slots.length} slots at ${baseUrl}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
