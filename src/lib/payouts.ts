import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PayoutAccount = Tables<"payout_accounts">;
export type PayoutRequest = Tables<"payout_requests">;

export function usePayoutAccount(userId: string | undefined) {
  return useQuery({
    queryKey: ["payout-account", userId],
    enabled: !!userId,
    queryFn: async (): Promise<PayoutAccount | null> => {
      const { data, error } = await supabase
        .from("payout_accounts")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useSavePayoutAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<PayoutAccount> & { user_id: string }) => {
      const { error } = await supabase.from("payout_accounts").upsert(values);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payout-account"] }),
  });
}

export function usePayoutRequests(tutorId: string | undefined, all = false) {
  return useQuery({
    queryKey: ["payout-requests", all ? "all" : tutorId],
    enabled: all || !!tutorId,
    queryFn: async (): Promise<PayoutRequest[]> => {
      let query = supabase
        .from("payout_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (!all) query = query.eq("tutor_id", tutorId!);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRequestPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      amount,
      currency,
      note,
    }: {
      amount: number;
      currency: string;
      note?: string;
    }) => {
      const { error } = await supabase
        .from("payout_requests")
        .insert({ amount, currency, note: note || null });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payout-requests"] }),
  });
}

export function useSetPayoutStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PayoutRequest["status"] }) => {
      const { error } = await supabase
        .from("payout_requests")
        .update({
          status,
          processed_at: status === "requested" ? null : new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payout-requests"] }),
  });
}

export function useCancelPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payout_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payout-requests"] }),
  });
}
