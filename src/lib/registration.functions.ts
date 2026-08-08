import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Pre-signup server check: format, disposable providers and duplicates.
 * Public by necessity (it runs before an account exists) — it only ever
 * returns validation messages, never account data.
 */
export const checkRegistrationFn = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        email: z.string().max(320),
        mobile: z.string().max(40).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { normalizeEmail, normalizeMobile, validateEmail, validateMobile } = await import(
      "@/lib/registration"
    );

    const email = normalizeEmail(data.email);
    const emailFormat = validateEmail(email);
    if (emailFormat) return { emailError: emailFormat, mobileError: null };

    const mobileRaw = (data.mobile ?? "").trim();
    const mobileFormat = mobileRaw ? validateMobile(mobileRaw, false) : null;
    if (mobileFormat) return { emailError: null, mobileError: mobileFormat };

    // Deliverability: the domain must actually accept mail (MX, or A/AAAA
    // fallback per RFC 5321). Blocks typos and non-mail domains that pass
    // the syntax rules, e.g. "123.com"-style parked domains.
    const domain = email.split("@")[1];
    try {
      const dns = async (type: "MX" | "A") => {
        const r = await fetch(
          `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`,
          { headers: { accept: "application/dns-json" } },
        );
        if (!r.ok) return null;
        const j = (await r.json()) as { Answer?: { type: number; data: string }[] };
        return j.Answer ?? [];
      };
      const mx = await dns("MX");
      if (mx !== null) {
        const hasMx = mx.some((a) => a.type === 15 && !/^0?\s*\.?$/.test(a.data.trim()));
        if (!hasMx) {
          const a = await dns("A");
          if (a !== null && !a.some((r) => r.type === 1)) {
            return {
              emailError: "This email domain cannot receive mail. Check the address and try again.",
              mobileError: null,
            };
          }
        }
      }
    } catch {
      // DNS lookup unavailable — fall through; the OTP step still gates access.
    }

    const url = process.env["SUPABASE_URL"]!;
    const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;

    // GoTrue admin lookup — the Data API cannot read the auth schema.
    const res = await fetch(
      `${url}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&per_page=20`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    if (res.ok) {
      const body = (await res.json()) as { users?: { email?: string }[] };
      const taken = (body.users ?? []).some((u) => (u.email ?? "").toLowerCase() === email);
      if (taken)
        return {
          emailError: "An account already exists for this email address",
          mobileError: null,
        };
    }

    if (mobileRaw) {
      const digits = normalizeMobile(mobileRaw);
      const tail = digits.slice(-9);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows } = await supabaseAdmin
        .from("registration_details")
        .select("mobile")
        .not("mobile", "is", null)
        .ilike("mobile", `%${tail}%`)
        .limit(5);
      const clash = (rows ?? []).some((r) => normalizeMobile(r.mobile ?? "").endsWith(tail));
      if (clash)
        return {
          emailError: null,
          mobileError: "This mobile number is already registered",
        };
    }

    return { emailError: null, mobileError: null };
  });
