import { createFileRoute, Link } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { CalendarDays, CheckCircle2, Clock, Video } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ClassCard, EmptyState } from "@/components/class-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { displayName, useSession } from "@/lib/session";
import { splitClasses, useClasses, useRecordings } from "@/lib/tutoring";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — myNexClass" },
      {
        name: "description",
        content: "Your next class, recent lessons and recordings at a glance.",
      },
      { property: "og:title", content: "Dashboard — myNexClass" },
      { property: "og:description", content: "Your next class, recent lessons and recordings." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useSession();
  const { data: classes, isLoading } = useClasses(user?.id);
  const { data: recordings } = useRecordings(user?.id);
  const { upcoming, completed, nextClass } = splitClasses(classes ?? []);

  return (
    <AppShell
      title={`Hi ${displayName(user).split(" ")[0] || "there"}`}
      subtitle="Here is where your teaching week stands."
      actions={
        <Button asChild>
          <Link to="/classes">Schedule a class</Link>
        </Button>
      }
    >
      <div className="grid gap-6">
        <Card className="surface-ink border-0 text-ink-foreground shadow-lift">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wide text-ink-foreground/60">
              Next class
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : nextClass ? (
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div>
                  <h2 className="text-3xl font-semibold">{nextClass.title}</h2>
                  <p className="mt-2 text-ink-foreground/70">
                    {format(new Date(nextClass.starts_at), "EEEE d MMMM 'at' HH:mm")} ·{" "}
                    {nextClass.duration_minutes} min ·{" "}
                    {nextClass.tutor_id === user?.id
                      ? `with ${nextClass.student?.full_name ?? "student"}`
                      : `with ${nextClass.tutor?.full_name ?? "tutor"}`}
                  </p>
                  <p className="mt-1 text-sm text-accent">
                    starts in {formatDistanceToNow(new Date(nextClass.starts_at))}
                  </p>
                </div>
                <Button variant="secondary" size="lg" asChild>
                  <Link to="/room/$classId" params={{ classId: nextClass.id }}>
                    <Video className="size-4" />
                    Join class
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-ink-foreground/70">
                  Nothing on the schedule yet — book your first class.
                </p>
                <Button variant="secondary" asChild>
                  <Link to="/classes">Schedule a class</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Upcoming classes", value: upcoming.length, icon: Clock },
            { label: "Completed classes", value: completed.length, icon: CheckCircle2 },
            { label: "Recordings stored", value: recordings?.length ?? 0, icon: Video },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} className="border-border shadow-soft">
              <CardContent className="flex items-center gap-4 pt-6">
                <span className="grid size-11 place-items-center rounded-xl bg-secondary text-primary">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="font-display text-2xl font-semibold">{value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Coming up</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/calendar">
                <CalendarDays className="size-4" />
                Open calendar
              </Link>
            </Button>
          </div>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : upcoming.length ? (
            <div className="grid gap-3">
              {upcoming.slice(0, 4).map((item) => (
                <ClassCard key={item.id} item={item} currentUserId={user!.id} compact />
              ))}
            </div>
          ) : (
            <EmptyState label="No upcoming classes on the schedule." />
          )}
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">Recently completed</h2>
          {completed.length ? (
            <div className="grid gap-3">
              {completed.slice(0, 3).map((item) => (
                <ClassCard key={item.id} item={item} currentUserId={user!.id} compact />
              ))}
            </div>
          ) : (
            <EmptyState label="Completed classes will show up here." />
          )}
        </section>
      </div>
    </AppShell>
  );
}
