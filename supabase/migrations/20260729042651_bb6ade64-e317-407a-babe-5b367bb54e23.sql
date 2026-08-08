CREATE POLICY "Class members read materials files" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'materials'
  AND EXISTS (
    SELECT 1 FROM public.class_materials m
    WHERE m.storage_path = storage.objects.name
      AND (private.is_class_member(auth.uid(), m.class_id) OR private.has_role(auth.uid(),'admin'))
  )
);

CREATE POLICY "Signed-in users upload materials files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'materials' AND owner = auth.uid());

CREATE POLICY "Owners update materials files" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'materials' AND owner = auth.uid())
WITH CHECK (bucket_id = 'materials' AND owner = auth.uid());

CREATE POLICY "Owners delete materials files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'materials' AND (owner = auth.uid() OR private.has_role(auth.uid(),'admin')));