import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendClassInviteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ classId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { sendClassInvite } = await import("@/lib/class-invite.server");
    return sendClassInvite(context.supabase as never, data.classId);
  });
