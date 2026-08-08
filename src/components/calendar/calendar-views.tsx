import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { Video } from "lucide-react";
import {
  CATEGORY_STYLE,
  layoutOverlaps,
  type CalEvent,
} from "@/lib/calendar";
import { utcToZoned, wallDateStr, zonedToUtc } from "@/lib/timezones";
import { cn } from "@/lib/utils";

export const HOUR_PX = 48;
const SNAP = 15;

export type DayCell = { key: string; date: Date };

/** Builds zoned day cells for a list of real dates. */
export function toDayCells(dates: Date[], timeZone: string): DayCell[] {
  return dates.map((d) => {
    const z = utcToZoned(d, timeZone);
    return { key: wallDateStr(z), date: z };
  });
}

function minutesInDay(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

function timeLabel(d: Date) {
  return format(d, "HH:mm");
}

type DragState = {
  id: string;
  mode: "move" | "resize";
  originY: number;
  originX: number;
  deltaMin: number;
  deltaDays: number;
};

export function TimeGrid({
  days,
  events,
  timeZone,
  onOpen,
  onCommitMove,
  onQuickCreate,
}: {
  days: DayCell[];
  events: CalEvent[];
  timeZone: string;
  onOpen: (e: CalEvent) => void;
  onCommitMove: (e: CalEvent, next: { start: Date; end: Date }) => void;
  onQuickCreate: (start: Date, end: Date) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [draft, setDraft] = useState<{ dayKey: string; from: number; to: number } | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      const key = wallDateStr(utcToZoned(e.start, timeZone));
      const bucket = map.get(key) ?? [];
      bucket.push(e);
      map.set(key, bucket);
    }
    return map;
  }, [events, timeZone]);

  useEffect(() => {
    if (!drag) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrag(null);
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [drag]);

  const colWidth = () => {
    const el = bodyRef.current;
    if (!el) return 1;
    return (el.clientWidth - 56) / Math.max(days.length, 1);
  };

  function beginDrag(event: React.PointerEvent, item: CalEvent, mode: "move" | "resize") {
    if (!item.movable) return;
    event.stopPropagation();
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    setDrag({ id: item.id, mode, originY: event.clientY, originX: event.clientX, deltaMin: 0, deltaDays: 0 });
  }

  function onPointerMove(event: React.PointerEvent) {
    if (drag) {
      const dy = event.clientY - drag.originY;
      const dx = event.clientX - drag.originX;
      const rawMin = (dy / HOUR_PX) * 60;
      const deltaMin = Math.round(rawMin / SNAP) * SNAP;
      const deltaDays = drag.mode === "move" ? Math.round(dx / colWidth()) : 0;
      if (deltaMin !== drag.deltaMin || deltaDays !== drag.deltaDays) {
        setDrag({ ...drag, deltaMin, deltaDays });
      }
      return;
    }
    if (draft) {
      const rect = bodyRef.current?.getBoundingClientRect();
      if (!rect) return;
      const y = event.clientY - rect.top + (bodyRef.current?.scrollTop ?? 0);
      const mins = Math.round(((y / HOUR_PX) * 60) / SNAP) * SNAP;
      setDraft({ ...draft, to: Math.max(mins, draft.from + SNAP) });
    }
  }

  function finishDrag() {
    if (!drag) return;
    const item = events.find((e) => e.id === drag.id);
    if (item && (drag.deltaMin !== 0 || drag.deltaDays !== 0)) {
      const zStart = utcToZoned(item.start, timeZone);
      const zEnd = utcToZoned(item.end, timeZone);
      if (drag.mode === "move") {
        const day = new Date(zStart.getTime() + drag.deltaDays * 86_400_000);
        const startMin = minutesInDay(zStart) + drag.deltaMin;
        const length = zEnd.getTime() - zStart.getTime();
        const start = zonedToUtc(wallDateStr(day), fmtMinutes(startMin), timeZone);
        onCommitMove(item, { start, end: new Date(start.getTime() + length) });
      } else {
        const endMin = minutesInDay(zEnd) + drag.deltaMin;
        const end = zonedToUtc(wallDateStr(zEnd), fmtMinutes(endMin), timeZone);
        if (end.getTime() - item.start.getTime() >= 15 * 60_000) {
          onCommitMove(item, { start: item.start, end });
        }
      }
    }
    setDrag(null);
  }

  function finishDraft() {
    if (!draft) return;
    const start = zonedToUtc(draft.dayKey, fmtMinutes(Math.min(draft.from, draft.to)), timeZone);
    const end = zonedToUtc(draft.dayKey, fmtMinutes(Math.max(draft.to, draft.from + 30)), timeZone);
    setDraft(null);
    onQuickCreate(start, end);
  }

  const today = wallDateStr(utcToZoned(new Date(), timeZone));
  const nowMinutes = minutesInDay(utcToZoned(new Date(), timeZone));

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex border-b border-border bg-muted/40">
        <div className="w-14 shrink-0" />
        {days.map((day) => (
          <div key={day.key} className="min-w-0 flex-1 px-2 py-2 text-center">
            <p className="text-[11px] uppercase text-muted-foreground">{format(day.date, "EEE")}</p>
            <p
              className={cn(
                "text-lg font-semibold",
                day.key === today && "text-primary",
              )}
            >
              {format(day.date, "d")}
            </p>
          </div>
        ))}
      </div>

      <div
        ref={bodyRef}
        className="relative flex-1 overflow-auto"
        onPointerMove={onPointerMove}
        onPointerUp={() => {
          finishDrag();
          finishDraft();
        }}
        onPointerLeave={() => setDrag(null)}
      >
        <div className="flex" style={{ height: 24 * HOUR_PX }}>
          <div className="w-14 shrink-0 border-r border-border">
            {Array.from({ length: 24 }).map((_, hour) => (
              <div
                key={hour}
                className="relative text-[10px] text-muted-foreground"
                style={{ height: HOUR_PX }}
              >
                <span className="absolute -top-1.5 right-1">{String(hour).padStart(2, "0")}:00</span>
              </div>
            ))}
          </div>

          {days.map((day) => {
            const dayEvents = byDay.get(day.key) ?? [];
            const placed = layoutOverlaps(dayEvents);
            return (
              <div
                key={day.key}
                className="relative min-w-0 flex-1 border-r border-border/60 last:border-r-0"
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  const rect = bodyRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  const y = event.clientY - rect.top + (bodyRef.current?.scrollTop ?? 0);
                  const mins = Math.floor(((y / HOUR_PX) * 60) / SNAP) * SNAP;
                  setDraft({ dayKey: day.key, from: mins, to: mins + 30 });
                }}
              >
                {Array.from({ length: 24 }).map((_, hour) => (
                  <div
                    key={hour}
                    className="border-b border-border/50"
                    style={{ height: HOUR_PX }}
                  />
                ))}

                {day.key === today ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-cal-live"
                    style={{ top: (nowMinutes / 60) * HOUR_PX }}
                  >
                    <span className="absolute -left-1 -top-1 size-2 rounded-full bg-cal-live" />
                  </div>
                ) : null}

                {draft && draft.dayKey === day.key ? (
                  <div
                    className="pointer-events-none absolute inset-x-1 z-20 rounded-md border border-primary/60 bg-primary/15"
                    style={{
                      top: (Math.min(draft.from, draft.to) / 60) * HOUR_PX,
                      height: (Math.abs(draft.to - draft.from) / 60) * HOUR_PX,
                    }}
                  />
                ) : null}

                {placed.map(({ item, column, columns }) => {
                  const isDragging = drag?.id === item.id;
                  const shiftMin = isDragging && drag ? drag.deltaMin : 0;
                  const shiftDay = isDragging && drag?.mode === "move" ? drag.deltaDays : 0;
                  const zStart = utcToZoned(item.start, timeZone);
                  const zEnd = utcToZoned(item.end, timeZone);
                  const top =
                    ((minutesInDay(zStart) + (drag?.mode === "resize" ? 0 : shiftMin)) / 60) * HOUR_PX;
                  const height = Math.max(
                    ((minutesInDay(zEnd) - minutesInDay(zStart) + (drag?.mode === "resize" ? shiftMin : 0)) /
                      60) *
                      HOUR_PX,
                    22,
                  );
                  const style = CATEGORY_STYLE[item.category];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onPointerDown={(e) => beginDrag(e, item, "move")}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!drag) onOpen(item);
                      }}
                      className={cn(
                        "absolute z-10 overflow-hidden rounded-md border px-1.5 py-1 text-left text-[11px] shadow-soft transition-shadow",
                        style.chip,
                        isDragging && "opacity-80 shadow-lift",
                        item.movable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                      )}
                      style={{
                        top,
                        height,
                        left: `calc(${(column / columns) * 100}% + 2px)`,
                        width: `calc(${100 / columns}% - 4px)`,
                        transform: shiftDay ? `translateX(${shiftDay * 100}%)` : undefined,
                      }}
                    >
                      <span className={cn("absolute inset-y-0 left-0 w-1", style.bar)} />
                      <span className="ml-1 block truncate font-semibold">{item.title}</span>
                      <span className="ml-1 block truncate text-[10px] opacity-80">
                        {timeLabel(zStart)}–{timeLabel(zEnd)}
                        {item.subject ? ` · ${item.subject}` : ""}
                      </span>
                      {height > 54 ? (
                        <span className="ml-1 block truncate text-[10px] opacity-70">
                          {[item.tutorName, item.studentName].filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                      {item.meeting?.canJoin ? (
                        <span className="ml-1 mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-cal-live">
                          <Video className="size-3" /> Join now
                        </span>
                      ) : null}
                      {item.movable ? (
                        <span
                          role="presentation"
                          onPointerDown={(e) => beginDrag(e, item, "resize")}
                          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function fmtMinutes(total: number) {
  const clamped = Math.max(0, Math.min(total, 24 * 60 - 5));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function MonthGrid({
  cells,
  events,
  timeZone,
  month,
  onOpen,
  onPickDay,
}: {
  cells: DayCell[];
  events: CalEvent[];
  timeZone: string;
  month: number;
  onOpen: (e: CalEvent) => void;
  onPickDay: (key: string) => void;
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      const key = wallDateStr(utcToZoned(e.start, timeZone));
      const bucket = map.get(key) ?? [];
      bucket.push(e);
      map.set(key, bucket);
    }
    return map;
  }, [events, timeZone]);
  const today = wallDateStr(utcToZoned(new Date(), timeZone));

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-[11px] uppercase text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d} className="py-2">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const dayEvents = (byDay.get(cell.key) ?? []).slice(0, 4);
          const total = (byDay.get(cell.key) ?? []).length;
          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onPickDay(cell.key)}
              className={cn(
                "min-h-24 border-b border-r border-border/60 p-1.5 text-left align-top transition-colors hover:bg-muted/50",
                cell.date.getMonth() !== month && "bg-muted/20 text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                  cell.key === today && "bg-primary text-primary-foreground",
                )}
              >
                {cell.date.getDate()}
              </span>
              <span className="mt-1 block space-y-0.5">
                {dayEvents.map((e) => (
                  <span
                    key={e.id}
                    role="presentation"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onOpen(e);
                    }}
                    className={cn(
                      "flex items-center gap-1 truncate rounded px-1 text-[10px]",
                      CATEGORY_STYLE[e.category].chip,
                    )}
                  >
                    <span className={cn("size-1.5 shrink-0 rounded-full", CATEGORY_STYLE[e.category].dot)} />
                    <span className="truncate">
                      {format(utcToZoned(e.start, timeZone), "HH:mm")} {e.title}
                    </span>
                  </span>
                ))}
                {total > dayEvents.length ? (
                  <span className="block text-[10px] text-muted-foreground">
                    +{total - dayEvents.length} more
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AgendaList({
  events,
  timeZone,
  onOpen,
}: {
  events: CalEvent[];
  timeZone: string;
  onOpen: (e: CalEvent) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      const key = wallDateStr(utcToZoned(e.start, timeZone));
      const bucket = map.get(key) ?? [];
      bucket.push(e);
      map.set(key, bucket);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [events, timeZone]);

  if (!groups.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Nothing scheduled in this range.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(([key, list]) => (
        <div key={key} className="rounded-xl border border-border bg-card">
          <p className="border-b border-border px-4 py-2 text-sm font-semibold">
            {format(new Date(`${key}T00:00:00`), "EEEE d MMMM")}
          </p>
          <div className="divide-y divide-border">
            {list.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => onOpen(e)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <span className={cn("h-10 w-1 shrink-0 rounded-full", CATEGORY_STYLE[e.category].bar)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{e.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {format(utcToZoned(e.start, timeZone), "HH:mm")}–
                    {format(utcToZoned(e.end, timeZone), "HH:mm")}
                    {e.subject ? ` · ${e.subject}` : ""}
                    {e.tutorName ? ` · ${e.tutorName}` : ""}
                  </span>
                </span>
                {e.meeting?.canJoin ? (
                  <span className="shrink-0 rounded-full bg-cal-live/15 px-2 py-1 text-[11px] font-semibold text-cal-live">
                    Join now
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
