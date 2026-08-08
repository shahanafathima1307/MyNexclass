import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Star, Zap } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useSession } from "@/lib/session";
import { useMembers, useMyRole } from "@/lib/tutoring";
import { notify } from "@/lib/messaging";
import {
  estimateWaitMinutes,
  isExpired,
  useAcceptLoopRequest,
  useCancelLoopRequest,
  useCreateLoopRequest,
  useLoopRealtime,
  useLoopRequests,
  useRateLoopRequest,
  type LoopRequest,
} from "@/lib/loop";

export const Route = createFileRoute("/_authenticated/loop")({
  head: () => ({
    meta: [
      { title: "Loop — instant learning — myNexClass" },
      {
        name: "description",
        content:
          "Ask for help right now and get matched with the first available tutor on myNexClass Loop.",
      },
      { property: "og:title", content: "Loop — instant learning — myNexClass" },
      {
        property: "og:description",
        content:
          "Ask for help right now and get matched with the first available tutor on myNexClass Loop.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoopPage,
});

const STATUS_LABEL: Record<string, string> = {
  open: "Waiting for a tutor",
  matched: "Tutor on the way",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
};

function LoopPage() {
  const { user } = useSession();
  const { data: role } = useMyRole(user?.id);
  const { data: members } = useMembers();
  const { data: requests, isLoading } = useLoopRequests(user?.id);
  useLoopRealtime(user?.id);

  const isTutor = role === "tutor" || role === "admin";
  const nameById = useMemo(
    () => new Map((members ?? []).map((m) => [m.id, m.full_name])),
    [members],
  );

  const rows = requests ?? [];
  const mine = rows.filter((r) => r.student_id === user?.id);
  const marketplace = rows.filter(
    (r) => r.student_id !== user?.id && r.status === "open" && !isExpired(r),
  );
  const claimed = rows.filter((r) => r.tutor_id === user?.id && r.status !== "open");
  const wait = estimateWaitMinutes(rows);

  return (
    <AppShell
      title="Loop"
      subtitle={
        isTutor
          ? "Live requests from students who need help right now — first to accept takes the session."
          : "Stuck on something? Send a request and the first available tutor picks it up."
      }
    >
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {!isTutor ? <NewLoopRequestCard waitMinutes={wait} /> : null}

        <div className="space-y-6">
          {isTutor ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Open requests ({marketplace.length})</h2>
              {isLoading ? (
                <Skeleton className="h-28 w-full" />
              ) : marketplace.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                    <Zap className="size-7 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No open requests right now. New ones appear here instantly.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                marketplace.map((r) => (
                  <TutorRequestCard
                    key={r.id}
                    request={r}
                    studentName={nameById.get(r.student_id) ?? "Student"}
                  />
                ))
              )}
            </section>
          ) : null}

          {isTutor && claimed.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Your accepted sessions</h2>
              {claimed.map((r) => (
                <RequestSummary
                  key={r.id}
                  request={r}
                  counterparty={nameById.get(r.student_id) ?? "Student"}
                />
              ))}
            </section>
          ) : null}

          {!isTutor ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Your requests</h2>
              {isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : mine.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No Loop requests yet — send your first one.
                </p>
              ) : (
                mine.map((r) => (
                  <StudentRequestCard
                    key={r.id}
                    request={r}
                    tutorName={r.tutor_id ? (nameById.get(r.tutor_id) ?? "Tutor") : null}
                  />
                ))
              )}
            </section>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

function StatusBadge({ request }: { request: LoopRequest }) {
  const status = isExpired(request) ? "expired" : request.status;
  const variant =
    status === "matched" ? "default" : status === "open" ? "secondary" : "outline";
  return <Badge variant={variant}>{STATUS_LABEL[status] ?? status}</Badge>;
}

function NewLoopRequestCard({ waitMinutes }: { waitMinutes: number | null }) {
  const { user } = useSession();
  const create = useCreateLoopRequest();
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState("30");
  const [startMode, setStartMode] = useState<"now" | "later">("now");
  const [preferredStart, setPreferredStart] = useState("");
  const [timeout, setTimeoutMinutes] = useState("15");
  const [notes, setNotes] = useState("");

  async function submit() {
    if (!user || !subject.trim()) {
      toast.error("Tell us the subject first.");
      return;
    }
    try {
      await create.mutateAsync({
        student_id: user.id,
        subject: subject.trim().slice(0, 80),
        grade_level: gradeLevel.trim().slice(0, 40) || null,
        topic: topic.trim().slice(0, 140) || null,
        duration_minutes: Number(duration),
        start_mode: startMode,
        preferred_start:
          startMode === "later" && preferredStart
            ? new Date(preferredStart).toISOString()
            : null,
        notes: notes.trim().slice(0, 1000) || null,
        timeout_minutes: Number(timeout),
      });
      toast.success("Request sent to available tutors");
      setTopic("");
      setNotes("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the request");
    }
  }

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="size-4" />
          Ask for a Loop session
        </CardTitle>
        {waitMinutes ? (
          <p className="text-sm text-muted-foreground">
            Tutors usually accept within about {waitMinutes} min.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="loop-subject">Subject</Label>
          <Input
            id="loop-subject"
            maxLength={80}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Maths"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="loop-grade">Grade / level</Label>
            <Input
              id="loop-grade"
              maxLength={40}
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              placeholder="Year 9"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["15", "30", "45", "60"].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m} minutes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loop-topic">Topic</Label>
          <Input
            id="loop-topic"
            maxLength={140}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Solving quadratic equations"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Start</Label>
            <Select
              value={startMode}
              onValueChange={(v) => setStartMode(v as "now" | "later")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="now">Right now</SelectItem>
                <SelectItem value="later">Later today</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Auto-cancel after</Label>
            <Select value={timeout} onValueChange={setTimeoutMinutes}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["10", "15", "30", "60"].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m} minutes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {startMode === "later" ? (
          <div className="space-y-1.5">
            <Label htmlFor="loop-when">Preferred time</Label>
            <Input
              id="loop-when"
              type="datetime-local"
              value={preferredStart}
              onChange={(e) => setPreferredStart(e.target.value)}
            />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="loop-notes">Anything else?</Label>
          <Textarea
            id="loop-notes"
            rows={3}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <Button className="w-full" onClick={submit} disabled={create.isPending}>
          {create.isPending ? "Sending…" : "Find me a tutor"}
        </Button>
      </CardContent>
    </Card>
  );
}

function TutorRequestCard({
  request,
  studentName,
}: {
  request: LoopRequest;
  studentName: string;
}) {
  const accept = useAcceptLoopRequest();

  async function handleAccept() {
    try {
      await accept.mutateAsync(request.id);
      await notify({
        userId: request.student_id,
        title: "A tutor accepted your Loop request",
        body: `${request.subject}${request.topic ? ` · ${request.topic}` : ""}`,
        link: "/loop",
        kind: "loop",
      });
      toast.success("You've got this session");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Another tutor accepted this one first",
      );
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">
            {request.subject}
            {request.topic ? ` · ${request.topic}` : ""}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {studentName}
            {request.grade_level ? ` · ${request.grade_level}` : ""} · {request.duration_minutes}{" "}
            min ·{" "}
            {request.start_mode === "now"
              ? "starts now"
              : request.preferred_start
                ? format(new Date(request.preferred_start), "d MMM, HH:mm")
                : "later today"}
          </p>
        </div>
        <Badge variant="secondary">
          expires in {formatDistanceToNowStrict(new Date(request.expires_at))}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {request.notes ? (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{request.notes}</p>
        ) : null}
        <Button onClick={handleAccept} disabled={accept.isPending}>
          {accept.isPending ? "Accepting…" : "Accept request"}
        </Button>
      </CardContent>
    </Card>
  );
}

function StudentRequestCard({
  request,
  tutorName,
}: {
  request: LoopRequest;
  tutorName: string | null;
}) {
  const cancel = useCancelLoopRequest();
  const rate = useRateLoopRequest();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">
            {request.subject}
            {request.topic ? ` · ${request.topic}` : ""}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Sent {format(new Date(request.created_at), "d MMM, HH:mm")} ·{" "}
            {request.duration_minutes} min
            {tutorName ? ` · with ${tutorName}` : ""}
          </p>
        </div>
        <StatusBadge request={request} />
      </CardHeader>
      <CardContent className="space-y-3">
        {request.status === "open" && !isExpired(request) ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Auto-cancels in {formatDistanceToNowStrict(new Date(request.expires_at))}.
            </p>
            <Button variant="outline" size="sm" onClick={() => cancel.mutate(request.id)}>
              Cancel
            </Button>
          </div>
        ) : null}

        {request.status === "matched" ? (
          <div className="space-y-2">
            <p className="text-sm">Rate this session once you're done.</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  onClick={() => setRating(n)}
                  className="p-0.5"
                >
                  <Star
                    className={
                      n <= rating ? "size-5 fill-current text-primary" : "size-5 text-muted-foreground"
                    }
                  />
                </button>
              ))}
            </div>
            <Textarea
              rows={2}
              maxLength={1000}
              placeholder="How did it go? (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <Button
              size="sm"
              disabled={rating === 0 || rate.isPending}
              onClick={() =>
                rate
                  .mutateAsync({ id: request.id, rating, comment })
                  .then(() => toast.success("Thanks for the feedback"))
                  .catch(() => toast.error("Could not save your rating"))
              }
            >
              Submit rating
            </Button>
          </div>
        ) : null}

        {request.rating ? (
          <p className="text-sm text-muted-foreground">You rated this {request.rating}/5.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RequestSummary({
  request,
  counterparty,
}: {
  request: LoopRequest;
  counterparty: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">
            {request.subject}
            {request.topic ? ` · ${request.topic}` : ""}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {counterparty} · {request.duration_minutes} min
            {request.accepted_at
              ? ` · accepted ${format(new Date(request.accepted_at), "d MMM, HH:mm")}`
              : ""}
          </p>
        </div>
        <StatusBadge request={request} />
      </CardHeader>
      {request.rating ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Rated {request.rating}/5
            {request.rating_comment ? ` — “${request.rating_comment}”` : ""}
          </p>
        </CardContent>
      ) : null}
    </Card>
  );
}
