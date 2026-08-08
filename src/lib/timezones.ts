export const TIME_ZONES = [
  "UTC",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Istanbul",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Australia/Perth",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "America/Sao_Paulo",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Pacific/Auckland",
] as const;

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Default list plus the viewer's own zone if it is missing. */
export function timeZoneOptions(extra?: string | null): string[] {
  const list = [...TIME_ZONES] as string[];
  for (const tz of [browserTimeZone(), extra]) {
    if (tz && !list.includes(tz)) list.unshift(tz);
  }
  return list;
}

function offsetMs(utc: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utc);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    map.hour === "24" ? 0 : Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - utc.getTime();
}

/** Turn a wall-clock date + time in `timeZone` into a real UTC instant. */
export function zonedToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const naive = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0);
  let ts = naive - offsetMs(new Date(naive), timeZone);
  ts = naive - offsetMs(new Date(ts), timeZone);
  return new Date(ts);
}

export function formatInZone(
  date: Date | string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  },
) {
  const d = typeof date === "string" ? new Date(date) : date;
  try {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-GB", options).format(d);
  }
}

export function zoneAbbrev(date: Date | string, timeZone: string) {
  const d = typeof date === "string" ? new Date(date) : date;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      timeZoneName: "short",
    }).formatToParts(d);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

export function zoneLabel(timeZone: string) {
  return timeZone.replace(/_/g, " ");
}

/**
 * Returns a Date whose *local* fields match the wall clock in `timeZone`.
 * Handy for grid maths: all layout can then use plain local getters.
 */
export function utcToZoned(date: Date | string, timeZone: string): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(d);
    const map: Record<string, string> = {};
    for (const p of parts) map[p.type] = p.value;
    return new Date(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      map.hour === "24" ? 0 : Number(map.hour),
      Number(map.minute),
      Number(map.second),
    );
  } catch {
    return new Date(d);
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "yyyy-MM-dd" of a zoned (fake-local) date. */
export function wallDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "HH:mm" of a zoned (fake-local) date. */
export function wallTimeStr(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Inverse of utcToZoned. */
export function zonedToUtcDate(zoned: Date, timeZone: string): Date {
  return zonedToUtc(wallDateStr(zoned), wallTimeStr(zoned), timeZone);
}
