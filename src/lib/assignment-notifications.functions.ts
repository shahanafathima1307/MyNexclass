import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Sends a branded assignment email to the party affected by the event. */
export const sendAssignmentEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        assignmentId: z.string().uuid(),
        kind: z.enum([
          "assigned",
          "due_soon",
          "overdue",
          "submitted",
          "submitted_late",
          "graded",
          "returned",
          "completed",
          "due_changed",
        ]),
        grade: z.string().max(120).optional(),
        feedback: z.string().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { sendAssignmentEmail } = await import("@/lib/assignment-notifications.server");
    return sendAssignmentEmail(context.supabase as never, data.assignmentId, data.kind, {
      grade: data.grade,
      feedback: data.feedback,
    });
  });
