import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failed, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_classes",
  title: "List classes",
  description:
    "List the signed-in user's tutoring classes (upcoming or past), with time, time zone, status and meeting link.",
  inputSchema: {
    status: z
      .enum(["scheduled", "completed", "cancelled", "any"])
      .optional()
      .describe("Filter by class status. Defaults to any."),
    limit: z.number().int().min(1).max(50).optional().describe("Max classes to return (max 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("classes")
      .select("id, title, subject, starts_at, time_zone, duration_minutes, status, meeting_url, notes, tutor_id, student_id")
      .order("starts_at", { ascending: false })
      .limit(limit ?? 20);
    if (status && status !== "any") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return failed(error.message);

    const ids = [...new Set((data ?? []).flatMap((c) => [c.tutor_id, c.student_id]))];
    const { data: people } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));

    return ok(
      (data ?? []).map((c) => ({
        ...c,
        tutor_name: nameById.get(c.tutor_id) ?? null,
        student_name: nameById.get(c.student_id) ?? null,
      })),
    );
  },
});
