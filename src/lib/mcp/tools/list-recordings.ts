import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failed, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_recordings",
  title: "List class recordings",
  description:
    "List lesson recordings the signed-in user can access, optionally for one class. Stored files return a temporary playback link.",
  inputSchema: {
    class_id: z.string().uuid().optional().describe("Only recordings for this class."),
    limit: z.number().int().min(1).max(50).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ class_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);

    let query = supabase
      .from("recordings")
      .select("id, class_id, title, duration_label, external_url, storage_path, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (class_id) query = query.eq("class_id", class_id);

    const { data, error } = await query;
    if (error) return failed(error.message);

    const rows = await Promise.all(
      (data ?? []).map(async (r) => {
        let url = r.external_url;
        if (!url && r.storage_path) {
          const signed = await supabase.storage
            .from("recordings")
            .createSignedUrl(r.storage_path, 60 * 60);
          url = signed.data?.signedUrl ?? null;
        }
        return {
          id: r.id,
          class_id: r.class_id,
          title: r.title,
          duration_label: r.duration_label,
          created_at: r.created_at,
          watch_url: url,
        };
      }),
    );

    return ok(rows);
  },
});
