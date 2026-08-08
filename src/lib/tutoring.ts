import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { AppRole } from "@/lib/session";

export type ClassRow = Tables<"classes">;
export type ProfileRow = Tables<"profiles">;
export type RecordingRow = Tables<"recordings">;

/** Contact details live in a separate, access-restricted table. */
export type ContactInfo = { contact_email: string | null; phone: string | null };

export type Member = ProfileRow &
  ContactInfo & { role: AppRole; isAdmin: boolean; canSeeContact: boolean };
export type ClassWithPeople = ClassRow & {
  tutor: Member | null;
  student: Member | null;
};


export const RECORDINGS_BUCKET = "recordings";
export const AVATARS_BUCKET = "avatars";

/** Avatar values are either an absolute URL or a path inside the private avatars bucket. */
export async function resolveAvatarUrl(value: string): Promise<string | null> {
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const { data, error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .createSignedUrl(value, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

export async function uploadAvatar(userId: string, file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return path;
}

async function fetchMembers(): Promise<Member[]> {
  const [
    { data: profiles, error: pErr },
    { data: directory, error: rErr },
    { data: adminRoles },
    { data: contacts },
  ] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    // Directory roles never expose admin grants.
    supabase.rpc("directory_roles"),
    // Only returns rows the viewer is allowed to see (own roles, or all for admins).
    supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
    // RLS limits this to the viewer, their class partners, and admins.
    supabase.from("profile_contacts").select("user_id, contact_email, phone"),
  ]);
  if (pErr) throw pErr;
  if (rErr) throw rErr;

  const baseById = new Map<string, AppRole>();
  for (const r of directory ?? []) baseById.set(r.user_id, r.role as AppRole);
  const admins = new Set((adminRoles ?? []).map((r) => r.user_id));
  const contactById = new Map((contacts ?? []).map((c) => [c.user_id, c]));

  return (profiles ?? []).map((p) => {
    const contact = contactById.get(p.id);
    return {
      ...p,
      contact_email: contact?.contact_email ?? null,
      phone: contact?.phone ?? null,
      canSeeContact: !!contact,
      role: baseById.get(p.id) ?? "student",
      isAdmin: admins.has(p.id),
    };
  });
}


export function useMembers() {
  return useQuery({ queryKey: ["members"], queryFn: fetchMembers, staleTime: 30_000 });
}

export function useMyRole(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-role", userId],
    enabled: !!userId,
    queryFn: async (): Promise<AppRole> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!);
      if (error) throw error;
      const roles = (data ?? []).map((r) => r.role as AppRole);
      if (roles.includes("admin")) return "admin";
      if (roles.includes("tutor")) return "tutor";
      return "student";
    },
  });
}

/** The tutor/student role, ignoring an extra admin grant. */
export function useMyBaseRole(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-base-role", userId],
    enabled: !!userId,
    queryFn: async (): Promise<AppRole> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .neq("role", "admin");
      if (error) throw error;
      return ((data ?? [])[0]?.role as AppRole) ?? "student";
    },
  });
}

export function useMyProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useClasses(userId: string | undefined) {
  return useQuery({
    queryKey: ["classes", userId],
    enabled: !!userId,
    queryFn: async (): Promise<ClassWithPeople[]> => {
      const [{ data: classes, error }, members] = await Promise.all([
        supabase.from("classes").select("*").order("starts_at", { ascending: true }),
        fetchMembers(),
      ]);
      if (error) throw error;
      const byId = new Map(members.map((m) => [m.id, m]));
      return (classes ?? []).map((c) => ({
        ...c,
        tutor: byId.get(c.tutor_id) ?? null,
        student: byId.get(c.student_id) ?? null,
      }));
    },
  });
}

export type NewClassInput = {
  title: string;
  subject: string | null;
  starts_at: string;
  duration_minutes: number;
  meeting_url: string | null;
  notes: string | null;
  tutor_id: string;
  student_id: string;
  time_zone: string;
  is_demo: boolean;
};

export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewClassInput) => {
      const { data, error } = await supabase
        .from("classes")
        .insert(input)
        .select("id")
        .single();
      if (error) throw error;
      // Booking confirmation (student) + booking alert (tutor). Email trouble
      // must never fail the booking itself.
      try {
        const { sendBookingEmailsFn } = await import("@/lib/class-notifications.functions");
        await sendBookingEmailsFn({ data: { classId: data.id } });
      } catch (mailError) {
        console.error("Booking emails failed", mailError);
      }
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["classes"] }),
  });
}


export function useMember(memberId: string | undefined) {
  const { data: members, ...rest } = useMembers();
  return {
    ...rest,
    data: members?.find((m) => m.id === memberId) ?? null,
    members,
  };
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<
        Pick<ProfileRow, "full_name" | "bio" | "subjects" | "avatar_url"> & ContactInfo
      >;
    }) => {
      const { contact_email, phone, ...profilePatch } = patch;
      if (Object.keys(profilePatch).length > 0) {
        const { error } = await supabase.from("profiles").update(profilePatch).eq("id", id);
        if (error) throw error;
      }
      if (contact_email !== undefined || phone !== undefined) {
        const { error } = await supabase.from("profile_contacts").upsert(
          {
            user_id: id,
            contact_email: contact_email ?? null,
            phone: phone ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["classes"] });
    },
  });
}


export function useSetMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error: delErr } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .neq("role", "admin");
      if (delErr) throw delErr;
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["my-role"] });
    },
  });
}

export function useUpdateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ClassRow> }) => {
      const { error } = await supabase.from("classes").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["classes"] }),
  });
}

export function useDeleteClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["classes"] }),
  });
}

export type RecordingWithClass = RecordingRow & { classInfo: ClassWithPeople | null };

export function useRecordings(userId: string | undefined) {
  return useQuery({
    queryKey: ["recordings", userId],
    enabled: !!userId,
    queryFn: async (): Promise<RecordingWithClass[]> => {
      const { data, error } = await supabase
        .from("recordings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, classInfo: null }));
    },
  });
}

export function useAddRecording() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      class_id: string;
      title: string;
      external_url?: string | null;
      file?: File | null;
    }) => {
      let storage_path: string | null = null;
      if (input.file) {
        const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${input.class_id}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from(RECORDINGS_BUCKET)
          .upload(path, input.file, { upsert: false });
        if (upErr) throw upErr;
        storage_path = path;
      }
      const { error } = await supabase.from("recordings").insert({
        class_id: input.class_id,
        title: input.title,
        external_url: input.external_url || null,
        storage_path,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recordings"] }),
  });
}

export function useDeleteRecording() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rec: RecordingRow) => {
      if (rec.storage_path) {
        await supabase.storage.from(RECORDINGS_BUCKET).remove([rec.storage_path]);
      }
      const { error } = await supabase.from("recordings").delete().eq("id", rec.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recordings"] }),
  });
}

export async function signedRecordingUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(RECORDINGS_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export function splitClasses(classes: ClassWithPeople[]) {
  const now = Date.now();
  const upcoming = classes
    .filter((c) => c.status === "scheduled" && new Date(c.starts_at).getTime() >= now)
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const completed = classes
    .filter(
      (c) =>
        c.status === "completed" ||
        (c.status === "scheduled" && new Date(c.starts_at).getTime() < now),
    )
    .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at));
  const cancelled = classes.filter((c) => c.status === "cancelled");
  return { upcoming, completed, cancelled, nextClass: upcoming[0] ?? null };
}
