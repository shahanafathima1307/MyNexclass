import * as React from "react";
import { Section, Text } from "@react-email/components";
import { CtaButton, DetailRow, EmailShell, styles } from "./brand";
import type { TemplateEntry } from "./registry";

interface Props {
  recipientName?: string;
  status?: string;
  statusLabel?: string;
  message?: string;
  requestedFields?: string[];
  deadline?: string;
  actionUrl?: string;
}

const HEADINGS: Record<string, string> = {
  pending_approval: "Registration received",
  under_review: "Your application is under review",
  more_info_required: "More information required",
  approved: "Your account is approved",
  rejected: "Registration not approved",
  suspended: "Your account is suspended",
  deactivated: "Your account was deactivated",
};

const BODY: Record<string, string> = {
  pending_approval: "Your registration was submitted and is waiting for admin review.",
  under_review: "An administrator is reviewing your registration now.",
  more_info_required:
    "Additional information is required. Review the request and resubmit your application.",
  approved: "Your account is approved. You can now access myNexClass.",
  rejected: "Your registration was not approved. Contact support if you need clarification.",
  suspended: "Access to your account is temporarily blocked.",
  deactivated: "Your account has been closed.",
};

const ApprovalStatusEmail = ({
  recipientName,
  status = "pending_approval",
  statusLabel = "Pending Approval",
  message,
  requestedFields = [],
  deadline,
  actionUrl,
}: Props) => (
  <EmailShell
    preview={HEADINGS[status] ?? "Registration update"}
    heading={HEADINGS[status] ?? "Registration update"}
  >
    <Text style={styles.paragraph}>
      {recipientName ? `Hi ${recipientName},` : "Hi there,"} {BODY[status] ?? ""}
    </Text>
    <Section style={styles.card}>
      <DetailRow label="Status" value={statusLabel} />
      {deadline ? <DetailRow label="Respond by" value={deadline} /> : null}
      {requestedFields.length ? (
        <DetailRow label="Requested" value={requestedFields.join(", ")} />
      ) : null}
    </Section>
    {message ? <Text style={styles.paragraph}>{message}</Text> : null}
    {actionUrl ? <CtaButton href={actionUrl} label="Open myNexClass" /> : null}
    <Text style={styles.small}>
      Need help? Reply to this email and the myNexClass team will get back to you.
    </Text>
  </EmailShell>
);

export const template = {
  component: ApprovalStatusEmail,
  subject: (data: Record<string, unknown>) =>
    HEADINGS[String(data['status'] ?? "pending_approval")] ?? "myNexClass registration update",
  displayName: "Approval status update",
  previewData: {
    recipientName: "Jesima",
    status: "approved",
    statusLabel: "Approved",
    message: "Welcome aboard!",
    actionUrl: "https://mynexclass.lovable.app/dashboard",
  },
} satisfies TemplateEntry;
