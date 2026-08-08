import * as React from "react";
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

/**
 * Shared myNexClass email shell — deep teal + lime brand, white body background
 * (email clients do not support dark mode reliably).
 */
export const BRAND = {
  name: "myNexClass",
  url: "https://mynexclass.lovable.app",
  teal: "#0f766e",
  tealDark: "#134e4a",
  tealSoft: "#f0fdfa",
  tealBorder: "#99f6e4",
  lime: "#d9f99d",
  ink: "#111827",
  body: "#374151",
  muted: "#6b7280",
  line: "#e5e7eb",
};

export const styles = {
  main: { backgroundColor: "#ffffff", fontFamily: "Helvetica, Arial, sans-serif" },
  container: { padding: "24px", maxWidth: "560px" },
  brand: {
    color: BRAND.teal,
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    margin: "0 0 8px",
  },
  heading: { fontSize: "26px", lineHeight: "1.25", color: BRAND.ink, margin: "0 0 12px" },
  paragraph: { fontSize: "15px", lineHeight: "1.6", color: BRAND.body },
  card: {
    backgroundColor: BRAND.tealSoft,
    border: `1px solid ${BRAND.tealBorder}`,
    borderRadius: "12px",
    padding: "8px 16px",
    margin: "16px 0",
  },
  row: { fontSize: "14px", lineHeight: "1.5", color: BRAND.tealDark, margin: "8px 0" },
  button: {
    backgroundColor: BRAND.teal,
    color: "#ffffff",
    borderRadius: "10px",
    padding: "13px 26px",
    fontSize: "15px",
    fontWeight: 600,
    textDecoration: "none",
  },
  code: {
    fontFamily: "Courier, monospace",
    fontSize: "24px",
    fontWeight: 700,
    letterSpacing: "0.12em",
    color: BRAND.tealDark,
    backgroundColor: BRAND.tealSoft,
    border: `1px solid ${BRAND.tealBorder}`,
    borderRadius: "10px",
    padding: "14px 18px",
    textAlign: "center" as const,
    margin: "0 0 24px",
  },
  small: { fontSize: "12px", lineHeight: "1.5", color: BRAND.muted },
  hr: { borderColor: BRAND.line, margin: "24px 0" },
  link: { color: BRAND.teal, textDecoration: "underline" },
};

export function EmailShell({
  preview,
  heading,
  children,
  footer = "Sent by myNexClass — your tutoring schedule, in one place.",
}: {
  preview: string;
  heading: string;
  children: React.ReactNode;
  footer?: string;
}) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Text style={styles.brand}>
            <Link href={BRAND.url} style={{ color: BRAND.teal, textDecoration: "none" }}>
              myNexClass
            </Link>
          </Text>
          <Heading style={styles.heading}>{heading}</Heading>
          {children}
          <Hr style={styles.hr} />
          <Text style={styles.small}>{footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export function CtaButton({ href, label }: { href: string; label: string }) {
  return (
    <Section style={{ textAlign: "center", margin: "28px 0 8px" }}>
      <Button href={href} style={styles.button}>
        {label}
      </Button>
    </Section>
  );
}

export function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Text style={styles.row}>
      <strong>{label}:</strong> {value}
    </Text>
  );
}
