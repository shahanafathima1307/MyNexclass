import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Check, Copy, Gift, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { displayName, useSession } from "@/lib/session";
import { useMembers, useMyRole } from "@/lib/tutoring";
import {
  referralLink,
  useAllReferrals,
  useApproveReferral,
  useMyReferralCode,
  useMyReferrals,
  useMyRewards,
  useRejectReferral,
  useReferralSettings,
  useSaveReferralSettings,
  type Referral,
} from "@/lib/referrals";

export const Route = createFileRoute("/_authenticated/referrals")({
  head: () => ({
    meta: [
      { title: "Referrals & rewards — myNexClass" },
      {
        name: "description",
        content: "Share your referral link, track invites and see the rewards you've earned.",
      },
      { property: "og:title", content: "Referrals & rewards — myNexClass" },
      {
        property: "og:description",
        content: "Share your referral link, track invites and see the rewards you've earned.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReferralsPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  qualified: "Qualified",
  rewarded: "Rewarded",
  rejected: "Rejected",
};

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "rewarded" ? "default" : status === "rejected" ? "destructive" : "secondary";
  return <Badge variant={variant}>{STATUS_LABEL[status] ?? status}</Badge>;
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function ReferralsPage() {
  const { user } = useSession();
  const { data: role } = useMyRole(user?.id);
  const isAdmin = role === "admin";
  const { data: settings } = useReferralSettings();
  const { data: code, isLoading: codeLoading } = useMyReferralCode(
    user?.id,
    displayName(user ?? null),
  );
  const { data: referrals, isLoading } = useMyReferrals(user?.id);
  const { data: rewards } = useMyRewards(user?.id);
  const { data: members } = useMembers();
  const nameById = useMemo(
    () => new Map((members ?? []).map((m) => [m.id, m.full_name])),
    [members],
  );

  const currency = settings?.currency ?? "USD";
  const earned = (rewards ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
  const rows = referrals ?? [];
  const rewardedCount = rows.filter((r) => r.status === "rewarded").length;
  const link = code ? referralLink(code) : "";

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy — select the text instead.");
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Join me on myNexClass", url: link });
        return;
      } catch {
        /* user cancelled */
      }
    }
    copy(link);
  }

  const steps = settings
    ? [
        { title: "Share your link", body: "Send it to a friend, parent or classmate." },
        {
          title: "They join",
          body:
            settings.milestone === "signup"
              ? "They create an account with your link."
              : "They sign up and complete their first class.",
        },
        {
          title: "You both get paid",
          body: `${money(Number(settings.referrer_reward), currency)} for you, ${money(
            Number(settings.referee_reward),
            currency,
          )} for them.`,
        },
      ]
    : [];

  return (
    <AppShell
      title="Referrals & rewards"
      subtitle="Invite friends with your personal link and earn rewards when they join."
    >
      <div className="space-y-6">
        {settings && !settings.is_active ? (
          <Card className="border-dashed">
            <CardContent className="py-4 text-sm text-muted-foreground">
              The referral programme is paused right now. Existing invites are still tracked.
            </CardContent>
          </Card>
        ) : null}

        <Card className="overflow-hidden border-primary/20">
          <div className="bg-gradient-to-br from-primary/10 via-accent/10 to-transparent">
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/15">
                  <Gift className="size-4" />
                </span>
                <CardTitle className="text-base">Your referral link</CardTitle>
              </div>
              <CardDescription className="pt-1">
                {settings
                  ? `Earn ${money(Number(settings.referrer_reward), currency)} for every friend who joins — they get ${money(
                      Number(settings.referee_reward),
                      currency,
                    )} too.`
                  : "Share your link to start earning."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {codeLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      readOnly
                      value={link}
                      onFocus={(e) => e.currentTarget.select()}
                      className="min-w-[240px] flex-1 bg-background font-mono text-xs sm:text-sm"
                    />
                    <Button variant="outline" onClick={() => copy(link)}>
                      <Copy className="size-4" /> Copy
                    </Button>
                    <Button onClick={share}>
                      <Share2 className="size-4" /> Share
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>Your code</span>
                    <button
                      type="button"
                      onClick={() => code && copy(code)}
                      className="rounded-md border border-dashed border-primary/40 bg-background px-2 py-1 font-mono font-semibold tracking-widest text-foreground transition-colors hover:border-primary"
                    >
                      {code}
                    </button>
                  </div>
                </>
              )}

              {steps.length > 0 ? (
                <div className="grid gap-3 pt-2 sm:grid-cols-3">
                  {steps.map((s, i) => (
                    <div key={s.title} className="rounded-lg border bg-background/70 p-3">
                      <p className="text-xs font-semibold text-primary">Step {i + 1}</p>
                      <p className="mt-0.5 text-sm font-medium">{s.title}</p>
                      <p className="text-sm text-muted-foreground">{s.body}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Invites sent" value={String(rows.length)} icon={<Share2 className="size-4" />} />
          <StatCard label="Rewarded" value={String(rewardedCount)} icon={<Check className="size-4" />} />
          <StatCard
            label="Total earned"
            value={money(earned, currency)}
            icon={<Gift className="size-4" />}
            highlight
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your invites</CardTitle>
            <CardDescription>Every person who signed up with your link.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <Gift className="size-5 text-muted-foreground" />
                </span>
                <div>
                  <p className="text-sm font-medium">No invites yet</p>
                  <p className="text-sm text-muted-foreground">
                    Share your link above and your invites will appear here.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={share}>
                  <Share2 className="size-4" /> Share your link
                </Button>
              </div>
            ) : (
              rows.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {(nameById.get(r.referred_id) ?? "N")[0]?.toUpperCase()}
                    </span>
                    <div>
                      <p className="font-medium">{nameById.get(r.referred_id) ?? "New member"}</p>
                      <p className="text-muted-foreground">
                        Joined {format(new Date(r.created_at), "d MMM yyyy")}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {(rewards ?? []).length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rewards</CardTitle>
              <CardDescription>Everything you've earned so far.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(rewards ?? []).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{money(Number(r.amount), r.currency)}</p>
                    <p className="text-muted-foreground">
                      {r.note ?? "Reward"} · {format(new Date(r.created_at), "d MMM yyyy")}
                    </p>
                  </div>
                  <Badge variant={r.status === "paid" ? "default" : "secondary"}>{r.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {settings?.terms ? (
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">{settings.terms}</p>
        ) : null}

        {isAdmin ? <AdminPanel nameById={nameById} /> : null}
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary/30 bg-primary/5" : undefined}>
      <CardContent className="flex items-center justify-between gap-3 py-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        {icon ? (
          <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {icon}
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AdminPanel({ nameById }: { nameById: Map<string, string> }) {
  const { data: settings } = useReferralSettings();
  const save = useSaveReferralSettings();
  const { data: all } = useAllReferrals(true);
  const approve = useApproveReferral();
  const reject = useRejectReferral();

  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const value = (key: string, fallback: string | number) =>
    draft?.[key] ?? String(fallback ?? "");
  const set = (key: string, v: string) => setDraft((d) => ({ ...(d ?? {}), [key]: v }));

  async function persist() {
    if (!settings) return;
    try {
      await save.mutateAsync({
        referrer_reward: Number(value("referrer_reward", settings.referrer_reward)),
        referee_reward: Number(value("referee_reward", settings.referee_reward)),
        currency: value("currency", settings.currency).toUpperCase().slice(0, 3),
        milestone: value("milestone", settings.milestone),
        max_rewards_per_user: Number(
          value("max_rewards_per_user", settings.max_rewards_per_user),
        ),
        terms: value("terms", settings.terms ?? "").slice(0, 2000) || null,
      });
      setDraft(null);
      toast.success("Programme settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save settings");
    }
  }

  const pending = (all ?? []).filter((r: Referral) => r.status !== "rewarded" && r.status !== "rejected");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Programme settings</CardTitle>
          <CardDescription>Admin only — controls rewards for every member.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!settings ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Programme active</p>
                  <p className="text-sm text-muted-foreground">
                    Turn off to pause new reward payouts.
                  </p>
                </div>
                <Switch
                  checked={settings.is_active}
                  onCheckedChange={(checked) => save.mutate({ is_active: checked })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="r-referrer">Referrer reward</Label>
                  <Input
                    id="r-referrer"
                    type="number"
                    min={0}
                    value={value("referrer_reward", settings.referrer_reward)}
                    onChange={(e) => set("referrer_reward", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r-referee">New member reward</Label>
                  <Input
                    id="r-referee"
                    type="number"
                    min={0}
                    value={value("referee_reward", settings.referee_reward)}
                    onChange={(e) => set("referee_reward", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r-currency">Currency</Label>
                  <Input
                    id="r-currency"
                    maxLength={3}
                    value={value("currency", settings.currency)}
                    onChange={(e) => set("currency", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r-max">Max rewards per member</Label>
                  <Input
                    id="r-max"
                    type="number"
                    min={0}
                    value={value("max_rewards_per_user", settings.max_rewards_per_user)}
                    onChange={(e) => set("max_rewards_per_user", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-terms">Terms shown to members</Label>
                <Textarea
                  id="r-terms"
                  rows={3}
                  maxLength={2000}
                  value={value("terms", settings.terms ?? "")}
                  onChange={(e) => set("terms", e.target.value)}
                />
              </div>
              <Button onClick={persist} disabled={save.isPending || !draft}>
                {save.isPending ? "Saving…" : "Save settings"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Referrals to review ({pending.length})</CardTitle>
          <CardDescription>
            Approve once the milestone is genuinely met — self-invites and duplicates are blocked
            automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {pending.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nothing to review.</p>
          ) : (
            pending.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {nameById.get(r.referrer_id) ?? "Member"} →{" "}
                    {nameById.get(r.referred_id) ?? "New member"}
                  </p>
                  <p className="text-muted-foreground">
                    Code {r.code} · {format(new Date(r.created_at), "d MMM yyyy")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!settings || approve.isPending}
                    onClick={() =>
                      settings &&
                      approve
                        .mutateAsync({ referral: r, settings })
                        .then(() => toast.success("Reward issued"))
                        .catch((e) => toast.error(e.message))
                    }
                  >
                    <Check className="size-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={reject.isPending}
                    onClick={() => reject.mutate(r.id)}
                  >
                    <X className="size-4" /> Reject
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
