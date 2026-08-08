/* eslint-disable @typescript-eslint/no-explicit-any */
import { sendTemplateEmail } from "@/lib/email-templates/send-email";
import { formatInZone, zoneAbbrev } from "@/lib/timezones";

export const SITE_URL = (process.env.SITE_URL || "https://mynexclass.lovable.app").replace(
  /\/$/,
  "",
);

export type MailOutcome = { sent: string[]; skipped: string[]; missingEmail: string[] };

export function whenLabelFor(startsAt: string, zone: string) {
  const start = new Date(startsAt);
  return `${formatInZone(start, zone)} ${zoneAbbrev(start, zone)}`.trim();
}

/** Resolves a deliverable address: profile contact first, then the auth email. */
export async function resolveEmail(
  admin: any,
  contactEmail: string | null | undefined,
  userId: string,
): Promise<string | null> {
  const contact = contactEmail?.trim();
  if (contact) return contact;
  const { data } = await admin.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

/**
 * Booking emails: confirmation to the student, alert to the tutor.
 * Reads the class through the caller's RLS-scoped client.
 */
export async function sendBookingEmails(
  supabase: any,
  classId: string,
): Promise<MailOutcome> {
  const { data: cls, error } = await supabase
    .from("classes")
    .select("*")
    .eq("id", classId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!cls) throw new Error("Class not found or you do not have access to it");

  const ids = [cls.tutor_id, cls.student_id];
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

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const zone = cls.time_zone || "UTC";
  const whenLabel = whenLabelFor(cls.starts_at, zone);
  const joinUrl = `${SITE_URL}/room/${cls.id}`;
  const tutorName = nameById.get(cls.tutor_id) ?? "your tutor";
  const studentName = nameById.get(cls.student_id) ?? "your student";

  const outcome: MailOutcome = { sent: [], skipped: [], missingEmail: [] };

  const studentEmail = await resolveEmail(
    supabaseAdmin,
    contactById.get(cls.student_id),
    cls.student_id,
  );
  if (studentEmail) {
    const res = await sendTemplateEmail("booking-confirmation", studentEmail, {
      templateData: {
        recipientName: nameById.get(cls.student_id) ?? undefined,
        title: cls.title,
        subject: cls.subject ?? undefined,
        whenLabel,
        timeZone: zone,
        durationMinutes: cls.duration_minutes,
        tutorName,
        joinUrl,
      },
      idempotencyKey: `booking-confirm-${cls.id}-${cls.starts_at}`,
    });
    res.sent ? outcome.sent.push(studentEmail) : outcome.skipped.push(studentEmail);
  } else {
    outcome.missingEmail.push(studentName);
  }

  const tutorEmail = await resolveEmail(
    supabaseAdmin,
    contactById.get(cls.tutor_id),
    cls.tutor_id,
  );
  if (tutorEmail) {
    const res = await sendTemplateEmail("tutor-booking-alert", tutorEmail, {
      templateData: {
        tutorName: nameById.get(cls.tutor_id) ?? undefined,
        studentName,
        title: cls.title,
        subject: cls.subject ?? undefined,
        whenLabel,
        timeZone: zone,
        durationMinutes: cls.duration_minutes,
        notes: cls.notes ?? undefined,
        manageUrl: `${SITE_URL}/classes`,
      },
      idempotencyKey: `booking-alert-${cls.id}-${cls.starts_at}`,
    });
    res.sent ? outcome.sent.push(tutorEmail) : outcome.skipped.push(tutorEmail);
  } else {
    outcome.missingEmail.push(tutorName);
  }

  return outcome;
}

/**
 * Reminder sweep — emails both participants of every scheduled class starting
 * inside the next `windowMinutes`. Duplicate sends are deduped by Lovable via
 * the idempotency key, so the sweep is safe to run on a short schedule.
 */
export async function sendDueReminders(windowMinutes = 60) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = Date.now();
  const from = new Date(now).toISOString();
  const to = new Date(now + windowMinutes * 60_000).toISOString();

  const { data: classes, error } = await supabaseAdmin
    .from("classes")
    .select("*")
    .eq("status", "scheduled")
    .gte("starts_at", from)
    .lte("starts_at", to);
  if (error) throw new Error(error.message);

  const list = classes ?? [];
  const ids = [...new Set(list.flatMap((c: any) => [c.tutor_id, c.student_id]))];
  if (!ids.length) return { classes: 0, sent: 0 };

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);
  const { data: contacts } = await supabaseAdmin
    .from("profile_contacts")
    .select("user_id, contact_email")
    .in("user_id", ids);

  const nameById = new Map<string, string | null>(
    (profiles ?? []).map((p: any) => [p.id, p.full_name]),
  );
  const contactById = new Map<string, string | null>(
    (contacts ?? []).map((c: any) => [c.user_id, c.contact_email]),
  );

  let sent = 0;
  for (const cls of list as any[]) {
    const zone = cls.time_zone || "UTC";
    const whenLabel = whenLabelFor(cls.starts_at, zone);
    const minutesUntil = Math.max(
      1,
      Math.round((new Date(cls.starts_at).getTime() - now) / 60_000),
    );
    for (const userId of [cls.student_id, cls.tutor_id]) {
      const other = userId === cls.student_id ? cls.tutor_id : cls.student_id;
      const to = await resolveEmail(supabaseAdmin, contactById.get(userId), userId);
      if (!to) continue;
      const res = await sendTemplateEmail("class-reminder", to, {
        templateData: {
          recipientName: nameById.get(userId) ?? undefined,
          title: cls.title,
          subject: cls.subject ?? undefined,
          whenLabel,
          timeZone: zone,
          minutesUntil,
          withName: nameById.get(other) ?? undefined,
          joinUrl: `${SITE_URL}/room/${cls.id}`,
        },
        idempotencyKey: `class-reminder-${cls.id}-${cls.starts_at}-${userId}`,
      });
      if (res.sent) sent += 1;
    }
  }

  return { classes: list.length, sent };
}
