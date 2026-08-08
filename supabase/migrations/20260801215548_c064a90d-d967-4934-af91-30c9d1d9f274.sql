CREATE POLICY "Anon can read rating scores only" ON public.tutor_ratings FOR SELECT TO anon USING (true);
GRANT SELECT (id, tutor_id, rating, created_at) ON public.tutor_ratings TO anon;