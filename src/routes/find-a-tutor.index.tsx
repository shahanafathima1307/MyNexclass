import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketingShell } from "@/components/marketing-shell";
import { ProfileAvatar } from "@/components/profile-avatar";
import { usePublicTutors, type PublicTutor } from "@/lib/public-tutors";

export const Route = createFileRoute("/find-a-tutor/")({
  head: () => ({
    meta: [
      { title: "Find a tutor — browse myNexClass tutors" },
      {
        name: "description",
        content:
          "Browse the tutors teaching on myNexClass: subjects, experience, languages and hourly rates. Sign up free to request a demo class.",
      },
      { property: "og:title", content: "Find a tutor — browse myNexClass tutors" },
      {
        property: "og:description",
        content: "Subjects, experience, languages and rates for every tutor on myNexClass.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FindTutorPage,
});

function TutorPreviewCard({ tutor }: { tutor: PublicTutor }) {
  return (
    <Card className="border-border shadow-soft">
      <CardContent className="flex flex-wrap items-center gap-4 pt-6">
        <ProfileAvatar name={tutor.full_name} avatarUrl={tutor.avatar_url} className="size-14" />
        <div className="min-w-48 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold">{tutor.full_name || "Tutor"}</h2>
            {tutor.badge && <Badge variant="secondary">{tutor.badge}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {tutor.headline || tutor.subjects || "Tutor on myNexClass"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {Number(tutor.rating_count) > 0 && (
              <span className="inline-flex items-center gap-1 text-foreground">
                <Star className="size-3.5 fill-primary text-primary" />
                {Number(tutor.rating_avg).toFixed(1)} ({tutor.rating_count})
              </span>
            )}
            {tutor.years_experience > 0 && <span>{tutor.years_experience} yrs experience</span>}
            {tutor.languages && <span>{tutor.languages}</span>}
          </div>
        </div>
        <div className="text-right">
          {Number(tutor.hourly_rate) > 0 && (
            <p className="font-display text-lg font-semibold text-primary">
              {tutor.currency} {Number(tutor.hourly_rate).toFixed(0)}
              <span className="text-xs font-normal text-muted-foreground">/hr</span>
            </p>
          )}
          <Button size="sm" variant="outline" className="mt-2" asChild>
            <Link to="/find-a-tutor/$tutorId" params={{ tutorId: tutor.id }}>
              View profile
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FindTutorPage() {
  const { data, isLoading, error } = usePublicTutors();
  const [term, setTerm] = useState("");

  const q = term.trim().toLowerCase();
  const tutors = (data ?? []).filter((t) =>
    q
      ? [t.full_name, t.subjects, t.headline, t.languages]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q))
      : true,
  );

  return (
    <MarketingShell
      eyebrow="Tutor directory"
      title="Find a tutor"
      intro="A preview of the tutors teaching on myNexClass. Create a free account to see their availability and request a demo class."
    >
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by name, subject or language"
          className="pl-9"
          aria-label="Search tutors"
        />
      </div>

      <div className="mt-6 grid gap-3">
        {isLoading && <Skeleton className="h-32 w-full" />}
        {error && (
          <p className="text-sm text-muted-foreground">
            The directory could not be loaded right now. Please try again shortly.
          </p>
        )}
        {!isLoading && !error && tutors.length === 0 && (
          <p className="text-sm text-muted-foreground">No tutors match that search yet.</p>
        )}
        {tutors.map((tutor) => (
          <TutorPreviewCard key={tutor.id} tutor={tutor} />
        ))}
      </div>

      <div className="surface-ink mt-12 flex flex-wrap items-center justify-between gap-6 rounded-3xl px-8 py-10">
        <div>
          <h2 className="text-2xl font-semibold">Ready to book a lesson?</h2>
          <p className="mt-2 max-w-lg text-ink-foreground/70">
            Sign up as a student to see free slots and send a demo request.
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
