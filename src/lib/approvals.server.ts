/* eslint-disable @typescript-eslint/no-explicit-any */
import { sendTemplateEmail } from "@/lib/email-templates/send-email";

const SITE_URL = (process.env.SITE_URL || "https://mynexclass.lovable.app").replace(/\/$/, "");

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  under_review: "Under Review",
  more_info_required: "More Information Required",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
  deactivated: "Deactivated",
};

async function assertAdmin(supabase: any) {
  const { data, error } = await supabase.rpc("is_approval_admin", {
    _user_id: (await supabase.auth.getUser()).data?.user?.id ?? null,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Only administrators can perform this action");
}

/** Auth email + verification state for applicants (admins only). */
export async function applicantAuthInfo(supabase: any, userIds: string[]) {
  await assertAdmin(supabase);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const results = await Promise.all(
    userIds.slice(0, 200).map(async (id) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(id);
      return {
        id,
        email: data?.user?.email ?? null,
        emailVerified: !!data?.user?.email_confirmed_at,
        phone: data?.user?.phone ?? null,
      };
    }),
  );
  return results;
}

export async function sendApprovalEmail(
  supabase: any,
  input: {
    userId: string;
    status: string;
    message?: string;
    requestedFields?: string[];
    deadline?: string;
  },
) {
  await assertAdmin(supabase);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [{ data: profile }, { data: contact }, { data: authUser }] = await Promise.all([
    supabaseAdmin.from("profiles").select("full_name").eq("id", input.userId).maybeSingle(),
    supabaseAdmin
      .from("profile_contacts")
      .select("contact_email")
      .eq("user_id", input.userId)
      .maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(input.userId),
  ]);

  const to = contact?.contact_email?.trim() || authUser?.user?.email;
  if (!to) return { sent: false, reason: "no_email" as const };

  const actionUrl =
    input.status === "approved" ? `${SITE_URL}/dashboard` : `${SITE_URL}/approval-status`;

  await sendTemplateEmail("approval-status", to, {
    templateData: {
      recipientName: profile?.full_name ?? undefined,
      status: input.status,
      statusLabel: STATUS_LABEL[input.status] ?? input.status,
      message: input.message,
      requestedFields: input.requestedFields ?? [],
      deadline: input.deadline ? new Date(input.deadline).toLocaleDateString() : undefined,
      actionUrl,
    },
    idempotencyKey: `approval-${input.status}-${input.userId}-${Date.now()}`,
  });

  return { sent: true as const };
}
