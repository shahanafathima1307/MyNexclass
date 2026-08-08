import { notify } from "@/lib/messaging";
import { sendAssignmentEmailFn } from "@/lib/assignment-notifications.functions";

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

type AlertInput = {
  assignmentId: string;
  recipientId: string;
  title: string;
  body?: string;
  kind: AssignmentMailKind;
  grade?: string;
  feedback?: string;
};

/**
 * Fires the in-app notification and the branded email for one assignment event.
 * Never throws: a missing email must not block the underlying action.
 */
export async function alertAssignment(input: AlertInput) {
  try {
    await notify({
      userId: input.recipientId,
      title: input.title,
      body: input.body,
      link: "/assignments",
      kind: "assignment",
    });
  } catch {
    /* in-app notification is best effort */
  }
  try {
    await sendAssignmentEmailFn({
      data: {
        assignmentId: input.assignmentId,
        kind: input.kind,
        grade: input.grade,
        feedback: input.feedback,
      },
    });
  } catch {
    /* email delivery is best effort — the action already succeeded */
  }
}
