import * as React from "react";
import { Link, Section, Text } from "@react-email/components";
import { CtaButton, DetailRow, EmailShell, styles } from "./brand";
import type { TemplateEntry } from "./registry";

interface Props {
  recipientName?: string;
  title?: string;
  subject?: string;
  whenLabel?: string;
  timeZone?: string;
  durationMinutes?: number;
  tutorName?: string;
  joinUrl?: string;
}

const BookingConfirmation = ({
  recipientName,
  title = "Your class",
  subject,
  whenLabel = "Time to be confirmed",
  timeZone = "UTC",
  durationMinutes = 60,
  tutorName = "your tutor",
  joinUrl,
}: Props) => (
  <EmailShell preview={`Booked: ${title} — ${whenLabel}`} heading="Your class is booked">
    <Text style={styles.paragraph}>
      {recipientName ? `Hi ${recipientName},` : "Hi there,"} your session with {tutorName} is
      confirmed.
    </Text>
    <Section style={styles.card}>
      <DetailRow label="Class" value={title} />
      {subject ? <DetailRow label="Subject" value={subject} /> : null}
      <DetailRow label="When" value={`${whenLabel} (${timeZone})`} />
      <DetailRow label="Duration" value={`${durationMinutes} minutes`} />
      <DetailRow label="Tutor" value={tutorName} />
    </Section>
    {joinUrl ? (
      <>
        <CtaButton href={joinUrl} label="Open the class room" />
        <Text style={styles.small}>
          Or paste this link into your browser:{" "}
          <Link href={joinUrl} style={styles.link}>
            {joinUrl}
          </Link>
        </Text>
        <Text style={styles.small}>
          The room unlocks 10 minutes before the start — everything happens inside myNexClass.
        </Text>
      </>
    ) : null}
  </EmailShell>
);

export const template = {
  component: BookingConfirmation,
  subject: (data: Record<string, unknown>) =>
    `Booked: ${data.title ?? "your class"} — ${data.whenLabel ?? "upcoming"}`,
  displayName: "Booking confirmation (student)",
  previewData: {
    recipientName: "Sam",
    title: "Algebra revision",
    subject: "Maths",
    whenLabel: "Tue 28 Jul · 17:00",
    timeZone: "Europe/London",
    durationMinutes: 60,
    tutorName: "Jesima",
    joinUrl: "https://mynexclass.lovable.app/classes",
  },
} satisfies TemplateEntry;

export default BookingConfirmation;
