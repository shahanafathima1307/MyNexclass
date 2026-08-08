import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { useClasses, useMembers, type ClassWithPeople } from "@/lib/tutoring";
import { useAssignments, type AssignmentFull } from "@/lib/assignments";
import { useLoopRequests, type LoopRequest } from "@/lib/loop";
import { meetingWindow, type MeetingState } from "@/lib/meeting";
import { browserTimeZone, utcToZoned, wallDateStr, zonedToUtc } from "@/lib/timezones";

export type CalendarRow = Tables<"calendar_events">;
export type ReminderRow = Tables<"event_reminders">;
export type HistoryRow = Tables<"event_history">;

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export const CALENDAR_KEYS = [
  "classes",
  "availability",
  "assignments",
  "loop",
  "personal",
  "blocked",
  "holidays",
] as const;
export type CalendarKey = (typeof CALENDAR_KEYS)[number];

export const CALENDAR_LABEL: Record<CalendarKey, string> = {
  classes: "Classes",
  availability: "Tutor availability",
  assignments: "Assignment due dates",
  loop: "Loop requests",
  personal: "Personal events",
  blocked: "Blocked time",
  holidays: "Holidays",
};

export type EventCategory =
  | "class"
  | "live"
  | "completed"
  | "cancelled"
  | "trial"
  | "availability"
  | "assignment"
  | "loop"
  | "personal"
  | "blocked"
  | "holiday";

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  class: "Scheduled class",
  live: "Live class",
  completed: "Completed class",
  cancelled: "Cancelled class",
  trial: "Trial class",
  availability: "Tutor availability",
  assignment: "Assignment due",
  loop: "Loop request",
  personal: "Personal event",
  blocked: "Blocked time",
  holiday: "Holiday",
};

/** Tailwind token classes per category (all semantic, see styles.css). */
export const CATEGORY_STYLE: Record<EventCategory, { bar: string; chip: string; dot: string }> = {
  class: { bar: "bg-cal-class", chip: "border-cal-class/40 bg-cal-class/10 text-foreground", dot: "bg-cal-class" },
  live: { bar: "bg-cal-live", chip: "border-cal-live/50 bg-cal-live/15 text-foreground", dot: "bg-cal-live" },
  completed: { bar: "bg-cal-done", chip: "border-cal-done/40 bg-cal-done/10 text-muted-foreground", dot: "bg-cal-done" },
  cancelled: {
    bar: "bg-cal-cancelled",
    chip: "border-cal-cancelled/40 bg-cal-cancelled/10 text-muted-foreground line-through",
    dot: "bg-cal-cancelled",
  },
  trial: { bar: "bg-cal-trial", chip: "border-cal-trial/40 bg-cal-trial/10 text-foreground", dot: "bg-cal-trial" },
  availability: {
    bar: "bg-cal-availability",
    chip: "border-cal-availability/50 bg-cal-availability/15 text-foreground",
    dot: "bg-cal-availability",
  },
  assignment: {
    bar: "bg-cal-assignment",
    chip: "border-cal-assignment/40 bg-cal-assignment/10 text-foreground",
    dot: "bg-cal-assignment",
  },
  loop: { bar: "bg-cal-loop", chip: "border-cal-loop/40 bg-cal-loop/10 text-foreground", dot: "bg-cal-loop" },
  personal: {
    bar: "bg-cal-personal",
    chip: "border-cal-personal/40 bg-cal-personal/10 text-foreground",
    dot: "bg-cal-personal",
  },
  blocked: {
    bar: "bg-cal-blocked",
    chip: "border-cal-blocked/40 bg-cal-blocked/10 text-muted-foreground",
    dot: "bg-cal-blocked",
  },
  holiday: {
    bar: "bg-cal-holiday",
    chip: "border-cal-holiday/40 bg-cal-holiday/10 text-foreground",
    dot: "bg-cal-holiday",
  },
};

export type EventSource = "class" | "availability" | "assignment" | "loop" | "event";

export type CalEvent = {
  /** Unique per rendered occurrence. */
  id: string;
  sourceId: string;
  source: EventSource;
  calendar: CalendarKey;
  category: EventCategory;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  subject: string | null;
  grade: string | null;
  tutorId: string | null;
  tutorName: string | null;
  studentId: string | null;
  studentName: string | null;
  status: string | null;
  meetingUrl: string | null;
  location: string | null;
  description: string | null;
  timeZone: string;
  online: boolean;
  movable: boolean;
  meeting?: { state: MeetingState; canJoin: boolean; label: string } | null;
  classRow?: ClassWithPeople;
  assignmentRow?: AssignmentFull;
  loopRow?: LoopRequest;
  eventRow?: CalendarRow;
};

/* ------------------------------------------------------------------ */
/* Raw queries                                                         */
/* ------------------------------------------------------------------ */

export function useCalendarRows(userId: string | undefined) {
  return useQuery({
    queryKey: ["calendar-events", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAvailabilityRows(enabled: boolean) {
  return useQuery({
    queryKey: ["calendar-availability"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("tutor_availability").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ------------------------------------------------------------------ */
/* Recurrence                                                          */
/* ------------------------------------------------------------------ */

export const REPEAT_OPTIONS = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Every weekday" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom (every N weeks)" },
] as const;

const DAY_MS = 86_400_000;

/** Expands a repeat rule into concrete start instants inside [from, to]. */
export function expandOccurrences(
  row: Pick<
    CalendarRow,
    "starts_at" | "ends_at" | "repeat_freq" | "repeat_interval" | "repeat_byweekday" | "repeat_until" | "repeat_count"
  >,
  from: Date,
  to: Date,
): { start: Date; end: Date }[] {
  const start = new Date(row.starts_at);
  const end = new Date(row.ends_at);
  const length = Math.max(end.getTime() - start.getTime(), 15 * 60_000);
  const freq = row.repeat_freq ?? "none";
  if (freq === "none") {
    return start <= to && end >= from ? [{ start, end }] : [];
  }
  const until = row.repeat_until ? new Date(row.repeat_until) : null;
  const limit = row.repeat_count ?? 400;
  const interval = Math.max(row.repeat_interval ?? 1, 1);
  const weekdays = (row.repeat_byweekday ?? []) as number[];
  const out: { start: Date; end: Date }[] = [];
  let cursor = new Date(start);
  let produced = 0;

  const push = (d: Date) => {
    const s = new Date(d);
    const e = new Date(d.getTime() + length);
    if (s <= to && e >= from) out.push({ start: s, end: e });
  };

  while (produced < limit && cursor.getTime() <= to.getTime() + DAY_MS) {
    if (until && cursor > until) break;
    if (freq === "weekdays") {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) {
        push(cursor);
        produced += 1;
      }
      cursor = new Date(cursor.getTime() + DAY_MS);
      continue;
    }
    if (freq === "weekly" || freq === "custom") {
      const day = cursor.getDay();
      if (!weekdays.length || weekdays.includes(day)) {
        push(cursor);
        produced += 1;
      }
      const next = new Date(cursor.getTime() + DAY_MS);
      // jump the remaining interval once a week completes
      if (next.getDay() === start.getDay() && interval > 1) {
        cursor = new Date(next.getTime() + (interval - 1) * 7 * DAY_MS);
      } else {
        cursor = next;
      }
      continue;
    }
    if (freq === "daily") {
      push(cursor);
      produced += 1;
      cursor = new Date(cursor.getTime() + interval * DAY_MS);
      continue;
    }
    // monthly
    push(cursor);
    produced += 1;
    const nextMonth = new Date(cursor);
    nextMonth.setMonth(nextMonth.getMonth() + interval);
    cursor = nextMonth;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Unified feed                                                        */
/* ------------------------------------------------------------------ */

export type Range = { from: Date; to: Date };

export function useCalendarEvents(userId: string | undefined, range: Range, timeZone: string) {
  const classes = useClasses(userId);
  const assignments = useAssignments(userId);
  const loop = useLoopRequests(userId);
  const events = useCalendarRows(userId);
  const availability = useAvailabilityRows(!!userId);
  const { data: members } = useMembers();

  const nameOf = useCallback(
    (id: string | null | undefined) => (members ?? []).find((m) => m.id === id)?.full_name ?? null,
    [members],
  );

  const list = useMemo<CalEvent[]>(() => {
    const out: CalEvent[] = [];
    const inRange = (s: Date, e: Date) => s <= range.to && e >= range.from;

    for (const c of classes.data ?? []) {
      const start = new Date(c.starts_at);
      const end = new Date(start.getTime() + c.duration_minutes * 60_000);
      if (!inRange(start, end)) continue;
      const win = meetingWindow(c);
      const category: EventCategory =
        c.status === "cancelled"
          ? "cancelled"
          : c.status === "completed"
            ? "completed"
            : win.state === "live"
              ? "live"
              : c.is_demo
                ? "trial"
                : "class";
      out.push({
        id: `class:${c.id}`,
        sourceId: c.id,
        source: "class",
        calendar: "classes",
        category,
        title: c.title,
        start,
        end,
        allDay: false,
        subject: c.subject,
        grade: null,
        tutorId: c.tutor_id,
        tutorName: c.tutor?.full_name ?? nameOf(c.tutor_id),
        studentId: c.student_id,
        studentName: c.student?.full_name ?? nameOf(c.student_id),
        status: c.status,
        meetingUrl: c.meeting_url,
        location: null,
        description: c.notes,
        timeZone: c.time_zone ?? timeZone,
        online: true,
        movable: c.status === "scheduled",
        meeting: { state: win.state, canJoin: win.canJoin, label: win.label },
        classRow: c,
      });
    }

    for (const a of assignments.data ?? []) {
      if (!a.due_at) continue;
      const due = new Date(a.due_at);
      if (!inRange(due, due)) continue;
      out.push({
        id: `assignment:${a.id}`,
        sourceId: a.id,
        source: "assignment",
        calendar: "assignments",
        category: "assignment",
        title: a.title,
        start: due,
        end: new Date(due.getTime() + 30 * 60_000),
        allDay: false,
        subject: a.subject,
        grade: a.grade_level,
        tutorId: a.tutor_id,
        tutorName: nameOf(a.tutor_id),
        studentId: a.student_id,
        studentName: nameOf(a.student_id),
        status: a.status,
        meetingUrl: null,
        location: null,
        description: a.instructions,
        timeZone,
        online: false,
        movable: false,
        assignmentRow: a,
      });
    }

    for (const r of loop.data ?? []) {
      const start = new Date(r.preferred_start ?? r.created_at);
      const end = new Date(start.getTime() + (r.duration_minutes ?? 30) * 60_000);
      if (!inRange(start, end)) continue;
      if (r.status === "matched" && r.class_id) continue; // shown as a class instead
      out.push({
        id: `loop:${r.id}`,
        sourceId: r.id,
        source: "loop",
        calendar: "loop",
        category: "loop",
        title: `Loop · ${r.subject}`,
        start,
        end,
        allDay: false,
        subject: r.subject,
        grade: r.grade_level,
        tutorId: r.tutor_id,
        tutorName: nameOf(r.tutor_id),
        studentId: r.student_id,
        studentName: nameOf(r.student_id),
        status: r.status,
        meetingUrl: null,
        location: null,
        description: r.notes ?? r.topic,
        timeZone,
        online: true,
        movable: false,
        loopRow: r,
      });
    }

    for (const row of events.data ?? []) {
      const calendar: CalendarKey =
        row.kind === "holiday" ? "holidays" : row.kind === "blocked" ? "blocked" : "personal";
      const category: EventCategory =
        row.kind === "holiday" ? "holiday" : row.kind === "blocked" ? "blocked" : "personal";
      for (const occ of expandOccurrences(row, range.from, range.to)) {
        out.push({
          id: `event:${row.id}:${occ.start.toISOString()}`,
          sourceId: row.id,
          source: "event",
          calendar,
          category,
          title: row.title,
          start: occ.start,
          end: occ.end,
          allDay: row.all_day,
          subject: null,
          grade: null,
          tutorId: null,
          tutorName: null,
          studentId: null,
          studentName: null,
          status: null,
          meetingUrl: row.meeting_url,
          location: row.location,
          description: row.description,
          timeZone: row.time_zone ?? timeZone,
          online: !!row.meeting_url,
          movable: true,
          eventRow: row,
        });
      }
    }

    // Weekly tutor availability, expanded across the visible range.
    const startDay = new Date(range.from);
    startDay.setHours(0, 0, 0, 0);
    for (const slot of availability.data ?? []) {
      for (let d = new Date(startDay); d <= range.to; d = new Date(d.getTime() + DAY_MS)) {
        const zoned = utcToZoned(d, slot.time_zone ?? timeZone);
        if (zoned.getDay() !== slot.weekday) continue;
        const dateStr = wallDateStr(zoned);
        const s = zonedToUtc(dateStr, slot.start_time.slice(0, 5), slot.time_zone ?? timeZone);
        const e = zonedToUtc(dateStr, slot.end_time.slice(0, 5), slot.time_zone ?? timeZone);
        if (!inRange(s, e)) continue;
        out.push({
          id: `availability:${slot.id}:${dateStr}`,
          sourceId: slot.id,
          source: "availability",
          calendar: "availability",
          category: "availability",
          title: `${nameOf(slot.tutor_id) ?? "Tutor"} available`,
          start: s,
          end: e,
          allDay: false,
          subject: null,
          grade: null,
          tutorId: slot.tutor_id,
          tutorName: nameOf(slot.tutor_id),
          studentId: null,
          studentName: null,
          status: "available",
          meetingUrl: null,
          location: null,
          description: null,
          timeZone: slot.time_zone ?? timeZone,
          online: true,
          movable: false,
        });
      }
    }

    return out.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [classes.data, assignments.data, loop.data, events.data, availability.data, nameOf, range.from, range.to, timeZone]);

  return {
    events: list,
    isLoading: classes.isLoading || events.isLoading,
  };
}

/* ------------------------------------------------------------------ */
/* Preferences                                                         */
/* ------------------------------------------------------------------ */

export const VIEWS = ["day", "workweek", "week", "month", "agenda"] as const;
export type CalendarView = (typeof VIEWS)[number];

export const VIEW_LABEL: Record<CalendarView, string> = {
  day: "Day",
  workweek: "Work week",
  week: "Week",
  month: "Month",
  agenda: "Agenda",
};

export type CalendarFilters = {
  tutorId: string;
  studentId: string;
  subject: string;
  grade: string;
  status: string;
  category: string;
  mode: string;
};

export const EMPTY_FILTERS: CalendarFilters = {
  tutorId: "",
  studentId: "",
  subject: "",
  grade: "",
  status: "",
  category: "",
  mode: "",
};

export type CalendarPrefs = {
  view: CalendarView;
  timeZone: string;
  hidden: CalendarKey[];
  filters: CalendarFilters;
};

const LS_KEY = "mnc.calendar.prefs";

function readLocal(): Partial<CalendarPrefs> | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(LS_KEY) ?? "null");
  } catch {
    return null;
  }
}

export function useCalendarPrefs(userId: string | undefined, isMobile: boolean) {
  const [prefs, setPrefs] = useState<CalendarPrefs>(() => ({
    view: isMobile ? "agenda" : "week",
    timeZone: browserTimeZone(),
    hidden: [],
    filters: EMPTY_FILTERS,
    ...(readLocal() ?? {}),
  }));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId || loaded) return;
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from("calendar_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (!active) return;
      if (data) {
        setPrefs((prev) => ({
          view: (VIEWS as readonly string[]).includes(data.view) ? (data.view as CalendarView) : prev.view,
          timeZone: data.time_zone ?? prev.timeZone,
          hidden: (data.hidden_calendars ?? []) as CalendarKey[],
          filters: { ...EMPTY_FILTERS, ...((data.filters as Partial<CalendarFilters>) ?? {}) },
        }));
      }
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [userId, loaded]);

  const update = useCallback(
    (patch: Partial<CalendarPrefs>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...patch };
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(LS_KEY, JSON.stringify(next));
          } catch {
            /* ignore */
          }
        }
        if (userId) {
          void supabase.from("calendar_preferences").upsert(
            {
              user_id: userId,
              view: next.view,
              time_zone: next.timeZone,
              hidden_calendars: next.hidden,
              filters: next.filters,
            },
            { onConflict: "user_id" },
          );
        }
        return next;
      });
    },
    [userId],
  );

  return { prefs, update };
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export type CalendarEventInput = Omit<TablesInsert<"calendar_events">, "owner_id">;

export function useSaveCalendarEvent(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: CalendarEventInput }) => {
      if (id) {
        const { error } = await supabase.from("calendar_events").update(values).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("calendar_events")
        .insert({ ...values, owner_id: userId! })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar-events"] }),
  });
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("calendar_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar-events"] }),
  });
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

export async function logCalendarChange(entry: {
  actorId: string;
  actorRole?: string | null;
  source: EventSource;
  sourceId: string;
  action: string;
  field?: string | null;
  previous?: string | null;
  next?: string | null;
}) {
  try {
    await supabase.from("event_history").insert({
      actor_id: entry.actorId,
      actor_role: entry.actorRole ?? null,
      source: entry.source,
      source_id: entry.sourceId,
      action: entry.action,
      field: entry.field ?? null,
      previous_value: entry.previous ?? null,
      new_value: entry.next ?? null,
    });
  } catch (error) {
    console.error("calendar history failed", error);
  }
}

export function useEventHistory(source: EventSource | undefined, sourceId: string | undefined) {
  return useQuery({
    queryKey: ["event-history", source, sourceId],
    enabled: !!source && !!sourceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_history")
        .select("*")
        .eq("source", source!)
        .eq("source_id", sourceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ------------------------------------------------------------------ */
/* Reminders                                                           */
/* ------------------------------------------------------------------ */

export const REMINDER_CHOICES = [
  { value: 0, label: "At event start" },
  { value: 5, label: "5 minutes before" },
  { value: 10, label: "10 minutes before" },
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 1440, label: "1 day before" },
];

export function useReminders(userId: string | undefined, source?: EventSource, sourceId?: string) {
  return useQuery({
    queryKey: ["event-reminders", userId, source, sourceId],
    enabled: !!userId && !!sourceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_reminders")
        .select("*")
        .eq("source", source!)
        .eq("source_id", sourceId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSetReminder(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      source: EventSource;
      sourceId: string;
      minutes: number;
      channel: string;
      enabled: boolean;
    }) => {
      if (!input.enabled) {
        const { error } = await supabase
          .from("event_reminders")
          .delete()
          .eq("user_id", userId!)
          .eq("source", input.source)
          .eq("source_id", input.sourceId)
          .eq("minutes_before", input.minutes)
          .eq("channel", input.channel);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("event_reminders").upsert(
        {
          user_id: userId!,
          source: input.source,
          source_id: input.sourceId,
          minutes_before: input.minutes,
          channel: input.channel,
        },
        { onConflict: "user_id,source,source_id,minutes_before,channel" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event-reminders"] }),
  });
}

/* ------------------------------------------------------------------ */
/* ICS export                                                          */
/* ------------------------------------------------------------------ */

function icsStamp(d: Date) {
  return `${d.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function escapeIcs(text: string) {
  return text.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

export function buildIcs(events: CalEvent[], calendarName = "myNexClass") {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//myNexClass//Calendar//EN",
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@mynexclass`,
      `DTSTAMP:${icsStamp(new Date())}`,
      `DTSTART:${icsStamp(e.start)}`,
      `DTEND:${icsStamp(e.end)}`,
      `SUMMARY:${escapeIcs(e.title)}`,
      `DESCRIPTION:${escapeIcs(
        [e.subject && `Subject: ${e.subject}`, e.tutorName && `Tutor: ${e.tutorName}`, e.studentName && `Student: ${e.studentName}`, e.description]
          .filter(Boolean)
          .join("\n"),
      )}`,
      e.meetingUrl ? `URL:${e.meetingUrl}` : `LOCATION:${escapeIcs(e.location ?? "Online")}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(events: CalEvent[], fileName = "mynexclass.ics") {
  const blob = new Blob([buildIcs(events)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function googleCalendarUrl(e: CalEvent) {
  const fmt = (d: Date) => icsStamp(d);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${fmt(e.start)}/${fmt(e.end)}`,
    details: [e.description, e.meetingUrl].filter(Boolean).join("\n"),
    location: e.location ?? e.meetingUrl ?? "Online",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(e: CalEvent) {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    startdt: e.start.toISOString(),
    enddt: e.end.toISOString(),
    body: [e.description, e.meetingUrl].filter(Boolean).join("\n"),
    location: e.location ?? e.meetingUrl ?? "Online",
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/* ------------------------------------------------------------------ */
/* Filtering / search                                                  */
/* ------------------------------------------------------------------ */

export function applyCalendarFilters(
  events: CalEvent[],
  hidden: CalendarKey[],
  filters: CalendarFilters,
  search: string,
) {
  const q = search.trim().toLowerCase();
  return events.filter((e) => {
    if (hidden.includes(e.calendar)) return false;
    if (filters.tutorId && e.tutorId !== filters.tutorId) return false;
    if (filters.studentId && e.studentId !== filters.studentId) return false;
    if (filters.subject && (e.subject ?? "").toLowerCase() !== filters.subject.toLowerCase()) return false;
    if (filters.grade && (e.grade ?? "") !== filters.grade) return false;
    if (filters.status && (e.status ?? "") !== filters.status) return false;
    if (filters.category && e.category !== filters.category) return false;
    if (filters.mode === "online" && !e.online) return false;
    if (filters.mode === "in_person" && e.online) return false;
    if (!q) return true;
    return [e.title, e.subject, e.tutorName, e.studentName, e.sourceId, e.description]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });
}

/** Side-by-side layout for overlapping events in a day column. */
export function layoutOverlaps<T extends { start: Date; end: Date }>(items: T[]) {
  const sorted = [...items].sort((a, b) => a.start.getTime() - b.start.getTime());
  const placed: { item: T; column: number; columns: number }[] = [];
  let cluster: { item: T; column: number }[] = [];
  let clusterEnd = 0;

  const flush = () => {
    const columns = cluster.reduce((max, c) => Math.max(max, c.column + 1), 1);
    for (const c of cluster) placed.push({ ...c, columns });
    cluster = [];
    clusterEnd = 0;
  };

  for (const item of sorted) {
    if (cluster.length && item.start.getTime() >= clusterEnd) flush();
    const taken = new Set(
      cluster.filter((c) => c.item.end.getTime() > item.start.getTime()).map((c) => c.column),
    );
    let column = 0;
    while (taken.has(column)) column += 1;
    cluster.push({ item, column });
    clusterEnd = Math.max(clusterEnd, item.end.getTime());
  }
  if (cluster.length) flush();
  return placed;
}
