import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Filter, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AssignmentDetail } from "@/components/assignments/assignment-detail";
import { AssignmentForm } from "@/components/assignments/assignment-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/lib/session";
import { useClasses, useMembers, useMyRole } from "@/lib/tutoring";
import {
  effectiveStatus,
  latestSubmission,
  STATUS_CLASS,
  STATUS_LABEL,
  useAssignments,
  type AssignmentFull,
  type AssignmentStatus,
} from "@/lib/assignments";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/assignments")({
  head: () => ({
    meta: [
      { title: "Assignments — myNexClass" },
      {
        name: "description",
        content: "Set homework, submit your work and get graded feedback from your tutor.",
      },
      { property: "og:title", content: "Assignments — myNexClass" },
      {
        property: "og:description",
        content: "Set homework, submit your work and get graded feedback from your tutor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AssignmentsPage,
});

const ACTIVE: AssignmentStatus[] = [
  "assigned",
  "viewed",
  "in_progress",
  "revision_requested",
  "overdue",
];
const PENDING: AssignmentStatus[] = ["submitted", "submitted_late", "resubmitted", "under_review"];
const DONE: AssignmentStatus[] = ["graded", "completed"];

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-2xl font-semibold", tone)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function AssignmentsPage() {
  const { user } = useSession();
  const userId = user?.id;
  const { data: role } = useMyRole(userId);
  const { data: members } = useMembers();
  const { data: classes } = useClasses(userId);
  const { data: assignments, isLoading } = useAssignments(userId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const isTutorSide = role === "tutor" || role === "admin";
  const actor = useMemo(() => ({ id: userId ?? "", role: role ?? "student" }), [userId, role]);

  const nameOf = (id: string) =>
    members?.find((m) => m.id === id)?.full_name ?? "Unknown";

  const mine = useMemo(() => {
    const list = assignments ?? [];
    return isTutorSide
      ? list.filter((a) => a.tutor_id === userId || role === "admin")
      : list.filter((a) => a.student_id === userId);
  }, [assignments, isTutorSide, role, userId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mine.filter((a) => {
      const status = effectiveStatus(a);
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!q) return true;
      const person = isTutorSide ? nameOf(a.student_id) : nameOf(a.tutor_id);
      return (
        a.title.toLowerCase().includes(q) ||
        (a.subject ?? "").toLowerCase().includes(q) ||
        person.toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, search, statusFilter, isTutorSide, members]);

  const bucketed = (list: AssignmentFull[], states: AssignmentStatus[]) =>
    list.filter((a) => states.includes(effectiveStatus(a)));

  const active = bucketed(filtered, ACTIVE);
  const pending = bucketed(filtered, PENDING);
  const done = bucketed(filtered, DONE);
  const drafts = filtered.filter((a) => a.status === "draft");

  const selected = mine.find((a) => a.id === selectedId) ?? null;
  const students = (members ?? []).filter((m) => m.role === "student");

  const Row = ({ a }: { a: AssignmentFull }) => {
    const status = effectiveStatus(a);
    const last = latestSubmission(a);
    return (
      <button
        type="button"
        onClick={() => setSelectedId(a.id)}
        className="flex w-full flex-col gap-1 rounded-lg border p-3 text-left transition hover:bg-muted/60"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{a.title}</span>
          <Badge variant="outline" className={cn("text-xs", STATUS_CLASS[status])}>
            {STATUS_LABEL[status]}
          </Badge>
          {a.priority !== "normal" && (
            <Badge variant="secondary" className="text-xs capitalize">
              {a.priority}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {isTutorSide ? nameOf(a.student_id) : nameOf(a.tutor_id)}
          {a.subject ? ` · ${a.subject}` : ""}
          {a.due_at ? ` · due ${format(new Date(a.due_at), "d MMM, HH:mm")}` : " · no due date"}
          {last ? ` · v${last.version}` : ""}
          {last?.grade ? ` · ${last.grade}` : ""}
        </p>
      </button>
    );
  };

  const List = ({ list, empty }: { list: AssignmentFull[]; empty: string }) =>
    list.length === 0 ? (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    ) : (
      <div className="space-y-2">
        {list.map((a) => (
          <Row key={a.id} a={a} />
        ))}
      </div>
    );

  return (
    <AppShell
      title="Assignments"
      subtitle={
        isTutorSide
          ? "Create work, track submissions and return graded feedback."
          : "See what's due, submit your work and read your tutor's feedback."
      }
      actions={
        isTutorSide && userId ? (
          <AssignmentForm
            actor={actor}
            tutorId={userId}
            students={students}
            classes={(classes ?? []).map((c) => ({ id: c.id, title: c.title }))}
          />
        ) : undefined
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Active" value={active.length} tone="text-foreground" />
          <StatCard
            label={isTutorSide ? "Awaiting review" : "Submitted"}
            value={pending.length}
            tone="text-primary"
          />
          <StatCard
            label="Overdue"
            value={filtered.filter((a) => effectiveStatus(a) === "overdue").length}
            tone="text-destructive"
          />
          <StatCard label="Completed" value={done.length} tone="text-emerald-600" />
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, subject or person"
              className="pl-9"
              aria-label="Search assignments"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-52">
              <Filter className="mr-2 size-4" />
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(STATUS_LABEL) as AssignmentStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Your assignments</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="active">
                <TabsList className="flex-wrap">
                  <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
                  <TabsTrigger value="pending">
                    {isTutorSide ? "To review" : "Submitted"} ({pending.length})
                  </TabsTrigger>
                  <TabsTrigger value="done">Completed ({done.length})</TabsTrigger>
                  {isTutorSide && <TabsTrigger value="drafts">Drafts ({drafts.length})</TabsTrigger>}
                </TabsList>
                <TabsContent value="active" className="pt-4">
                  <List list={active} empty="Nothing active right now." />
                </TabsContent>
                <TabsContent value="pending" className="pt-4">
                  <List
                    list={pending}
                    empty={isTutorSide ? "No submissions waiting on you." : "Nothing submitted yet."}
                  />
                </TabsContent>
                <TabsContent value="done" className="pt-4">
                  <List list={done} empty="No completed assignments yet." />
                </TabsContent>
                {isTutorSide && (
                  <TabsContent value="drafts" className="pt-4">
                    <List list={drafts} empty="No drafts saved." />
                  </TabsContent>
                )}
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>

      {selected && (
        <AssignmentDetail
          assignment={selected}
          actor={actor}
          isTutorSide={isTutorSide}
          tutorName={nameOf(selected.tutor_id)}
          studentName={nameOf(selected.student_id)}
          onOpenChange={(open) => !open && setSelectedId(null)}
        />
      )}
    </AppShell>
  );
}
