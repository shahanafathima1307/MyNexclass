import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  History as HistoryIcon,
  Link2,
  RotateCcw,
  Send,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { FileDrop } from "@/components/assignments/file-drop";
import { alertAssignment } from "@/lib/assignment-alerts";
import {
  assignmentFileUrl,
  effectiveStatus,
  formatBytes,
  latestSubmission,
  logHistory,
  STATUS_CLASS,
  STATUS_LABEL,
  useAssignmentHistory,
  useGradeSubmission,
  useMarkUnderReview,
  useMarkViewed,
  useSubmitAssignment,
  useUpdateAssignment,
  type Actor,
  type AssignmentFull,
} from "@/lib/assignments";
import { cn } from "@/lib/utils";

interface Props {
  assignment: AssignmentFull | null;
  actor: Actor;
  isTutorSide: boolean;
  tutorName: string;
  studentName: string;
  onOpenChange: (open: boolean) => void;
}

function StatusBadge({ status }: { status: keyof typeof STATUS_LABEL }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_CLASS[status])}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

async function openFile(path: string) {
  try {
    const url = await assignmentFileUrl(path);
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    toast.error("That file could not be opened. Ask for it to be re-uploaded.");
  }
}

export function AssignmentDetail({
  assignment,
  actor,
  isTutorSide,
  tutorName,
  studentName,
  onOpenChange,
}: Props) {
  const [comment, setComment] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [grade, setGrade] = useState("");
  const [marks, setMarks] = useState("");
  const [feedback, setFeedback] = useState("");
  const [returnFiles, setReturnFiles] = useState<File[]>([]);
  const [newDue, setNewDue] = useState("");
  const [busy, setBusy] = useState(false);

  const history = useAssignmentHistory(assignment?.id);
  const submit = useSubmitAssignment();
  const gradeMutation = useGradeSubmission();
  const update = useUpdateAssignment();
  const markViewed = useMarkViewed();
  const markUnderReview = useMarkUnderReview();

  const current = assignment ? effectiveStatus(assignment) : "draft";
  const last = assignment ? latestSubmission(assignment) : null;
  const versions = useMemo(
    () => (assignment ? [...assignment.submissions].sort((a, b) => b.version - a.version) : []),
    [assignment],
  );

  // Opening the sheet advances the workflow for whichever side is looking.
  useEffect(() => {
    if (!assignment) return;
    setGrade(last?.grade ?? "");
    setMarks(last?.marks != null ? String(last.marks) : "");
    setFeedback(last?.feedback ?? "");
    if (isTutorSide) markUnderReview.mutate({ assignment, actor });
    else if (assignment.student_id === actor.id) markViewed.mutate({ assignment, actor });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment?.id]);

  if (!assignment) return null;

  const briefs = assignment.attachments.filter((a) => a.kind === "brief");
  const returned = assignment.attachments.filter((a) => a.kind === "returned");
  const canSubmit =
    !isTutorSide &&
    assignment.student_id === actor.id &&
    !["completed", "cancelled", "draft"].includes(assignment.status) &&
    (!last || assignment.allow_resubmission || assignment.status === "revision_requested");

  const download = async (path: string, name: string) => {
    await openFile(path);
    await logHistory({ assignmentId: assignment.id, actor, action: `Downloaded ${name}` });
    history.refetch();
  };

  const doSubmit = async () => {
    if (files.length === 0 && !comment.trim() && !externalUrl.trim()) {
      toast.error("Attach a file, a link or a comment before submitting.");
      return;
    }
    setBusy(true);
    setProgress(5);
    try {
      const result = await submit.mutateAsync({
        assignment,
        actor,
        comment: comment.trim(),
        externalUrl: externalUrl.trim(),
        files,
        onProgress: setProgress,
      });
      await alertAssignment({
        assignmentId: assignment.id,
        recipientId: assignment.tutor_id,
        title: `${studentName} submitted "${assignment.title}"`,
        body: result.late ? "Submitted after the due date." : undefined,
        kind: result.late ? "submitted_late" : "submitted",
      });
      toast.success(
        result.late
          ? `Submitted late as version ${result.version}.`
          : `Submitted as version ${result.version}.`,
      );
      setFiles([]);
      setComment("");
      setExternalUrl("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Submission failed.");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const doGrade = async (outcome: "graded" | "revision") => {
    if (!last) return toast.error("There is nothing to grade yet.");
    setBusy(true);
    try {
      await gradeMutation.mutateAsync({
        assignment,
        submissionId: last.id,
        actor,
        grade: grade.trim(),
        marks: marks.trim() ? Number(marks) : null,
        feedback: feedback.trim(),
        outcome,
        files: returnFiles,
      });
      await alertAssignment({
        assignmentId: assignment.id,
        recipientId: assignment.student_id,
        title:
          outcome === "graded"
            ? `Your work on "${assignment.title}" is graded`
            : `Revision requested on "${assignment.title}"`,
        body: feedback.trim() || undefined,
        kind: outcome === "graded" ? "graded" : "returned",
        grade: grade.trim() || undefined,
        feedback: feedback.trim() || undefined,
      });
      setReturnFiles([]);
      toast.success(outcome === "graded" ? "Grade published." : "Revision requested.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save feedback.");
    } finally {
      setBusy(false);
    }
  };

  const runUpdate = async (
    patch: Parameters<typeof update.mutateAsync>[0]["patch"],
    action: string,
    alert?: Parameters<typeof alertAssignment>[0],
  ) => {
    setBusy(true);
    try {
      await update.mutateAsync({ assignment, actor, patch, action });
      if (alert) await alertAssignment(alert);
      toast.success(action);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={current} />
            <Badge variant="secondary" className="capitalize">
              {assignment.priority} priority
            </Badge>
            {assignment.due_at && current === "overdue" && (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="size-3.5" /> Past due
              </span>
            )}
          </div>
          <SheetTitle className="text-left">{assignment.title}</SheetTitle>
          <SheetDescription className="text-left">
            {isTutorSide ? `Student: ${studentName}` : `Tutor: ${tutorName}`}
            {assignment.subject ? ` · ${assignment.subject}` : ""}
            {assignment.grade_level ? ` · ${assignment.grade_level}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-8">
          <Tabs defaultValue="overview">
            <TabsList className="w-full">
              <TabsTrigger value="overview" className="flex-1">
                Overview
              </TabsTrigger>
              <TabsTrigger value="work" className="flex-1">
                Submissions
              </TabsTrigger>
              <TabsTrigger value="history" className="flex-1">
                History
              </TabsTrigger>
            </TabsList>

            {/* ---------------------------------------------------- overview */}
            <TabsContent value="overview" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Assigned</p>
                  <p>
                    {assignment.assigned_at
                      ? format(new Date(assignment.assigned_at), "d MMM yyyy, HH:mm")
                      : "Not published"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Due</p>
                  <p className={cn(current === "overdue" && "text-destructive")}>
                    {assignment.due_at
                      ? format(new Date(assignment.due_at), "d MMM yyyy, HH:mm")
                      : "No due date"}
                  </p>
                </div>
              </div>

              {assignment.instructions && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Instructions</p>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {assignment.instructions}
                  </p>
                </div>
              )}

              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">Files from your tutor</p>
                {briefs.length === 0 && (
                  <p className="text-sm text-muted-foreground">No attachments.</p>
                )}
                {briefs.map((att) =>
                  att.external_url ? (
                    <a
                      key={att.id}
                      href={att.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"
                    >
                      <Link2 className="size-4 shrink-0" />
                      <span className="truncate">{att.title ?? att.external_url}</span>
                      <ExternalLink className="ml-auto size-3.5 shrink-0" />
                    </a>
                  ) : (
                    <button
                      key={att.id}
                      type="button"
                      onClick={() => download(att.storage_path!, att.file_name ?? "file")}
                      className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <Download className="size-4 shrink-0" />
                      <span className="truncate">{att.file_name}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {formatBytes(att.file_size)}
                      </span>
                    </button>
                  ),
                )}
              </div>

              {returned.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Corrected documents returned to you</p>
                  {returned.map((att) => (
                    <button
                      key={att.id}
                      type="button"
                      onClick={() => download(att.storage_path!, att.file_name ?? "file")}
                      className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <Download className="size-4 shrink-0" />
                      <span className="truncate">{att.file_name}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {formatBytes(att.file_size)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Tutor controls */}
              {isTutorSide && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Manage</p>
                    {assignment.status === "draft" && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          runUpdate(
                            {
                              status: "assigned",
                              assigned_at: new Date().toISOString(),
                              published_at: new Date().toISOString(),
                            },
                            "Assignment published",
                            {
                              assignmentId: assignment.id,
                              recipientId: assignment.student_id,
                              title: `New assignment: ${assignment.title}`,
                              kind: "assigned",
                            },
                          )
                        }
                      >
                        <Send className="mr-2 size-4" /> Publish
                      </Button>
                    )}
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="new-due" className="text-xs">
                          Extend due date
                        </Label>
                        <Input
                          id="new-due"
                          type="datetime-local"
                          value={newDue}
                          onChange={(e) => setNewDue(e.target.value)}
                          className="w-56"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy || !newDue}
                        onClick={() =>
                          runUpdate(
                            { due_at: new Date(newDue).toISOString() },
                            "Due date extended",
                            {
                              assignmentId: assignment.id,
                              recipientId: assignment.student_id,
                              title: `Due date changed for "${assignment.title}"`,
                              body: `New due date: ${new Date(newDue).toLocaleString()}`,
                              kind: "due_changed",
                            },
                          )
                        }
                      >
                        <Clock className="mr-2 size-4" /> Update
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy || !last}
                        onClick={() =>
                          runUpdate(
                            { status: "revision_requested" },
                            "Revision requested",
                            {
                              assignmentId: assignment.id,
                              recipientId: assignment.student_id,
                              title: `Revision requested on "${assignment.title}"`,
                              kind: "returned",
                            },
                          )
                        }
                      >
                        <RotateCcw className="mr-2 size-4" /> Request resubmission
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy || assignment.status === "completed"}
                        onClick={() =>
                          runUpdate(
                            { status: "completed", completed_at: new Date().toISOString() },
                            "Assignment completed",
                            {
                              assignmentId: assignment.id,
                              recipientId: assignment.student_id,
                              title: `"${assignment.title}" is complete`,
                              kind: "completed",
                            },
                          )
                        }
                      >
                        <CheckCircle2 className="mr-2 size-4" /> Mark completed
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={busy || assignment.status === "cancelled"}
                        onClick={() =>
                          runUpdate(
                            { status: "cancelled", cancelled_at: new Date().toISOString() },
                            "Assignment cancelled",
                          )
                        }
                      >
                        <XCircle className="mr-2 size-4" /> Cancel
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* Student progress control */}
              {!isTutorSide && ["assigned", "viewed"].includes(assignment.status) && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => runUpdate({ status: "in_progress" }, "Student started working")}
                >
                  I&apos;ve started working on this
                </Button>
              )}
            </TabsContent>

            {/* ------------------------------------------------- submissions */}
            <TabsContent value="work" className="space-y-4 pt-4">
              {versions.length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing submitted yet.</p>
              )}
              {versions.map((v) => {
                const vFiles = assignment.files.filter((f) => f.submission_id === v.id);
                return (
                  <div key={v.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">Version {v.version}</Badge>
                      {v.is_late && (
                        <Badge variant="outline" className={STATUS_CLASS.submitted_late}>
                          Late
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(v.submitted_at), "d MMM yyyy, HH:mm")}
                      </span>
                    </div>
                    {v.content && <p className="text-sm whitespace-pre-wrap">{v.content}</p>}
                    {v.external_url && (
                      <a
                        href={v.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-primary underline"
                      >
                        <Link2 className="size-3.5" /> {v.external_url}
                      </a>
                    )}
                    {vFiles.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => download(f.storage_path, f.file_name)}
                        className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <Download className="size-4 shrink-0" />
                        <span className="truncate">{f.file_name}</span>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {formatBytes(f.file_size)}
                        </span>
                      </button>
                    ))}
                    {(v.grade || v.feedback || v.marks != null) && (
                      <div className="rounded-md bg-muted/50 p-2 text-sm">
                        <p className="font-medium">
                          Feedback{v.grade ? ` · ${v.grade}` : ""}
                          {v.marks != null ? ` · ${v.marks} marks` : ""}
                        </p>
                        {v.feedback && (
                          <p className="whitespace-pre-wrap text-muted-foreground">{v.feedback}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Student submit form */}
              {canSubmit && (
                <div className="space-y-3 rounded-lg border p-3">
                  <p className="text-sm font-medium">
                    {last ? `Submit version ${last.version + 1}` : "Submit your work"}
                  </p>
                  <FileDrop files={files} onChange={setFiles} disabled={busy} />
                  <div className="space-y-1">
                    <Label htmlFor="sub-link" className="text-xs">
                      Link (optional)
                    </Label>
                    <Input
                      id="sub-link"
                      value={externalUrl}
                      placeholder="https://..."
                      onChange={(e) => setExternalUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sub-comment" className="text-xs">
                      Comment
                    </Label>
                    <Textarea
                      id="sub-comment"
                      rows={3}
                      maxLength={2000}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Anything your tutor should know"
                    />
                  </div>
                  {busy && <Progress value={progress} aria-label="Uploading" />}
                  <Button disabled={busy} onClick={() => setConfirmSubmit(true)}>
                    <Send className="mr-2 size-4" /> Submit
                  </Button>
                </div>
              )}

              {/* Tutor grading form */}
              {isTutorSide && last && (
                <div className="space-y-3 rounded-lg border p-3">
                  <p className="text-sm font-medium">Grade version {last.version}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="grade" className="text-xs">
                        Grade
                      </Label>
                      <Input
                        id="grade"
                        value={grade}
                        maxLength={20}
                        onChange={(e) => setGrade(e.target.value)}
                        placeholder="A"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="marks" className="text-xs">
                        Marks
                      </Label>
                      <Input
                        id="marks"
                        type="number"
                        value={marks}
                        onChange={(e) => setMarks(e.target.value)}
                        placeholder="85"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="feedback" className="text-xs">
                      Feedback
                    </Label>
                    <Textarea
                      id="feedback"
                      rows={3}
                      maxLength={2000}
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Corrected documents</Label>
                    <FileDrop
                      files={returnFiles}
                      onChange={setReturnFiles}
                      label="Attach corrected files"
                      disabled={busy}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={busy} onClick={() => doGrade("graded")}>
                      Publish grade
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => doGrade("revision")}
                    >
                      Return for revision
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ----------------------------------------------------- history */}
            <TabsContent value="history" className="space-y-3 pt-4">
              {history.isLoading && (
                <p className="text-sm text-muted-foreground">Loading timeline…</p>
              )}
              {history.data?.length === 0 && (
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              )}
              <ol className="relative space-y-4 border-l pl-4">
                {(history.data ?? []).map((h) => (
                  <li key={h.id} className="space-y-0.5">
                    <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-primary" />
                    <p className="text-sm font-medium">{h.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.actor_id === assignment.tutor_id ? tutorName : studentName}
                      {h.actor_role ? ` · ${h.actor_role}` : ""} ·{" "}
                      {format(new Date(h.created_at), "d MMM yyyy, HH:mm")}
                    </p>
                    {(h.from_status || h.to_status) && (
                      <p className="text-xs text-muted-foreground">
                        {h.from_status ? STATUS_LABEL[h.from_status as never] ?? h.from_status : "—"}{" "}
                        → {h.to_status ? STATUS_LABEL[h.to_status as never] ?? h.to_status : "—"}
                        {h.file_version ? ` · version ${h.file_version}` : ""}
                      </p>
                    )}
                    {h.comment && (
                      <p className="text-xs whitespace-pre-wrap text-muted-foreground">
                        “{h.comment}”
                      </p>
                    )}
                  </li>
                ))}
              </ol>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <HistoryIcon className="size-3.5" /> History records cannot be edited or deleted.
              </p>
            </TabsContent>
          </Tabs>
        </div>

        <AlertDialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Submit this work?</AlertDialogTitle>
              <AlertDialogDescription>
                {last
                  ? `This adds version ${last.version + 1}. Your earlier versions stay on record and are not replaced.`
                  : "Your tutor will be notified straight away. You can still submit a new version if a revision is requested."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={doSubmit}>Submit</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
