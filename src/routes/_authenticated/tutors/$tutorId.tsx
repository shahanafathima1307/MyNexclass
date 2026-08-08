import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Award,
  CalendarClock,
  Clock,
  GraduationCap,
  Languages,
  Mail,
  Phone,
  Repeat,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ClassCard, EmptyState } from "@/components/class-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/session";
import { ProfileAvatar } from "@/components/profile-avatar";
import { useClasses, useMember } from "@/lib/tutoring";
import { zoneAbbrev } from "@/lib/timezones";
import {
  WEEKDAYS,
  useAvailability,
  useCreateLoopRequest,
  useMyRatingFor,
  useRateTutor,
  useTutorDetails,
  useTutorRatings,
} from "@/lib/mentor";

export const Route = createFileRoute("/_authenticated/tutors/$tutorId")({
  head: () => ({
    meta: [
      { title: "Tutor profile — myNexClass" },
      {
        name: "description",
        content: "Tutor profile with subjects, bio and the classes you have scheduled together.",
      },
      { property: "og:title", content: "Tutor profile — myNexClass" },
      {
        property: "og:description",
        content: "Subjects, bio and shared class history for a myNexClass tutor.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TutorProfilePage,
  errorComponent: () => <AppShell title="Tutor">Could not load this tutor.</AppShell>,
  notFoundComponent: () => <AppShell title="Tutor">Tutor not found.</AppShell>,
});

function TutorProfilePage() {
  const { tutorId } = Route.useParams();
  const { user } = useSession();
  const { data: tutor, isLoading } = useMember(tutorId);
  const { data: classes } = useClasses(user?.id);
  const { data: details } = useTutorDetails(tutorId);
  const { data: ratings } = useTutorRatings(tutorId);
  const { data: slots } = useAvailability(tutorId);
  const isSelf = user?.id === tutorId;

  const shared = useMemo(
    () =>
      (classes ?? [])
        .filter((c) => c.tutor_id === tutorId)
        .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at)),
    [classes, tutorId],
  );
  const upcoming = shared.filter(
    (c) => c.status === "scheduled" && new Date(c.starts_at).getTime() >= Date.now(),
  );
  const done = shared.filter((c) => c.status === "completed");

  if (isLoading) {
    return (
      <AppShell title="Tutor profile">
        <Skeleton className="h-48 w-full" />
      </AppShell>
    );
  }

  if (!tutor) {
    return (
      <AppShell title="Tutor profile" subtitle="We could not find that tutor.">
        <Button asChild variant="outline">
          <Link to="/tutors">
            <ArrowLeft className="size-4" />
            Back to tutors
          </Link>
        </Button>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={tutor.full_name || "Unnamed tutor"}
      subtitle={tutor.subjects ? `Teaches ${tutor.subjects}` : "Tutor profile"}
      actions={
        <Button asChild variant="outline">
          <Link to="/tutors">
            <ArrowLeft className="size-4" />
            All tutors
          </Link>
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-soft lg:col-span-1">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <ProfileAvatar
                name={tutor.full_name}
                avatarUrl={tutor.avatar_url}
                className="size-16"
              />
              <div>
                <p className="font-display text-lg font-semibold">{tutor.full_name}</p>
                <Badge variant="secondary" className="mt-1 capitalize">
                  {tutor.role}
                </Badge>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{tutor.bio || "No bio yet."}</p>
            <div className="mt-4 space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" />
                {tutor.contact_email ? (
                  <a
                    className="underline-offset-4 hover:underline"
                    href={`mailto:${tutor.contact_email}`}
                  >
                    {tutor.contact_email}
                  </a>
                ) : (
                  <span className="text-muted-foreground">No email added</span>
                )}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" />
                {tutor.phone ? (
                  <a className="underline-offset-4 hover:underline" href={`tel:${tutor.phone}`}>
                    {tutor.phone}
                  </a>
                ) : (
                  <span className="text-muted-foreground">No phone added</span>
                )}
              </p>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-secondary p-3">
                <dt className="text-muted-foreground">Upcoming</dt>
                <dd className="font-display text-xl font-semibold">{upcoming.length}</dd>
              </div>
              <div className="rounded-xl bg-secondary p-3">
                <dt className="text-muted-foreground">Completed</dt>
                <dd className="font-display text-xl font-semibold">{done.length}</dd>
              </div>
            </dl>

            <div className="mt-5 space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <Star className="size-4 fill-current text-accent" />
                {ratings?.average ? ratings.average.toFixed(1) : "Not rated yet"}
                {!!ratings?.count && (
                  <span className="text-muted-foreground">
                    ({ratings.count} rating{ratings.count === 1 ? "" : "s"})
                  </span>
                )}
              </p>
              {details?.badge && (
                <p className="flex items-center gap-2">
                  <Award className="size-4 text-muted-foreground" />
                  {details.badge}
                </p>
              )}
              <p className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                {details?.years_experience ?? 0} yrs teaching experience
              </p>
              {details?.degree && (
                <p className="flex items-center gap-2">
                  <GraduationCap className="size-4 text-muted-foreground" />
                  {details.degree}
                </p>
              )}
              {details?.languages && (
                <p className="flex items-center gap-2">
                  <Languages className="size-4 text-muted-foreground" />
                  {details.languages}
                </p>
              )}
              {!!slots?.length && (
                <div>
                  <p className="mt-3 font-medium">Free slots</p>
                  <ul className="mt-1 space-y-1 text-muted-foreground">
                    {slots.map((s) => (
                      <li key={s.id}>
                        {WEEKDAYS[s.weekday]} {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}{" "}
                        {zoneAbbrev(new Date(), s.time_zone)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>


        <div className="space-y-6 lg:col-span-2">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="size-4" />
                Upcoming with {tutor.full_name?.split(" ")[0] || "this tutor"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcoming.length ? (
                upcoming.map((c) => (
                  <ClassCard key={c.id} item={c} currentUserId={user!.id} compact />
                ))
              ) : (
                <EmptyState label="No upcoming classes with this tutor." />
              )}
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <GraduationCap className="size-4" />
                Past classes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {done.length ? (
                done.map((c) => <ClassCard key={c.id} item={c} currentUserId={user!.id} compact />)
              ) : (
                <EmptyState label="No completed classes yet." />
              )}
            </CardContent>
          </Card>

          {!isSelf && user && (
            <StudentActions tutorId={tutorId} studentId={user.id} subject={tutor.subjects} />
          )}
        </div>
      </div>
    </AppShell>
  );
}

/** Students rate their mentor and ask to keep going with regular classes. */
function StudentActions({
  tutorId,
  studentId,
  subject,
}: {
  tutorId: string;
  studentId: string;
  subject: string | null;
}) {
  const { data: mine } = useMyRatingFor(tutorId, studentId);
  const rate = useRateTutor();
  const request = useCreateLoopRequest();
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [preferred, setPreferred] = useState("");
  const current = mine?.rating ?? 0;

  function submitRating(stars: number) {
    rate.mutate(
      { tutor_id: tutorId, rating: stars, comment: comment || mine?.comment || null },
      {
        onSuccess: () => toast.success("Thanks for the rating"),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }

  function submitRequest() {
    request.mutate(
      {
        tutor_id: tutorId,
        student_id: studentId,
        subject,
        message: message || null,
        preferred_time: preferred || null,
      },
      {
        onSuccess: () => {
          toast.success("Request sent to the mentor");
          setMessage("");
          setPreferred("");
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  }

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="size-4" />
          Rate and request
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Label className="mb-2 block">Your rating</Label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
                onClick={() => submitRating(n)}
                className="p-1"
              >
                <Star
                  className={
                    n <= current ? "size-6 fill-current text-accent" : "size-6 text-muted-foreground"
                  }
                />
              </button>
            ))}
          </div>
          <Textarea
            className="mt-2"
            rows={2}
            placeholder="Optional comment"
            value={comment || (mine?.comment ?? "")}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Repeat className="size-4" />
            Request regular classes
          </Label>
          <Input
            placeholder="Preferred time, e.g. weekdays 5pm"
            value={preferred}
            onChange={(e) => setPreferred(e.target.value)}
          />
          <Textarea
            rows={2}
            placeholder="Anything the mentor should know"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <Button variant="secondary" onClick={submitRequest} disabled={request.isPending}>
            Send request
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

