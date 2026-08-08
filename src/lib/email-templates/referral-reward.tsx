import * as React from "react";
import { Section, Text } from "@react-email/components";
import { CtaButton, DetailRow, EmailShell, styles } from "./brand";
import type { TemplateEntry } from "./registry";

interface Props {
  recipientName?: string;
  rewardLabel?: string;
  referredName?: string;
  milestone?: string;
  balanceLabel?: string;
  actionUrl?: string;
}

const ReferralReward = ({
  recipientName,
  rewardLabel = "a reward",
  referredName,
  milestone = "completed their first class",
  balanceLabel,
  actionUrl = "https://mynexclass.lovable.app/billing",
}: Props) => (
  <EmailShell preview={`You earned ${rewardLabel} on myNexClass`} heading="You earned a reward">
    <Text style={styles.paragraph}>
      {recipientName ? `Nice one, ${recipientName}!` : "Nice one!"}{" "}
      {referredName ? `${referredName} ` : "Someone you referred "}
      {milestone}, so <strong>{rewardLabel}</strong> has landed in your account.
    </Text>
    <Section style={styles.card}>
      <DetailRow label="Reward" value={rewardLabel} />
      {referredName ? <DetailRow label="Referred" value={referredName} /> : null}
      {balanceLabel ? <DetailRow label="Total earned" value={balanceLabel} /> : null}
    </Section>
    <CtaButton href={actionUrl} label="View my rewards" />
    <Text style={styles.small}>Keep sharing your referral link to earn more.</Text>
  </EmailShell>
);

export const template = {
  component: ReferralReward,
  subject: (data: Record<string, unknown>) =>
    `You earned ${data.rewardLabel ?? "a reward"} on myNexClass`,
  displayName: "Referral reward",
  previewData: {
    recipientName: "Sam",
    rewardLabel: "1 free class",
    referredName: "Alex",
    milestone: "completed their first class",
    balanceLabel: "3 free classes",
    actionUrl: "https://mynexclass.lovable.app/billing",
  },
} satisfies TemplateEntry;

export default ReferralReward;
