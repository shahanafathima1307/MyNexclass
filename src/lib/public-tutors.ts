import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PublicTutor = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  subjects: string | null;
  headline: string | null;
  badge: string | null;
  languages: string | null;
  years_experience: number;
  hourly_rate: number;
  currency: string;
  rating_avg: number;
  rating_count: number;
};

/** Safe, public-facing tutor details — no contact info, no class data. */
export function usePublicTutors() {
  return useQuery({
    queryKey: ["public-tutors"],
    staleTime: 60_000,
    queryFn: async (): Promise<PublicTutor[]> => {
      const { data, error } = await supabase.rpc("public_tutor_previews");
      if (error) throw error;
      return (data ?? []) as PublicTutor[];
    },
  });
}
