import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketingShell } from "@/components/marketing-shell";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — myNexClass plans for tutors and students" },
      {
        name: "description",
        content:
          "myNexClass is free while we build. See what is included today for students and tutors, and what the paid plans will cover.",
      },
      { property: "og:title", content: "Pricing — myNexClass plans for tutors and students" },
      {
        property: "og:description",
        content: "What is included today, and what the paid plans will cover.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

const PLANS = [
  {
    name: "Student",
    price: "Free",
    note: "while myNexClass is in early access",
    highlight: false,
    features: [
      "Unlimited classes with your tutor",
      "Shared calendar and class history",
      "Demo class requests",
      "Access to every recording from your lessons",
      "Tutor feedback, homework and parent notes",
    ],
  },
  {
    name: "Tutor",
    price: "Free",
    note: "while myNexClass is in early access",
    highlight: true,
    features: [
      "Public profile in the tutor directory",
      "Weekly availability with time zone handling",
      "Demo and class request inbox",
      "Mentor portal with sessions and earnings view",
      "Recording storage and session feedback",
    ],
  },
  {
    name: "Institution",
    price: "Talk to us",
    note: "for teaching groups and schools",
    highlight: false,
    features: [
      "Multiple tutors under one admin",
      "Role management and oversight",
      "Shared branding on invites",
      "Priority support",
    ],
  },
];

const COMING = [
  "Card payments for paid classes, with invoices and receipts",
  "Subscription plans and packages of lessons",
  "Tutor withdrawals and payout tracking",
  "Group classes with multiple participants",
];

function PricingPage() {
  return (
    <MarketingShell
      eyebrow="Pricing"
      title="Free while we are building it with you"
      intro="myNexClass is in early access. Everything below is available today at no cost, and we will give plenty of notice before any of it changes."
    >
      <div className="grid gap-5 md:grid-cols-3">
        {PLANS.map((plan) => (
          <Card
            key={plan.name}
            className={
              plan.highlight
                ? "border-primary shadow-lift ring-1 ring-primary/20"
                : "border-border shadow-soft"
            }
          >
            <CardContent className="flex h-full flex-col pt-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                {plan.highlight && <Badge>Most used</Badge>}
              </div>
              <p className="mt-4 font-display text-3xl font-semibold text-primary">{plan.price}</p>
              <p className="mt-1 text-sm text-muted-foreground">{plan.note}</p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button className="mt-6" variant={plan.highlight ? "default" : "outline"} asChild>
                {plan.name === "Institution" ? (
                  <Link to="/contact">Contact us</Link>
                ) : (
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Get started
                  </Link>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold">On the way</h2>
        <p className="mt-2 text-muted-foreground">
          These are being built. They are not available yet, and no card details are collected
          anywhere in myNexClass today.
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {COMING.map((item) => (
            <li
              key={item}
              className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>
    </MarketingShell>
  );
}
