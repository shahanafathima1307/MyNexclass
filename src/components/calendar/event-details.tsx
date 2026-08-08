import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  CalendarPlus,
  Check,
  Copy,
  Download,
  ExternalLink,
  MessageSquare,
  Pencil,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useDeleteClass, useUpdateClass } from "@/lib/tutoring";
import { notify } from "@/lib/messaging";
import { normalizeMeetingUrl } from "@/components/class-card";
import {
  CATEGORY_LABEL,
  CATEGORY_STYLE,
  REMINDER_CHOICES,
  downloadIcs,
  googleCalendarUrl,
  logCalendarChange,
  outlookCalendarUrl,
  useDeleteCalendarEvent,
  useEventHistory,
  useReminders,
  useSetReminder,
  type CalEvent,
} from "@/lib/calendar";
import { formatInZone, zoneAbbrev } from "@/lib/timezones";
import { cn } from "@/lib/utils";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right font-medium">{value}</span>
    </div>
  );
}

export function EventDetails({
  event,
  userId,
  role,
  timeZone,
  onClose,
  onEdit,
}: {
  event: CalEvent | null;
  userId: string;
  role: string | undefined;
  timeZone: string;
  onClose: () => void;
  onEdit: (event: CalEvent) => void;
}) {
  const updateClass = useUpdateClass();
  const deleteClass = useDeleteClass();
  const deleteEvent = useDeleteCalendarEvent();
  const { data: history } = useEventHistory(event?.source, event?.sourceId);
  const { data: reminders } = useReminders(userId, event?.source, event?.sourceId);
  const saveReminder = useSetReminder(userId);
  const [marking, setMarking] = useState(false);

  if (!event) return null;

  const otherZone = event.timeZone !== timeZone ? event.timeZone : null;
  const canManage = role === "admin" || event.tutorId === userId || event.eventRow?.owner_id === userId;
  const joinUrl = event.meetingUrl ? normalizeMeetingUrl(event.meetingUrl) : null;
  const reminderValue = String(reminders?.[0]?.minutes_before ?? "none");

  async function cancelClass() {
    if (!event || event.source !== "class") return;
    await updateClass.mutateAsync({ id: event.sourceId, patch: { status: "cancelled" } });
    await logCalendarChange({
      actorId: userId,
      actorRole: role,
      source: "class",
      sourceId: event.sourceId,
      action: "cancelled",
      field: "status",
      previous: event.status,
      next: "cancelled",
    });
    for (const person of [event.tutorId, event.studentId].filter((id) => id && id !== userId)) {
      await notify({
        userId: person!,
        title: "Class cancelled",
        body: `${event.title} on ${format(event.start, "d MMM HH:mm")} was cancelled.`,
        link: "/calendar",
        kind: "class",
      });
    }
    toast.success("Class cancelled and participants notified.");
    onClose();
  }

  async function removeEvent() {
    if (!event) return;
    if (event.source === "class") {
      await deleteClass.mutateAsync(event.sourceId);
    } else if (event.source === "event") {
      await deleteEvent.mutateAsync(event.sourceId);
    } else {
      toast.error("This item is managed on its own page.");
      return;
    }
    await logCalendarChange({
      actorId: userId,
      actorRole: role,
      source: event.source,
      sourceId: event.sourceId,
      action: "deleted",
    });
    toast.success("Event deleted.");
    onClose();
  }

  async function markAttendance() {
    if (!event || event.source !== "class") return;
    setMarking(true);
    const { error } = await supabase.from("class_attendance").insert({
      class_id: event.sourceId,
      user_id: userId,
      joined_at: new Date().toISOString(),
    });
    setMarking(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logCalendarChange({
      actorId: userId,
      actorRole: role,
      source: "class",
      sourceId: event.sourceId,
      action: "attendance",
      next: "present",
    });
    toast.success("Attendance recorded.");
  }

  return (
    <Sheet open={!!event} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <span className={cn("size-3 rounded-full", CATEGORY_STYLE[event.category].dot)} />
            <Badge variant="secondary">{CATEGORY_LABEL[event.category]}</Badge>
          </div>
          <SheetTitle className="text-left">{event.title}</SheetTitle>
          <SheetDescription className="text-left">
            {formatInZone(event.start, timeZone)} – {formatInZone(event.end, timeZone, {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}{" "}
            ({zoneAbbrev(event.start, timeZone)})
            {otherZone ? (
              <span className="mt-1 block">
                {formatInZone(event.start, otherZone)} ({zoneAbbrev(event.start, otherZone)}) for the other
                participant
              </span>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-1 px-4">
          <Row label="Subject" value={event.subject} />
          <Row label="Grade" value={event.grade} />
          <Row label="Tutor" value={event.tutorName} />
          <Row label="Student" value={event.studentName} />
          <Row label="Status" value={event.status} />
          <Row label="Meeting" value={event.online ? "Online" : (event.location ?? "In person")} />
          <Row label="Timezone" value={event.timeZone.replace(/_/g, " ")} />
          {event.description ? (
            <p className="whitespace-pre-wrap pt-2 text-sm text-muted-foreground">{event.description}</p>
          ) : null}
        </div>

        <Separator className="my-4" />

        <div className="space-y-3 px-4">
          {event.source === "class" ? (
            <div className="flex flex-wrap gap-2">
              {event.meeting?.canJoin ? (
                joinUrl ? (
                  <Button asChild size="sm">
                    <a href={joinUrl} target="_blank" rel="noreferrer">
                      <Video className="size-4" /> Join now
                    </a>
                  </Button>
                ) : (
                  <Button asChild size="sm">
                    <Link to="/room/$classId" params={{ classId: event.sourceId }}>
                      <Video className="size-4" /> Join now
                    </Link>
                  </Button>
                )
              ) : (
                <Button size="sm" variant="secondary" disabled>
                  {event.meeting?.label ?? "Waiting"}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={markAttendance} disabled={marking}>
                <Check className="size-4" /> Mark attendance
              </Button>
            </div>
          ) : null}

          {event.source === "assignment" ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/assignments">Open assignment</Link>
            </Button>
          ) : null}

          {event.source === "loop" ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/loop">Open Loop request</Link>
            </Button>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {canManage && (event.source === "class" || event.source === "event") ? (
              <>
                <Button size="sm" variant="outline" onClick={() => onEdit(event)}>
                  <Pencil className="size-4" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onEdit({
                      ...event,
                      id: `${event.id}:copy`,
                      sourceId: "",
                      title: `${event.title} (copy)`,
                    })
                  }
                >
                  <Copy className="size-4" /> Duplicate
                </Button>
                {event.source === "class" && event.status !== "cancelled" ? (
                  <Button size="sm" variant="outline" onClick={cancelClass}>
                    <X className="size-4" /> Cancel
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={removeEvent}>
                  <Trash2 className="size-4" /> Delete
                </Button>
              </>
            ) : null}
            {event.studentId || event.tutorId ? (
              <Button asChild size="sm" variant="ghost">
                <Link to="/messages">
                  <MessageSquare className="size-4" /> Message
                </Link>
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => downloadIcs([event], "event.ics")}>
              <Download className="size-4" /> ICS
            </Button>
            <Button asChild size="sm" variant="ghost">
              <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer">
                <CalendarPlus className="size-4" /> Google
              </a>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <a href={outlookCalendarUrl(event)} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Outlook
              </a>
            </Button>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Reminder</p>
            <Select
              value={reminderValue}
              onValueChange={(value) => {
                const existing = reminders?.[0]?.minutes_before;
                if (existing !== undefined) {
                  void saveReminder.mutateAsync({
                    source: event.source,
                    sourceId: event.sourceId,
                    minutes: existing,
                    channel: "in_app",
                    enabled: false,
                  });
                }
                if (value !== "none") {
                  void saveReminder.mutateAsync({
                    source: event.source,
                    sourceId: event.sourceId,
                    minutes: Number(value),
                    channel: "in_app",
                    enabled: true,
                  });
                }
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No reminder</SelectItem>
                {REMINDER_CHOICES.map((r) => (
                  <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">History</p>
            {history?.length ? (
              <ul className="space-y-2 text-xs text-muted-foreground">
                {history.map((h) => (
                  <li key={h.id} className="rounded-md border border-border p-2">
                    <span className="font-medium text-foreground">{h.action}</span>
                    {h.field ? ` · ${h.field}` : ""} · {format(new Date(h.created_at), "d MMM HH:mm")}
                    {h.actor_role ? ` · ${h.actor_role}` : ""}
                    {h.previous_value || h.new_value ? (
                      <span className="mt-1 block">
                        {h.previous_value ?? "—"} → {h.new_value ?? "—"}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No changes recorded yet.</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
