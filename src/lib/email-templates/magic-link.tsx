import * as React from "react";
import { Text } from "@react-email/components";
import { CtaButton, EmailShell, styles } from "./brand";

interface MagicLinkEmailProps {
  siteName: string;
  confirmationUrl: string;
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <EmailShell preview="Your myNexClass login link" heading="Your login link">
    <Text style={styles.paragraph}>
      Tap the button below to sign in to myNexClass. The link expires shortly and can only be used
      once.
    </Text>
    <CtaButton href={confirmationUrl} label="Log in to myNexClass" />
    <Text style={styles.small}>
      If you didn&apos;t request this link, you can safely ignore this email.
    </Text>
  </EmailShell>
);

export default MagicLinkEmail;
