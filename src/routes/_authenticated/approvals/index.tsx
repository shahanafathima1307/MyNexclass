import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, MoreHorizontal, Search, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/lib/session";
import {
  ApproveDialog,
  AssignReviewerDialog,
  RejectDialog,
  RequestInfoDialog,
} from "@/components/approvals/decision-dialogs";
import {
  STATUS_LABEL,
  STATUS_ORDER,
  statusTone,
  useApprovalAdmin,
  useApprovalQueue,
  useStartReview,
  type ApprovalRequest,
  type ApprovalStatus,
  type QueueRow,
} from "@/lib/approvals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/approvals/")({
  head: () => ({
    meta: [
      { title: "My Approvals · myNexClass admin" },
      {
        name: "description",
        content: "Review, approve or reject new student and tutor registrations on myNexClass.",
      },
      { property: "og:title", content: "My Approvals · myNexClass admin" },
      {
        property: "og:description",
        content: "Review, approve or reject new student and tutor registrations on myNexClass.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApprovalsPage,
});

const TABS = [
  { key: "all", label: "All" },
  { key: "students", label: "Students" },
  { key: "tutors", label: "Tutors" },
  { key: "pending_approval", label: "Pending" },
  { key: "under_review", label: "Under Review" },
  { key: "more_info_required", label: "More Info" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

const PAGE_SIZE = 10;

function isToday(value: string | null) {
  if (!value) return false;
  const d = new Date(value);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function ApprovalsPage() {
  const { user } = useSession();
  const { data: adminInfo, isLoading: roleLoading } = useApprovalAdmin(user?.id);
  const isAdmin = !!adminInfo?.isAdmin;
  const { data: rows, isLoading } = useApprovalQueue(isAdmin);
  const startReview = useStartReview();

  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(0);

  const [dialog, setDialog] = useState<null | "approve" | "reject" | "info" | "assign">(null);
  const [target, setTarget] = useState<ApprovalRequest | null>(null);

  const all = useMemo(() => rows ?? [], [rows]);

  const summary = useMemo(() => {
    const pendingStatuses: ApprovalStatus[] = [
      "pending_approval",
      "under_review",
      "more_info_required",
    ];
    return {
      totalPending: all.filter((r) => pendingStatuses.includes(r.status)).length,
      newStudents: all.filter((r) => r.status === "pending_approval" && r.user_type === "student")
        .length,
      newTutors: all.filter((r) => r.status === "pending_approval" && r.user_type === "tutor")
        .length,
      underReview: all.filter((r) => r.status === "under_review").length,
      moreInfo: all.filter((r) => r.status === "more_info_required").length,
      approvedToday: all.filter((r) => r.status === "approved" && isToday(r.decision_at)).length,
      rejectedToday: all.filter((r) => r.status === "rejected" && isToday(r.decision_at)).length,
    };
  }, [all]);

  const countries = useMemo(
    () => [...new Set(all.map((r) => r.details?.country).filter(Boolean) as string[])],
    [all],
  );

  const filtered = useMemo(() => {
    let list = [...all];
    if (tab === "students") list = list.filter((r) => r.user_type === "student");
    else if (tab === "tutors") list = list.filter((r) => r.user_type === "tutor");
    else if (tab !== "all") list = list.filter((r) => r.status === tab);

    if (typeFilter !== "all") list = list.filter((r) => r.user_type === typeFilter);
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    if (countryFilter !== "all") list = list.filter((r) => r.details?.country === countryFilter);
    const q = search.trim().toLowerCase();
    if (q)
      list = list.filter((r) =>
        [r.full_name, r.contact_email, r.details?.mobile, r.details?.grade, r.details?.subjects_taught]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    list.sort((a, b) =>
      sort === "newest"
        ? +new Date(b.created_at) - +new Date(a.created_at)
        : sort === "oldest"
          ? +new Date(a.created_at) - +new Date(b.created_at)
          : a.full_name.localeCompare(b.full_name),
    );
    return list;
  }, [all, tab, typeFilter, statusFilter, countryFilter, search, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  if (roleLoading) {
    return (
      <AppShell title="My Approvals">
        <Skeleton className="h-64 w-full" />
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell title="My Approvals" subtitle="Administrators only">
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <ShieldCheck className="mx-auto mb-3 size-8" />
            You do not have access to the approval queue.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const cards = [
    { label: "Total pending", value: summary.totalPending },
    { label: "New students", value: summary.newStudents },
    { label: "New tutors", value: summary.newTutors },
    { label: "Under review", value: summary.underReview },
    { label: "More info required", value: summary.moreInfo },
    { label: "Approved today", value: summary.approvedToday },
    { label: "Rejected today", value: summary.rejectedToday },
  ];

  function openDialog(kind: "approve" | "reject" | "info" | "assign", row: QueueRow) {
    setTarget(row as ApprovalRequest);
    setDialog(kind);
  }

  return (
    <AppShell
      title="My Approvals"
      subtitle="Review new student and tutor registrations before they get platform access."
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v);
          setPage(0);
        }}
        className="mb-4"
      >
        <TabsList className="flex flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, email, mobile, subject"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="User type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="student">Students</SelectItem>
            <SelectItem value="tutor">Tutors</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={countryFilter} onValueChange={setCountryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : current.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No applications match these filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Grade / subject</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reviewer</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {current.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        <Link to="/approvals/$requestId" params={{ requestId: row.id }}>
                          {row.full_name}
                        </Link>
                      </TableCell>
                      <TableCell className="capitalize">{row.user_type}</TableCell>
                      <TableCell className="text-sm">
                        <div>{row.contact_email ?? "—"}</div>
                        <div className="text-muted-foreground">{row.details?.mobile ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.details?.mobile_verified ? "Mobile verified" : "Mobile unverified"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.user_type === "tutor"
                          ? (row.details?.subjects_taught ?? "—")
                          : (row.details?.grade ?? "—")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(row.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusTone(row.status)} variant="secondary">
                          {STATUS_LABEL[row.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{row.reviewerName ?? "Unassigned"}</TableCell>
                      <TableCell>
                        {row.duplicates > 0 || row.missing.length > 0 ? (
                          <span className="flex items-center gap-1 text-xs text-destructive">
                            <AlertTriangle className="size-3" />
                            {row.duplicates > 0 ? `${row.duplicates} duplicate` : ""}
                            {row.duplicates > 0 && row.missing.length > 0 ? " · " : ""}
                            {row.missing.length > 0 ? `${row.missing.length} missing` : ""}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Clear</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Actions">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to="/approvals/$requestId" params={{ requestId: row.id }}>
                                View application
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                try {
                                  await startReview.mutateAsync({
                                    request: row as ApprovalRequest,
                                    actorId: user!.id,
                                    actorRole: "admin",
                                  });
                                  toast.success("Review started");
                                } catch (e) {
                                  toast.error(e instanceof Error ? e.message : "Failed");
                                }
                              }}
                            >
                              Start review
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDialog("approve", row)}>
                              Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDialog("reject", row)}>
                              Reject
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDialog("info", row)}>
                              Request more information
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDialog("assign", row)}>
                              Assign reviewer
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to="/approvals/$requestId" params={{ requestId: row.id }}>
                                Add internal note
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link to="/approvals/$requestId" params={{ requestId: row.id }}>
                                View history
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {filtered.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page + 1} of {pageCount} · {filtered.length} applications
          </p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={page + 1 >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {user && (
        <>
          <ApproveDialog
            request={target}
            open={dialog === "approve"}
            onOpenChange={(o) => setDialog(o ? "approve" : null)}
            actorId={user.id}
            actorRole="admin"
          />
          <RejectDialog
            request={target}
            open={dialog === "reject"}
            onOpenChange={(o) => setDialog(o ? "reject" : null)}
            actorId={user.id}
            actorRole="admin"
          />
          <RequestInfoDialog
            request={target}
            open={dialog === "info"}
            onOpenChange={(o) => setDialog(o ? "info" : null)}
            actorId={user.id}
            actorRole="admin"
          />
          <AssignReviewerDialog
            request={target}
            open={dialog === "assign"}
            onOpenChange={(o) => setDialog(o ? "assign" : null)}
            actorId={user.id}
            actorRole="admin"
          />
        </>
      )}
    </AppShell>
  );
}
