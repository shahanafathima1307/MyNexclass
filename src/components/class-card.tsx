import { useState } from "react";
import { format } from "date-fns";
import {
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Link2,
  Mail,
  Trash2,
  Video,
  XCircle,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { type ClassWithPeople, useDeleteClass, useUpdateClass } from "@/lib/tutoring";
import { ClassRosterDialog, RosterButton } from "@/components/class-roster";
import { ClassMaterialsDialog, MaterialsButton } from "@/components/class-materials";
import { sendClassInviteFn } from "@/lib/class-invite.functions";
import { JOIN_WINDOW_MINUTES, meetingWindow } from "@/lib/meeting";
import { browserTimeZone, formatInZone, zoneAbbrev } from "@/lib/timezones";
import { cn } from "@/lib/utils";

/** Accepts "meet.google.com/abc" and turns it into a clickable absolute URL. */
export function normalizeMeetingUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function statusTone(status: ClassWithPeople["status"]) {
  if (status === "completed") return "secondary" as const;
  if (status === "cancelled") return "outline" as const;
  return "default" as const;
}

export function ClassCard({
  item,
  currentUserId,
  compact = false,
}: {
  item: ClassWithPeople;
  currentUserId: string;
  compact?: boolean;
}) {
  const update = useUpdateClass();
  const remove = useDeleteClass();
  const iAmTutor = item.tutor_id === currentUserId;
  const counterpart = iAmTutor ? item.student : item.tutor;
  const start = new Date(item.starts_at);
  const joinWindow = meetingWindow(item);
  const isPast = start.getTime() < Date.now();
  const viewerZone = browserTimeZone();
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState(item.meeting_url ?? "");
  const [rosterOpen, setRosterOpen] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const joinUrl = item.meeting_url ? normalizeMeetingUrl(item.meeting_url) : null;
  const sendInvite = useServerFn(sendClassInviteFn);
  const invite = useMutation({
    mutationFn: () => sendInvite({ data: { classId: item.id } }),
    onSuccess: (result) => {
      if (result.sent.length) {
        toast.success(`Invite sent to ${result.sent.join(" and ")}`);
      } else {
        toast.error("No invite could be sent — add contact emails to the profiles first");
      }
      if (result.missingEmail.length) {
        toast.warning(`No email on file for ${result.missingEmail.join(", ")}`);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function saveLink(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = linkValue.trim();
    const normalized = trimmed ? normalizeMeetingUrl(trimmed) : null;
    if (trimmed && !normalized) {
      toast.error("That does not look like a valid meeting link");
      return;
    }
    update.mutate(
      { id: item.id, patch: { meeting_url: normalized } },
      {
        onSuccess: () => {
          toast.success(normalized ? "Meeting link saved" : "Meeting link removed");
          setLinkOpen(false);
          if (normalized) invite.mutate();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <Card className={cn("border-border shadow-soft", compact && "shadow-none")}>
      <CardContent className={cn("flex flex-wrap items-start gap-4 pt-6", compact && "py-4")}>
        <div className="grid w-14 shrink-0 place-items-center rounded-xl bg-secondary py-2 text-secondary-foreground">
          <span className="text-xs uppercase tracking-wide">{format(start, "MMM")}</span>
          <span className="font-display text-xl font-semibold leading-none">
            {format(start, "d")}
          </span>
        </div>

        <div className="min-w-48 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-semibold">{item.title}</h3>
            <Badge variant={statusTone(item.status)} className="capitalize">
              {item.status === "scheduled" && isPast ? "awaiting wrap-up" : item.status}
            </Badge>
            {item.subject && <Badge variant="outline">{item.subject}</Badge>}
            {item.is_demo && (
              <Badge className="bg-accent text-accent-foreground hover:bg-accent">Demo</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatInZone(start, item.time_zone)} {zoneAbbrev(start, item.time_zone)} ·{" "}
            {item.duration_minutes} min
          </p>
          <p className="text-xs text-muted-foreground">
            Your time: {format(start, "EEE d MMM · HH:mm")} ({zoneAbbrev(start, viewerZone)})
          </p>
          <p className="mt-1 text-sm">
            <span className="text-muted-foreground">{iAmTutor ? "Student: " : "Tutor: "}</span>
            {counterpart ? (
              counterpart.role === "tutor" ? (
                <Link
                  to="/tutors/$tutorId"
                  params={{ tutorId: counterpart.id }}
                  className="underline"
                >
                  {counterpart.full_name || "Unnamed member"}
                </Link>
              ) : (
                counterpart.full_name || "Unnamed member"
              )
            ) : (
              "Unknown member"
            )}
          </p>

          {item.notes && !compact && (
            <p className="mt-2 text-sm text-muted-foreground">{item.notes}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {item.status === "scheduled" &&
            (joinWindow.canJoin ? (
              <Button size="sm" asChild>
                <Link to="/room/$classId" params={{ classId: item.id }}>
                  <Video className="size-4" />
                  Join class
                </Link>
              </Button>
            ) : (
              <Button size="sm" disabled title={`The room opens ${JOIN_WINDOW_MINUTES} min before`}>
                <Video className="size-4" />
                {joinWindow.label}
              </Button>
            ))}
          {joinUrl && item.status === "scheduled" && (
            <Button size="sm" variant="ghost" asChild>
              <a href={joinUrl} target="_blank" rel="noreferrer noopener">
                External link
                <ExternalLink className="size-3" />
              </a>
            </Button>
          )}


          {item.status === "scheduled" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setLinkValue(item.meeting_url ?? "");
                setLinkOpen(true);
              }}
            >
              <Link2 className="size-4" />
              {joinUrl ? "Edit link" : "Add link"}
            </Button>
          )}

          {item.status === "scheduled" && (
            <Button
              size="sm"
              variant="outline"
              disabled={invite.isPending}
              onClick={() => invite.mutate()}
            >
              <Mail className="size-4" />
              {invite.isPending ? "Sending…" : "Send invite"}
            </Button>
          )}

          <RosterButton onClick={() => setRosterOpen(true)} />

          <MaterialsButton onClick={() => setMaterialsOpen(true)} />

          {item.status === "scheduled" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  update.mutate(
                    { id: item.id, patch: { status: "completed" } },
                    { onSuccess: () => toast.success("Marked as completed") },
                  )
                }
              >
                <CheckCircle2 className="size-4" />
                Complete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  update.mutate(
                    { id: item.id, patch: { status: "cancelled" } },
                    { onSuccess: () => toast.success("Class cancelled") },
                  )
                }
              >
                <XCircle className="size-4" />
                Cancel
              </Button>
            </>
          )}
          {item.status !== "scheduled" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                remove.mutate(item.id, { onSuccess: () => toast.success("Class removed") })
              }
              aria-label="Delete class"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>

        <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Meeting link for “{item.title}”</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={saveLink}>
              <div className="space-y-2">
                <Label htmlFor={`link-${item.id}`}>Join URL</Label>
                <Input
                  id={`link-${item.id}`}
                  value={linkValue}
                  onChange={(e) => setLinkValue(e.target.value)}
                  placeholder="https://meet.google.com/abc-defg-hij"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                  Paste a real Google Meet, Zoom or Teams link. Leave empty to remove it.
                </p>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={update.isPending}>
                  {update.isPending ? "Saving…" : "Save link"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <ClassRosterDialog
          item={item}
          open={rosterOpen}
          onOpenChange={setRosterOpen}
          canManage={iAmTutor}
        />

        <ClassMaterialsDialog
          classId={item.id}
          classTitle={item.title}
          open={materialsOpen}
          onOpenChange={setMaterialsOpen}
          canEdit={iAmTutor}
        />

      </CardContent>
    </Card>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-14 text-center">
      <CalendarClock className="size-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
