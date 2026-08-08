import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Sends the booking confirmation (student) and booking alert (tutor). */
export const sendBookingEmailsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ classId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { sendBookingEmails } = await import("@/lib/class-notifications.server");
    return sendBookingEmails(context.supabase as never, data.classId);
  });
