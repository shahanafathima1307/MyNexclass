import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Enums, Tables } from "@/integrations/supabase/types";

export type AssignmentStatus = Enums<"assignment_state">;
export type Assignment = Tables<"assignments">;
export type Submission = Tables<"assignment_submissions">;
export type Attachment = Tables<"assignment_attachments">;
export type SubmissionFile = Tables<"submission_files">;
export type HistoryEntry = Tables<"assignment_history">;

export type AssignmentFull = Assignment & {
  submissions: Submission[];
  attachments: Attachment[];
  files: SubmissionFile[];
};

export const ASSIGNMENTS_BUCKET = "assignments";

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "csv",
  "txt",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "zip",
  "mp4",
  "mov",
  "webm",
  "m4v",
];

export const ACCEPT_ATTR = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");

/** Returns an error message when the file is not acceptable, otherwise null. */
export function validateFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `${file.name}: .${ext || "unknown"} files are not allowed.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name} is larger than 50 MB.`;
  }
  if (file.size === 0) return `${file.name} is empty.`;
  return null;
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const STATUS_LABEL: Record<AssignmentStatus, string> = {
  draft: "Draft",
  assigned: "Assigned",
  viewed: "Viewed",
  in_progress: "In progress",
  submitted: "Submitted",
  submitted_late: "Submitted late",
  under_review: "Under review",
  revision_requested: "Revision requested",
  resubmitted: "Resubmitted",
  graded: "Graded",
  completed: "Completed",
  cancelled: "Cancelled",
  overdue: "Overdue",
};

/** Tailwind classes for a colour-coded badge, keyed on status. */
export const STATUS_CLASS: Record<AssignmentStatus, string> = {
  draft: "bg-muted text-muted-foreground border-transparent",
  assigned: "bg-primary/10 text-primary border-primary/20",
  viewed: "bg-primary/10 text-primary border-primary/20",
  in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25",
  submitted: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/25",
  submitted_late: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/25",
  under_review: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/25",
  revision_requested: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25",
  resubmitted: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/25",
  graded: "bg-accent/25 text-accent-foreground border-accent/40",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
  cancelled: "bg-muted text-muted-foreground border-transparent line-through",
  overdue: "bg-destructive/15 text-destructive border-destructive/25",
};

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

const OPEN_STATES: AssignmentStatus[] = ["assigned", "viewed", "in_progress"];

/** Status as it should be shown: open assignments past their due date read as overdue. */
export function effectiveStatus(a: Assignment): AssignmentStatus {
  if (a.due_at && OPEN_STATES.includes(a.status) && new Date(a.due_at) < new Date()) {
    return "overdue";
  }
  return a.status;
}

export function latestSubmission(a: AssignmentFull): Submission | null {
  if (!a.submissions.length) return null;
  return [...a.submissions].sort((x, y) => y.version - x.version)[0] ?? null;
}

// ---------------------------------------------------------------- queries

export function useAssignments(userId: string | undefined) {
  return useQuery({
    queryKey: ["assignments", userId],
    enabled: !!userId,
    queryFn: async (): Promise<AssignmentFull[]> => {
      const [rows, subs, atts, files] = await Promise.all([
        supabase.from("assignments").select("*").order("created_at", { ascending: false }),
        supabase.from("assignment_submissions").select("*"),
        supabase.from("assignment_attachments").select("*"),
        supabase.from("submission_files").select("*"),
      ]);
      for (const r of [rows, subs, atts, files]) if (r.error) throw r.error;
      const group = <T extends { assignment_id: string }>(list: T[] | null) => {
        const map = new Map<string, T[]>();
        for (const item of list ?? []) {
          const bucket = map.get(item.assignment_id) ?? [];
          bucket.push(item);
          map.set(item.assignment_id, bucket);
        }
        return map;
      };
      const s = group(subs.data);
      const a = group(atts.data);
      const f = group(files.data);
      return (rows.data ?? []).map((row) => ({
        ...row,
        submissions: s.get(row.id) ?? [],
        attachments: a.get(row.id) ?? [],
        files: f.get(row.id) ?? [],
      }));
    },
  });
}

export function useAssignmentHistory(assignmentId: string | undefined) {
  return useQuery({
    queryKey: ["assignment-history", assignmentId],
    enabled: !!assignmentId,
    queryFn: async (): Promise<HistoryEntry[]> => {
      const { data, error } = await supabase
        .from("assignment_history")
        .select("*")
        .eq("assignment_id", assignmentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ---------------------------------------------------------------- helpers

export type Actor = { id: string; role: string };

export async function logHistory(input: {
  assignmentId: string;
  actor: Actor;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  version?: number | null;
  comment?: string | null;
}) {
  await supabase.from("assignment_history").insert({
    assignment_id: input.assignmentId,
    actor_id: input.actor.id,
    actor_role: input.actor.role,
    action: input.action,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    file_version: input.version ?? null,
    comment: input.comment ?? null,
  });
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

export async function uploadAssignmentFile(
  assignmentId: string,
  folder: "brief" | "returned" | "submissions",
  file: File,
  onProgress?: (pct: number) => void,
) {
  const path = `${assignmentId}/${folder}/${crypto.randomUUID()}-${safeName(file.name)}`;
  onProgress?.(10);
  const { error } = await supabase.storage
    .from(ASSIGNMENTS_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  onProgress?.(100);
  return path;
}

export async function assignmentFileUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(ASSIGNMENTS_BUCKET)
    .createSignedUrl(path, 60 * 15);
  if (error) throw error;
  return data.signedUrl;
}

/** Back-compat alias used by older call sites. */
export const submissionFileUrl = assignmentFileUrl;

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["assignments"] });
    qc.invalidateQueries({ queryKey: ["assignment-history"] });
  };
}

// ---------------------------------------------------------------- mutations

export type CreateAssignmentInput = {
  actor: Actor;
  tutorId: string;
  studentIds: string[];
  title: string;
  instructions?: string | null;
  subject?: string | null;
  gradeLevel?: string | null;
  classId?: string | null;
  priority: Priority;
  assignedAt?: string | null;
  dueAt?: string | null;
  allowResubmission: boolean;
  publish: boolean;
  files: File[];
  links: string[];
};

export function useCreateAssignment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: CreateAssignmentInput) => {
      const groupId = crypto.randomUUID();
      const created: string[] = [];
      for (const studentId of input.studentIds) {
        const { data, error } = await supabase
          .from("assignments")
          .insert({
            tutor_id: input.tutorId,
            student_id: studentId,
            class_id: input.classId || null,
            title: input.title,
            instructions: input.instructions || null,
            subject: input.subject || null,
            grade_level: input.gradeLevel || null,
            priority: input.priority,
            due_at: input.dueAt || null,
            assigned_at: input.publish ? (input.assignedAt || new Date().toISOString()) : null,
            published_at: input.publish ? new Date().toISOString() : null,
            allow_resubmission: input.allowResubmission,
            status: input.publish ? "assigned" : "draft",
            group_id: groupId,
          })
          .select("id")
          .single();
        if (error) throw error;
        created.push(data.id);

        for (const file of input.files) {
          const path = await uploadAssignmentFile(data.id, "brief", file);
          const { error: attErr } = await supabase.from("assignment_attachments").insert({
            assignment_id: data.id,
            uploaded_by: input.actor.id,
            kind: "brief",
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type || null,
            storage_path: path,
          });
          if (attErr) throw attErr;
        }
        for (const link of input.links) {
          const { error: linkErr } = await supabase.from("assignment_attachments").insert({
            assignment_id: data.id,
            uploaded_by: input.actor.id,
            kind: "brief",
            title: link,
            external_url: link,
          });
          if (linkErr) throw linkErr;
        }

        await logHistory({
          assignmentId: data.id,
          actor: input.actor,
          action: "Assignment created",
          toStatus: input.publish ? "assigned" : "draft",
        });
        if (input.publish) {
          await logHistory({
            assignmentId: data.id,
            actor: input.actor,
            action: "Assignment published",
            fromStatus: "draft",
            toStatus: "assigned",
          });
        }
      }
      return created;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateAssignment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      assignment: Assignment;
      actor: Actor;
      patch: Partial<Assignment>;
      action: string;
      comment?: string | null;
    }) => {
      const { error } = await supabase
        .from("assignments")
        .update({ ...input.patch, updated_at: new Date().toISOString() })
        .eq("id", input.assignment.id);
      if (error) throw error;
      await logHistory({
        assignmentId: input.assignment.id,
        actor: input.actor,
        action: input.action,
        fromStatus: input.assignment.status,
        toStatus: (input.patch.status as string) ?? input.assignment.status,
        comment: input.comment ?? null,
      });
    },
    onSuccess: invalidate,
  });
}

/** Silently advances an open assignment when the student opens it. */
export function useMarkViewed() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ assignment, actor }: { assignment: Assignment; actor: Actor }) => {
      if (assignment.status !== "assigned") return;
      const { error } = await supabase
        .from("assignments")
        .update({ status: "viewed" })
        .eq("id", assignment.id);
      if (error) throw error;
      await logHistory({
        assignmentId: assignment.id,
        actor,
        action: "Student opened the assignment",
        fromStatus: "assigned",
        toStatus: "viewed",
      });
    },
    onSuccess: invalidate,
  });
}

/** Moves a submitted assignment to under review the first time the tutor opens it. */
export function useMarkUnderReview() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ assignment, actor }: { assignment: Assignment; actor: Actor }) => {
      const reviewable: AssignmentStatus[] = ["submitted", "submitted_late", "resubmitted"];
      if (!reviewable.includes(assignment.status)) return;
      const { error } = await supabase
        .from("assignments")
        .update({ status: "under_review" })
        .eq("id", assignment.id);
      if (error) throw error;
      await logHistory({
        assignmentId: assignment.id,
        actor,
        action: "Tutor started reviewing the submission",
        fromStatus: assignment.status,
        toStatus: "under_review",
      });
    },
    onSuccess: invalidate,
  });
}

export function useSubmitAssignment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      assignment: AssignmentFull;
      actor: Actor;
      comment?: string;
      externalUrl?: string;
      files: File[];
      onProgress?: (pct: number) => void;
    }) => {
      const prev = latestSubmission(input.assignment);
      const version = (prev?.version ?? 0) + 1;
      const late = !!input.assignment.due_at && new Date(input.assignment.due_at) < new Date();
      const isResubmission = version > 1;

      const { data: submission, error } = await supabase
        .from("assignment_submissions")
        .insert({
          assignment_id: input.assignment.id,
          student_id: input.actor.id,
          content: input.comment || null,
          external_url: input.externalUrl || null,
          version,
          is_late: late,
          submitted_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;

      let done = 0;
      for (const file of input.files) {
        const path = await uploadAssignmentFile(input.assignment.id, "submissions", file);
        const { error: fErr } = await supabase.from("submission_files").insert({
          submission_id: submission.id,
          assignment_id: input.assignment.id,
          uploaded_by: input.actor.id,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || null,
          storage_path: path,
        });
        if (fErr) throw fErr;
        done += 1;
        input.onProgress?.(Math.round((done / Math.max(input.files.length, 1)) * 100));
      }

      const nextStatus: AssignmentStatus = isResubmission
        ? "resubmitted"
        : late
          ? "submitted_late"
          : "submitted";
      const { error: sErr } = await supabase
        .from("assignments")
        .update({ status: nextStatus })
        .eq("id", input.assignment.id);
      if (sErr) throw sErr;

      await logHistory({
        assignmentId: input.assignment.id,
        actor: input.actor,
        action: isResubmission
          ? `Student resubmitted (version ${version})`
          : late
            ? "Student submitted after the due date"
            : "Student submitted work",
        fromStatus: input.assignment.status,
        toStatus: nextStatus,
        version,
        comment: input.comment || null,
      });
      return { version, late, nextStatus };
    },
    onSuccess: invalidate,
  });
}

export function useGradeSubmission() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      assignment: Assignment;
      submissionId: string;
      actor: Actor;
      grade?: string;
      marks?: number | null;
      feedback?: string;
      /** "graded" accepts the work, "revision" asks for another version. */
      outcome: "graded" | "revision";
      files: File[];
    }) => {
      const { error } = await supabase
        .from("assignment_submissions")
        .update({
          grade: input.grade || null,
          marks: input.marks ?? null,
          feedback: input.feedback || null,
          graded_at: new Date().toISOString(),
          graded_by: input.actor.id,
        })
        .eq("id", input.submissionId);
      if (error) throw error;

      for (const file of input.files) {
        const path = await uploadAssignmentFile(input.assignment.id, "returned", file);
        const { error: attErr } = await supabase.from("assignment_attachments").insert({
          assignment_id: input.assignment.id,
          uploaded_by: input.actor.id,
          kind: "returned",
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type || null,
          storage_path: path,
        });
        if (attErr) throw attErr;
      }

      const nextStatus: AssignmentStatus =
        input.outcome === "graded" ? "graded" : "revision_requested";
      const { error: sErr } = await supabase
        .from("assignments")
        .update({ status: nextStatus })
        .eq("id", input.assignment.id);
      if (sErr) throw sErr;

      await logHistory({
        assignmentId: input.assignment.id,
        actor: input.actor,
        action:
          input.outcome === "graded"
            ? `Tutor graded the work${input.grade ? ` (${input.grade})` : ""}`
            : "Tutor requested a revision",
        fromStatus: input.assignment.status,
        toStatus: nextStatus,
        comment: input.feedback || null,
      });
    },
    onSuccess: invalidate,
  });
}

export function useLogDownload() {
  return useMutation({
    mutationFn: async (input: { assignmentId: string; actor: Actor; fileName: string }) =>
      logHistory({
        assignmentId: input.assignmentId,
        actor: input.actor,
        action: `Downloaded ${input.fileName}`,
      }),
  });
}

export function useDeleteAssignment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
