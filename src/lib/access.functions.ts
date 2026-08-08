import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccessState = {
  status: string | null;
  userType: string | null;
  registeredAt: string | null;
  emailVerified: boolean;
  isAdmin: boolean;
  approved: boolean;
};

/**
 * Server-validated gate for the protected app. The bearer token is verified
 * server-side, so a tampered client cannot claim to be approved.
 */
export const myAccessFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccessState> => {
    const [{ data: request }, { data: isAdmin }] = await Promise.all([
      context.supabase
        .from("approval_requests")
        .select("status, user_type, created_at")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase.rpc("is_approval_admin", { _user_id: context.userId }),
    ]);

    const claims = context.claims as Record<string, unknown>;
    const meta = (claims["user_metadata"] ?? {}) as Record<string, unknown>;
    const emailVerified =
      claims["email_verified"] === true ||
      meta["email_verified"] === true ||
      typeof claims["email_confirmed_at"] === "string";

    const status = (request?.status as string | undefined) ?? null;
    return {
      status,
      userType: (request?.user_type as string | undefined) ?? null,
      registeredAt: (request?.created_at as string | undefined) ?? null,
      emailVerified,
      isAdmin: !!isAdmin,
      // No approval record (legacy/admin-provisioned accounts) keeps access.
      approved: !!isAdmin || status === null || status === "approved",
    };
  });
