import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  REJECTION_REASONS,
  STUDENT_FIELDS,
  TUTOR_FIELDS,
  fieldLabel,
  useAdminDirectory,
  useApproveApplicant,
  useAssignReviewer,
  useRejectApplicant,
  useRequestMoreInfo,
  type ApprovalRequest,
} from "@/lib/approvals";

export type ActorProps = { actorId: string; actorRole: string };

type Base = ActorProps & {
  request: ApprovalRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ApproveDialog({ request, open, onOpenChange, actorId, actorRole }: Base) {
  const [welcome, setWelcome] = useState("");
  const approve = useApproveApplicant();
  if (!request) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve this applicant?</DialogTitle>
          <DialogDescription>
            They will receive the {request.user_type} role, full platform access and an email
            confirmation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="welcome">Welcome message (optional)</Label>
          <Textarea
            id="welcome"
            value={welcome}
            onChange={(e) => setWelcome(e.target.value)}
            placeholder="Welcome to myNexClass!"
            maxLength={500}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={approve.isPending}
            onClick={async () => {
              try {
                await approve.mutateAsync({
                  request,
                  actorId,
                  actorRole,
                  welcomeMessage: welcome.trim() || undefined,
                });
                toast.success("Applicant approved");
                onOpenChange(false);
                setWelcome("");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not approve");
              }
            }}
          >
            {approve.isPending ? "Approving…" : "Confirm approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RejectDialog({ request, open, onOpenChange, actorId, actorRole }: Base) {
  const [reason, setReason] = useState(REJECTION_REASONS[0]!);
  const [message, setMessage] = useState(
    "Your registration was not approved. Contact support if you need clarification.",
  );
  const reject = useRejectApplicant();
  if (!request) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject this application?</DialogTitle>
          <DialogDescription>
            The internal reason stays private. Only your explanation is shown to the applicant.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Internal reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REJECTION_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="explanation">Explanation for the applicant</Label>
            <Textarea
              id="explanation"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={reject.isPending || !message.trim()}
            onClick={async () => {
              try {
                await reject.mutateAsync({
                  request,
                  actorId,
                  actorRole,
                  internalReason: reason,
                  userMessage: message.trim(),
                });
                toast.success("Application rejected");
                onOpenChange(false);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not reject");
              }
            }}
          >
            {reject.isPending ? "Rejecting…" : "Confirm rejection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RequestInfoDialog({ request, open, onOpenChange, actorId, actorRole }: Base) {
  const [fields, setFields] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");
  const [deadline, setDeadline] = useState("");
  const requestInfo = useRequestMoreInfo();
  if (!request) return null;
  const options = request.user_type === "tutor" ? TUTOR_FIELDS : STUDENT_FIELDS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request more information</DialogTitle>
          <DialogDescription>
            Select what is missing. The applicant can update those fields and resubmit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {options.map((f) => (
              <label key={f} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={fields.includes(f)}
                  onCheckedChange={(checked) =>
                    setFields((prev) => (checked ? [...prev, f] : prev.filter((x) => x !== f)))
                  }
                />
                {fieldLabel(f)}
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Please upload a clear photo ID and add your mobile number."
              maxLength={1000}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deadline">Response deadline</Label>
            <Input
              id="deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={requestInfo.isPending || (!fields.length && !instructions.trim())}
            onClick={async () => {
              try {
                await requestInfo.mutateAsync({
                  request,
                  actorId,
                  actorRole,
                  fields,
                  instructions: instructions.trim(),
                  deadline: deadline ? new Date(deadline).toISOString() : null,
                });
                toast.success("Request sent to the applicant");
                onOpenChange(false);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not send request");
              }
            }}
          >
            {requestInfo.isPending ? "Sending…" : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AssignReviewerDialog({ request, open, onOpenChange, actorId, actorRole }: Base) {
  const { data: admins } = useAdminDirectory(open);
  const [reviewer, setReviewer] = useState("");
  const assign = useAssignReviewer();
  if (!request) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign a reviewer</DialogTitle>
          <DialogDescription>The reviewer is notified in-app straight away.</DialogDescription>
        </DialogHeader>
        <Select value={reviewer} onValueChange={setReviewer}>
          <SelectTrigger>
            <SelectValue placeholder="Choose an admin" />
          </SelectTrigger>
          <SelectContent>
            {(admins ?? []).map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!reviewer || assign.isPending}
            onClick={async () => {
              try {
                await assign.mutateAsync({ request, actorId, actorRole, reviewerId: reviewer });
                toast.success("Reviewer assigned");
                onOpenChange(false);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not assign");
              }
            }}
          >
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
