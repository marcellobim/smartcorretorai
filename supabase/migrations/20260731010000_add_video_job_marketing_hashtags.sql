ALTER TABLE public.video_jobs
  ADD COLUMN IF NOT EXISTS marketing_hashtags TEXT[] NOT NULL DEFAULT '{}';
