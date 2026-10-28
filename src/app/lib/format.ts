// All times are shown in the clinic's own time zone, on the server and in the browser
// alike, so rendering is deterministic and patients see the clinic's local time.
export const CLINIC_TIME_ZONE = "Africa/Lagos";
export const CLINIC_TIME_ZONE_LABEL = "West Africa Time";

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: CLINIC_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: CLINIC_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

const dateKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLINIC_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "Thursday 10 December" */
export const formatDay = (iso: string) => dayFormat.format(new Date(iso));

/** "09:00" */
export const formatTime = (iso: string) => timeFormat.format(new Date(iso));

/** "09:00 – 09:30" */
export const formatTimeRange = (start: string, end: string) =>
  `${formatTime(start)} – ${formatTime(end)}`;

/** Calendar date in the clinic's zone (YYYY-MM-DD), for grouping slots by day. */
export const dayKey = (iso: string) => dateKeyFormat.format(new Date(iso));
