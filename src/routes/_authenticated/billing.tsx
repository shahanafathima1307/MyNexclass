import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Check, CreditCard, Receipt } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "@/lib/session";
import {
  formatMoney,
  intervalLabel,
  useCancelSubscription,
  useCheckout,
  useMySubscription,
  usePayments,
  usePlans,
  useSetPaymentStatus,
  type Plan,
} from "@/lib/billing";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing & plans — myNexClass" },
      {
        name: "description",
        content: "Choose a myNexClass plan, review your invoices and manage your subscription.",
      },
      { property: "og:title", content: "Billing & plans — myNexClass" },
      {
        property: "og:description",
        content: "Choose a myNexClass plan, review your invoices and manage your subscription.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const { user } = useSession();
  const { data: plans } = usePlans();
  const { data: subscription } = useMySubscription(user?.id);
  const { data: payments } = usePayments(user?.id);
  const checkout = useCheckout();
  const cancel = useCancelSubscription();
  const setStatus = useSetPaymentStatus();
  const [selected, setSelected] = useState<Plan | null>(null);

  function confirmCheckout() {
    if (!selected || !user) return;
    checkout.mutate(
      { plan: selected, userId: user.id },
      {
        onSuccess: () => {
          toast.success(`${selected.name} selected — invoice created`);
          setSelected(null);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  return (
    <AppShell
      title="Billing & plans"
      subtitle="Pick a plan, track invoices and manage your subscription."
    >
      <div className="grid gap-6">
        <Card className="border-accent shadow-soft">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Current plan</p>
              <p className="font-display text-xl font-semibold">
                {subscription?.plan?.name ?? "No active plan"}
              </p>
              {subscription?.current_period_end && (
                <p className="text-sm text-muted-foreground">
                  {subscription.cancel_at_period_end ? "Ends" : "Renews"} on{" "}
                  {format(new Date(subscription.current_period_end), "d MMM yyyy")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {subscription && (
                <Badge variant="secondary" className="capitalize">
                  {subscription.cancel_at_period_end ? "cancelling" : subscription.status}
                </Badge>
              )}
              {subscription && subscription.status === "active" && !subscription.cancel_at_period_end && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    cancel.mutate(subscription.id, {
                      onSuccess: () => toast.success("Cancels at the end of the period"),
                    })
                  }
                >
                  Cancel plan
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {(plans ?? []).map((plan) => {
            const current = subscription?.plan_id === plan.id && subscription.status === "active";
            return (
              <Card key={plan.id} className="flex flex-col border-border shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {plan.name}
                    {current && <Badge>Current</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div>
                    <p className="font-display text-3xl font-semibold">
                      {formatMoney(Number(plan.price), plan.currency)}
                    </p>
                    <p className="text-sm text-muted-foreground">{intervalLabel(plan.interval)}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <ul className="flex-1 space-y-1.5 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button disabled={current} onClick={() => setSelected(plan)}>
                    <CreditCard className="size-4" />
                    {current ? "Active" : "Choose plan"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-border shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="size-4" />
              Invoices & payment history
            </CardTitle>
          </CardHeader>
          <CardContent>
            {payments?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.invoice_number}</TableCell>
                      <TableCell>{format(new Date(p.created_at), "d MMM yyyy")}</TableCell>
                      <TableCell>{p.description ?? p.plan?.name ?? "Class payment"}</TableCell>
                      <TableCell>{formatMoney(Number(p.amount), p.currency)}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "paid" ? "default" : "secondary"} className="capitalize">
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {p.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setStatus.mutate(
                                { id: p.id, status: "paid" },
                                { onSuccess: () => toast.success("Invoice marked as paid") },
                              )
                            }
                          >
                            Mark paid
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                No invoices yet — choose a plan above to get started.
              </p>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Payments are in preview mode: plans, invoices and statuses are recorded in myNexClass, but no
          card is charged until a payment provider is connected.
        </p>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm “{selected?.name}”</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              {selected && formatMoney(Number(selected.price), selected.currency)}{" "}
              {selected && intervalLabel(selected.interval)} ·{" "}
              {selected?.classes_included ?? 0} classes included.
            </p>
            <p className="text-muted-foreground">
              This creates your subscription and an invoice. No card is charged in preview mode.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={confirmCheckout} disabled={checkout.isPending}>
              {checkout.isPending ? "Confirming…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
