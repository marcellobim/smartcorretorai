-- Studio Hero / Produto 2 - base inicial para jobs de video IA.
-- Mantem ownership no banco e storage privado para entradas e saidas.

CREATE TABLE IF NOT EXISTS public.video_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  mode TEXT NOT NULL DEFAULT 'dynamic_reel',
  style TEXT NOT NULL DEFAULT 'alto_padrao',
  model TEXT,
  prompt_final TEXT,
  input_image_1_path TEXT,
  input_image_2_path TEXT,
  output_video_path TEXT,
  signed_video_url TEXT,
  provider_job_id TEXT,
  error_message TEXT,
  tokens_reserved INTEGER NOT NULL DEFAULT 0 CHECK (tokens_reserved >= 0),
  credit_reservation_id UUID NULL,
  credit_idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_video_jobs_user_id
  ON public.video_jobs(user_id);

CREATE INDEX IF NOT EXISTS idx_video_jobs_status
  ON public.video_jobs(status);

CREATE INDEX IF NOT EXISTS idx_video_jobs_created_at
  ON public.video_jobs(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_video_jobs_credit_idempotency_key
  ON public.video_jobs(user_id, credit_idempotency_key)
  WHERE credit_idempotency_key IS NOT NULL;

DROP TRIGGER IF EXISTS update_video_jobs_updated_at ON public.video_jobs;
CREATE TRIGGER update_video_jobs_updated_at
  BEFORE UPDATE ON public.video_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.video_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios veem seus jobs de video" ON public.video_jobs;
CREATE POLICY "Usuarios veem seus jobs de video"
  ON public.video_jobs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios criam seus jobs de video" ON public.video_jobs;
CREATE POLICY "Usuarios criam seus jobs de video"
  ON public.video_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON public.video_jobs FROM PUBLIC;
GRANT SELECT, INSERT ON public.video_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_jobs TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'studio-videos',
  'studio-videos',
  false,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE
   SET public = false,
       file_size_limit = 52428800,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];

DROP POLICY IF EXISTS "studio_videos_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "studio_videos_owner_select" ON storage.objects;
DROP POLICY IF EXISTS "studio_videos_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "studio_videos_owner_delete" ON storage.objects;

CREATE POLICY "studio_videos_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'studio-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "studio_videos_owner_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'studio-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "studio_videos_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'studio-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'studio-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "studio_videos_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'studio-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
