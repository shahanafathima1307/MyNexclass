CREATE OR REPLACE FUNCTION public.public_tutor_previews()
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  bio text,
  subjects text,
  headline text,
  badge text,
  languages text,
  years_experience integer,
  hourly_rate numeric,
  currency text,
  rating_avg numeric,
  rating_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.public_tutor_previews() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_tutor_previews() TO anon, authenticated;