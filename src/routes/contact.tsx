import { createFileRoute, Link } from "@tanstack/react-router";
import { LifeBuoy, Mail, MessageCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketingShell } from "@/components/marketing-shell";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact myNexClass — support and enquiries" },
      {
        name: "description",
        content:
          "Get in touch with the myNexClass team about your account, a class, an institution plan or a security concern.",
      },
      { property: "og:title", content: "Contact myNexClass — support and enquiries" },
      {
        property: "og:description",
        content: "Support, sales and security contacts for myNexClass.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

const CHANNELS = [
  {
    icon: LifeBuoy,
    title: "Help with your account",
    body: "Sign-in trouble, a class that will not open, a missing recording — anything that is stopping a lesson.",
    address: "support@mynexclass.lovable.app",
  },
  {
    icon: Mail,
    title: "Tutors and institutions",
    body: "Joining as a tutor, running several tutors under one admin, or anything about the institution plan.",
    address: "hello@mynexclass.lovable.app",
  },
  {
    icon: ShieldAlert,
    title: "Privacy and security",
    body: "Data requests, deletion requests, or a vulnerability you would like to report responsibly.",
    address: "security@mynexclass.lovable.app",
  },
];

function ContactPage() {
  return (
    <MarketingShell
      eyebrow="Contact"
      title="Talk to a person"
      intro="We are a small team, so messages go straight to someone who can act on them. Expect a reply within one working day."
    >
      <div className="grid gap-5 md:grid-cols-3">
        {CHANNELS.map(({ icon: Icon, title, body, address }) => (
          <Card key={title} className="border-border shadow-soft">
            <CardContent className="flex h-full flex-col pt-6">
              <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
                <Icon className="size-5" />
              </span>
              <h2 className="mt-4 text-lg font-semibold">{title}</h2>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{body}</p>
              <Button variant="outline" className="mt-5" asChild>
                <a href={`mailto:${address}`}>Email us</a>
              </Button>
              <p className="mt-2 break-all text-xs text-muted-foreground">{address}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="mt-12 rounded-3xl border border-border bg-secondary/40 px-8 py-8">
        <span className="grid size-10 place-items-center rounded-xl bg-background text-primary">
          <MessageCircle className="size-5" />
        </span>
        <h2 className="mt-4 text-xl font-semibold">Already signed in?</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Ask Hoot, the in-app assistant, first. It answers the common questions about scheduling,
          time zones, recordings and requests without waiting on email.
        </p>
        <Button className="mt-5" asChild>
          <Link to="/auth">Sign in to myNexClass</Link>
        </Button>
      </section>
    </MarketingShell>
  );
}
