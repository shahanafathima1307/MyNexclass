import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  format,
} from "date-fns";
import { ChevronLeft, ChevronRight, Download, Filter, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarSidebar } from "@/components/calendar/calendar-sidebar";
import { AgendaList, MonthGrid, TimeGrid, toDayCells } from "@/components/calendar/calendar-views";
import { EventDetails } from "@/components/calendar/event-details";
import { EventFormDialog, type EventFormSeed } from "@/components/calendar/event-form";
import { useSession } from "@/lib/session";
import { useMembers, useMyRole, useUpdateClass } from "@/lib/tutoring";
import {
  EMPTY_FILTERS,
  VIEWS,
  VIEW_LABEL,
  applyCalendarFilters,
  downloadIcs,
  logCalendarChange,
  useCalendarEvents,
  useCalendarPrefs,
  useSaveCalendarEvent,
  type CalEvent,
  type CalendarView,
} from "@/lib/calendar";
import { timeZoneOptions, utcToZoned, wallDateStr, zonedToUtcDate } from "@/lib/timezones";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — myNexClass" },
      {
        name: "description",
        content:
          "Outlook-style tutoring calendar with day, week, month and agenda views for classes, availability and assignments.",
      },
      { property: "og:title", content: "Calendar — myNexClass" },
      {
        property: "og:description",
        content: "Plan classes, availability, Loop requests and assignment deadlines in one calendar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalendarPage,
});

function rangeFor(view: CalendarView, anchor: Date) {
  if (view === "day") return { from: anchor, to: anchor };
  if (view === "workweek") {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    return { from: start, to: addDays(start, 4) };
  }
  if (view === "week") {
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    return { from: start, to: addDays(start, 6) };
  }
  if (view === "month") {
    return {
      from: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
      to: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }),
    };
  }
  return { from: anchor, to: addDays(anchor, 13) };
}

function CalendarPage() {
  const { user } = useSession();
  const isMobile = useIsMobile();
  const { prefs, update } = useCalendarPrefs(user?.id, isMobile);
  const { data: role } = useMyRole(user?.id);
  const { data: members } = useMembers();
  const updateClass = useUpdateClass();
  const saveEvent = useSaveCalendarEvent(user?.id);

  const [anchor, setAnchor] = useState(() => new Date());
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CalEvent | null>(null);
  const [formSeed, setFormSeed] = useState<EventFormSeed | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const view = prefs.view;
  const timeZone = prefs.timeZone;
  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);
  const { events, isLoading } = useCalendarEvents(user?.id, range, timeZone);

  const visible = useMemo(
    () => applyCalendarFilters(events, prefs.hidden, prefs.filters, search),
    [events, prefs.hidden, prefs.filters, search],
  );

  const days = useMemo(() => {
    const out: Date[] = [];
    for (let d = new Date(range.from); d <= range.to; d = addDays(d, 1)) out.push(new Date(d));
    return out;
  }, [range]);
  const cells = useMemo(() => toDayCells(days, timeZone), [days, timeZone]);

  const step = (dir: number) => {
    if (view === "month") setAnchor(addMonths(anchor, dir));
    else if (view === "day") setAnchor(addDays(anchor, dir));
    else if (view === "agenda") setAnchor(addDays(anchor, dir * 14));
    else setAnchor(addDays(anchor, dir * 7));
  };

  const openCreate = (start: Date, end: Date) => {
    setFormSeed({ start, end });
    setFormOpen(true);
  };

  const heading =
    view === "month"
      ? format(anchor, "MMMM yyyy")
      : view === "day"
        ? format(anchor, "EEEE d MMMM yyyy")
        : `${format(range.from, "d MMM")} – ${format(range.to, "d MMM yyyy")}`;

  async function commitMove(event: CalEvent, next: { start: Date; end: Date }) {
    if (!event.movable || !user) {
      toast.error("This item can't be moved from the calendar.");
      return;
    }
    const startUtc = zonedToUtcDate(next.start, timeZone);
    const endUtc = zonedToUtcDate(next.end, timeZone);
    const minutes = Math.max(15, Math.round((endUtc.getTime() - startUtc.getTime()) / 60_000));
    try {
      if (event.source === "class") {
        await updateClass.mutateAsync({
          id: event.sourceId,
          patch: { starts_at: startUtc.toISOString(), duration_minutes: minutes },
        });
      } else if (event.source === "event") {
        await saveEvent.mutateAsync({
          id: event.sourceId,
          values: {
            kind: event.eventRow?.kind ?? "personal",
            title: event.title,
            starts_at: startUtc.toISOString(),
            ends_at: endUtc.toISOString(),
            time_zone: event.timeZone,
          },
        });
      } else {
        toast.error("Only classes and personal events can be dragged.");
        return;
      }
      await logCalendarChange({
        actorId: user.id,
        actorRole: role,
        source: event.source,
        sourceId: event.sourceId,
        action: "rescheduled",
        field: "starts_at",
        previous: event.start.toISOString(),
        next: startUtc.toISOString(),
      });
      toast.success("Rescheduled.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reschedule.");
    }
  }

  const tutors = (members ?? []).filter((m) => m.role === "tutor");
  const students = (members ?? []).filter((m) => m.role === "student");
  const subjects = [...new Set(events.map((e) => e.subject).filter(Boolean))] as string[];

  const filtersPanel = (
    <div className="grid gap-3">
      <div>
        <Label>Tutor</Label>
        <Select
          value={prefs.filters.tutorId || "all"}
          onValueChange={(v) => update({ filters: { ...prefs.filters, tutorId: v === "all" ? "" : v } })}
        >
          <SelectTrigger><SelectValue placeholder="All tutors" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tutors</SelectItem>
            {tutors.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Student</Label>
        <Select
          value={prefs.filters.studentId || "all"}
          onValueChange={(v) => update({ filters: { ...prefs.filters, studentId: v === "all" ? "" : v } })}
        >
          <SelectTrigger><SelectValue placeholder="All students" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All students</SelectItem>
            {students.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Subject</Label>
        <Select
          value={prefs.filters.subject || "all"}
          onValueChange={(v) => update({ filters: { ...prefs.filters, subject: v === "all" ? "" : v } })}
        >
          <SelectTrigger><SelectValue placeholder="All subjects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Status</Label>
        <Select
          value={prefs.filters.status || "all"}
          onValueChange={(v) => update({ filters: { ...prefs.filters, status: v === "all" ? "" : v } })}
        >
          <SelectTrigger><SelectValue placeholder="Any status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Mode</Label>
        <Select
          value={prefs.filters.mode || "all"}
          onValueChange={(v) => update({ filters: { ...prefs.filters, mode: v === "all" ? "" : v } })}
        >
          <SelectTrigger><SelectValue placeholder="Any mode" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any mode</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="in_person">In person</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button variant="ghost" size="sm" onClick={() => update({ filters: EMPTY_FILTERS })}>
        Clear filters
      </Button>
    </div>
  );

  return (
    <AppShell
      title="Calendar"
      subtitle={heading}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => openCreate(new Date(), new Date(Date.now() + 3_600_000))}>
            <Plus className="size-4" /> New event
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadIcs(visible)}>
            <Download className="size-4" /> Export
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-2">
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => step(-1)} aria-label="Previous">
              <ChevronLeft className="size-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAnchor(new Date())}>
              Today
            </Button>
            <Button size="icon" variant="ghost" onClick={() => step(1)} aria-label="Next">
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1 rounded-full bg-muted p-1">
            {VIEWS.map((v) => (
              <Button
                key={v}
                size="sm"
                variant={view === v ? "default" : "ghost"}
                className="rounded-full"
                onClick={() => update({ view: v })}
              >
                {VIEW_LABEL[v]}
              </Button>
            ))}
          </div>

          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events, people, subjects"
              className="pl-9"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline">
                <Filter className="size-4" /> Filters
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72">{filtersPanel}</PopoverContent>
          </Popover>

          <Select value={timeZone} onValueChange={(v) => update({ timeZone: v })}>
            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-64">
              {timeZoneOptions(timeZone).map((tz) => (
                <SelectItem key={tz} value={tz}>{tz.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm" variant="ghost" className="lg:hidden">
                Calendars
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle>Calendars</SheetTitle>
              </SheetHeader>
              <div className="px-4">
                <CalendarSidebar
                  anchor={anchor}
                  selected={anchor}
                  markers={events.map((e) => e.start)}
                  hidden={prefs.hidden}
                  onSelectDate={(d) => setAnchor(d)}
                  onToggleCalendar={(key, vis) =>
                    update({
                      hidden: vis ? prefs.hidden.filter((k) => k !== key) : [...prefs.hidden, key],
                    })
                  }
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <CalendarSidebar
              anchor={anchor}
              selected={anchor}
              markers={events.map((e) => e.start)}
              hidden={prefs.hidden}
              onSelectDate={(d) => setAnchor(d)}
              onToggleCalendar={(key, vis) =>
                update({
                  hidden: vis ? prefs.hidden.filter((k) => k !== key) : [...prefs.hidden, key],
                })
              }
            />
          </aside>

          <section className="min-w-0">
            {isLoading ? (
              <Skeleton className="h-[600px] w-full rounded-2xl" />
            ) : view === "month" ? (
              <MonthGrid
                cells={cells}
                events={visible}
                timeZone={timeZone}
                month={anchor.getMonth()}
                onOpen={setSelected}
                onPickDay={(key) => {
                  setAnchor(new Date(`${key}T12:00:00`));
                  update({ view: "day" });
                }}
              />
            ) : view === "agenda" ? (
              <AgendaList events={visible} timeZone={timeZone} onOpen={setSelected} />
            ) : (
              <TimeGrid
                days={cells}
                events={visible}
                timeZone={timeZone}
                onOpen={setSelected}
                onCommitMove={commitMove}
                onQuickCreate={(start, end) =>
                  openCreate(zonedToUtcDate(start, timeZone), zonedToUtcDate(end, timeZone))
                }
              />
            )}
          </section>
        </div>
      </div>

      <EventDetails
        event={selected}
        userId={user?.id ?? ""}
        role={role ?? undefined}
        timeZone={timeZone}
        onClose={() => setSelected(null)}
        onEdit={(event) => {
          setSelected(null);
          setFormSeed({
            start: event.start,
            end: event.end,
            edit: event.sourceId ? event : null,
            title: event.title,
          });
          setFormOpen(true);
        }}
      />

      <EventFormDialog
        open={formOpen}
        seed={formSeed}
        userId={user?.id ?? ""}
        timeZone={timeZone}
        role={role ?? undefined}
        onOpenChange={setFormOpen}
      />
    </AppShell>
  );
}

/* keeps wallDateStr/utcToZoned imported for future grid helpers */
void wallDateStr;
void utcToZoned;
