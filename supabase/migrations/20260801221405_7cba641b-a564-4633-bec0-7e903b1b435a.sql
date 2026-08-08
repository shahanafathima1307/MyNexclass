CREATE POLICY "Assignment participants read files" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'assignments'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = ((storage.foldername(name))[1])::uuid
      AND (a.student_id = auth.uid() OR a.tutor_id = auth.uid() OR private.has_role(auth.uid(),'admin'))
  )
);

CREATE POLICY "Assignment participants upload files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'assignments'
  AND owner = auth.uid()
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = ((storage.foldername(name))[1])::uuid
      AND (a.student_id = auth.uid() OR a.tutor_id = auth.uid() OR private.has_role(auth.uid(),'admin'))
  )
);

CREATE POLICY "Assignment owners delete files" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'assignments'
  AND (owner = auth.uid() OR private.has_role(auth.uid(),'admin'))
);