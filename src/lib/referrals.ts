import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ReferralSettings = Tables<"referral_settings">;
export type ReferralCode = Tables<"referral_codes">;
export type Referral = Tables<"referrals">;
export type ReferralReward = Tables<"referral_rewards">;

const PENDING_KEY = "mnc.referral.code";

function makeCode(seed: string) {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${seed.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase() || "NEX"}${out}`;
}

export function referralLink(code: string) {
  if (typeof window === "undefined") return `https://mynexclass.lovable.app/auth?ref=${code}`;
  return `${window.location.origin}/auth?ref=${code}`;
}

/** Capture ?ref=CODE from the URL so it survives until the user signs in. */
export function useCaptureReferralParam() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const code = new URLSearchParams(window.location.search).get("ref");
    if (code && /^[A-Za-z0-9]{4,16}$/.test(code)) {
      window.localStorage.setItem(PENDING_KEY, code.toUpperCase());
    }
  }, []);
}

export function useReferralSettings() {
  return useQuery({
    queryKey: ["referral-settings"],
    queryFn: async (): Promise<ReferralSettings | null> => {
      const { data, error } = await supabase.from("referral_settings").select("*").maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useSaveReferralSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<ReferralSettings>) => {
      const { error } = await supabase
        .from("referral_settings")
        .update(values)
        .eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["referral-settings"] }),
  });
}

/** Returns the user's code, creating one on first use. */
export function useMyReferralCode(userId: string | undefined, displayName?: string) {
  return useQuery({
    queryKey: ["referral-code", userId],
    enabled: !!userId,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase
        .from("referral_codes")
        .select("code")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      if (data?.code) return data.code;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const code = makeCode(displayName ?? "NEX");
        const { error: insErr } = await supabase
          .from("referral_codes")
          .insert({ user_id: userId!, code });
        if (!insErr) return code;
        if (insErr.code !== "23505") throw insErr;
        const { data: mine } = await supabase
          .from("referral_codes")
          .select("code")
          .eq("user_id", userId!)
          .maybeSingle();
        if (mine?.code) return mine.code;
      }
      throw new Error("Could not create a referral code");
    },
  });
}

/** Referrals where I am the inviter. */
export function useMyReferrals(userId: string | undefined) {
  return useQuery({
    queryKey: ["referrals", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Referral[]> => {
      const { data, error } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAllReferrals(enabled: boolean) {
  return useQuery({
    queryKey: ["referrals", "all"],
    enabled,
    queryFn: async (): Promise<Referral[]> => {
      const { data, error } = await supabase
        .from("referrals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMyRewards(userId: string | undefined) {
  return useQuery({
    queryKey: ["referral-rewards", userId],
    enabled: !!userId,
    queryFn: async (): Promise<ReferralReward[]> => {
      const { data, error } = await supabase
        .from("referral_rewards")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Claims a stored referral code once the user is signed in. Runs at most once per user. */
export function useClaimPendingReferral(userId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    const code = window.localStorage.getItem(PENDING_KEY);
    if (!code) return;

    let cancelled = false;
    (async () => {
      try {
        const { data: existing } = await supabase
          .from("referrals")
          .select("id")
          .eq("referred_id", userId)
          .maybeSingle();
        if (existing) {
          window.localStorage.removeItem(PENDING_KEY);
          return;
        }
        const { data: referrerId, error } = await supabase.rpc("resolve_referral_code", {
          _code: code,
        });
        if (error || !referrerId || referrerId === userId) {
          window.localStorage.removeItem(PENDING_KEY);
          return;
        }
        await supabase
          .from("referrals")
          .insert({ referrer_id: referrerId, referred_id: userId, code });
        window.localStorage.removeItem(PENDING_KEY);
        if (!cancelled) qc.invalidateQueries({ queryKey: ["referrals"] });
      } catch {
        window.localStorage.removeItem(PENDING_KEY);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, qc]);
}

/** Admin: approve a referral and issue rewards to both sides. */
export function useApproveReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      referral,
      settings,
    }: {
      referral: Referral;
      settings: ReferralSettings;
    }) => {
      const rows = [
        {
          user_id: referral.referrer_id,
          referral_id: referral.id,
          amount: settings.referrer_reward,
          currency: settings.currency,
          note: "Referral reward",
        },
        {
          user_id: referral.referred_id,
          referral_id: referral.id,
          amount: settings.referee_reward,
          currency: settings.currency,
          note: "Welcome reward",
        },
      ].filter((r) => Number(r.amount) > 0);

      if (rows.length) {
        const { error } = await supabase.from("referral_rewards").insert(rows);
        if (error) throw error;
      }
      const { error: updErr } = await supabase
        .from("referrals")
        .update({ status: "rewarded", qualified_at: new Date().toISOString() })
        .eq("id", referral.id);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["referrals"] });
      qc.invalidateQueries({ queryKey: ["referral-rewards"] });
    },
  });
}

export function useRejectReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("referrals")
        .update({ status: "rejected" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["referrals"] }),
  });
}
