import * as React from "react";
import { Text } from "@react-email/components";
import { CtaButton, EmailShell, styles } from "./brand";

interface RecoveryEmailProps {
  siteName: string;
  confirmationUrl: string;
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <EmailShell preview="Reset your myNexClass password" heading="Reset your password">
    <Text style={styles.paragraph}>
      We received a request to reset the password for your myNexClass account. Choose a new one below —
      the link expires shortly.
    </Text>
    <CtaButton href={confirmationUrl} label="Set a new password" />
    <Text style={styles.small}>
      If you didn&apos;t ask for this, ignore this email — your password stays unchanged.
    </Text>
  </EmailShell>
);

export default RecoveryEmail;
