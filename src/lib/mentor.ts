import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { ClassWithPeople } from "@/lib/tutoring";

export type TutorDetails = Tables<"tutor_details">;
export type AvailabilitySlot = Tables<"tutor_availability">;
export type ClassFeedback = Tables<"class_feedback">;
export type ClassRequest = Tables<"class_requests">;
export type TutorRating = Tables<"tutor_ratings">;

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/* ---------------------------------- details --------------------------------- */

export function useTutorDetails(tutorId: string | undefined) {
  return useQuery({
    queryKey: ["tutor-details", tutorId],
    enabled: !!tutorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_details")
        .select("*")
        .eq("user_id", tutorId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveTutorDetails() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tutorId,
      patch,
    }: {
      tutorId: string;
      patch: Partial<
        Pick<
          TutorDetails,
          "headline" | "badge" | "degree" | "languages" | "years_experience" | "hourly_rate" | "currency"
        >
      >;
    }) => {
      const { error } = await supabase
        .from("tutor_details")
        .upsert({ user_id: tutorId, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tutor-details"] }),
  });
}

/* -------------------------------- availability ------------------------------- */

export function useAvailability(tutorId: string | undefined) {
  return useQuery({
    queryKey: ["availability", tutorId],
    enabled: !!tutorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_availability")
        .select("*")
        .eq("tutor_id", tutorId!)
        .order("weekday")
        .order("start_time");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slot: {
      tutor_id: string;
      weekday: number;
      start_time: string;
      end_time: string;
      time_zone: string;
    }) => {
      const { error } = await supabase.from("tutor_availability").insert(slot);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["availability"] }),
  });
}

export function useDeleteSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tutor_availability").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["availability"] }),
  });
}

/* --------------------------------- feedback ---------------------------------- */

export function useClassFeedback() {
  return useQuery({
    queryKey: ["class-feedback"],
    queryFn: async () => {
      const { data, error } = await supabase.from("class_feedback").select("*");
      if (error) throw error;
      return new Map((data ?? []).map((f) => [f.class_id, f]));
    },
  });
}

export function useSaveFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      class_id: string;
      topic_covered: string | null;
      homework: string | null;
      note_to_parent: string | null;
    }) => {
      const { error } = await supabase
        .from("class_feedback")
        .upsert(input, { onConflict: "class_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["class-feedback"] }),
  });
}

/* ------------------------------- loop requests -------------------------------- */

export function useLoopRequests(tutorId: string | undefined) {
  return useQuery({
    queryKey: ["loop-requests", tutorId],
    enabled: !!tutorId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSetRequestStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "declined" }) => {
      const { error } = await supabase.from("class_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loop-requests"] }),
  });
}

/* ---------------------------------- ratings ----------------------------------- */

export function useTutorRatings(tutorId: string | undefined) {
  return useQuery({
    queryKey: ["tutor-ratings", tutorId],
    enabled: !!tutorId,
    queryFn: async () => {
      // Anonymous review feed — reviewer identity never leaves the database.
      const { data, error } = await supabase.rpc("tutor_reviews", { _tutor_id: tutorId! });
      if (error) throw error;
      const rows = data ?? [];
      const average = rows.length
        ? rows.reduce((sum, r) => sum + r.rating, 0) / rows.length
        : null;
      return { rows, average, count: rows.length };
    },
  });
}

/* ----------------------------------- stats ------------------------------------ */

export type MentorStats = {
  totalSessions: number;
  totalDemos: number;
  convertedDemos: number;
  conversionRate: number | null;
  studentsTaught: number;
  hoursTaught: number;
  earnings: number;
  today: ClassWithPeople[];
  upcoming: ClassWithPeople[];
  awaitingFeedback: ClassWithPeople[];
};

/** Everything the mentor portal shows is derived from the tutor's own classes. */
export function mentorStats(
  classes: ClassWithPeople[],
  tutorId: string,
  hourlyRate: number,
  feedback: Map<string, ClassFeedback> | undefined,
): MentorStats {
  const mine = classes.filter((c) => c.tutor_id === tutorId);
  const now = Date.now();
  const isDone = (c: ClassWithPeople) =>
    c.status === "completed" || (c.status === "scheduled" && +new Date(c.starts_at) < now);

  const done = mine.filter(isDone);
  const demos = mine.filter((c) => c.is_demo);
  // A demo counts as converted once that student also has a non-demo class with this tutor.
  const regularStudents = new Set(mine.filter((c) => !c.is_demo).map((c) => c.student_id));
  const convertedDemos = new Set(
    demos.filter((c) => regularStudents.has(c.student_id)).map((c) => c.student_id),
  ).size;

  const hoursTaught = done.reduce((sum, c) => sum + c.duration_minutes / 60, 0);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  return {
    totalSessions: done.length,
    totalDemos: demos.length,
    convertedDemos,
    conversionRate: demos.length ? (convertedDemos / demos.length) * 100 : null,
    studentsTaught: new Set(mine.map((c) => c.student_id)).size,
    hoursTaught,
    earnings: hoursTaught * hourlyRate,
    today: mine
      .filter(
        (c) =>
          c.status !== "cancelled" &&
          +new Date(c.starts_at) >= +startOfDay &&
          +new Date(c.starts_at) < +endOfDay,
      )
      .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)),
    upcoming: mine
      .filter((c) => c.status === "scheduled" && +new Date(c.starts_at) >= now)
      .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)),
    awaitingFeedback: done
      .filter((c) => !feedback?.has(c.id))
      .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at)),
  };
}

/* ------------------------- student-side counterparts -------------------------- */

export function useMyRatingFor(tutorId: string | undefined, studentId: string | undefined) {
  return useQuery({
    queryKey: ["my-rating", tutorId, studentId],
    enabled: !!tutorId && !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_ratings")
        .select("*")
        .eq("tutor_id", tutorId!)
        .eq("student_id", studentId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useRateTutor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tutor_id: string; rating: number; comment: string | null }) => {
      const { error } = await supabase
        .from("tutor_ratings")
        .upsert(input, { onConflict: "tutor_id,student_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tutor-ratings"] });
      qc.invalidateQueries({ queryKey: ["my-rating"] });
    },
  });
}

export function useCreateLoopRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      tutor_id: string;
      student_id: string;
      subject: string | null;
      message: string | null;
      preferred_time: string | null;
    }) => {
      const { error } = await supabase.from("class_requests").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loop-requests"] }),
  });
}
