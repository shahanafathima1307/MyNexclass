/* eslint-disable @typescript-eslint/no-explicit-any */
import { sendTemplateEmail } from "@/lib/email-templates/send-email";
import { formatInZone, zoneAbbrev } from "@/lib/timezones";

/** Accepts "meet.google.com/abc" and turns it into a clickable absolute URL. */
function normalizeMeetingUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

type AuthedClient = {
  from: (table: string) => {
    select: (columns: string) => Record<string, (...args: never[]) => unknown> & {
      eq: (column: string, value: string) => { maybeSingle: () => Promise<QueryResult> };
      in: (column: string, values: string[]) => Promise<QueryResult>;
    };
  };
};

type QueryResult = { data: any; error: { message: string } | null };

export type SendInviteOutcome = {
  sent: string[];
  skipped: { email: string; reason: string }[];
  missingEmail: string[];
};

/**
 * Sends the class invite email to the tutor and the student of a class.
 * Reads the class through the caller's RLS-scoped client, so a user can only
 * trigger invites for classes they take part in (or any class, as admin).
 */
export async function sendClassInvite(
  supabase: AuthedClient,
  classId: string,
): Promise<SendInviteOutcome> {
  const { data: cls, error } = await supabase
    .from("classes")
    .select("*")
    .eq("id", classId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!cls) throw new Error("Class not found or you do not have access to it");

  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", [cls.tutor_id, cls.student_id]);
  if (pErr) throw new Error(pErr.message);

  const { data: contacts, error: cErr } = await supabase
    .from("profile_contacts")
    .select("user_id, contact_email")
    .in("user_id", [cls.tutor_id, cls.student_id]);
  if (cErr) throw new Error(cErr.message);

  const emailById = new Map<string, string | null>(
    (contacts ?? []).map((c: { user_id: string; contact_email: string | null }) => [
      c.user_id,
      c.contact_email,
    ]),
  );

  const byId = new Map<string, { full_name: string | null; contact_email: string | null }>(
    (profiles ?? []).map((p: { id: string; full_name: string | null }) => [
      p.id,
      { full_name: p.full_name, contact_email: emailById.get(p.id) ?? null },
    ]),
  );


  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  async function emailFor(userId: string): Promise<string | null> {
    const profileEmail = byId.get(userId)?.contact_email?.trim();
    if (profileEmail) return profileEmail;
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  }

  const start = new Date(cls.starts_at);
  const zone = cls.time_zone || "UTC";
  const whenLabel = `${formatInZone(start, zone)} ${zoneAbbrev(start, zone)}`.trim();
  const siteUrl = (process.env.SITE_URL || "https://mynexclass.lovable.app").replace(/\/$/, "");
  const roomUrl = `${siteUrl}/room/${cls.id}`;
  const externalUrl = cls.meeting_url ? normalizeMeetingUrl(cls.meeting_url) : null;
  const tutorName = byId.get(cls.tutor_id)?.full_name ?? "your tutor";
  const studentName = byId.get(cls.student_id)?.full_name ?? "the student";

  const outcome: SendInviteOutcome = { sent: [], skipped: [], missingEmail: [] };

  for (const userId of [cls.tutor_id, cls.student_id]) {
    const to = await emailFor(userId);
    if (!to) {
      outcome.missingEmail.push(byId.get(userId)?.full_name || "member");
      continue;
    }
    const result = await sendTemplateEmail("class-invite", to, {
      templateData: {
        recipientName: byId.get(userId)?.full_name ?? undefined,
        title: cls.title,
        subject: cls.subject ?? undefined,
        whenLabel,
        timeZone: zone,
        durationMinutes: cls.duration_minutes,
        tutorName,
        studentName,
        joinUrl: roomUrl,
        externalUrl: externalUrl ?? undefined,
        notes: cls.notes ?? undefined,
      },
      idempotencyKey: `class-invite-${cls.id}-${userId}-${cls.meeting_url ?? "no-link"}-room-${cls.starts_at}`,
    });
    if (result.sent) outcome.sent.push(to);
    else outcome.skipped.push({ email: to, reason: result.reason });
  }

  return outcome;
}
