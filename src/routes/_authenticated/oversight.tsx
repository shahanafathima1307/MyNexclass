import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Activity, ScrollText, Video } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useMembers, useMyRole } from "@/lib/tutoring";
import { formatDuration } from "@/lib/class-people";
import { useAuditLog } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/oversight")({
  head: () => ({
    meta: [
      { title: "Oversight — myNexClass" },
      {
        name: "description",
        content: "Admin view of live sessions, join history and the myNexClass audit trail.",
      },
      { property: "og:title", content: "Oversight — myNexClass" },
      {
        property: "og:description",
        content: "Admin view of live sessions, join history and the myNexClass audit trail.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OversightPage,
});

function useSessionLogs(enabled: boolean) {
  return useQuery({
    queryKey: ["oversight-sessions"],
    enabled,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_attendance")
        .select("*, classes(id, title, subject, starts_at, tutor_id, student_id, status)")
        .order("joined_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function OversightPage() {
  const { user } = useSession();
  const { data: role } = useMyRole(user?.id);
  const isAdmin = role === "admin";
  const { data: members } = useMembers();
  const { data: logs } = useSessionLogs(isAdmin);
  const { data: audit } = useAuditLog(isAdmin);

  const nameOf = (id: string | null) =>
    (id && members?.find((m) => m.id === id)?.full_name) || "Unnamed member";

  if (!isAdmin) {
    return (
      <AppShell title="Oversight" subtitle="Admins only.">
        <Card className="border-border shadow-soft">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            This page is only available to administrators.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const live = (logs ?? []).filter((l) => !l.left_at);

  return (
    <AppShell
      title="Oversight"
      subtitle="Live sessions, join history and the audit trail."
    >
      <div className="grid gap-6">
        <Card className="border-accent shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4" />
              Live sessions ({live.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {live.length ? (
              <div className="grid gap-3">
                {live.map((l) => (
                  <div key={l.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                    <Badge>In room</Badge>
                    <span className="font-medium">{l.classes?.title ?? "Class"}</span>
                    <span className="text-sm text-muted-foreground">{nameOf(l.user_id)}</span>
                    <span className="text-sm text-muted-foreground">
                      joined {formatDistanceToNow(new Date(l.joined_at), { addSuffix: true })}
                    </span>
                    {l.class_id && (
                      <Button size="sm" variant="outline" asChild className="ml-auto">
                        <Link to="/room/$classId" params={{ classId: l.class_id }}>
                          <Video className="size-4" />
                          Open room
                        </Link>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No one is in a class room right now.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-soft">
          <CardHeader>
            <CardTitle>Session & join history</CardTitle>
          </CardHeader>
          <CardContent>
            {logs?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead>Person</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Time in room</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.classes?.title ?? "Class"}</TableCell>
                      <TableCell>{nameOf(l.user_id)}</TableCell>
                      <TableCell>{format(new Date(l.joined_at), "d MMM · HH:mm")}</TableCell>
                      <TableCell>{formatDuration(l.joined_at, l.left_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No sessions recorded yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="size-4" />
              Audit log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {audit?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{format(new Date(a.created_at), "d MMM · HH:mm")}</TableCell>
                      <TableCell>{nameOf(a.actor_id)}</TableCell>
                      <TableCell>{a.action}</TableCell>
                      <TableCell className="text-muted-foreground">{a.entity ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                No recorded actions yet — payout decisions and class changes appear here.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
