import * as React from "react";
import { Section, Text } from "@react-email/components";
import { CtaButton, DetailRow, EmailShell, styles } from "./brand";
import type { TemplateEntry } from "./registry";

interface Props {
  tutorName?: string;
  studentName?: string;
  title?: string;
  subject?: string;
  whenLabel?: string;
  timeZone?: string;
  durationMinutes?: number;
  notes?: string;
  manageUrl?: string;
}

const TutorBookingAlert = ({
  tutorName,
  studentName = "A student",
  title = "New class",
  subject,
  whenLabel = "Time to be confirmed",
  timeZone = "UTC",
  durationMinutes = 60,
  notes,
  manageUrl = "https://mynexclass.lovable.app/classes",
}: Props) => (
  <EmailShell preview={`New booking from ${studentName} — ${whenLabel}`} heading="New booking">
    <Text style={styles.paragraph}>
      {tutorName ? `Hi ${tutorName},` : "Hi there,"} {studentName} has booked a session with you.
    </Text>
    <Section style={styles.card}>
      <DetailRow label="Class" value={title} />
      {subject ? <DetailRow label="Subject" value={subject} /> : null}
      <DetailRow label="Student" value={studentName} />
      <DetailRow label="When" value={`${whenLabel} (${timeZone})`} />
      <DetailRow label="Duration" value={`${durationMinutes} minutes`} />
      {notes ? <DetailRow label="Notes" value={notes} /> : null}
    </Section>
    <CtaButton href={manageUrl} label="View in myNexClass" />
  </EmailShell>
);

export const template = {
  component: TutorBookingAlert,
  subject: (data: Record<string, unknown>) =>
    `New booking: ${data.title ?? "a class"} — ${data.whenLabel ?? "upcoming"}`,
  displayName: "New booking (tutor)",
  previewData: {
    tutorName: "Jesima",
    studentName: "Sam Diaz",
    title: "Algebra revision",
    subject: "Maths",
    whenLabel: "Tue 28 Jul · 17:00",
    timeZone: "Europe/London",
    durationMinutes: 60,
    notes: "Struggling with quadratics.",
    manageUrl: "https://mynexclass.lovable.app/classes",
  },
} satisfies TemplateEntry;

export default TutorBookingAlert;
