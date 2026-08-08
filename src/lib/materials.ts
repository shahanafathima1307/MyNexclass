import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Material = Tables<"class_materials">;
export const MATERIALS_BUCKET = "materials";

export function useMaterials(classId: string | undefined) {
  return useQuery({
    queryKey: ["class-materials", classId],
    enabled: !!classId,
    queryFn: async (): Promise<Material[]> => {
      const { data, error } = await supabase
        .from("class_materials")
        .select("*")
        .eq("class_id", classId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      classId,
      title,
      notes,
      externalUrl,
      file,
    }: {
      classId: string;
      title: string;
      notes?: string;
      externalUrl?: string;
      file?: File | null;
    }) => {
      let storagePath: string | null = null;
      if (file) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${classId}/${crypto.randomUUID()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from(MATERIALS_BUCKET)
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        storagePath = path;
      }
      const { error } = await supabase.from("class_materials").insert({
        class_id: classId,
        title,
        notes: notes || null,
        external_url: externalUrl || null,
        storage_path: storagePath,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["class-materials"] }),
  });
}

export function useDeleteMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Material) => {
      if (item.storage_path) {
        await supabase.storage.from(MATERIALS_BUCKET).remove([item.storage_path]);
      }
      const { error } = await supabase.from("class_materials").delete().eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["class-materials"] }),
  });
}

export async function materialFileUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(MATERIALS_BUCKET)
    .createSignedUrl(path, 60 * 30);
  if (error) throw error;
  return data.signedUrl;
}
