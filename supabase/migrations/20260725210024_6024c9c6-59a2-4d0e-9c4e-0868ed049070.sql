CREATE POLICY "Signed-in members can view avatars"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Members upload their own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Members update their own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "Members delete their own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));