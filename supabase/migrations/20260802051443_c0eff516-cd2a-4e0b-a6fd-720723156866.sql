-- 1. Remove direct anonymous table access; public discovery goes through public_tutor_previews() only.
DROP POLICY IF EXISTS "Public can view tutor profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can view tutor details" ON public.tutor_details;
DROP POLICY IF EXISTS "Anon can read rating scores only" ON public.tutor_ratings;
DROP POLICY IF EXISTS "Tutor roles are publicly visible" ON public.user_roles;

REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.tutor_details FROM anon;
REVOKE SELECT ON public.tutor_ratings FROM anon;
REVOKE SELECT ON public.user_roles FROM anon;

-- 2. The vetted preview function must keep working without those anon policies.
CREATE OR REPLACE FUNCTION public.public_tutor_previews()
RETURNS TABLE(id uuid, full_name text, avatar_url text, bio text, subjects text, headline text, badge text, languages text, years_experience integer, hourly_rate numeric, currency text, rating_avg numeric, rating_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    p.id,
    p.full_name,
    p.avatar_url,
    p.bio,
    p.subjects,
    td.headline,
    td.badge,
    td.languages,
    COALESCE(td.years_experience, 0),
    COALESCE(td.hourly_rate, 0),
    COALESCE(td.currency, 'USD'),
    ROUND(COALESCE(AVG(tr.rating), 0)::numeric, 2),
    COUNT(tr.id)
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'tutor'
  LEFT JOIN public.tutor_details td ON td.user_id = p.id
  LEFT JOIN public.tutor_ratings tr ON tr.tutor_id = p.id
  GROUP BY p.id, p.full_name, p.avatar_url, p.bio, p.subjects,
           td.headline, td.badge, td.languages, td.years_experience,
           td.hourly_rate, td.currency
  ORDER BY p.full_name
$function$;

COMMENT ON FUNCTION public.public_tutor_previews() IS
  'Curated public tutor list. SECURITY DEFINER on purpose: it is the only sanctioned public read path and returns a fixed, non-sensitive column set with aggregate ratings only.';

REVOKE ALL ON FUNCTION public.public_tutor_previews() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_tutor_previews() TO anon, authenticated;

-- 3. Internal RLS helpers must not be directly callable through the API.
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.is_class_host(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.is_class_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.shares_class_with(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.can_access_assignment(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.is_assignment_tutor(uuid) FROM PUBLIC, anon, authenticated;
REVOKE USAGE ON SCHEMA private FROM anon, authenticated;