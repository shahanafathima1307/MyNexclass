import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Languages, Star, Timer, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketingShell } from "@/components/marketing-shell";
import { ProfileAvatar } from "@/components/profile-avatar";
import { usePublicTutors } from "@/lib/public-tutors";

export const Route = createFileRoute("/find-a-tutor/$tutorId")({
  head: () => ({
    meta: [
      { title: "Tutor profile — myNexClass" },
      {
        name: "description",
        content:
          "Subjects, experience, languages, rating and hourly rate for this myNexClass tutor. Sign up free to see availability and request a demo class.",
      },
      { property: "og:title", content: "Tutor profile — myNexClass" },
      {
        property: "og:description",
        content: "Subjects, experience, languages and rate for this myNexClass tutor.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicTutorProfile,
});

function PublicTutorProfile() {
  const { tutorId } = Route.useParams();
  const { data, isLoading } = usePublicTutors();
  const tutor = data?.find((t) => t.id === tutorId) ?? null;

  if (isLoading) {
    return (
      <MarketingShell title="Tutor profile">
        <Skeleton className="h-48 w-full" />
      </MarketingShell>
    );
  }

  if (!tutor) {
    return (
      <MarketingShell
        title="Tutor not found"
        intro="This tutor is no longer listed in the public directory."
      >
        <Button variant="outline" asChild>
          <Link to="/find-a-tutor">
            <ArrowLeft className="size-4" />
            Back to the directory
          </Link>
        </Button>
      </MarketingShell>
    );
  }

  const facts = [
    tutor.years_experience > 0 && {
      icon: Timer,
      label: "Experience",
      value: `${tutor.years_experience} years`,
    },
    tutor.languages && { icon: Languages, label: "Languages", value: tutor.languages },
    Number(tutor.hourly_rate) > 0 && {
      icon: Wallet,
      label: "Hourly rate",
      value: `${tutor.currency} ${Number(tutor.hourly_rate).toFixed(0)}`,
    },
    Number(tutor.rating_count) > 0 && {
      icon: Star,
      label: "Rating",
      value: `${Number(tutor.rating_avg).toFixed(1)} from ${tutor.rating_count} students`,
    },
  ].filter(Boolean) as { icon: typeof Timer; label: string; value: string }[];

  return (
    <MarketingShell
      eyebrow="Tutor profile"
      title={tutor.full_name || "Tutor"}
      intro={tutor.headline || tutor.subjects || undefined}
    >
      <div className="flex flex-wrap items-center gap-4">
        <ProfileAvatar name={tutor.full_name} avatarUrl={tutor.avatar_url} className="size-20" />
        <div className="flex flex-wrap gap-2">
          {tutor.badge && <Badge variant="secondary">{tutor.badge}</Badge>}
          {tutor.subjects && <Badge variant="outline">{tutor.subjects}</Badge>}
        </div>
      </div>

      {facts.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {facts.map(({ icon: Icon, label, value }) => (
            <Card key={label} className="border-border shadow-soft">
              <CardContent className="flex items-center gap-3 pt-6">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="font-medium">{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tutor.bio && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">About {tutor.full_name?.split(" ")[0] || "them"}</h2>
          <p className="mt-3 whitespace-pre-line text-muted-foreground">{tutor.bio}</p>
        </section>
      )}

      <div className="surface-ink mt-12 flex flex-wrap items-center justify-between gap-6 rounded-3xl px-8 py-10">
        <div>
          <h2 className="text-2xl font-semibold">See their free slots</h2>
          <p className="mt-2 max-w-lg text-ink-foreground/70">
            Availability, ratings and demo requests are available once you have a free account.
          </p>
        </div>
        <Button size="lg" variant="secondary" asChild>
          <Link to="/auth" search={{ mode: "signup" }}>
            Sign up to book
          </Link>
        </Button>
      </div>

      <div className="mt-8">
        <Button variant="outline" asChild>
          <Link to="/find-a-tutor">
            <ArrowLeft className="size-4" />
            Back to the directory
          </Link>
        </Button>
      </div>
    </MarketingShell>
  );
}
