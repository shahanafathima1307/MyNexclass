import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failed, ok, supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "schedule_class",
  title: "Schedule a class",
  description:
    "Create a new tutoring class between a tutor and a student. Times are given in the class time zone.",
  inputSchema: {
    title: z.string().trim().min(1).describe("Class title, e.g. 'Algebra revision'."),
    tutor_id: z.string().uuid().describe("Profile id of the tutor (from list_people)."),
    student_id: z.string().uuid().describe("Profile id of the student (from list_people)."),
    starts_at: z
      .string()
      .describe("Class start as an ISO-8601 timestamp, e.g. 2026-08-01T15:00:00Z."),
    time_zone: z.string().optional().describe("IANA time zone, e.g. Europe/London. Defaults to UTC."),
    duration_minutes: z.number().int().min(15).max(480).optional().describe("Defaults to 60."),
    subject: z.string().optional(),
    meeting_url: z.string().optional().describe("Join link for the class."),
    notes: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const when = new Date(input.starts_at);
    if (Number.isNaN(when.getTime())) return failed("starts_at is not a valid date.");

    const { data, error } = await supabaseForUser(ctx)
      .from("classes")
      .insert({
        title: input.title,
        tutor_id: input.tutor_id,
        student_id: input.student_id,
        starts_at: when.toISOString(),
        time_zone: input.time_zone ?? "UTC",
        duration_minutes: input.duration_minutes ?? 60,
        subject: input.subject ?? null,
        meeting_url: input.meeting_url ?? null,
        notes: input.notes ?? null,
        created_by: ctx.getUserId()!,
        status: "scheduled",
      })
      .select()
      .single();

    return error ? failed(error.message) : ok(data);
  },
});
