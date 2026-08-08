import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { ClassCard, EmptyState } from "@/components/class-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/session";
import { browserTimeZone, timeZoneOptions, zoneAbbrev, zonedToUtc } from "@/lib/timezones";
import {
  splitClasses,
  useClasses,
  useCreateClass,
  useMembers,
  useMyBaseRole,
  useMyRole,
} from "@/lib/tutoring";

export const Route = createFileRoute("/_authenticated/classes")({
  head: () => ({
    meta: [
      { title: "Classes — myNexClass" },
      {
        name: "description",
        content:
          "Schedule new tutoring sessions and manage upcoming, completed and cancelled classes.",
      },
      { property: "og:title", content: "Classes — myNexClass" },
      {
        property: "og:description",
        content: "Schedule tutoring sessions and manage your classes.",
      },
    ],
  }),
  component: ClassesPage,
});

const formSchema = z.object({
  title: z.string().trim().min(2, "Give the class a title").max(120),
  subject: z.string().trim().max(60).optional(),
  counterpartId: z.string().uuid("Pick who you are meeting"),
  date: z.string().min(1, "Pick a date"),
  time: z.string().min(1, "Pick a time"),
  duration: z.coerce.number().int().min(15).max(300),
  meetingUrl: z
    .string()
    .trim()
    .url("Meeting link must be a valid URL")
    .max(500)
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(1000).optional(),
});

const adminFormSchema = formSchema.omit({ counterpartId: true }).extend({
  tutorId: z.string().uuid("Pick a tutor"),
  studentId: z.string().uuid("Pick a student"),
});

function ClassesPage() {
  const { user } = useSession();
  const { data: role } = useMyRole(user?.id);
  const { data: baseRole } = useMyBaseRole(user?.id);
  const { data: members } = useMembers();
  const { data: classes, isLoading } = useClasses(user?.id);
  const create = useCreateClass();
  const [open, setOpen] = useState(false);

  const iAmAdmin = role === "admin";
  const iAmTutor = baseRole === "tutor";
  const candidates = useMemo(
    () =>
      (members ?? []).filter(
        (m) => m.id !== user?.id && m.role === (iAmTutor ? "student" : "tutor"),
      ),
    [members, user?.id, iAmTutor],
  );
  const tutors = useMemo(() => (members ?? []).filter((m) => m.role === "tutor"), [members]);
  const students = useMemo(() => (members ?? []).filter((m) => m.role === "student"), [members]);

  const [form, setForm] = useState({
    title: "",
    subject: "",
    counterpartId: "",
    tutorId: "",
    studentId: "",
    date: "",
    time: "17:00",
    duration: "60",
    timeZone: browserTimeZone(),
    meetingUrl: "",
    notes: "",
    isDemo: false,
  });
  const zones = useMemo(() => timeZoneOptions(form.timeZone), [form.timeZone]);

  const { upcoming, completed, cancelled } = splitClasses(classes ?? []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const schema = iAmAdmin ? adminFormSchema : formSchema;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const v = parsed.data as z.infer<typeof formSchema> & z.infer<typeof adminFormSchema>;
    const startsAt = zonedToUtc(v.date, v.time, form.timeZone);
    if (Number.isNaN(startsAt.getTime())) {
      toast.error("That date and time is not valid");
      return;
    }
    create.mutate(
      {
        title: v.title,
        subject: v.subject || null,
        starts_at: startsAt.toISOString(),
        duration_minutes: v.duration,
        time_zone: form.timeZone,
        meeting_url: v.meetingUrl || null,
        notes: v.notes || null,
        is_demo: form.isDemo,
        tutor_id: iAmAdmin ? v.tutorId : iAmTutor ? user!.id : v.counterpartId,
        student_id: iAmAdmin ? v.studentId : iAmTutor ? v.counterpartId : user!.id,
      },
      {
        onSuccess: () => {
          toast.success("Class scheduled");
          setOpen(false);
          setForm({ ...form, title: "", subject: "", notes: "", meetingUrl: "", isDemo: false });
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <AppShell
      title="Classes"
      subtitle={
        iAmTutor
          ? "Set up sessions with your students and keep them moving."
          : "Book time with a tutor and track how it went."
      }
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              Schedule a class
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Schedule a class</DialogTitle>
              <DialogDescription>
                {iAmTutor ? "Pick the student" : "Pick the tutor"} and agree a slot. Both of you
                will see it instantly.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div className="space-y-2">
                <Label htmlFor="title">Class title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Algebra: quadratic equations"
                  maxLength={120}
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="Maths"
                    maxLength={60}
                  />
                </div>
                {iAmAdmin ? (
                  <>
                    <div className="space-y-2">
                      <Label>Tutor</Label>
                      <Select
                        value={form.tutorId}
                        onValueChange={(v) => setForm({ ...form, tutorId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose tutor…" />
                        </SelectTrigger>
                        <SelectContent>
                          {tutors.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.full_name || "Unnamed member"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Student</Label>
                      <Select
                        value={form.studentId}
                        onValueChange={(v) => setForm({ ...form, studentId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose student…" />
                        </SelectTrigger>
                        <SelectContent>
                          {students.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.full_name || "Unnamed member"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label>{iAmTutor ? "Student" : "Tutor"}</Label>
                    <Select
                      value={form.counterpartId}
                      onValueChange={(v) => setForm({ ...form, counterpartId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={candidates.length ? "Choose…" : "Nobody available yet"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {candidates.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.full_name || "Unnamed member"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Start time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Time zone</Label>
                  <Select
                    value={form.timeZone}
                    onValueChange={(v) => setForm({ ...form, timeZone: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {zones.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz.replace(/_/g, " ")} ({zoneAbbrev(new Date(), tz)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The start time above is read in this zone; everyone sees it labelled with it.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (min)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={15}
                    max={300}
                    step={15}
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meetingUrl">Meeting link</Label>
                  <Input
                    id="meetingUrl"
                    value={form.meetingUrl}
                    onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })}
                    placeholder="https://meet.google.com/…"
                    maxLength={500}
                  />
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                <Checkbox
                  id="isDemo"
                  checked={form.isDemo}
                  onCheckedChange={(checked) => setForm({ ...form, isDemo: checked === true })}
                />
                <div className="space-y-0.5">
                  <Label htmlFor="isDemo">Demo class</Label>
                  <p className="text-xs text-muted-foreground">
                    Mark this as a free trial session. It shows a Demo badge everywhere.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="What should we prepare?"
                  maxLength={1000}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Scheduling…" : "Schedule class"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Tabs defaultValue="upcoming">
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled ({cancelled.length})</TabsTrigger>
          </TabsList>
          {(
            [
              ["upcoming", upcoming, "No upcoming classes — schedule one above."],
              ["completed", completed, "No completed classes yet."],
              ["cancelled", cancelled, "Nothing cancelled. Good sign."],
            ] as const
          ).map(([key, list, empty]) => (
            <TabsContent key={key} value={key} className="mt-5">
              {list.length ? (
                <div className="grid gap-3">
                  {list.map((item) => (
                    <ClassCard key={item.id} item={item} currentUserId={user!.id} />
                  ))}
                </div>
              ) : (
                <EmptyState label={empty} />
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </AppShell>
  );
}
