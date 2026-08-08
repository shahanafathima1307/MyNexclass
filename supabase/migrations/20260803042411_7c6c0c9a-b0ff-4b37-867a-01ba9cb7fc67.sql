-- 1. Reviewer identity protection on tutor_ratings
DROP POLICY IF EXISTS "Signed-in users can view ratings" ON public.tutor_ratings;

CREATE POLICY "Participants and admins can view ratings"
ON public.tutor_ratings
FOR SELECT
TO authenticated
USING (
  student_id = auth.uid()
  OR tutor_id = auth.uid()
  OR private.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Anonymous review feed: no student_id ever leaves the database
CREATE OR REPLACE FUNCTION public.tutor_reviews(_tutor_id uuid)
RETURNS TABLE(rating integer, comment text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT tr.rating, tr.comment, tr.created_at
  FROM public.tutor_ratings tr
  WHERE tr.tutor_id = _tutor_id
    AND auth.uid() IS NOT NULL
  ORDER BY tr.created_at DESC
$$;

REVOKE ALL ON FUNCTION public.tutor_reviews(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tutor_reviews(uuid) TO authenticated;

-- 2. Shrink SECURITY DEFINER attack surface: revoke API execute rights on
--    helpers the app never calls over the Data API.
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.my_approval_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
