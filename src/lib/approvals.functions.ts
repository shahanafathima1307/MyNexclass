import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Auth email + verification status for applicants. Admin only. */
export const applicantAuthInfoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userIds: z.array(z.string().uuid()) }).parse(data))
  .handler(async ({ data, context }) => {
    const { applicantAuthInfo } = await import("@/lib/approvals.server");
    return applicantAuthInfo(context.supabase as never, data.userIds);
  });

/** Sends the branded approval status email. Admin only. */
export const sendApprovalEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        status: z.string(),
        message: z.string().optional(),
        requestedFields: z.array(z.string()).default([]),
        deadline: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { sendApprovalEmail } = await import("@/lib/approvals.server");
    return sendApprovalEmail(context.supabase as never, data);
  });
