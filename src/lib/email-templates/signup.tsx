import * as React from "react";
import { Link, Text } from "@react-email/components";
import { CtaButton, EmailShell, styles } from "./brand";

interface SignupEmailProps {
  siteName: string;
  siteUrl: string;
  recipient: string;
  confirmationUrl: string;
  token?: string;
}

export const SignupEmail = ({ siteUrl, recipient, confirmationUrl, token }: SignupEmailProps) => (
  <EmailShell preview="Your myNexClass verification code" heading="Confirm your email">
    <Text style={styles.paragraph}>
      Welcome to{" "}
      <Link href={siteUrl} style={styles.link}>
        <strong>myNexClass</strong>
      </Link>{" "}
      — classes, recordings and messages, all in one place.
    </Text>
    <Text style={styles.paragraph}>
      Enter this code to verify <strong>{recipient}</strong>:
    </Text>
    {token ? <Text style={styles.code}>{token}</Text> : null}
    <Text style={styles.small}>The code expires in 1 hour. Or use the button below instead:</Text>
    <CtaButton href={confirmationUrl} label="Verify my email" />
    <Text style={styles.small}>
      If you didn&apos;t create a myNexClass account, you can safely ignore this email.
    </Text>
  </EmailShell>
);

export default SignupEmail;
