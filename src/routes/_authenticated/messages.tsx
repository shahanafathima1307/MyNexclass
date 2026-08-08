import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format, isToday } from "date-fns";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { displayName, useSession } from "@/lib/session";
import { useClasses, useMembers } from "@/lib/tutoring";
import {
  otherPartyId,
  useMarkThreadRead,
  useMessages,
  useRealtimeInbox,
  useSendMessage,
} from "@/lib/messaging";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: "Messages — myNexClass" },
      {
        name: "description",
        content: "Chat with your tutor or student between classes, right inside myNexClass.",
      },
      { property: "og:title", content: "Messages — myNexClass" },
      {
        property: "og:description",
        content: "Chat with your tutor or student between classes, right inside myNexClass.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { user } = useSession();
  const { data: members } = useMembers();
  const { data: classes } = useClasses(user?.id);
  const { data: messages } = useMessages(user?.id);
  const send = useSendMessage();
  const markRead = useMarkThreadRead();
  useRealtimeInbox(user?.id);

  const [active, setActive] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  /** People you share a class with, plus anyone who has messaged you. */
  const contacts = useMemo(() => {
    if (!user) return [] as { id: string; name: string }[];
    const ids = new Set<string>();
    for (const c of classes ?? []) {
      if (c.tutor_id !== user.id) ids.add(c.tutor_id);
      if (c.student_id !== user.id) ids.add(c.student_id);
    }
    for (const m of messages ?? []) ids.add(otherPartyId(m, user.id));
    return [...ids].map((id) => ({
      id,
      name: members?.find((m) => m.id === id)?.full_name || "myNexClass member",
    }));
  }, [classes, messages, members, user]);

  useEffect(() => {
    if (!active && contacts.length) setActive(contacts[0].id);
  }, [active, contacts]);

  const thread = useMemo(
    () =>
      (messages ?? []).filter(
        (m) => user && active && otherPartyId(m, user.id) === active,
      ),
    [messages, active, user],
  );

  const unreadFor = (id: string) =>
    (messages ?? []).filter((m) => m.sender_id === id && m.recipient_id === user?.id && !m.read_at)
      .length;

  useEffect(() => {
    if (!user || !active) return;
    if (unreadFor(active) > 0) markRead.mutate({ userId: user.id, otherId: active });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !active || !user) return;
    send.mutate(
      { recipientId: active, body, senderName: displayName(user) },
      { onSuccess: () => setDraft(""), onError: (err: Error) => toast.error(err.message) },
    );
  }

  return (
    <AppShell title="Messages" subtitle="Talk to your tutor or student between classes.">
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card className="border-border shadow-soft">
          <CardContent className="space-y-1 pt-6">
            {contacts.length ? (
              contacts.map((c) => {
                const unread = unreadFor(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActive(c.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-secondary",
                      active === c.id && "bg-secondary font-medium",
                    )}
                  >
                    {c.name}
                    {unread > 0 && <Badge>{unread}</Badge>}
                  </button>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">
                Once you have a class booked, your tutor or student appears here.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-[28rem] flex-col border-border shadow-soft">
          <CardContent className="flex flex-1 flex-col gap-4 pt-6">
            <div className="flex-1 space-y-3 overflow-y-auto">
              {thread.length ? (
                thread.map((m) => {
                  const mine = m.sender_id === user?.id;
                  const at = new Date(m.created_at);
                  return (
                    <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                          mine
                            ? "bg-accent text-accent-foreground"
                            : "bg-secondary text-secondary-foreground",
                        )}
                      >
                        <p className="whitespace-pre-wrap">{m.body}</p>
                        <p className="mt-1 text-[10px] opacity-70">
                          {isToday(at) ? format(at, "HH:mm") : format(at, "d MMM · HH:mm")}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">
                  No messages yet — say hello to start the conversation.
                </p>
              )}
            </div>

            <form className="flex gap-2" onSubmit={submit}>
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message…"
                maxLength={2000}
                disabled={!active}
              />
              <Button type="submit" disabled={!active || send.isPending}>
                <Send className="size-4" />
                Send
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
