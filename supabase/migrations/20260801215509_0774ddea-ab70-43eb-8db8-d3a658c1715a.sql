DROP POLICY IF EXISTS "Public can view rating scores" ON public.tutor_ratings;
REVOKE SELECT ON public.tutor_ratings FROM anon;