import { useState } from "react";
import { format } from "date-fns";
import { Download, FileText, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  materialFileUrl,
  useAddMaterial,
  useDeleteMaterial,
  useMaterials,
} from "@/lib/materials";

export function MaterialsButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" variant="outline" onClick={onClick}>
      <FileText className="size-4" />
      Notes
    </Button>
  );
}

export function ClassMaterialsDialog({
  classId,
  classTitle,
  canEdit,
  open,
  onOpenChange,
}: {
  classId: string;
  classTitle: string;
  canEdit: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: items } = useMaterials(open ? classId : undefined);
  const add = useAddMaterial();
  const remove = useDeleteMaterial();

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Give the note or material a title");
      return;
    }
    add.mutate(
      { classId, title: title.trim(), notes, externalUrl, file },
      {
        onSuccess: () => {
          toast.success("Saved to this class");
          setTitle("");
          setNotes("");
          setExternalUrl("");
          setFile(null);
        },
        onError: (err: Error) => toast.error(err.message),
      },
    );
  }

  async function openFile(path: string) {
    try {
      const url = await materialFileUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Notes & materials — {classTitle}</DialogTitle>
          <DialogDescription>
            Lesson notes, worksheets and links shared with everyone in this class.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {items?.length ? (
            items.map((m) => (
              <div key={m.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="flex-1 font-medium">{m.title}</p>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(m.created_at), "d MMM yyyy")}
                  </span>
                  {m.storage_path && (
                    <Button size="sm" variant="outline" onClick={() => void openFile(m.storage_path!)}>
                      <Download className="size-4" />
                      File
                    </Button>
                  )}
                  {m.external_url && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={m.external_url} target="_blank" rel="noreferrer noopener">
                        <Link2 className="size-4" />
                        Link
                      </a>
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Delete material"
                      onClick={() =>
                        remove.mutate(m, { onSuccess: () => toast.success("Removed") })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
                {m.notes && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {m.notes}
                  </p>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing shared for this class yet.
            </p>
          )}
        </div>

        {canEdit && (
          <form className="grid gap-4 border-t border-border pt-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="material-title">Title</Label>
              <Input
                id="material-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Lesson 4 — quadratic equations"
                maxLength={140}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="material-notes">Lesson notes</Label>
              <Textarea
                id="material-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="What we covered, homework, things to revise…"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="material-url">Link (optional)</Label>
                <Input
                  id="material-url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://…"
                  maxLength={500}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="material-file">File (optional)</Label>
                <Input
                  id="material-file"
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? "Saving…" : "Add to class"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
