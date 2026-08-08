-- 1) user_roles: only tutor assignments are directory-visible
DROP POLICY IF EXISTS "Directory roles visible to signed-in users" ON public.user_roles;
CREATE POLICY "Tutor roles are publicly visible"
  ON public.user_roles FOR SELECT TO anon, authenticated
  USING (role = 'tutor'::app_role);
GRANT SELECT ON public.user_roles TO anon;

-- 2) Public tutor previews without SECURITY DEFINER
CREATE POLICY "Public can view tutor profiles"
  ON public.profiles FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = profiles.id AND ur.role = 'tutor'::app_role));
CREATE POLICY "Public can view tutor details"
  ON public.tutor_details FOR SELECT TO anon
  USING (true);
CREATE POLICY "Public can view rating scores"
  ON public.tutor_ratings FOR SELECT TO anon
  USING (true);

GRANT SELECT (id, full_name, avatar_url, bio, subjects) ON public.profiles TO anon;
GRANT SELECT (user_id, headline, badge, languages, years_experience, hourly_rate, currency) ON public.tutor_details TO anon;
GRANT SELECT (id, tutor_id, rating) ON public.tutor_ratings TO anon;

CREATE OR REPLACE FUNCTION public.public_tutor_previews()
 RETURNS TABLE(id uuid, full_name text, avatar_url text, bio text, subjects text, headline text, badge text, languages text, years_experience integer, hourly_rate numeric, currency text, rating_avg numeric, rating_count bigint)
 LANGUAGE sql
 STABLE SECURITY INVOKER
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
GRANT EXECUTE ON FUNCTION public.public_tutor_previews() TO anon, authenticated;

-- 3) notifications: require a legitimate relationship
DROP POLICY IF EXISTS "Signed-in users create notifications" ON public.notifications;
CREATE POLICY "Related users create notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR private.has_role(auth.uid(), 'admin'::app_role)
    OR private.shares_class_with(auth.uid(), user_id)
    OR EXISTS (
      SELECT 1 FROM public.class_requests cr
      WHERE (cr.tutor_id = auth.uid() AND cr.student_id = notifications.user_id)
         OR (cr.student_id = auth.uid() AND cr.tutor_id = notifications.user_id)
    )
  );

-- 4) materials storage uploads must belong to a class the uploader is in
DROP POLICY IF EXISTS "Signed-in users upload materials files" ON storage.objects;
CREATE POLICY "Class members upload materials files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'materials'
    AND owner = auth.uid()
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND (
      private.is_class_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
      OR private.is_class_host(auth.uid(), ((storage.foldername(name))[1])::uuid)
      OR private.has_role(auth.uid(), 'admin'::app_role)
    )
  );