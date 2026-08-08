import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Member } from "@/lib/tutoring";

export type ParticipantRow = Tables<"class_participants">;
export type AttendanceRow = Tables<"class_attendance">;

export type Participant = ParticipantRow & { member: Member | null };
export type AttendanceEntry = AttendanceRow & { member: Member | null };

/** Extra students added to a class on top of the main student. */
export function useClassParticipants(classId: string | undefined, members?: Member[]) {
  return useQuery({
    queryKey: ["class-participants", classId],
    enabled: !!classId,
    queryFn: async (): Promise<Participant[]> => {
      const { data, error } = await supabase
        .from("class_participants")
        .select("*")
        .eq("class_id", classId!)
        .order("created_at");
      if (error) throw error;
      const byId = new Map((members ?? []).map((m) => [m.id, m]));
      return (data ?? []).map((row) => ({ ...row, member: byId.get(row.user_id) ?? null }));
    },
  });
}

/** Participant counts for many classes at once, for list badges. */
export function useParticipantCounts(classIds: string[]) {
  const key = [...classIds].sort().join(",");
  return useQuery({
    queryKey: ["class-participant-counts", key],
    enabled: classIds.length > 0,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("class_participants")
        .select("class_id")
        .in("class_id", classIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) counts[row.class_id] = (counts[row.class_id] ?? 0) + 1;
      return counts;
    },
  });
}

export function useAddParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ classId, userId }: { classId: string; userId: string }) => {
      const { error } = await supabase
        .from("class_participants")
        .insert({ class_id: classId, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["class-participants"] });
      qc.invalidateQueries({ queryKey: ["class-participant-counts"] });
    },
  });
}

export function useRemoveParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("class_participants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["class-participants"] });
      qc.invalidateQueries({ queryKey: ["class-participant-counts"] });
    },
  });
}

/** Join/leave records captured by the live class room. */
export function useClassAttendance(classId: string | undefined, members?: Member[]) {
  return useQuery({
    queryKey: ["class-attendance", classId],
    enabled: !!classId,
    queryFn: async (): Promise<AttendanceEntry[]> => {
      const { data, error } = await supabase
        .from("class_attendance")
        .select("*")
        .eq("class_id", classId!)
        .order("joined_at", { ascending: false });
      if (error) throw error;
      const byId = new Map((members ?? []).map((m) => [m.id, m]));
      return (data ?? []).map((row) => ({ ...row, member: byId.get(row.user_id) ?? null }));
    },
  });
}

export async function markAttendanceJoin(classId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("class_attendance")
    .insert({ class_id: classId })
    .select("id")
    .maybeSingle();
  if (error) return null;
  return data?.id ?? null;
}

export async function markAttendanceLeave(attendanceId: string | null) {
  if (!attendanceId) return;
  await supabase
    .from("class_attendance")
    .update({ left_at: new Date().toISOString() })
    .eq("id", attendanceId);
}

export function formatDuration(from: string, to: string | null) {
  if (!to) return "still in room";
  const mins = Math.max(1, Math.round((+new Date(to) - +new Date(from)) / 60000));
  return `${mins} min`;
}
