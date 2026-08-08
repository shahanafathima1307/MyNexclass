import { createFileRoute, Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSession } from "@/lib/session";
import {
  useDeleteNotification,
  useMarkNotifications,
  useNotifications,
  useRealtimeInbox,
} from "@/lib/messaging";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — myNexClass" },
      {
        name: "description",
        content: "Class updates, messages and payout alerts collected in one place.",
      },
      { property: "og:title", content: "Notifications — myNexClass" },
      {
        property: "og:description",
        content: "Class updates, messages and payout alerts collected in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useSession();
  const { data: items } = useNotifications(user?.id);
  const mark = useMarkNotifications();
  const remove = useDeleteNotification();
  useRealtimeInbox(user?.id);

  const unread = (items ?? []).filter((n) => !n.read_at);

  return (
    <AppShell
      title="Notifications"
      subtitle="Everything that happened while you were away."
      actions={
        unread.length > 0 ? (
          <Button
            variant="outline"
            onClick={() => mark.mutate({ ids: unread.map((n) => n.id) })}
            disabled={mark.isPending}
          >
            <CheckCheck className="size-4" />
            Mark all read
          </Button>
        ) : undefined
      }
    >
      <div className="grid gap-3">
        {items?.length ? (
          items.map((n) => (
            <Card
              key={n.id}
              className={cn("border-border shadow-soft", !n.read_at && "border-accent")}
            >
              <CardContent className="flex flex-wrap items-start gap-4 pt-6">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary">
                  <Bell className="size-4" />
                </span>
                <div className="min-w-48 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{n.title}</p>
                    {!n.read_at && <Badge>New</Badge>}
                    <Badge variant="outline" className="capitalize">
                      {n.kind}
                    </Badge>
                  </div>
                  {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {n.link && (
                    <Button size="sm" variant="outline" asChild>
                      <Link to={n.link}>Open</Link>
                    </Button>
                  )}
                  {!n.read_at && (
                    <Button size="sm" variant="ghost" onClick={() => mark.mutate({ ids: [n.id] })}>
                      Mark read
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Delete notification"
                    onClick={() => remove.mutate(n.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border-border shadow-soft">
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Nothing here yet — class updates, messages and payout alerts will show up on this
              page.
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
