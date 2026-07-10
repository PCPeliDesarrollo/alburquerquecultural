
CREATE POLICY "Ver imagenes de eventos" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'eventos');

CREATE POLICY "Admins suben imagenes de eventos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'eventos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins actualizan imagenes de eventos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'eventos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins borran imagenes de eventos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'eventos' AND public.has_role(auth.uid(), 'admin'));
