import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BrandMark, BrandWordmark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/find-a-tutor", label: "Find a tutor" },
  { to: "/about", label: "About" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/pricing", label: "Pricing" },
  { to: "/contact", label: "Contact" },
] as const;


export function MarketingHeader() {
  return (
    <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5">
      <Link to="/" className="flex items-center gap-2 text-lg">
        <BrandMark />
        <BrandWordmark />
      </Link>

      <nav className="order-3 flex flex-wrap items-center gap-1 text-sm md:order-none">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            activeProps={{ className: "bg-secondary text-foreground" }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <Button variant="ghost" asChild>
          <Link to="/auth">Sign in</Link>
        </Button>
        <Button asChild>
          <Link to="/auth" search={{ mode: "signup" }}>
            Get started
          </Link>
        </Button>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-muted-foreground">
        <span>myNexClass · built for tutors and the students who keep them busy</span>
        <nav className="flex flex-wrap items-center gap-4">
          {NAV.map((item) => (
            <Link key={item.to} to={item.to} className="hover:text-foreground">
              {item.label}
            </Link>
          ))}
          <Link to="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link to="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}

/** Shared frame for the public marketing and legal pages. */
export function MarketingShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 pb-20 pt-6">
        {eyebrow && (
          <span className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            {eyebrow}
          </span>
        )}
        <h1 className="mt-4 text-balance text-4xl font-semibold leading-tight md:text-5xl">
          {title}
        </h1>
        {intro && <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{intro}</p>}
        <div className="mt-10">{children}</div>
      </main>
      <MarketingFooter />
    </div>
  );
}

/** Body copy block used by the legal pages. */
export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-6 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold">{heading}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
