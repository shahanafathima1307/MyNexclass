import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { myAccessFn } from "@/lib/access.functions";

/** The only protected path an unapproved member may open. */
const PENDING_PATH = "/approval-status";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) throw redirect({ to: "/auth" });
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Server-checked approval state — cannot be faked from the browser.
    const access = await myAccessFn();
    if (!access.approved && !location.pathname.startsWith(PENDING_PATH)) {
      throw redirect({ to: PENDING_PATH });
    }

    return { user: data.user, access };
  },
  component: () => <Outlet />,
});
