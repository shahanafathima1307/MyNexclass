import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSession, type AppRole } from "@/lib/session";
import { ProfileAvatar } from "@/components/profile-avatar";
import {
  type Member,
  uploadAvatar,
  useMembers,
  useMyRole,
  useSetMemberRole,
  useUpdateProfile,
} from "@/lib/tutoring";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Tutor manager — myNexClass" },
      {
        name: "description",
        content:
          "Admin tools to manage myNexClass tutors: edit profiles, subjects, bios and member roles.",
      },
      { property: "og:title", content: "Tutor manager — myNexClass" },
      { property: "og:description", content: "Admin tools for managing tutors and member roles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Name is too short").max(120),
  subjects: z.string().trim().max(200).optional(),
  bio: z.string().trim().max(1000).optional(),
  contact_email: z
    .string()
    .trim()
    .email("Contact email must be a valid email")
    .max(200)
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  avatar_url: z.string().trim().max(500).optional(),
});

/** Tutors and admins must always have a reachable email and mobile number on file. */
const contactRequiredSchema = profileSchema.extend({
  contact_email: z.string().trim().email("Contact email is required for tutors and admins").max(200),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((v) => v.replace(/\D/g, "").length >= 7, "Mobile number is required for tutors and admins"),
});


function AdminPage() {
  const { user } = useSession();
  const { data: role, isLoading: roleLoading } = useMyRole(user?.id);
  const { data: members, isLoading } = useMembers();
  const setRole = useSetMemberRole();
  const updateProfile = useUpdateProfile();
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    subjects: "",
    bio: "",
    avatar_url: "",
    contact_email: "",
    phone: "",
  });
  const [uploading, setUploading] = useState(false);

  const tutors = useMemo(() => (members ?? []).filter((m) => m.role === "tutor"), [members]);
  const others = useMemo(() => (members ?? []).filter((m) => m.role !== "tutor"), [members]);

  if (roleLoading) {
    return (
      <AppShell title="Tutor manager">
        <Skeleton className="h-40 w-full" />
      </AppShell>
    );
  }

  if (role !== "admin") {
    return (
      <AppShell title="Tutor manager" subtitle="Admins only">
        <p className="text-sm text-muted-foreground">
          You need an admin role to manage tutors. Ask an admin to grant you access.
        </p>
      </AppShell>
    );
  }

  function openEdit(m: Member) {
    setEditing(m);
    setForm({
      full_name: m.full_name ?? "",
      subjects: m.subjects ?? "",
      bio: m.bio ?? "",
      avatar_url: m.avatar_url ?? "",
      contact_email: m.contact_email ?? "",
      phone: m.phone ?? "",
    });
  }

  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const contactRequired = editing?.role === "tutor" || editing?.role === "admin";
    const parsed = (contactRequired ? contactRequiredSchema : profileSchema).safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    const v = parsed.data;
    updateProfile.mutate(
      {
        id: editing!.id,
        patch: {
          full_name: v.full_name,
          subjects: v.subjects || null,
          bio: v.bio || null,
          avatar_url: v.avatar_url || null,
          contact_email: v.contact_email || null,
          phone: v.phone || null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Profile updated");
          setEditing(null);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  function changeRole(m: Member, next: AppRole) {
    setRole.mutate(
      { userId: m.id, role: next },
      {
        onSuccess: () => toast.success(`${m.full_name || "Member"} is now a ${next}`),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  function MemberRow({ m }: { m: Member }) {
    return (
      <Card className="shadow-soft">
        <CardContent className="flex flex-wrap items-center gap-4 pt-6">
          <ProfileAvatar name={m.full_name} avatarUrl={m.avatar_url} />
          <div className="min-w-40 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{m.full_name || "Unnamed member"}</p>
              {m.isAdmin && (
                <Badge variant="outline" className="gap-1">
                  <ShieldCheck className="size-3" />
                  admin
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {m.subjects || "No subjects set"} · {m.bio ? "bio added" : "no bio"}
            </p>
            <p className="text-sm text-muted-foreground">
              {m.contact_email || "no email"} · {m.phone || "no phone"}
            </p>
          </div>
          <Select value={m.role} onValueChange={(v) => changeRole(m, v as AppRole)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tutor">Tutor</SelectItem>
              <SelectItem value="student">Student</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => openEdit(m)}>
            <UserCog className="size-4" />
            Edit profile
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <AppShell
      title="Tutor manager"
      subtitle="Add tutors by promoting members, and keep their profiles sharp."
    >
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Tutors ({tutors.length})</h2>
            {tutors.length ? (
              tutors.map((m) => <MemberRow key={m.id} m={m} />)
            ) : (
              <p className="text-sm text-muted-foreground">
                No tutors yet — promote a member below.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Other members ({others.length})</h2>
            {others.map((m) => (
              <MemberRow key={m.id} m={m} />
            ))}
          </section>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {editing?.full_name || "member"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveProfile}>
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                maxLength={120}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subjects">Subjects</Label>
              <Input
                id="subjects"
                value={form.subjects}
                onChange={(e) => setForm({ ...form, subjects: e.target.value })}
                placeholder="Maths, Physics"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Experience, teaching style, availability…"
                maxLength={1000}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact_email">
                  Contact email
                  {(editing?.role === "tutor" || editing?.role === "admin") ? " (required)" : ""}
                </Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                  placeholder="tutor@example.com"
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">
                  Mobile number
                  {(editing?.role === "tutor" || editing?.role === "admin") ? " (required)" : ""}
                </Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+44 7700 900123"
                  maxLength={40}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatar_file">Profile picture</Label>
              <div className="flex items-center gap-3">
                <ProfileAvatar
                  name={form.full_name}
                  avatarUrl={form.avatar_url || null}
                  className="size-14"
                />
                <div className="flex-1 space-y-2">
                  <Input
                    id="avatar_file"
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !editing) return;
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error("Pick an image under 5MB");
                        return;
                      }
                      setUploading(true);
                      try {
                        const path = await uploadAvatar(editing.id, file);
                        setForm((f) => ({ ...f, avatar_url: path }));
                        toast.success("Picture uploaded — save to apply");
                      } catch (error) {
                        toast.error((error as Error).message);
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />
                  {form.avatar_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm({ ...form, avatar_url: "" })}
                    >
                      Remove picture
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? "Saving…" : "Save profile"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
