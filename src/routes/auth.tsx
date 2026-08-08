import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCaptureReferralParam } from "@/lib/referrals";
import { GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
// Imported lazily inside handleGoogle: the module touches `window` at import time,
// which breaks server rendering of this page.
import { checkRegistrationFn } from "@/lib/registration.functions";
import {
  normalizeEmail,
  passwordStrength,
  validateConfirmPassword,
  validateEmail,
  validateFullName,
  validateMobile,
  validatePassword,
  validateWhatsapp,
} from "@/lib/registration";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  next: z.string().optional(),
});

/** Only allow same-origin relative paths as a post-login redirect target. */
function safeNext(next: string | undefined) {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}


export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in to myNexClass" },
      {
        name: "description",
        content: "Sign in or create your myNexClass account as a tutor or a student to book classes.",
      },
      { property: "og:title", content: "Sign in to myNexClass" },
      {
        property: "og:description",
        content: "Sign in or create your myNexClass account as a tutor or a student.",
      },
    ],
  }),
  component: AuthPage,
});

function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

function AuthPage() {
  useCaptureReferralParam();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [role, setRole] = useState<"student" | "tutor">("student");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverErrors, setServerErrors] = useState<{ email?: string; mobile?: string }>({});
  // Email OTP step: set once sign-up succeeds but the address is unverified.
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");

  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const next = safeNext(search.next);

  const signingUp = tab === "signup" && !forgot;
  const mobileRequired = signingUp && role === "tutor";

  // Live validation — recomputed on every keystroke.
  const errors = {
    email: serverErrors.email ?? validateEmail(email),
    password: forgot ? null : signingUp ? validatePassword(password) : password ? null : "Password is required",
    confirmPassword: signingUp ? validateConfirmPassword(password, confirmPassword) : null,
    fullName: signingUp ? validateFullName(fullName) : null,
    mobile: signingUp ? (serverErrors.mobile ?? validateMobile(mobile, mobileRequired)) : null,
    whatsapp: signingUp ? validateWhatsapp(whatsapp) : null,
  };
  const strength = passwordStrength(password);
  const formInvalid = forgot
    ? !!errors.email
    : Object.values(errors).some((e) => !!e);

  function show(field: keyof typeof errors) {
    return touched[field] ? (errors[field] ?? undefined) : undefined;
  }
  function markTouched(field: string) {
    setTouched((p) => ({ ...p, [field]: true }));
  }

  // Computed lazily: this component also renders during SSR, where `window` is undefined.
  function getReturnUrl() {
    if (typeof window === "undefined") return undefined;
    return next ? `${window.location.origin}${next}` : window.location.origin;
  }

  // Already signed in? Don't leave the user staring at the login card.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goNext();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goNext() {
    if (next) {
      window.location.href = next;
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({
      email: true,
      password: true,
      confirmPassword: true,
      fullName: true,
      mobile: true,
      whatsapp: true,
    });

    if (forgot) {
      if (errors.email) {
        toast.error(errors.email);
        return;
      }
      setBusy(true);
      try {
        const address = normalizeEmail(email);
        const { error } = await supabase.auth.resetPasswordForEmail(address, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success(
          `If an account exists for ${address}, a reset link is on its way. Check spam too.`,
        );
        setForgot(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not send reset email");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (tab === "signin") {
      if (errors.email || !password) {
        toast.error(errors.email ?? "Enter your password");
        return;
      }
      setBusy(true);
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizeEmail(email),
          password,
        });
        if (error) throw error;
        goNext();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (formInvalid) {
      toast.error("Please fix the highlighted fields before continuing");
      return;
    }

    setBusy(true);
    try {
      const address = normalizeEmail(email);
      const mobileValue = mobile.trim();

      // Server-side re-validation: format, disposable providers, duplicates.
      const check = await checkRegistrationFn({
        data: { email: address, mobile: mobileValue || undefined },
      });
      if (check.emailError || check.mobileError) {
        setServerErrors({
          email: check.emailError ?? undefined,
          mobile: check.mobileError ?? undefined,
        });
        toast.error(check.emailError ?? check.mobileError ?? "Registration details are invalid");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: address,
        password,
        options: {
          emailRedirectTo: getReturnUrl(),
          data: { full_name: fullName.trim().slice(0, 100), role, mobile: mobileValue || null },
        },
      });
      if (error) throw error;

      if (data.session && data.user && (mobileValue || whatsapp.trim())) {
        await supabase.from("registration_details").upsert(
          {
            user_id: data.user.id,
            mobile: mobileValue || null,
            whatsapp: whatsapp.trim() || null,
          },
          { onConflict: "user_id" },
        );
      }

      if (!data.session) {
        toast.success("We sent a 6-digit code to your email. Enter it below to verify.");
        setOtpEmail(address);
        setOtpCode("");
        return;
      }
      toast.success("Account created — welcome to myNexClass");
      goNext();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(code: string) {
    if (!otpEmail || code.length !== 6) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: otpEmail,
        token: code,
        type: "signup",
      });
      if (error) throw error;

      const mobileValue = mobile.trim();
      if (data.user && (mobileValue || whatsapp.trim())) {
        await supabase.from("registration_details").upsert(
          {
            user_id: data.user.id,
            mobile: mobileValue || null,
            whatsapp: whatsapp.trim() || null,
          },
          { onConflict: "user_id" },
        );
      }
      toast.success("Email verified — your registration is now with our team for approval.");
      goNext();
    } catch (error) {
      setOtpCode("");
      toast.error(error instanceof Error ? error.message : "That code is invalid or expired");
    } finally {
      setBusy(false);
    }
  }

  async function handleResendOtp() {
    if (!otpEmail) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: otpEmail });
      if (error) throw error;
      toast.success("A new code is on its way.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not resend the code");
    } finally {
      setBusy(false);
    }
  }


  async function handleGoogle() {
    setBusy(true);
    try {
      const { lovable } = await import("@/integrations/lovable/index");
      const result = await lovable.auth.signInWithOAuth("google", {

        redirect_uri: getReturnUrl(),
      });
      if (result.error) {
        toast.error(
          result.error instanceof Error
            ? result.error.message
            : "Google sign-in failed. Please try again.",
        );
        setBusy(false);
        return;
      }
      if (result.redirected) return;
      // Only navigate once Supabase actually has the session persisted.
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        toast.error("Google sign-in did not complete. Please try again.");
        setBusy(false);
        return;
      }
      goNext();
    } catch (error) {
      setBusy(false);
      toast.error(error instanceof Error ? error.message : "Google sign-in failed.");
    }


  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="surface-ink hidden flex-col justify-between p-12 lg:flex">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground">
            <GraduationCap className="size-5" />
          </span>
          myNexClass
        </Link>
        <div>
          <h2 className="max-w-sm text-4xl font-semibold leading-tight">
            Classes, calendar and recordings in one shared place.
          </h2>
          <p className="mt-4 max-w-sm text-ink-foreground/70">
            Tutors publish the session, students join it, and the recording stays with the lesson.
          </p>
        </div>
        <p className="text-sm text-ink-foreground/50">Tutoring, minus the spreadsheet.</p>
      </div>

      <div className="flex items-center justify-center px-5 py-12">
        {otpEmail ? (
          <Card className="w-full max-w-md border-border shadow-soft">
            <CardHeader>
              <CardTitle className="text-2xl">Verify your email</CardTitle>
              <CardDescription>
                Enter the 6-digit code we sent to <strong>{otpEmail}</strong>. It expires in an
                hour — check your spam folder if it hasn&apos;t arrived.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otpCode}
                  onChange={(v) => {
                    setOtpCode(v);
                    if (v.length === 6) void handleVerifyOtp(v);
                  }}
                  disabled={busy}
                >
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button
                className="w-full"
                disabled={busy || otpCode.length !== 6}
                onClick={() => void handleVerifyOtp(otpCode)}
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                Verify email
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                disabled={busy}
                onClick={() => void handleResendOtp()}
              >
                Resend code
              </Button>
              <button
                type="button"
                className="w-full text-sm text-muted-foreground underline underline-offset-4"
                onClick={() => {
                  setOtpEmail(null);
                  setOtpCode("");
                  setTab("signin");
                  setPassword("");
                  setConfirmPassword("");
                }}
              >
                Use a different email
              </button>
            </CardContent>
          </Card>
        ) : (
        <Card className="w-full max-w-md border-border shadow-soft">

          <CardHeader>
            <CardTitle className="text-2xl">
              {forgot ? "Reset your password" : tab === "signup" ? "Create your account" : "Welcome back"}
            </CardTitle>
            <CardDescription>
              {forgot
                ? "Enter the email you signed up with and we'll send a link to set a new password. Nothing arrives if that address has no account."
                : tab === "signup"
                  ? "Choose whether you teach or learn — you can book classes either way."
                  : "Sign in to see your next class and your recordings."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={tab}
              onValueChange={(v) => {
                setForgot(false);
                setTab(v as "signin" | "signup");
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
            </Tabs>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
              {signingUp && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      onBlur={() => markTouched("fullName")}
                      aria-invalid={!!show("fullName")}
                      placeholder="Ada Lovelace"
                      maxLength={100}
                    />
                    <FieldError message={show("fullName")} />
                  </div>
                  <div className="space-y-2">
                    <Label>I am a…</Label>
                    <RadioGroup
                      value={role}
                      onValueChange={(v) => setRole(v as "student" | "tutor")}
                      className="grid grid-cols-2 gap-3"
                    >
                      {(["student", "tutor"] as const).map((option) => (
                        <Label
                          key={option}
                          htmlFor={`role-${option}`}
                          className="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-3 capitalize has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-secondary"
                        >
                          <RadioGroupItem id={`role-${option}`} value={option} />
                          {option}
                        </Label>
                      ))}
                    </RadioGroup>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mobile">
                      Mobile number {mobileRequired ? "(required)" : "(optional)"}
                    </Label>
                    <Input
                      id="mobile"
                      type="tel"
                      autoComplete="tel"
                      value={mobile}
                      onChange={(e) => {
                        setMobile(e.target.value);
                        setServerErrors((p) => ({ ...p, mobile: undefined }));
                      }}
                      onBlur={() => markTouched("mobile")}
                      aria-invalid={!!show("mobile")}
                      placeholder="+1 555 000 1234"
                      maxLength={40}
                    />
                    <FieldError message={show("mobile")} />
                    <p className="text-xs text-muted-foreground">
                      Include your country code, e.g. +1 or +91.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">WhatsApp number (optional)</Label>
                    <Input
                      id="whatsapp"
                      type="tel"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      onBlur={() => markTouched("whatsapp")}
                      aria-invalid={!!show("whatsapp")}
                      placeholder="+1 555 000 1234"
                      maxLength={40}
                    />
                    <FieldError message={show("whatsapp")} />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setServerErrors((p) => ({ ...p, email: undefined }));
                    if (signingUp) markTouched("email");
                  }}
                  onBlur={() => markTouched("email")}
                  aria-invalid={!!show("email")}
                  placeholder="you@example.com"
                />
                <FieldError message={show("email")} />
              </div>
              {!forgot && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {tab === "signin" && (
                      <button
                        type="button"
                        className="text-sm text-muted-foreground underline underline-offset-4"
                        onClick={() => setForgot(true)}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={tab === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (signingUp) markTouched("password");
                    }}
                    onBlur={() => markTouched("password")}
                    aria-invalid={!!show("password")}
                    placeholder="••••••••"
                  />
                  {signingUp && (
                    <div className="flex gap-1" aria-hidden="true">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={
                            "h-1 flex-1 rounded-full " +
                            (i < strength ? "bg-primary" : "bg-muted")
                          }
                        />
                      ))}
                    </div>
                  )}
                  <FieldError message={show("password")} />
                </div>
              )}

              {signingUp && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      markTouched("confirmPassword");
                    }}
                    onBlur={() => markTouched("confirmPassword")}
                    aria-invalid={!!show("confirmPassword")}
                    placeholder="••••••••"
                  />
                  <FieldError message={show("confirmPassword")} />
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={busy || (signingUp && formInvalid)}
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {forgot ? "Send reset link" : tab === "signup" ? "Create account" : "Sign in"}
              </Button>


              {forgot && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setForgot(false)}
                >
                  Back to sign in
                </Button>
              )}
            </form>


            <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
              Continue with Google
            </Button>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              <Link to="/" className="underline underline-offset-4">
                Back to home
              </Link>
            </p>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}
