import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type LoopRequest = Tables<"loop_requests">;

/** Requests the viewer can see: their own, plus every open one when they're a tutor. */
export function useLoopRequests(userId: string | undefined) {
  return useQuery({
    queryKey: ["loop-requests", userId],
    enabled: !!userId,
    queryFn: async (): Promise<LoopRequest[]> => {
      const { data, error } = await supabase
        .from("loop_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Live updates so tutors see new requests and students see an acceptance instantly. */
export function useLoopRealtime(userId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`loop:${userId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "loop_requests" }, () => {
        qc.invalidateQueries({ queryKey: ["loop-requests"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}

export type NewLoopRequest = {
  student_id: string;
  subject: string;
  grade_level?: string | null;
  topic?: string | null;
  duration_minutes: number;
  start_mode: "now" | "later";
  preferred_start?: string | null;
  notes?: string | null;
  /** Minutes before the request auto-expires if no tutor accepts. */
  timeout_minutes: number;
};

export function useCreateLoopRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewLoopRequest) => {
      const expires = new Date(Date.now() + input.timeout_minutes * 60_000).toISOString();
      const { data, error } = await supabase
        .from("loop_requests")
        .insert({
          student_id: input.student_id,
          subject: input.subject,
          grade_level: input.grade_level || null,
          topic: input.topic || null,
          duration_minutes: input.duration_minutes,
          start_mode: input.start_mode,
          preferred_start: input.preferred_start || null,
          notes: input.notes || null,
          expires_at: expires,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loop-requests"] }),
  });
}

/** First tutor to call this wins; a second caller gets an error. */
export function useAcceptLoopRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase.rpc("claim_loop_request", {
        _request_id: requestId,
      });
      if (error) throw error;
      return data as unknown as LoopRequest;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loop-requests"] }),
  });
}

export function useCancelLoopRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("loop_requests")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loop-requests"] }),
  });
}

export function useRateLoopRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      rating,
      comment,
    }: {
      id: string;
      rating: number;
      comment?: string;
    }) => {
      const { error } = await supabase
        .from("loop_requests")
        .update({ rating, rating_comment: comment || null, status: "completed" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loop-requests"] }),
  });
}

export function isExpired(request: LoopRequest) {
  return request.status === "open" && new Date(request.expires_at).getTime() < Date.now();
}

/** Rough wait estimate from how quickly recent requests were picked up. */
export function estimateWaitMinutes(requests: LoopRequest[]) {
  const matched = requests.filter((r) => r.accepted_at);
  if (matched.length === 0) return null;
  const total = matched.reduce(
    (sum, r) => sum + (+new Date(r.accepted_at!) - +new Date(r.created_at)) / 60_000,
    0,
  );
  return Math.max(1, Math.round(total / matched.length));
}
