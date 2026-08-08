import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FileDrop } from "@/components/assignments/file-drop";
import { alertAssignment } from "@/lib/assignment-alerts";
import { PRIORITIES, useCreateAssignment, type Actor, type Priority } from "@/lib/assignments";
import type { Member } from "@/lib/tutoring";

interface Props {
  actor: Actor;
  tutorId: string;
  students: Member[];
  classes: { id: string; title: string }[];
}

/** Tutor-facing "new assignment" dialog: multi-student, files, links, draft or publish. */
export function AssignmentForm({ actor, tutorId, students, classes }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [classId, setClassId] = useState("none");
  const [priority, setPriority] = useState<Priority>("normal");
  const [assignedAt, setAssignedAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [allowResubmission, setAllowResubmission] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const create = useCreateAssignment();

  const reset = () => {
    setTitle("");
    setInstructions("");
    setSubject("");
    setGradeLevel("");
    setClassId("none");
    setPriority("normal");
    setAssignedAt("");
    setDueAt("");
    setAllowResubmission(true);
    setSelected([]);
    setFiles([]);
    setLinks([]);
    setLinkInput("");
  };

  const submit = async (publish: boolean) => {
    if (!title.trim()) return toast.error("Give the assignment a title.");
    if (selected.length === 0) return toast.error("Select at least one student.");
    setBusy(true);
    try {
      const ids = await create.mutateAsync({
        actor,
        tutorId,
        studentIds: selected,
        title: title.trim(),
        instructions: instructions.trim() || null,
        subject: subject.trim() || null,
        gradeLevel: gradeLevel.trim() || null,
        classId: classId === "none" ? null : classId,
        priority,
        assignedAt: assignedAt ? new Date(assignedAt).toISOString() : null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        allowResubmission,
        publish,
        files,
        links,
      });
      if (publish) {
        await Promise.all(
          ids.map((id, index) =>
            alertAssignment({
              assignmentId: id,
              recipientId: selected[index]!,
              title: `New assignment: ${title.trim()}`,
              body: dueAt ? `Due ${new Date(dueAt).toLocaleString()}` : undefined,
              kind: "assigned",
            }),
          ),
        );
      }
      toast.success(
        publish
          ? `Assignment sent to ${ids.length} student${ids.length === 1 ? "" : "s"}.`
          : "Saved as a draft.",
      );
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the assignment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" /> New assignment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create an assignment</DialogTitle>
          <DialogDescription>
            Add the brief, pick your students and publish now or keep it as a draft.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="a-title">Title</Label>
            <Input
              id="a-title"
              value={title}
              maxLength={160}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Quadratic equations — worksheet 3"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="a-instructions">Instructions and description</Label>
            <Textarea
              id="a-instructions"
              rows={4}
              maxLength={5000}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="What should the student do, and how will it be marked?"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="a-subject">Subject or course</Label>
              <Input
                id="a-subject"
                value={subject}
                maxLength={80}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Maths"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-grade">Grade or level</Label>
              <Input
                id="a-grade"
                value={gradeLevel}
                maxLength={80}
                onChange={(e) => setGradeLevel(e.target.value)}
                placeholder="Grade 9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-class">Linked class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger id="a-class">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked class</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger id="a-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-assigned">Assigned date</Label>
              <Input
                id="a-assigned"
                type="datetime-local"
                value={assignedAt}
                onChange={(e) => setAssignedAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-due">Due date and time</Label>
              <Input
                id="a-due"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <p className="text-sm font-medium">Allow resubmission</p>
              <p className="text-xs text-muted-foreground">
                Students can upload a new version after you request changes.
              </p>
            </div>
            <Switch checked={allowResubmission} onCheckedChange={setAllowResubmission} />
          </div>

          <div className="space-y-2">
            <Label>Students ({selected.length} selected)</Label>
            <ScrollArea className="h-40 rounded-lg border p-2">
              <div className="space-y-1">
                {students.length === 0 && (
                  <p className="p-2 text-sm text-muted-foreground">No students yet.</p>
                )}
                {students.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted"
                  >
                    <Checkbox
                      checked={selected.includes(s.id)}
                      onCheckedChange={(checked) =>
                        setSelected((prev) =>
                          checked ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                        )
                      }
                    />
                    <span className="text-sm">{s.full_name}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <Label>Attachments</Label>
            <FileDrop files={files} onChange={setFiles} disabled={busy} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="a-link">Reference links</Label>
            <div className="flex gap-2">
              <Input
                id="a-link"
                value={linkInput}
                placeholder="https://..."
                onChange={(e) => setLinkInput(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const value = linkInput.trim();
                  if (!/^https?:\/\/\S+$/i.test(value)) {
                    toast.error("Enter a full link starting with http:// or https://");
                    return;
                  }
                  setLinks((prev) => [...prev, value]);
                  setLinkInput("");
                }}
              >
                Add
              </Button>
            </div>
            {links.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {links.map((l) => (
                  <Badge
                    key={l}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => setLinks((prev) => prev.filter((x) => x !== l))}
                  >
                    {l} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {busy && <Progress value={70} aria-label="Saving assignment" />}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" disabled={busy} onClick={() => submit(false)}>
            Save as draft
          </Button>
          <Button disabled={busy} onClick={() => submit(true)}>
            {busy ? "Publishing…" : "Publish now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
