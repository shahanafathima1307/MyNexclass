import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useMembers } from "@/lib/tutoring";

export const Route = createFileRoute("/_authenticated/tutors/")({
  head: () => ({
    meta: [
      { title: "Tutors — myNexClass" },
      {
        name: "description",
        content:
          "Browse myNexClass tutors, the subjects they teach and open their profile to book a class.",
      },
      { property: "og:title", content: "Tutors — myNexClass" },
      {
        property: "og:description",
        content: "Browse tutors and the subjects they teach on myNexClass.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TutorsPage,
});

function TutorsPage() {
  const { data: members, isLoading } = useMembers();
  const [q, setQ] = useState("");

  const tutors = useMemo(() => {
    const list = (members ?? []).filter((m) => m.role === "tutor");
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((m) =>
      [m.full_name, m.subjects, m.bio].some((v) => v?.toLowerCase().includes(needle)),
    );
  }, [members, q]);

  return (
    <AppShell title="Tutors" subtitle="Every tutor on myNexClass, with the subjects they cover.">
      <div className="relative mb-6 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search name or subject"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search tutors"
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : tutors.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tutors.map((t) => (
            <Card key={t.id} className="shadow-soft transition-shadow hover:shadow-md">
              <CardContent className="pt-6">
                <Link
                  to="/tutors/$tutorId"
                  params={{ tutorId: t.id }}
                  className="flex items-start gap-3"
                >
                  <ProfileAvatar name={t.full_name} avatarUrl={t.avatar_url} className="size-12" />
                  <div>
                    <p className="font-display text-base font-semibold">
                      {t.full_name || "Unnamed tutor"}
                    </p>
                    {t.subjects && (
                      <Badge variant="secondary" className="mt-1">
                        {t.subjects}
                      </Badge>
                    )}
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                      {t.bio || "No bio yet."}
                    </p>
                    {(t.contact_email || t.phone) && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {[t.contact_email, t.phone].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No tutors match that search.</p>
      )}
    </AppShell>
  );
}
