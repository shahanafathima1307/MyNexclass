import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failed, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_people",
  title: "List tutors and students",
  description:
    "List myNexClass members visible to the signed-in user, with their role, subjects and contact details.",
  inputSchema: {
    role: z.enum(["tutor", "student", "any"]).optional().describe("Filter by role. Defaults to any."),
    search: z.string().optional().describe("Case-insensitive name filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ role, search }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);

    let query = supabase
      .from("profiles")
      .select("id, full_name, subjects, bio")
      .order("full_name");
    if (search) query = query.ilike("full_name", `%${search}%`);

    const [
      { data: profiles, error },
      { data: roles, error: rErr },
      { data: adminRoles },
      { data: contacts },
    ] = await Promise.all([
      query,
      supabase.rpc("directory_roles"),
      supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
      supabase.from("profile_contacts").select("user_id, contact_email, phone"),
    ]);
    if (error) return failed(error.message);
    if (rErr) return failed(rErr.message);

    const rolesById = new Map<string, string>();
    for (const r of roles ?? []) rolesById.set(r.user_id, r.role as string);
    const admins = new Set((adminRoles ?? []).map((r) => r.user_id));
    const contactById = new Map((contacts ?? []).map((c) => [c.user_id, c]));

    const rows = (profiles ?? []).map((p) => {
      const contact = contactById.get(p.id);
      return {
        ...p,
        contact_email: contact?.contact_email ?? null,
        phone: contact?.phone ?? null,
        role: rolesById.get(p.id) === "tutor" ? "tutor" : "student",
        is_admin: admins.has(p.id),
      };
    });

    return ok(role && role !== "any" ? rows.filter((r) => r.role === role) : rows);
  },
});
