/* eslint-disable @typescript-eslint/no-explicit-any */
import { sendTemplateEmail } from "@/lib/email-templates/send-email";
import { resolveEmail, SITE_URL } from "@/lib/class-notifications.server";

export type AssignmentMailKind =
  | "assigned"
  | "due_soon"
  | "overdue"
  | "submitted"
  | "submitted_late"
  | "graded"
  | "returned"
  | "completed"
  | "due_changed";

/** Who should hear about each kind of assignment event. */
const AUDIENCE: Record<AssignmentMailKind, "student" | "tutor"> = {
  assigned: "student",
  due_soon: "student",
  overdue: "student",
  submitted: "tutor",
  submitted_late: "tutor",
  graded: "student",
  returned: "student",
  completed: "student",
  due_changed: "student",
};

const HEADLINE: Record<AssignmentMailKind, string> = {
  assigned: "assigned",
  due_soon: "due_soon",
  overdue: "due_soon",
  submitted: "assigned",
  submitted_late: "assigned",
  graded: "graded",
  returned: "returned",
  completed: "graded",
  due_changed: "due_soon",
};

/** Sends one branded assignment email through the caller's RLS-scoped client. */
export async function sendAssignmentEmail(
  supabase: any,
  assignmentId: string,
  kind: AssignmentMailKind,
  extra?: { grade?: string; feedback?: string },
) {
  const { data: assignment, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!assignment) throw new Error("Assignment not found or you do not have access to it");

  const ids = [assignment.tutor_id, assignment.student_id];
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  const { data: contacts } = await supabase
    .from("profile_contacts")
    .select("user_id, contact_email")
    .in("user_id", ids);
  const nameById = new Map<string, string | null>(
    (profiles ?? []).map((p: any) => [p.id, p.full_name]),
  );
  const contactById = new Map<string, string | null>(
    (contacts ?? []).map((c: any) => [c.user_id, c.contact_email]),
  );

  const recipientId =
    AUDIENCE[kind] === "student" ? assignment.student_id : assignment.tutor_id;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const to = await resolveEmail(supabaseAdmin, contactById.get(recipientId), recipientId);
  if (!to) return { sent: false, reason: "no_email" as const };

  const result = await sendTemplateEmail("assignment-notification", to, {
    templateData: {
      recipientName: nameById.get(recipientId) ?? undefined,
      kind: HEADLINE[kind],
      assignmentTitle: assignment.title,
      subject: assignment.subject ?? undefined,
      dueLabel: assignment.due_at
        ? new Date(assignment.due_at).toUTCString().replace(" GMT", " UTC")
        : undefined,
      tutorName: nameById.get(assignment.tutor_id) ?? undefined,
      grade: extra?.grade,
      feedback: extra?.feedback,
      actionUrl: `${SITE_URL}/assignments`,
    },
    idempotencyKey: `assignment-${kind}-${assignmentId}-${assignment.updated_at ?? ""}`,
  });
  return result;
}
