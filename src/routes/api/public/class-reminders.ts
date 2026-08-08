import { createFileRoute } from "@tanstack/react-router";

/**
 * Reminder sweep for classes starting soon. Call on a schedule (e.g. every
 * 15 minutes) with the shared secret:
 *   POST /api/public/class-reminders  with header  x-cron-secret: <CRON_SECRET>
 */
export const Route = createFileRoute("/api/public/class-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        if (!secret) {
          return Response.json({ error: "Not configured" }, { status: 503 });
        }
        if (request.headers.get("x-cron-secret") !== secret) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        try {
          const { sendDueReminders } = await import("@/lib/class-notifications.server");
          const result = await sendDueReminders(60);
          return Response.json({ ok: true, ...result });
        } catch (error) {
          console.error("class reminder sweep failed", error);
          return Response.json({ error: "Reminder sweep failed" }, { status: 500 });
        }
      },
    },
  },
});
