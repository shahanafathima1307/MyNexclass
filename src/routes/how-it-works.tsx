import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketingShell } from "@/components/marketing-shell";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How myNexClass works — from booking to recording" },
      {
        name: "description",
        content:
          "Find a tutor, request a demo, get approved, join the class inside myNexClass and keep the recording. Here is each step for students and tutors.",
      },
      { property: "og:title", content: "How myNexClass works — from booking to recording" },
      {
        property: "og:description",
        content:
          "The full journey for students and tutors: discovery, requests, scheduling, the live room and the lesson archive.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HowItWorksPage,
});

const STUDENT_STEPS = [
  {
    title: "Create your account",
    body: "Sign up with email or Google and pick the student role. You land straight on your dashboard.",
  },
  {
    title: "Find a tutor",
    body: "Browse the tutor directory, read their subjects, experience and ratings, and check the free slots they publish.",
  },
  {
    title: "Send a request",
    body: "Ask for a demo or a regular slot with your preferred time. The tutor accepts or declines and you are notified.",
  },
  {
    title: "Join the class",
    body: "At the scheduled time, open the class from your dashboard. The room runs inside myNexClass — camera, mic and nothing to install.",
  },
  {
    title: "Look back on it",
    body: "The lesson moves to your history with the tutor's feedback, homework and any recording that was saved.",
  },
];

const TUTOR_STEPS = [
  {
    title: "Set up your profile",
    body: "Add your headline, subjects, languages, experience, hourly rate and a photo. This is what students see in the directory.",
  },
  {
    title: "Publish your availability",
    body: "Add weekly free slots in your own time zone. Students see them converted to theirs.",
  },
  {
    title: "Handle requests",
    body: "Accept or decline incoming demo and class requests from the mentor portal, then confirm the schedule.",
  },
  {
    title: "Teach the session",
    body: "Start the class room from the sessions list. Invite emails carry a direct link back into myNexClass.",
  },
  {
    title: "Close the loop",
    body: "Log the topic covered, the homework and a note to the parent, and upload the recording for the student.",
  },
];

function StepList({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ol className="mt-6 space-y-4">
      {steps.map((step, index) => (
        <li key={step.title}>
          <Card className="border-border shadow-soft">
            <CardContent className="flex gap-4 pt-6">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary font-display font-semibold text-primary">
                {index + 1}
              </span>
              <div>
                <h3 className="text-base font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ol>
  );
}

function HowItWorksPage() {
  return (
    <MarketingShell
      eyebrow="How it works"
      title="From first request to the saved recording"
      intro="Every lesson follows the same short path. Students ask, tutors confirm, the class runs inside myNexClass, and the record of it stays with both of you."
    >
      <section>
        <h2 className="text-2xl font-semibold">If you are a student</h2>
        <StepList steps={STUDENT_STEPS} />
      </section>

      <section className="mt-14">
        <h2 className="text-2xl font-semibold">If you are a tutor</h2>
        <StepList steps={TUTOR_STEPS} />
      </section>

      <div className="surface-ink mt-14 flex flex-wrap items-center justify-between gap-6 rounded-3xl px-8 py-10">
        <div>
          <h2 className="text-2xl font-semibold">Start with a free demo class</h2>
          <p className="mt-2 max-w-lg text-ink-foreground/70">
            Sign up, request a demo and see the whole flow before committing to anything.
          </p>
        </div>
        <Button size="lg" variant="secondary" asChild>
          <Link to="/auth" search={{ mode: "signup" }}>
            Get started
          </Link>
        </Button>
      </div>
    </MarketingShell>
  );
}
