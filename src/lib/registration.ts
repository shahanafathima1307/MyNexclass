/**
 * Shared registration validation. Imported by both the sign-up form (live,
 * inline validation) and the server-side pre-signup check, so the two can
 * never disagree about what a valid email or mobile number looks like.
 */

/** Trim + lowercase so duplicate checks compare like for like. */
export function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

/** Digits only, used for duplicate mobile detection. */
export function normalizeMobile(raw: string) {
  return raw.replace(/\D/g, "");
}

/** Common throwaway inbox providers — rejected at sign-up. */
export const DISPOSABLE_EMAIL_DOMAINS = [
  "mailinator.com",
  "10minutemail.com",
  "guerrillamail.com",
  "sharklasers.com",
  "yopmail.com",
  "tempmail.com",
  "temp-mail.org",
  "trashmail.com",
  "getnada.com",
  "dispostable.com",
  "fakeinbox.com",
  "throwawaymail.com",
  "maildrop.cc",
  "mintemail.com",
  "moakt.com",
  "spam4.me",
  "tempr.email",
  "emailondeck.com",
];

const LOCAL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const LABEL_RE = /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/;

/** Returns an error message, or null when the address is valid. */
export function validateEmail(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Email address is required";
  if (/\s/.test(value)) return "Email address cannot contain spaces";
  if (value.length > 255) return "Email address is too long";
  if (!value.includes("@")) return "Email address must include an @";

  const parts = value.split("@");
  if (parts.length !== 2) return "Email address must contain exactly one @";
  const [local, domain] = parts;

  if (!local) return "Add the part before the @";
  if (local.length > 64) return "The part before the @ is too long";
  if (value.includes("..")) return "Email address cannot contain consecutive dots";
  if (!LOCAL_RE.test(local)) return "Email address contains invalid characters";

  if (!domain) return "Add a domain after the @, e.g. example.com";
  if (!domain.includes(".")) return "Domain must include a dot, e.g. example.com";
  if (domain.startsWith("-") || domain.endsWith("-") || domain.startsWith(".") || domain.endsWith("."))
    return "Domain is not valid";

  const labels = domain.split(".");
  if (labels.some((l) => !LABEL_RE.test(l))) return "Domain is not valid";
  const tld = labels[labels.length - 1];
  if (!/^[A-Za-z]{2,24}$/.test(tld)) return "Domain ending is not valid";

  if (DISPOSABLE_EMAIL_DOMAINS.includes(domain.toLowerCase()))
    return "Temporary email addresses are not accepted";

  return null;
}

/** Country code + national number, e.g. +91 98765 43210. */
export function validateMobile(raw: string, required: boolean): string | null {
  const value = raw.trim();
  if (!value) return required ? "Mobile number is required" : null;
  if (!value.startsWith("+")) return "Start with your country code, e.g. +1 or +91";
  if (!/^\+[0-9][0-9\s()-]*$/.test(value)) return "Mobile number contains invalid characters";
  const digits = normalizeMobile(value);
  if (digits.length < 8) return "Mobile number is too short";
  if (digits.length > 15) return "Mobile number is too long";
  return null;
}

export function validateWhatsapp(raw: string): string | null {
  if (!raw.trim()) return null;
  return validateMobile(raw, false);
}

export function validateFullName(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Full name is required";
  if (value.length < 2) return "Full name is too short";
  if (value.length > 100) return "Full name is too long";
  return null;
}

export function validatePassword(raw: string): string | null {
  if (!raw) return "Password is required";
  if (raw.length < 8) return "Use at least 8 characters";
  if (raw.length > 72) return "Password is too long";
  if (!/[A-Za-z]/.test(raw)) return "Include at least one letter";
  if (!/[0-9]/.test(raw)) return "Include at least one number";
  return null;
}

export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return "Confirm your password";
  if (password !== confirm) return "Passwords do not match";
  return null;
}

/** 0–4 strength score for the meter next to the password field. */
export function passwordStrength(raw: string) {
  let score = 0;
  if (raw.length >= 8) score++;
  if (raw.length >= 12) score++;
  if (/[A-Z]/.test(raw) && /[a-z]/.test(raw)) score++;
  if (/[0-9]/.test(raw) && /[^A-Za-z0-9]/.test(raw)) score++;
  return Math.min(score, 4);
}
