import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Download, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSession } from "@/lib/session";
import { formatInZone, zoneAbbrev } from "@/lib/timezones";
import { useClasses } from "@/lib/tutoring";
import { statusTone } from "@/components/class-card";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Class history — myNexClass" },
      {
        name: "description",
        content:
          "Review every past tutoring class with status, tutor, student, subject and duration.",
      },
      { property: "og:title", content: "Class history — myNexClass" },
      {
        property: "og:description",
        content: "Review past tutoring classes and total hours taught.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { user } = useSession();
  const { data: classes, isLoading } = useClasses(user?.id);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const rows = useMemo(() => {
    const now = Date.now();
    const past = (classes ?? []).filter(
      (c) =>
        c.status === "completed" ||
        c.status === "cancelled" ||
        (c.status === "scheduled" && new Date(c.starts_at).getTime() < now),
    );
    const needle = q.trim().toLowerCase();
    return past
      .filter((c) => {
        const effective = c.status === "scheduled" ? ("pending" as const) : c.status;
        if (status !== "all" && effective !== status) return false;
        if (!needle) return true;
        return [c.title, c.subject, c.tutor?.full_name, c.student?.full_name].some((v) =>
          v?.toLowerCase().includes(needle),
        );
      })
      .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at));
  }, [classes, q, status]);

  const totalHours = useMemo(
    () =>
      rows.filter((c) => c.status === "completed").reduce((sum, c) => sum + c.duration_minutes, 0) /
      60,
    [rows],
  );

  function exportCsv() {
    const header = [
      "Date",
      "Time zone",
      "Title",
      "Subject",
      "Tutor",
      "Student",
      "Minutes",
      "Status",
    ];
    const lines = rows.map((c) =>
      [
        formatInZone(c.starts_at, c.time_zone, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        c.time_zone,
        c.title,
        c.subject ?? "",
        c.tutor?.full_name ?? "",
        c.student?.full_name ?? "",
        String(c.duration_minutes),
        c.status,
      ]
        .map((v) => `"${v.replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mynexclass-class-history-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell
      title="Class history"
      subtitle="Everything that already happened — searchable and exportable."
      actions={
        <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
          <Download className="size-4" />
          Export CSV
        </Button>
      }
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Past classes</p>
            <p className="font-display text-2xl font-semibold">{rows.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Hours completed</p>
            <p className="font-display text-2xl font-semibold">{totalHours.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Cancelled</p>
            <p className="font-display text-2xl font-semibold">
              {rows.filter((c) => c.status === "cancelled").length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search title, subject or person"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search class history"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="pending">Awaiting wrap-up</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length ? (
        <Card className="shadow-soft">
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Tutor</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Length</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatInZone(c.starts_at, c.time_zone)}{" "}
                      <span className="text-muted-foreground">
                        {zoneAbbrev(c.starts_at, c.time_zone)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{c.title}</span>
                      {c.subject && (
                        <Badge variant="outline" className="ml-2">
                          {c.subject}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{c.tutor?.full_name || "—"}</TableCell>
                    <TableCell>{c.student?.full_name || "—"}</TableCell>
                    <TableCell>{c.duration_minutes} min</TableCell>
                    <TableCell>
                      <Badge variant={statusTone(c.status)} className="capitalize">
                        {c.status === "scheduled" ? "awaiting wrap-up" : c.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">No past classes match those filters.</p>
      )}
    </AppShell>
  );
}
