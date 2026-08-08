import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Enums, Tables } from "@/integrations/supabase/types";

export type ApprovalStatus = Enums<"approval_status">;
export type ApprovalRequest = Tables<"approval_requests">;
export type RegistrationDetails = Tables<"registration_details">;
export type ApprovalDocument = Tables<"approval_documents">;
export type ApprovalHistoryRow = Tables<"approval_history">;
export type ApprovalNote = Tables<"approval_notes">;
export type ApprovalSettings = Tables<"approval_settings">;
export type DuplicateFlag = Tables<"duplicate_flags">;

export const APPROVAL_DOCS_BUCKET = "approval-docs";

export const STATUS_LABEL: Record<ApprovalStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  under_review: "Under Review",
  more_info_required: "More Information Required",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
  deactivated: "Deactivated",
};

export const STATUS_ORDER: ApprovalStatus[] = [
  "draft",
  "pending_approval",
  "under_review",
  "more_info_required",
  "approved",
  "rejected",
  "suspended",
  "deactivated",
];

export function statusTone(status: ApprovalStatus): string {
  switch (status) {
    case "approved":
      return "bg-accent text-accent-foreground";
    case "rejected":
    case "deactivated":
      return "bg-destructive/15 text-destructive";
    case "suspended":
      return "bg-destructive/10 text-destructive";
    case "under_review":
      return "bg-primary/15 text-primary";
    case "more_info_required":
      return "bg-secondary text-secondary-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/** Statuses that unlock the full platform. */
export function hasPlatformAccess(status: ApprovalStatus | null | undefined) {
  return status === "approved";
}

/** Routes a not-yet-approved member may still open. */
export const PENDING_ALLOWED_PATHS = ["/approval-status", "/notifications"];

export const REJECTION_REASONS = [
  "Incomplete information",
  "Invalid contact information",
  "Unable to verify identity",
  "Unsupported location",
  "Tutor qualifications not sufficient",
  "Duplicate account",
  "Policy violation",
  "Suspected fraud",
  "Other",
];

export const STUDENT_FIELDS = [
  "mobile",
  "whatsapp",
  "parent_name",
  "parent_contact",
  "grade",
  "school",
  "subjects_of_interest",
  "time_zone",
  "country",
  "state",
];

export const TUTOR_FIELDS = [
  "mobile",
  "whatsapp",
  "subjects_taught",
  "grades_taught",
  "education",
  "work_experience",
  "teaching_experience",
  "certifications",
  "hourly_rate",
  "availability_notes",
  "short_bio",
  "intro_video_url",
  "resume",
  "identity",
];

export function fieldLabel(field: string) {
  return field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ----------------------------- role helpers ----------------------------- */

export function useApprovalAdmin(userId: string | undefined) {
  return useQuery({
    queryKey: ["approval-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId!);
      if (error) throw error;
      const roles = (data ?? []).map((r) => String(r.role));
      return {
        isAdmin: roles.includes("admin") || roles.includes("super_admin"),
        isSuperAdmin: roles.includes("super_admin"),
      };
    },
  });
}

/* ------------------------------ applicant ------------------------------- */

export function useMyApproval(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-approval", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approval_requests")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as ApprovalRequest | null;
    },
  });
}

export function useRegistrationDetails(userId: string | undefined) {
  return useQuery({
    queryKey: ["registration-details", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registration_details")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as RegistrationDetails | null;
    },
  });
}

export function useSaveRegistrationDetails() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      patch,
    }: {
      userId: string;
      patch: Partial<RegistrationDetails>;
    }) => {
      const { error } = await supabase
        .from("registration_details")
        .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["registration-details", v.userId] });
      qc.invalidateQueries({ queryKey: ["approval-queue"] });
    },
  });
}

export function useMyDocuments(userId: string | undefined) {
  return useQuery({
    queryKey: ["approval-documents", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approval_documents")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ApprovalDocument[];
    },
  });
}

const MAX_DOC_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export function useUploadApprovalDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, kind, file }: { userId: string; kind: string; file: File }) => {
      if (file.size > MAX_DOC_BYTES) throw new Error("File must be 10 MB or smaller");
      if (file.type && !ALLOWED_DOC_TYPES.includes(file.type))
        throw new Error("Only PDF, Word or image files are accepted");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${userId}/${kind}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from(APPROVAL_DOCS_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { error } = await supabase.from("approval_documents").insert({
        user_id: userId,
        kind,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type || null,
        file_size: file.size,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["approval-documents", v.userId] });
      qc.invalidateQueries({ queryKey: ["approval-request"] });
    },
  });
}

/** Signed, short-lived URL. Every admin view is logged. */
export async function openApprovalDocument(doc: ApprovalDocument, viewerId: string) {
  const { data, error } = await supabase.storage
    .from(APPROVAL_DOCS_BUCKET)
    .createSignedUrl(doc.storage_path, 300);
  if (error) throw error;
  await supabase.from("document_access_log").insert({ document_id: doc.id, viewer_id: viewerId });
  return data.signedUrl;
}

async function logHistory(entry: {
  request_id: string;
  actor_id: string;
  actor_role: string;
  action: string;
  from_status?: ApprovalStatus | null;
  to_status?: ApprovalStatus | null;
  reason?: string | null;
  has_internal_note?: boolean;
  requested_fields?: string[];
}) {
  await supabase.from("approval_history").insert(entry);
}

/** Applicant resubmits after providing the requested details. */
export function useResubmitApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      request,
      response,
      actorId,
      actorRole,
    }: {
      request: ApprovalRequest;
      response: string;
      actorId: string;
      actorRole: string;
    }) => {
      const { error } = await supabase
        .from("approval_requests")
        .update({
          status: "pending_approval",
          applicant_response: response,
          resubmitted_at: new Date().toISOString(),
        })
        .eq("id", request.id);
      if (error) throw error;
      await logHistory({
        request_id: request.id,
        actor_id: actorId,
        actor_role: actorRole,
        action: "application_resubmitted",
        from_status: request.status,
        to_status: "pending_approval",
        reason: response || null,
      });
      await supabase.rpc("notify_approval_admins", {
        _title: "Application resubmitted",
        _body: "An applicant provided the requested information and resubmitted.",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-approval"] });
      qc.invalidateQueries({ queryKey: ["approval-queue"] });
      qc.invalidateQueries({ queryKey: ["approval-request"] });
    },
  });
}

/* -------------------------------- admin --------------------------------- */

export type QueueRow = ApprovalRequest & {
  full_name: string;
  avatar_url: string | null;
  contact_email: string | null;
  details: RegistrationDetails | null;
  duplicates: number;
  missing: string[];
  reviewerName: string | null;
};

export function missingFields(
  req: ApprovalRequest,
  details: RegistrationDetails | null,
  settings?: ApprovalSettings | null,
) {
  const required =
    req.user_type === "tutor"
      ? (settings?.mandatory_tutor_fields ?? ["mobile", "subjects_taught", "education"])
      : (settings?.mandatory_student_fields ?? ["mobile", "grade", "parent_contact"]);
  return required.filter((f) => {
    const value = (details as Record<string, unknown> | null)?.[f];
    return value === null || value === undefined || value === "";
  });
}

export function useApprovalQueue(enabled: boolean) {
  return useQuery({
    queryKey: ["approval-queue"],
    enabled,
    queryFn: async (): Promise<QueueRow[]> => {
      const [{ data: requests, error }, { data: settings }] = await Promise.all([
        // `draft` = email not verified yet; those never reach the review queue.
        supabase
          .from("approval_requests")
          .select("*")
          .neq("status", "draft")
          .order("created_at", { ascending: false }),
        supabase.from("approval_settings").select("*").maybeSingle(),
      ]);
      if (error) throw error;
      const rows = (requests ?? []) as ApprovalRequest[];
      const ids = rows.map((r) => r.user_id);
      const reviewerIds = rows.map((r) => r.assigned_reviewer).filter(Boolean) as string[];
      const [{ data: profiles }, { data: details }, { data: contacts }, { data: dupes }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", [...ids, ...reviewerIds]),
          supabase.from("registration_details").select("*").in("user_id", ids),
          supabase.from("profile_contacts").select("user_id, contact_email").in("user_id", ids),
          supabase.from("duplicate_flags").select("request_id").eq("resolved", false),
        ]);

      const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
      const detailById = new Map((details ?? []).map((d) => [d.user_id, d as RegistrationDetails]));
      const contactById = new Map((contacts ?? []).map((c) => [c.user_id, c.contact_email]));
      const dupeCount = new Map<string, number>();
      for (const d of dupes ?? [])
        dupeCount.set(d.request_id, (dupeCount.get(d.request_id) ?? 0) + 1);

      return rows.map((r) => {
        const detail = detailById.get(r.user_id) ?? null;
        return {
          ...r,
          full_name: profileById.get(r.user_id)?.full_name ?? "Unknown member",
          avatar_url: profileById.get(r.user_id)?.avatar_url ?? null,
          contact_email: contactById.get(r.user_id) ?? null,
          details: detail,
          duplicates: dupeCount.get(r.id) ?? 0,
          missing: missingFields(r, detail, settings as ApprovalSettings | null),
          reviewerName: r.assigned_reviewer
            ? (profileById.get(r.assigned_reviewer)?.full_name ?? "Assigned admin")
            : null,
        };
      });
    },
  });
}

export function usePendingApprovalCount(enabled: boolean) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["approval-pending-count"],
    enabled,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("approval_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending_approval", "under_review", "more_info_required"]);
      if (error) throw error;
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`approvals-count-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "approval_requests" },
        () => {
          qc.invalidateQueries({ queryKey: ["approval-pending-count"] });
          qc.invalidateQueries({ queryKey: ["approval-queue"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, qc]);

  return query;
}

export type ApprovalDetail = {
  request: ApprovalRequest;
  profile: Tables<"profiles"> | null;
  contact: { contact_email: string | null; phone: string | null } | null;
  details: RegistrationDetails | null;
  documents: ApprovalDocument[];
  history: ApprovalHistoryRow[];
  notes: (ApprovalNote & { authorName: string | null })[];
  duplicates: DuplicateFlag[];
  reviewerName: string | null;
};

export function useApprovalDetail(requestId: string | undefined) {
  return useQuery({
    queryKey: ["approval-request", requestId],
    enabled: !!requestId,
    queryFn: async (): Promise<ApprovalDetail> => {
      const { data: request, error } = await supabase
        .from("approval_requests")
        .select("*")
        .eq("id", requestId!)
        .single();
      if (error) throw error;
      const userId = request.user_id;
      const [
        { data: profile },
        { data: contact },
        { data: details },
        { data: documents },
        { data: history },
        { data: notes },
        { data: duplicates },
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase
          .from("profile_contacts")
          .select("contact_email, phone")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase.from("registration_details").select("*").eq("user_id", userId).maybeSingle(),
        supabase
          .from("approval_documents")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("approval_history")
          .select("*")
          .eq("request_id", requestId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("approval_notes")
          .select("*")
          .eq("request_id", requestId!)
          .order("created_at", { ascending: false }),
        supabase.from("duplicate_flags").select("*").eq("request_id", requestId!),
      ]);

      const authorIds = [
        ...new Set([
          ...(notes ?? []).map((n) => n.author_id),
          ...(request.assigned_reviewer ? [request.assigned_reviewer] : []),
        ]),
      ];
      const { data: authors } = authorIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", authorIds)
        : { data: [] as { id: string; full_name: string }[] };
      const nameById = new Map((authors ?? []).map((a) => [a.id, a.full_name]));

      return {
        request: request as ApprovalRequest,
        profile: (profile as Tables<"profiles"> | null) ?? null,
        contact: contact ?? null,
        details: (details as RegistrationDetails | null) ?? null,
        documents: (documents ?? []) as ApprovalDocument[],
        history: (history ?? []) as ApprovalHistoryRow[],
        notes: ((notes ?? []) as ApprovalNote[]).map((n) => ({
          ...n,
          authorName: nameById.get(n.author_id) ?? null,
        })),
        duplicates: (duplicates ?? []) as DuplicateFlag[],
        reviewerName: request.assigned_reviewer
          ? (nameById.get(request.assigned_reviewer) ?? "Assigned admin")
          : null,
      };
    },
  });
}

function invalidateApprovals(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["approval-queue"] });
  qc.invalidateQueries({ queryKey: ["approval-request"] });
  qc.invalidateQueries({ queryKey: ["approval-pending-count"] });
  qc.invalidateQueries({ queryKey: ["my-approval"] });
}

async function notifyApplicant(userId: string, title: string, body: string) {
  await supabase.from("notifications").insert({
    user_id: userId,
    title,
    body,
    link: "/approval-status",
    kind: "approval",
  });
}

export type DecisionInput = {
  request: ApprovalRequest;
  actorId: string;
  actorRole: string;
};

export function useStartReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ request, actorId, actorRole }: DecisionInput) => {
      const { error } = await supabase
        .from("approval_requests")
        .update({
          status: "under_review",
          review_started_at: new Date().toISOString(),
          assigned_reviewer: request.assigned_reviewer ?? actorId,
        })
        .eq("id", request.id);
      if (error) throw error;
      await logHistory({
        request_id: request.id,
        actor_id: actorId,
        actor_role: actorRole,
        action: "review_started",
        from_status: request.status,
        to_status: "under_review",
      });
      await notifyApplicant(
        request.user_id,
        "Application under review",
        "An administrator started reviewing your registration.",
      );
      await sendApprovalMail(request.user_id, "under_review");
    },
    onSuccess: () => invalidateApprovals(qc),
  });
}

export function useAssignReviewer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      request,
      reviewerId,
      actorId,
      actorRole,
    }: DecisionInput & { reviewerId: string }) => {
      const { error } = await supabase
        .from("approval_requests")
        .update({ assigned_reviewer: reviewerId })
        .eq("id", request.id);
      if (error) throw error;
      await logHistory({
        request_id: request.id,
        actor_id: actorId,
        actor_role: actorRole,
        action: "reviewer_assigned",
        from_status: request.status,
        to_status: request.status,
      });
      await supabase.from("notifications").insert({
        user_id: reviewerId,
        title: "Application assigned to you",
        body: "You were assigned a registration to review.",
        link: `/approvals/${request.id}`,
        kind: "approval",
      });
    },
    onSuccess: () => invalidateApprovals(qc),
  });
}

export function useAddApprovalNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      request,
      body,
      actorId,
      actorRole,
    }: DecisionInput & { body: string }) => {
      const { error } = await supabase
        .from("approval_notes")
        .insert({ request_id: request.id, author_id: actorId, body });
      if (error) throw error;
      await logHistory({
        request_id: request.id,
        actor_id: actorId,
        actor_role: actorRole,
        action: "internal_note_added",
        from_status: request.status,
        to_status: request.status,
        has_internal_note: true,
      });
    },
    onSuccess: () => invalidateApprovals(qc),
  });
}

async function sendApprovalMail(
  userId: string,
  status: ApprovalStatus,
  extra: { message?: string; requestedFields?: string[]; deadline?: string | null } = {},
) {
  try {
    const { sendApprovalEmailFn } = await import("@/lib/approvals.functions");
    await sendApprovalEmailFn({
      data: {
        userId,
        status,
        message: extra.message ?? undefined,
        requestedFields: extra.requestedFields ?? [],
        deadline: extra.deadline ?? undefined,
      },
    });
  } catch (err) {
    console.error("Approval email failed", err);
  }
}

export function useApproveApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      request,
      actorId,
      actorRole,
      welcomeMessage,
    }: DecisionInput & { welcomeMessage?: string }) => {
      const { error } = await supabase
        .from("approval_requests")
        .update({
          status: "approved",
          decision_at: new Date().toISOString(),
          decision_by: actorId,
          decision_reason: null,
          user_message: welcomeMessage || null,
        })
        .eq("id", request.id);
      if (error) throw error;

      // Make sure the applicant holds the role their application was made for.
      await supabase
        .from("user_roles")
        .insert({ user_id: request.user_id, role: request.user_type as "student" | "tutor" });

      await logHistory({
        request_id: request.id,
        actor_id: actorId,
        actor_role: actorRole,
        action: "approved",
        from_status: request.status,
        to_status: "approved",
        reason: welcomeMessage || null,
      });
      await notifyApplicant(
        request.user_id,
        "Your account is approved",
        welcomeMessage || "You can now access myNexClass.",
      );
      await sendApprovalMail(request.user_id, "approved", { message: welcomeMessage });
    },
    onSuccess: () => invalidateApprovals(qc),
  });
}

export function useRejectApplicant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      request,
      actorId,
      actorRole,
      internalReason,
      userMessage,
    }: DecisionInput & { internalReason: string; userMessage: string }) => {
      const { error } = await supabase
        .from("approval_requests")
        .update({
          status: "rejected",
          decision_at: new Date().toISOString(),
          decision_by: actorId,
          internal_reason: internalReason,
          decision_reason: internalReason,
          user_message: userMessage,
        })
        .eq("id", request.id);
      if (error) throw error;
      await logHistory({
        request_id: request.id,
        actor_id: actorId,
        actor_role: actorRole,
        action: "rejected",
        from_status: request.status,
        to_status: "rejected",
        reason: internalReason,
      });
      await notifyApplicant(request.user_id, "Registration not approved", userMessage);
      await sendApprovalMail(request.user_id, "rejected", { message: userMessage });
    },
    onSuccess: () => invalidateApprovals(qc),
  });
}

export function useRequestMoreInfo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      request,
      actorId,
      actorRole,
      fields,
      instructions,
      deadline,
    }: DecisionInput & { fields: string[]; instructions: string; deadline: string | null }) => {
      const { error } = await supabase
        .from("approval_requests")
        .update({
          status: "more_info_required",
          requested_fields: fields,
          request_instructions: instructions,
          response_deadline: deadline,
          user_message: instructions,
        })
        .eq("id", request.id);
      if (error) throw error;
      await logHistory({
        request_id: request.id,
        actor_id: actorId,
        actor_role: actorRole,
        action: "information_requested",
        from_status: request.status,
        to_status: "more_info_required",
        reason: instructions,
        requested_fields: fields,
      });
      await notifyApplicant(
        request.user_id,
        "More information required",
        instructions || "Review the request and resubmit your application.",
      );
      await sendApprovalMail(request.user_id, "more_info_required", {
        message: instructions,
        requestedFields: fields,
        deadline,
      });
    },
    onSuccess: () => invalidateApprovals(qc),
  });
}

export function useSetApprovalStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      request,
      actorId,
      actorRole,
      status,
      reason,
    }: DecisionInput & { status: ApprovalStatus; reason?: string }) => {
      const { error } = await supabase
        .from("approval_requests")
        .update({ status, decision_reason: reason ?? null, decision_by: actorId })
        .eq("id", request.id);
      if (error) throw error;
      await logHistory({
        request_id: request.id,
        actor_id: actorId,
        actor_role: actorRole,
        action:
          status === "suspended"
            ? "suspended"
            : status === "deactivated"
              ? "deactivated"
              : status === "approved"
                ? "reactivated"
                : "status_changed",
        from_status: request.status,
        to_status: status,
        reason: reason ?? null,
      });
      await notifyApplicant(
        request.user_id,
        `Account ${STATUS_LABEL[status]}`,
        reason || `Your account status changed to ${STATUS_LABEL[status]}.`,
      );
      await sendApprovalMail(request.user_id, status, { message: reason });
    },
    onSuccess: () => invalidateApprovals(qc),
  });
}

/* ------------------------------- settings -------------------------------- */

export function useApprovalSettings() {
  return useQuery({
    queryKey: ["approval-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("approval_settings").select("*").maybeSingle();
      if (error) throw error;
      return data as ApprovalSettings | null;
    },
  });
}

export function useUpdateApprovalSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<ApprovalSettings>) => {
      const { error } = await supabase.from("approval_settings").update(patch).eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approval-settings"] }),
  });
}

/* --------------------------- admin directory ----------------------------- */

export function useAdminDirectory(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-directory"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "super_admin"]);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((r) => r.user_id))];
      if (!ids.length) return [] as { id: string; full_name: string }[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      return (profiles ?? []) as { id: string; full_name: string }[];
    },
  });
}
