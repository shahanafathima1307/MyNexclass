import * as React from "react";
import { Section, Text } from "@react-email/components";
import { CtaButton, DetailRow, EmailShell, styles } from "./brand";
import type { TemplateEntry } from "./registry";

interface Props {
  recipientName?: string;
  /** "assigned" | "graded" | "returned" | "due_soon" */
  kind?: string;
  assignmentTitle?: string;
  subject?: string;
  dueLabel?: string;
  tutorName?: string;
  grade?: string;
  feedback?: string;
  actionUrl?: string;
}

const HEADINGS: Record<string, string> = {
  assigned: "New assignment",
  graded: "Your assignment is graded",
  returned: "Assignment returned for revision",
  due_soon: "Assignment due soon",
};

const AssignmentNotification = ({
  recipientName,
  kind = "assigned",
  assignmentTitle = "Your assignment",
  subject,
  dueLabel,
  tutorName,
  grade,
  feedback,
  actionUrl = "https://mynexclass.lovable.app/classes",
}: Props) => (
  <EmailShell
    preview={`${HEADINGS[kind] ?? "Assignment update"}: ${assignmentTitle}`}
    heading={HEADINGS[kind] ?? "Assignment update"}
  >
    <Text style={styles.paragraph}>
      {recipientName ? `Hi ${recipientName},` : "Hi there,"} here&apos;s the latest on{" "}
      <strong>{assignmentTitle}</strong>.
    </Text>
    <Section style={styles.card}>
      {subject ? <DetailRow label="Subject" value={subject} /> : null}
      {tutorName ? <DetailRow label="Tutor" value={tutorName} /> : null}
      {dueLabel ? <DetailRow label="Due" value={dueLabel} /> : null}
      {grade ? <DetailRow label="Grade" value={grade} /> : null}
      {feedback ? <DetailRow label="Feedback" value={feedback} /> : null}
    </Section>
    <CtaButton href={actionUrl} label="Open in myNexClass" />
  </EmailShell>
);

export const template = {
  component: AssignmentNotification,
  subject: (data: Record<string, unknown>) => {
    const kind = String(data.kind ?? "assigned");
    const title = data.assignmentTitle ?? "your assignment";
    if (kind === "graded") return `Graded: ${title}`;
    if (kind === "returned") return `Revision requested: ${title}`;
    if (kind === "due_soon") return `Due soon: ${title}`;
    return `New assignment: ${title}`;
  },
  displayName: "Assignment notification",
  previewData: {
    recipientName: "Sam",
    kind: "assigned",
    assignmentTitle: "Quadratics worksheet",
    subject: "Maths",
    dueLabel: "Fri 1 Aug · 18:00",
    tutorName: "Jesima",
    actionUrl: "https://mynexclass.lovable.app/classes",
  },
} satisfies TemplateEntry;

export default AssignmentNotification;
