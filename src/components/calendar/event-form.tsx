import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateClass, useMembers, useUpdateClass } from "@/lib/tutoring";
import { useAddSlot } from "@/lib/mentor";
import { useCreateLoopRequest } from "@/lib/loop";
import { notify } from "@/lib/messaging";
import {
  REMINDER_CHOICES,
  REPEAT_OPTIONS,
  logCalendarChange,
  useSaveCalendarEvent,
  useSetReminder,
  type CalEvent,
} from "@/lib/calendar";
import { timeZoneOptions, utcToZoned, wallDateStr, wallTimeStr, zonedToUtc } from "@/lib/timezones";

export type EventKind =
  | "class"
  | "trial"
  | "availability"
  | "blocked"
  | "personal"
  | "loop";

const KIND_LABEL: Record<EventKind, string> = {
  class: "Class",
  trial: "Trial class",
  availability: "Tutor availability",
  blocked: "Blocked time",
  personal: "Personal reminder",
  loop: "Loop class request",
};

export type EventFormSeed = {
  start: Date;
  end: Date;
  kind?: EventKind;
  title?: string;
  edit?: CalEvent | null;
};

export function EventFormDialog({
  open,
  seed,
  userId,
  timeZone,
  role,
  onOpenChange,
}: {
  open: boolean;
  seed: EventFormSeed | null;
  userId: string;
  timeZone: string;
  role: string | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: members } = useMembers();
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const saveEvent = useSaveCalendarEvent(userId);
  const addSlot = useAddSlot();
  const createLoop = useCreateLoopRequest();
  const saveReminder = useSetReminder(userId);

  const tutors = useMemo(() => (members ?? []).filter((m) => m.role === "tutor"), [members]);
  const students = useMemo(() => (members ?? []).filter((m) => m.role === "student"), [members]);

  const [kind, setKind] = useState<EventKind>("class");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [tutorId, setTutorId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [zone, setZone] = useState(timeZone);
  const [repeat, setRepeat] = useState("none");
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatEndMode, setRepeatEndMode] = useState("never");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [repeatCount, setRepeatCount] = useState(8);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [reminder, setReminder] = useState("10");
  const [notifyPeople, setNotifyPeople] = useState(true);

  useEffect(() => {
    if (!open || !seed) return;
    const zStart = utcToZoned(seed.start, timeZone);
    const zEnd = utcToZoned(seed.end, timeZone);
    const edit = seed.edit;
    setKind(seed.kind ?? (edit ? kindOf(edit) : "class"));
    setTitle(seed.title ?? edit?.title ?? "");
    setSubject(edit?.subject ?? "");
    setGrade(edit?.grade ?? "");
    setTutorId(edit?.tutorId ?? (role === "tutor" ? userId : ""));
    setStudentId(edit?.studentId ?? (role === "student" ? userId : ""));
    setDate(wallDateStr(zStart));
    setStartTime(wallTimeStr(zStart));
    setEndTime(wallTimeStr(zEnd));
    setZone(edit?.timeZone ?? timeZone);
    setMeetingUrl(edit?.meetingUrl ?? "");
    setLocation(edit?.location ?? "");
    setDescription(edit?.description ?? "");
    setRepeat(edit?.eventRow?.repeat_freq ?? "none");
    setRepeatInterval(edit?.eventRow?.repeat_interval ?? 1);
    setRepeatUntil(edit?.eventRow?.repeat_until ? edit.eventRow.repeat_until.slice(0, 10) : "");
    setRepeatEndMode(edit?.eventRow?.repeat_until ? "until" : edit?.eventRow?.repeat_count ? "count" : "never");
    setRepeatCount(edit?.eventRow?.repeat_count ?? 8);
    setNotifyPeople(true);
  }, [open, seed, timeZone, role, userId]);

  const isClassLike = kind === "class" || kind === "trial";
  const busy =
    createClass.isPending || saveEvent.isPending || addSlot.isPending || createLoop.isPending;

  async function submit() {
    if (!date) return;
    const start = zonedToUtc(date, startTime, zone);
    const end = zonedToUtc(date, endTime, zone);
    if (end <= start) {
      toast.error("End time must be after the start time.");
      return;
    }
    const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);

    try {
      if (isClassLike) {
        if (!tutorId || !studentId) {
          toast.error("Pick both a tutor and a student.");
          return;
        }
        const occurrences = buildClassOccurrences(start, repeat, repeatInterval, {
          mode: repeatEndMode,
          until: repeatUntil,
          count: repeatCount,
        });
        if (seed?.edit?.source === "class" && seed.edit.classRow) {
          await updateClass.mutateAsync({
            id: seed.edit.sourceId,
            patch: {
              title: title || "Class",
              subject: subject || null,
              starts_at: start.toISOString(),
              duration_minutes: minutes,
              meeting_url: meetingUrl || null,
              notes: description || null,
              tutor_id: tutorId,
              student_id: studentId,
              time_zone: zone,
              is_demo: kind === "trial",
            },
          });
          await logCalendarChange({
            actorId: userId,
            actorRole: role,
            source: "class",
            sourceId: seed.edit.sourceId,
            action: "updated",
            field: "schedule",
            previous: seed.edit.start.toISOString(),
            next: start.toISOString(),
          });
        } else {
          for (const occurrence of occurrences) {
            await createClass.mutateAsync({
              title: title || "Class",
              subject: subject || null,
              starts_at: occurrence.toISOString(),
              duration_minutes: minutes,
              meeting_url: meetingUrl || null,
              notes: description || null,
              tutor_id: tutorId,
              student_id: studentId,
              time_zone: zone,
              is_demo: kind === "trial",
            });
          }
        }
        if (notifyPeople) {
          for (const person of [tutorId, studentId].filter((id) => id && id !== userId)) {
            await notify({
              userId: person,
              title: seed?.edit ? "A class was updated" : "A new class was scheduled",
              body: `${title || "Class"} · ${date} ${startTime} (${zone})`,
              link: "/calendar",
              kind: "class",
            });
          }
        }
      } else if (kind === "availability") {
        const weekday = utcToZoned(start, zone).getDay();
        const repeats = repeat === "weekly" || repeat === "none" ? [weekday] : weekdaysFor(repeat, weekday);
        for (const day of repeats) {
          await addSlot.mutateAsync({
            tutor_id: tutorId || userId,
            weekday: day,
            start_time: startTime,
            end_time: endTime,
            time_zone: zone,
          });
        }
      } else if (kind === "loop") {
        await createLoop.mutateAsync({
          student_id: studentId || userId,
          subject: subject || title || "General",
          grade_level: grade || null,
          topic: title || null,
          duration_minutes: minutes,
          start_mode: "later",
          preferred_start: start.toISOString(),
          notes: description || null,
          timeout_minutes: 60,
        });
      } else {
        const id = await saveEvent.mutateAsync({
          id: seed?.edit?.source === "event" ? seed.edit.sourceId : undefined,
          values: {
            kind: kind === "blocked" ? "blocked" : "personal",
            title: title || KIND_LABEL[kind],
            description: description || null,
            location: location || null,
            meeting_url: meetingUrl || null,
            starts_at: start.toISOString(),
            ends_at: end.toISOString(),
            time_zone: zone,
            repeat_freq: repeat,
            repeat_interval: repeatInterval,
            repeat_until: repeatEndMode === "until" && repeatUntil ? new Date(`${repeatUntil}T23:59:00Z`).toISOString() : null,
            repeat_count: repeatEndMode === "count" ? repeatCount : null,
          },
        });
        if (reminder !== "none") {
          await saveReminder.mutateAsync({
            source: "event",
            sourceId: id,
            minutes: Number(reminder),
            channel: "in_app",
            enabled: true,
          });
        }
      }
      toast.success(seed?.edit ? "Event updated." : `${KIND_LABEL[kind]} created.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the event.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{seed?.edit ? "Edit event" : "Create event"}</DialogTitle>
          <DialogDescription>
            Times are saved in UTC and shown in each person&apos;s own timezone.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="ev-title">Title</Label>
            <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Algebra revision" />
          </div>

          <div>
            <Label>Event type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as EventKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABEL) as EventKind[]).map((k) => (
                  <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="ev-subject">Subject</Label>
            <Input id="ev-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          {(isClassLike || kind === "availability") && (
            <div>
              <Label>Tutor</Label>
              <Select value={tutorId} onValueChange={setTutorId}>
                <SelectTrigger><SelectValue placeholder="Select tutor" /></SelectTrigger>
                <SelectContent>
                  {tutors.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(isClassLike || kind === "loop") && (
            <div>
              <Label>Student</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="ev-grade">Grade</Label>
            <Input id="ev-grade" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Year 9" />
          </div>

          <div>
            <Label htmlFor="ev-date">Date</Label>
            <Input id="ev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="ev-start">Start</Label>
              <Input id="ev-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ev-end">End</Label>
              <Input id="ev-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Timezone</Label>
            <Select value={zone} onValueChange={setZone}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">
                {timeZoneOptions(zone).map((tz) => (
                  <SelectItem key={tz} value={tz}>{tz.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Repeat</Label>
            <Select value={repeat} onValueChange={setRepeat}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPEAT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {repeat !== "none" && (
            <>
              {repeat === "custom" && (
                <div>
                  <Label htmlFor="ev-interval">Every N weeks</Label>
                  <Input
                    id="ev-interval"
                    type="number"
                    min={1}
                    value={repeatInterval}
                    onChange={(e) => setRepeatInterval(Number(e.target.value) || 1)}
                  />
                </div>
              )}
              <div>
                <Label>Ends</Label>
                <Select value={repeatEndMode} onValueChange={setRepeatEndMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">No end date</SelectItem>
                    <SelectItem value="until">On a date</SelectItem>
                    <SelectItem value="count">After N sessions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {repeatEndMode === "until" && (
                <div>
                  <Label htmlFor="ev-until">End date</Label>
                  <Input id="ev-until" type="date" value={repeatUntil} onChange={(e) => setRepeatUntil(e.target.value)} />
                </div>
              )}
              {repeatEndMode === "count" && (
                <div>
                  <Label htmlFor="ev-count">Sessions</Label>
                  <Input
                    id="ev-count"
                    type="number"
                    min={1}
                    value={repeatCount}
                    onChange={(e) => setRepeatCount(Number(e.target.value) || 1)}
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Recurring times follow {zone.replace(/_/g, " ")} wall clock — daylight saving shifts can move
                the UTC time of later sessions.
              </p>
            </>
          )}

          <div>
            <Label htmlFor="ev-link">Meeting link</Label>
            <Input
              id="ev-link"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="Leave empty to use the built-in room"
            />
          </div>

          <div>
            <Label htmlFor="ev-location">Location</Label>
            <Input id="ev-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Online" />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="ev-desc">Description</Label>
            <Textarea id="ev-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div>
            <Label>Reminder</Label>
            <Select value={reminder} onValueChange={setReminder}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No reminder</SelectItem>
                {REMINDER_CHOICES.map((r) => (
                  <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-end gap-2 pb-2 text-sm">
            <Checkbox checked={notifyPeople} onCheckedChange={(v) => setNotifyPeople(v === true)} />
            Notify participants
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Saving…" : seed?.edit ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function kindOf(event: CalEvent): EventKind {
  if (event.source === "class") return event.category === "trial" ? "trial" : "class";
  if (event.source === "availability") return "availability";
  if (event.source === "loop") return "loop";
  if (event.category === "blocked") return "blocked";
  return "personal";
}

function weekdaysFor(repeat: string, weekday: number) {
  if (repeat === "weekdays") return [1, 2, 3, 4, 5];
  if (repeat === "daily") return [0, 1, 2, 3, 4, 5, 6];
  return [weekday];
}

function buildClassOccurrences(
  start: Date,
  repeat: string,
  interval: number,
  end: { mode: string; until: string; count: number },
) {
  if (repeat === "none") return [start];
  const limit = end.mode === "count" ? Math.max(end.count, 1) : 52;
  const until = end.mode === "until" && end.until ? new Date(`${end.until}T23:59:59Z`) : null;
  const list: Date[] = [];
  let cursor = new Date(start);
  while (list.length < limit) {
    if (until && cursor > until) break;
    const day = cursor.getUTCDay();
    if (repeat !== "weekdays" || (day !== 0 && day !== 6)) list.push(new Date(cursor));
    if (repeat === "daily" || repeat === "weekdays") {
      cursor = new Date(cursor.getTime() + 86_400_000);
    } else if (repeat === "weekly") {
      cursor = new Date(cursor.getTime() + 7 * 86_400_000);
    } else if (repeat === "custom") {
      cursor = new Date(cursor.getTime() + Math.max(interval, 1) * 7 * 86_400_000);
    } else {
      const next = new Date(cursor);
      next.setMonth(next.getMonth() + 1);
      cursor = next;
    }
    if (!until && end.mode === "never" && list.length >= 12) break;
  }
  return list;
}
