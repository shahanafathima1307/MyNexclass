import * as React from "react";
import { Text } from "@react-email/components";
import { EmailShell, styles } from "./brand";

interface ReauthenticationEmailProps {
  token: string;
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <EmailShell preview="Your myNexClass verification code" heading="Confirm it's you">
    <Text style={styles.paragraph}>Use this code to confirm your identity in myNexClass:</Text>
    <Text style={styles.code}>{token}</Text>
    <Text style={styles.small}>
      The code expires shortly. If you didn&apos;t request it, you can ignore this email.
    </Text>
  </EmailShell>
);

export default ReauthenticationEmail;
