-- =============================================
-- Security hardening: smartcorretor-assets RLS
-- =============================================
-- Migra o bucket para privado e exige isolamento por pasta do usuario.

UPDATE storage.buckets
   SET public = false,
       file_size_limit = 5242880,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
 WHERE id = 'smartcorretor-assets';

DROP POLICY IF EXISTS "smartcorretor_assets_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "smartcorretor_assets_public_read" ON storage.objects;
DROP POLICY IF EXISTS "smartcorretor_assets_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "smartcorretor_assets_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "smartcorretor_assets_owner_select" ON storage.objects;
DROP POLICY IF EXISTS "smartcorretor_assets_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "smartcorretor_assets_owner_delete" ON storage.objects;

CREATE POLICY "smartcorretor_assets_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'smartcorretor-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "smartcorretor_assets_owner_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'smartcorretor-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "smartcorretor_assets_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'smartcorretor-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'smartcorretor-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "smartcorretor_assets_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'smartcorretor-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
