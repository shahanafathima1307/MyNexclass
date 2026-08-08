import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Award,
  BadgeCheck,
  CalendarClock,
  Clock,
  GraduationCap,
  Languages,
  Plus,
  Repeat,
  Star,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ProfileAvatar } from "@/components/profile-avatar";
import { useSession } from "@/lib/session";
import { browserTimeZone, formatInZone, timeZoneOptions, zoneAbbrev } from "@/lib/timezones";
import { useClasses, useMyProfile, useMyRole, useMembers } from "@/lib/tutoring";
import type { ClassWithPeople } from "@/lib/tutoring";
import {
  WEEKDAYS,
  mentorStats,
  useAddSlot,
  useAvailability,
  useClassFeedback,
  useDeleteSlot,
  useLoopRequests,
  useSaveFeedback,
  useSaveTutorDetails,
  useSetRequestStatus,
  useTutorDetails,
  useTutorRatings,
} from "@/lib/mentor";

export const Route = createFileRoute("/_authenticated/mentor")({
  head: () => ({
    meta: [
      { title: "Mentor portal — myNexClass" },
      {
        name: "description",
        content:
          "Your mentor profile, teaching stats, earnings, today's sessions, free slots and post-class feedback in one place.",
      },
      { property: "og:title", content: "Mentor portal — myNexClass" },
      {
        property: "og:description",
        content: "Track sessions, demo conversions, earnings and class feedback as a myNexClass mentor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MentorPortal,
});

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 pt-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold leading-tight">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function MentorPortal() {
  const { user } = useSession();
  const { data: role, isLoading: roleLoading } = useMyRole(user?.id);
  const { data: profile } = useMyProfile(user?.id);
  const { data: members } = useMembers();
  const { data: classes, isLoading } = useClasses(user?.id);
  const { data: details } = useTutorDetails(user?.id);
  const { data: ratings } = useTutorRatings(user?.id);
  const { data: feedback } = useClassFeedback();
  const { data: slots } = useAvailability(user?.id);
  const { data: requests } = useLoopRequests(user?.id);

  const [editing, setEditing] = useState(false);
  const [feedbackFor, setFeedbackFor] = useState<ClassWithPeople | null>(null);

  const stats = useMemo(
    () =>
      mentorStats(classes ?? [], user?.id ?? "", Number(details?.hourly_rate ?? 0), feedback),
    [classes, user?.id, details?.hourly_rate, feedback],
  );

  const currency = details?.currency || "USD";
  const money = (amount: number) => {
    try {
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return `${currency} ${Math.round(amount)}`;
    }
  };

  const myRequests = (requests ?? []).filter((r) => r.tutor_id === user?.id);
  const pendingRequests = myRequests.filter((r) => r.status === "pending");
  const nameById = new Map((members ?? []).map((m) => [m.id, m.full_name]));

  if (roleLoading || isLoading) {
    return (
      <AppShell title="Mentor portal">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </AppShell>
    );
  }

  if (role === "student") {
    return (
      <AppShell title="Mentor portal" subtitle="Only mentors can open this page.">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            This area is reserved for tutors. Ask an admin to switch your role if you teach on
            myNexClass.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Mentor portal"
      subtitle="Your profile, teaching numbers and everything happening today."
      actions={
        <Button onClick={() => setEditing(true)}>
          <BadgeCheck className="size-4" />
          Edit mentor profile
        </Button>
      }
    >
      <div className="space-y-8">
        {/* A — About the mentor */}
        <Card>
          <CardContent className="flex flex-wrap items-start gap-6 pt-6">
            <ProfileAvatar
              name={profile?.full_name ?? ""}
              avatarUrl={profile?.avatar_url ?? null}
              className="size-20"
            />
            <div className="min-w-64 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold">{profile?.full_name || "Your name"}</h2>
                {details?.badge && (
                  <Badge className="gap-1">
                    <Award className="size-3.5" />
                    {details.badge}
                  </Badge>
                )}
                <span className="flex items-center gap-1 text-sm font-medium">
                  <Star className="size-4 fill-current text-accent" />
                  {ratings?.average ? ratings.average.toFixed(1) : "—"}
                  <span className="text-muted-foreground">
                    ({ratings?.count ?? 0} rating{(ratings?.count ?? 0) === 1 ? "" : "s"})
                  </span>
                </span>
              </div>
              <p className="text-muted-foreground">
                {details?.headline || profile?.bio || "Add a short description about yourself."}
              </p>
              <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <span className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" />
                  {details?.years_experience ?? 0} yrs teaching
                </span>
                <span className="flex items-center gap-2">
                  <Users className="size-4 text-muted-foreground" />
                  {stats.studentsTaught} students taught
                </span>
                <span className="flex items-center gap-2">
                  <GraduationCap className="size-4 text-muted-foreground" />
                  {details?.degree || "Degree not set"}
                </span>
                <span className="flex items-center gap-2">
                  <Languages className="size-4 text-muted-foreground" />
                  {details?.languages || "Languages not set"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* B — Numbers */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={GraduationCap}
            label="Total sessions"
            value={String(stats.totalSessions)}
            hint={`${stats.hoursTaught.toFixed(1)} hours taught`}
          />
          <Stat icon={CalendarClock} label="Total demos" value={String(stats.totalDemos)} />
          <Stat
            icon={TrendingUp}
            label="Demos converted"
            value={String(stats.convertedDemos)}
            hint={
              stats.conversionRate === null
                ? "No demos yet"
                : `${stats.conversionRate.toFixed(0)}% conversion`
            }
          />
          <Stat
            icon={Wallet}
            label="Earnings"
            value={money(stats.earnings)}
            hint={`${money(Number(details?.hourly_rate ?? 0))} / hour`}
          />
        </section>

        {/* C — Today, free slots, loop requests */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sessions today</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.today.length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing scheduled today.</p>
              )}
              {stats.today.map((c) => (
                <div key={c.id} className="rounded-lg border p-3">
                  <p className="font-medium">{c.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatInZone(c.starts_at, c.time_zone, {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}{" "}
                    {zoneAbbrev(c.starts_at, c.time_zone)} · {c.student?.full_name ?? "Student"}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <FreeSlots tutorId={user?.id} slots={slots ?? []} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Repeat className="size-4" />
                Loop requests
                {pendingRequests.length > 0 && (
                  <Badge variant="secondary">{pendingRequests.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {myRequests.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No students have asked to continue with regular classes yet.
                </p>
              )}
              {myRequests.slice(0, 5).map((r) => (
                <RequestRow key={r.id} request={r} studentName={nameById.get(r.student_id)} />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* D — Upcoming sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.upcoming.length === 0 && (
              <p className="text-sm text-muted-foreground">No upcoming sessions.</p>
            )}
            {stats.upcoming.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border p-4"
              >
                <div className="w-28 shrink-0">
                  <p className="font-semibold">
                    {formatInZone(c.starts_at, c.time_zone, {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatInZone(c.starts_at, c.time_zone, {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    {zoneAbbrev(c.starts_at, c.time_zone)}
                  </p>
                  <Badge variant={c.is_demo ? "secondary" : "outline"} className="mt-1">
                    {c.is_demo ? "Demo" : "Regular"}
                  </Badge>
                </div>
                <div className="min-w-40 flex-1">
                  <p className="font-medium">
                    {c.title}
                    {c.subject ? ` · ${c.subject}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {c.student?.full_name ?? "Student"} · {c.duration_minutes} min
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* E — Feedback */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Class feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.awaitingFeedback.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Every conducted class has feedback. Nice work.
              </p>
            )}
            {stats.awaitingFeedback.slice(0, 8).map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
              >
                <div>
                  <p className="font-medium">{c.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatInZone(c.starts_at, c.time_zone)} · {c.student?.full_name ?? "Student"}
                  </p>
                </div>
                <Button variant="secondary" onClick={() => setFeedbackFor(c)}>
                  Add feedback
                </Button>
              </div>
            ))}
            {(feedback?.size ?? 0) > 0 && (
              <div className="space-y-3 pt-2">
                <p className="text-sm font-medium text-muted-foreground">Submitted feedback</p>
                {(classes ?? [])
                  .filter((c) => c.tutor_id === user?.id && feedback?.has(c.id))
                  .slice(0, 8)
                  .map((c) => {
                    const f = feedback!.get(c.id)!;
                    return (
                      <div key={c.id} className="rounded-xl border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-medium">
                            {c.title} · {c.student?.full_name ?? "Student"}
                          </p>
                          <Button variant="ghost" onClick={() => setFeedbackFor(c)}>
                            Edit
                          </Button>
                        </div>
                        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                          <div>
                            <dt className="text-muted-foreground">Topic covered</dt>
                            <dd>{f.topic_covered || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Homework assigned</dt>
                            <dd>{f.homework || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Note to parent</dt>
                            <dd>{f.note_to_parent || "—"}</dd>
                          </div>
                        </dl>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ProfileDialog
        open={editing}
        onOpenChange={setEditing}
        tutorId={user?.id}
        details={details ?? null}
      />
      <FeedbackDialog
        item={feedbackFor}
        existing={feedbackFor ? (feedback?.get(feedbackFor.id) ?? null) : null}
        onClose={() => setFeedbackFor(null)}
      />
    </AppShell>
  );
}

function RequestRow({
  request,
  studentName,
}: {
  request: { id: string; status: string; message: string | null; subject: string | null; preferred_time: string | null };
  studentName?: string;
}) {
  const setStatus = useSetRequestStatus();
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{studentName ?? "Student"}</p>
        <Badge variant={request.status === "pending" ? "secondary" : "outline"} className="capitalize">
          {request.status}
        </Badge>
      </div>
      {request.subject && <p className="text-sm text-muted-foreground">{request.subject}</p>}
      {request.message && <p className="mt-1 text-sm">{request.message}</p>}
      {request.preferred_time && (
        <p className="text-xs text-muted-foreground">Prefers: {request.preferred_time}</p>
      )}
      {request.status === "pending" && (
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            disabled={setStatus.isPending}
            onClick={() => setStatus.mutate({ id: request.id, status: "accepted" })}
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={setStatus.isPending}
            onClick={() => setStatus.mutate({ id: request.id, status: "declined" })}
          >
            Decline
          </Button>
        </div>
      )}
    </div>
  );
}

function FreeSlots({
  tutorId,
  slots,
}: {
  tutorId: string | undefined;
  slots: { id: string; weekday: number; start_time: string; end_time: string; time_zone: string }[];
}) {
  const add = useAddSlot();
  const remove = useDeleteSlot();
  const [weekday, setWeekday] = useState("1");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [zone, setZone] = useState(browserTimeZone());

  function addSlot() {
    if (!tutorId) return;
    if (end <= start) {
      toast.error("End time must be after the start time.");
      return;
    }
    add.mutate(
      { tutor_id: tutorId, weekday: Number(weekday), start_time: start, end_time: end, time_zone: zone },
      {
        onSuccess: () => toast.success("Free slot added"),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Free slots</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {slots.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Publish the times you are available so students can book you.
          </p>
        )}
        {slots.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 pl-3">
            <span className="text-sm">
              {WEEKDAYS[s.weekday]} {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}{" "}
              <span className="text-muted-foreground">{zoneAbbrev(new Date(), s.time_zone)}</span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove slot"
              onClick={() => remove.mutate(s.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Select value={weekday} onValueChange={setWeekday}>
            <SelectTrigger className="col-span-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKDAYS.map((d, i) => (
                <SelectItem key={d} value={String(i)}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          <Select value={zone} onValueChange={setZone}>
            <SelectTrigger className="col-span-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeZoneOptions(zone).map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="col-span-2" variant="secondary" onClick={addSlot} disabled={add.isPending}>
            <Plus className="size-4" />
            Add slot
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileDialog({
  open,
  onOpenChange,
  tutorId,
  details,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tutorId: string | undefined;
  details: {
    headline: string | null;
    badge: string | null;
    degree: string | null;
    languages: string | null;
    years_experience: number;
    hourly_rate: number;
    currency: string;
  } | null;
}) {
  const save = useSaveTutorDetails();
  const [form, setForm] = useState({
    headline: details?.headline ?? "",
    badge: details?.badge ?? "",
    degree: details?.degree ?? "",
    languages: details?.languages ?? "",
    years_experience: String(details?.years_experience ?? 0),
    hourly_rate: String(details?.hourly_rate ?? 0),
    currency: details?.currency ?? "USD",
  });

  function submit() {
    if (!tutorId) return;
    save.mutate(
      {
        tutorId,
        patch: {
          headline: form.headline || null,
          badge: form.badge || null,
          degree: form.degree || null,
          languages: form.languages || null,
          years_experience: Number(form.years_experience) || 0,
          hourly_rate: Number(form.hourly_rate) || 0,
          currency: form.currency || "USD",
        },
      },
      {
        onSuccess: () => {
          toast.success("Mentor profile updated");
          onOpenChange(false);
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mentor profile</DialogTitle>
          <DialogDescription>
            This is what students see on your tutor page.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="headline">Description</Label>
            <Textarea
              id="headline"
              rows={3}
              value={form.headline}
              onChange={(e) => setForm({ ...form, headline: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="badge">Badge</Label>
              <Input
                id="badge"
                placeholder="Top mentor"
                value={form.badge}
                onChange={(e) => setForm({ ...form, badge: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="years">Years of experience</Label>
              <Input
                id="years"
                type="number"
                min={0}
                value={form.years_experience}
                onChange={(e) => setForm({ ...form, years_experience: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="degree">Degree</Label>
              <Input
                id="degree"
                placeholder="M.Sc. Mathematics"
                value={form.degree}
                onChange={(e) => setForm({ ...form, degree: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="languages">Languages known</Label>
              <Input
                id="languages"
                placeholder="English, Tamil"
                value={form.languages}
                onChange={(e) => setForm({ ...form, languages: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rate">Hourly rate</Label>
              <Input
                id="rate"
                type="number"
                min={0}
                step="0.01"
                value={form.hourly_rate}
                onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                maxLength={3}
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            Save profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeedbackDialog({
  item,
  existing,
  onClose,
}: {
  item: ClassWithPeople | null;
  existing: { topic_covered: string | null; homework: string | null; note_to_parent: string | null } | null;
  onClose: () => void;
}) {
  const save = useSaveFeedback();
  const [form, setForm] = useState({ topic: "", homework: "", note: "" });
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (item && loadedFor !== item.id) {
    setLoadedFor(item.id);
    setForm({
      topic: existing?.topic_covered ?? "",
      homework: existing?.homework ?? "",
      note: existing?.note_to_parent ?? "",
    });
  }

  function submit() {
    if (!item) return;
    save.mutate(
      {
        class_id: item.id,
        topic_covered: form.topic || null,
        homework: form.homework || null,
        note_to_parent: form.note || null,
      },
      {
        onSuccess: () => {
          toast.success("Feedback saved");
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Class feedback</DialogTitle>
          <DialogDescription>{item?.title}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="topic">Topic covered</Label>
            <Textarea
              id="topic"
              rows={2}
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="homework">Homework assigned</Label>
            <Textarea
              id="homework"
              rows={2}
              value={form.homework}
              onChange={(e) => setForm({ ...form, homework: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="note">Note to parent</Label>
            <Textarea
              id="note"
              rows={3}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            Save feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
