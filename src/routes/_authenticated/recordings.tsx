import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";
import { ExternalLink, FileVideo, Link2, Plus, Play, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/class-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/session";
import {
  signedRecordingUrl,
  useAddRecording,
  useClasses,
  useDeleteRecording,
  useRecordings,
  type RecordingRow,
} from "@/lib/tutoring";

export const Route = createFileRoute("/_authenticated/recordings")({
  head: () => ({
    meta: [
      { title: "Recordings — myNexClass" },
      {
        name: "description",
        content:
          "Private storage for every lesson recording: upload a video file or save a meeting link.",
      },
      { property: "og:title", content: "Recordings — myNexClass" },
      { property: "og:description", content: "Private storage for every lesson recording." },
    ],
  }),
  component: RecordingsPage,
});

function RecordingsPage() {
  const { user } = useSession();
  const { data: classes } = useClasses(user?.id);
  const { data: recordings, isLoading } = useRecordings(user?.id);
  const add = useAddRecording();
  const remove = useDeleteRecording();

  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [playing, setPlaying] = useState<{ url: string; title: string } | null>(null);

  const classById = new Map((classes ?? []).map((c) => [c.id, c]));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!classId) return toast.error("Choose the class this recording belongs to");
    if (!title.trim()) return toast.error("Give the recording a title");
    if (!file && !externalUrl.trim()) return toast.error("Upload a file or paste a link");
    if (externalUrl.trim() && !/^https?:\/\//i.test(externalUrl.trim())) {
      return toast.error("The link must start with http:// or https://");
    }
    if (file && file.size > 200 * 1024 * 1024) {
      return toast.error("Video files must be under 200MB");
    }
    add.mutate(
      {
        class_id: classId,
        title: title.trim().slice(0, 120),
        external_url: externalUrl.trim(),
        file,
      },
      {
        onSuccess: () => {
          toast.success("Recording saved");
          setOpen(false);
          setTitle("");
          setExternalUrl("");
          setFile(null);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  async function handlePlay(rec: RecordingRow) {
    try {
      if (rec.storage_path) {
        const url = await signedRecordingUrl(rec.storage_path);
        setPlaying({ url, title: rec.title });
      } else if (rec.external_url) {
        window.open(rec.external_url, "_blank", "noreferrer,noopener");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open the recording");
    }
  }

  return (
    <AppShell
      title="Recordings"
      subtitle="Every lesson keeps its own recording — private to the tutor and the student."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              Add recording
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add a recording</DialogTitle>
              <DialogDescription>
                Upload the video file, paste a link to it, or both.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleAdd}>
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={classes?.length ? "Choose a class…" : "No classes yet"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(classes ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title} · {format(new Date(c.starts_at), "d MMM")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rec-title">Title</Label>
                <Input
                  id="rec-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Lesson 3 — full recording"
                  maxLength={120}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rec-file">Video file</Label>
                <Input
                  id="rec-file"
                  type="file"
                  accept="video/*,audio/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">Up to 200MB, stored privately.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rec-url">Or a link</Label>
                <Input
                  id="rec-url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://drive.google.com/…"
                  maxLength={500}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={add.isPending}>
                  {add.isPending ? (
                    "Saving…"
                  ) : (
                    <>
                      <Upload className="size-4" />
                      Save recording
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : recordings?.length ? (
        <div className="grid gap-3">
          {recordings.map((rec) => {
            const linked = classById.get(rec.class_id);
            return (
              <Card key={rec.id} className="border-border shadow-soft">
                <CardContent className="flex flex-wrap items-center gap-4 pt-6">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                    {rec.storage_path ? (
                      <FileVideo className="size-5" />
                    ) : (
                      <Link2 className="size-5" />
                    )}
                  </span>
                  <div className="min-w-48 flex-1">
                    <h3 className="font-display text-base font-semibold">{rec.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {linked
                        ? `${linked.title} · ${format(new Date(linked.starts_at), "d MMM yyyy")}`
                        : "Class removed"}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {rec.storage_path ? "Uploaded file" : "External link"}
                  </Badge>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handlePlay(rec)}>
                      {rec.storage_path ? (
                        <Play className="size-4" />
                      ) : (
                        <ExternalLink className="size-4" />
                      )}
                      {rec.storage_path ? "Play" : "Open"}
                    </Button>
                    {rec.uploaded_by === user?.id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Delete recording"
                        onClick={() =>
                          remove.mutate(rec, {
                            onSuccess: () => toast.success("Recording deleted"),
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState label="No recordings yet — add one from a completed class." />
      )}

      <Dialog open={!!playing} onOpenChange={(v) => !v && setPlaying(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{playing?.title}</DialogTitle>
          </DialogHeader>
          {playing && (
            <video src={playing.url} controls className="w-full rounded-xl" autoPlay>
              <track kind="captions" />
            </video>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
