import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, PlayCircle, Sparkles, Users, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketingFooter, MarketingHeader } from "@/components/marketing-shell";
import heroImage from "@/assets/hero-tutoring.jpg";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "myNexClass — Where tutors and students meet" },
      {
        name: "description",
        content:
          "Book live classes, keep every lesson on a shared calendar and store recordings in one place. myNexClass is the simple home for tutoring.",
      },
      { property: "og:title", content: "myNexClass — Where tutors and students meet" },
      {
        property: "og:description",
        content:
          "Book live classes, keep every lesson on a shared calendar and store recordings in one place.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Users,
    title: "Tutors and students, paired",
    body: "Sign up as a tutor or a student. Pick your counterpart, agree a time and the class appears for both of you.",
  },
  {
    icon: CalendarDays,
    title: "One calendar, past and future",
    body: "A month view that marks completed lessons and highlights the next class on the schedule.",
  },
  {
    icon: Video,
    title: "Recordings that stay put",
    body: "Upload the video file or drop in a meeting link — every lesson keeps its own private recording shelf.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />


      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-8 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            <Sparkles className="size-3.5" />
            Live classes · shared calendar · lesson archive
          </span>
          <h1 className="mt-5 text-balance text-5xl font-semibold leading-[1.05] md:text-6xl">
            Where tutors and students <span className="text-gradient-brand">actually meet</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Schedule a lesson in seconds, see what is next at a glance, and keep every recording
            within reach of the two people who were in the room.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link to="/auth" search={{ mode: "signup" }}>
                Create your account
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/auth">I already have one</Link>
            </Button>
          </div>
          <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-border pt-6">
            {[
              ["1:1", "Tutor & student"],
              ["Live", "Meeting links"],
              ["∞", "Recordings kept"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="font-display text-2xl font-semibold text-primary">{value}</dt>
                <dd className="text-sm text-muted-foreground">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <div className="grid-faint absolute -inset-6 -z-10 rounded-4xl opacity-40" />
          <img
            src={heroImage}
            alt="A tutor and a student in a live online lesson"
            className="w-full rounded-3xl shadow-lift"
            loading="eager"
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <h2 className="text-2xl font-semibold">Everything a lesson needs</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="border-border shadow-soft">
              <CardContent className="pt-6">
                <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="surface-ink flex flex-wrap items-center justify-between gap-6 rounded-3xl px-8 py-10">
          <div>
            <h2 className="text-2xl font-semibold">Your first class is a minute away</h2>
            <p className="mt-2 max-w-lg text-ink-foreground/70">
              Create an account as a tutor or student, then book the session and share the link.
            </p>
          </div>
          <Button size="lg" variant="secondary" asChild>
            <Link to="/auth" search={{ mode: "signup" }}>
              <PlayCircle className="size-4" />
              Get started free
            </Link>
          </Button>
        </div>
      </section>

      <MarketingFooter />

    </div>
  );
}
