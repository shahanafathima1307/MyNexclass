import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  FileText,
  Info,
  LifeBuoy,
  LogOut,
  MailCheck,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark, BrandWordmark } from "@/components/brand-logo";
import { useSession } from "@/lib/session";
import {
  STATUS_LABEL,
  fieldLabel,
  statusTone,
  useMyApproval,
  useMyDocuments,
  useRegistrationDetails,
  useResubmitApplication,
  useSaveRegistrationDetails,
  useUploadApprovalDocument,
  type RegistrationDetails,
} from "@/lib/approvals";
import { validateMobile } from "@/lib/registration";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

const SUPPORT_EMAIL = "support@mynexclass.com";

export const Route = createFileRoute("/_authenticated/approval-status")({
  head: () => ({
    meta: [
      { title: "Approval pending · myNexClass" },
      {
        name: "description",
        content:
          "Track your myNexClass registration approval, complete requested details and resubmit your application.",
      },
      { property: "og:title", content: "Approval pending · myNexClass" },
      {
        property: "og:description",
        content:
          "Track your myNexClass registration approval, complete requested details and resubmit your application.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApprovalStatusPage,
});

const STUDENT_FORM: { key: keyof RegistrationDetails; label: string; type?: string }[] = [
  { key: "mobile", label: "Mobile number" },
  { key: "whatsapp", label: "WhatsApp number" },
  { key: "parent_name", label: "Parent / guardian name" },
  { key: "parent_contact", label: "Parent / guardian contact" },
  { key: "grade", label: "Grade or class" },
  { key: "school", label: "School" },
  { key: "subjects_of_interest", label: "Subjects of interest" },
  { key: "country", label: "Country" },
  { key: "state", label: "State" },
  { key: "time_zone", label: "Time zone" },
  { key: "referral_source", label: "How did you hear about us?" },
];

const TUTOR_FORM: { key: keyof RegistrationDetails; label: string; type?: string }[] = [
  { key: "mobile", label: "Mobile number (required)" },
  { key: "whatsapp", label: "WhatsApp number" },
  { key: "subjects_taught", label: "Subjects taught" },
  { key: "grades_taught", label: "Grades taught" },
  { key: "education", label: "Education" },
  { key: "work_experience", label: "Work experience" },
  { key: "teaching_experience", label: "Teaching experience" },
  { key: "certifications", label: "Certifications" },
  { key: "hourly_rate", label: "Hourly rate", type: "number" },
  { key: "availability_notes", label: "Availability" },
  { key: "intro_video_url", label: "Intro video URL" },
  { key: "country", label: "Country" },
  { key: "state", label: "State" },
  { key: "time_zone", label: "Time zone" },
  { key: "short_bio", label: "Short bio", type: "textarea" },
];

const MESSAGES: Record<string, { title: string; body: string; eta: string }> = {
  draft: {
    title: "Verify your email address",
    body: "We've sent a verification link to your inbox. Confirm your email address to enter the approval queue.",
    eta: "Review starts once your email is verified",
  },
  pending_approval: {
    title: "Awaiting administrator approval",
    body: "Thank you for registering with MyNexClass. Your account is currently awaiting administrator approval. You will receive an email and WhatsApp notification once your account has been reviewed.",
    eta: "Typically reviewed within 24–48 hours",
  },
  under_review: {
    title: "Application under review",
    body: "Your application is currently being reviewed by our team.",
    eta: "Usually completed within 24 hours",
  },
  more_info_required: {
    title: "More information required",
    body: "The administrator has requested additional information before your account can be approved.",
    eta: "Reviewed within 24 hours of your resubmission",
  },
  rejected: {
    title: "Registration not approved",
    body: "Your registration was not approved. You can update your details and resubmit, or contact support for clarification.",
    eta: "Contact support for a re-review",
  },
  suspended: {
    title: "Account suspended",
    body: "Access to your account is temporarily blocked. Please contact support.",
    eta: "Contact support",
  },
  deactivated: {
    title: "Account deactivated",
    body: "Your account has been closed. Contact support if you believe this is a mistake.",
    eta: "Contact support",
  },
};

function iconFor(status: string) {
  if (status === "approved") return CheckCircle2;
  if (status === "more_info_required") return Info;
  if (status === "draft") return MailCheck;
  if (status === "rejected" || status === "suspended" || status === "deactivated")
    return ShieldAlert;
  return Clock;
}

function ApprovalStatusPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: request, isLoading } = useMyApproval(user?.id);
  const { data: details } = useRegistrationDetails(user?.id);
  const { data: documents } = useMyDocuments(user?.id);
  const save = useSaveRegistrationDetails();
  const upload = useUploadApprovalDocument();
  const resubmit = useResubmitApplication();

  const [form, setForm] = useState<Record<string, string>>({});
  const [response, setResponse] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [resending, setResending] = useState(false);

  const emailVerified = !!user?.email_confirmed_at;

  useEffect(() => {
    if (!details) return;
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(details)) {
      if (v !== null && v !== undefined && typeof v !== "object") next[k] = String(v);
    }
    setForm(next);
  }, [details]);

  // Verified email moves a draft registration into the admin queue.
  useEffect(() => {
    if (!user?.id || !emailVerified || request?.status !== "draft") return;
    supabase.rpc("activate_pending_approval").then(() => {
      queryClient.invalidateQueries({ queryKey: ["my-approval", user.id] });
    });
  }, [user?.id, emailVerified, request?.status, queryClient]);

  const status = request?.status ?? "pending_approval";
  const requested = useMemo(() => request?.requested_fields ?? [], [request]);

  useEffect(() => {
    if (status === "more_info_required" && requested.length > 0) setShowDetails(true);
  }, [status, requested.length]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function handleResendVerification() {
    if (!user?.email) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: user.email });
      if (error) throw error;
      toast.success("Verification email sent — check your inbox and spam folder.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not resend the verification email");
    } finally {
      setResending(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-5 py-4">
          <BrandMark />
          <BrandWordmark className="text-lg" />
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={handleSignOut}
            aria-label="Log out"
          >
            <LogOut className="size-4" />
            Log out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">{children}</main>
    </div>
  );

  if (isLoading) return shell(<Skeleton className="h-72 w-full" />);

  if (!request)
    return shell(
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          No registration record was found for your account. Please contact support.
        </CardContent>
      </Card>,
    );

  const copy = MESSAGES[status] ?? MESSAGES["pending_approval"]!;
  const StatusIcon = iconFor(status);
  const editable = status !== "approved";
  const fields = request.user_type === "tutor" ? TUTOR_FORM : STUDENT_FORM;
  const canResubmit = status === "more_info_required" || status === "rejected";

  async function handleSave() {
    if (request!.user_type === "tutor") {
      const err = validateMobile(form["mobile"] ?? "", true);
      if (err) {
        toast.error(err);
        return;
      }
    }
    const patch: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = form[f.key as string];
      if (raw === undefined) continue;
      patch[f.key as string] = f.type === "number" ? (raw ? Number(raw) : null) : raw || null;
    }
    try {
      await save.mutateAsync({ userId: user!.id, patch: patch as Partial<RegistrationDetails> });
      toast.success("Details saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  return shell(
    <>
      <Card>
        <CardHeader className="items-center gap-3 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-secondary">
            <StatusIcon className="size-7 text-primary" />
          </span>
          <Badge className={statusTone(request.status)} variant="secondary">
            {STATUS_LABEL[request.status]}
          </Badge>
          <CardTitle className="text-2xl">{copy.title}</CardTitle>
          <CardDescription className="mx-auto max-w-xl text-base">{copy.body}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Registered on
              </dt>
              <dd className="mt-1 font-medium">
                {new Date(request.created_at).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Estimated review time
              </dt>
              <dd className="mt-1 font-medium">{copy.eta}</dd>
            </div>
            {request.response_deadline && status === "more_info_required" && (
              <div className="sm:col-span-2 text-sm text-muted-foreground">
                Please respond by {new Date(request.response_deadline).toLocaleDateString()}.
              </div>
            )}
          </dl>

          {!emailVerified && (
            <div className="rounded-xl border border-primary/40 bg-secondary p-4">
              <p className="text-sm font-medium">Your email address is not verified yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Registrations only enter the approval queue once the email address is confirmed.
              </p>
              <Button
                className="mt-3"
                size="sm"
                variant="outline"
                disabled={resending}
                onClick={handleResendVerification}
              >
                {resending ? "Sending…" : "Resend verification email"}
              </Button>
            </div>
          )}

          {requested.length > 0 && (
            <div className="rounded-xl border border-primary/40 p-4">
              <p className="text-sm font-medium">Information requested by the administrator</p>
              {request.request_instructions && (
                <p className="mt-1 text-sm text-muted-foreground">{request.request_instructions}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {requested.map((f) => (
                  <Badge key={f} variant="secondary">
                    {fieldLabel(f)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-3">
            {(status === "more_info_required" || status === "rejected") && (
              <Button onClick={() => setShowDetails((v) => !v)}>
                {showDetails ? "Hide details" : "Review details"}
              </Button>
            )}
            <Button variant="outline" asChild>
              <a href={`mailto:${SUPPORT_EMAIL}?subject=myNexClass%20registration%20support`}>
                <LifeBuoy className="size-4" />
                Contact support
              </a>
            </Button>
            <Button variant="ghost" onClick={handleSignOut}>
              <LogOut className="size-4" />
              Log out
            </Button>
          </div>
        </CardContent>
      </Card>

      {showDetails && (
        <div className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Registration details</CardTitle>
              <CardDescription>
                Update anything the reviewer asked for, then save your changes.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {fields.map((f) => {
                const key = f.key as string;
                const highlight = requested.includes(key);
                return (
                  <div key={key} className={f.type === "textarea" ? "sm:col-span-2" : undefined}>
                    <Label htmlFor={key} className={highlight ? "text-primary" : undefined}>
                      {f.label}
                      {highlight ? " (requested)" : ""}
                    </Label>
                    {f.type === "textarea" ? (
                      <Textarea
                        id={key}
                        className="mt-1"
                        disabled={!editable}
                        value={form[key] ?? ""}
                        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                      />
                    ) : (
                      <Input
                        id={key}
                        className="mt-1"
                        type={f.type ?? "text"}
                        disabled={!editable}
                        value={form[key] ?? ""}
                        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                      />
                    )}
                  </div>
                );
              })}
              {editable && (
                <div className="sm:col-span-2">
                  <Button onClick={handleSave} disabled={save.isPending}>
                    {save.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>PDF, Word or image files up to 10 MB.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(documents ?? []).map((doc) => (
                <div key={doc.id} className="flex items-center gap-2 text-sm">
                  <FileText className="size-4 shrink-0" />
                  <span className="truncate">{doc.file_name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {fieldLabel(doc.kind)}
                  </span>
                </div>
              ))}
              {editable && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {(request.user_type === "tutor"
                    ? ["identity", "resume", "certificate"]
                    : ["identity"]
                  ).map((kind) => (
                    <label
                      key={kind}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm"
                    >
                      <Upload className="size-4" />
                      Upload {fieldLabel(kind)}
                      <input
                        type="file"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          try {
                            await upload.mutateAsync({ userId: user!.id, kind, file });
                            toast.success("Document uploaded");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Upload failed");
                          }
                        }}
                      />
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {canResubmit && (
            <Card>
              <CardHeader>
                <CardTitle>Resubmit application</CardTitle>
                <CardDescription>
                  Tell the review team what you&apos;ve changed and send it back.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="I've added my mobile number and uploaded my ID."
                  maxLength={1000}
                />
                <Button
                  className="w-full"
                  disabled={resubmit.isPending || !response.trim()}
                  onClick={async () => {
                    try {
                      await resubmit.mutateAsync({
                        request,
                        response: response.trim(),
                        actorId: user!.id,
                        actorRole: request.user_type,
                      });
                      setResponse("");
                      toast.success("Application resubmitted");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not resubmit");
                    }
                  }}
                >
                  {resubmit.isPending ? "Sending…" : "Resubmit for review"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>,
  );
}
