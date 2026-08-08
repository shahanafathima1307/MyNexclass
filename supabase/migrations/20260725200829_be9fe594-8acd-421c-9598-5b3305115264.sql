CREATE POLICY "Participants can read class recordings" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'recordings' AND EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (c.tutor_id = auth.uid() OR c.student_id = auth.uid())
  )
);
CREATE POLICY "Participants can upload class recordings" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'recordings' AND EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (c.tutor_id = auth.uid() OR c.student_id = auth.uid())
  )
);
CREATE POLICY "Participants can delete class recordings" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'recordings' AND owner = auth.uid()
);