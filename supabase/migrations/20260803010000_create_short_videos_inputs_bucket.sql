INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'short-videos-inputs',
  'short-videos-inputs',
  false,
  262144000,
  ARRAY['video/mp4']
)
ON CONFLICT (id) DO UPDATE
   SET public = false,
       file_size_limit = 262144000,
       allowed_mime_types = ARRAY['video/mp4'];

DROP POLICY IF EXISTS "short_videos_inputs_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "short_videos_inputs_owner_select" ON storage.objects;
DROP POLICY IF EXISTS "short_videos_inputs_owner_delete" ON storage.objects;

CREATE POLICY "short_videos_inputs_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'short-videos-inputs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "short_videos_inputs_owner_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'short-videos-inputs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "short_videos_inputs_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'short-videos-inputs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
