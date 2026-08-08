import * as React from "react";
import { Link, Text } from "@react-email/components";
import { CtaButton, EmailShell, styles } from "./brand";

interface EmailChangeEmailProps {
  siteName: string;
  oldEmail: string;
  email: string;
  newEmail: string;
  confirmationUrl: string;
}

export const EmailChangeEmail = ({
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <EmailShell preview="Confirm your new myNexClass email" heading="Confirm your email change">
    <Text style={styles.paragraph}>
      You asked to change your myNexClass email from{" "}
      <Link href={`mailto:${oldEmail}`} style={styles.link}>
        {oldEmail}
      </Link>{" "}
      to{" "}
      <Link href={`mailto:${newEmail}`} style={styles.link}>
        {newEmail}
      </Link>
      .
    </Text>
    <CtaButton href={confirmationUrl} label="Confirm email change" />
    <Text style={styles.small}>
      If you didn&apos;t request this change, secure your account immediately.
    </Text>
  </EmailShell>
);

export default EmailChangeEmail;
