import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Message = Tables<"messages">;
export type Notification = Tables<"notifications">;

/** Every message the signed-in user has sent or received, newest last. */
export function useMessages(userId: string | undefined) {
  return useQuery({
    queryKey: ["messages", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Message[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      recipientId,
      body,
      senderName,
    }: {
      recipientId: string;
      body: string;
      senderName: string;
    }) => {
      const { error } = await supabase
        .from("messages")
        .insert({ recipient_id: recipientId, body });
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: recipientId,
        title: `New message from ${senderName}`,
        body: body.slice(0, 140),
        link: "/messages",
        kind: "message",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });
}

export function useMarkThreadRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, otherId }: { userId: string; otherId: string }) => {
      const { error } = await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_id", userId)
        .eq("sender_id", otherId)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });
}

export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Notification[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMarkNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids }: { ids: string[] }) => {
      if (!ids.length) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

/** Keeps messages and notifications fresh while the user is on the page. */
export function useRealtimeInbox(userId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`inbox:${userId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["messages"] });
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}

export async function notify(input: {
  userId: string;
  title: string;
  body?: string;
  link?: string;
  kind?: string;
}) {
  await supabase.from("notifications").insert({
    user_id: input.userId,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
    kind: input.kind ?? "info",
  });
}

export function otherPartyId(message: Message, userId: string) {
  return message.sender_id === userId ? message.recipient_id : message.sender_id;
}
