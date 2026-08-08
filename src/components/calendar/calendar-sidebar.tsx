import { useMemo, useState } from "react";
import {
  addMonths,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  CALENDAR_KEYS,
  CALENDAR_LABEL,
  CATEGORY_LABEL,
  CATEGORY_STYLE,
  type CalendarKey,
  type EventCategory,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";

const LEGEND: EventCategory[] = [
  "class",
  "live",
  "completed",
  "cancelled",
  "trial",
  "availability",
  "assignment",
  "loop",
  "personal",
  "blocked",
  "holiday",
];

const CALENDAR_DOT: Record<CalendarKey, EventCategory> = {
  classes: "class",
  availability: "availability",
  assignments: "assignment",
  loop: "loop",
  personal: "personal",
  blocked: "blocked",
  holidays: "holiday",
};

export function MiniMonth({
  anchor,
  selected,
  markers,
  onSelect,
}: {
  anchor: Date;
  selected: Date;
  markers: Date[];
  onSelect: (date: Date) => void;
}) {
  const [cursor, setCursor] = useState(startOfMonth(anchor));
  const today = new Date();

  const days = useMemo(() => {
    const first = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const list: Date[] = [];
    for (let i = 0; i < 42; i += 1) list.push(new Date(first.getTime() + i * 86_400_000));
    return list;
  }, [cursor]);

  const marked = useMemo(() => new Set(markers.map((d) => d.toDateString())), [markers]);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">{format(cursor, "MMMM yyyy")}</span>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label="Previous month"
            onClick={() => setCursor(addMonths(cursor, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label="Next month"
            onClick={() => setCursor(addMonths(cursor, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] uppercase text-muted-foreground">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={`${d}${i}`}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-0.5">
        {days.map((day) => {
          const isSel = isSameDay(day, selected);
          const isToday = isSameDay(day, today);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect(day)}
              className={cn(
                "relative aspect-square rounded-md text-xs transition-colors",
                isSameMonth(day, cursor) ? "text-foreground" : "text-muted-foreground/50",
                isToday && !isSel && "font-bold text-primary ring-1 ring-primary/40",
                isSel ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {day.getDate()}
              {marked.has(day.toDateString()) && !isSel ? (
                <span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent" />
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        {format(endOfMonth(cursor), "MMMM")} · tap a day to jump
      </p>
    </div>
  );
}

export function CalendarSidebar({
  anchor,
  selected,
  markers,
  hidden,
  onSelectDate,
  onToggleCalendar,
}: {
  anchor: Date;
  selected: Date;
  markers: Date[];
  hidden: CalendarKey[];
  onSelectDate: (d: Date) => void;
  onToggleCalendar: (key: CalendarKey, visible: boolean) => void;
}) {
  const mine: CalendarKey[] = ["classes", "personal", "blocked", "assignments"];
  const shared: CalendarKey[] = ["availability", "loop", "holidays"];

  const renderGroup = (title: string, keys: CalendarKey[]) => (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {keys.map((key) => (
        <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={!hidden.includes(key)}
            onCheckedChange={(v) => onToggleCalendar(key, v === true)}
          />
          <span className={cn("size-2.5 rounded-full", CATEGORY_STYLE[CALENDAR_DOT[key]].dot)} />
          <span className="truncate">{CALENDAR_LABEL[key]}</span>
        </label>
      ))}
    </div>
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pb-6">
      <MiniMonth anchor={anchor} selected={selected} markers={markers} onSelect={onSelectDate} />
      {renderGroup("My calendars", mine)}
      <Separator />
      {renderGroup("Shared calendars", shared)}
      <Separator />
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Legend</p>
        <div className="grid grid-cols-1 gap-1.5">
          {LEGEND.map((c) => (
            <span key={c} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("size-2.5 rounded-full", CATEGORY_STYLE[c].dot)} />
              {CATEGORY_LABEL[c]}
            </span>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Showing {CALENDAR_KEYS.length - hidden.length} of {CALENDAR_KEYS.length} calendars.
      </p>
    </div>
  );
}
