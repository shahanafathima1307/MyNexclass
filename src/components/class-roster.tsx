import { useState } from "react";
import { format } from "date-fns";
import { Users, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatDuration,
  useAddParticipant,
  useClassAttendance,
  useClassParticipants,
  useRemoveParticipant,
} from "@/lib/class-people";
import { useMembers, type ClassWithPeople } from "@/lib/tutoring";

/** Group-class roster plus the attendance log captured by the live room. */
export function ClassRosterDialog({
  item,
  open,
  onOpenChange,
  canManage,
}: {
  item: ClassWithPeople;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  canManage: boolean;
}) {
  const { data: members = [] } = useMembers();
  const participants = useClassParticipants(open ? item.id : undefined, members);
  const attendance = useClassAttendance(open ? item.id : undefined, members);
  const addParticipant = useAddParticipant();
  const removeParticipant = useRemoveParticipant();
  const [pick, setPick] = useState("");

  const taken = new Set([
    item.tutor_id,
    item.student_id,
    ...(participants.data ?? []).map((p) => p.user_id),
  ]);
  const addable = members.filter((m) => !taken.has(m.id));

  function add() {
    if (!pick) return;
    addParticipant.mutate(
      { classId: item.id, userId: pick },
      {
        onSuccess: () => {
          setPick("");
          toast.success("Added to the class");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Roster for “{item.title}”</DialogTitle>
          <DialogDescription>
            Add extra students to run this as a group class, and review who actually attended.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-2">
            <h4 className="text-sm font-semibold">In this class</h4>
            <ul className="space-y-1 text-sm">
              <li className="flex items-center gap-2">
                <Badge variant="secondary">Tutor</Badge>
                {item.tutor?.full_name || "Unknown"}
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="outline">Student</Badge>
                {item.student?.full_name || "Unknown"}
              </li>
              {(participants.data ?? []).map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <Badge variant="outline">Guest</Badge>
                  <span className="flex-1">{p.member?.full_name || "Member"}</span>
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Remove participant"
                      onClick={() =>
                        removeParticipant.mutate(p.id, {
                          onError: (error) => toast.error(error.message),
                        })
                      }
                    >
                      <UserMinus className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {canManage && (
            <section className="flex flex-wrap items-end gap-2">
              <div className="min-w-48 flex-1 space-y-1">
                <label className="text-sm font-medium" htmlFor={`add-${item.id}`}>
                  Add a participant
                </label>
                <Select value={pick} onValueChange={setPick}>
                  <SelectTrigger id={`add-${item.id}`}>
                    <SelectValue placeholder="Choose a member" />
                  </SelectTrigger>
                  <SelectContent>
                    {addable.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name || "Unnamed member"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={add} disabled={!pick || addParticipant.isPending}>
                Add
              </Button>
            </section>
          )}

          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Attendance</h4>
            {(attendance.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody has entered the room yet.</p>
            ) : (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {(attendance.data ?? []).map((row) => (
                  <li key={row.id}>
                    <span className="text-foreground">{row.member?.full_name || "Member"}</span> ·{" "}
                    {format(new Date(row.joined_at), "d MMM HH:mm")} ·{" "}
                    {formatDuration(row.joined_at, row.left_at)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RosterButton({ count, onClick }: { count?: number; onClick: () => void }) {
  return (
    <Button size="sm" variant="outline" onClick={onClick}>
      <Users className="size-4" />
      Roster{count ? ` (${count + 2})` : ""}
    </Button>
  );
}
