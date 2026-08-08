import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, FileText, ShieldAlert } from "lucide-react";
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
  fieldLabel,
  openApprovalDocument,
  statusTone,
  useAddApprovalNote,
  useApprovalAdmin,
  useApprovalDetail,
  useSetApprovalStatus,
  useStartReview,
} from "@/lib/approvals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/approvals/$requestId")({
  head: () => ({
    meta: [
      { title: "Application review · myNexClass admin" },
      {
        name: "description",
        content: "Full registration details, documents, notes and decision history for one applicant.",
      },
      { property: "og:title", content: "Application review · myNexClass admin" },
      {
        property: "og:description",
        content: "Full registration details, documents, notes and decision history for one applicant.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApprovalDetailPage,
});

function Field({ label, value }: { label: string; value: unknown }) {
  const text =
    value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{text}</p>
    </div>
  );
}

function ApprovalDetailPage() {
  const { requestId } = Route.useParams();
  const { user } = useSession();
  const { data: adminInfo, isLoading: roleLoading } = useApprovalAdmin(user?.id);
  const isAdmin = !!adminInfo?.isAdmin;
  const { data, isLoading } = useApprovalDetail(isAdmin ? requestId : undefined);
  const startReview = useStartReview();
  const addNote = useAddApprovalNote();
  const setStatus = useSetApprovalStatus();
  const [note, setNote] = useState("");
  const [dialog, setDialog] = useState<null | "approve" | "reject" | "info" | "assign">(null);

  if (roleLoading || (isAdmin && isLoading)) {
    return (
      <AppShell title="Application review">
        <Skeleton className="h-96 w-full" />
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell title="Application review" subtitle="Administrators only">
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            You do not have access to this application.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell title="Application review">
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            This application could not be found.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const { request, profile, contact, details, documents, history, notes, duplicates } = data;
  const actor = { actorId: user!.id, actorRole: "admin" };
  const detailRecord = (details ?? {}) as Record<string, unknown>;
  const hidden = ["id", "user_id", "created_at", "updated_at"];
  const detailEntries = Object.entries(detailRecord).filter(([k]) => !hidden.includes(k));

  return (
    <AppShell
      title={profile?.full_name ?? "Applicant"}
      subtitle={`${request.user_type === "tutor" ? "Tutor" : "Student"} application · submitted ${new Date(request.created_at).toLocaleString()}`}
      actions={
        <Button variant="outline" asChild>
          <Link to="/approvals">
            <ArrowLeft className="mr-2 size-4" />
            Back to queue
          </Link>
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Status</CardTitle>
              <Badge className={statusTone(request.status)} variant="secondary">
                {STATUS_LABEL[request.status]}
              </Badge>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Reviewer" value={data.reviewerName ?? "Unassigned"} />
              <Field
                label="Review started"
                value={
                  request.review_started_at
                    ? new Date(request.review_started_at).toLocaleString()
                    : null
                }
              />
              <Field
                label="Decision"
                value={request.decision_at ? new Date(request.decision_at).toLocaleString() : null}
              />
              <Field label="Internal reason" value={request.internal_reason} />
              {request.requested_fields?.length ? (
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Information requested
                  </p>
                  <p className="text-sm">
                    {request.requested_fields.map((f) => fieldLabel(f)).join(", ")}
                  </p>
                </div>
              ) : null}
              {request.applicant_response ? (
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Applicant response
                  </p>
                  <p className="text-sm">{request.applicant_response}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {duplicates.length > 0 && (
            <Card className="border-destructive/40">
              <CardHeader className="flex-row items-center gap-2 space-y-0">
                <ShieldAlert className="size-4 text-destructive" />
                <CardTitle className="text-destructive">Possible duplicate registration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {duplicates.map((d) => (
                  <p key={d.id}>
                    Matched on {fieldLabel(d.match_field)}
                    {d.match_value ? `: ${d.match_value}` : ""}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Registration details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" value={profile?.full_name} />
              <Field label="Email" value={contact?.contact_email} />
              <Field label="Phone" value={contact?.phone} />
              {detailEntries.map(([key, value]) => (
                <Field key={key} label={fieldLabel(key)} value={value} />
              ))}
              {detailEntries.length === 0 && (
                <p className="text-sm text-muted-foreground sm:col-span-2">
                  The applicant has not filled in the registration form yet.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {documents.length === 0 && (
                <p className="text-sm text-muted-foreground">No documents uploaded.</p>
              )}
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="size-4 shrink-0" />
                    <span className="truncate">
                      {doc.file_name}
                      <span className="ml-2 text-muted-foreground">{fieldLabel(doc.kind)}</span>
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const url = await openApprovalDocument(doc, user!.id);
                        window.open(url, "_blank", "noopener,noreferrer");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Could not open document");
                      }
                    }}
                  >
                    View
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Approval history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.length === 0 && (
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              )}
              {history.map((h) => (
                <div key={h.id} className="border-l-2 border-border pl-3 text-sm">
                  <p className="font-medium">{fieldLabel(h.action)}</p>
                  <p className="text-muted-foreground">
                    {new Date(h.created_at).toLocaleString()} · {h.actor_role}
                    {h.from_status && h.to_status
                      ? ` · ${STATUS_LABEL[h.from_status]} → ${STATUS_LABEL[h.to_status]}`
                      : ""}
                  </p>
                  {h.reason && <p className="mt-1">{h.reason}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full"
                variant="outline"
                onClick={async () => {
                  try {
                    await startReview.mutateAsync({ request, ...actor });
                    toast.success("Review started");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed");
                  }
                }}
              >
                Start review
              </Button>
              <Button className="w-full" onClick={() => setDialog("approve")}>
                Approve
              </Button>
              <Button
                className="w-full"
                variant="destructive"
                onClick={() => setDialog("reject")}
              >
                Reject
              </Button>
              <Button className="w-full" variant="outline" onClick={() => setDialog("info")}>
                Request more information
              </Button>
              <Button className="w-full" variant="outline" onClick={() => setDialog("assign")}>
                Assign reviewer
              </Button>
              <Separator className="my-2" />
              {request.status === "approved" ? (
                <>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() =>
                      setStatus.mutate(
                        { request, ...actor, status: "suspended" },
                        { onSuccess: () => toast.success("Account suspended") },
                      )
                    }
                  >
                    Suspend account
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() =>
                      setStatus.mutate(
                        { request, ...actor, status: "deactivated" },
                        { onSuccess: () => toast.success("Account deactivated") },
                      )
                    }
                  >
                    Deactivate account
                  </Button>
                </>
              ) : (
                (request.status === "suspended" || request.status === "deactivated") && (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() =>
                      setStatus.mutate(
                        { request, ...actor, status: "approved" },
                        { onSuccess: () => toast.success("Account reactivated") },
                      )
                    }
                  >
                    Reactivate account
                  </Button>
                )
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Internal notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Visible to administrators only"
                maxLength={1000}
              />
              <Button
                size="sm"
                disabled={!note.trim() || addNote.isPending}
                onClick={async () => {
                  try {
                    await addNote.mutateAsync({ request, ...actor, body: note.trim() });
                    setNote("");
                    toast.success("Note added");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not add note");
                  }
                }}
              >
                Add note
              </Button>
              <div className="space-y-3">
                {notes.map((n) => (
                  <div key={n.id} className="rounded-lg bg-muted p-3 text-sm">
                    <p>{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {n.authorName ?? "Admin"} · {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ApproveDialog
        request={request}
        open={dialog === "approve"}
        onOpenChange={(o) => setDialog(o ? "approve" : null)}
        {...actor}
      />
      <RejectDialog
        request={request}
        open={dialog === "reject"}
        onOpenChange={(o) => setDialog(o ? "reject" : null)}
        {...actor}
      />
      <RequestInfoDialog
        request={request}
        open={dialog === "info"}
        onOpenChange={(o) => setDialog(o ? "info" : null)}
        {...actor}
      />
      <AssignReviewerDialog
        request={request}
        open={dialog === "assign"}
        onOpenChange={(o) => setDialog(o ? "assign" : null)}
        {...actor}
      />
    </AppShell>
  );
}
