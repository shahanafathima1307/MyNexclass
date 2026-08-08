import * as React from "react";
import { Link, Text } from "@react-email/components";
import { CtaButton, EmailShell, styles } from "./brand";

interface InviteEmailProps {
  siteName: string;
  siteUrl: string;
  confirmationUrl: string;
}

export const InviteEmail = ({ siteUrl, confirmationUrl }: InviteEmailProps) => (
  <EmailShell preview="You've been invited to myNexClass" heading="You've been invited">
    <Text style={styles.paragraph}>
      You&apos;ve been invited to join{" "}
      <Link href={siteUrl} style={styles.link}>
        <strong>myNexClass</strong>
      </Link>
      . Accept the invitation to set up your account and see your classes.
    </Text>
    <CtaButton href={confirmationUrl} label="Accept invitation" />
    <Text style={styles.small}>
      If you weren&apos;t expecting this invitation, you can safely ignore this email.
    </Text>
  </EmailShell>
);

export default InviteEmail;
