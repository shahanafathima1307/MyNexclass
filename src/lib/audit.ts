import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AuditEntry = Tables<"audit_log">;

export function useAuditLog(enabled: boolean) {
  return useQuery({
    queryKey: ["audit-log"],
    enabled,
    queryFn: async (): Promise<AuditEntry[]> => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export async function logAudit(input: {
  action: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, unknown>;
}) {
  await supabase.from("audit_log").insert({
    action: input.action,
    entity: input.entity ?? null,
    entity_id: input.entityId ?? null,
    details: (input.details ?? {}) as never,
  });
}
