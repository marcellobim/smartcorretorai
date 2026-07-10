-- Smart Video reutiliza o bucket privado existente do Studio Hero.
-- Apenas amplia os formatos de entrada; não cria bucket, jobs ou renderer.
UPDATE storage.buckets
   SET allowed_mime_types = ARRAY[
     'image/jpeg', 'image/png', 'image/webp',
     'video/mp4', 'video/quicktime', 'video/webm'
   ]
 WHERE id = 'studio-videos';

-- O pipeline existente usa a mesma video_jobs. Mantém os estados legados do
-- Studio Hero e acrescenta somente os estados necessários ao Smart Video.
ALTER TABLE public.video_jobs
  DROP CONSTRAINT IF EXISTS video_jobs_status_check;

ALTER TABLE public.video_jobs
  ADD CONSTRAINT video_jobs_status_check
  CHECK (status IN (
    'pending', 'generating',
    'queued', 'processing', 'rendering',
    'completed', 'failed'
  ));
