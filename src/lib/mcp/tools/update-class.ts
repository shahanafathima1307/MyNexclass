import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failed, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "update_class",
  title: "Update a class",
  description:
    "Update an existing class: change its meeting link, time, time zone, notes or status (scheduled/completed/cancelled).",
  inputSchema: {
    class_id: z.string().uuid().describe("Id of the class to update (from list_classes)."),
    meeting_url: z.string().optional().describe("New join link."),
    starts_at: z.string().optional().describe("New start time as ISO-8601."),
    time_zone: z.string().optional().describe("IANA time zone, e.g. Asia/Kolkata."),
    duration_minutes: z.number().int().min(15).max(480).optional(),
    status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
    notes: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ class_id, ...rest }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();

    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) patch[key] = value;
    }
    if (typeof patch.starts_at === "string") {
      const when = new Date(patch.starts_at);
      if (Number.isNaN(when.getTime())) return failed("starts_at is not a valid date.");
      patch.starts_at = when.toISOString();
    }
    if (Object.keys(patch).length === 0) return failed("Nothing to update.");

    const { data, error } = await supabaseForUser(ctx)
      .from("classes")
      .update(patch)
      .eq("id", class_id)
      .select()
      .single();

    return error ? failed(error.message) : ok(data);
  },
});
