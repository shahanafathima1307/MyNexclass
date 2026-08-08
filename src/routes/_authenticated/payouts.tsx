import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Banknote, Wallet } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSession } from "@/lib/session";
import { useMembers, useMyRole } from "@/lib/tutoring";
import { formatMoney } from "@/lib/billing";
import {
  useCancelPayout,
  usePayoutAccount,
  usePayoutRequests,
  useRequestPayout,
  useSavePayoutAccount,
  useSetPayoutStatus,
} from "@/lib/payouts";
import { notify } from "@/lib/messaging";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/payouts")({
  head: () => ({
    meta: [
      { title: "Earnings & payouts — myNexClass" },
      {
        name: "description",
        content: "Track tutor earnings, save payout details and request withdrawals in myNexClass.",
      },
      { property: "og:title", content: "Earnings & payouts — myNexClass" },
      {
        property: "og:description",
        content: "Track tutor earnings, save payout details and request withdrawals in myNexClass.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PayoutsPage,
});

function PayoutsPage() {
  const { user } = useSession();
  const { data: role } = useMyRole(user?.id);
  const isAdmin = role === "admin";
  const { data: members } = useMembers();
  const { data: account } = usePayoutAccount(user?.id);
  const { data: mine } = usePayoutRequests(user?.id);
  const { data: all } = usePayoutRequests(undefined, isAdmin);
  const saveAccount = useSavePayoutAccount();
  const request = useRequestPayout();
  const setStatus = useSetPayoutStatus();
  const cancel = useCancelPayout();

  const [method, setMethod] = useState(account?.method ?? "bank");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const rows = mine ?? [];
  const paid = rows
    .filter((r) => r.status === "paid")
    .reduce((sum, r) => sum + Number(r.amount), 0);
  const pending = rows
    .filter((r) => r.status === "requested" || r.status === "approved")
    .reduce((sum, r) => sum + Number(r.amount), 0);
  const nameOf = (id: string) =>
    members?.find((m) => m.id === id)?.full_name || "Unnamed member";

  function saveDetails(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const form = new FormData(e.currentTarget);
    saveAccount.mutate(
      {
        user_id: user.id,
        method,
        account_name: String(form.get("account_name") ?? "") || null,
        account_number: String(form.get("account_number") ?? "") || null,
        ifsc: String(form.get("ifsc") ?? "") || null,
        upi_id: String(form.get("upi_id") ?? "") || null,
      },
      { onSuccess: () => toast.success("Payout details saved") },
    );
  }

  function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error("Enter an amount greater than zero");
      return;
    }
    request.mutate(
      { amount: value, currency: "USD", note },
      {
        onSuccess: () => {
          toast.success("Withdrawal requested");
          setAmount("");
          setNote("");
        },
        onError: (err: Error) => toast.error(err.message),
      },
    );
  }

  return (
    <AppShell
      title="Earnings & payouts"
      subtitle="Your withdrawal history, payout details and requests."
    >
      <div className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Paid out" value={formatMoney(paid)} />
          <StatCard label="Awaiting payout" value={formatMoney(pending)} />
          <StatCard label="Requests made" value={String(rows.length)} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="size-4" />
                Payout details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={saveDetails}>
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">Bank transfer</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account_name">Account holder</Label>
                  <Input
                    id="account_name"
                    name="account_name"
                    defaultValue={account?.account_name ?? ""}
                    maxLength={120}
                  />
                </div>
                {method === "bank" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="account_number">Account number</Label>
                      <Input
                        id="account_number"
                        name="account_number"
                        defaultValue={account?.account_number ?? ""}
                        maxLength={40}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ifsc">IFSC / routing</Label>
                      <Input
                        id="ifsc"
                        name="ifsc"
                        defaultValue={account?.ifsc ?? ""}
                        maxLength={20}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="upi_id">UPI ID</Label>
                    <Input
                      id="upi_id"
                      name="upi_id"
                      defaultValue={account?.upi_id ?? ""}
                      maxLength={80}
                      placeholder="name@bank"
                    />
                  </div>
                )}
                <Button type="submit" disabled={saveAccount.isPending}>
                  {saveAccount.isPending ? "Saving…" : "Save details"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="size-4" />
                Request a withdrawal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={submitRequest}>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (USD)</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="1"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">Note for the admin</Label>
                  <Textarea
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={300}
                    rows={3}
                  />
                </div>
                <Button type="submit" disabled={request.isPending}>
                  {request.isPending ? "Sending…" : "Request withdrawal"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border shadow-soft">
          <CardHeader>
            <CardTitle>My withdrawal requests</CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{format(new Date(r.created_at), "d MMM yyyy")}</TableCell>
                      <TableCell>{formatMoney(Number(r.amount), r.currency)}</TableCell>
                      <TableCell className="max-w-64 truncate">{r.note ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "requested" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              cancel.mutate(r.id, {
                                onSuccess: () => toast.success("Request withdrawn"),
                              })
                            }
                          >
                            Cancel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No withdrawal requests yet.</p>
            )}
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="border-accent shadow-soft">
            <CardHeader>
              <CardTitle>Payout management (admin)</CardTitle>
            </CardHeader>
            <CardContent>
              {all?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tutor</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {all.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{nameOf(r.tutor_id)}</TableCell>
                        <TableCell>{format(new Date(r.created_at), "d MMM yyyy")}</TableCell>
                        <TableCell>{formatMoney(Number(r.amount), r.currency)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="space-x-2 text-right">
                          {(["approved", "paid", "rejected"] as const).map((next) => (
                            <Button
                              key={next}
                              size="sm"
                              variant={next === "paid" ? "default" : "outline"}
                              disabled={r.status === next}
                              onClick={() =>
                                setStatus.mutate(
                                  { id: r.id, status: next },
                                  {
                                    onSuccess: () => {
                                      toast.success(`Marked ${next}`);
                                      void logAudit({
                                        action: `payout.${next}`,
                                        entity: "payout_requests",
                                        entityId: r.id,
                                        details: { amount: Number(r.amount) },
                                      });
                                      void notify({
                                        userId: r.tutor_id,
                                        title: `Withdrawal ${next}`,
                                        body: `${formatMoney(Number(r.amount), r.currency)} was marked ${next}.`,
                                        link: "/payouts",
                                        kind: "payout",
                                      });
                                    },
                                  },
                                )
                              }
                            >
                              {next}
                            </Button>
                          ))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No payout requests from tutors yet.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-border shadow-soft">
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-display text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
