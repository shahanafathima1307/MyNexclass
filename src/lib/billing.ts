import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Plan = Tables<"plans">;
export type Subscription = Tables<"subscriptions">;
export type Payment = Tables<"payments">;
export type SubscriptionWithPlan = Subscription & { plan: Plan | null };
export type PaymentWithPlan = Payment & { plan: Plan | null };

export function formatMoney(amount: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function intervalLabel(interval: Plan["interval"]) {
  if (interval === "monthly") return "per month";
  if (interval === "yearly") return "per year";
  return "one-off";
}

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: async (): Promise<Plan[]> => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMySubscription(userId: string | undefined) {
  return useQuery({
    queryKey: ["subscription", userId],
    enabled: !!userId,
    queryFn: async (): Promise<SubscriptionWithPlan | null> => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, plan:plans(*)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as SubscriptionWithPlan | null) ?? null;
    },
  });
}

/** Demo checkout: records a subscription and a paid invoice, no money moves. */
export function useCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ plan, userId }: { plan: Plan; userId: string }) => {
      await supabase
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("user_id", userId)
        .eq("status", "active");

      const periodEnd = new Date();
      if (plan.interval === "monthly") periodEnd.setMonth(periodEnd.getMonth() + 1);
      if (plan.interval === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);

      if (plan.interval !== "one_time") {
        const { error } = await supabase.from("subscriptions").insert({
          user_id: userId,
          plan_id: plan.id,
          status: "active",
          current_period_end: periodEnd.toISOString(),
        });
        if (error) throw error;
      }

      const { error: payErr } = await supabase.from("payments").insert({
        user_id: userId,
        plan_id: plan.id,
        amount: plan.price,
        currency: plan.currency,
        status: plan.price === 0 ? "paid" : "pending",
        description: `${plan.name} plan`,
      });
      if (payErr) throw payErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscription"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("subscriptions")
        .update({ cancel_at_period_end: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscription"] }),
  });
}

export function usePayments(userId: string | undefined, all = false) {
  return useQuery({
    queryKey: ["payments", all ? "all" : userId],
    enabled: all || !!userId,
    queryFn: async (): Promise<PaymentWithPlan[]> => {
      let query = supabase
        .from("payments")
        .select("*, plan:plans(*)")
        .order("created_at", { ascending: false });
      if (!all) query = query.eq("user_id", userId!);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PaymentWithPlan[];
    },
  });
}

/** Demo settle: flips a pending invoice to paid without a real provider. */
export function useSetPaymentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Payment["status"] }) => {
      const { error } = await supabase
        .from("payments")
        .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments"] }),
  });
}
