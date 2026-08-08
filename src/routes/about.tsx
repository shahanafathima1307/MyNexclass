import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, HeartHandshake, ShieldCheck, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketingShell } from "@/components/marketing-shell";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About myNexClass — a calmer home for tutoring" },
      {
        name: "description",
        content:
          "myNexClass is a small tutoring platform built around one idea: a lesson should be easy to book, easy to join and easy to look back on.",
      },
      { property: "og:title", content: "About myNexClass — a calmer home for tutoring" },
      {
        property: "og:description",
        content:
          "Why myNexClass exists, who it is for, and the principles behind how classes, calendars and recordings work.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AboutPage,
});

const VALUES = [
  {
    icon: CalendarDays,
    title: "One shared timeline",
    body: "Tutor and student see the same calendar, in their own time zone, with no double-entry and no chasing.",
  },
  {
    icon: Video,
    title: "The class lives here",
    body: "Lessons run in myNexClass's own room. No third-party meeting app, no accounts to create on the day.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    body: "Recordings, feedback and contact details are visible only to the people in that class, and to nobody else.",
  },
  {
    icon: HeartHandshake,
    title: "Built for small practices",
    body: "Independent tutors and small teaching groups — not enterprise training departments.",
  },
];

function AboutPage() {
  return (
    <MarketingShell
      eyebrow="About us"
      title="A calmer home for tutoring"
      intro="myNexClass started as a fix for a familiar mess: lessons scattered across chat threads, meeting links that expire and recordings nobody can find. One place, one timeline, one archive."
    >
      <div className="grid gap-5 md:grid-cols-2">
        {VALUES.map(({ icon: Icon, title, body }) => (
          <Card key={title} className="border-border shadow-soft">
            <CardContent className="pt-6">
              <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
                <Icon className="size-5" />
              </span>
              <h2 className="mt-4 text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="mt-12 space-y-4 text-muted-foreground">
        <h2 className="text-2xl font-semibold text-foreground">Who it is for</h2>
        <p>
          Tutors who teach one to one or in small groups, and the students and parents who want to
          know what was covered, what the homework is and when the next session runs. Tutors get a
          mentor portal with their availability, requests, earnings and session feedback. Students
          get a dashboard, a calendar and every recording from lessons they attended.
        </p>
        <h2 className="pt-4 text-2xl font-semibold text-foreground">How we handle your work</h2>
        <p>
          Every class belongs to exactly two people until a tutor invites someone else. Access rules
          are enforced in the database, not just hidden in the interface, so a recording or a note to
          a parent cannot be read by an unrelated account.
        </p>
      </section>

      <div className="surface-ink mt-12 flex flex-wrap items-center justify-between gap-6 rounded-3xl px-8 py-10">
        <div>
          <h2 className="text-2xl font-semibold">Try it with your next lesson</h2>
          <p className="mt-2 max-w-lg text-ink-foreground/70">
            Creating an account takes a minute, and the first class can be a free demo.
          </p>
        </div>
        <Button size="lg" variant="secondary" asChild>
          <Link to="/auth" search={{ mode: "signup" }}>
            Create your account
          </Link>
        </Button>
      </div>
    </MarketingShell>
  );
}
