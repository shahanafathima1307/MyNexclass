import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface ClassInviteProps {
  recipientName?: string;
  title?: string;
  subject?: string;
  whenLabel?: string;
  timeZone?: string;
  durationMinutes?: number;
  tutorName?: string;
  studentName?: string;
  joinUrl?: string;
  externalUrl?: string;
  notes?: string;
}

const ClassInvite = ({
  recipientName,
  title = "Your class",
  subject,
  whenLabel = "Time to be confirmed",
  timeZone = "UTC",
  durationMinutes = 60,
  tutorName = "your tutor",
  studentName = "the student",
  joinUrl,
  externalUrl,
  notes,
}: ClassInviteProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${title} — ${whenLabel} (${timeZone})`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>myNexClass</Text>
        <Heading style={heading}>{title}</Heading>
        <Text style={paragraph}>
          {recipientName ? `Hi ${recipientName},` : "Hi there,"} here are the details for your
          upcoming class.
        </Text>

        <Section style={card}>
          <Text style={row}>
            <strong>When:</strong> {whenLabel} ({timeZone})
          </Text>
          <Text style={row}>
            <strong>Duration:</strong> {durationMinutes} minutes
          </Text>
          {subject ? (
            <Text style={row}>
              <strong>Subject:</strong> {subject}
            </Text>
          ) : null}
          <Text style={row}>
            <strong>Tutor:</strong> {tutorName}
          </Text>
          <Text style={row}>
            <strong>Student:</strong> {studentName}
          </Text>
        </Section>

        {joinUrl ? (
          <>
            <Section style={{ textAlign: "center", margin: "28px 0 8px" }}>
              <Button href={joinUrl} style={button}>
                Join the class in myNexClass
              </Button>
            </Section>
            <Text style={small}>
              Or paste this link into your browser: <Link href={joinUrl}>{joinUrl}</Link>
            </Text>
            <Text style={small}>
              The class runs inside myNexClass — sign in and the video room opens right there.
            </Text>
            {externalUrl ? (
              <Text style={small}>
                Backup link if you need it: <Link href={externalUrl}>{externalUrl}</Link>
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={paragraph}>
            A meeting link has not been added yet — it will follow before the class starts.
          </Text>
        )}

        {notes ? (
          <>
            <Hr style={hr} />
            <Text style={paragraph}>
              <strong>Notes:</strong> {notes}
            </Text>
          </>
        ) : null}

        <Hr style={hr} />
        <Text style={small}>Sent by myNexClass — your tutoring schedule, in one place.</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: ClassInvite,
  subject: (data: Record<string, unknown>) =>
    `Class invite: ${data.title ?? "your class"} — ${data.whenLabel ?? "upcoming"}`,
  displayName: "Class invite",
  previewData: {
    recipientName: "Sam",
    title: "Algebra revision",
    subject: "Maths",
    whenLabel: "Tue 28 Jul · 17:00",
    timeZone: "Europe/London",
    durationMinutes: 60,
    tutorName: "Jesima",
    studentName: "Sam Diaz",
    joinUrl: "https://mynexclass.lovable.app/room/8c1f0f7a-3d2b-4f0e-9a10-2f7c4b6d1e55",
    notes: "Bring last week's worksheet.",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Helvetica, Arial, sans-serif" };
const container = { padding: "24px", maxWidth: "560px" };
const brand = {
  color: "#0f766e",
  fontSize: "13px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  margin: "0 0 8px",
};
const heading = { fontSize: "26px", lineHeight: "1.25", color: "#111827", margin: "0 0 12px" };
const paragraph = { fontSize: "15px", lineHeight: "1.6", color: "#374151" };
const card = {
  backgroundColor: "#f0fdfa",
  border: "1px solid #99f6e4",
  borderRadius: "12px",
  padding: "8px 16px",
  margin: "16px 0",
};
const row = { fontSize: "14px", lineHeight: "1.5", color: "#134e4a", margin: "8px 0" };
const button = {
  backgroundColor: "#0f766e",
  color: "#ffffff",
  borderRadius: "10px",
  padding: "13px 26px",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
};
const small = { fontSize: "12px", lineHeight: "1.5", color: "#6b7280" };
const hr = { borderColor: "#e5e7eb", margin: "24px 0" };
