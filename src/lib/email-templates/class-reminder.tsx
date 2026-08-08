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
  minutesUntil?: number;
  withName?: string;
  joinUrl?: string;
}

const ClassReminder = ({
  recipientName,
  title = "Your class",
  subject,
  whenLabel = "shortly",
  timeZone = "UTC",
  minutesUntil = 60,
  withName,
  joinUrl,
}: Props) => (
  <EmailShell preview={`${title} starts in ${minutesUntil} minutes`} heading="Your class is soon">
    <Text style={styles.paragraph}>
      {recipientName ? `Hi ${recipientName},` : "Hi there,"} <strong>{title}</strong> starts in
      about {minutesUntil} minutes.
    </Text>
    <Section style={styles.card}>
      <DetailRow label="When" value={`${whenLabel} (${timeZone})`} />
      {subject ? <DetailRow label="Subject" value={subject} /> : null}
      {withName ? <DetailRow label="With" value={withName} /> : null}
    </Section>
    {joinUrl ? (
      <>
        <CtaButton href={joinUrl} label="Join the class" />
        <Text style={styles.small}>
          Trouble with the button?{" "}
          <Link href={joinUrl} style={styles.link}>
            {joinUrl}
          </Link>
        </Text>
      </>
    ) : null}
  </EmailShell>
);

export const template = {
  component: ClassReminder,
  subject: (data: Record<string, unknown>) =>
    `Reminder: ${data.title ?? "your class"} starts soon`,
  displayName: "Class reminder",
  previewData: {
    recipientName: "Sam",
    title: "Algebra revision",
    subject: "Maths",
    whenLabel: "Tue 28 Jul · 17:00",
    timeZone: "Europe/London",
    minutesUntil: 60,
    withName: "Jesima",
    joinUrl: "https://mynexclass.lovable.app/classes",
  },
} satisfies TemplateEntry;

export default ClassReminder;
