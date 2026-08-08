CREATE POLICY "approval docs owner insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'approval-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "approval docs read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'approval-docs'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_approval_admin(auth.uid()))
  );